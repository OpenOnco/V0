export default function GenderToggle({ sex, onSelect }) {
  return (
    <div className="flex gap-2 mb-4">
      {['male', 'female'].map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`flex-1 text-[13px] py-2.5 text-center rounded-lg border transition-all capitalize ${
            sex === s
              ? 'bg-blue-50 text-blue-700 border-blue-300 font-medium'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
