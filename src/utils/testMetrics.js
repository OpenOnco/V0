import { TIER1_FIELDS, MINIMUM_PARAMS } from '../config/testFields';

// Calculate Tier 1 citation metrics for all test data
export const calculateTier1Metrics = (allTestData) => {
  let totalDataPoints = 0;
  let citedDataPoints = 0;

  allTestData.forEach(test => {
    TIER1_FIELDS.forEach(field => {
      const value = test[field];
      // Check if field has a non-null, non-empty value
      if (value != null && value !== '' && value !== 'N/A') {
        totalDataPoints++;
        // Check if corresponding citation field exists and has value
        const citationField = `${field}Citations`;
        const citation = test[citationField];
        if (citation && citation.trim() !== '') {
          citedDataPoints++;
        }
      }
    });
  });

  const coverage = totalDataPoints > 0 ? (citedDataPoints / totalDataPoints * 100) : 0;

  return {
    totalTier1DataPoints: totalDataPoints,
    citedDataPoints: citedDataPoints,
    citationCoverage: coverage.toFixed(1)
  };
};

// ============================================
// Category Quality Metrics Calculator
// ============================================
export const calculateCategoryMetrics = (tests, category) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!tests || tests.length === 0) return null;

  const minFields = minParams?.core?.map(p => p.key) || [];
  const allFields = tests.length > 0 ? Object.keys(tests[0]) : [];
  const dataFields = allFields.filter(f => !f.endsWith('Citations') && !f.endsWith('Citation') && !f.endsWith('Notes') && f !== 'id');

  const hasVal = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';
  const hasCite = (val) => val && String(val).trim() !== '' && val !== 'N/A';

  const minFieldCompletion = tests.map(test => {
    const filled = minFields.filter(field => hasVal(test[field])).length;
    return { test: test.name, filled, total: minFields.length, complete: filled === minFields.length };
  });

  const testsWithAllMinFields = minFieldCompletion.filter(t => t.complete).length;

  let totalFieldSlots = 0, filledFieldSlots = 0;
  tests.forEach(test => {
    dataFields.forEach(field => {
      totalFieldSlots++;
      if (hasVal(test[field])) filledFieldSlots++;
    });
  });

  let tier1DataPoints = 0, tier1Cited = 0;
  tests.forEach(test => {
    TIER1_FIELDS.forEach(field => {
      const value = test[field];
      if (value != null && value !== '' && value !== 'N/A') {
        tier1DataPoints++;
        const citationField = `${field}Citations`;
        if (hasCite(test[citationField])) tier1Cited++;
      }
    });
  });

  const fieldCompletionRates = minFields.map(field => {
    const filled = tests.filter(t => hasVal(t[field])).length;
    const citationField = `${field}Citations`;
    const cited = tests.filter(t => hasCite(t[citationField])).length;
    return {
      field,
      label: minParams.core.find(p => p.key === field)?.label || field,
      filled,
      total: tests.length,
      percentage: Math.round((filled / tests.length) * 100),
      cited,
      citedPercentage: filled > 0 ? Math.round((cited / filled) * 100) : 0,
    };
  });

  return {
    testCount: tests.length,
    fieldCount: dataFields.length,
    totalDataPoints: tests.length * dataFields.length,
    filledDataPoints: filledFieldSlots,
    overallFillRate: totalFieldSlots > 0 ? Math.round((filledFieldSlots / totalFieldSlots) * 100) : 0,
    minFieldsRequired: minFields.length,
    testsWithAllMinFields,
    minFieldCompletionRate: Math.round((testsWithAllMinFields / tests.length) * 100),
    tier1DataPoints,
    tier1Cited,
    tier1CitationRate: tier1DataPoints > 0 ? Math.round((tier1Cited / tier1DataPoints) * 100) : 0,
    fieldCompletionRates,
    minFieldCompletion,
  };
};

// ============================================
// Baseline Complete (BC) - Data Completeness Calculation
// ============================================
// NOTE: BC status is awarded to tests that have all minimum required fields filled.
// When reviewing new test submissions, verify they meet BC requirements before adding.

// Calculate completeness score for a single test
export const calculateTestCompleteness = (test, category) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!minParams?.core) return { filled: 0, total: 0, percentage: 0, missingFields: [] };

  const minFields = minParams.core;
  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';

  const filledFields = minFields.filter(p => hasValue(test[p.key]));
  const missingFields = minFields.filter(p => !hasValue(test[p.key]));
  const percentage = minFields.length > 0
    ? Math.round((filledFields.length / minFields.length) * 100)
    : 0;

  return {
    filled: filledFields.length,
    total: minFields.length,
    percentage,
    missingFields: missingFields.map(p => p.label)
  };
};

// Helper function to calculate minimum field completion stats for a category
export const calculateMinimumFieldStats = (tests, category) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!minParams?.core) return { complete: 0, total: tests.length, percentage: 0 };

  const minFields = minParams.core.map(p => p.key);

  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';

  const completeTests = tests.filter(test =>
    minFields.every(field => hasValue(test[field]))
  );

  const percentage = tests.length > 0
    ? Math.round((completeTests.length / tests.length) * 100)
    : 0;

  return {
    complete: completeTests.length,
    total: tests.length,
    percentage
  };
};
