import { getScreeningsForSex } from '../../data/screeningMap';

export default function ScreeningStep({ form, onChange }) {
  const screenings = getScreeningsForSex(form.sex);

  const toggle = (key) => {
    const next = form.screenings.includes(key)
      ? form.screenings.filter((s) => s !== key)
      : [...form.screenings, key];
    onChange('screenings', next);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Current screenings
      </h2>
      <p className="text-slate-600 mb-6">
        Check any standard screenings you are up to date on. Cancer types
        without standard screening will be noted in your discussion guide.
      </p>

      <div className="flex flex-col gap-3">
        {screenings.map((s) => (
          <label
            key={s.key}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              form.screenings.includes(s.key)
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={form.screenings.includes(s.key)}
              onChange={() => toggle(s.key)}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-700">{s.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
