/**
 * Calculate comparative badges for a set of tests
 * Each test gets badges for parameters where it's "best" in the group
 */

import { MINIMUM_PARAMS } from '../config/testFields';

// Parameter configurations: which direction is "better" and badge label
const PARAM_CONFIG = {
  // Higher is better
  sensitivity: { direction: 'higher', badge: 'Highest Sensitivity' },
  specificity: { direction: 'higher', badge: 'Highest Specificity' },
  numPublications: { direction: 'higher', badge: 'Most Published' },
  totalParticipants: { direction: 'higher', badge: 'Largest Studies' },
  ppv: { direction: 'higher', badge: 'Highest PPV' },
  npv: { direction: 'higher', badge: 'Highest NPV' },

  // Lower is better
  lod: { direction: 'lower', badge: 'Best Detection Limit' },
  initialTat: { direction: 'lower', badge: 'Fastest Results' },
  tat: { direction: 'lower', badge: 'Fastest Results' },

  // Special handling
  fdaStatus: { direction: 'special', badge: 'FDA Cleared' },
  reimbursement: { direction: 'special', badge: 'Medicare Covered' },
};

// Helper to parse LOD values (they can be strings like "0.01%" or "6 ppm")
function parseLodValue(lod) {
  if (!lod) return null;
  const str = String(lod).toLowerCase();
  // Extract numeric part
  const match = str.match(/[\d.]+/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  // Normalize to same unit (rough approximation)
  if (str.includes('ppm')) return num;
  if (str.includes('%')) return num * 10000; // Convert % to ppm-ish
  return num;
}

// Check if FDA status qualifies as "cleared"
function isFdaCleared(status) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('fda approved') || s.includes('fda cleared') || s.includes('pma') || s.includes('510(k)');
}

// Check if has Medicare coverage
function hasMedicareCoverage(reimbursement) {
  if (!reimbursement) return false;
  const r = reimbursement.toLowerCase();
  return r.includes('medicare') && (r.includes('covered') || r.includes('approved') || r.includes('yes'));
}

/**
 * Calculate comparative badges for a set of tests
 * @param {Array} tests - Array of test objects
 * @param {string} category - Category key (mrd, ecd, trm, tds)
 * @returns {Array} - Tests with comparativeBadges property added
 */
export function calculateComparativeBadges(tests, category) {
  // No badges for single test or empty array
  if (!tests || tests.length <= 1) {
    return tests?.map(t => ({ ...t, comparativeBadges: [] })) || [];
  }

  const categoryConfig = MINIMUM_PARAMS[category.toUpperCase()] || {};
  const categoryParams = (categoryConfig.core || []).map(p => p.key);
  const testsWithBadges = tests.map(t => ({ ...t, comparativeBadges: [] }));

  for (const param of categoryParams) {
    const config = PARAM_CONFIG[param];
    if (!config) continue;

    if (config.direction === 'special') {
      // Special handling for FDA status and reimbursement
      if (param === 'fdaStatus') {
        testsWithBadges.forEach(test => {
          if (isFdaCleared(test.fdaStatus)) {
            test.comparativeBadges.push(config.badge);
          }
        });
      } else if (param === 'reimbursement') {
        testsWithBadges.forEach(test => {
          if (hasMedicareCoverage(test.reimbursement)) {
            test.comparativeBadges.push(config.badge);
          }
        });
      }
    } else {
      // Numeric comparison
      let values = testsWithBadges.map(test => {
        let val = test[param];
        if (param === 'lod' || param === 'lod95') {
          val = parseLodValue(val);
        }
        return { test, value: typeof val === 'number' ? val : parseFloat(val) };
      }).filter(v => !isNaN(v.value) && v.value !== null);

      if (values.length < 2) continue; // Need at least 2 tests with this param

      // Find best value
      const bestValue = config.direction === 'higher'
        ? Math.max(...values.map(v => v.value))
        : Math.min(...values.map(v => v.value));

      // Award badge to all tests with the best value (handles ties)
      values.forEach(({ test, value }) => {
        if (value === bestValue) {
          test.comparativeBadges.push(config.badge);
        }
      });
    }
  }

  return testsWithBadges;
}

export default calculateComparativeBadges;
