/**
 * Payer Criteria Processor for MRD Guidance Monitor
 *
 * Extracts ctDNA/MRD coverage criteria from payer policy documents:
 * - Carelon (eviCore): Utilization management criteria
 * - MolDX (Medicare): LCD/LCA coverage documents
 * - Commercial payers: Medical policies
 *
 * These documents determine actual coverage and prior authorization requirements.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/client.js';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('payer-processor');

// Current extraction version
const EXTRACTION_VERSION = 1;

// Payer-specific configurations
const PAYER_CONFIG = {
  carelon: {
    name: 'Carelon (eviCore)',
    type: 'utilization_management',
    documentTypes: ['um_criteria', 'clinical_guideline', 'prior_auth'],
    keyTerms: ['eviCore', 'Carelon', 'utilization management', 'prior authorization'],
    coverageStatuses: {
      'medically_necessary': 'Covered when criteria met',
      'investigational': 'Not covered - investigational',
      'not_covered': 'Not covered',
      'prior_auth_required': 'Prior authorization required',
    },
  },
  moldx: {
    name: 'Medicare MolDX',
    type: 'lcd_lca',
    documentTypes: ['lcd', 'lca', 'billing_article'],
    keyTerms: ['MolDX', 'LCD', 'LCA', 'Medicare', 'Palmetto', 'Noridian'],
    coverageStatuses: {
      'covered': 'Covered',
      'non_covered': 'Non-covered',
      'contractor_discretion': 'At contractor discretion',
      'limitations': 'Covered with limitations',
    },
  },
  aetna: {
    name: 'Aetna',
    type: 'medical_policy',
    documentTypes: ['clinical_policy_bulletin', 'coverage_policy'],
    keyTerms: ['Aetna', 'Clinical Policy Bulletin', 'CPB'],
    coverageStatuses: {
      'medically_necessary': 'Considered medically necessary',
      'experimental': 'Considered experimental/investigational',
      'cosmetic': 'Considered cosmetic',
    },
  },
  cigna: {
    name: 'Cigna',
    type: 'medical_policy',
    documentTypes: ['coverage_policy', 'medical_necessity'],
    keyTerms: ['Cigna', 'Coverage Policy'],
    coverageStatuses: {
      'medically_necessary': 'Medically necessary',
      'not_medically_necessary': 'Not medically necessary',
      'experimental': 'Experimental/investigational',
    },
  },
  uhc: {
    name: 'UnitedHealthcare',
    type: 'medical_policy',
    documentTypes: ['medical_policy', 'coverage_determination'],
    keyTerms: ['UnitedHealthcare', 'UHC', 'Optum', 'Medical Policy'],
    coverageStatuses: {
      'proven': 'Proven and medically necessary',
      'unproven': 'Unproven',
      'cosmetic': 'Cosmetic',
    },
  },
};

// Test-specific keywords to identify specific MRD tests
const MRD_TEST_NAMES = [
  'Signatera',
  'Guardant Reveal',
  'Guardant360',
  'FoundationOne Liquid CDx',
  'FoundationOne Tracker',
  'Tempus xF',
  'Caris Assure',
  'Personalis NeXT',
  'RaDaR',
  'SafeSEQ',
  'Archer',
];

// MRD/ctDNA keywords
const MRD_KEYWORDS = [
  'ctDNA',
  'circulating tumor DNA',
  'cell-free DNA',
  'cfDNA',
  'liquid biopsy',
  'minimal residual disease',
  'molecular residual disease',
  'MRD',
  'tumor-informed',
  'tumor-naïve',
  'surveillance',
  'recurrence monitoring',
  ...MRD_TEST_NAMES.map(t => t.toLowerCase()),
];

// Cancer type patterns
const CANCER_TYPE_MAP = {
  'colorectal': ['colorectal', 'colon', 'rectal', 'CRC'],
  'breast': ['breast'],
  'lung': ['lung', 'NSCLC'],
  'bladder': ['bladder', 'urothelial'],
  'melanoma': ['melanoma'],
  'ovarian': ['ovarian'],
  'pancreatic': ['pancreatic', 'pancreas'],
  'solid_tumor': ['solid tumor', 'pan-cancer', 'tumor agnostic'],
};

/**
 * Compute SHA256 hash
 */
