// Secure Chat API Endpoint for OpenOnco
// Mitigates vulnerabilities: client cannot control model, max_tokens, or base system prompt

import Anthropic from "@anthropic-ai/sdk";

// Rate limiting storage (in production, use Redis or KV store)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

// Allowed models (whitelist) - client can only select from these
const ALLOWED_MODELS = {
  'claude-sonnet-4-20250514': true,
  'claude-haiku-3-5-20241022': true
};
const DEFAULT_MODEL = 'claude-haiku-3-5-20241022';

// Fixed max tokens - not client controllable
const MAX_TOKENS = 1024;

// Base system prompt (server-side only) - client cannot modify this
const BASE_SYSTEM_PROMPT = `You are a liquid biopsy test information assistant for OpenOnco, a non-profit cancer diagnostic test database.

STRICT SCOPE LIMITATIONS:
- ONLY discuss tests that exist in the database provided
- NEVER speculate about disease genetics, heredity, inheritance patterns, or etiology
- NEVER suggest screening strategies or make recommendations about who should be tested
- NEVER interpret what positive or negative test results mean clinically
- NEVER make claims about diseases beyond what is explicitly stated in test data
- For ANY question outside the specific test data: respond with "That's outside my scope. Please discuss with your healthcare provider."

WHAT YOU CAN DO:
- Compare tests on their documented attributes (sensitivity, specificity, TAT, cost, coverage, etc.)
- Explain what data is available for specific tests
- Help users understand differences between test approaches
- Direct users to appropriate test categories`;

// Get client IP for rate limiting
function getClientIP(req) {
  return req.headers.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get?.('x-real-ip') || 
         'unknown';
}

// Check rate limit
function checkRateLimit(clientIP) {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIP);
  
  if (!clientData) {
    rateLimitMap.set(clientIP, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }
  
  if (now - clientData.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(clientIP, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }
  
  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((clientData.windowStart + RATE_LIMIT_WINDOW - now) / 1000) };
  }
  
  clientData.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - clientData.count };
}

// Validate messages format - prevent injection
function validateMessages(messages) {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0 || messages.length > 10) return false;
  
  for (const msg of messages) {
    if (!msg.role || !msg.content) return false;
    if (!['user', 'assistant'].includes(msg.role)) return false;
    if (typeof msg.content !== 'string') return false;
    if (msg.content.length > 4000) return false;
  }
  
  if (messages[messages.length - 1].role !== 'user') return false;
  return true;
}

// Validate test data context (basic sanity check)
function validateTestData(testData) {
  if (!testData) return true; // Optional
  if (typeof testData !== 'string') return false;
  if (testData.length > 100000) return false; // Cap size
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP);
  
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter);
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter });
  }

  try {
    const { messages, testData, keyLegend, persona, model: requestedModel } = req.body;

    // Validate messages
    if (!validateMessages(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Validate test data
    if (!validateTestData(testData)) {
      return res.status(400).json({ error: 'Invalid test data' });
    }

    // Validate and select model - ignore client value if not in whitelist
    const model = ALLOWED_MODELS[requestedModel] ? requestedModel : DEFAULT_MODEL;

    // Construct system prompt server-side (client cannot override base prompt)
    let systemPrompt = BASE_SYSTEM_PROMPT;
    
    // Add persona context if provided
    if (persona === 'Patient') {
      systemPrompt += `\n\nIMPORTANT: You are speaking with a patient. Use clear, accessible language. Avoid medical jargon. Be empathetic and supportive while maintaining accuracy.`;
    }
    
    // Add test data context if provided (this is public data anyway)
    if (testData) {
      systemPrompt += `\n\nDATABASE:\n${testData}`;
    }
    if (keyLegend) {
      systemPrompt += `\n\n${keyLegend}`;
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: model,
      max_tokens: MAX_TOKENS, // Fixed server-side
      system: systemPrompt,
      messages: messages.slice(-6) // Server-side limiting
    });

    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Chat API error:', error);
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'Service temporarily unavailable' });
    }
    
    return res.status(500).json({ error: 'An error occurred' });
  }
}
