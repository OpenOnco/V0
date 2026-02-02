/**
 * HTTP Server for MRD Chat API
 * Serves as a proxy between Vercel and the internal Railway PostgreSQL database
 */

import { createServer } from 'http';
import { createLogger } from './utils/logger.js';
import { query } from './db/mrd-client.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { crawlClinicalTrials, seedPriorityTrials } from './crawlers/mrd/clinicaltrials.js';
import { processNccnPdf } from './crawlers/mrd/nccn-processor.js';

const logger = createLogger('server');

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 3000;
const SONNET_MODEL = 'claude-sonnet-4-20250514';
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const MAX_SOURCES = 10;
const MIN_SIMILARITY = 0.7;

// Rate limiting (in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

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
// EMBEDDING & SEARCH
// ============================================

async function embedQuery(queryText) {
  const client = getOpenAI();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: queryText.trim(),
  });
  return response.data[0].embedding;
}

async function searchSimilarItems(queryEmbedding, filters = {}) {
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

  const result = await query(sql, params);
  return result.rows;
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

    // Step 1: Embed the query
    const queryEmbedding = await embedQuery(queryText);

    // Step 2: Vector search
    const sources = await searchSimilarItems(queryEmbedding, filters);

    if (sources.length === 0) {
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

    const response = await claude.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      system: MRD_CHAT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Based on the following sources, answer this clinical question about MRD (Molecular Residual Disease):

QUESTION: ${queryText}

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

    // Step 5: Format sources
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

    // Step 6: Get related items
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
    const [guidanceResult, trialsResult, embeddingsResult] = await Promise.all([
      query('SELECT COUNT(*) as count FROM mrd_guidance_items'),
      query('SELECT COUNT(*) as count FROM mrd_clinical_trials'),
      query('SELECT COUNT(*) as count FROM mrd_item_embeddings'),
    ]);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'mrd-chat-api',
      database: {
        guidanceItems: parseInt(guidanceResult.rows[0].count),
        clinicalTrials: parseInt(trialsResult.rows[0].count),
        embeddings: parseInt(embeddingsResult.rows[0].count),
      },
    }));
  } catch (error) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mrd-chat-api', database: 'error' }));
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

        await query(
          `INSERT INTO mrd_guidance_items (
            source_type, source_id, source_url,
            title, summary, evidence_type, evidence_level,
            key_findings, publication_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
