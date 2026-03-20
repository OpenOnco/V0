const AGE_RANGES = [
  '40-44',
  '45-49',
  '50-54',
  '55-59',
  '60-64',
  '65-69',
  '70-74',
  '75-79',
  '80+',
];

export default function AgeStep({ value, onChange }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">What is your age?</h2>
      <p className="text-slate-600 mb-6">
        Most MCED tests are designed for adults 45 and older. Your doctor can
        help determine if testing is appropriate for you.
      </p>
      <select
        value={value}
        onChange={(e) => onChange('age', e.target.value)}
        className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        aria-label="Age range"
      >
        <option value="">Select your age range</option>
        {AGE_RANGES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
