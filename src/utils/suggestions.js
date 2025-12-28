// ============================================
// Smart Comparison Suggestions
// ============================================
export const getSuggestedTests = (selectedTestIds, allTests, maxSuggestions = 6) => {
  if (selectedTestIds.length === 0) return [];

  const selectedTests = allTests.filter(t => selectedTestIds.includes(t.id));
  const unselectedTests = allTests.filter(t => !selectedTestIds.includes(t.id));

  // Collect attributes from selected tests
  const selectedIndicationGroups = new Set(selectedTests.map(t => t.indicationGroup).filter(Boolean));
  const selectedCancerTypes = new Set(selectedTests.flatMap(t => t.cancerTypes || []));
  const selectedApproaches = new Set(selectedTests.map(t => t.approach).filter(Boolean));
  const selectedTestScopes = new Set(selectedTests.map(t => t.testScope).filter(Boolean));

  // Score each unselected test
  const scored = unselectedTests.map(test => {
    let score = 0;
    let matchReason = '';

    // Highest priority: Same indication group (e.g., CRC → CRC)
    if (test.indicationGroup && selectedIndicationGroups.has(test.indicationGroup)) {
      score += 100;
      matchReason = `${test.indicationGroup} tests`;
    }

    // High priority: Overlapping cancer types
    const testCancerTypes = test.cancerTypes || [];
    const overlappingCancers = testCancerTypes.filter(ct => selectedCancerTypes.has(ct));
    if (overlappingCancers.length > 0) {
      score += 30 * overlappingCancers.length;
      if (!matchReason) {
        const shortName = overlappingCancers[0].length > 15
          ? overlappingCancers[0].slice(0, 15) + '...'
          : overlappingCancers[0];
        matchReason = `${shortName}`;
      }
    }

    // Medium priority: Same test scope (single-cancer vs multi-cancer)
    if (test.testScope && selectedTestScopes.has(test.testScope)) {
      score += 20;
      if (!matchReason) matchReason = test.testScope;
    }

    // Lower priority: Same approach (tumor-informed vs tumor-naïve)
    if (test.approach && selectedApproaches.has(test.approach)) {
      score += 10;
      if (!matchReason) matchReason = test.approach;
    }

    return { test, score, matchReason };
  });

  // Sort by score and return top suggestions
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
};
