import { useState, useRef, useEffect } from 'react';

export default function FamilyDropdown({ cancers, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const count = selected.size;

  return (
    <div className="mb-3.5" ref={ref}>
      <div className="text-xs text-gray-500 font-medium mb-0.5">Family cancer history</div>
      <div className="text-[11px] text-gray-400 mb-1.5">(And any other high interest cancers)</div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left text-[13px] py-2 px-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-300 flex items-center justify-between"
      >
        <span className={count ? 'text-gray-700' : 'text-gray-400'}>
          {count ? `${count} cancer type${count > 1 ? 's' : ''} selected` : 'Select cancer types...'}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-[240px] overflow-y-auto">
          {cancers.map((c) => (
            <label
              key={c}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-[13px] text-gray-700"
            >
              <input
                type="checkbox"
                checked={selected.has(c)}
                onChange={() => onToggle(c)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              {c}
            </label>
          ))}
        </div>
      )}

      {count > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {[...selected].sort().map((c) => (
            <button
              key={c}
              onClick={() => onToggle(c)}
              className="text-[11px] px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
            >
              {c}
              <span className="text-sm leading-none opacity-50">&times;</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
