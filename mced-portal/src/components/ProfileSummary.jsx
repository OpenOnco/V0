import { SMOKING_CANCERS } from '../data/smokingCancers';
import { SCREENING_MAP } from '../data/screeningMap';

export default function ProfileSummary({ form, concerns, gaps, allEqual }) {
  if (allEqual) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-sm">
          You did not select any specific cancer types. All available MCED tests
          are shown below, sorted by number of cancer types detected. Talk to
          your doctor about whether MCED testing is appropriate for you.
        </p>
      </div>
    );
  }

  const hasFamilyHistory = form.familyHistory.length > 0;
  const isSmoker = form.smokingStatus === 'former' || form.smokingStatus === 'current';
  const hasPersonal = form.personalCancerDiagnosis && form.continueAfterDiagnosis && form.personalCancerType;

  const gapDescriptions = [];
  for (const [key, screening] of Object.entries(SCREENING_MAP)) {
    if (screening.sexFilter && screening.sexFilter !== form.sex) continue;
    if (!form.screenings.includes(key)) {
      const label = key === 'colonoscopy'
        ? 'colonoscopy in the last 10 years'
        : key === 'mammogram'
          ? 'mammogram in the last 2 years'
          : 'Pap/HPV test in the last 3–5 years';
      gapDescriptions.push(label);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
        Showing cancer types you selected
      </p>
      <p className="text-sm text-slate-700 leading-relaxed">
        {hasFamilyHistory && (
          <>
            You reported a family history of{' '}
            <span className="font-medium">
              {formatList(form.familyHistory.map((c) => c.toLowerCase() + ' cancer'))}
            </span>
            .{' '}
          </>
        )}

        {hasPersonal && (
          <>
            You reported a personal history of{' '}
            <span className="font-medium">{form.personalCancerType.toLowerCase()} cancer</span>.{' '}
          </>
        )}

        {isSmoker && (
          <>
            As a <span className="font-medium">{form.smokingStatus} smoker</span>,{' '}
            <span className="font-medium">
              {formatList(SMOKING_CANCERS.map((c) => c.toLowerCase()))}
            </span>{' '}
            have been included.{' '}
          </>
        )}

        {gapDescriptions.length > 0 && (
          <>
            You haven&apos;t had a{' '}
            <span className="font-medium">{formatList(gapDescriptions)}</span>.
          </>
        )}
      </p>
    </div>
  );
}

function formatList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}
