import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['tests/**/*.test.js'],

    // Enable globals (describe, it, expect) without imports
    globals: true,

    // Environment for tests
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/index.js'],
    },

    // Timeout for tests (ms)
    testTimeout: 10000,

    // Root directory
    root: '.',
  },
});
