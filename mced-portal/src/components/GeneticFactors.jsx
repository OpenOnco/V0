import { useState, useRef, useEffect } from 'react';
import { GENETIC_MAPPINGS } from '../data/geneticMappings';
import { GENETIC_MALE_EXCLUDE, GENETIC_FEMALE_EXCLUDE } from '../data/genderExclusions';

export default function GeneticFactors({ activeFactors, onToggle, sex }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const exclude = sex === 'male' ? GENETIC_MALE_EXCLUDE
    : sex === 'female' ? GENETIC_FEMALE_EXCLUDE : [];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeEntries = [...activeFactors]
    .map((id) => ({ id, label: GENETIC_MAPPINGS[id]?.label }))
    .filter((entry) => entry.label)
    .sort((a, b) => a.label.localeCompare(b.label));

  const addedCancers = [...new Set(
    activeEntries.flatMap(({ id }) => GENETIC_MAPPINGS[id]?.cancers || [])
  )]
    .filter((c) => !exclude.includes(c))
    .sort();

  return (
    <div className="mb-4" ref={ref}>
      <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
        Genetic risk factors
      </div>
      <div className="text-[11px] text-gray-400 mb-1.5">
        If you've had genetic testing, select any known results
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left text-[13px] py-2 px-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-300 flex items-center justify-between"
      >
        <span className={activeEntries.length ? 'text-gray-700' : 'text-gray-400'}>
          {activeEntries.length
            ? `${activeEntries.length} genetic result${activeEntries.length > 1 ? 's' : ''} selected`
            : 'Select genetic results...'}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-[240px] overflow-y-auto">
          {Object.entries(GENETIC_MAPPINGS).map(([id, { label }]) => (
            <label
              key={id}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-[13px] text-gray-700"
            >
              <input
                type="checkbox"
                checked={activeFactors.has(id)}
                onChange={() => onToggle(id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {activeEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {activeEntries.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onToggle(id)}
              className="text-[11px] px-2.5 py-1 rounded-xl bg-pink-100 text-pink-800 inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
            >
              {label}
              <span className="text-sm leading-none opacity-50">&times;</span>
            </button>
          ))}
        </div>
      )}
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
