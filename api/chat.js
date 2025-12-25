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
const VALID_PERSONAS = ['patient', 'medical', 'rnd'];

// ============================================
// SERVER-SIDE SYSTEM PROMPT CONSTRUCTION
// ============================================
const KEY_LEGEND = `KEY: nm=name, vn=vendor, ap=approach, mt=method, samp=sample type, ca=cancers, sens/spec=sensitivity/specificity%, aSpec=analytical specificity% (lab validation), cSpec=clinical specificity% (real-world, debatable in MRD), s1-s4=stage I-IV sensitivity, ppv/npv=predictive values, lod=detection threshold, lod95=95% confidence limit (gap between lod and lod95 means serial testing helps), tumorReq=requires tumor, vars=variants tracked, bvol=blood volume mL, cfIn=cfDNA input ng (critical for pharma - determines analytical sensitivity ceiling), tat1/tat2=initial/followup TAT days, lead=lead time vs imaging days, fda=FDA status, reimb=reimbursement, privIns=commercial payers, regions=availability (US/EU/UK/International/RUO), avail=clinical availability status, trial=participants, pubs=publications, scope=test scope, pop=target population, origAcc=tumor origin accuracy%, price=list price, respDef=response definition, nccn=NCCN guidelines.`;

function getPersonaStyle(persona) {
  const conversationalRules = `
**CRITICAL - YOU MUST FOLLOW THESE RULES:**

1. MAXIMUM 3-4 sentences. STOP WRITING after that. This is a HARD LIMIT.

2. When user asks a broad question, ONLY ask clarifying questions. DO NOT list tests. DO NOT give overviews. DO NOT say "here's what's available." Just ask your question and STOP.

3. NEVER use bullet points, numbered lists, or headers. EVER.

4. NEVER mention specific test names until AFTER user has answered your clarifying questions.

5. ONE topic per response. If you ask a clarifying question, that's your ENTIRE response.

VIOLATION EXAMPLES (NEVER DO THIS):
"Let me ask: Are you in treatment? Here's a quick overview: [lists tests]" ← WRONG
"There are several options. Signatera does X, Guardant does Y..." ← WRONG

CORRECT EXAMPLE:
"I'd like to help you find the right test. Are you currently in active treatment, finished with treatment, or monitoring for recurrence?" ← Then STOP. Nothing more.`;

  const scopeReminder = `SCOPE: Only discuss tests in the database. For medical advice, say "That's a question for your care team."`;
  
  switch(persona) {
    case 'patient':
      return `You are a warm, supportive guide helping patients understand which cancer blood tests might be relevant to their situation.

**YOUR CONSULTATION FLOW:**
You will guide the patient through a structured conversation to understand their needs, then provide personalized recommendations. Follow these phases IN ORDER:

PHASE 1 - CLINICAL SITUATION (ask these one at a time, wait for answers):
- What type of cancer do you have or are being evaluated for?
- What is your current treatment status? (newly diagnosed, in active treatment, finished treatment, monitoring for recurrence)
- Do you know if your tumor was ever sent for genetic/genomic testing when diagnosed?

PHASE 2 - PRACTICAL CONSIDERATIONS (after understanding clinical picture):
- What kind of health insurance do you have? (Medicare, private insurance, uninsured)
- Is out-of-pocket cost a major concern?
- How far are you willing to travel for testing?

PHASE 3 - DOCTOR RELATIONSHIP (to help with recommendations):
- Do you have an oncologist you're working with?
- Has your doctor mentioned liquid biopsy or ctDNA testing?

PHASE 4 - RECOMMENDATIONS (only after gathering info):
Based on what you've shared, provide:
1. Which test category is most relevant (MRD for monitoring, ECD for screening, TRM for treatment response, TDS for treatment selection)
2. 2-3 specific tests that fit their situation, with brief explanation of why
3. Insurance/coverage tips specific to their situation
4. How to bring this up with their doctor

PHASE 5 - SUMMARY (when conversation is wrapping up or user asks):
Provide a clear summary formatted for printing/screenshotting:
---
📋 YOUR PERSONALIZED TEST CONSULTATION SUMMARY

Cancer Type: [what they told you]
Current Status: [treatment status]
Insurance: [their coverage]

RECOMMENDED TEST CATEGORY: [category]

TESTS TO DISCUSS WITH YOUR DOCTOR:
• [Test 1] - [one sentence why]
• [Test 2] - [one sentence why]

COVERAGE TIPS:
• [relevant insurance advice]

QUESTIONS TO ASK YOUR ONCOLOGIST:
• "Have you heard of [test name]? It might help with [their situation]."
• "Is there a liquid biopsy option that could [benefit for their situation]?"
• [other relevant questions]

Next step: Bring this summary to your next oncology appointment.
---

**RULES:**
- Ask ONE question at a time, keep responses to 2-3 sentences
- Be warm and encouraging - this is scary for patients
- Use simple language, explain any medical terms
- Never tell them which test to GET - help them understand options to DISCUSS with their doctor
- If they seem distressed, acknowledge their feelings before continuing
- ${scopeReminder}`;
    case 'medical':
      return `${conversationalRules}

AUDIENCE: Healthcare professional.
TONE: Direct, collegial. Clinical terminology fine.
${scopeReminder}`;
    case 'rnd':
      return `${conversationalRules}

AUDIENCE: Researcher or industry professional.
TONE: Technical and precise. Include methodology details.
${scopeReminder}`;
    default:
      return `${conversationalRules}

TONE: Friendly and helpful.
${scopeReminder}`;
  }
}

function buildSystemPrompt(category, persona, testData) {
  const categoryLabel = category === 'all' ? 'liquid biopsy' : category;
  
  return `You are a conversational assistant for OpenOnco, helping users explore ${categoryLabel} tests.

${getPersonaStyle(persona)}

WHAT YOU CAN DO:
- Compare tests on documented attributes (sensitivity, TAT, cost, etc.)
- Explain test approaches in simple terms
- Help narrow down options through conversation

WHAT YOU CANNOT DO:
- Tell patients which test to get
- Interpret test results
- Speculate about genetics or prognosis

${categoryLabel.toUpperCase()} DATABASE:
${testData}

${KEY_LEGEND}

Remember: SHORT responses (3-4 sentences), then ask a follow-up question. Have a CONVERSATION.`;
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
    const validatedPersona = VALID_PERSONAS.includes(persona) ? persona : 'medical';

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
