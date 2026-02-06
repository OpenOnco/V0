/**
 * HTTP Server for MRD Chat API
 * Serves as a proxy between Vercel and the internal Railway PostgreSQL database
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { createLogger } from '../utils/logger.js';
import { query } from '../db/client.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { crawlClinicalTrials, seedPriorityTrials } from '../crawlers/clinicaltrials.js';
import { processNccnPdf } from '../crawlers/processors/nccn.js';
import { embedAllMissing } from '../embeddings/mrd-embedder.js';
import { ensureCitationCompliance } from './citation-validator.js';
import { anchorResponseQuotes } from './quote-extractor.js';
import { RESPONSE_TEMPLATE_PROMPT, enforceTemplate } from './response-template.js';
import { getExamplesByType } from './few-shot-examples.js';
import { lookupTests, formatTestContext } from './openonco-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DECISION_TREES = JSON.parse(readFileSync(join(__dirname, '../../data/decision-trees.json'), 'utf8'));

const logger = createLogger('server');

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 3000;
const SONNET_MODEL = 'claude-sonnet-4-20250514';
const HAIKU_MODEL = 'claude-3-5-haiku-20241022';
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const MAX_SOURCES = 10;
const MIN_SIMILARITY = 0.55;  // Lowered to include more relevant results
const KEYWORD_BOOST = 0.1;   // Bonus for keyword matches in hybrid search

// Rate limiting (in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

const MEDICAL_DISCLAIMER = `This summary is for informational purposes only and does not constitute medical advice. Clinical decisions should incorporate the full context of each patient's situation. Evidence levels and guideline recommendations may change. Always review primary sources and consult with qualified healthcare professionals.`;

const MRD_CHAT_SYSTEM_PROMPT = `You are a clinical decision support tool for physicians using MRD/ctDNA testing in solid tumors.

CORE PRINCIPLE: Organize responses around the clinical decisions physicians face, not academic literature review. When a physician asks a question, identify the decision at hand and present the evidence for each option.

QUERY-TYPE ROUTING: The user's question will fall into one of these categories. Use the matching response structure from the template rules below:
- clinical_guidance: Decision-oriented, present options with evidence for each
- coverage_policy: Payer-by-payer coverage status, access options
- test_comparison: Head-to-head data, practical differences
- trial_evidence: Trial details, enrollment status, key findings
- general: Simplified evidence summary

SAFETY: Present evidence for clinical options — never recommend a specific option. Use "evidence suggests", "guidelines state", "clinicians often consider". Never use "you should", "I recommend", "you need to". Every factual claim must cite [N]. Acknowledge evidence gaps honestly. Focus on solid tumors only. 3-5 paragraphs max.

Few-shot examples may be provided to illustrate expected output quality.

${RESPONSE_TEMPLATE_PROMPT}

Format citations as [1], [2], etc. The system will append the full citation list.`;

// ============================================
// API CLIENTS
// ============================================

let openai = null;
let anthropic = null;

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

function getAnthropic() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// ============================================
// QUERY INTENT EXTRACTION (Phase 5)
// ============================================

const INTENT_EXTRACTION_PROMPT = `Analyze this clinical question about MRD/ctDNA testing and extract structured intent.

Return JSON with:
- query_type: "clinical_guidance" | "coverage_policy" | "trial_evidence" | "test_comparison" | "general"
- cancer_types: Array of cancer types mentioned (colorectal, breast, lung, etc.)
- clinical_settings: Array like "surveillance", "treatment_decision", "adjuvant_therapy"
- test_names: Specific test names mentioned (Signatera, Guardant, etc.)
- payers: Specific payers mentioned (Medicare, Aetna, etc.)
- time_context: "current" | "recent" | "any"
- evidence_focus: "guidelines" | "trials" | "payer_coverage" | "all"
- keywords: Array of key medical terms for text search

IMPORTANT for evidence_focus:
- Use "guidelines" when query mentions NCCN, ASCO, ESMO, SITC, guideline, recommendation, or asks "what does X say"
- Use "trials" when query asks about studies, RCTs, clinical trials, research, evidence, data
- Use "payer_coverage" when query asks about Medicare, insurance, coverage, reimbursement
- Use "all" when the query is general or doesn't specify a focus

Be concise. If uncertain, use empty arrays or "general".`;

// Keywords that suggest guidelines focus (for fallback detection)
const GUIDELINE_KEYWORDS = ['nccn', 'asco', 'esmo', 'sitc', 'guideline', 'guidelines', 'recommendation', 'recommends'];

async function extractQueryIntent(queryText) {
  try {
    const claude = getAnthropic();
    const response = await claude.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `${INTENT_EXTRACTION_PROMPT}\n\nQuery: "${queryText}"`,
        },
      ],
    });

    const text = response.content[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const intent = JSON.parse(jsonMatch[0]);
      
      // Fallback: If LLM missed explicit guideline keywords, override evidence_focus
      const lowerQuery = queryText.toLowerCase();
      if (intent.evidence_focus !== 'guidelines' && 
          GUIDELINE_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
        logger.info('Overriding evidence_focus to guidelines based on keyword detection', {
          originalFocus: intent.evidence_focus,
          query: queryText.substring(0, 100),
        });
        intent.evidence_focus = 'guidelines';
      }
      
      logger.info('Extracted query intent', {
        type: intent.query_type,
        cancers: intent.cancer_types?.length || 0,
        keywords: intent.keywords?.length || 0,
        evidenceFocus: intent.evidence_focus,
      });
      return intent;
    }
  } catch (error) {
    logger.warn('Intent extraction failed, using defaults', { error: error.message });
  }

  // Default intent - also check for guideline keywords here
  const lowerQuery = queryText.toLowerCase();
  const isGuidelinesQuery = GUIDELINE_KEYWORDS.some(kw => lowerQuery.includes(kw));
  return {
    query_type: isGuidelinesQuery ? 'clinical_guidance' : 'general',
    cancer_types: [],
    clinical_settings: [],
    test_names: [],
    payers: [],
    time_context: 'any',
    evidence_focus: isGuidelinesQuery ? 'guidelines' : 'all',
    keywords: queryText.toLowerCase().split(/\s+/).filter(w => w.length > 3),
  };
}

// Map query intent to source type filters
function intentToSourceTypes(intent) {
  const sourceTypes = [];

  switch (intent.evidence_focus) {
    case 'guidelines':
      sourceTypes.push('nccn', 'asco', 'esmo', 'sitc', 'cap-amp');
      break;
    case 'trials':
      sourceTypes.push('clinicaltrials', 'pubmed');
      break;
    case 'payer_coverage':
      sourceTypes.push('payer-carelon', 'payer-moldx', 'payer-aetna', 'payer-cigna', 'payer-uhc');
      break;
    default:
      // All sources
      break;
  }

  // Add payer-specific if mentioned
  if (intent.payers?.length > 0) {
    for (const payer of intent.payers) {
      const lowerPayer = payer.toLowerCase();
      if (lowerPayer.includes('medicare') || lowerPayer.includes('moldx')) {
        sourceTypes.push('payer-moldx');
      } else if (lowerPayer.includes('carelon') || lowerPayer.includes('evicore')) {
        sourceTypes.push('payer-carelon');
      } else if (lowerPayer.includes('aetna')) {
        sourceTypes.push('payer-aetna');
      }
    }
  }

  return [...new Set(sourceTypes)];
}

// ============================================
// DECISION TREE MATCHING
// ============================================

const MRD_POSITIVE_PATTERNS = /\b(mrd[- ]?positive|ctdna[- ]?positive|ctdna[- ]?detected|mrd[- ]?detected|signatera[- ]?positive|mrd\+|ctdna\+|positive[- ]?mrd|positive[- ]?ctdna|detectable[- ]?ctdna|ctdna[- ]?still[- ]?positive|rising[- ]?ctdna|persistent[- ]?ctdna)\b/i;
const MRD_NEGATIVE_PATTERNS = /\b(mrd[- ]?negative|ctdna[- ]?negative|ctdna[- ]?undetect|ctdna[- ]?not[- ]?detected|ctdna[- ]?cleared|mrd[- ]?cleared|signatera[- ]?negative|mrd-|ctdna-|negative[- ]?mrd|negative[- ]?ctdna|undetectable[- ]?ctdna|ctdna[- ]?clearance)\b/i;

const CANCER_TYPE_ALIASES = {
  colorectal: ['colorectal', 'crc', 'colon', 'rectal', 'colon cancer', 'colorectal cancer'],
  breast: ['breast', 'tnbc', 'triple negative', 'triple-negative', 'hr+', 'hr positive', 'her2', 'breast cancer'],
  non_small_cell_lung: ['nsclc', 'non-small cell', 'non small cell', 'lung', 'lung cancer', 'non-small-cell lung'],
};

function findMatchingScenario(intent, queryText) {
  const lowerQuery = queryText.toLowerCase();

  // Detect MRD result polarity
  const isPositive = MRD_POSITIVE_PATTERNS.test(lowerQuery);
  const isNegative = MRD_NEGATIVE_PATTERNS.test(lowerQuery);
  const mrdResult = isPositive ? 'positive' : isNegative ? 'negative' : null;

  if (!mrdResult) return null;

  // Detect cancer type from intent or query text
  let matchedCancerType = null;
  const intentCancerTypes = (intent.cancer_types || []).map(c => c.toLowerCase());

  for (const [canonicalType, aliases] of Object.entries(CANCER_TYPE_ALIASES)) {
    if (intentCancerTypes.some(ct => aliases.some(a => ct.includes(a)))) {
      matchedCancerType = canonicalType;
      break;
    }
    if (aliases.some(a => lowerQuery.includes(a))) {
      matchedCancerType = canonicalType;
      break;
    }
  }

  if (!matchedCancerType) return null;

  // Find matching scenario
  const scenario = DECISION_TREES.scenarios.find(s =>
    s.cancer_type === matchedCancerType && s.mrd_result === mrdResult
  );

  if (scenario) {
    logger.info('Decision tree matched', {
      scenario: scenario.scenario_id,
      cancerType: matchedCancerType,
      mrdResult,
    });
  }

  return scenario || null;
}

// ============================================
// KEYWORD SEARCH (Phase 5)
// ============================================

async function keywordSearch(keywords, filters = {}, limit = 20) {
  if (!keywords || keywords.length === 0) return [];

  // Build tsquery from keywords
  const tsQuery = keywords
    .map(k => k.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(k => k.length > 2)
    .join(' | ');

  if (!tsQuery) return [];

  let sql = `
    SELECT
      g.id,
      g.title,
      g.summary,
      g.source_type,
      g.source_id,
      g.source_url,
      g.evidence_type,
      g.evidence_level,
      g.publication_date,
      g.decision_context,
      g.direct_quotes,
      ts_rank(
        to_tsvector('english', COALESCE(g.title, '') || ' ' || COALESCE(g.summary, '')),
        to_tsquery('english', $1)
      ) as text_rank
    FROM mrd_guidance_items g
    WHERE g.is_superseded = FALSE
      AND to_tsvector('english', COALESCE(g.title, '') || ' ' || COALESCE(g.summary, ''))
          @@ to_tsquery('english', $1)
  `;

  const params = [tsQuery];
  let paramIndex = 2;

  if (filters.sourceTypes?.length > 0) {
    sql += ` AND g.source_type = ANY($${paramIndex})`;
    params.push(filters.sourceTypes);
    paramIndex++;
  }

  if (filters.cancerType) {
    sql += ` AND EXISTS (SELECT 1 FROM mrd_guidance_cancer_types ct WHERE ct.guidance_id = g.id AND ct.cancer_type = $${paramIndex})`;
    params.push(filters.cancerType);
    paramIndex++;
  }

  sql += ` ORDER BY text_rank DESC LIMIT $${paramIndex}`;
  params.push(limit);

  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.warn('Keyword search failed', { error: error.message });
    return [];
  }
}

// ============================================
// HYBRID SEARCH (Phase 5)
// ============================================

async function hybridSearch(queryText, queryEmbedding, intent, filters = {}) {
  // Get source type filters from intent
  const sourceTypes = intentToSourceTypes(intent);
  const enhancedFilters = {
    ...filters,
    sourceTypes: sourceTypes.length > 0 ? sourceTypes : undefined,
    cancerType: intent.cancer_types?.[0] || filters.cancerType,
  };

  logger.info('Hybrid search filters', {
    evidenceFocus: intent.evidence_focus,
    sourceTypes: sourceTypes.length > 0 ? sourceTypes : 'all',
    cancerType: enhancedFilters.cancerType || 'all',
  });

  // Run both searches in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    searchSimilarItems(queryEmbedding, enhancedFilters),
    keywordSearch(intent.keywords, enhancedFilters),
  ]);

  // Merge results with boosting for items that appear in both
  const resultMap = new Map();

  // Add vector results
  for (const item of vectorResults) {
    resultMap.set(item.id, {
      ...item,
      vectorScore: parseFloat(item.similarity) || 0,
      keywordScore: 0,
    });
  }

  // Merge keyword results
  for (const item of keywordResults) {
    if (resultMap.has(item.id)) {
      // Boost items found in both searches
      const existing = resultMap.get(item.id);
      existing.keywordScore = item.text_rank || 0;
      existing.hybridScore = existing.vectorScore + KEYWORD_BOOST;
      // Inherit decision_context and direct_quotes if available
      if (item.decision_context) existing.decision_context = item.decision_context;
      if (item.direct_quotes) existing.direct_quotes = item.direct_quotes;
    } else {
      resultMap.set(item.id, {
        ...item,
        vectorScore: 0,
        keywordScore: item.text_rank || 0,
        hybridScore: (item.text_rank || 0) * 0.5, // Lower weight for keyword-only
      });
    }
  }

  // Sort by hybrid score
  const results = Array.from(resultMap.values())
    .map(r => ({
      ...r,
      similarity: r.hybridScore || r.vectorScore || r.keywordScore * 0.5,
    }))
    .sort((a, b) => (b.hybridScore || b.vectorScore) - (a.hybridScore || a.vectorScore))
    .slice(0, MAX_SOURCES);

  // Count results by source type for debugging
  const sourceTypeCounts = results.reduce((acc, r) => {
    acc[r.source_type] = (acc[r.source_type] || 0) + 1;
    return acc;
  }, {});

  logger.info('Hybrid search complete', {
    vectorResults: vectorResults.length,
    keywordResults: keywordResults.length,
    merged: results.length,
    sourceTypes: sourceTypeCounts,
  });

  return results;
}

// ============================================
// EMBEDDING & SEARCH
// ============================================

// Cache pgvector availability status
let hasPgVector = null;

async function checkPgVectorAvailable() {
  if (hasPgVector === null) {
    try {
      const result = await query(
        "SELECT value FROM mrd_system_config WHERE key = 'pgvector_available'"
      );
      hasPgVector = result.rows.length > 0 && result.rows[0].value === true;
    } catch (e) {
      hasPgVector = false;
    }
    logger.info('pgvector availability', { available: hasPgVector });
  }
  return hasPgVector;
}

async function embedQuery(queryText) {
  const client = getOpenAI();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: queryText.trim(),
  });
  return response.data[0].embedding;
}

// Compute cosine similarity between two vectors
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchSimilarItems(queryEmbedding, filters = {}) {
  const pgVectorAvailable = await checkPgVectorAvailable();

  if (pgVectorAvailable) {
    return searchWithPgVector(queryEmbedding, filters);
  } else {
    return searchWithJSONB(queryEmbedding, filters);
  }
}

// Search using pgvector extension (efficient)
async function searchWithPgVector(queryEmbedding, filters = {}) {
  // Note: Previously had NCCN_BOOST=1.15 but removed to avoid artificial guideline bias
  // Let semantic similarity determine relevance, not source type
  // Source type filtering is now done via sourceTypes filter for intent-based queries

  let sql = `
    SELECT DISTINCT ON (g.id)
      g.id,
      g.title,
      g.summary,
      g.source_type,
      g.source_id,
      g.source_url,
      g.evidence_type,
      g.evidence_level,
      g.publication_date,
      g.journal,
      g.authors,
      e.chunk_text,
      1 - (e.embedding <=> $1::vector) as similarity
    FROM mrd_item_embeddings e
    JOIN mrd_guidance_items g ON e.guidance_id = g.id
    WHERE g.is_superseded = FALSE
      AND 1 - (e.embedding <=> $1::vector) >= $2
  `;

  const params = [JSON.stringify(queryEmbedding), MIN_SIMILARITY];
  let paramIndex = 3;

  // Filter by source types when intent specifies (e.g., guidelines-focused queries)
  if (filters.sourceTypes?.length > 0) {
    sql += ` AND g.source_type = ANY($${paramIndex})`;
    params.push(filters.sourceTypes);
    paramIndex++;
  }

  if (filters.cancerType) {
    sql += ` AND EXISTS (SELECT 1 FROM mrd_guidance_cancer_types ct WHERE ct.guidance_id = g.id AND ct.cancer_type = $${paramIndex})`;
    params.push(filters.cancerType);
    paramIndex++;
  }

  if (filters.clinicalSetting) {
    sql += ` AND EXISTS (SELECT 1 FROM mrd_guidance_clinical_settings cs WHERE cs.guidance_id = g.id AND cs.clinical_setting = $${paramIndex})`;
    params.push(filters.clinicalSetting);
    paramIndex++;
  }

  if (filters.evidenceType) {
    sql += ` AND g.evidence_type = $${paramIndex}`;
    params.push(filters.evidenceType);
    paramIndex++;
  }

  sql += ` ORDER BY g.id, similarity DESC LIMIT $${paramIndex}`;
  params.push(MAX_SOURCES);

  const result = await query(sql, params);
  return result.rows;
}

// Fallback search using JSONB embeddings (less efficient, computes similarity in JS)
async function searchWithJSONB(queryEmbedding, filters = {}) {
  // Note: Previously had NCCN_BOOST=1.15 but removed to avoid artificial guideline bias
  // Source type filtering is now done via sourceTypes filter for intent-based queries

  // Fetch all items with embeddings (limited to avoid memory issues)
  let sql = `
    SELECT
      g.id,
      g.title,
      g.summary,
      g.source_type,
      g.source_id,
      g.source_url,
      g.evidence_type,
      g.evidence_level,
      g.publication_date,
      g.journal,
      g.authors,
      e.chunk_text,
      e.embedding
    FROM mrd_item_embeddings e
    JOIN mrd_guidance_items g ON e.guidance_id = g.id
    WHERE g.is_superseded = FALSE
  `;

  const params = [];
  let paramIndex = 1;

  // Filter by source types when intent specifies (e.g., guidelines-focused queries)
  if (filters.sourceTypes?.length > 0) {
    sql += ` AND g.source_type = ANY($${paramIndex})`;
    params.push(filters.sourceTypes);
    paramIndex++;
  }

  if (filters.cancerType) {
    sql += ` AND EXISTS (SELECT 1 FROM mrd_guidance_cancer_types ct WHERE ct.guidance_id = g.id AND ct.cancer_type = $${paramIndex})`;
    params.push(filters.cancerType);
    paramIndex++;
  }

  if (filters.clinicalSetting) {
    sql += ` AND EXISTS (SELECT 1 FROM mrd_guidance_clinical_settings cs WHERE cs.guidance_id = g.id AND cs.clinical_setting = $${paramIndex})`;
    params.push(filters.clinicalSetting);
    paramIndex++;
  }

  if (filters.evidenceType) {
    sql += ` AND g.evidence_type = $${paramIndex}`;
    params.push(filters.evidenceType);
    paramIndex++;
  }

  sql += ` LIMIT 500`; // Limit for memory safety

  const result = await query(sql, params);

  // Compute similarities in JS
  const scored = result.rows
    .map(row => {
      const embedding = Array.isArray(row.embedding) ? row.embedding : [];
      if (embedding.length === 0) return null;

      const similarity = cosineSimilarity(queryEmbedding, embedding);

      return { ...row, similarity };
    })
    .filter(row => row !== null && row.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_SOURCES);

  // Dedupe by id
  const seen = new Set();
  return scored.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

// ============================================
// CITATION FORMATTING
// ============================================

function formatCitation(source, index) {
  const parts = [];

  if (source.authors && Array.isArray(source.authors) && source.authors.length > 0) {
    if (source.authors.length <= 3) {
      parts.push(source.authors.map(a => a.name || a).join(', '));
    } else {
      const firstAuthor = source.authors[0];
      parts.push(`${firstAuthor.name || firstAuthor} et al.`);
    }
  }

  parts.push(source.title);

  if (source.journal) {
    let journalPart = source.journal;
    if (source.publication_date) {
      // Handle both string and Date objects
      const dateStr = typeof source.publication_date === 'string'
        ? source.publication_date
        : source.publication_date.toISOString?.() || '';
      if (dateStr && dateStr.length >= 4) {
        journalPart += ` (${dateStr.substring(0, 4)})`;
      }
    }
    parts.push(journalPart);
  }

  if (source.source_type === 'pubmed' && source.source_id) {
    parts.push(`PMID: ${source.source_id}`);
  } else if (source.source_type === 'clinicaltrials' && source.source_id) {
    parts.push(source.source_id);
  }

  return `[${index}] ${parts.join('. ')}`;
}

function buildSourcesContext(sources) {
  return sources.map((s, i) => {
    let context = `Source [${i + 1}]:
Title: ${s.title}
Type: ${s.evidence_type}${s.evidence_level ? ` (${s.evidence_level})` : ''}
Summary: ${s.summary || s.chunk_text}`;

    // Include direct quotes if available (Phase 5)
    if (s.direct_quotes && Array.isArray(s.direct_quotes) && s.direct_quotes.length > 0) {
      const quotes = typeof s.direct_quotes === 'string'
        ? JSON.parse(s.direct_quotes)
        : s.direct_quotes;
      if (quotes.length > 0) {
        context += `\nDirect Quote: "${quotes[0].text}"`;
      }
    }

    // Include decision context if available (Phase 5)
    if (s.decision_context) {
      const dc = typeof s.decision_context === 'string'
        ? JSON.parse(s.decision_context)
        : s.decision_context;
      if (dc.decision_point) {
        context += `\nDecision Point: ${dc.decision_point}`;
      }
      if (dc.limitations_noted?.length > 0) {
        context += `\nLimitations: ${dc.limitations_noted.join('; ')}`;
      }
    }

    return context + '\n---';
  }).join('\n\n');
}

// ============================================
// RELATED ITEMS
// ============================================

async function getRelatedItems(citedIds, limit = 3) {
  if (!citedIds || citedIds.length === 0) return [];

  const result = await query(`
    SELECT DISTINCT ON (g2.id)
      g2.id,
      g2.title,
      g2.source_url,
      g2.source_type,
      g2.evidence_type
    FROM mrd_item_embeddings e1
    JOIN mrd_item_embeddings e2 ON e1.guidance_id != e2.guidance_id
    JOIN mrd_guidance_items g2 ON e2.guidance_id = g2.id
    WHERE e1.guidance_id = ANY($1)
      AND e2.guidance_id != ALL($1)
      AND g2.is_superseded = FALSE
      AND 1 - (e1.embedding <=> e2.embedding) >= 0.75
    ORDER BY g2.id, 1 - (e1.embedding <=> e2.embedding) DESC
    LIMIT $2
  `, [citedIds, limit]);

  return result.rows;
}

// ============================================
// RATE LIMITING
// ============================================

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  return (forwarded ? forwarded.split(',')[0].trim() : null) || realIP || 'unknown';
}

function checkRateLimit(clientIP) {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIP);

  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(clientIP, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((clientData.windowStart + RATE_LIMIT_WINDOW - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  clientData.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - clientData.count };
}

// ============================================
// REQUEST HANDLERS
// ============================================

async function handleMRDChat(req, res) {
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP);

  if (!rateLimit.allowed) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': rateLimit.retryAfter,
    });
    return res.end(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter,
    }));
  }

  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { query: queryText, filters = {} } = JSON.parse(body);

    if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Missing or invalid query',
      }));
    }

    if (queryText.length > 1000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Query too long (max 1000 characters)',
      }));
    }

    // Step 1: Extract query intent (Phase 5)
    const intent = await extractQueryIntent(queryText);

    // Step 1b: Match decision tree scenario
    const matchedScenario = findMatchingScenario(intent, queryText);

    // Step 2: Embed the query
    const queryEmbedding = await embedQuery(queryText);

    // Step 3: Hybrid search (Phase 5)
    const sources = await hybridSearch(queryText, queryEmbedding, intent, filters);

    if (sources.length === 0 && !matchedScenario) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        answer: 'I could not find specific guidance on this topic in the database. This may be an emerging area where evidence is still being developed, or the topic may not be directly related to MRD testing in solid tumors.',
        sources: [],
        relatedItems: [],
        disclaimer: MEDICAL_DISCLAIMER,
      }));
    }

    // Step 3: Build context
    const sourcesContext = buildSourcesContext(sources);

    // Step 4: Generate response with Claude
    const claude = getAnthropic();

    // Build scenario context if decision tree matched
    let scenarioContext = '';
    if (matchedScenario) {
      const decisionsText = matchedScenario.decisions
        .map(d => `- ${d.question} (evidence: ${d.evidence_strength})`)
        .join('\n');
      scenarioContext = `\n\nMATCHED CLINICAL SCENARIO: ${matchedScenario.display_name}
RELEVANT DECISIONS:
${decisionsText}
TEST CONSIDERATIONS: ${JSON.stringify(matchedScenario.test_considerations)}
EVIDENCE GAPS: ${matchedScenario.evidence_gaps.join('; ')}

Use this scenario to structure your response around these specific decisions.`;
    }

    // Enrich with OpenOnco test-specific data
    let testDataContext = '';
    let testsMatched = [];
    let mentionedTests = intent.test_names || [];

    // Fallback: for test_comparison queries where intent missed test names,
    // scan the query for known MRD test names
    if (mentionedTests.length === 0 && intent.query_type === 'test_comparison') {
      const KNOWN_TESTS = ['Signatera', 'Guardant Reveal', 'FoundationOne Tracker', 'RaDaR', 'NavDx', 'clonoSEQ', 'Haystack', 'MRD-EDGE', 'PhasED-Seq', 'TumorNext-MRD', 'Resolution ctDx'];
      const lowerQuery = queryText.toLowerCase();
      mentionedTests = KNOWN_TESTS.filter(t => lowerQuery.includes(t.toLowerCase()));
    }

    if (mentionedTests.length > 0) {
      try {
        const matched = await lookupTests(mentionedTests);
        if (matched.length > 0) {
          testsMatched = matched.map(t => t.name);
          testDataContext = '\n\nTEST-SPECIFIC DATA (from OpenOnco database — use these exact figures):\n' + formatTestContext(matched);
        }
      } catch (err) {
        logger.warn('OpenOnco test lookup failed', { error: err.message });
      }
    }

    // Get relevant few-shot examples (1 pair max to manage token budget)
    const examples = getExamplesByType(intent.query_type).slice(0, 2);

    const hasSources = sources.length > 0;
    const userContent = hasSources
      ? `Based on the following sources, answer this clinical question about MRD (Molecular Residual Disease):

QUESTION: ${queryText}

AVAILABLE SOURCES:
${sourcesContext}${scenarioContext}${testDataContext}

Remember:
- Cite sources using [1], [2], etc.
- Structure your response around the clinical decisions the physician faces
- Present evidence FOR EACH clinical option, not as a literature review
- If TEST-SPECIFIC DATA is provided, incorporate the exact figures (LOD, sensitivity, TAT, coverage) into your response
- Acknowledge what evidence doesn't address
- 3-5 paragraphs max`
      : `Answer this clinical question about MRD (Molecular Residual Disease) using the matched decision tree scenario:

QUESTION: ${queryText}
${scenarioContext}${testDataContext}

NOTE: No indexed database sources matched this query. Use the decision tree scenario above and your clinical knowledge to provide a structured response. Clearly state that the response is based on the decision framework rather than indexed literature. Do not fabricate citations.

Remember:
- Structure your response around the clinical decisions the physician faces
- Present evidence FOR EACH clinical option, not as a literature review
- If TEST-SPECIFIC DATA is provided, incorporate the exact figures (LOD, sensitivity, TAT, coverage) into your response
- Acknowledge what evidence doesn't address
- 3-5 paragraphs max`;

    const response = await claude.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      system: MRD_CHAT_SYSTEM_PROMPT,
      messages: [
        ...examples,
        { role: 'user', content: userContent },
      ],
    });

    let answer = response.content[0]?.text || 'Unable to generate response.';

    // Step 5: Validate citations (P0 safety)
    let citationStats = { wasRewritten: false, violations: 0 };
    try {
      const validationResult = await ensureCitationCompliance(answer, sources);
      answer = validationResult.response;
      citationStats = {
        wasRewritten: validationResult.wasRewritten,
        violations: validationResult.originalViolations || 0,
        ...validationResult.stats,
      };
      if (validationResult.wasRewritten) {
        logger.info('Response rewritten for citation compliance', {
          violations: validationResult.originalViolations,
        });
      }
    } catch (validationError) {
      logger.warn('Citation validation failed', { error: validationError.message });
    }

    // Step 7: Format sources with quotes (Phase 5)
    const formattedSources = sources.map((s, i) => {
      const source = {
        index: i + 1,
        id: s.id,
        title: s.title,
        citation: formatCitation(s, i + 1),
        url: s.source_url,
        sourceType: s.source_type,
        evidenceType: s.evidence_type,
        evidenceLevel: s.evidence_level,
        similarity: parseFloat(s.similarity || 0).toFixed(3),
      };

      // Include the text excerpt (summary or chunk_text)
      source.excerpt = s.summary || s.chunk_text || null;

      // Include direct quote if available
      if (s.direct_quotes) {
        const quotes = typeof s.direct_quotes === 'string'
          ? JSON.parse(s.direct_quotes)
          : s.direct_quotes;
        if (quotes && quotes.length > 0) {
          source.directQuote = quotes[0].text;
        }
      }

      return source;
    });

    // Step 8: Anchor quotes for verification (P0 safety)
    try {
      const anchors = await anchorResponseQuotes(formattedSources);
      // Attach anchor info to sources that have quotes
      for (const anchor of anchors) {
        const source = formattedSources.find(s => s.index === anchor.sourceIndex);
        if (source) {
          source.quoteAnchor = {
            anchorId: anchor.anchorId,
            chunkIndex: anchor.chunkIndex,
            charStart: anchor.charStart,
            charEnd: anchor.charEnd,
            confidence: anchor.confidence,
          };
        }
      }
    } catch (anchorError) {
      logger.warn('Quote anchoring failed', { error: anchorError.message });
    }

    // Step 9: Log chat for quality tracking
    try {
      await query(`
        INSERT INTO mrd_chat_logs (
          query_text, query_intent, response_text, sources,
          citation_count, was_rewritten, citation_violations,
          client_ip_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        queryText.substring(0, 500),
        JSON.stringify(intent),
        answer.substring(0, 5000),
        JSON.stringify(formattedSources.map(s => ({ id: s.id, type: s.sourceType }))),
        formattedSources.length,
        citationStats.wasRewritten,
        citationStats.violations,
        clientIP ? crypto.createHash('sha256').update(clientIP).digest('hex').substring(0, 16) : null,
      ]);
    } catch (logError) {
      // Don't fail the request if logging fails
      logger.warn('Chat logging failed', { error: logError.message });
    }

    // Step 10: Get related items
    const citedIds = sources.map(s => s.id);
    const relatedItems = await getRelatedItems(citedIds, 3);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      answer,
      sources: formattedSources,
      relatedItems: relatedItems.map(r => ({
        id: r.id,
        title: r.title,
        url: r.source_url,
        evidenceType: r.evidence_type,
      })),
      disclaimer: MEDICAL_DISCLAIMER,
      meta: {
        model: SONNET_MODEL,
        sourcesRetrieved: sources.length,
        queryLength: queryText.length,
        intent: {
          type: intent.query_type,
          cancerTypes: intent.cancer_types,
          evidenceFocus: intent.evidence_focus,
        },
        matchedScenario: matchedScenario ? {
          id: matchedScenario.scenario_id,
          displayName: matchedScenario.display_name,
          mrdResult: matchedScenario.mrd_result,
          decisionsCount: matchedScenario.decisions.length,
        } : null,
        testDataEnriched: testsMatched.length > 0,
        testsMatched,
      },
    }));

  } catch (error) {
    logger.error('MRD Chat error', { error: error.message });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Internal server error',
    }));
  }
}

async function handleHealth(req, res) {
  try {
    // Get database stats
    const [
      counts,
      crawlerStatus,
      embedBacklog,
      staleSources,
      recentQuality,
      sourcesByType,
    ] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*) FROM mrd_guidance_items) as guidance_items,
          (SELECT COUNT(*) FROM mrd_clinical_trials) as clinical_trials,
          (SELECT COUNT(*) FROM mrd_item_embeddings) as embeddings,
          (SELECT COUNT(*) FROM mrd_quote_anchors) as quote_anchors
      `),
      query(`
        SELECT
          crawler_name,
          status,
          completed_at,
          items_new,
          error_message,
          heartbeat_at
        FROM mrd_crawler_runs
        WHERE id IN (
          SELECT MAX(id) FROM mrd_crawler_runs GROUP BY crawler_name
        )
      `),
      query(`
        SELECT COUNT(*) as count
        FROM mrd_guidance_items g
        LEFT JOIN mrd_item_embeddings e ON g.id = e.guidance_id
        WHERE e.id IS NULL
      `),
      // Check for stale sources if table exists
      query(`
        SELECT source_key, days_since_release, freshness_status
        FROM v_stale_sources
        WHERE freshness_status != 'ok'
        LIMIT 10
      `).catch(() => ({ rows: [] })),
      // Quality: % of recent answers with 3+ citations
      query(`
        SELECT
          COUNT(*) FILTER (WHERE citation_count >= 3) as good,
          COUNT(*) as total
        FROM mrd_chat_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `).catch(() => ({ rows: [{ good: 0, total: 0 }] })),
      query(`
        SELECT source_type, COUNT(*) as count
        FROM mrd_guidance_items
        GROUP BY source_type
        ORDER BY count DESC
      `),
    ]);

    // Process crawler statuses
    const crawlers = {};
    for (const row of crawlerStatus.rows) {
      const ageHours = row.completed_at
        ? Math.round((Date.now() - new Date(row.completed_at).getTime()) / 3600000)
        : null;

      crawlers[row.crawler_name] = {
        status: row.status,
        lastRun: row.completed_at,
        ageHours,
        itemsNew: row.items_new,
        isStale: ageHours > 48,
        error: row.error_message,
      };
    }

    // Calculate quality metrics
    const qualityPercent = recentQuality.rows[0]?.total > 0
      ? Math.round((recentQuality.rows[0].good / recentQuality.rows[0].total) * 100)
      : null;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'mrd-chat-api',
      database: {
        guidanceItems: parseInt(counts.rows[0].guidance_items),
        clinicalTrials: parseInt(counts.rows[0].clinical_trials),
        embeddings: parseInt(counts.rows[0].embeddings),
        quoteAnchors: parseInt(counts.rows[0].quote_anchors),
        bySourceType: sourcesByType.rows.reduce((acc, row) => {
          acc[row.source_type] = parseInt(row.count);
          return acc;
        }, {}),
      },
      crawlers,
      backlog: {
        embeddingsMissing: parseInt(embedBacklog.rows[0]?.count || 0),
      },
      staleSources: staleSources.rows.map(s => ({
        key: s.source_key,
        daysSinceRelease: parseInt(s.days_since_release),
        status: s.freshness_status,
      })),
      quality: {
        recentAnswersWithCitations: qualityPercent,
        chatLogsLast24h: parseInt(recentQuality.rows[0]?.total || 0),
      },
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'mrd-chat-api',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    }));
  }
}

async function handleImportNccn(req, res) {
  const authHeader = req.headers['x-crawl-secret'];
  const expectedSecret = process.env.CRAWL_SECRET || 'mrd-crawl-2024';

  if (authHeader !== expectedSecret) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { recommendations } = JSON.parse(body);

    if (!recommendations || !Array.isArray(recommendations)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid recommendations array' }));
    }

    logger.info('Importing NCCN recommendations', { count: recommendations.length });

    let saved = 0, skipped = 0;

    for (const rec of recommendations) {
      try {
        // Check for duplicates
        const existing = await query(
          `SELECT id FROM mrd_guidance_items
           WHERE source_type = 'nccn' AND summary = $1`,
          [rec.recommendation]
        );

        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        const title = `NCCN ${rec.cancer_type.charAt(0).toUpperCase() + rec.cancer_type.slice(1)} Cancer: ${rec.clinical_setting || 'ctDNA Recommendation'}`;

        const insertResult = await query(
          `INSERT INTO mrd_guidance_items (
            source_type, source_id, source_url,
            title, summary, evidence_type, evidence_level,
            key_findings, publication_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id`,
          [
            'nccn',
            `nccn-${rec.cancer_type}-${Date.now()}-${saved}`,
            'https://www.nccn.org/guidelines/category_1',
            title,
            rec.recommendation,
            'guideline',
            rec.evidence_category ? `NCCN Category ${rec.evidence_category}` : null,
            JSON.stringify([{
              finding: rec.recommendation,
              quote: rec.key_quote,
              setting: rec.clinical_setting,
            }]),
            new Date(),
          ]
        );

        const guidanceId = insertResult.rows[0].id;

        // Add cancer type to junction table
        if (rec.cancer_type) {
          await query(
            `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [guidanceId, rec.cancer_type]
          );
        }

        // Add clinical setting to junction table
        if (rec.clinical_setting) {
          await query(
            `INSERT INTO mrd_guidance_clinical_settings (guidance_id, clinical_setting)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [guidanceId, rec.clinical_setting]
          );
        }

        saved++;
      } catch (err) {
        logger.warn('Failed to save NCCN rec', { error: err.message });
      }
    }

    logger.info('NCCN import complete', { saved, skipped });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, saved, skipped }));

  } catch (error) {
    logger.error('NCCN import error', { error: error.message });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleTriggerCrawl(req, res) {
  // Simple auth check - require a secret header
  const authHeader = req.headers['x-crawl-secret'];
  const expectedSecret = process.env.CRAWL_SECRET || 'mrd-crawl-2024';

  if (authHeader !== expectedSecret) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { action = 'trials', maxResults = 100 } = body ? JSON.parse(body) : {};

    logger.info('Triggering crawl', { action, maxResults });

    let result;
    if (action === 'seed') {
      result = await seedPriorityTrials();
    } else if (action === 'trials') {
      result = await crawlClinicalTrials({ maxResults });
    } else if (action === 'embed') {
      result = await embedAllMissing({ limit: maxResults });
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid action' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, result }));

  } catch (error) {
    logger.error('Crawl trigger error', { error: error.message });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: error.message }));
  }
}

// ============================================
// SERVER
// ============================================

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health' || url.pathname === '/') {
    return handleHealth(req, res);
  }

  if (url.pathname === '/api/mrd-chat' && req.method === 'POST') {
    return handleMRDChat(req, res);
  }

  if (url.pathname === '/api/trigger-crawl' && req.method === 'POST') {
    return handleTriggerCrawl(req, res);
  }

  if (url.pathname === '/api/import-nccn' && req.method === 'POST') {
    return handleImportNccn(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

export function startServer() {
  server.listen(PORT, () => {
    logger.info(`MRD Chat API server listening on port ${PORT}`);
  });
  return server;
}

export function stopServer() {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}
