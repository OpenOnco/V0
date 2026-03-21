export default function Legend() {
  return (
    <div className="flex gap-4 mt-5 pt-3 border-t border-gray-200">
      {[
        { color: '#4aba4a', label: 'Strong detection' },
        { color: '#EF9F27', label: 'Moderate' },
        { color: '#E24B4A', label: 'Limited or not tested' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
        </div>
      ))}
    </div>
  );
}
