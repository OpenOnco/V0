/**
 * Claude API client for triage system
 * Handles API calls with retry logic and exponential backoff
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

let client = null;

/**
 * Initialize or return existing Anthropic client
 */
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function getBackoffDelay(attempt) {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return exponentialDelay + jitter;
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error) {
  // Retry on rate limits (429) and server errors (5xx)
  if (error.status === 429) return true;
  if (error.status >= 500 && error.status < 600) return true;
  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
  return false;
}

/**
 * Call Claude API with retry logic
 *
 * @param {string} systemPrompt - System prompt for Claude
 * @param {string} userPrompt - User message/prompt
 * @param {Object} options - Optional configuration
 * @param {number} options.maxTokens - Maximum tokens in response (default: 4096)
 * @param {number} options.temperature - Temperature for sampling (default: 0)
 * @param {number} options.maxRetries - Override max retries (default: 3)
 * @returns {Promise<{content: string, usage: {inputTokens: number, outputTokens: number}}>}
 */
export async function callClaude(systemPrompt, userPrompt, options = {}) {
  const {
    maxTokens = 4096,
    temperature = 0,
    maxRetries = MAX_RETRIES
  } = options;

  const anthropic = getClient();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      });

      // Extract text content from response
      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
      };
    } catch (error) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't sleep after last attempt
      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt);
        console.warn(`Claude API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, error.message);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw new Error(`Claude API call failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}

/**
 * Strip markdown code fences from Claude's response
 * Handles ```json, ```, and variations with whitespace
 */
function stripMarkdownCodeFences(text) {
  return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

/**
 * Parse JSON from Claude's response, handling markdown code blocks
 */
export function parseJsonResponse(content) {
  // Try to extract JSON from markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? stripMarkdownCodeFences(jsonMatch[0]) : content.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error.message}\nContent: ${content.substring(0, 500)}`);
  }
}

export default {
  callClaude,
  parseJsonResponse
};
