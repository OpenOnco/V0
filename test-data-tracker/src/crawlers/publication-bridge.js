/**
 * Publication Bridge
 *
 * Bridges publication-index discoveries to test-data-tracker proposals.
 * When a new publication is written to the physician DB, this module checks
 * if it contains actionable data (sensitivity updates, trial results, new
 * indications, FDA changes) and creates UPDATE or NEW_TEST proposals.
 *
 * Flow:
 * 1. Receive resolved publication + source context
 * 2. Match to known test(s) via test-dictionary
 * 3. Use Claude to extract actionable field changes
 * 4. Create proposals via queue.js
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { initializeTestDictionary, matchTests, lookupTestByName } from '../data/test-dictionary.js';
import { createProposal } from '../proposals/queue.js';
import { PROPOSAL_TYPES } from '../proposals/schema.js';

const logger = createLogger('publication-bridge');

// Lazy-init Claude client
let anthropic = null;
function getAnthropic() {
  if (!anthropic) {
    anthropic = new Anthropic();
  }
  return anthropic;
}

/**
 * Bridge a resolved publication to test-data-tracker proposals.
 *
 * Called after writePublicationToPhysicianDb() succeeds for new publications.
 *
 * @param {Object} publication - The publication data written to physician DB
 * @param {Object} source - Source context { source_key, source_type, base_url }
 * @returns {Promise<Object>} { proposalsCreated: number, skipped: boolean, reason?: string }
 */
export async function bridgeToProposals(publication, source) {
  try {
    // Ensure test dictionary is loaded
    await initializeTestDictionary();

    // 1. Match publication to known tests
    const textToMatch = [
      publication.title,
      publication.clinical_context,
      publication.abstract,
    ].filter(Boolean).join(' ');

    const testMatches = matchTests(textToMatch);

    // Also try lookup by vendor from source key (e.g., "natera_signatera_publications")
    const vendorHint = extractVendorFromSourceKey(source.source_key);

    if (testMatches.length === 0 && !vendorHint) {
      logger.debug('No test matches found, skipping bridge', {
        title: publication.title?.substring(0, 60),
      });
      return { proposalsCreated: 0, skipped: true, reason: 'no_test_match' };
    }

    // 2. Use Claude to extract actionable fields
    const extraction = await extractActionableFields(publication, testMatches, vendorHint);

    if (!extraction || !extraction.actionable) {
      logger.debug('Publication not actionable', {
        title: publication.title?.substring(0, 60),
      });
      return { proposalsCreated: 0, skipped: true, reason: 'not_actionable' };
    }

    // 3. Create proposals for each actionable finding
    let proposalsCreated = 0;

    for (const finding of extraction.findings) {
      try {
        const proposal = await createProposalFromFinding(finding, publication, source);
        if (proposal) proposalsCreated++;
      } catch (error) {
        logger.warn('Failed to create proposal from finding', {
          error: error.message,
          testName: finding.testName,
        });
      }
    }

    logger.info('Publication bridge completed', {
      title: publication.title?.substring(0, 60),
      proposalsCreated,
      findings: extraction.findings.length,
    });

    return { proposalsCreated, skipped: false };

  } catch (error) {
    logger.error('Publication bridge failed', { error: error.message });
    return { proposalsCreated: 0, skipped: true, reason: `error: ${error.message}` };
  }
}

/**
 * Extract vendor hint from source key
 * e.g., "natera_signatera_publications" → "natera"
 */
function extractVendorFromSourceKey(sourceKey) {
  if (!sourceKey) return null;

  const knownVendors = [
    'natera', 'guardant', 'foundation', 'tempus', 'neogenomics',
    'biodesix', 'grail', 'exact', 'myriad', 'invitae', 'ambry',
    'resolution', 'personalis', 'inivata', 'roche', 'biovica',
  ];

  const keyLower = sourceKey.toLowerCase();
  return knownVendors.find(v => keyLower.includes(v)) || null;
}

/**
 * Use Claude to determine if a publication contains actionable test data changes
 */
