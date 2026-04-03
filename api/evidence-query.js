/**
 * Evidence Explorer API Endpoint
 *
 * Accepts a physician's natural-language question, uses Claude to parse it
 * into structured filters, then runs a deterministic query engine against
 * the evidence claims database.
 *
 * POST /api/evidence-query
 * Body: { "question": "string" }
 */

import Anthropic from "@anthropic-ai/sdk";
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================
// RATE LIMITING (same pattern as chat.js)
// ============================================
const MAX_REQUESTS_PER_WINDOW = 20;

let ratelimit;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
    }),
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_WINDOW, '60 s'),
    analytics: true,
    prefix: 'openonco:evidence-query',
  });
}

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;

function getClientIP(req) {
  const vercelIP = req.headers['x-vercel-forwarded-for'];
  if (vercelIP) return vercelIP.split(',')[0].trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[ips.length - 1];
  }
  return 'unknown';
}

async function checkRateLimit(clientIP) {
  if (ratelimit) {
    const { success, remaining, reset } = await ratelimit.limit(clientIP);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return { allowed: false, remaining: 0, retryAfter: Math.max(retryAfter, 1) };
    }
    return { allowed: true, remaining };
  }

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
// LOAD CLAIMS FROM JSON FILES
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _claimsCache = null;

function loadAllClaims() {
  if (_claimsCache) return _claimsCache;

  const claimsDir = path.resolve(__dirname, '..', 'evidence', 'claims');
  const files = fs.readdirSync(claimsDir).filter(f => f.endsWith('.json'));

  const allClaims = [];
  for (const file of files) {
    const filePath = path.join(claimsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(data)) {
      allClaims.push(...data);
    }
  }

  _claimsCache = allClaims;
  return allClaims;
}

// ============================================
// ROUTER PROMPT
// ============================================
const TEST_NAME_MAP = `Known test names and IDs:
- Signatera → mrd-7
- Guardant Reveal → mrd-6
- clonoSEQ → mrd-5
- FoundationOne Tracker → mrd-8
- RaDaR → mrd-9
- Oncotype DX → tds-19
- Galleri → ecd-2
- Shield → ecd-1`;

const ROUTER_SYSTEM_PROMPT = `You are a query parser for a clinical evidence database about MRD (Minimal Residual Disease) and liquid biopsy testing. Parse the physician's question into structured filters.

Output JSON only:
{
  "cancer": "colorectal" | "breast" | "lung" | "bladder" | "melanoma" | "hematologic" | null,
  "stages": ["II"] | null,
  "test_ids": ["mrd-1"] | null,
  "test_names": ["Signatera"] | null,
  "claim_types": ["trial_result", "guideline_recommendation"] | null,
  "keywords": ["adjuvant"] | null,
  "framing": "Showing evidence for..."
}

Rules:
- If the physician mentions a specific test, resolve it to the test name
- "framing" is ONE sentence describing what you're showing, never clinical advice
- When unsure about a field, set it to null (broader results are better)
- Never add information the physician didn't ask about

${TEST_NAME_MAP}`;

// ============================================
// QUERY ENGINE (deterministic, no LLM)
// ============================================
function queryEvidence(claims, query) {
  return claims.filter(claim => {
    if (query.cancer && claim.scope.cancer !== query.cancer && claim.scope.cancer !== 'cross-cancer') return false;
    if (query.stages?.length && claim.scope.stages?.length && !query.stages.some(s => claim.scope.stages.includes(s))) return false;
    if (query.test_ids?.length) {
      const isTestSpecific = claim.scope.tests?.some(t => query.test_ids.includes(t.test_id));
      const isTestAgnostic = !claim.scope.tests?.length;
      if (!isTestSpecific && !isTestAgnostic) return false;
    }
    if (query.claim_types?.length && !query.claim_types.includes(claim.type)) return false;
    if (query.keywords?.length) {
      const text = JSON.stringify(claim).toLowerCase();
      if (!query.keywords.some(kw => text.includes(kw.toLowerCase()))) return false;
    }
    return true;
  });
}

