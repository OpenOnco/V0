/**
 * OpenOnco Chat V2 API Endpoint - Tool-Based Chatbot
 *
 * This endpoint uses Claude's tool use feature to make structured queries
 * to the test database, providing more accurate and focused responses.
 *
 * Tools available:
 * - search_tests: Search tests by criteria (cancer type, vendor, approach, etc.)
 * - get_test_details: Get full details for a specific test by ID
 * - compare_tests: Compare multiple tests side-by-side
 * - get_financial_assistance: Get financial assistance info for a vendor
 * - list_vendors: List all vendors in a category
 * - list_cancer_types: List all cancer types covered by tests
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  mrdTestData,
  ecdTestData,
  cgpTestData,
  hctTestData,
  tdsTestData,
  VENDOR_ASSISTANCE_PROGRAMS,
  getAssistanceProgramForVendor
} from './_data.js';

// ============================================
// RATE LIMITING
// ============================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15; // Slightly lower due to tool use overhead

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
const MAX_TOKENS_LIMIT = 2048; // Higher for tool use conversations
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 20; // Higher for multi-turn tool use

const VALID_CATEGORIES = ['MRD', 'ECD', 'TDS', 'HCT', 'all'];
const VALID_PERSONAS = ['patient', 'medical', 'rnd'];

// ============================================
// DATA ACCESS HELPERS
// ============================================
function getTestDataForCategory(category) {
  switch (category) {
    case 'MRD': return mrdTestData;
    case 'ECD': return ecdTestData;
    case 'TDS': return tdsTestData;
    case 'HCT': return hctTestData;
    case 'all': return [...mrdTestData, ...ecdTestData, ...tdsTestData, ...hctTestData];
    default: return [];
  }
}

function getCategoryFromTestId(testId) {
  if (testId.startsWith('mrd-')) return 'MRD';
  if (testId.startsWith('ecd-')) return 'ECD';
  if (testId.startsWith('tds-')) return 'TDS';
  if (testId.startsWith('hct-')) return 'HCT';
  if (testId.startsWith('trm-')) return 'TRM';
  if (testId.startsWith('cgp-')) return 'CGP';
  return null;
}

// ============================================
// TOOL DEFINITIONS
// ============================================
const tools = [
  {
    name: "search_tests",
    description: "Search for tests matching specific criteria. Use this to find tests by cancer type, vendor, approach (tumor-informed vs tumor-naive), or other attributes. Returns a list of matching tests with key summary information.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["MRD", "ECD", "TDS", "HCT", "all"],
          description: "Test category to search. MRD = Minimal Residual Disease monitoring, ECD = Early Cancer Detection, TDS = Treatment Decision Support, HCT = Hereditary Cancer Testing"
        },
        cancer_type: {
          type: "string",
          description: "Cancer type to filter by (e.g., 'breast', 'colorectal', 'lung', 'multi-solid'). Partial matches supported."
        },
        vendor: {
          type: "string",
          description: "Vendor/manufacturer name to filter by (e.g., 'Natera', 'Guardant', 'Foundation Medicine')"
        },
        approach: {
          type: "string",
          enum: ["Tumor-informed", "Tumor-naive"],
          description: "Filter by testing approach. Tumor-informed requires prior tumor sample; tumor-naive does not."
        },
        requires_tumor_tissue: {
          type: "boolean",
          description: "Filter by whether solid tumor tissue biopsy is required"
        },
        has_medicare_coverage: {
          type: "boolean",
          description: "Filter to tests with Medicare coverage"
        },
        max_results: {
          type: "integer",
          description: "Maximum number of results to return (default 10)"
        }
      },
      required: ["category"]
    }
  },
  {
    name: "get_test_details",
    description: "Get complete details for a specific test by its ID (e.g., 'mrd-1', 'ecd-5'). Returns all available information including sensitivity, specificity, TAT, coverage, clinical trials, etc.",
    input_schema: {
      type: "object",
      properties: {
        test_id: {
          type: "string",
          description: "The test ID (e.g., 'mrd-1', 'mrd-7', 'ecd-3')"
        }
      },
      required: ["test_id"]
    }
  },
  {
    name: "compare_tests",
    description: "Compare multiple tests side by side on key attributes. Useful for helping users understand differences between options.",
    input_schema: {
      type: "object",
      properties: {
        test_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of test IDs to compare (e.g., ['mrd-1', 'mrd-7'])"
        },
        attributes: {
          type: "array",
          items: { type: "string" },
          description: "Specific attributes to compare. If not specified, compares key attributes: name, vendor, sensitivity, specificity, approach, TAT, price, medicare coverage"
        }
      },
      required: ["test_ids"]
    }
  },
  {
    name: "get_financial_assistance",
    description: "Get financial assistance and patient support program information for a specific vendor.",
    input_schema: {
      type: "object",
      properties: {
        vendor: {
          type: "string",
          description: "Vendor name (e.g., 'Natera', 'Guardant Health', 'Foundation Medicine')"
        }
      },
      required: ["vendor"]
    }
  },
  {
    name: "list_vendors",
    description: "List all unique vendors/manufacturers in a test category.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["MRD", "ECD", "TDS", "HCT", "all"],
          description: "Test category"
        }
      },
      required: ["category"]
    }
  },
  {
    name: "list_cancer_types",
    description: "List all cancer types covered by tests in a category.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["MRD", "ECD", "TDS", "HCT", "all"],
          description: "Test category"
        }
      },
      required: ["category"]
    }
  }
];

// ============================================
// TOOL EXECUTION
// ============================================
function executeSearchTests(params) {
  const { category, cancer_type, vendor, approach, requires_tumor_tissue, has_medicare_coverage, max_results = 10 } = params;

  let tests = getTestDataForCategory(category);

  // Apply filters
  if (cancer_type) {
    const searchTerm = cancer_type.toLowerCase();
    tests = tests.filter(t => {
      const cancerTypes = t.cancerTypes || [];
      return cancerTypes.some(ct => ct.toLowerCase().includes(searchTerm)) ||
             (t.indicationsNotes && t.indicationsNotes.toLowerCase().includes(searchTerm));
    });
  }

  if (vendor) {
    const searchTerm = vendor.toLowerCase();
    tests = tests.filter(t => t.vendor && t.vendor.toLowerCase().includes(searchTerm));
  }

  if (approach) {
    tests = tests.filter(t => t.approach === approach);
  }

  if (requires_tumor_tissue !== undefined) {
    const required = requires_tumor_tissue ? "Yes" : "No";
    tests = tests.filter(t => t.requiresTumorTissue === required);
  }

  if (has_medicare_coverage) {
    tests = tests.filter(t =>
      t.medicareCoverage &&
      (t.medicareCoverage.status === "COVERED" || t.medicareCoverage.status === "PARTIAL")
    );
  }

  // Limit results and return summary
  const results = tests.slice(0, max_results).map(t => ({
    id: t.id,
    name: t.name,
    vendor: t.vendor,
    approach: t.approach || 'N/A',
    cancerTypes: t.cancerTypes || [],
    sensitivity: t.sensitivity ? `${t.sensitivity}%` : 'N/A',
    specificity: t.specificity ? `${t.specificity}%` : 'N/A',
    medicareCoverage: t.medicareCoverage?.status || 'Unknown',
    price: t.price || 'Not published',
    productType: t.productType || 'Central Lab Service'
  }));

  return {
    total_found: tests.length,
    showing: results.length,
    results
  };
}

function executeGetTestDetails(params) {
  const { test_id } = params;

  // Search all categories for the test
  const allTests = [...mrdTestData, ...ecdTestData, ...tdsTestData, ...hctTestData];
  const test = allTests.find(t => t.id === test_id);

  if (!test) {
    return { error: `Test with ID '${test_id}' not found` };
  }

  // Return relevant fields (exclude internal/citation fields for readability)
  const {
    id, name, vendor, approach, method, cancerTypes, indicationsNotes,
    sensitivity, sensitivityNotes, specificity, specificityNotes,
    stageISensitivity, stageIISensitivity, stageIIISensitivity, stageIVSensitivity,
    lod, lod95, lodNotes,
    requiresTumorTissue, requiresMatchedNormal, variantsTracked,
    initialTat, followUpTat, bloodVolume,
    fdaStatus, reimbursement, reimbursementNote, cptCodes,
    clinicalAvailability, clinicalTrials, clinicalSettings,
    totalParticipants, numPublications, price,
    medicareCoverage, productType
  } = test;

  return {
    id, name, vendor, approach, method, cancerTypes, indicationsNotes,
    sensitivity: sensitivity ? `${sensitivity}%` : null,
    sensitivityNotes,
    specificity: specificity ? `${specificity}%` : null,
    specificityNotes,
    stageSensitivity: {
      stageI: stageISensitivity ? `${stageISensitivity}%` : null,
      stageII: stageIISensitivity ? `${stageIISensitivity}%` : null,
      stageIII: stageIIISensitivity ? `${stageIIISensitivity}%` : null,
      stageIV: stageIVSensitivity ? `${stageIVSensitivity}%` : null
    },
    lod, lod95, lodNotes,
    requiresTumorTissue, requiresMatchedNormal, variantsTracked,
    turnaroundTime: {
      initial: initialTat ? `${initialTat} days` : null,
      followUp: followUpTat ? `${followUpTat} days` : null
    },
    bloodVolume: bloodVolume ? `${bloodVolume} mL` : null,
    fdaStatus, reimbursement, reimbursementNote, cptCodes,
    clinicalAvailability, clinicalTrials, clinicalSettings,
    totalParticipants, numPublications,
    price: price || 'Not published',
    medicareCoverage: medicareCoverage || { status: 'Unknown' },
    productType: productType || 'Central Lab Service',
    category: getCategoryFromTestId(test_id)
  };
}

function executeCompareTests(params) {
  const { test_ids, attributes } = params;

  const allTests = [...mrdTestData, ...ecdTestData, ...tdsTestData, ...hctTestData];

  const defaultAttributes = [
    'name', 'vendor', 'approach', 'sensitivity', 'specificity',
    'initialTat', 'followUpTat', 'price', 'medicareCoverage', 'requiresTumorTissue'
  ];

  const compareAttrs = attributes || defaultAttributes;

  const comparison = test_ids.map(testId => {
    const test = allTests.find(t => t.id === testId);
    if (!test) {
      return { id: testId, error: 'Test not found' };
    }

    const result = { id: testId };
    for (const attr of compareAttrs) {
      if (attr === 'sensitivity' || attr === 'specificity') {
        result[attr] = test[attr] ? `${test[attr]}%` : 'N/A';
      } else if (attr === 'initialTat' || attr === 'followUpTat') {
        result[attr] = test[attr] ? `${test[attr]} days` : 'N/A';
      } else if (attr === 'medicareCoverage') {
        result[attr] = test.medicareCoverage?.status || 'Unknown';
      } else if (attr === 'price') {
        result[attr] = test.price || 'Not published';
      } else {
        result[attr] = test[attr] || 'N/A';
      }
    }
    return result;
  });

  return { comparison, attributes_compared: compareAttrs };
}

function executeGetFinancialAssistance(params) {
  const { vendor } = params;

  const program = getAssistanceProgramForVendor(vendor);

  if (!program) {
    // Check if vendor exists but has no program
    const vendorList = Object.keys(VENDOR_ASSISTANCE_PROGRAMS);
    const closestMatch = vendorList.find(v =>
      v.toLowerCase().includes(vendor.toLowerCase()) ||
      vendor.toLowerCase().includes(v.toLowerCase())
    );

    if (closestMatch) {
      const matchedProgram = VENDOR_ASSISTANCE_PROGRAMS[closestMatch];
      if (!matchedProgram.hasProgram) {
        return {
          vendor: closestMatch,
          hasProgram: false,
          message: `${closestMatch} does not have a documented patient assistance program.`
        };
      }
      return { vendor: closestMatch, ...matchedProgram };
    }

    return {
      error: `No financial assistance information found for '${vendor}'`,
      availableVendors: vendorList
    };
  }

  return { vendor, ...program };
}

function executeListVendors(params) {
  const { category } = params;

  const tests = getTestDataForCategory(category);
  const vendors = [...new Set(tests.map(t => t.vendor).filter(Boolean))].sort();

  return {
    category,
    count: vendors.length,
    vendors
  };
}

function executeListCancerTypes(params) {
  const { category } = params;

  const tests = getTestDataForCategory(category);
  const cancerTypesSet = new Set();

  tests.forEach(t => {
    if (t.cancerTypes) {
      t.cancerTypes.forEach(ct => cancerTypesSet.add(ct));
    }
  });

  const cancerTypes = [...cancerTypesSet].sort();

  return {
    category,
    count: cancerTypes.length,
    cancerTypes
  };
}

function executeTool(toolName, toolInput) {
  switch (toolName) {
    case 'search_tests':
      return executeSearchTests(toolInput);
    case 'get_test_details':
      return executeGetTestDetails(toolInput);
    case 'compare_tests':
      return executeCompareTests(toolInput);
    case 'get_financial_assistance':
      return executeGetFinancialAssistance(toolInput);
    case 'list_vendors':
      return executeListVendors(toolInput);
    case 'list_cancer_types':
      return executeListCancerTypes(toolInput);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============================================
// SYSTEM PROMPT
// ============================================
function buildSystemPrompt(category, persona) {
  const categoryLabel = category === 'all' ? 'liquid biopsy' : category;

  const personaInstructions = {
    patient: `You are a warm, supportive assistant helping patients understand ${categoryLabel} cancer tests.

IMPORTANT GUIDELINES:
- Use simple, non-technical language
- Be empathetic and supportive
- Never give medical advice or recommend specific tests
- Always suggest discussing options with their oncologist
- Focus on education and helping them understand their options
- When showing test options, present them as possibilities (bullet points), not rankings`,

    medical: `You are a clinical decision support assistant for healthcare professionals exploring ${categoryLabel} tests.

IMPORTANT GUIDELINES:
- Use clinical terminology appropriate for healthcare providers
- Provide factual, evidence-based information
- Include relevant metrics: sensitivity, specificity, LOD, TAT
- Reference clinical trials and validation studies when available
- Do NOT recommend specific tests for patient scenarios
- Present data objectively; clinical judgment is the provider's responsibility`,

    rnd: `You are a technical assistant for researchers and industry professionals exploring ${categoryLabel} tests.

IMPORTANT GUIDELINES:
- Provide detailed technical specifications
- Include methodology details and analytical performance
- Reference publications and clinical trial data
- Discuss technological approaches (tumor-informed vs tumor-naive, WGS vs targeted panels)
- Include regulatory status and reimbursement landscape`
  };

  return `${personaInstructions[persona] || personaInstructions.medical}

You have access to tools that query a database of ${categoryLabel} tests. Use these tools to:
1. Search for tests matching user criteria
2. Get detailed information about specific tests
3. Compare tests side by side
4. Find financial assistance programs

RESPONSE GUIDELINES:
- Keep responses concise (3-5 sentences when possible)
- Use Markdown tables for comparisons
- Include test IDs in double brackets like [[mrd-7]] so they become clickable links
- When mentioning costs, note that prices vary by insurance and most vendors offer financial assistance
- Distinguish between "Central Lab Service" (tests oncologists can order) and "Laboratory IVD Kit" (kits labs purchase internally)

PRODUCT TYPE DISTINCTION:
- "Central Lab Service" = Sendout test oncologists can order for patients
- "Laboratory IVD Kit" = Kit purchased by pathology labs to run in-house (NOT orderable by clinicians)
- When users ask about "ordering a test", focus on Central Lab Services`;
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
    // Content can be string or array (for tool use)
    if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) {
      return { valid: false, error: `Message ${i} content must be string or array` };
    }
    if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message ${i} too long (max ${MAX_MESSAGE_LENGTH} chars)` };
    }
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
      category = 'all',
      persona = 'medical',
      messages,
      model: requestedModel,
      max_tool_rounds = 3  // Limit tool use iterations
    } = req.body;

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate persona
    const validatedPersona = VALID_PERSONAS.includes(persona) ? persona : 'medical';

    // Validate messages
    const msgValidation = validateMessages(messages);
    if (!msgValidation.valid) {
      return res.status(400).json({ error: msgValidation.error });
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(category, validatedPersona);

    // Sanitize model
    const model = ALLOWED_MODELS[requestedModel] ? requestedModel : DEFAULT_MODEL;

    // Initialize client
    const client = new Anthropic({ apiKey });

    // Run agentic loop with tool use
    let currentMessages = [...messages];
    let toolRound = 0;
    let finalResponse = null;

    while (toolRound < max_tool_rounds) {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS_LIMIT,
        system: systemPrompt,
        tools,
        messages: currentMessages
      });

      // Check if we need to handle tool use
      if (response.stop_reason === 'tool_use') {
        // Extract tool use blocks
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

        if (toolUseBlocks.length === 0) {
          finalResponse = response;
          break;
        }

        // Execute tools and build tool results
        const toolResults = toolUseBlocks.map(toolUse => ({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(executeTool(toolUse.name, toolUse.input))
        }));

        // Add assistant message and tool results to conversation
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults }
        ];

        toolRound++;
      } else {
        // No more tool use, we have our final response
        finalResponse = response;
        break;
      }
    }

    // If we hit the tool round limit, get one more response without tools
    if (!finalResponse) {
      finalResponse = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS_LIMIT,
        system: systemPrompt,
        messages: currentMessages
      });
    }

    // Return the response with metadata
    return res.status(200).json({
      ...finalResponse,
      _meta: {
        tool_rounds_used: toolRound,
        category,
        persona: validatedPersona
      }
    });

  } catch (error) {
    console.error('Chat V2 API error:', error.message);

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
