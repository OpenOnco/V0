import { useState, useMemo, useCallback } from 'react';
import { SENSITIVITY_TIERS } from './data/thresholds';
import { MALE_EXCLUDE, FEMALE_EXCLUDE } from './data/genderExclusions';
import { sortDefault, sortBySelection } from './logic/sortTests';
import { useFilters } from './hooks/useFilters';
import { useTestData } from './hooks/useTestData';
import GenderToggle from './components/GenderToggle';
import FamilyDropdown from './components/FamilyDropdown';
import SmokingToggle from './components/SmokingToggle';
import ScreeningGaps from './components/ScreeningGaps';
import GeneticFactors from './components/GeneticFactors';
import TestCard from './components/TestCard';
import ThresholdLegend from './components/ThresholdLegend';
import Methodology from './components/Methodology';
import ResetButton from './components/ResetButton';

export default function App() {
  const { tests, source } = useTestData();
  const {
    sex, setSex,
    famEntries, addFamily, removeFamily,
    smokeOn, toggleSmoke,
    gapSet, toggleGap,
    geneticFactors, toggleGenetic,
    resetAll,
    selectedCancers,
  } = useFilters();

  const [strongThreshold, setStrongThreshold] = useState(SENSITIVITY_TIERS.GOOD);
  const [moderateThreshold, setModerateThreshold] = useState(SENSITIVITY_TIERS.OK);
  const [dataMode, setDataMode] = useState('early'); // 'early' | 'all'

  const thresholds = useMemo(
    () => ({ strong: strongThreshold, moderate: moderateThreshold }),
    [strongThreshold, moderateThreshold]
  );

  const handleThresholdsChange = useCallback(({ strong, moderate }) => {
    setStrongThreshold(strong);
    setModerateThreshold(moderate);
  }, []);

  // Apply data mode: swap cancers object based on early vs all-stage
  const displayTests = useMemo(() => {
    if (dataMode === 'all') {
      return tests.map((t) => ({
        ...t,
        cancers: Object.keys(t.allStageCancers || {}).length > 0
          ? t.allStageCancers
          : t.cancers, // fallback to early if no all-stage data
      }));
    }
    return tests;
  }, [tests, dataMode]);

  // Build detectable cancers list from current display data
  const detectableCancers = useMemo(() => {
    const detectable = new Set();
    displayTests.forEach((t) => Object.keys(t.cancers).forEach((c) => detectable.add(c)));
    return [...detectable].sort();
  }, [displayTests]);

  const motherCancers = useMemo(
    () => detectableCancers.filter((c) => !FEMALE_EXCLUDE.includes(c)),
    [detectableCancers]
  );
  const fatherCancers = useMemo(
    () => detectableCancers.filter((c) => !MALE_EXCLUDE.includes(c)),
    [detectableCancers]
  );

  const sorted = useMemo(() => {
    if (selectedCancers.length > 0) {
      return sortBySelection(displayTests, selectedCancers);
    }
    return sortDefault(displayTests);
  }, [displayTests, selectedCancers]);

  return (
    <div className="max-w-[640px] mx-auto px-5 py-5 relative">
      <h1 className="text-lg font-medium text-gray-900 mb-1">Cancer Early Detection Test Comparison</h1>
      <p className="text-[13px] text-gray-500 mb-3 leading-relaxed">
        These tests vary widely in their ability to detect different cancers. This
        analyzer gathers some basic family health information to help a user identify
        cancers of interest, and then compares how sensitive each test is for those
        cancers.
      </p>
      <div className="text-[13px] font-medium text-gray-700 mb-2">Start here by selecting gender:</div>
      <GenderToggle sex={sex} onSelect={setSex} />

      {sex && (
        <>
          <div className="mb-4">
            <FamilyDropdown
              label="Family cancer history (mother's side)"
              side="mom"
              cancers={motherCancers}
              entries={famEntries}
              onAdd={addFamily}
              onRemove={removeFamily}
            />
            <FamilyDropdown
              label="Family cancer history (father's side)"
              side="dad"
              cancers={fatherCancers}
              entries={famEntries}
              onAdd={addFamily}
              onRemove={removeFamily}
            />
          </div>

          <SmokingToggle on={smokeOn} onToggle={toggleSmoke} />
          <ScreeningGaps sex={sex} gapSet={gapSet} onToggle={toggleGap} />
          <GeneticFactors activeFactors={geneticFactors} onToggle={toggleGenetic} sex={sex} />
          <ResetButton onReset={resetAll} />
        </>
      )}

      <ThresholdLegend thresholds={thresholds} onThresholdsChange={handleThresholdsChange} />

      <div className="flex flex-col gap-2.5">
        {sorted.map((t) => (
          <TestCard key={t.name} test={t} selectedCancers={selectedCancers} thresholds={thresholds} dataMode={dataMode} />
        ))}
      </div>

      <Methodology tests={displayTests} dataMode={dataMode} onDataModeChange={setDataMode} />
    </div>
  );
}
