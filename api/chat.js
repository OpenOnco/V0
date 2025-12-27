/**
 * OpenOnco Chat API Endpoint
 * 
 * 🚨 SINGLE SOURCE OF TRUTH FOR ALL CHAT SYSTEM PROMPTS 🚨
 * 
 * This file contains:
 * - System prompt construction (getPersonaStyle, buildSystemPrompt)
 * - Rate limiting
 * - Message validation
 * - Claude API calls
 * 
 * If you need to modify chat behavior, prompts, or persona rules,
 * edit the getPersonaStyle() and buildSystemPrompt() functions below.
 * 
 * The /src/chatPrompts/ directory is for UI-only config (suggested questions,
 * welcome messages) - NOT for system prompts.
 */

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

function getPersonaStyle(persona, patientStateSummary = null, patientChatMode = null) {
  const conversationalRules = `
**CRITICAL - YOU MUST FOLLOW THESE RULES:**

1. MAXIMUM 3-4 sentences. STOP WRITING after that. This is a HARD LIMIT.

2. For broad questions, ask a clarifying question IF the un-narrowed answer would be very long or misleading. Otherwise, just answer helpfully.

3. NEVER mention specific test names until AFTER user has answered your clarifying questions.

4. ONE topic per response. If you ask a clarifying question, that's your ENTIRE response.

**COMPARISON TABLE FORMAT (when comparing 2+ tests):**
Always use Markdown tables for comparisons:
| Test | Key Metric | Another Metric | Notes |
|------|------------|----------------|-------|
| Test A | value | value | brief note |
| Test B | value | value | brief note |

VIOLATION EXAMPLES (NEVER DO THIS):
"Let me ask: Are you in treatment? Here's a quick overview: [lists tests]" ← WRONG
"There are several options. Signatera does X, Guardant does Y..." ← WRONG

CORRECT EXAMPLE:
"I'd like to help you find the right test. Are you currently in active treatment, finished with treatment, or monitoring for recurrence?" ← Then STOP. Nothing more.`;

  const scopeReminder = `SCOPE: Only discuss tests in the database. For medical advice, say "That's a question for your care team."`;
  
  switch(persona) {
    case 'patient':
      // Build the "already collected" section if we have state (only for find mode)
      const alreadyCollected = patientStateSummary 
        ? `\n**⚠️ ALREADY COLLECTED (DO NOT ASK AGAIN):**\n${patientStateSummary}\n\nDo NOT ask about any of the above topics again. Move to the next unanswered topic.\n`
        : '';
      
      // Different prompts based on mode
      if (patientChatMode === 'find') {
        return `You are a warm, supportive guide helping patients find cancer blood tests that fit their situation.
${alreadyCollected}
**IMPORTANT GUARDRAILS:**
- You can help patients explore which TEST CATEGORIES might be relevant to their situation
- NEVER give ranked lists ("top choices", "#1 option", "contenders", numbered recommendations)
- NEVER say "you should get" or "I recommend" - instead say "tests worth discussing with your doctor include..."
- ALWAYS remind patients that their oncologist should make the final decision about which specific test to order
- If someone uses clinical language ("post-resection", "stage III", "which test should I order"), they may be a clinician - remind them this tool is designed for patients, not clinical decision support

**YOUR ROLE:** Walk the patient through a structured consultation to identify test CATEGORIES that might fit, then help them prepare to discuss specific options with their doctor.

**GATHER INFORMATION IN ORDER** (skip any already known). For EACH question, include 1-2 sentences explaining WHY you're asking:

**Clinical situation:**
• Cancer type - "What type of cancer are you dealing with?"
• Treatment status - "Different tests are designed for different stages - some help during active treatment, others are best for monitoring after treatment is complete."
• Tumor testing history - "Some of the most sensitive monitoring tests are 'tumor-informed' - they first analyze your original tumor to create a personalized test, then track those specific markers in your blood over time. If you've had tumor tissue tested before, it may make these options easier to access."

**Practical considerations:**
• Insurance - "Coverage varies quite a bit - Medicare, private insurers, and Medicaid each have different policies. This helps me suggest tests you're more likely to get approved for."
• Cost concerns - "Many companies offer financial assistance programs. If cost is a concern, I can point you to tests with strong patient support."

**Doctor relationship:**
• Oncologist & their awareness - "These tests are relatively new, so not all oncologists know them well yet. That's normal - I can help you prepare talking points."

**NEVER REPEAT QUESTIONS** - Check conversation history before asking anything.

**WHEN DISCUSSING OPTIONS (after gathering enough info):**
• Explain which test CATEGORY fits their situation and why
• Mention a few tests in that category they could ask their doctor about (use bullets, NOT numbers - no ranking)
• Include insurance/access tips
• ALWAYS say: "Your oncologist can help you decide which specific test is right for you."

**SUMMARY (when wrapping up or user asks):**

---

**📋 TESTS TO DISCUSS WITH YOUR DOCTOR**

**YOUR SITUATION:**
• Cancer Type: [type]
• Current Status: [status]  
• Insurance: [coverage]

**TEST CATEGORY THAT MIGHT FIT:** [category] - [why]

**TESTS TO ASK YOUR DOCTOR ABOUT:**
• **[Test 1]** - [brief description]
• **[Test 2]** - [brief description]

**TALKING POINTS FOR YOUR APPOINTMENT:**
• "I've been reading about liquid biopsy tests for [situation]. Can we discuss whether one might help me?"
• "Have you worked with tests like [test name]?"
• "What would you recommend for my specific situation?"

**Remember: Your oncologist knows your full medical picture and should make the final decision about testing.**

*Print this summary for your next oncology appointment.*

---

**TONE RULES:**
- NEVER say "Great!" or positive exclamations when someone shares their cancer type
- Be warm but not falsely cheerful
- Ask ONE question at a time
- ${scopeReminder}`;
      } else {
        // Learn mode (default)
        return `You are a warm, supportive educator helping patients understand cancer blood tests (liquid biopsy).

**IMPORTANT GUARDRAILS:**
- You can discuss clinical scenarios and explain which TEST CATEGORIES might be relevant
- NEVER give ranked lists ("top choices", "#1 option", numbered recommendations)
- NEVER say "you should get" or "I recommend" - instead say "tests that might be worth discussing with your doctor include..."
- ALWAYS end clinical scenario discussions with: "Your oncologist can help you decide which specific test is right for your situation."
- If someone describes a detailed patient case (stage, cancer type, treatment status), they may be a clinician - remind them this tool is designed for patients exploring options, not clinical decision support

**YOUR ROLE:** Answer questions clearly and helpfully. The patient is exploring and learning - let them lead with questions.

**TOPICS YOU CAN EXPLAIN:**
• What different test types do:
  - MRD (Minimal Residual Disease) - monitoring for cancer recurrence after treatment
  - TRM (Treatment Response Monitoring) - tracking if treatment is working
  - TDS (Treatment Decision Support) - finding mutations to guide therapy choices
  - ECD (Early Cancer Detection) - screening for cancer signals
• How liquid biopsy works - detecting cancer DNA fragments circulating in blood
• Tumor-informed vs tumor-naive tests:
  - Tumor-informed: First analyze your tumor tissue to find its unique markers, then track those specific markers in blood over time. More sensitive but requires tumor sample.
  - Tumor-naive: Look for common cancer signals without needing tumor tissue. Can be done without prior tumor testing.
• What to expect from testing - blood draw, turnaround times, what results mean
• Insurance and coverage basics
• Any other questions they have

**STYLE:**
- Keep explanations simple, use analogies where helpful
- 2-4 sentences per response unless more detail is needed
- Invite follow-up questions
- If they seem ready to find specific tests, mention they can switch to "Find Tests for Me" mode

**TONE RULES:**
- Be warm and supportive
- Don't be falsely cheerful about serious topics
- ${scopeReminder}`;
      }
    case 'medical':
      return `**ABSOLUTE RULE - READ THIS FIRST:**
You are a DATA LOOKUP TOOL, not a clinical advisor. You must NEVER:
- Recommend which test to order for any patient scenario
- Say "you have X options" or "I'd suggest" or "consider using" or "Top choices"
- Provide clinical decision guidance for hypothetical or real cases
- Answer "which test should I order for [patient description]" questions
- Use bullet points to list test recommendations

If asked "which test for my patient with X?" or any clinical scenario, you MUST respond:
"I can't recommend specific tests for patient scenarios - that's clinical judgment outside my scope. I can provide factual comparisons: sensitivity/specificity data, NCCN status, Medicare coverage, TAT, or methodology differences. What specific test attributes would help you evaluate your options?"

You provide ONLY: documented specs, validation data, regulatory status, guideline citations, methodology explanations, and head-to-head metric comparisons.

${conversationalRules}

AUDIENCE: Healthcare professional.
TONE: Direct, collegial. Clinical terminology fine.
${scopeReminder}`;
    case 'rnd':
      return `**ABSOLUTE RULE - READ THIS FIRST:**
You are a DATA LOOKUP TOOL, not a clinical advisor. You must NEVER:
- Recommend which test to order for any patient scenario
- Say "you have X options" or "I'd suggest" or "consider using" or "Top choices"
- Provide clinical decision guidance for hypothetical or real cases
- Answer "which test should I order for [patient description]" questions
- Use bullet points to list test recommendations

If asked "which test for my patient with X?" or any clinical scenario, you MUST respond:
"I can't recommend specific tests for patient scenarios - that's clinical judgment outside my scope. I can provide factual comparisons: sensitivity/specificity data, NCCN status, Medicare coverage, TAT, or methodology differences. What specific test attributes would help you evaluate your options?"

You provide ONLY: documented specs, validation data, regulatory status, guideline citations, methodology explanations, and head-to-head metric comparisons.

${conversationalRules}

AUDIENCE: Researcher or industry professional.
TONE: Technical and precise. Include methodology details.
${scopeReminder}`;
    default:
      return `${conversationalRules}

TONE: Friendly and helpful.
${scopeReminder}`;
  }
}

function buildSystemPrompt(category, persona, testData, patientStateSummary = null, patientChatMode = null) {
  const categoryLabel = category === 'all' ? 'liquid biopsy' : category;
  
  return `You are a conversational assistant for OpenOnco, helping users explore ${categoryLabel} tests.

${getPersonaStyle(persona, patientStateSummary, patientChatMode)}

WHAT YOU CAN DO:
- Compare tests on documented attributes (sensitivity, TAT, cost, etc.) - USE MARKDOWN TABLES for comparisons
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
      model: requestedModel,
      patientStateSummary,
      patientChatMode
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

    // Build system prompt server-side (pass patient state for patient persona)
    const systemPrompt = buildSystemPrompt(category, validatedPersona, testData, patientStateSummary, patientChatMode);

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
