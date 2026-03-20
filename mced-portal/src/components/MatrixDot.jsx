const TIER_STYLES = {
  good: { bg: '#5DCA5D', label: 'Good detection (>50%)' },
  ok: { bg: '#EF9F27', label: 'Moderate detection (25–50%)' },
  bad: { bg: '#E24B4A', label: 'Limited detection (≤25%)' },
  'no-data': { bg: '#CBD5E1', label: 'No data available' },
};

export default function MatrixDot({ tier, sensitivity, sampleSize, cancer, onShowTooltip }) {
  const style = TIER_STYLES[tier];

  return (
    <button
      className="flex flex-col items-center gap-0.5 w-full cursor-pointer group"
      onClick={(e) => onShowTooltip?.({ tier, sensitivity, sampleSize, cancer }, e)}
      aria-label={`${cancer}: ${sensitivity != null ? `${sensitivity}% sensitivity` : 'no data'}`}
    >
      <span
        className="w-3.5 h-3.5 rounded-full flex-shrink-0 group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-slate-300 transition-shadow"
        style={{ backgroundColor: style.bg }}
      />
      <span className="text-[10px] text-slate-500 tabular-nums leading-tight">
        {sensitivity != null ? `${sensitivity}%` : '—'}
      </span>
    </button>
  );
}

export { TIER_STYLES };
