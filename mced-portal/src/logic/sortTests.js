/**
 * Sort tests when no cancers selected:
 * 1. Total cancers in test data (descending)
 * 2. Count of >50% cancers (descending)
 * 3. Alphabetical
 */
export function sortDefault(tests) {
  return [...tests].sort((a, b) => {
    const aTotal = Object.keys(a.cancers).length;
    const bTotal = Object.keys(b.cancers).length;
    if (bTotal !== aTotal) return bTotal - aTotal;

    const aGreens = Object.values(a.cancers).filter((s) => s > 50).length;
    const bGreens = Object.values(b.cancers).filter((s) => s > 50).length;
    if (bGreens !== aGreens) return bGreens - aGreens;

    return a.name.localeCompare(b.name);
  });
}

/**
 * Sort tests when cancers are selected:
 * 1. Tests with any data first
 * 2. Most green dots (descending)
 * 3. Most amber dots (descending)
 * 4. Fewest red dots (ascending)
 * 5. Fewest no-data (ascending)
 */
export function sortBySelection(tests, selectedCancers) {
  return [...tests]
    .map((t) => {
      let g = 0, a = 0, r = 0, nd = 0;
      const hasData = Object.keys(t.cancers).length > 0;
      selectedCancers.forEach((c) => {
        const s = t.cancers[c];
        if (s == null) nd++;
        else if (s > 50) g++;
        else if (s >= 25) a++;
        else r++;
      });
      return { test: t, g, a, r, nd, hasData };
    })
    .sort((x, y) => {
      if (x.hasData !== y.hasData) return x.hasData ? -1 : 1;
      if (y.g !== x.g) return y.g - x.g;
      if (y.a !== x.a) return y.a - x.a;
      if (x.r !== y.r) return x.r - y.r;
      return x.nd - y.nd;
    })
    .map((e) => e.test);
}
