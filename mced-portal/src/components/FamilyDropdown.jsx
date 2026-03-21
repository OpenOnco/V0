import { useRef, useCallback } from 'react';

export default function FamilyDropdown({ label, side, cancers, entries, onAdd, onRemove }) {
  const selectRef = useRef(null);
  const addingRef = useRef(false);

  const handleChange = useCallback(() => {
    if (addingRef.current) return;
    const val = selectRef.current.value;
    if (!val) return;
    addingRef.current = true;
    onAdd(val, side);
    selectRef.current.value = '';
    addingRef.current = false;
  }, [onAdd, side]);

  const sideEntries = entries.filter((e) => e.side === side);

  return (
    <div className="mb-3.5">
      <div className="text-xs text-gray-500 font-medium mb-1.5">{label}</div>
      <select
        ref={selectRef}
        onChange={handleChange}
        className="w-full text-[13px] py-2 px-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-300"
      >
        <option value="">Select cancer type...</option>
        {cancers.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {sideEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {entries.map((e, i) =>
            e.side === side ? (
              <button
                key={`${e.cancer}-${i}`}
                onClick={() => onRemove(i)}
                className="text-[11px] px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
              >
                {e.cancer}
                <span className="text-sm leading-none opacity-50">&times;</span>
              </button>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
