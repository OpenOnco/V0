/**
 * MRD Triage: AI-powered relevance scoring using Claude Sonnet
 * Fast, cheap triage to filter before full classification
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mrd-triage');
const SONNET_MODEL = 'claude-sonnet-4-6';

let anthropic = null;

function getClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for MRD triage');
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const TRIAGE_PROMPT = `You are a medical literature classifier specializing in MRD (Molecular Residual Disease) for solid tumors.

Evaluate this article for relevance to MRD clinical guidance. Score 1-10 where:
- 10: Directly actionable MRD guidance (guidelines, landmark trials, consensus)
- 7-9: High-value clinical evidence (Phase 3 trials, meta-analyses, practice-changing)
- 4-6: Useful context (observational studies, reviews with novel insights)
- 1-3: Tangentially related or not relevant

Focus on:
- Solid tumors (colorectal, breast, lung, bladder, etc.) - NOT hematologic
- Clinical utility of ctDNA/MRD testing
- Treatment decisions based on MRD status
- Surveillance and recurrence detection
- Guidelines and recommendations

STRICT EXCLUSIONS — score 1-2 for these:
- Hematologic malignancies (leukemia, lymphoma, myeloma, MDS) unless comparing solid tumor MRD approaches
- Broad biomarker reviews not focused on MRD/ctDNA clinical utility
- Basic science without clinical MRD application
- Surgical technique papers without MRD correlation
- General oncology news (FDA alerts, drug safety) unless directly about an MRD/ctDNA test

Respond with ONLY a JSON object (no markdown):
{
  "score": <1-10>,
  "reason": "<brief 1-sentence explanation>",
  "cancer_types": ["colorectal", "breast", etc] or [],
  "is_guideline": true/false,
  "is_trial_result": true/false
}`;

/**
 * Triage a single article with Sonnet
 * @param {Object} article - Article with title and abstract
 * @returns {Promise<Object>} - Triage result
 */
export async function triageArticle(article) {
  const client = getClient();

  const content = `Title: ${article.title}

Abstract: ${article.abstract || 'Not available'}

Publication Types: ${article.publicationTypes?.join(', ') || 'Unknown'}

MeSH Terms: ${article.meshTerms?.slice(0, 10).join(', ') || 'None'}`;

  try {
    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `${TRIAGE_PROMPT}\n\n---\n\n${content}`,
        },
      ],
    });

    const text = response.content[0]?.text || '';

    // Parse JSON response
    let result;
    try {
      // Handle potential markdown code fences
      let jsonText = text.trim();
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      result = JSON.parse(jsonText);
    } catch (parseError) {
      logger.warn('Failed to parse triage response', {
        pmid: article.pmid,
        response: text.substring(0, 200),
      });
      result = {
        score: 5,
        reason: 'Parse error - defaulting to medium relevance',
        cancer_types: [],
        is_guideline: false,
        is_trial_result: false,
      };
    }

    return {
      pmid: article.pmid,
      ...result,
      model: SONNET_MODEL,
      triaged_at: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Triage failed', { pmid: article.pmid, error: error.message });
    throw error;
  }
}

/**
 * Batch triage articles with rate limiting
 * @param {Object[]} articles - Array of articles
 * @param {Object} options - Options
 * @returns {Promise<Object[]>} - Array of triage results
 */
export async function batchTriage(articles, options = {}) {
  const {
    concurrency = 5,
    delayMs = 100,
    minScore = 0,  // v5: annotate all items, don't filter — /triage does real triage
  } = options;

  logger.info('Starting batch triage', { count: articles.length, concurrency });

  const results = [];
  const passed = [];
  const failed = [];

  // Process in batches for rate limiting
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (article) => {
        try {
          const result = await triageArticle(article);
          return { article, result, error: null };
        } catch (error) {
          return { article, result: null, error: error.message };
        }
      })
    );

    for (const { article, result, error } of batchResults) {
      if (error) {
        failed.push({ pmid: article.pmid, error });
        continue;
      }

      results.push(result);

      if (result.score >= minScore) {
        passed.push({
          ...article,
          triageResult: result,
        });
      }
    }

    // Rate limiting delay between batches
    if (i + concurrency < articles.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    logger.debug('Batch triage progress', {
      processed: Math.min(i + concurrency, articles.length),
      total: articles.length,
      passed: passed.length,
    });
  }

  logger.info('Batch triage complete', {
    total: articles.length,
    passed: passed.length,
    failed: failed.length,
    passRate: `${((passed.length / articles.length) * 100).toFixed(1)}%`,
  });

  return {
    results,
    passed,
    failed,
    stats: {
      total: articles.length,
      passed: passed.length,
      failed: failed.length,
      avgScore: results.length > 0
        ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)
        : 0,
    },
  };
}

/**
 * Quick triage check for a single article (returns boolean)
 * @param {Object} article - Article to check
 * @param {number} threshold - Minimum score to pass
 * @returns {Promise<boolean>}
 */
export async function isRelevant(article, threshold = 6) {
  const result = await triageArticle(article);
  return result.score >= threshold;
}

export default {
  triageArticle,
  batchTriage,
  isRelevant,
};
