import { useState } from 'react';

export default function SettingsPanel({ strongThreshold, moderateThreshold, onChangeStrong, onChangeModerate }) {
  const [open, setOpen] = useState(false);

  const handleStrong = (e) => {
    const v = Number(e.target.value);
    if (v > 0 && v <= 100 && v > moderateThreshold) onChangeStrong(v);
  };

  const handleModerate = (e) => {
    const v = Number(e.target.value);
    if (v > 0 && v <= 100 && v < strongThreshold) onChangeModerate(v);
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="absolute top-5 right-5 text-gray-300 hover:text-gray-500 transition-colors"
        title="Settings"
        aria-label="Settings"
      >
        <span className="text-base">⚙</span>
      </button>

      {open && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center gap-4 mb-2">
            <label className="text-xs text-gray-500 flex items-center gap-2">
              Strong detection threshold
              <input
                type="number"
                min="1"
                max="100"
                value={strongThreshold}
                onChange={handleStrong}
                className="w-14 px-1.5 py-0.5 border border-gray-200 rounded text-xs text-gray-700 text-center"
              />
              <span className="text-gray-400">%</span>
            </label>
          </div>
          <div className="flex items-center gap-4 mb-2.5">
            <label className="text-xs text-gray-500 flex items-center gap-2">
              Moderate detection threshold
              <input
                type="number"
                min="1"
                max="100"
                value={moderateThreshold}
                onChange={handleModerate}
                className="w-14 px-1.5 py-0.5 border border-gray-200 rounded text-xs text-gray-700 text-center"
              />
              <span className="text-gray-400">%</span>
            </label>
          </div>
          <p className="text-[10px] text-gray-300 leading-relaxed">
            Sensitivity values are from published clinical validation studies.
            Sample sizes and study designs vary between tests.
            See individual test pages for full methodology.
          </p>
        </div>
      )}
    </>
  );
}
