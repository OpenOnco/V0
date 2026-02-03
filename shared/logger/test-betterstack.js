#!/usr/bin/env node
/**
 * Test script for Betterstack integration
 *
 * Usage: node test-betterstack.js
 *
 * Reads configuration from .env file in this directory
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log('Loaded .env file\n');
} catch (err) {
  console.warn('No .env file found, using environment variables\n');
}

// Now import and test the logger
const { createLogger, flushAll } = await import('./index.js');

console.log('Configuration:');
console.log('  BETTERSTACK_TOKEN:', process.env.BETTERSTACK_TOKEN ? '****' + process.env.BETTERSTACK_TOKEN.slice(-4) : 'not set');
console.log('  BETTERSTACK_ENDPOINT:', process.env.BETTERSTACK_ENDPOINT || 'not set');
console.log('  LOG_TRANSPORT:', process.env.LOG_TRANSPORT || 'default');
console.log('  LOG_LEVEL:', process.env.LOG_LEVEL || 'default');
console.log('');

const logger = createLogger('test:betterstack', { project: 'openonco' });

console.log('Sending test logs...\n');

logger.info('Test INFO log from OpenOnco', {
  test: true,
  source: 'test-betterstack.js'
});

logger.warn('Test WARN log', { severity: 'medium' });

logger.error('Test ERROR log', {
  error: { message: 'Simulated error', code: 'TEST_ERR' }
});

// Wait for async transport
console.log('Waiting for transport...');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('Flushing...');
await flushAll();

console.log('\nDone! Check your Betterstack dashboard.');
