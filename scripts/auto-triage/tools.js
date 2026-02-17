/**
 * Tool definitions and handlers for auto-triage Claude calls.
 *
 * Three tools:
 * - web_search: Anthropic built-in (type: web_search_20250305), no handler needed
 * - read_data_js: Search data.js for a query, return matching lines with context
 * - record_decision: Capture the structured triage decision
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_JS_PATH = resolve(__dirname, '../../src/data.js');

// Cache data.js content (read once per process)
let dataJsLines = null;

function getDataJsLines() {
  if (!dataJsLines) {
    dataJsLines = readFileSync(DATA_JS_PATH, 'utf-8').split('\n');
  }
  return dataJsLines;
}

/**
 * Tool definitions to send to the Claude API
 */
export const TOOL_DEFINITIONS = [
  // Anthropic built-in web search (server-side tool)
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5,
  },
  // Custom: search data.js
  {
    name: 'read_data_js',
    description: 'Search the OpenOnco data.js file for a query string. Returns matching lines with surrounding context. Use this to check if data already exists in the database, find test IDs, or verify current field values.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text to search for in data.js (case-insensitive). Examples: "Signatera", "mrd-7", "commercialPayers", "Blue Shield"',
        },
      },
      required: ['query'],
    },
  },
  // Custom: record the triage decision
  {
    name: 'record_decision',
    description: 'Record your triage decision for this submission. You MUST call this exactly once to complete the triage.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['APPROVE', 'IGNORE', 'ESCALATE'],
          description: 'The triage decision',
        },
        reason: {
          type: 'string',
          description: 'Brief explanation of why this decision was made (1-2 sentences)',
        },
        research_summary: {
          type: 'string',
          description: 'Summary of what your research found (2-4 sentences)',
        },
        changes: {
          type: 'array',
          description: 'Array of change operations to apply (only for APPROVE). Each object must have an "op" field.',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: ['add_commercial_payer', 'add_non_coverage', 'update_field', 'add_coverage_cross_ref', 'add_changelog'],
              },
            },
            required: ['op'],
          },
        },
      },
      required: ['action', 'reason', 'research_summary'],
    },
  },
];

/**
 * Handle a tool call from Claude. Returns the tool result content.
 * Returns null for web_search (handled by API) and record_decision (terminal).
 */
export function handleToolCall(toolName, toolInput) {
  switch (toolName) {
    case 'read_data_js':
      return handleReadDataJs(toolInput);
    case 'record_decision':
      // Terminal tool — caller extracts the decision from toolInput
      return null;
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Search data.js for a query string, return matching lines with context
 */
function handleReadDataJs({ query }) {
  const lines = getDataJsLines();
  const queryLower = query.toLowerCase();
  const matches = [];
  const contextLines = 30;
  const maxMatches = 3;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(queryLower)) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);

      // Check for overlap with previous match
      if (matches.length > 0) {
        const prev = matches[matches.length - 1];
        if (start <= prev.end) {
          // Extend previous match
          prev.end = end;
          prev.matchLines.push(i + 1);
          continue;
        }
      }

      matches.push({ start, end, matchLines: [i + 1] });
      if (matches.length >= maxMatches) break;
    }
  }

  if (matches.length === 0) {
    return `No matches found for "${query}" in data.js`;
  }

  let result = `Found ${matches.length} match(es) for "${query}":\n\n`;
  for (const match of matches) {
    result += `--- Lines ${match.start + 1}-${match.end + 1} (match at line(s) ${match.matchLines.join(', ')}) ---\n`;
    for (let i = match.start; i <= match.end; i++) {
      const marker = match.matchLines.includes(i + 1) ? '>>>' : '   ';
      result += `${marker} ${i + 1}: ${lines[i]}\n`;
    }
    result += '\n';
  }

  return result;
}

/**
 * Reset the data.js cache (for testing or after applier modifies the file)
 */
export function resetDataJsCache() {
  dataJsLines = null;
}