async function extractActionableFields(publication, testMatches, vendorHint) {
  const client = getAnthropic();

  const matchContext = testMatches.length > 0
    ? `Tests matched by name/code: ${testMatches.map(m => `${m.test.name} (${m.test.id}, confidence: ${m.confidence})`).join(', ')}`
    : 'No tests matched by name/code.';

  const vendorContext = vendorHint
    ? `Source vendor: ${vendorHint}`
    : '';

  const prompt = `Analyze this clinical publication and determine if it contains actionable updates for a cancer diagnostic test database.

Publication:
- Title: ${publication.title || 'Unknown'}
- Authors: ${publication.authors || 'Unknown'}
- Journal: ${publication.journal || 'Unknown'}
- Year: ${publication.year || 'Unknown'}
- PMID: ${publication.pmid || 'None'}
- DOI: ${publication.doi || 'None'}
- Evidence type: ${publication.evidence_type || 'Unknown'}
- Cancer types: ${JSON.stringify(publication.cancer_types || [])}
- Clinical context: ${publication.clinical_context || 'None'}
- Abstract excerpt: ${(publication.abstract || '').substring(0, 2000)}

${matchContext}
${vendorContext}

Determine if this publication contains ANY of these actionable data points:
1. New sensitivity/specificity numbers for a specific test
2. Clinical trial results (phase II/III) with outcomes data
3. Validation in a new cancer type not previously listed
4. FDA approval, clearance, or breakthrough designation
5. Evidence for a completely new test not in our database

Return JSON:
{
  "actionable": true/false,
  "reason": "Brief explanation of why this is/isn't actionable",
  "findings": [
    {
      "type": "update" or "new_test",
      "testName": "Name of the test (must be specific, e.g., 'Signatera', 'Guardant360 CDx')",
      "testId": "ID if matched (e.g., 'mrd-7')" or null,
      "field": "sensitivity|specificity|clinicalTrials|cancerTypes|fdaStatus|newTest",
      "currentValue": "current known value if any" or null,
      "proposedValue": "new value from publication",
      "context": "Specific context (e.g., 'Stage II CRC', 'post-surgical surveillance')",
      "confidence": 0.0-1.0,
      "quote": "Key finding quoted from abstract/context"
    }
  ]
}

Only include findings where:
- The test is clearly identifiable (not vague references to "liquid biopsy" in general)
- The data is concrete (actual numbers, specific trial results, FDA decisions)
- Confidence is >= 0.6

If nothing actionable, return: { "actionable": false, "reason": "...", "findings": [] }`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Enrich findings with test dictionary matches
      for (const finding of (parsed.findings || [])) {
        if (!finding.testId && finding.testName) {
          const match = lookupTestByName(finding.testName);
          if (match) {
            finding.testId = match.id;
          }
        }
      }

      return parsed;
    }
  } catch (error) {
    logger.error('Claude extraction failed in publication bridge', { error: error.message });
  }

  return null;
}

/**
 * Create a proposal from an extracted finding
 */
async function createProposalFromFinding(finding, publication, source) {
  const pubmedUrl = publication.pmid
    ? `https://pubmed.ncbi.nlm.nih.gov/${publication.pmid}/`
    : null;
  const doiUrl = publication.doi
    ? `https://doi.org/${publication.doi}`
    : null;
  const sourceUrl = pubmedUrl || doiUrl || publication.sourceUrl || source.base_url;

  if (finding.type === 'new_test') {
    return await createProposal(PROPOSAL_TYPES.NEW_TEST, {
      testData: {
        name: finding.testName,
        vendor: extractVendorFromSourceKey(source.source_key) || 'Unknown',
        category: null, // Will need manual classification
        description: finding.context || publication.clinical_context,
        cancerTypes: publication.cancer_types || [],
        sensitivity: finding.field === 'sensitivity' ? finding.proposedValue : null,
        specificity: finding.field === 'specificity' ? finding.proposedValue : null,
      },
      source: sourceUrl,
      sourceTitle: publication.title,
      confidence: finding.confidence || 0.6,
      createdBy: 'publication-bridge',
    });
  }

  // UPDATE proposal
  const changes = {};
  if (finding.field === 'sensitivity') {
    changes.sensitivity = {
      old: finding.currentValue,
      new: finding.proposedValue,
      context: finding.context,
    };
  } else if (finding.field === 'specificity') {
    changes.specificity = {
      old: finding.currentValue,
      new: finding.proposedValue,
      context: finding.context,
    };
  } else if (finding.field === 'clinicalTrials') {
    changes.clinicalTrials = {
      added: [finding.proposedValue],
      context: finding.context,
    };
  } else if (finding.field === 'cancerTypes') {
    changes.cancerTypes = {
      added: [finding.proposedValue],
      context: finding.context,
    };
  } else if (finding.field === 'fdaStatus') {
    changes.fdaStatus = {
      old: finding.currentValue,
      new: finding.proposedValue,
      context: finding.context,
    };
  } else {
    // Generic field update
    changes[finding.field] = {
      old: finding.currentValue,
      new: finding.proposedValue,
      context: finding.context,
    };
  }

  return await createProposal(PROPOSAL_TYPES.UPDATE, {
    testName: finding.testName,
    testId: finding.testId || null,
    changes,
    source: sourceUrl,
    sourceTitle: publication.title,
    confidence: finding.confidence || 0.7,
    quotes: finding.quote ? [finding.quote] : [],
    createdBy: 'publication-bridge',
  });
}

export default { bridgeToProposals };
