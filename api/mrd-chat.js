/**
 * MRD Guidance Chat API Endpoint
 * RAG-based natural language search with citations
 *
 * POST /api/mrd-chat
 *
 * Request body:
 * {
 *   "query": "What does evidence say about positive MRD in stage III colorectal?",
 *   "filters": {
 *     "cancerType": "colorectal",
 *     "clinicalSetting": "post_surgery"
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "answer": "...",
 *   "sources": [...],
 *   "relatedItems": [...],
 *   "disclaimer": "..."
 * }
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import pg from 'pg';

const { Pool } = pg;

// ============================================
// CONFIGURATION
// ============================================

const SONNET_MODEL = 'claude-sonnet-4-20250514';
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const MAX_SOURCES = 10;
const MIN_SIMILARITY = 0.7;

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================
// DATABASE CONNECTION
// ============================================

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.MRD_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('MRD_DATABASE_URL or DATABASE_URL is required');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

// ============================================
// REGULATORY COMPLIANCE
// ============================================

const MEDICAL_DISCLAIMER = `This summary is for informational purposes only and does not constitute medical advice. Clinical decisions should incorporate the full context of each patient's situation. Evidence levels and guideline recommendations may change. Always review primary sources and consult with qualified healthcare professionals.`;

const MRD_CHAT_SYSTEM_PROMPT = `You are a medical literature assistant helping physicians find MRD (Molecular Residual Disease) evidence for solid tumors.

CRITICAL RULES - FOLLOW EXACTLY:
1. NEVER make treatment recommendations or say "you should", "we recommend", or "consider doing"
2. EVERY factual claim MUST cite a source using [1], [2], etc.
3. Use phrases like "the evidence suggests", "studies show", "guidelines state"
4. Note evidence levels when available (e.g., "Category 2A", "Level I", "Grade A")
5. If evidence conflicts, present both sides with citations
6. Encourage clinical trial enrollment when relevant
7. Acknowledge limitations and gaps in evidence
8. Keep responses concise (3-5 paragraphs max)
9. Focus on solid tumors only (NOT hematologic malignancies)

You provide INFORMATION to support clinical judgment, not ADVICE.

When answering:
- Start with the most directly relevant evidence
- Include guideline recommendations with their evidence levels
- Mention key trial results with study names
- Note if evidence is limited or emerging
- End with a note about clinical trial options if applicable

Format citations as [1], [2], etc. The system will append the full citation list.`;

// ============================================
// EMBEDDING & SEARCH
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

async function embedQuery(query) {
  const client = getOpenAI();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query.trim(),
  });
  return response.data[0].embedding;
}

async function searchSimilarItems(queryEmbedding, filters = {}) {
  const db = getPool();

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

  // Cancer type filter
  if (filters.cancerType) {
    sql += `
      AND EXISTS (
        SELECT 1 FROM mrd_guidance_cancer_types ct
        WHERE ct.guidance_id = g.id AND ct.cancer_type = $${paramIndex}
      )
    `;
    params.push(filters.cancerType);
    paramIndex++;
  }

  // Clinical setting filter
  if (filters.clinicalSetting) {
    sql += `
      AND EXISTS (
        SELECT 1 FROM mrd_guidance_clinical_settings cs
        WHERE cs.guidance_id = g.id AND cs.clinical_setting = $${paramIndex}
      )
    `;
    params.push(filters.clinicalSetting);
    paramIndex++;
  }

  // Evidence type filter
  if (filters.evidenceType) {
    sql += ` AND g.evidence_type = $${paramIndex}`;
    params.push(filters.evidenceType);
    paramIndex++;
  }

  sql += `
    ORDER BY g.id, similarity DESC
    LIMIT $${paramIndex}
  `;
  params.push(MAX_SOURCES);

  const result = await db.query(sql, params);
  return result.rows;
}

// ============================================
// CITATION FORMATTING
// ============================================

function formatCitation(source, index) {
  const parts = [];

  // Authors (first author et al if >3)
  if (source.authors && source.authors.length > 0) {
    if (source.authors.length <= 3) {
      parts.push(source.authors.map(a => a.name).join(', '));
    } else {
      parts.push(`${source.authors[0].name} et al.`);
    }
  }

  // Title
  parts.push(source.title);

  // Journal and date
  if (source.journal) {
    let journalPart = source.journal;
    if (source.publication_date) {
      journalPart += ` (${source.publication_date.substring(0, 4)})`;
    }
    parts.push(journalPart);
  }

  // Source ID
  if (source.source_type === 'pubmed' && source.source_id) {
    parts.push(`PMID: ${source.source_id}`);
  } else if (source.source_type === 'clinicaltrials' && source.source_id) {
    parts.push(source.source_id);
  }

  return `[${index}] ${parts.join('. ')}`;
}

function buildSourcesContext(sources) {
  return sources.map((s, i) => {
    const citation = formatCitation(s, i + 1);
    return `Source [${i + 1}]:
Title: ${s.title}
Type: ${s.evidence_type}${s.evidence_level ? ` (${s.evidence_level})` : ''}
Summary: ${s.summary || s.chunk_text}
---`;
  }).join('\n\n');
}

// ============================================
// RELATED ITEMS
// ============================================

async function getRelatedItems(citedIds, limit = 3) {
  if (!citedIds || citedIds.length === 0) return [];

  const db = getPool();

  const result = await db.query(`
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
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter);
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter,
    });
  }

  try {
    const { query, filters = {} } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query',
      });
    }

    if (query.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Query too long (max 1000 characters)',
      });
    }

    // Step 1: Embed the query
    const queryEmbedding = await embedQuery(query);

    // Step 2: Vector search for relevant sources
    const sources = await searchSimilarItems(queryEmbedding, filters);

    if (sources.length === 0) {
      return res.status(200).json({
        success: true,
        answer: 'I could not find specific guidance on this topic in the database. This may be an emerging area where evidence is still being developed, or the topic may not be directly related to MRD testing in solid tumors.',
        sources: [],
        relatedItems: [],
        disclaimer: MEDICAL_DISCLAIMER,
      });
    }

    // Step 3: Build context for Claude
    const sourcesContext = buildSourcesContext(sources);

    // Step 4: Generate response with Claude
    const claude = getAnthropic();

    const response = await claude.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      system: MRD_CHAT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Based on the following sources, answer this clinical question about MRD (Molecular Residual Disease):

QUESTION: ${query}

AVAILABLE SOURCES:
${sourcesContext}

Remember:
- Cite sources using [1], [2], etc.
- Never make treatment recommendations
- Focus on evidence and guidelines
- Keep it concise (3-5 paragraphs)`,
        },
      ],
    });

    const answer = response.content[0]?.text || 'Unable to generate response.';

    // Step 5: Format sources for response
    const formattedSources = sources.map((s, i) => ({
      index: i + 1,
      id: s.id,
      title: s.title,
      citation: formatCitation(s, i + 1),
      url: s.source_url,
      evidenceType: s.evidence_type,
      evidenceLevel: s.evidence_level,
      similarity: parseFloat(s.similarity).toFixed(3),
    }));

    // Step 6: Get related items not already cited
    const citedIds = sources.map(s => s.id);
    const relatedItems = await getRelatedItems(citedIds, 3);

    return res.status(200).json({
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
        queryLength: query.length,
      },
    });

  } catch (error) {
    console.error('MRD Chat Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
