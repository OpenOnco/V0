/**
 * Submission schema and validation for the unified triage system.
 *
 * Submissions are annotated crawler discoveries collected into a single
 * weekly file. Each item carries the daemon's cheap Haiku triage hint
 * but nothing is filtered out — Claude Code does the real triage via /triage.
 */

// Confidence buckets for stats
export const CONFIDENCE = {
  HIGH: 'high',     // daemonScore >= 7
  MEDIUM: 'medium', // daemonScore 4-6
  LOW: 'low',       // daemonScore <= 3
};

/**
 * Classify a daemon score into a confidence bucket
 */
export function scoreToConfidence(score) {
  if (score >= 7) return CONFIDENCE.HIGH;
  if (score >= 4) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

/**
 * Submission item statuses
 */
export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  IGNORED: 'ignored',
  ESCALATED: 'escalated', // "ASK ALEX"
};

/**
 * Generate a unique submission ID
 */
export function generateSubmissionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `sub-${new Date().getFullYear()}-${ts}${rand}`;
}

/**
 * Validate a single submission item
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSubmission(item) {
  const errors = [];

  if (!item.submissionId) errors.push('Missing submissionId');
  if (!item.source) errors.push('Missing source');
  if (!item.title) errors.push('Missing title');
  if (!item.triageHint) errors.push('Missing triageHint');
  if (item.triageHint && typeof item.triageHint.daemonScore !== 'number') {
    errors.push('triageHint.daemonScore must be a number');
  }
  if (!item.status) errors.push('Missing status');

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a complete weekly submissions file
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateWeeklyFile(file) {
  const errors = [];

  if (!file.id) errors.push('Missing id');
  if (!file.weekOf) errors.push('Missing weekOf');
  if (!file.generatedAt) errors.push('Missing generatedAt');
  if (!file.crawlSummary) errors.push('Missing crawlSummary');
  if (!Array.isArray(file.submissions)) {
    errors.push('submissions must be an array');
  } else {
    file.submissions.forEach((item, i) => {
      const result = validateSubmission(item);
      if (!result.valid) {
        errors.push(`submissions[${i}]: ${result.errors.join(', ')}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a submission item from a crawler discovery
 */
export function createSubmission(discovery, triageHint = {}) {
  return {
    submissionId: generateSubmissionId(),
    source: discovery.source || 'unknown',
    type: discovery.type || 'unknown',
    title: discovery.title || 'Untitled',
    summary: discovery.summary || '',
    url: discovery.url || '',
    detectedAt: discovery.detectedAt || new Date().toISOString(),
    triageHint: {
      daemonScore: triageHint.daemonScore ?? 5,
      reason: triageHint.reason || '',
      suggestedAction: triageHint.suggestedAction || 'review',
      suggestedTestName: triageHint.suggestedTestName || null,
      confidence: triageHint.confidence ?? 0.5,
    },
    metadata: discovery.metadata || {},
    status: SUBMISSION_STATUS.PENDING,
  };
}
