/**
 * MRD Classifier: Full AI classification using Claude Sonnet
 * Extracts structured metadata for approved guidance items
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mrd-classifier');
const SONNET_MODEL = 'claude-sonnet-4-20250514';

let anthropic = null;

function getClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for MRD classification');
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const CLASSIFICATION_PROMPT = `You are a medical literature classifier specializing in MRD (Molecular Residual Disease) for solid tumors.

Analyze this article and extract structured metadata for a clinical guidance database.

Respond with ONLY a JSON object (no markdown):
{
  "evidence_type": "guideline" | "consensus" | "rct_results" | "observational" | "meta_analysis" | "review" | "regulatory" | "coverage_policy",
  "evidence_level": "<as stated in source, e.g., 'NCCN Category 2A', 'Level I', 'Grade A', or null>",
  "relevance_score": <1-10>,

  "cancer_types": ["colorectal", "breast", "lung_nsclc", "lung_sclc", "bladder", "pancreatic", "melanoma", "ovarian", "gastric", "esophageal", "hepatocellular", "prostate", "renal", "multi_solid"],

  "clinical_settings": ["screening", "diagnosis", "pre_surgery", "post_surgery", "neoadjuvant", "during_adjuvant", "post_adjuvant", "surveillance", "recurrence", "metastatic"],

  "questions_addressed": ["when_to_test", "which_test", "positive_result_action", "negative_result_action", "test_frequency", "de_escalation", "escalation", "prognosis", "clinical_trial_eligibility"],

  "summary": "<2-3 sentence summary focusing on clinical implications>",

  "key_findings": [
    {"finding": "<specific finding>", "implication": "<clinical implication>"}
  ],

  "tests_mentioned": ["Signatera", "Guardant Reveal", etc.],

  "is_practice_changing": true/false,
  "recommends_clinical_trial": true/false,

  "notes": "<any additional relevant context>"
}

Use only values from the provided arrays for cancer_types, clinical_settings, and questions_addressed.
If a field doesn't apply, use an empty array or null.`;

/**
 * Classify a single article with Sonnet
 * @param {Object} article - Article with title, abstract, and metadata
 * @returns {Promise<Object>} - Classification result
 */
export async function classifyArticle(article) {
  const client = getClient();

  const content = `Title: ${article.title}

Abstract: ${article.abstract || 'Not available'}

Journal: ${article.journal || 'Unknown'}
Publication Date: ${article.publicationDate || 'Unknown'}
DOI: ${article.doi || 'None'}

Publication Types: ${article.publicationTypes?.join(', ') || 'Unknown'}

MeSH Terms: ${article.meshTerms?.join(', ') || 'None'}

Keywords: ${article.keywords?.join(', ') || 'None'}

Authors: ${article.authors?.map(a => a.name).join(', ') || 'Unknown'}`;

  try {
    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${CLASSIFICATION_PROMPT}\n\n---\n\n${content}`,
        },
      ],
    });

    const text = response.content[0]?.text || '';

    // Parse JSON response
    let result;
    try {
      let jsonText = text.trim();
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      result = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error('Failed to parse classification response', {
        pmid: article.pmid,
        response: text.substring(0, 500),
      });
      throw new Error(`Parse error: ${parseError.message}`);
    }

    // Validate and normalize result
    return {
      pmid: article.pmid,
      ...normalizeClassification(result),
      model: SONNET_MODEL,
      classified_at: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Classification failed', { pmid: article.pmid, error: error.message });
    throw error;
  }
}

/**
 * Normalize classification result to ensure valid values
 */
function normalizeClassification(result) {
  const validEvidenceTypes = [
    'guideline', 'consensus', 'rct_results', 'observational',
    'meta_analysis', 'review', 'regulatory', 'coverage_policy',
  ];

  const validCancerTypes = [
    'colorectal', 'breast', 'lung_nsclc', 'lung_sclc', 'bladder',
    'pancreatic', 'melanoma', 'ovarian', 'gastric', 'esophageal',
    'hepatocellular', 'prostate', 'renal', 'multi_solid',
  ];

  const validSettings = [
    'screening', 'diagnosis', 'pre_surgery', 'post_surgery',
    'neoadjuvant', 'during_adjuvant', 'post_adjuvant',
    'surveillance', 'recurrence', 'metastatic',
  ];

  const validQuestions = [
    'when_to_test', 'which_test', 'positive_result_action',
    'negative_result_action', 'test_frequency', 'de_escalation',
    'escalation', 'prognosis', 'clinical_trial_eligibility',
  ];

  return {
    evidence_type: validEvidenceTypes.includes(result.evidence_type)
      ? result.evidence_type
      : 'review',
    evidence_level: result.evidence_level || null,
    relevance_score: Math.min(10, Math.max(1, result.relevance_score || 5)),
    cancer_types: (result.cancer_types || []).filter((t) => validCancerTypes.includes(t)),
    clinical_settings: (result.clinical_settings || []).filter((s) => validSettings.includes(s)),
    questions_addressed: (result.questions_addressed || []).filter((q) => validQuestions.includes(q)),
    summary: result.summary || null,
    key_findings: result.key_findings || [],
    tests_mentioned: result.tests_mentioned || [],
    is_practice_changing: !!result.is_practice_changing,
    recommends_clinical_trial: !!result.recommends_clinical_trial,
    notes: result.notes || null,
  };
}

/**
 * Batch classify articles with rate limiting
 * @param {Object[]} articles - Array of articles
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Classification results
 */
export async function batchClassify(articles, options = {}) {
  const {
    concurrency = 3,
    delayMs = 200,
  } = options;

  logger.info('Starting batch classification', { count: articles.length, concurrency });

  const results = [];
  const failed = [];

  // Process in batches for rate limiting
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (article) => {
        try {
          const result = await classifyArticle(article);
          return { article, result, error: null };
        } catch (error) {
          return { article, result: null, error: error.message };
        }
      })
    );

    for (const { article, result, error } of batchResults) {
      if (error) {
        failed.push({ pmid: article.pmid, error });
      } else {
        results.push({
          ...article,
          classification: result,
        });
      }
    }

    // Rate limiting delay between batches
    if (i + concurrency < articles.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    logger.debug('Batch classification progress', {
      processed: Math.min(i + concurrency, articles.length),
      total: articles.length,
    });
  }

  logger.info('Batch classification complete', {
    total: articles.length,
    classified: results.length,
    failed: failed.length,
  });

  return {
    results,
    failed,
    stats: {
      total: articles.length,
      classified: results.length,
      failed: failed.length,
      byEvidenceType: countBy(results, (r) => r.classification.evidence_type),
      byCancerType: countByArray(results, (r) => r.classification.cancer_types),
    },
  };
}

function countBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countByArray(array, keyFn) {
  return array.reduce((acc, item) => {
    for (const key of keyFn(item)) {
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});
}

export default {
  classifyArticle,
  batchClassify,
};
