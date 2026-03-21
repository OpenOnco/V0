import { MALE_GAPS, FEMALE_GAPS } from '../data/screeningGaps';

export default function ScreeningGaps({ sex, gapSet, onToggle }) {
  const gaps = sex === 'male' ? MALE_GAPS : FEMALE_GAPS;

  return (
    <div className="mb-4">
      <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
        Screening gaps
      </div>
      <div className="flex flex-wrap gap-1.5">
        {gaps.map((g) => (
          <button
            key={g.cancer}
            onClick={() => onToggle(g.cancer)}
            className={`text-xs px-3.5 py-1.5 rounded-2xl border transition-all select-none ${
              gapSet.has(g.cancer)
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      {gapSet.size > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {[...gapSet].map((c) => (
            <span
              key={c}
              className="text-[11px] px-2.5 py-1 rounded-xl bg-red-100 text-red-800"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