function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract PDF text
 */
async function extractPdfText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return {
    text: data.text,
    pageCount: data.numpages,
    info: data.info,
  };
}

/**
 * Detect payer from filename or content
 */
function detectPayer(filename, text) {
  const lowerFilename = filename.toLowerCase();
  const lowerText = text.toLowerCase().slice(0, 10000);

  // Check filename first
  for (const [payerId, config] of Object.entries(PAYER_CONFIG)) {
    if (lowerFilename.includes(payerId)) {
      return { payerId, config };
    }
  }

  // Check directory structure hint (carelon/, moldx/)
  const pathParts = filename.split(path.sep);
  for (const part of pathParts) {
    const lowerPart = part.toLowerCase();
    if (PAYER_CONFIG[lowerPart]) {
      return { payerId: lowerPart, config: PAYER_CONFIG[lowerPart] };
    }
  }

  // Check content
  for (const [payerId, config] of Object.entries(PAYER_CONFIG)) {
    for (const term of config.keyTerms) {
      if (lowerText.includes(term.toLowerCase())) {
        return { payerId, config };
      }
    }
  }

  return { payerId: 'unknown', config: null };
}

/**
 * Detect which tests are mentioned
 */
function detectMentionedTests(text) {
  const mentioned = [];
  const lowerText = text.toLowerCase();

  for (const testName of MRD_TEST_NAMES) {
    if (lowerText.includes(testName.toLowerCase())) {
      mentioned.push(testName);
    }
  }

  return mentioned;
}

/**
 * Detect cancer types mentioned
 */
function detectCancerTypes(text) {
  const types = [];
  const lowerText = text.toLowerCase();

  for (const [cancerType, patterns] of Object.entries(CANCER_TYPE_MAP)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        types.push(cancerType);
        break;
      }
    }
  }

  return [...new Set(types)];
}

/**
 * Extract policy metadata
 */
