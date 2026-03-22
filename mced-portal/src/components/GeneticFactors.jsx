import { GENETIC_MAPPINGS } from '../data/geneticMappings';
import { GENETIC_MALE_EXCLUDE, GENETIC_FEMALE_EXCLUDE } from '../data/genderExclusions';

export default function GeneticFactors({ activeFactors, onToggle, sex }) {
  const exclude = sex === 'male' ? GENETIC_MALE_EXCLUDE
    : sex === 'female' ? GENETIC_FEMALE_EXCLUDE : [];

  // Deduplicated cancers across all active factors, filtered by sex
  const addedCancers = [...new Set(
    [...activeFactors].flatMap((id) => GENETIC_MAPPINGS[id]?.cancers || [])
  )].filter((c) => !exclude.includes(c)).sort();

  return (
    <div className="mb-4">
      <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
        Genetic risk factors
      </div>
      <div className="text-[11px] text-gray-400 mb-1.5">
        If you've had genetic testing, select any known results
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(GENETIC_MAPPINGS).map(([id, { label }]) => (
          <button
            key={id}
            onClick={() => onToggle(id)}
            className={`text-xs px-3.5 py-1.5 rounded-2xl border transition-all select-none ${
              activeFactors.has(id)
                ? 'bg-pink-100 text-pink-800 border-pink-300'
                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {addedCancers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {addedCancers.map((c) => (
            <span
              key={c}
              className="text-[11px] px-2.5 py-1 rounded-xl"
              style={{ backgroundColor: '#FCE7F3', color: '#9D174D' }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
