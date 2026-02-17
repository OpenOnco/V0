/**
 * Claude API client for auto-triage.
 * Uses manual agentic loop with web_search built-in tool.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildSubmissionMessage } from './system-prompt.js';
import { TOOL_DEFINITIONS, handleToolCall } from './tools.js';

const MAX_TURNS = 10;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff for 429s

const client = new Anthropic();

/**
 * Triage a single submission item via Claude API.
 * Returns { action, reason, research_summary, changes }
 */
export async function triageItem(item) {
  const messages = [
    { role: 'user', content: buildSubmissionMessage(item) },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await callWithRetry(messages);

    // Check for stop reason
    if (response.stop_reason === 'end_turn') {
      // Claude finished without calling record_decision — treat as escalate
      console.warn(`[${item.submissionId}] Claude ended without record_decision, escalating`);
      return {
        action: 'ESCALATE',
        reason: 'Claude did not call record_decision — auto-escalating',
        research_summary: extractTextFromBlocks(response.content),
        changes: [],
      };
    }

    // Process tool use blocks
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const serverToolBlocks = response.content.filter(b => b.type === 'server_tool_use');

    if (toolUseBlocks.length === 0 && serverToolBlocks.length === 0) {
      // No tool calls and not end_turn — shouldn't happen, but handle gracefully
      console.warn(`[${item.submissionId}] No tool calls on turn ${turn}, stop_reason=${response.stop_reason}`);
      break;
    }

    // Build tool results for the next turn
    const toolResults = [];

    // Handle server tool results (web_search) — results come back inline
    for (const block of serverToolBlocks) {
      // Server tools have their results embedded in the response content
      // We don't need to handle them — they're auto-resolved by the API
    }

    // Handle custom tool calls
    for (const block of toolUseBlocks) {
      if (block.name === 'record_decision') {
        // Terminal tool — extract and return the decision
        const decision = block.input;
        return {
          action: decision.action || 'ESCALATE',
          reason: decision.reason || '',
          research_summary: decision.research_summary || '',
          changes: decision.changes || [],
        };
      }

      // Non-terminal custom tool — execute and continue
      const result = handleToolCall(block.name, block.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }

    // Add assistant message + tool results
    messages.push({ role: 'assistant', content: response.content });
    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }
  }

  // Hit max turns without a decision
  console.warn(`[${item.submissionId}] Hit max turns (${MAX_TURNS}), escalating`);
  return {
    action: 'ESCALATE',
    reason: `Hit max turns (${MAX_TURNS}) without reaching a decision`,
    research_summary: '',
    changes: [],
  };
}

/**
 * Call the Claude API with retry on 429 rate limits
 */
async function callWithRetry(messages) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      });
      return response;
    } catch (error) {
      if (error.status === 429 && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1})`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}

/**
 * Extract text from response content blocks
 */
function extractTextFromBlocks(content) {
  return content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
