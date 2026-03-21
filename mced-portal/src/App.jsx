import { useState, useMemo } from 'react';
import { SENSITIVITY_TIERS } from './data/thresholds';
import { MALE_EXCLUDE, FEMALE_EXCLUDE } from './data/genderExclusions';
import { sortDefault, sortBySelection } from './logic/sortTests';
import { useFilters } from './hooks/useFilters';
import { useTestData } from './hooks/useTestData';
import GenderToggle from './components/GenderToggle';
import FamilyDropdown from './components/FamilyDropdown';
import SmokingToggle from './components/SmokingToggle';
import ScreeningGaps from './components/ScreeningGaps';
import TestCard from './components/TestCard';
import Legend from './components/Legend';
import Methodology from './components/Methodology';
import ResetButton from './components/ResetButton';
import SettingsPanel from './components/SettingsPanel';

export default function App() {
  const { tests, source } = useTestData();
  const {
    sex, setSex,
    famEntries, addFamily, removeFamily,
    smokeOn, toggleSmoke,
    gapSet, toggleGap,
    resetAll,
    selectedCancers,
  } = useFilters();

  const [strongThreshold, setStrongThreshold] = useState(SENSITIVITY_TIERS.GOOD);
  const [moderateThreshold, setModerateThreshold] = useState(SENSITIVITY_TIERS.OK);

  const thresholds = useMemo(
    () => ({ strong: strongThreshold, moderate: moderateThreshold }),
    [strongThreshold, moderateThreshold]
  );

  // Build detectable cancers list from current test data
  const detectableCancers = useMemo(() => {
    const detectable = new Set();
    tests.forEach((t) => Object.keys(t.cancers).forEach((c) => detectable.add(c)));
    return [...detectable].sort();
  }, [tests]);

  // Mom is female → exclude male-only cancers; Dad is male → exclude female-only cancers
  const momCancers = useMemo(
    () => detectableCancers.filter((c) => !FEMALE_EXCLUDE.includes(c)),
    [detectableCancers]
  );
  const dadCancers = useMemo(
    () => detectableCancers.filter((c) => !MALE_EXCLUDE.includes(c)),
    [detectableCancers]
  );

  const sorted = useMemo(() => {
    if (selectedCancers.length > 0) {
      return sortBySelection(tests, selectedCancers);
    }
    return sortDefault(tests);
  }, [tests, selectedCancers]);

  return (
    <div className="max-w-[640px] mx-auto px-5 py-5 relative">
      <h1 className="text-lg font-medium text-gray-900 mb-1">MCED Early-Stage Sensitivity Data</h1>
      <p className="text-[13px] text-gray-400 mb-1">
        Published per-cancer detection rates across multi-cancer screening tests
      </p>
      <a
        href="https://openonco.org"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-gray-300 underline hover:text-gray-500 transition-colors"
      >
        openonco.org
      </a>
      <p className="text-[11px] text-gray-300 mb-4 mt-1">
        All sensitivity values are Stage I-II (early detection) from published clinical studies.
      </p>

      <SettingsPanel
        strongThreshold={strongThreshold}
        moderateThreshold={moderateThreshold}
        onChangeStrong={setStrongThreshold}
        onChangeModerate={setModerateThreshold}
      />

      <GenderToggle sex={sex} onSelect={setSex} />

      {sex && (
        <>
          <div className="mb-4">
            <FamilyDropdown
              label="Family cancer history (mom's side)"
              side="mom"
              cancers={momCancers}
              entries={famEntries}
              onAdd={addFamily}
              onRemove={removeFamily}
            />
            <FamilyDropdown
              label="Family cancer history (dad's side)"
              side="dad"
              cancers={dadCancers}
              entries={famEntries}
              onAdd={addFamily}
              onRemove={removeFamily}
            />
          </div>

          <SmokingToggle on={smokeOn} onToggle={toggleSmoke} />
          <ScreeningGaps sex={sex} gapSet={gapSet} onToggle={toggleGap} />
          <ResetButton onReset={resetAll} />
        </>
      )}

      <div className="flex flex-col gap-2.5 mt-5">
        {sorted.map((t) => (
          <TestCard key={t.name} test={t} selectedCancers={selectedCancers} thresholds={thresholds} />
        ))}
      </div>

      <Legend source={source} />
      <Methodology tests={tests} />
    </div>
  );
}
