/**
 * OpenOnco Chat API v2 - Tool-based Chatbot
 *
 * This endpoint implements an agentic chatbot that uses Claude's tool-use
 * capabilities to query the test database dynamically, rather than passing
 * all test data in the system prompt.
 *
 * Tools mirror the OpenOnco MCP interface:
 * - search_tests: Filter tests by category and criteria
 * - get_test: Get complete details for a single test
 * - compare_tests: Compare multiple tests side-by-side
 * - list_vendors: List all vendors in a category
 * - list_cancer_types: List cancer types in a category
 * - get_coverage: Get insurance coverage details
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  mrdTestData,
  ecdTestData,
  trmTestData,
  tdsTestData,
  hctTestData,
} from "../src/data.js";

// ============================================
// RATE LIMITING (same as chat.js)
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
// CONFIGURATION
// ============================================
const ALLOWED_MODELS = {
  'claude-haiku-4-5-20251001': true,
  'claude-sonnet-4-5-20250929': true
};
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS_LIMIT = 4096;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 10;

const VALID_CATEGORIES = ['mrd', 'ecd', 'trm', 'tds', 'hct', 'all'];
const VALID_PERSONAS = ['patient', 'medical', 'rnd'];

// ============================================
// TOOL DEFINITIONS
// ============================================
const tools = [
  {
    name: "search_tests",
    description: "Search and filter tests by category and criteria. Returns summary info for matching tests.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["mrd", "ecd", "trm", "tds", "hct"],
          description: "Test category"
        },
        vendor: {
          type: "string",
          description: "Filter by vendor name (partial match, case-insensitive)"
        },
        cancer_type: {
          type: "string",
          description: "Filter by cancer type (partial match)"
        },
        approach: {
          type: "string",
          description: "For MRD: 'Tumor-informed' or 'Tumor-naive'"
        },
        min_sensitivity: {
          type: "number",
          description: "Minimum sensitivity %"
        },
        fda_status: {
          type: "string",
          description: "Filter by FDA status (partial match)"
        },
        limit: {
          type: "integer",
          default: 10,
          description: "Max results to return"
        }
      },
      required: ["category"]
    }
  },
  {
    name: "get_test",
    description: "Get complete details for a single test by ID. Use this after search_tests to get full information.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Test ID like 'mrd-1', 'ecd-5', 'tds-3'"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "compare_tests",
    description: "Compare multiple tests side-by-side on specific metrics. Returns a comparison table.",
    input_schema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of test IDs to compare (e.g., ['mrd-1', 'mrd-7'])"
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Metrics to compare: name, vendor, sensitivity, specificity, lod, fdaStatus, reimbursement, initialTat, followUpTat, price, approach, method, cancerTypes"
        }
      },
      required: ["ids"]
    }
  },
  {
    name: "list_vendors",
    description: "List all vendors offering tests in a category with test counts.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["mrd", "ecd", "trm", "tds", "hct"],
          description: "Test category"
        }
      }
    }
  },
  {
    name: "list_cancer_types",
    description: "List cancer types covered by tests in a category.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["mrd", "ecd", "trm", "tds", "hct"],
          description: "Test category"
        }
      }
    }
  },
  {
    name: "get_coverage",
    description: "Get insurance coverage details for a test including Medicare, private payers, and patient guidance.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Test ID"
        }
      },
      required: ["id"]
    }
  }
];

// ============================================
// DATA ACCESS HELPERS
// ============================================

/**
 * Get tests array for a category
 */
function getTestsForCategory(category) {
  const categoryMap = {
    mrd: mrdTestData,
    ecd: ecdTestData,
    trm: trmTestData,
    tds: tdsTestData,
    hct: hctTestData,
  };
  return categoryMap[category?.toLowerCase()] || [];
}

/**
 * Get all tests across all categories
 */
