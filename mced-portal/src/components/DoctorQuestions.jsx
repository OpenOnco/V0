const QUESTIONS = [
  'Based on my family history, do you think MCED testing would be appropriate for me?',
  'Are there standard screening tests I should prioritize first?',
  'How would you follow up on a positive MCED result?',
  'Are there any reasons MCED testing might not be right for me?',
  'Would you recommend one of these tests over another for my situation?',
];

export default function DoctorQuestions() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 mt-8">
      <h3 className="font-semibold text-slate-900 mb-3">
        Questions to ask your doctor
      </h3>
      <ul className="space-y-2">
        {QUESTIONS.map((q, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            <span className="text-blue-500 font-medium flex-shrink-0">{i + 1}.</span>
            <span>{q}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
