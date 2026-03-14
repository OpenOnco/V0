/**
 * FAQ Diff — Compare old vs new FAQ answers and generate a changelog
 *
 * Used to determine which answers actually changed and why,
 * so only meaningful updates get committed.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('faq-diff');

/**
 * Compare two FAQ data objects and return a list of changes
 * @param {object} oldData - Previous PHYSICIAN_FAQ_DATA
 * @param {object} newData - Newly generated PHYSICIAN_FAQ_DATA
 * @returns {{ changes: Array, unchanged: Array, summary: string }}
 */
export function diffFAQData(oldData, newData) {
  const changes = [];
  const unchanged = [];

  for (const [cancerType, concerns] of Object.entries(newData)) {
    if (cancerType === '_default') continue; // default is manually maintained

    const oldConcerns = oldData[cancerType] || {};

    for (const [concernId, newAnswer] of Object.entries(concerns)) {
      const oldAnswer = oldConcerns[concernId];

      if (!oldAnswer) {
        changes.push({
          cancerType,
          concernId,
          type: 'added',
          reason: 'New cancer type or concern',
        });
        continue;
      }

      const diff = diffAnswer(oldAnswer, newAnswer);
      if (diff.changed) {
        changes.push({
          cancerType,
          concernId,
          type: 'updated',
          reason: diff.reason,
          details: diff.details,
        });
      } else {
        unchanged.push({ cancerType, concernId });
      }
    }
  }

  const summary = buildSummary(changes, unchanged);
  return { changes, unchanged, summary };
}

/**
 * Compare individual answers
 */
function diffAnswer(oldAnswer, newAnswer) {
  const details = [];

  // Check if sources changed (new evidence)
  const oldPmids = (oldAnswer.sources || []).map(s => s.pmid || s.url).sort().join(',');
  const newPmids = (newAnswer.sources || []).map(s => s.pmid || s.url).sort().join(',');
  if (oldPmids !== newPmids) {
    details.push('Sources updated');
  }

  // Check if guidelines changed
  if (normalize(oldAnswer.guidelines) !== normalize(newAnswer.guidelines)) {
    details.push('Guideline status updated');
  }

  // Check if doctor-facing text materially changed (>15% different)
  const oldDoc = normalize(oldAnswer.forDoctor);
  const newDoc = normalize(newAnswer.forDoctor);
  if (oldDoc !== newDoc) {
    const similarity = jaccardSimilarity(oldDoc, newDoc);
    if (similarity < 0.85) {
      details.push(`Clinical evidence rewritten (${Math.round((1 - similarity) * 100)}% different)`);
    }
  }

  // Check if patient text materially changed
  const oldPat = normalize(oldAnswer.forPatient);
  const newPat = normalize(newAnswer.forPatient);
  if (oldPat !== newPat) {
    const similarity = jaccardSimilarity(oldPat, newPat);
    if (similarity < 0.85) {
      details.push('Patient-facing answer updated');
    }
  }

  // Check stage notes
  const oldStages = JSON.stringify(oldAnswer.stageNotes || {});
  const newStages = JSON.stringify(newAnswer.stageNotes || {});
  if (oldStages !== newStages) {
    details.push('Stage-specific notes updated');
  }

  return {
    changed: details.length > 0,
    reason: details.join('; '),
    details,
  };
}

function normalize(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Jaccard similarity on word sets — quick proxy for text similarity
 */
function jaccardSimilarity(a, b) {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

function buildSummary(changes, unchanged) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lines = [`FAQ Refresh — ${date}`];

  if (changes.length === 0) {
    lines.push('No material changes detected. FAQ answers remain current.');
    return lines.join('\n');
  }

  lines.push(`${changes.length} answer(s) updated, ${unchanged.length} unchanged.\n`);

  for (const change of changes) {
    lines.push(`- ${change.cancerType}/${change.concernId}: ${change.reason}`);
  }

  return lines.join('\n');
}

export default { diffFAQData };