function getAllTests() {
  return [
    ...mrdTestData,
    ...ecdTestData,
    ...trmTestData,
    ...tdsTestData,
    ...hctTestData,
  ];
}

/**
 * Find a test by ID across all categories
 */
function findTestById(id) {
  if (!id) return null;
  const normalizedId = id.toLowerCase();
  const allTests = getAllTests();
  return allTests.find(t => t.id?.toLowerCase() === normalizedId) || null;
}

// ============================================
// TOOL EXECUTION FUNCTIONS
// ============================================

/**
 * Search and filter tests
 */
function executeSearchTests(args) {
  const { category, vendor, cancer_type, approach, min_sensitivity, fda_status, limit = 10 } = args;

  let tests = getTestsForCategory(category);

  // Apply filters
  if (vendor) {
    const vendorLower = vendor.toLowerCase();
    tests = tests.filter(t => t.vendor?.toLowerCase().includes(vendorLower));
  }

  if (cancer_type) {
    const cancerLower = cancer_type.toLowerCase();
    tests = tests.filter(t => {
      const types = t.cancerTypes || [];
      return types.some(ct => ct.toLowerCase().includes(cancerLower));
    });
  }

  if (approach) {
    const approachLower = approach.toLowerCase();
    tests = tests.filter(t => t.approach?.toLowerCase().includes(approachLower));
  }

  if (min_sensitivity !== undefined && min_sensitivity !== null) {
    tests = tests.filter(t =>
      typeof t.sensitivity === 'number' && t.sensitivity >= min_sensitivity
    );
  }

  if (fda_status) {
    const fdaLower = fda_status.toLowerCase();
    tests = tests.filter(t => t.fdaStatus?.toLowerCase().includes(fdaLower));
  }

  // Limit results
  const limitedTests = tests.slice(0, Math.min(limit, 25));

  // Return summary info
  return {
    totalMatches: tests.length,
    returned: limitedTests.length,
    tests: limitedTests.map(t => ({
      id: t.id,
      name: t.name,
      vendor: t.vendor,
      approach: t.approach,
      sensitivity: t.sensitivity,
      specificity: t.specificity,
      fdaStatus: t.fdaStatus,
      reimbursement: t.reimbursement,
      cancerTypes: t.cancerTypes?.slice(0, 5),
      price: t.price || t.listPrice || null,
    }))
  };
}

/**
 * Get full test details
 */
function executeGetTest(args) {
  const { id } = args;
  const test = findTestById(id);

  if (!test) {
    return { error: `Test not found: ${id}` };
  }

  return {
    found: true,
    test: test
  };
}

/**
 * Compare multiple tests
 */
function executeCompareTests(args) {
  const { ids, metrics } = args;

  if (!ids || !Array.isArray(ids)) {
    return { error: 'ids array is required', tests: [] };
  }

  if (ids.length === 0) {
    return { error: "No test IDs provided" };
  }

  if (ids.length > 6) {
    return { error: "Maximum 6 tests can be compared at once" };
  }

  // Default metrics if not specified
  const compareMetrics = metrics && metrics.length > 0 ? metrics : [
    'name', 'vendor', 'sensitivity', 'specificity', 'lod',
    'fdaStatus', 'reimbursement', 'approach'
  ];

  const tests = ids.map(id => {
    const test = findTestById(id);
    if (!test) {
      return { id, error: `Not found` };
    }

    const comparison = { id };
    for (const metric of compareMetrics) {
      if (metric === 'cancerTypes') {
        comparison[metric] = test.cancerTypes?.join(', ') || 'N/A';
      } else {
        comparison[metric] = test[metric] ?? 'N/A';
      }
    }
    return comparison;
  });

  return {
    metrics: compareMetrics,
    tests: tests
  };
}

/**
 * List vendors in a category
 */
