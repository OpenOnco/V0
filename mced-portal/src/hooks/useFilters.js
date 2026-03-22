import { useState, useCallback, useMemo } from 'react';
import { SMOKING_CANCERS } from '../data/smokingCancers';
import { GENETIC_MAPPINGS } from '../data/geneticMappings';
import { GENETIC_MALE_EXCLUDE, GENETIC_FEMALE_EXCLUDE } from '../data/genderExclusions';

export function useFilters() {
  const [sex, setSexState] = useState(null);
  const [famEntries, setFamEntries] = useState([]); // [{cancer, side}]
  const [smokeOn, setSmokeOn] = useState(false);
  const [gapSet, setGapSet] = useState(new Set());
  const [geneticFactors, setGeneticFactors] = useState(new Set());

  const setSex = useCallback((s) => {
    setSexState(s);
    setFamEntries([]);
    setSmokeOn(false);
    setGapSet(new Set());
    setGeneticFactors(new Set());
  }, []);

  const addFamily = useCallback((cancer, side) => {
    setFamEntries((prev) => {
      if (prev.some((e) => e.cancer === cancer && e.side === side)) return prev;
      return [...prev, { cancer, side }];
    });
  }, []);

  const removeFamily = useCallback((idx) => {
    setFamEntries((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const toggleSmoke = useCallback(() => {
    setSmokeOn((prev) => !prev);
  }, []);

  const toggleGap = useCallback((cancer) => {
    setGapSet((prev) => {
      const next = new Set(prev);
      if (next.has(cancer)) next.delete(cancer);
      else next.add(cancer);
      return next;
    });
  }, []);

  const toggleGenetic = useCallback((id) => {
    setGeneticFactors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setSexState(null);
    setFamEntries([]);
    setSmokeOn(false);
    setGapSet(new Set());
    setGeneticFactors(new Set());
  }, []);

  const selectedCancers = useMemo(() => {
    const s = new Set();
    famEntries.forEach((e) => s.add(e.cancer));
    gapSet.forEach((c) => s.add(c));
    if (smokeOn) SMOKING_CANCERS.forEach((c) => s.add(c));
    const geneticExclude = sex === 'male' ? GENETIC_MALE_EXCLUDE
      : sex === 'female' ? GENETIC_FEMALE_EXCLUDE : [];
    geneticFactors.forEach((id) => {
      const mapping = GENETIC_MAPPINGS[id];
      if (mapping) mapping.cancers
        .filter((c) => !geneticExclude.includes(c))
        .forEach((c) => s.add(c));
    });
    return Array.from(s);
  }, [famEntries, gapSet, smokeOn, geneticFactors, sex]);

  return {
    sex,
    setSex,
    famEntries,
    addFamily,
    removeFamily,
    smokeOn,
    toggleSmoke,
    gapSet,
    toggleGap,
    geneticFactors,
    toggleGenetic,
    resetAll,
    selectedCancers,
  };
}
