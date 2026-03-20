export default function SexStep({ value, onChange }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Sex assigned at birth
      </h2>
      <p className="text-slate-600 mb-6">
        This determines which standard screening tests apply to you.
      </p>
      <div className="flex gap-3">
        {['male', 'female'].map((sex) => (
          <button
            key={sex}
            onClick={() => onChange('sex', sex)}
            className={`flex-1 p-4 rounded-lg border-2 text-center font-medium capitalize transition-colors ${
              value === sex
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            {sex}
          </button>
        ))}
      </div>
    </div>
  );
}
