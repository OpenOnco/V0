import AgeStep from './steps/AgeStep';
import SexStep from './steps/SexStep';
import CancerHistoryStep from './steps/CancerHistoryStep';
import FamilyHistoryStep from './steps/FamilyHistoryStep';
import SmokingStep from './steps/SmokingStep';
import ScreeningStep from './steps/ScreeningStep';

export default function IntakeForm({ form, step, totalSteps, onUpdate, onNext, onBack, onSubmit }) {
  const steps = [
    <AgeStep value={form.age} onChange={onUpdate} />,
    <SexStep value={form.sex} onChange={onUpdate} />,
    <CancerHistoryStep form={form} onChange={onUpdate} onNext={onNext} />,
    <FamilyHistoryStep value={form.familyHistory} onChange={onUpdate} />,
    <SmokingStep value={form.smokingStatus} onChange={onUpdate} />,
    <ScreeningStep form={form} onChange={onUpdate} />,
  ];

  const canAdvance = () => {
    switch (step) {
      case 0:
        return form.age !== '';
      case 1:
        return form.sex !== '';
      case 2:
        return !form.personalCancerDiagnosis || form.continueAfterDiagnosis;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const isLastStep = step === totalSteps - 1;

  return (
    <div className="max-w-xl mx-auto">
      {/* Intro text — visible on first step */}
      {step === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 leading-relaxed">
            This tool helps you prepare for a conversation with your doctor about
            multi-cancer early detection (MCED) blood tests. All MCED tests
            require a physician&apos;s order.
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Step {step + 1} of {totalSteps}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Current step */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          disabled={step === 0}
          className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        <button
          onClick={isLastStep ? onSubmit : onNext}
          disabled={!canAdvance()}
          className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLastStep ? 'Build Discussion Guide' : 'Next'}
        </button>
      </div>
    </div>
  );
}
