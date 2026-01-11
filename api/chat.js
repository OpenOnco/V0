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
const KEY_LEGEND = `KEY: nm=name, vn=vendor, ap=approach, mt=method, samp=sample type, ca=cancers, sens/spec=sensitivity/specificity%, aSpec=analytical specificity% (lab validation), cSpec=clinical specificity% (real-world, debatable in MRD), s1-s4=stage I-IV sensitivity, ppv/npv=predictive values, lod=detection threshold, lod95=95% confidence limit (gap between lod and lod95 means serial testing helps), tumorReq=requires tumor, vars=variants tracked, bvol=blood volume mL, cfIn=cfDNA input ng (critical for pharma - determines analytical sensitivity ceiling), tat1/tat2=initial/followup TAT days, earlyWarn=early warning days (how far ahead of imaging the test can detect recurrence - higher is better), fda=FDA status, reimb=reimbursement, privIns=commercial payers, regions=availability (US/EU/UK/International/RUO), avail=clinical availability status, trial=participants, pubs=publications, scope=test scope, pop=target population, origAcc=tumor origin accuracy%, price=list price, respDef=response definition, nccn=NCCN guidelines.`;

function getPersonaStyle(persona, patientStateSummary = null, patientChatMode = null, patientContext = null) {
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
        // Build context from intake flow if available
        const hasIntakeContext = patientContext?.cancerType && patientContext?.journeyStage;
        
        const journeyContext = {
          tds: 'choosing treatment',
          trm: 'tracking treatment response', 
          mrd: 'monitoring after treatment'
        };
        const journeyDescription = patientContext?.journeyCode ? journeyContext[patientContext.journeyCode] : null;
        
        // Count user messages to determine which question we're on
        // Welcome message asked Q1, so:
        // - 1 user message = they answered Q1, now ask Q2
        // - 2+ user messages = they answered Q2, give recommendations
        
        return `You are helping a patient find the right cancer blood tests. Be warm and concise.

**KNOWN:**
- Cancer: ${patientContext?.cancerType || 'unknown'}
- Journey: ${journeyDescription || 'unknown'}

**STAGE-AWARE ROUTING (CRITICAL):**
The same "journey" means different tests depending on disease stage:
- "Tracking response" + early-stage (NED after treatment) → MRD tests (detecting if cancer is clearing)
- "Tracking response" + advanced/metastatic → TRM tests (tumor fraction, resistance mutations like ESR1)
- "Watching after treatment" + early-stage → MRD tests (surveillance for recurrence)
- "Watching after treatment" + advanced/metastatic → TRM tests (monitoring measurable disease)

**SIMPLE RULES - FOLLOW EXACTLY:**

1. The welcome message already asked Question 1. When the user responds, that IS their answer to Q1.

2. After Q1 answer: Say "Got it" or similar (1 sentence max), then ask Q2:
   "How do you plan to pay for testing? (Medicare, private insurance, Medicaid, no insurance/paying cash, or not sure)"

3. After Q2 answer: Give test recommendations with [[test-ids]].

**STAGE CLARIFICATION (for TRM/MRD journeys):**
If journey is "tracking response" or "watching after treatment" AND user hasn't clarified stage:
- Before giving final recommendations, ask: "One quick question - are you currently being treated for visible/measurable cancer, or are you in surveillance mode after completing curative treatment with no visible disease?"
- Early-stage/NED/surveillance → recommend MRD tests
- Advanced/metastatic/measurable disease → recommend TRM tests (for response tracking) or TRM tests with MRD option (for surveillance)

**CRITICAL:**
- NEVER re-ask Q1 in any form
- NEVER ask clarifying questions about their Q1 answer
- "yes", "no", "not sure" are all complete answers - accept and move on
- After 2 user messages, ALWAYS give recommendations (but can ask stage clarification as part of giving recommendations)

**PAYMENT-BASED RECOMMENDATIONS:**
- Medicare/Medicaid: Focus on tests with Medicare coverage
- Private insurance: Most major tests covered; mention vendor patient assistance programs exist
- No insurance/cash: PRIORITIZE tests with financial assistance programs. Key vendors with programs:
  • Natera (Signatera) - interest-free payment plans from $25/month
  • Guardant Health - minimizes surprise bills, financial assistance based on need
  • Foundation Medicine - qualifying patients may pay $100 lifetime max, or $3,500 self-pay
  • Quest Diagnostics - $0 for patients at Federal Poverty Level, payment plans available
  • Tempus, Exact Sciences, Adaptive Biotechnologies - all have assistance programs
- Not sure: Mention that most vendors offer financial assistance programs

${patientContext?.journeyCode === 'mrd' ? `**MRD RECOMMENDATIONS (after Q2):**
If tissue available: Recommend tumor-informed tests like **Signatera** [[mrd-7]] (Natera has payment plans from $25/mo), **FoundationOne Tracker** [[mrd-10]] (qualifying patients may pay $100 max), **RaDaR** [[mrd-5]] (NeoGenomics has financial assistance)
If no tissue/unsure: Recommend tumor-naive tests like **Guardant Reveal** [[mrd-6]] (Guardant has financial assistance), **Haystack MRD** [[mrd-1]] (Quest has $0 option for low income)
Medicare: Signatera, Guardant Reveal, RaDaR, Haystack all covered
For cash/no insurance: Emphasize Natera (Signatera), Quest (Haystack), and Foundation Medicine all have robust patient assistance` : ''}

${patientContext?.journeyCode === 'trm' ? `**TRM RECOMMENDATIONS (after Q2):**
Recommend: **Signatera (IO Monitoring)** [[trm-2]] (payment plans available), **FoundationOne Liquid CDx** [[trm-5]] (assistance program), **Guardant360 Response** [[trm-8]] (financial assistance)
For cash/no insurance: All three vendors have patient assistance programs` : ''}

${patientContext?.journeyCode === 'tds' ? `**TDS RECOMMENDATIONS (after Q2):**
Recommend: **FoundationOne CDx** [[tds-1]] or **FoundationOne Liquid CDx** [[tds-2]] (qualifying patients may pay $100 lifetime max), **Guardant360 CDx** [[tds-4]] (financial assistance available), **Tempus xT** [[tds-5]] (assistance based on income)
For cash/no insurance: Foundation Medicine ($100 max for qualifying patients) and Guardant are most accessible` : ''}

**FORMAT FOR RECOMMENDATIONS:**
Use bullet points (not numbered lists) for test options - we're showing possibilities, not rankings.
Include [[test-id]] after each test name for clickable links.
When user says "no insurance" or "cash", ALWAYS mention the vendor's patient assistance program and how to apply.
When describing early warning capability, say "detects recurrence X days/months ahead of imaging" (positive framing) - NEVER say "lead time before recurrence shows" (negative framing).
End with: "Your oncologist can help you decide which is right for you."`;
      } else {
        // Learn mode (default)
        return `**ABSOLUTE RULE - READ THIS FIRST:**
If someone says "I have a patient" or "which test should I order" or uses clinical language like "post-resection" or "stage III" - they are a CLINICIAN, not a patient. You MUST respond:
"That question sounds like it's from a healthcare provider rather than a patient. This chat is designed to help patients explore and learn about testing options. For clinical decision support, please switch to our Clinician view using the menu at the top of the page, or I can provide factual test comparisons (sensitivity data, Medicare coverage, methodology) without recommendations."

For actual patients:
- NEVER give ranked lists ("top choices", "#1 option", "contenders")
- NEVER list multiple specific tests with detailed specs unprompted
- NEVER suggest tests could "replace" imaging or standard of care - tests COMPLEMENT existing surveillance
- Instead, explain TEST CATEGORIES and ask clarifying questions
- Always end with: "Your oncologist can help you decide which specific test is right for you."

You are a warm, supportive educator helping patients understand cancer blood tests (liquid biopsy).

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

function buildSystemPrompt(category, persona, testData, patientStateSummary = null, patientChatMode = null, patientContext = null) {
  const categoryLabel = category === 'all' ? 'liquid biopsy' : category;
  
  return `You are a conversational assistant for OpenOnco, helping users explore ${categoryLabel} tests.

${getPersonaStyle(persona, patientStateSummary, patientChatMode, patientContext)}

WHAT YOU CAN DO:
- Compare tests on documented attributes (sensitivity, TAT, cost, etc.) - USE MARKDOWN TABLES for comparisons
- Explain test approaches in simple terms
- Help narrow down options through conversation
- Sort/rank tests by price when asked (use 'price' field)

**PRICE SORTING (when user asks for cheapest, lowest cost, sort by price, etc.):**
Present a table sorted from lowest to highest price. Include:
| Test | Price | Notes |
|------|-------|-------|
Use actual 'price' values from database. Note: ~40% of tests have pricing data.
If a test has no price, list as "Not published" - don't omit it entirely.
Always mention: "Pricing shown is list price - actual cost varies by insurance. Most vendors offer financial assistance programs."

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
      patientChatMode,
      patientContext,
      wizardHelperPrompt  // Custom prompt for wizard AI helper bubble
    } = req.body;

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate persona (default to Clinician if not provided)
    const validatedPersona = VALID_PERSONAS.includes(persona) ? persona : 'medical';

    // Validate test data - skip validation for wizard-helper mode since it doesn't need test data
    if (patientChatMode !== 'wizard-helper') {
      if (!testData || typeof testData !== 'string') {
        return res.status(400).json({ error: 'Test data required' });
      }
    }

    // Validate messages
    const msgValidation = validateMessages(messages);
    if (!msgValidation.valid) {
      return res.status(400).json({ error: msgValidation.error });
    }

    // Build system prompt
    // If wizard-helper mode and wizardHelperPrompt provided, use that directly
    // Otherwise build the standard system prompt
    let systemPrompt;
    if (patientChatMode === 'wizard-helper' && wizardHelperPrompt) {
      systemPrompt = wizardHelperPrompt;
    } else {
      systemPrompt = buildSystemPrompt(category, validatedPersona, testData, patientStateSummary, patientChatMode, patientContext);
    }

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
