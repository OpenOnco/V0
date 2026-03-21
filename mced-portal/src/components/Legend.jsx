export default function Legend({ source }) {
  const isLive = source === 'api';

  return (
    <div className="flex items-center gap-4 mt-5 pt-3 border-t border-gray-200">
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
      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-400">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-300'}`}
        />
        {isLive ? 'Live data from openonco.org' : 'Local data'}
      </div>
    </div>
  );
}