function extractPolicyMetadata(text, filename) {
  const metadata = {
    policyNumber: null,
    effectiveDate: null,
    lastReviewed: null,
    title: null,
    cptCodes: [],
    icdCodes: [],
  };

  // Policy number patterns
  const policyPatterns = [
    /Policy\s*(?:#|Number|No\.?)?[:\s]*([A-Z0-9-]+)/i,
    /LCD[:\s]*([A-Z0-9]+)/i,
    /LCA[:\s]*([A-Z0-9]+)/i,
    /CPB[:\s]*(\d+)/i,
  ];

  for (const pattern of policyPatterns) {
    const match = text.match(pattern);
    if (match) {
      metadata.policyNumber = match[1];
      break;
    }
  }

  // Date patterns
  const datePatterns = [
    /effective[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /effective[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /last\s+review(?:ed)?[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /updated[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.slice(0, 3000).match(pattern);
    if (match) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          metadata.effectiveDate = date.toISOString().split('T')[0];
          break;
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // CPT codes
  const cptMatches = text.match(/\b(0\d{4}[A-Z]?|\d{5})\b/g);
  if (cptMatches) {
    metadata.cptCodes = [...new Set(cptMatches)].slice(0, 20);
  }

  // Title (first significant line)
  const titleMatch = text.slice(0, 1000).match(/^([A-Z][^.\n]{15,100})/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  return metadata;
}

/**
 * Find MRD-relevant sections
 */
function findRelevantSections(text, windowSize = 3000) {
  const sections = [];
  const lowerText = text.toLowerCase();

  for (const keyword of MRD_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    let startIndex = 0;

    while (true) {
      const index = lowerText.indexOf(lowerKeyword, startIndex);
      if (index === -1) break;

      const windowStart = Math.max(0, index - windowSize / 2);
      const windowEnd = Math.min(text.length, index + windowSize / 2);
      const section = text.slice(windowStart, windowEnd);

      // Estimate page
      const charsPerPage = text.length / Math.max(1, Math.ceil(text.length / 3000));
      const estimatedPage = Math.ceil(index / charsPerPage);

      // Check overlap
      const isOverlapping = sections.some(s =>
        Math.abs(s.charOffset - index) < windowSize / 2
      );

      if (!isOverlapping) {
        sections.push({
          keyword,
          charOffset: index,
          estimatedPage,
          text: section.trim(),
          contextBefore: text.slice(Math.max(0, index - 200), index).trim(),
          contextAfter: text.slice(index, Math.min(text.length, index + 200)).trim(),
        });
      }

      startIndex = index + keyword.length;
    }
  }

  sections.sort((a, b) => a.charOffset - b.charOffset);
  return sections;
}

/**
 * Use Claude to extract coverage criteria
 */
async function extractCoverageCriteria(sections, payerConfig, mentionedTests, cancerTypes, metadata) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required');
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const combinedText = sections.map(s => s.text).join('\n\n---\n\n');

  const payerContext = payerConfig
    ? `This is from ${payerConfig.name} (${payerConfig.type}). Coverage statuses include: ${JSON.stringify(payerConfig.coverageStatuses)}`
    : 'Payer unknown.';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are extracting payer coverage criteria for ctDNA/MRD tests.

${payerContext}

For each distinct coverage criterion, provide:
- test_name: Specific test name if mentioned (Signatera, Guardant Reveal, etc.) or "ctDNA/MRD tests" if general
- coverage_status: covered/not_covered/covered_with_conditions/investigational/prior_auth_required
- conditions: Array of specific conditions that must be met for coverage
- cancer_types: Array of cancer types this applies to
- clinical_settings: Array of approved clinical settings (surveillance, treatment selection, etc.)
- exclusions: Array of explicitly excluded scenarios
- key_quote: VERBATIM quote from policy (max 100 words, MUST be exact)
- decision_context: Object with:
  - coverage_criteria: Bullet list of required criteria
  - documentation_required: What documentation is needed
  - frequency_limits: Any limits on testing frequency
  - prior_auth: Whether prior auth is required
- cpt_codes: CPT codes mentioned for this test/indication

Return JSON array. Focus on actionable coverage information.
IMPORTANT: key_quote must be EXACT verbatim text. Return [] if no clear criteria.`,
    messages: [
      {
        role: 'user',
        content: `Extract coverage criteria for ctDNA/MRD from this ${payerConfig?.name || 'payer'} policy:\n\nTests mentioned: ${mentionedTests.join(', ')}\nCancer types: ${cancerTypes.join(', ')}\n\n${combinedText.slice(0, 15000)}`,
      },
    ],
  });

  const responseText = response.content[0]?.text || '[]';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    logger.warn('Failed to parse coverage JSON', { error: e.message });
  }

  return [];
}

/**
 * Store artifact
 */
async function storeArtifact(filePath, text, metadata, payerId) {
  const hash = computeFileHash(filePath);
  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath);

  const existing = await query(
    'SELECT id FROM mrd_artifacts WHERE sha256 = $1',
    [hash]
  );

  if (existing.rows.length > 0) {
    logger.info('Artifact already exists', { hash: hash.substring(0, 12) });
    return { id: existing.rows[0].id, isNew: false };
  }

  const result = await query(
    `INSERT INTO mrd_artifacts (
      source_type, source_identifier, sha256, file_size, content_type,
      original_filename, extracted_text, page_count, metadata,
      effective_date, version_string, processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    RETURNING id`,
    [
      `payer-${payerId}`,
      metadata.policyNumber || filename,
      hash,
      stats.size,
      'application/pdf',
      filename,
      text,
      metadata.pageCount,
      JSON.stringify(metadata),
      metadata.effectiveDate,
      metadata.policyNumber,
    ]
  );

  logger.info('Stored artifact', { id: result.rows[0].id, filename, payer: payerId });
  return { id: result.rows[0].id, isNew: true };
}

/**
 * Store quote anchor
 */
async function storeQuoteAnchor(guidanceId, artifactId, quote, section) {
  try {
    await query(
      `INSERT INTO mrd_quote_anchors (
        guidance_id, artifact_id, quote_text, quote_type,
        page_number, section_heading, context_before, context_after,
        char_offset, is_verbatim
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        guidanceId,
        artifactId,
        quote,
        'coverage_criterion',
        section?.estimatedPage,
        section?.keyword,
        section?.contextBefore?.substring(0, 200),
        section?.contextAfter?.substring(0, 200),
        section?.charOffset,
        true,
      ]
    );
    return true;
  } catch (error) {
    logger.warn('Failed to store quote anchor', { error: error.message });
    return false;
  }
}

/**
 * Save coverage criteria to database
 */
async function saveCoverageCriteria(criteria, payerId, payerConfig, metadata, artifactId, sections) {
  const results = { saved: 0, skipped: 0, quotes: 0 };

  for (const crit of criteria) {
    try {
      // Check for duplicates
      const existing = await query(
        `SELECT id FROM mrd_guidance_items
         WHERE source_type = $1
         AND (summary ILIKE $2 OR title ILIKE $3)`,
        [
          `payer-${payerId}`,
          `%${(crit.test_name || '').substring(0, 50)}%${(crit.coverage_status || '').substring(0, 20)}%`,
          `%${payerId}%${(crit.test_name || '').substring(0, 30)}%`,
        ]
      );

      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      // Build title
      const payerName = payerConfig?.name || payerId.toUpperCase();
      const testPart = crit.test_name || 'ctDNA Testing';
      const statusPart = crit.coverage_status?.replace(/_/g, ' ') || 'Coverage';
      const title = `${payerName}: ${testPart} - ${statusPart}`;

      // Build summary
      const conditions = crit.conditions?.length > 0
        ? `Conditions: ${crit.conditions.join('; ')}`
        : '';
      const cancers = crit.cancer_types?.length > 0
        ? `Cancers: ${crit.cancer_types.join(', ')}`
        : '';
      const summary = [crit.coverage_status, conditions, cancers].filter(Boolean).join('. ');

      // Build decision context
      const decisionContext = crit.decision_context || {
        coverage_criteria: crit.conditions || [],
        documentation_required: [],
        frequency_limits: null,
        prior_auth: crit.coverage_status === 'prior_auth_required',
      };
      decisionContext.coverage_status = crit.coverage_status;
      decisionContext.exclusions = crit.exclusions || [];

      // Direct quotes
      const directQuotes = crit.key_quote ? [{
        text: crit.key_quote,
        type: 'coverage_criterion',
      }] : [];

      // Insert
      const insertResult = await query(
        `INSERT INTO mrd_guidance_items (
          source_type, source_id, source_url,
          title, summary, evidence_type, evidence_level,
          key_findings, publication_date,
          artifact_id, decision_context, direct_quotes,
          extraction_version, source_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          `payer-${payerId}`,
          `${payerId}-${crit.test_name?.toLowerCase().replace(/\s+/g, '-') || 'ctdna'}-${Date.now()}`,
          null,
          title,
          summary,
          'payer_policy',
          crit.coverage_status,
          JSON.stringify([{
            test: crit.test_name,
            status: crit.coverage_status,
            conditions: crit.conditions,
            cancers: crit.cancer_types,
            settings: crit.clinical_settings,
            exclusions: crit.exclusions,
            cpt: crit.cpt_codes,
            quote: crit.key_quote,
          }]),
          metadata.effectiveDate ? new Date(metadata.effectiveDate) : new Date(),
          artifactId,
          JSON.stringify(decisionContext),
          JSON.stringify(directQuotes),
          EXTRACTION_VERSION,
          metadata.policyNumber,
        ]
      );

      const guidanceId = insertResult.rows[0].id;
      results.saved++;

      // Store quote anchor
      if (crit.key_quote) {
        const matchingSection = sections.find(s =>
          s.text.toLowerCase().includes(crit.key_quote.toLowerCase().substring(0, 50))
        );
        const stored = await storeQuoteAnchor(guidanceId, artifactId, crit.key_quote, matchingSection);
        if (stored) results.quotes++;
      }

      logger.info('Saved coverage criterion', {
        id: guidanceId,
        title,
        payer: payerId,
        status: crit.coverage_status,
      });

    } catch (error) {
      logger.warn('Failed to save coverage criterion', { error: error.message });
    }
  }

  return results;
}

/**
 * Process a payer policy PDF
 */
export async function processPayerCriteria(filePath, options = {}) {
  const filename = path.basename(filePath);
  const fullPath = filePath.includes(path.sep) ? filePath : path.join(process.cwd(), filePath);

  logger.info('Processing payer policy', { filename });

  // Extract text
  const { text, pageCount, info } = await extractPdfText(fullPath);
  logger.info('Extracted PDF text', { length: text.length, pages: pageCount });

  // Detect payer and extract metadata
  const { payerId, config: payerConfig } = detectPayer(filePath, text);
  const mentionedTests = detectMentionedTests(text);
  const cancerTypes = detectCancerTypes(text);
  const metadata = extractPolicyMetadata(text, filename);
  metadata.pageCount = pageCount;
  metadata.pdfInfo = info;

  logger.info('Detected document info', {
    payer: payerId,
    tests: mentionedTests,
    cancers: cancerTypes,
    policy: metadata.policyNumber,
  });

  // Store artifact
  const artifact = await storeArtifact(fullPath, text, metadata, payerId);

  // Find relevant sections
  const sections = findRelevantSections(text);
  logger.info('Found relevant sections', { count: sections.length });

  if (sections.length === 0) {
    logger.warn('No MRD/ctDNA content found in policy');
    await query(
      'UPDATE mrd_artifacts SET items_extracted = 0 WHERE id = $1',
      [artifact.id]
    );
    return {
      success: false,
      reason: 'No MRD content found',
      artifactId: artifact.id,
      filename,
      payer: payerId,
    };
  }

  // Extract coverage criteria
  const criteria = await extractCoverageCriteria(sections, payerConfig, mentionedTests, cancerTypes, metadata);
  logger.info('Extracted coverage criteria', { count: criteria.length });

  if (criteria.length === 0) {
    logger.warn('No coverage criteria extracted');
    await query(
      'UPDATE mrd_artifacts SET items_extracted = 0 WHERE id = $1',
      [artifact.id]
    );
    return {
      success: false,
      reason: 'No coverage criteria extracted',
      artifactId: artifact.id,
      filename,
      payer: payerId,
      sectionsFound: sections.length,
    };
  }

  // Save to database
  const results = await saveCoverageCriteria(criteria, payerId, payerConfig, metadata, artifact.id, sections);
  logger.info('Saved to database', results);

  // Update artifact
  await query(
    'UPDATE mrd_artifacts SET items_extracted = $1 WHERE id = $2',
    [results.saved, artifact.id]
  );

  return {
    success: true,
    filename,
    payer: payerId,
    payerName: payerConfig?.name,
    policyNumber: metadata.policyNumber,
    effectiveDate: metadata.effectiveDate,
    mentionedTests,
    cancerTypes,
    artifactId: artifact.id,
    artifactIsNew: artifact.isNew,
    sectionsFound: sections.length,
    criteriaExtracted: criteria.length,
    ...results,
  };
}

/**
 * Process all PDFs in a payer directory
 */
export async function processPayerDirectory(dirPath) {
  const files = fs.readdirSync(dirPath, { recursive: true })
    .filter(f => f.toLowerCase().endsWith('.pdf'));

  logger.info('Processing payer directory', { files: files.length });

  const results = [];
  for (const file of files) {
    try {
      const result = await processPayerCriteria(path.join(dirPath, file));
      results.push(result);
    } catch (error) {
      logger.error('Failed to process PDF', { file, error: error.message });
      results.push({ success: false, filename: file, error: error.message });
    }
  }

  return results;
}

export default {
  processPayerCriteria,
  processPayerDirectory,
  detectPayer,
  PAYER_CONFIG,
  EXTRACTION_VERSION,
};