function executeListVendors(args) {
  const { category } = args;

  const tests = category ? getTestsForCategory(category) : getAllTests();

  // Count tests per vendor
  const vendorCounts = {};
  for (const test of tests) {
    if (test.vendor) {
      vendorCounts[test.vendor] = (vendorCounts[test.vendor] || 0) + 1;
    }
  }

  // Sort by count descending
  const vendors = Object.entries(vendorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, testCount: count }));

  return {
    category: category || 'all',
    totalVendors: vendors.length,
    vendors: vendors
  };
}

/**
 * List cancer types in a category
 */
function executeListCancerTypes(args) {
  const { category } = args;

  const tests = category ? getTestsForCategory(category) : getAllTests();

  // Collect unique cancer types
  const cancerTypeCounts = {};
  for (const test of tests) {
    const types = test.cancerTypes || [];
    for (const ct of types) {
      cancerTypeCounts[ct] = (cancerTypeCounts[ct] || 0) + 1;
    }
  }

  // Sort alphabetically
  const cancerTypes = Object.entries(cancerTypeCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, testCount: count }));

  return {
    category: category || 'all',
    totalTypes: cancerTypes.length,
    cancerTypes: cancerTypes
  };
}

/**
 * Get coverage information for a test
 */
function executeGetCoverage(args) {
  const { id } = args;
  const test = findTestById(id);

  if (!test) {
    return { error: `Test not found: ${id}` };
  }

  // Build coverage response
  const coverage = {
    testId: test.id,
    testName: test.name,
    vendor: test.vendor,
    reimbursement: test.reimbursement || 'Unknown',
    reimbursementNote: test.reimbursementNote || null,
    fdaStatus: test.fdaStatus || 'Unknown',
    cptCodes: test.cptCodes || null,
  };

  // Include detailed coverage cross-reference if available
  if (test.coverageCrossReference) {
    coverage.coverageCrossReference = test.coverageCrossReference;
  }

  // Include Medicare coverage if available
  if (test.medicareCoverage) {
    coverage.medicareCoverage = test.medicareCoverage;
  }

  return coverage;
}

/**
 * Execute a tool call and return the result
 */
