import { useEffect, useRef } from 'react';

export default function SettingsPanel({
  open,
  onClose,
  strongThreshold,
  moderateThreshold,
  onChangeStrong,
  onChangeModerate,
  dataMode,
  onChangeDataMode,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const handleStrong = (e) => {
    const v = Number(e.target.value);
    if (v > 0 && v <= 100 && v > moderateThreshold) onChangeStrong(v);
  };

  const handleModerate = (e) => {
    const v = Number(e.target.value);
    if (v > 0 && v <= 100 && v < strongThreshold) onChangeModerate(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        ref={ref}
        className="bg-white border border-gray-200 rounded-xl shadow-lg px-5 py-4 w-[340px] max-w-[90vw]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Data mode toggle */}
        <div className="mb-4">
          <div className="text-xs text-gray-500 font-medium mb-2">Sensitivity data</div>
          <div className="flex gap-2">
            {[
              { value: 'early', label: 'Stage I-II (early)' },
              { value: 'all', label: 'All stages' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChangeDataMode(opt.value)}
                className={`flex-1 text-xs py-2 rounded-lg border transition-all ${
                  dataMode === opt.value
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-medium'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
            {dataMode === 'early'
              ? 'Showing Stage I-II sensitivity — detection rates for early-stage cancers where treatment is most effective.'
              : 'Showing all-stage sensitivity — detection rates across all cancer stages (I-IV). Higher numbers but less relevant for early detection.'}
          </p>
        </div>

        {/* Threshold controls */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 font-medium mb-2">Color thresholds</div>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4aba4a] shrink-0" />
              Strong detection &gt;
              <input
                type="number"
                min="1"
                max="100"
                value={strongThreshold}
                onChange={handleStrong}
                className="w-14 px-1.5 py-0.5 border border-gray-200 rounded text-xs text-gray-700 text-center"
              />
              %
            </label>
            <label className="text-xs text-gray-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF9F27] shrink-0" />
              Moderate detection &ge;
              <input
                type="number"
                min="1"
                max="100"
                value={moderateThreshold}
                onChange={handleModerate}
                className="w-14 px-1.5 py-0.5 border border-gray-200 rounded text-xs text-gray-700 text-center"
              />
              %
            </label>
          </div>
        </div>

        <p className="text-[10px] text-gray-300 leading-relaxed">
          Thresholds are for visualization only and do not represent clinical guidelines.
        </p>
      </div>
    </div>
  );
}