// ============================================
// SORTING
// ============================================
const TYPE_ORDER = {
  'guideline_recommendation': 0,
  'trial_result': 1,
  'diagnostic_performance': 2,
  'clinical_utility': 3,
  'methodology_note': 4,
};

function sortClaims(claims) {
  return claims.sort((a, b) => {
    const typeA = TYPE_ORDER[a.type] ?? 99;
    const typeB = TYPE_ORDER[b.type] ?? 99;
    if (typeA !== typeB) return typeA - typeB;

    // Within trial_result: largest sample size first
    if (a.type === 'trial_result' && b.type === 'trial_result') {
      const nA = a.finding?.n ?? 0;
      const nB = b.finding?.n ?? 0;
      if (nA !== nB) return nB - nA;
    }

    // Within same type group: newest year first
    const yearA = a.source?.year ?? 0;
    const yearB = b.source?.year ?? 0;
    return yearB - yearA;
  });
}

// ============================================
// KEYWORD FALLBACK (when Claude API fails)
// ============================================
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'and', 'but', 'or', 'if', 'while', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
  'their', 'about', 'up', 'just', 'also', 'any',
]);

function keywordFallback(claims, question) {
  const words = question.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return claims;

  return claims.filter(claim => {
    const text = JSON.stringify(claim).toLowerCase();
    return words.some(w => text.includes(w));
  });
}

// ============================================
// RESPONSE STATS
// ============================================
function computeStats(claims, query) {
  let testSpecificCount = 0;
  let testAgnosticCount = 0;
  const sourceSet = new Set();

  for (const claim of claims) {
    if (query.test_ids?.length) {
      const isTestSpecific = claim.scope.tests?.some(t => query.test_ids.includes(t.test_id));
      if (isTestSpecific) {
        testSpecificCount++;
      } else {
        testAgnosticCount++;
      }
    } else {
      // No test filter — count by whether claim has tests at all
      if (claim.scope.tests?.length) {
        testSpecificCount++;
      } else {
        testAgnosticCount++;
      }
    }

    if (claim.source?.pmid) sourceSet.add(claim.source.pmid);
    else if (claim.source?.title) sourceSet.add(claim.source.title);
  }

  return {
    testSpecificCount,
    testAgnosticCount,
    totalSources: sourceSet.size,
  };
}

// ============================================
// CORS
// ============================================
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateCheck = await checkRateLimit(clientIP);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);

  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', rateCheck.retryAfter);
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter });
  }

  try {
    const { question } = req.body || {};

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty "question" field' });
    }

    if (question.length > 1000) {
      return res.status(400).json({ error: 'Question too long (max 1000 characters)' });
    }

    // Load all claims
    const allClaims = loadAllClaims();

    // Try Claude router
    let parsedQuery = null;
    let fallback = false;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          temperature: 0,
          system: ROUTER_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: question.trim() }],
        });

        const text = response.content?.[0]?.text || '';
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedQuery = JSON.parse(jsonMatch[0]);
        }
      } catch (routerError) {
        // Fall through to keyword fallback
        console.error('Evidence query router error:', routerError.message);
      }
    }

    // Keyword fallback if Claude fails
    if (!parsedQuery) {
      fallback = true;
      const filtered = keywordFallback(allClaims, question);
      const sorted = sortClaims(filtered);
      const stats = computeStats(sorted, {});

      return res.status(200).json({
        query: null,
        framing: `Showing keyword-matched results for: "${question.trim()}"`,
        claims: sorted,
        testSpecificCount: stats.testSpecificCount,
        testAgnosticCount: stats.testAgnosticCount,
        totalSources: stats.totalSources,
        fallback: true,
      });
    }

    // Deterministic query engine
    const filtered = queryEvidence(allClaims, parsedQuery);
    const sorted = sortClaims(filtered);
    const stats = computeStats(sorted, parsedQuery);

    return res.status(200).json({
      query: parsedQuery,
      framing: parsedQuery.framing || `Showing evidence for: "${question.trim()}"`,
      claims: sorted,
      testSpecificCount: stats.testSpecificCount,
      testAgnosticCount: stats.testAgnosticCount,
      totalSources: stats.totalSources,
      fallback: false,
    });

  } catch (error) {
    console.error('Evidence query error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
