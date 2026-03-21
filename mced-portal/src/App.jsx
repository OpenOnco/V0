import { useMemo } from 'react';
import { TESTS } from './data/tests';
import { MALE_EXCLUDE, FEMALE_EXCLUDE } from './data/genderExclusions';
import { getDetectableCancers } from './logic/getDetectableCancers';
import { sortDefault, sortBySelection } from './logic/sortTests';
import { useFilters } from './hooks/useFilters';
import GenderToggle from './components/GenderToggle';
import FamilyDropdown from './components/FamilyDropdown';
import SmokingToggle from './components/SmokingToggle';
import ScreeningGaps from './components/ScreeningGaps';
import TestCard from './components/TestCard';
import Legend from './components/Legend';
import Methodology from './components/Methodology';
import ResetButton from './components/ResetButton';

const detectableCancers = getDetectableCancers();

export default function App() {
  const {
    sex, setSex,
    famEntries, addFamily, removeFamily,
    smokeOn, toggleSmoke,
    gapSet, toggleGap,
    resetAll,
    selectedCancers,
  } = useFilters();

  // Mom is female → exclude male-only cancers; Dad is male → exclude female-only cancers
  const momCancers = useMemo(
    () => detectableCancers.filter((c) => !FEMALE_EXCLUDE.includes(c)),
    []
  );
  const dadCancers = useMemo(
    () => detectableCancers.filter((c) => !MALE_EXCLUDE.includes(c)),
    []
  );

  const sorted = useMemo(() => {
    if (selectedCancers.length > 0) {
      return sortBySelection(TESTS, selectedCancers);
    }
    return sortDefault(TESTS);
  }, [selectedCancers]);

  return (
    <div className="max-w-[640px] mx-auto px-5 py-5">
      <h1 className="text-lg font-medium text-gray-900 mb-1">MCED test explorer</h1>
      <p className="text-[13px] text-gray-400 mb-1.5">
        Compare multi-cancer early detection tests. Prepare for your doctor visit.
      </p>
      <p className="text-[11px] text-gray-300 mb-4">
        All sensitivity values are Stage I-II (early detection) from published clinical studies.
      </p>

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
          <TestCard key={t.name} test={t} selectedCancers={selectedCancers} />
        ))}
      </div>

      <Legend />
      <Methodology />
    </div>
  );
}
