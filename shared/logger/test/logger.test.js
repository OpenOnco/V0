/**
 * Unit tests for shared logger module
 *
 * Run with: node --test shared/logger/test/
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Store original env values
let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('context utilities', async () => {
  const { getEnvironment, getDefaultLogLevel, shouldPrettyPrint, autoDetectProject } =
    await import('../utils/context.js');

  describe('getEnvironment', () => {
    it('returns test when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.VERCEL;
      assert.strictEqual(getEnvironment(), 'test');
    });

    it('returns production when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      assert.strictEqual(getEnvironment(), 'production');
    });

    it('returns development when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.VERCEL;
      assert.strictEqual(getEnvironment(), 'development');
    });

    it('returns production when on Vercel production', () => {
      delete process.env.NODE_ENV;
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      assert.strictEqual(getEnvironment(), 'production');
    });

    it('returns development when on Vercel preview', () => {
      delete process.env.NODE_ENV;
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'preview';
      assert.strictEqual(getEnvironment(), 'development');
    });
  });

  describe('getDefaultLogLevel', () => {
    it('returns silent in test environment', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.LOG_LEVEL;
      assert.strictEqual(getDefaultLogLevel(), 'silent');
    });

    it('returns info in production environment', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      assert.strictEqual(getDefaultLogLevel(), 'info');
    });

    it('returns debug in development environment', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      assert.strictEqual(getDefaultLogLevel(), 'debug');
    });

    it('respects LOG_LEVEL override', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'warn';
      assert.strictEqual(getDefaultLogLevel(), 'warn');
    });
  });

  describe('shouldPrettyPrint', () => {
    it('returns true in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_PRETTY;
      assert.strictEqual(shouldPrettyPrint(), true);
    });

    it('returns false in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_PRETTY;
      assert.strictEqual(shouldPrettyPrint(), false);
    });

    it('respects LOG_PRETTY=true override', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_PRETTY = 'true';
      assert.strictEqual(shouldPrettyPrint(), true);
    });

    it('respects LOG_PRETTY=false override', () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_PRETTY = 'false';
      assert.strictEqual(shouldPrettyPrint(), false);
    });
  });

  describe('autoDetectProject', () => {
    it('returns OPENONCO_PROJECT env var when set', () => {
      process.env.OPENONCO_PROJECT = 'my-project';
      assert.strictEqual(autoDetectProject(), 'my-project');
      delete process.env.OPENONCO_PROJECT;
    });

    it('detects physician-system from path hint', () => {
      delete process.env.OPENONCO_PROJECT;
      assert.strictEqual(autoDetectProject('/path/to/physician-system/src/file.js'), 'physician-system');
    });

    it('detects test-data-tracker from path hint', () => {
      delete process.env.OPENONCO_PROJECT;
      assert.strictEqual(autoDetectProject('/path/to/test-data-tracker/src/file.js'), 'test-data-tracker');
    });

    it('detects api from path hint', () => {
      delete process.env.OPENONCO_PROJECT;
      assert.strictEqual(autoDetectProject('/api/chat.js'), 'api');
    });

    it('detects frontend from path hint', () => {
      delete process.env.OPENONCO_PROJECT;
      assert.strictEqual(autoDetectProject('/src/components/App.jsx'), 'frontend');
    });

    it('returns unknown when no detection possible', () => {
      delete process.env.OPENONCO_PROJECT;
      assert.strictEqual(autoDetectProject('/some/random/path.js'), 'unknown');
    });
  });
});

describe('error serializer', async () => {
  const { errorSerializer, serializers } = await import('../utils/serializers.js');

  it('serializes basic error properties', () => {
    const error = new Error('Something went wrong');
    const serialized = errorSerializer(error);

    assert.strictEqual(serialized.message, 'Something went wrong');
    assert.strictEqual(serialized.name, 'Error');
    assert.ok(serialized.stack.includes('Something went wrong'));
  });

  it('captures error code if present', () => {
    const error = new Error('File not found');
    error.code = 'ENOENT';
    const serialized = errorSerializer(error);

    assert.strictEqual(serialized.code, 'ENOENT');
  });

  it('captures statusCode if present', () => {
    const error = new Error('Not Found');
    error.statusCode = 404;
    const serialized = errorSerializer(error);

    assert.strictEqual(serialized.statusCode, 404);
  });

  it('captures additional enumerable properties', () => {
    const error = new Error('Validation failed');
    error.field = 'email';
    error.reason = 'invalid format';
    const serialized = errorSerializer(error);

    assert.strictEqual(serialized.field, 'email');
    assert.strictEqual(serialized.reason, 'invalid format');
  });

  it('returns non-error input unchanged', () => {
    assert.strictEqual(errorSerializer('string'), 'string');
    assert.strictEqual(errorSerializer(123), 123);
    assert.strictEqual(errorSerializer(null), null);
  });

  it('exports serializers object with error and err keys', () => {
    assert.strictEqual(serializers.error, errorSerializer);
    assert.strictEqual(serializers.err, errorSerializer);
  });
});
