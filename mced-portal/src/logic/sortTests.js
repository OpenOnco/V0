import { buildTrafficLight } from './buildTrafficLight';

/**
 * Sort tests by traffic light performance:
 * 1. Most green dots (descending)
 * 2. Most amber dots (descending)
 * 3. Fewest red dots (ascending)
 * 4. Fewest no-data (ascending)
 * 5. Tests without any cancerTypeSensitivity → bottom
 */
export function sortTests(tests, concernCancers, screeningGaps) {
  const allCancers = [...concernCancers, ...screeningGaps];

  return [...tests]
    .map((test) => {
      const trafficLight = buildTrafficLight(test, concernCancers, screeningGaps);
      const allRows = [...trafficLight.concernRows, ...trafficLight.gapRows];

      const count = (tier) => allRows.filter((r) => r.tier === tier).length;

      return {
        test,
        trafficLight,
        greenCount: count('good'),
        amberCount: count('ok'),
        redCount: count('bad'),
        noDataCount: count('no-data'),
        hasData: trafficLight.hasAnySensitivityData,
      };
    })
    .sort((a, b) => {
      // Tests without data always sort to bottom
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;

      // Most greens first
      if (b.greenCount !== a.greenCount) return b.greenCount - a.greenCount;

      // Most ambers (tiebreak)
      if (b.amberCount !== a.amberCount) return b.amberCount - a.amberCount;

      // Fewest reds
      if (a.redCount !== b.redCount) return a.redCount - b.redCount;

      // Fewest no-data
      if (a.noDataCount !== b.noDataCount) return a.noDataCount - b.noDataCount;

      // Final tiebreak: more total cancer types detected
      return (
        (b.test.detectedCancerTypes?.length || 0) -
        (a.test.detectedCancerTypes?.length || 0)
      );
    });
}

/**
 * Fallback sort when user has no concerns and no gaps:
 * sort by total detectedCancerTypes count descending.
 */
export function sortByTotalCancers(tests) {
  return [...tests].sort(
    (a, b) =>
      (b.detectedCancerTypes?.length || 0) -
      (a.detectedCancerTypes?.length || 0)
  );
}
