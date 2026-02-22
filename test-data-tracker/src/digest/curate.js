/**
 * Content curation module for Physician MRD Weekly Digest
 *
 * Gathers recent content from:
 * - mrd_guidance_items (PubMed, guidelines, regulatory)
 * - Proposals (coverage, updates, new-tests)
 * - Crawler discoveries (payers, vendor, FDA)
 *
 * Filters by subscriber preferences and sorts by relevance.
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/mrd-client.js';
import { createLogger } from '../utils/logger.js';
import { listPending } from '../proposals/queue.js';

const logger = createLogger('digest:curate');

/**
 * Curate digest content for a given time window
 *
 * @param {Object} options
 * @param {number} options.days - Number of days to look back (default 7)
 * @param {string[]} options.cancerTypes - Filter by cancer types (null = all)
 * @param {string[]} options.contentTypes - Filter by content types (null = all)
 * @returns {Object} Structured content for template rendering
 */
export async function curateDigestContent({ days = 7, cancerTypes = null, contentTypes = null } = {}) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString();

  logger.info('Curating digest content', { days, cancerTypes, contentTypes, cutoff });

  const content = {
    clinicalEvidence: [],
    coverageUpdates: [],
    newTests: [],
    guidelineUpdates: [],
    fundingHighlights: [],
    totalItems: 0,
  };

  // 1. Query mrd_guidance_items added in last N days
  try {
    const shouldInclude = (type) => !contentTypes || contentTypes.length === 0;

    // Clinical evidence (PubMed, preprints)
    if (!contentTypes || contentTypes.length === 0 || contentTypes.includes('clinical_evidence')) {
      const evidenceResult = await query(
        `SELECT g.id, g.title, g.summary, g.journal, g.publication_date, g.source_url,
                g.evidence_type, g.relevance_score, g.source_type, g.authors,
                COALESCE(
                  (SELECT jsonb_agg(ct.cancer_type) FROM mrd_guidance_cancer_types ct WHERE ct.guidance_id = g.id),
                  '[]'::jsonb
                ) AS cancer_types
         FROM mrd_guidance_items g
         WHERE g.created_at >= $1
           AND g.is_superseded = FALSE
           AND g.source_type IN ('pubmed', 'preprint')
         ORDER BY g.relevance_score DESC NULLS LAST, g.publication_date DESC
         LIMIT 10`,
        [cutoff]
      );

      content.clinicalEvidence = filterByCancerType(evidenceResult.rows, cancerTypes).slice(0, 5);
    }

    // Also pull high-scoring items from discovery queue (PubMed crawler staging)
    if (!contentTypes || contentTypes.length === 0 || contentTypes.includes('clinical_evidence')) {
      const discoveryResult = await query(
        `SELECT dq.id, dq.source_url, dq.ai_relevance_score AS relevance_score,
                dq.ai_summary AS summary, dq.source_type,
                (dq.raw_data->>'title') AS title,
                (dq.raw_data->>'journal') AS journal,
                (dq.raw_data->>'publicationDate') AS publication_date,
                dq.ai_classification->>'evidence_type' AS evidence_type,
                COALESCE(dq.ai_classification->'cancer_types', '[]'::jsonb) AS cancer_types
         FROM mrd_discovery_queue dq
         WHERE dq.discovered_at >= $1
           AND dq.status = 'ai_triaged'
           AND dq.ai_relevance_score >= 7
           AND dq.source_type = 'pubmed'
           AND NOT EXISTS (
             SELECT 1 FROM mrd_guidance_items gi
             WHERE gi.source_id = dq.source_id AND gi.source_type = dq.source_type
           )
         ORDER BY dq.ai_relevance_score DESC
         LIMIT 10`,
        [cutoff]
      );

      if (discoveryResult.rows.length > 0) {
        logger.info('Found high-scoring discovery queue items', { count: discoveryResult.rows.length });
        content.clinicalEvidence = [
          ...content.clinicalEvidence,
          ...filterByCancerType(discoveryResult.rows, cancerTypes),
        ]
          .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
          .slice(0, 8);
      }
    }

    // Guideline updates (NCCN, ESMO, ASCO)
    if (!contentTypes || contentTypes.length === 0 || contentTypes.includes('guideline_updates')) {
      const guidelineResult = await query(
        `SELECT g.id, g.title, g.summary, g.source_url, g.publication_date,
                g.evidence_type, g.source_type,
                COALESCE(
                  (SELECT jsonb_agg(ct.cancer_type) FROM mrd_guidance_cancer_types ct WHERE ct.guidance_id = g.id),
                  '[]'::jsonb
                ) AS cancer_types
         FROM mrd_guidance_items g
         WHERE g.created_at >= $1
           AND g.is_superseded = FALSE
           AND (g.source_type IN ('nccn', 'esmo', 'asco') OR g.evidence_type = 'guideline')
         ORDER BY g.relevance_score DESC NULLS LAST, g.publication_date DESC
         LIMIT 5`,
        [cutoff]
      );

      content.guidelineUpdates = filterByCancerType(guidelineResult.rows, cancerTypes);
    }

    // Regulatory / FDA items
    if (!contentTypes || contentTypes.length === 0 || contentTypes.includes('new_tests')) {
      const fdaResult = await query(
        `SELECT g.id, g.title, g.summary, g.source_url, g.publication_date,
                g.evidence_type, g.source_type
         FROM mrd_guidance_items g
         WHERE g.created_at >= $1
           AND g.is_superseded = FALSE
           AND (g.source_type = 'fda' OR g.evidence_type = 'regulatory')
         ORDER BY g.publication_date DESC
         LIMIT 5`,
        [cutoff]
      );

      content.newTests = fdaResult.rows;
    }
  } catch (error) {
    logger.warn('Failed to query guidance items', { error: error.message });
  }

  // 2. Query recent proposals
  try {
    const allPending = await listPending();
    const recentProposals = allPending.filter(p => {
      const created = new Date(p.createdAt || p.timestamp);
      return created >= cutoffDate;
    });

    // Coverage proposals
    if (!contentTypes || contentTypes.length === 0 || contentTypes.includes('coverage_updates')) {
      const coverageProposals = recentProposals.filter(p => p.type === 'coverage');
      for (const p of coverageProposals) {
        content.coverageUpdates.push({
          title: `${p.payer || 'Payer'} — ${p.testName || 'Test'}`,
          summary: p.conditions || `Coverage status: ${p.coverageStatus || 'updated'}`,
          source_url: p.source,
          payer: p.payer,
          testName: p.testName,
          status: p.coverageStatus,
        });
      }
    }

    // New test proposals
    if (!contentTypes || contentTypes.length === 0 || contentTypes.includes('new_tests')) {
      const newTestProposals = recentProposals.filter(p => p.type === 'new-test');
      for (const p of newTestProposals) {
        content.newTests.push({
          title: p.testName || p.name || 'New test',
          summary: p.description || `New test from ${p.vendor || 'vendor'}`,
          source_url: p.source,
        });
      }
    }

    // Update proposals (for guideline context)
    if (!contentTypes || contentTypes.length === 0 || contentTypes.includes('guideline_updates')) {
      const updateProposals = recentProposals.filter(p => p.type === 'update');
      for (const p of updateProposals) {
        if (p.field?.includes('guideline') || p.field?.includes('nccn')) {
          content.guidelineUpdates.push({
            title: `${p.testName || 'Test'} — ${p.field || 'Update'}`,
            summary: p.newValue || p.description || 'Updated',
            source_url: p.source,
          });
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to query proposals', { error: error.message });
  }

  // 3. Query NIH grant store for new/updated grants
  try {
    const { readFileSync, existsSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const grantsPath = join(dirname(fileURLToPath(import.meta.url)), '../../data/nih-grants.json');

    if (existsSync(grantsPath)) {
      const store = JSON.parse(readFileSync(grantsPath, 'utf-8'));
      const grants = store.grants || {};

      // Find grants first seen within the time window
      const newGrants = Object.values(grants)
        .filter(g => g.first_seen && new Date(g.first_seen) >= cutoffDate)
        .sort((a, b) => (b.award_amount || 0) - (a.award_amount || 0))
        .slice(0, 5);

      for (const g of newGrants) {
        const parts = [];
        if (g.activity_code) parts.push(g.activity_code);
        if (g.award_amount) parts.push(`$${(g.award_amount / 1000).toFixed(0)}K`);
        if (g.agency) parts.push(g.agency);
        if (g.organization_name) parts.push(g.organization_name);
        if (g.pi_names) parts.push(`PI: ${g.pi_names}`);

        content.fundingHighlights.push({
          title: g.project_title,
          summary: parts.join(' | '),
          source_url: `https://reporter.nih.gov/project-details/${g.appl_id}`,
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to query NIH grants', { error: error.message });
  }

  content.totalItems =
    content.clinicalEvidence.length +
    content.coverageUpdates.length +
    content.newTests.length +
    content.guidelineUpdates.length +
    content.fundingHighlights.length;

  logger.info('Content curated (pre-AI)', {
    evidence: content.clinicalEvidence.length,
    coverage: content.coverageUpdates.length,
    newTests: content.newTests.length,
    guidelines: content.guidelineUpdates.length,
    funding: content.fundingHighlights.length,
    total: content.totalItems,
  });

  // AI curation layer — filter and rewrite summaries for MRD relevance
  const aiCurate = process.env.DIGEST_AI_CURATE !== 'false'; // default true
  if (aiCurate && content.totalItems > 0) {
    await curateWithAI(content);
  }

  return content;
}

const AI_CURATE_MODEL = 'claude-sonnet-4-6';

const AI_CURATE_SYSTEM = `You are curating the OpenOnco MRD Weekly Digest for oncologists. This digest is specifically about Molecular Residual Disease (MRD) and circulating tumor DNA (ctDNA) in solid tumors.

For each item, decide:
1. Is this DIRECTLY relevant to MRD/ctDNA clinical practice in solid tumors?
2. If YES: Write a 2-sentence summary explaining its significance for MRD. Include why an oncologist should care.
3. If NO: Mark it for exclusion.

EXCLUDE items that are:
- About hematologic malignancies (unless comparing to solid tumor MRD)
- General oncology news unrelated to MRD/ctDNA testing
- Broad biomarker reviews without specific MRD/ctDNA focus
- FDA alerts about drugs/devices unrelated to molecular diagnostics
- NIH grants without clear MRD/ctDNA/liquid biopsy focus

Respond with JSON only:
{
  "clinicalEvidence": [
    {"id": "<original id>", "include": true/false, "mrd_summary": "<2-sentence summary for included items>"}
  ],
  "newTests": [
    {"index": 0, "include": true/false, "mrd_summary": "<summary if included>"}
  ],
  "guidelineUpdates": [
    {"index": 0, "include": true/false, "mrd_summary": "<summary if included>"}
  ],
  "fundingHighlights": [
    {"index": 0, "include": true/false, "mrd_summary": "<summary if included>"}
  ]
}`;

/**
 * AI curation: filter irrelevant items and rewrite summaries for MRD focus
 * Mutates the content object in place.
 */
async function curateWithAI(content) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build the payload of candidate items
    const payload = {
      clinicalEvidence: content.clinicalEvidence.map(e => ({
        id: e.id,
        title: e.title,
        summary: e.summary,
        evidence_type: e.evidence_type,
        cancer_types: e.cancer_types,
      })),
      newTests: content.newTests.map((t, i) => ({
        index: i,
        title: t.title,
        summary: t.summary,
      })),
      guidelineUpdates: content.guidelineUpdates.map((g, i) => ({
        index: i,
        title: g.title,
        summary: g.summary,
      })),
      fundingHighlights: content.fundingHighlights.map((f, i) => ({
        index: i,
        title: f.title,
        summary: f.summary,
      })),
    };

    logger.info('Running AI curation', {
      candidates: content.totalItems,
      model: AI_CURATE_MODEL,
    });

    const response = await client.messages.create({
      model: AI_CURATE_MODEL,
      max_tokens: 2048,
      system: AI_CURATE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Curate these digest candidates:\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    const text = response.content[0]?.text || '';
    let jsonText = text.trim();
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    const decisions = JSON.parse(jsonText);

    // Apply decisions to clinicalEvidence
    if (decisions.clinicalEvidence) {
      const decisionMap = new Map(decisions.clinicalEvidence.map(d => [String(d.id), d]));
      content.clinicalEvidence = content.clinicalEvidence.filter(item => {
        const d = decisionMap.get(String(item.id));
        if (!d || !d.include) return false;
        if (d.mrd_summary) item.summary = d.mrd_summary;
        return true;
      });
    }

    // Apply decisions to newTests
    if (decisions.newTests) {
      const includeSet = new Set(decisions.newTests.filter(d => d.include).map(d => d.index));
      const summaryMap = new Map(decisions.newTests.filter(d => d.include && d.mrd_summary).map(d => [d.index, d.mrd_summary]));
      content.newTests = content.newTests.filter((item, i) => {
        if (!includeSet.has(i)) return false;
        if (summaryMap.has(i)) item.summary = summaryMap.get(i);
        return true;
      });
    }

    // Apply decisions to guidelineUpdates
    if (decisions.guidelineUpdates) {
      const includeSet = new Set(decisions.guidelineUpdates.filter(d => d.include).map(d => d.index));
      const summaryMap = new Map(decisions.guidelineUpdates.filter(d => d.include && d.mrd_summary).map(d => [d.index, d.mrd_summary]));
      content.guidelineUpdates = content.guidelineUpdates.filter((item, i) => {
        if (!includeSet.has(i)) return false;
        if (summaryMap.has(i)) item.summary = summaryMap.get(i);
        return true;
      });
    }

    // Apply decisions to fundingHighlights
    if (decisions.fundingHighlights) {
      const includeSet = new Set(decisions.fundingHighlights.filter(d => d.include).map(d => d.index));
      const summaryMap = new Map(decisions.fundingHighlights.filter(d => d.include && d.mrd_summary).map(d => [d.index, d.mrd_summary]));
      content.fundingHighlights = content.fundingHighlights.filter((item, i) => {
        if (!includeSet.has(i)) return false;
        if (summaryMap.has(i)) item.summary = summaryMap.get(i);
        return true;
      });
    }

    // Recalculate totalItems
    const prevTotal = content.totalItems;
    content.totalItems =
      content.clinicalEvidence.length +
      content.coverageUpdates.length +
      content.newTests.length +
      content.guidelineUpdates.length +
      content.fundingHighlights.length;

    logger.info('AI curation complete', {
      before: prevTotal,
      after: content.totalItems,
      removed: prevTotal - content.totalItems,
    });
  } catch (error) {
    logger.warn('AI curation failed, using unfiltered content', { error: error.message });
    // Fall through — content is unchanged
  }
}

/**
 * Filter items by subscriber cancer type preferences
 */
function filterByCancerType(items, cancerTypes) {
  if (!cancerTypes || cancerTypes.length === 0) return items;

  return items.filter(item => {
    const itemTypes = item.cancer_types || [];
    // Include if no cancer types tagged (general content) or if any match
    if (itemTypes.length === 0) return true;
    return itemTypes.some(t => cancerTypes.includes(t));
  });
}

export default { curateDigestContent };
