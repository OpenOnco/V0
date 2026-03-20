import { useEffect, useRef } from 'react';
import { TIER_STYLES } from './MatrixDot';

export default function MatrixTooltip({ data, position, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (!data) return null;

  const { tier, sensitivity, sampleSize, cancer } = data;
  const style = TIER_STYLES[tier];

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm max-w-xs"
      style={{ top: position.y + 8, left: position.x - 80 }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: style.bg }}
        />
        <span className="font-semibold text-slate-900">{cancer}</span>
      </div>
      {sensitivity != null ? (
        <div className="space-y-0.5 text-slate-600">
          <p>Sensitivity: <span className="font-medium text-slate-800">{sensitivity}%</span></p>
          {sampleSize != null && <p>Sample size: n={sampleSize}</p>}
          <p>Stage: all-stage</p>
        </div>
      ) : (
        <p className="text-slate-500 italic">
          This test does not publish sensitivity data for {cancer}.
        </p>
      )}
    </div>
  );
}