function executeToolCall(toolName, toolInput) {
  switch (toolName) {
    case 'search_tests':
      return executeSearchTests(toolInput);
    case 'get_test':
      return executeGetTest(toolInput);
    case 'compare_tests':
      return executeCompareTests(toolInput);
    case 'list_vendors':
      return executeListVendors(toolInput);
    case 'list_cancer_types':
      return executeListCancerTypes(toolInput);
    case 'get_coverage':
      return executeGetCoverage(toolInput);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============================================
// SYSTEM PROMPT
// ============================================
const systemPrompt = `You are the OpenOnco assistant, helping users understand oncology diagnostic tests including MRD (Minimal Residual Disease), ECD (Early Cancer Detection), TRM (Treatment Response Monitoring), TDS (Treatment Decision Support), and HCT (Hereditary Cancer Testing).

You have access to tools to search and retrieve test information from the OpenOnco database. Always use these tools to get current data rather than relying on memory.

## How to use your tools:

1. **search_tests**: Start here when users ask about tests in a category. Filter by vendor, cancer type, approach, sensitivity, or FDA status.

2. **get_test**: Use this to get complete details for a specific test after identifying it via search.

3. **compare_tests**: When users want to compare tests, use this to generate side-by-side comparisons.

4. **list_vendors**: Show all vendors offering tests in a category.

5. **list_cancer_types**: Show what cancer types are covered in a category.

6. **get_coverage**: Get detailed insurance coverage information including Medicare, private payers, and patient assistance.

## Response guidelines:

- Format test IDs as [[test-id]] so the frontend can render clickable links (e.g., "Signatera [[mrd-7]] is a tumor-informed test...")
- Use markdown tables for comparisons
- Be concise: 3-5 sentences for simple queries, more for detailed comparisons
- If data is unavailable, acknowledge it honestly
- For clinical questions, remind users to consult their healthcare provider
- When discussing coverage, note that actual costs vary by insurance plan

## Category quick reference:
- **MRD**: Post-treatment monitoring for minimal residual disease (recurrence detection)
- **ECD**: Early cancer detection/screening tests
- **TRM**: Treatment response monitoring during active therapy
- **TDS**: Treatment decision support (CGP/companion diagnostics for therapy selection)
- **HCT**: Hereditary cancer testing (germline genetics)

## Important distinctions:
- **Tumor-informed** tests require a baseline tumor sample to identify patient-specific variants
- **Tumor-naive** tests use fixed panels without requiring tumor tissue
- **Central Lab Service** tests can be ordered by clinicians (send-out)
- **Laboratory IVD Kit** products are purchased by labs to run internally

Be helpful, accurate, and guide users to the information they need.`;

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
    if (!msg.role || msg.content === undefined) {
      return { valid: false, error: `Message ${i} missing role or content` };
    }
    if (!['user', 'assistant'].includes(msg.role)) {
      return { valid: false, error: `Message ${i} has invalid role` };
    }
    // Content can be string or array (for tool results)
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
      messages: inputMessages,
      category,
      persona,
      model: requestedModel,
    } = req.body;

    // Validate messages
    const msgValidation = validateMessages(inputMessages);
    if (!msgValidation.valid) {
      return res.status(400).json({ error: msgValidation.error });
    }

    // Validate category (optional, used for context)
    const validatedCategory = VALID_CATEGORIES.includes(category?.toLowerCase())
      ? category.toLowerCase()
      : 'all';

    // Validate persona (optional)
    const validatedPersona = VALID_PERSONAS.includes(persona) ? persona : 'medical';

    // Sanitize model
    const model = ALLOWED_MODELS[requestedModel] ? requestedModel : DEFAULT_MODEL;

    // Build context-aware system prompt
    let contextualSystemPrompt = systemPrompt;
    if (validatedCategory !== 'all') {
      contextualSystemPrompt += `\n\nThe user is currently browsing the ${validatedCategory.toUpperCase()} category.`;
    }
    if (validatedPersona === 'patient') {
      contextualSystemPrompt += `\n\nThe user is a patient. Use accessible language, avoid jargon, and be empathetic.`;
    } else if (validatedPersona === 'rnd') {
      contextualSystemPrompt += `\n\nThe user is a researcher or industry professional. You can use technical terminology.`;
    }

    // Initialize Anthropic client
    const client = new Anthropic({ apiKey });

    // Clone messages for the conversation
    let messages = [...inputMessages];

    // Tool use loop
    let iterations = 0;
    let response;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Make API call
      response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS_LIMIT,
        system: contextualSystemPrompt,
        messages,
        tools,
      });

      // Check if we need to handle tool use
      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

      if (toolUseBlocks.length === 0) {
        break;
      }

      // Execute each tool call
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        try {
          const result = executeToolCall(toolUse.name, toolUse.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result, null, 2),
          });
        } catch (toolError) {
          console.error(`Tool execution error (${toolUse.name}):`, toolError);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: `Tool execution failed: ${toolError.message}` }),
            is_error: true,
          });
        }
      }

      // Add assistant's response and tool results to messages
      messages.push({
        role: 'assistant',
        content: response.content,
      });
      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    // Check if we hit the iteration limit
    if (iterations >= MAX_TOOL_ITERATIONS) {
      console.warn('Hit maximum tool iterations');
    }

    // Extract text content from final response
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Return response in format compatible with chat.js
    return res.status(200).json({
      id: response.id,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: textContent }],
      model: response.model,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });

  } catch (error) {
    console.error('Chat v2 API error:', error.message);

    if (error.status === 429) {
      return res.status(429).json({ error: 'Service temporarily unavailable' });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Invalid request',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'An error occurred',
      message: error.message,
      type: error.constructor.name
    });
  }
}
