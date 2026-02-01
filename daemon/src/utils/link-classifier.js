/**
 * AI-Powered Link Classifier
 *
 * Classifies links from payer index pages as relevant (ctDNA/liquid biopsy/MRD)
 * or not. Uses a two-pass approach:
 *
 * 1. Fast keyword matching (no AI cost)
 * 2. Claude Haiku for ambiguous links
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';

// Keywords that strongly indicate relevance
const HIGH_RELEVANCE_KEYWORDS = [
  'ctdna',
  'ctcell',
  'circulating tumor',
  'cell-free dna',
  'cfdna',
  'liquid biopsy',
  'mrd',
  'minimal residual disease',
  'molecular residual',
  // Test names
  'signatera',
  'guardant',
  'foundationone',
  'foundation one',
  'tempus',
  'galleri',
  'clonosq',
  'clonoseq',
  'grail',
  'oncotype',
  'mammaprint',
];

// Keywords that suggest possible relevance (need AI verification)
const MEDIUM_RELEVANCE_KEYWORDS = [
  'molecular',
  'genomic',
  'genetic',
  'oncology',
  'tumor marker',
  'tumor profiling',
  'comprehensive genomic',
  'cgp',
  'next-generation sequencing',
  'ngs',
  'multigene',
  'multi-gene',
  'biomarker',
  'somatic',
];

// Keywords to exclude (false positives)
const EXCLUDE_KEYWORDS = [
  'prenatal',
  'nipt',
  'carrier screening',
  'pharmacogenomic',
  'pgx',
  'cardiovascular',
  'cardiac',
];

/**
 * Classify a single link using keyword matching
 * @param {Object} link - { text, href, context }
 * @returns {'high'|'medium'|'low'|'exclude'}
 */
export function classifyLinkByKeywords(link) {
  const searchText = `${link.text} ${link.href} ${link.context || ''}`.toLowerCase();

  // Check exclusions first
  if (EXCLUDE_KEYWORDS.some((kw) => searchText.includes(kw))) {
    return 'exclude';
  }

  // High relevance - definitely our domain
  if (HIGH_RELEVANCE_KEYWORDS.some((kw) => searchText.includes(kw))) {
    return 'high';
  }

  // Medium relevance - might be relevant
  if (MEDIUM_RELEVANCE_KEYWORDS.some((kw) => searchText.includes(kw))) {
    return 'medium';
  }

  return 'low';
}

/**
 * Classify links using AI for ambiguous cases
 * @param {Array} links - Array of { text, href, context } objects
 * @param {string} payerName - Name of the payer for context
 * @returns {Promise<Array>} Array of { link, relevant: boolean, confidence: number, reason: string }
 */
export async function classifyLinksWithAI(links, payerName) {
  if (!config.anthropic?.apiKey) {
    // No API key - return all as uncertain
    return links.map((link) => ({
      link,
      relevant: false,
      confidence: 0.5,
      reason: 'AI classification unavailable - no API key',
    }));
  }

  if (links.length === 0) {
    return [];
  }

  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

  // Format links for the prompt
  const linkList = links
    .map((link, i) => `${i + 1}. "${link.text}" → ${link.href}`)
    .join('\n');

  const prompt = `You are classifying policy links from ${payerName}'s medical policy index page.

Task: Identify which links point to policies about:
- ctDNA (circulating tumor DNA) testing
- Liquid biopsy
- MRD (minimal/molecular residual disease)
- Molecular oncology / tumor profiling
- Comprehensive genomic profiling (CGP)
- Specific tests: Signatera, Guardant360, FoundationOne, Tempus, Galleri, clonoSEQ

DO NOT include:
- Prenatal/NIPT testing
- Pharmacogenomics
- Cardiovascular genetics
- General genetic testing not related to cancer

Links to classify:
${linkList}

Respond with JSON only (no markdown):
{
  "relevant": [
    { "index": 1, "confidence": 0.9, "reason": "Mentions liquid biopsy testing" }
  ],
  "not_relevant": [
    { "index": 2, "confidence": 0.8, "reason": "Prenatal genetic screening" }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0]?.text;
    if (!content) {
      return links.map((link) => ({
        link,
        relevant: false,
        confidence: 0.5,
        reason: 'Empty AI response',
      }));
    }

    // Parse JSON response
    let jsonText = content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const result = JSON.parse(jsonText);

    // Map results back to links
    const classified = links.map((link, i) => {
      const index = i + 1;
      const relevantItem = result.relevant?.find((r) => r.index === index);
      const notRelevantItem = result.not_relevant?.find((r) => r.index === index);

      if (relevantItem) {
        return {
          link,
          relevant: true,
          confidence: relevantItem.confidence || 0.8,
          reason: relevantItem.reason || 'AI classified as relevant',
        };
      } else if (notRelevantItem) {
        return {
          link,
          relevant: false,
          confidence: notRelevantItem.confidence || 0.8,
          reason: notRelevantItem.reason || 'AI classified as not relevant',
        };
      } else {
        return {
          link,
          relevant: false,
          confidence: 0.5,
          reason: 'Not classified by AI',
        };
      }
    });

    return classified;
  } catch (error) {
    console.error('AI classification failed:', error.message);
    return links.map((link) => ({
      link,
      relevant: false,
      confidence: 0.5,
      reason: `AI error: ${error.message}`,
    }));
  }
}

/**
 * Classify all links from a payer index page
 * Uses keyword matching first, then AI for ambiguous cases
 *
 * @param {Array} links - Array of { text, href, context } objects
 * @param {string} payerName - Name of the payer
 * @param {Object} options - { skipAI: boolean }
 * @returns {Promise<Object>} { high: [], medium: [], aiClassified: [] }
 */
export async function classifyLinks(links, payerName, options = {}) {
  const { skipAI = false } = options;

  const high = [];
  const medium = [];
  const needsAI = [];
  const excluded = [];

  // First pass: keyword classification
  for (const link of links) {
    const classification = classifyLinkByKeywords(link);

    switch (classification) {
      case 'high':
        high.push({ link, confidence: 1.0, reason: 'Keyword match (high relevance)' });
        break;
      case 'medium':
        needsAI.push(link);
        break;
      case 'exclude':
        excluded.push({ link, reason: 'Excluded by keyword' });
        break;
      // 'low' - ignore
    }
  }

  // Second pass: AI classification for medium-relevance links
  let aiClassified = [];
  if (!skipAI && needsAI.length > 0) {
    const aiResults = await classifyLinksWithAI(needsAI, payerName);
    aiClassified = aiResults.filter((r) => r.relevant);

    // Add non-relevant to medium for reference
    for (const result of aiResults) {
      if (result.relevant) {
        medium.push(result);
      }
    }
  } else if (needsAI.length > 0) {
    // No AI - treat medium as uncertain
    for (const link of needsAI) {
      medium.push({ link, confidence: 0.6, reason: 'Keyword match (medium relevance, AI skipped)' });
    }
  }

  return {
    high,
    medium,
    aiClassified,
    excluded,
    stats: {
      total: links.length,
      highRelevance: high.length,
      mediumRelevance: medium.length,
      excluded: excluded.length,
      aiProcessed: needsAI.length,
    },
  };
}

export default {
  classifyLinkByKeywords,
  classifyLinksWithAI,
  classifyLinks,
};
