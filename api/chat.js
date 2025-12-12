// Secure Chat API Endpoint for OpenOnco
// Security: rate limiting, model whitelist, input validation

import Anthropic from "@anthropic-ai/sdk";

// ============================================
// RATE LIMITING (in-memory, resets on cold start)
// For production, consider Vercel KV or Upstash Redis
// ============================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // 20 requests per minute per IP

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
// SECURITY CONFIGURATION
// ============================================

// Allowed models - only these can be used (must match App.jsx CHAT_MODELS)
const ALLOWED_MODELS = {
  'claude-haiku-4-5-20251001': true,
  'claude-sonnet-4-5-20250929': true
};
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

// Token limits
const MAX_TOKENS_LIMIT = 1024; // Cap max_tokens regardless of what client requests
const MAX_MESSAGE_LENGTH = 4000; // Max characters per message
const MAX_MESSAGES = 10; // Max messages in conversation

// Required system prompt prefix - ensures this is an OpenOnco request
const REQUIRED_SYSTEM_PREFIX = 'You are a liquid biopsy test information assistant for OpenOnco';

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }
  if (messages.length === 0) {
    return { valid: false, error: 'Messages array is empty' };
  }
  if (messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Too many messages (max ${MAX_MESSAGES})` };
  }
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.role || !msg.content) {
      return { valid: false, error: `Message ${i} missing role or content` };
    }
    if (!['user', 'assistant'].includes(msg.role)) {
      return { valid: false, error: `Message ${i} has invalid role` };
    }
    if (typeof msg.content !== 'string') {
      return { valid: false, error: `Message ${i} content must be string` };
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message ${i} too long (max ${MAX_MESSAGE_LENGTH} chars)` };
    }
  }
  
  // Last message must be from user
  if (messages[messages.length - 1].role !== 'user') {
    return { valid: false, error: 'Last message must be from user' };
  }
  
  return { valid: true };
}

function validateSystemPrompt(system) {
  if (!system || typeof system !== 'string') {
    return { valid: false, error: 'System prompt required' };
  }
  // Ensure this is a legitimate OpenOnco request
  if (!system.includes(REQUIRED_SYSTEM_PREFIX)) {
    return { valid: false, error: 'Invalid system prompt' };
  }
  return { valid: true };
}

// ============================================
// MAIN HANDLER
// ============================================

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
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      retryAfter: rateLimit.retryAfter 
    });
  }

  try {
    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { model: requestedModel, max_tokens: requestedTokens, system, messages } = req.body;

    // Validate messages
    const msgValidation = validateMessages(messages);
    if (!msgValidation.valid) {
      return res.status(400).json({ error: msgValidation.error });
    }

    // Validate system prompt
    const sysValidation = validateSystemPrompt(system);
    if (!sysValidation.valid) {
      return res.status(400).json({ error: sysValidation.error });
    }

    // Sanitize model - only allow whitelisted models
    const model = ALLOWED_MODELS[requestedModel] ? requestedModel : DEFAULT_MODEL;
    
    // Cap max_tokens
    const max_tokens = Math.min(
      typeof requestedTokens === 'number' ? requestedTokens : MAX_TOKENS_LIMIT,
      MAX_TOKENS_LIMIT
    );

    // Make API call
    const client = new Anthropic({ apiKey });
    
    const response = await client.messages.create({
      model,
      max_tokens,
      system,
      messages
    });

    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Chat API error:', error.message);
    console.error('Full error:', error);
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'Service temporarily unavailable' });
    }
    
    // Return details for debugging (remove in production)
    return res.status(500).json({ 
      error: 'An error occurred',
      message: error.message,
      type: error.constructor.name
    });
  }
}
