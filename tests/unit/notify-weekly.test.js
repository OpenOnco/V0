import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notifyWeeklySummary, notifyWatchdogAlert } from '../../evidence/scripts/notify.js';

describe('notifyWeeklySummary', () => {
  let fetchSpy;
  let capturedArgs;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EVIDENCE_NOTIFY_EMAIL = 'test@example.com';

    capturedArgs = null;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
      capturedArgs = { url, opts };
      return {
        ok: true,
        json: async () => ({ id: 'test-id' }),
        text: async () => '{}',
      };
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.RESEND_API_KEY;
    delete process.env.EVIDENCE_NOTIFY_EMAIL;
  });

  it('status "changes_merged" — subject contains "changes merged", HTML has changes and flagged items', async () => {
    const summary = {
      date: '2026-04-07',
      status: 'changes_merged',
      commitHash: 'abc1234567890',
      sections: [
        {
          name: 'NCCN Guidelines',
          changes: ['Updated Colon Cancer v2.2026'],
          flagged: ['Review new MRD recommendation'],
        },
      ],
    };

    const result = await notifyWeeklySummary(summary);
    expect(result).toEqual({ id: 'test-id' });

    const body = JSON.parse(capturedArgs.opts.body);
    expect(body.subject).toContain('changes merged');
    expect(body.html).toContain('Updated Colon Cancer v2.2026');
    expect(body.html).toContain('Review new MRD recommendation');
  });

  it('status "no_changes" — subject contains "no changes", HTML has no-changes message', async () => {
    const summary = {
      date: '2026-04-07',
      status: 'no_changes',
      sections: [],
    };

    const result = await notifyWeeklySummary(summary);
    expect(result).toEqual({ id: 'test-id' });

    const body = JSON.parse(capturedArgs.opts.body);
    expect(body.subject).toContain('no changes');
    expect(body.html).toContain('No changes found across all checks');
  });

  it('status "tests_failed" — subject contains "TESTS FAILED", HTML has test failure block', async () => {
    const summary = {
      date: '2026-04-07',
      status: 'tests_failed',
      testOutput: 'Error: assertion failed in smoke-test.js',
      sections: [],
    };

    const result = await notifyWeeklySummary(summary);
    expect(result).toEqual({ id: 'test-id' });

    const body = JSON.parse(capturedArgs.opts.body);
    expect(body.subject).toContain('TESTS FAILED');
    expect(body.html).toContain('Smoke tests failed');
    expect(body.html).toContain('assertion failed in smoke-test.js');
  });
});

describe('notifyWatchdogAlert', () => {
  let fetchSpy;
  let capturedArgs;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EVIDENCE_NOTIFY_EMAIL = 'test@example.com';

    capturedArgs = null;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
      capturedArgs = { url, opts };
      return {
        ok: true,
        json: async () => ({ id: 'test-id' }),
        text: async () => '{}',
      };
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.RESEND_API_KEY;
    delete process.env.EVIDENCE_NOTIFY_EMAIL;
  });

  it('subject contains "ALERT", HTML has watchdog alert content', async () => {
    const info = {
      date: '2026-04-07',
      lastCommitDate: '2026-04-05',
      details: 'Trigger did not fire on schedule',
    };

    const result = await notifyWatchdogAlert(info);
    expect(result).toEqual({ id: 'test-id' });

    const body = JSON.parse(capturedArgs.opts.body);
    expect(body.subject).toContain('ALERT');
    expect(body.html).toContain('did not send a summary email');
    expect(body.html).toContain('2026-04-05');
    expect(body.html).toContain('Trigger did not fire on schedule');
  });
});
