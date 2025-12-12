// Secure Chat API Endpoint for OpenOnco
// System prompt constructed server-side for security and smaller payloads

import Anthropic from "@anthropic-ai/sdk";

// ============================================
// RATE LIMITING
// ============================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

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
const ALLOWED_MODELS = {
  'claude-haiku-4-5-20251001': true,
  'claude-sonnet-4-5-20250929': true
};
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_LIMIT = 1024;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 10;

const VALID_CATEGORIES = ['MRD', 'ECD', 'TRM', 'CGP', 'all'];
const VALID_PERSONAS = ['Patient', 'Clinician', 'Academic/Industry'];

// ============================================
// SERVER-SIDE SYSTEM PROMPT CONSTRUCTION
// ============================================
const KEY_LEGEND = `KEY: nm=name, vn=vendor, ap=approach, mt=method, samp=sample type, ca=cancers, sens/spec=sensitivity/specificity%, aSpec=analytical specificity% (lab validation), cSpec=clinical specificity% (real-world, debatable in MRD), s1-s4=stage I-IV sensitivity, ppv/npv=predictive values, lod=detection threshold, lod95=95% confidence limit (gap between lod and lod95 means serial testing helps), tumorReq=requires tumor, vars=variants tracked, bvol=blood volume mL, cfIn=cfDNA input ng (critical for pharma - determines analytical sensitivity ceiling), tat1/tat2=initial/followup TAT days, lead=lead time vs imaging days, fda=FDA status, reimb=reimbursement, privIns=commercial payers, regions=availability (US/EU/UK/International/RUO), avail=clinical availability status, trial=participants, pubs=publications, scope=test scope, pop=target population, origAcc=tumor origin accuracy%, price=list price, respDef=response definition, nccn=NCCN guidelines.`;

function getPersonaStyle(persona) {
  const lengthRule = `LENGTH: Keep responses under 20 lines. Be concise - lead with the answer, then add essential context. Use short paragraphs. Avoid lengthy preambles.`;
  const scopeReminder = `REMEMBER: Only discuss tests in the database. For medical questions about diseases, genetics, screening decisions, or result interpretation, say "Please discuss with your healthcare provider."`;
  
  switch(persona) {
    case 'Patient':
      return `AUDIENCE: Patient or caregiver seeking to understand options.
STYLE: Use clear, accessible language. Avoid jargon - if you must use technical terms, briefly explain them. Be warm but careful not to give medical advice. Focus ONLY on explaining what tests exist and their basic attributes. Do NOT suggest whether someone should get tested or interpret what results might mean.
IMPORTANT: If asked about disease inheritance, genetics, or whether they should be screened, say "That's an important question for your healthcare provider - they can assess your individual situation."
${lengthRule}
${scopeReminder}`;
    case 'Clinician':
      return `AUDIENCE: Healthcare professional comparing tests for patients.
STYLE: Be direct and clinical. Use standard medical terminology freely. Focus on actionable metrics: sensitivity, specificity, LOD, TAT, reimbursement status, FDA clearance. When describing a test, always note its "targetPopulation" field so the clinician can assess fit.
IMPORTANT: If the described patient doesn't match a test's target population, explicitly note this discrepancy rather than recommending the test.
${lengthRule}
${scopeReminder}`;
    case 'Academic/Industry':
      return `AUDIENCE: Researcher or industry professional studying the landscape.
STYLE: Be technical and detailed. Include methodology details, analytical performance metrics, and validation data. Reference publications and trial data when relevant. Discuss technology differentiators and emerging approaches.
${lengthRule}
${scopeReminder}`;
    default:
      return `STYLE: Be concise and helpful. Lead with key insights. Use prose not bullets.
${lengthRule}
${scopeReminder}`;
  }
}

function buildSystemPrompt(category, persona, testData) {
  const categoryLabel = category === 'all' ? 'liquid biopsy' : category;
  
  return `You are a liquid biopsy test information assistant for OpenOnco. Your ONLY role is to help users explore and compare the specific tests in the database below.

STRICT SCOPE LIMITATIONS:
- ONLY discuss tests that exist in the database below
- NEVER speculate about disease genetics, heredity, inheritance patterns, or etiology - these are complex medical topics outside your scope
- NEVER suggest screening strategies or make recommendations about who should be tested
- NEVER interpret what positive or negative test results mean clinically
- NEVER make claims about diseases, conditions, or cancer types beyond what is explicitly stated in the test data
- If a user describes a patient/situation, check the "targetPopulation" field - if they don't clearly fit, say "This test is designed for [target population]. Please discuss with a healthcare provider whether it's appropriate for this situation."
- For ANY question outside the specific test data (disease inheritance, screening recommendations, result interpretation, treatment decisions): respond with "That's outside my scope. Please discuss with your healthcare provider."

WHAT YOU CAN DO:
- Compare tests in the database on their documented attributes (sensitivity, specificity, TAT, cost, coverage, etc.)
- Explain what data is available or not available for specific tests
- Help users understand the differences between test approaches (tumor-informed vs tumor-naïve, etc.)
- Direct users to the appropriate test category

FORMATTING: Do NOT use markdown tables. Use bullet points or bold labels instead. For comparisons, format like:
**Test Name:**
- Sensitivity: X%
- Specificity: Y%

${categoryLabel.toUpperCase()} DATABASE:
${testData}

${KEY_LEGEND}

${getPersonaStyle(persona)}

Say "not specified" for missing data. When uncertain, err on the side of saying "please consult your healthcare provider."`;
}

// ============================================
// VALIDATION
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
  
  if (messages[messages.length - 1].role !== 'user') {
    return { valid: false, error: 'Last message must be from user' };
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
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { 
      category, 
      persona, 
      testData, 
      messages, 
      model: requestedModel 
    } = req.body;

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate persona (default to Clinician if not provided)
    const validatedPersona = VALID_PERSONAS.includes(persona) ? persona : 'Clinician';

    // Validate test data
    if (!testData || typeof testData !== 'string') {
      return res.status(400).json({ error: 'Test data required' });
    }

    // Validate messages
    const msgValidation = validateMessages(messages);
    if (!msgValidation.valid) {
      return res.status(400).json({ error: msgValidation.error });
    }

    // Build system prompt server-side
    const systemPrompt = buildSystemPrompt(category, validatedPersona, testData);

    // Sanitize model
    const model = ALLOWED_MODELS[requestedModel] ? requestedModel : DEFAULT_MODEL;
    
    // Cap max_tokens
    const max_tokens = MAX_TOKENS_LIMIT;

    // Make API call
    const client = new Anthropic({ apiKey });
    
    const response = await client.messages.create({
      model,
      max_tokens,
      system: systemPrompt,
      messages
    });

    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Chat API error:', error.message);
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'Service temporarily unavailable' });
    }
    
    return res.status(500).json({ 
      error: 'An error occurred',
      message: error.message,
      type: error.constructor.name
    });
  }
}
