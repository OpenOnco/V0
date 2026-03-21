import { SMOKING_CANCERS } from '../data/smokingCancers';

export default function SmokingToggle({ on, onToggle }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
        Lifestyle
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={onToggle}
          className={`text-xs px-3.5 py-1.5 rounded-2xl border transition-all select-none ${
            on
              ? 'bg-amber-100 text-amber-800 border-amber-400'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
          }`}
        >
          Smoker / former smoker
        </button>
      </div>
      {on && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {SMOKING_CANCERS.map((c) => (
            <span
              key={c}
              className="text-[11px] px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
