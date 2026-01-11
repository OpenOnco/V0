import React, { useState, useRef, useEffect } from 'react';
import { JOURNEY_CONFIG } from '../patient-v2/journeyConfig';
import { calculateComparativeBadges } from '../../utils/comparativeBadges';
import { ComparativeBadgeRow } from '../badges/ComparativeBadge';

// ============================================================================
// Configuration
// ============================================================================

// Get MRD/Watching journey configuration for colors and label
const watchingJourney = JOURNEY_CONFIG.mrd;

// Wizard steps
const WIZARD_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Learn about MRD testing' },
  { id: 'cancer-type', title: 'Cancer Type', description: 'What cancer were you treated for?' },
  { id: 'tumor-tissue', title: 'Tumor Tissue', description: 'Was tumor tissue saved?' },
  { id: 'treatment-status', title: 'Treatment Status', description: 'Where are you in treatment?' },
  { id: 'insurance', title: 'Coverage', description: 'Insurance and costs' },
  { id: 'results', title: 'Results', description: 'Tests that match your situation' },
  { id: 'next-steps', title: 'Next Steps', description: 'What to do now' },
];

// Cancer type options
const CANCER_TYPES = [
  { id: 'colorectal', label: 'Colorectal' },
  { id: 'breast', label: 'Breast' },
  { id: 'lung', label: 'Lung' },
  { id: 'bladder', label: 'Bladder' },
  { id: 'ovarian', label: 'Ovarian' },
  { id: 'prostate', label: 'Prostate' },
  { id: 'pancreatic', label: 'Pancreatic' },
  { id: 'melanoma', label: 'Melanoma' },
  { id: 'multiple-myeloma', label: 'Multiple Myeloma' },
  { id: 'lymphoma', label: 'Lymphoma' },
  { id: 'other-solid', label: 'Other solid tumor' },
];

// Build color scheme from journey config (soft emerald theme)
const colors = {
  bg: watchingJourney.colors.bg,                    // bg-emerald-50
  bgLight: 'bg-emerald-50/50',                      // Soft background with transparency
  bgGradient: 'from-emerald-50/50 to-white',        // Gradient backgrounds
  border: watchingJourney.colors.border,            // border-emerald-200
  borderLight: 'border-emerald-100',                // Lighter border
  accent: watchingJourney.colors.accent,            // bg-emerald-500
  accentHover: 'hover:bg-emerald-600',              // Darker on hover
  accentLight: 'bg-emerald-100',                    // Light emerald for badges
  text: watchingJourney.colors.text,                // text-emerald-700
  textDark: 'text-emerald-900',                     // Darker text
  textLight: 'text-emerald-600',                    // Lighter text
  ring: 'ring-emerald-500',                         // Focus ring color
  focus: 'focus:ring-emerald-500',                  // Focus state
};

// Step content - all strings centralized for easy editing
const CONTENT = {
  welcome: {
    headline: "Confirming You're Cancer-Free",
    afterTreatment: {
      boldText: 'After treatment ends',
      text: ', MRD tests can detect tiny traces of cancer in your blood — confirming treatment worked.',
    },
    earlyDetection: {
      text: 'And if anything ever did show up, these tests typically detect it',
      boldText: 'months before imaging',
      endText: '— giving you and your doctor more options.',
    },
    leadTime: {
      title: 'Up to 15 months lead time',
      description: 'MRD tests can find recurrence much earlier than traditional scans',
    },
    buttonText: "Let's get started",
  },
  cancerType: {
    heading: 'What cancer were you treated for?',
    description: 'This helps us find the most relevant tests for you',
    notSureLabel: "I'm not sure",
    notSureDescription: "That's okay — your oncologist will know. We'll show you broader options.",
  },
  tumorTissue: {
    heading: 'Was tumor tissue saved from your surgery or biopsy?',
    description: 'This determines which types of tests are available to you',
    educationHeading: 'Understanding your options',
    tumorInformed: {
      title: 'Tumor-informed tests',
      description: 'Create a personalized "fingerprint" from your original tumor, then look for that exact fingerprint in your blood. Generally more sensitive.',
    },
    tumorNaive: {
      title: 'Tumor-naive tests',
      description: "Look for common cancer signals without needing your tumor sample. Work when tissue isn't available.",
    },
    options: [
      { id: 'yes', label: 'Yes, tissue was saved', description: 'Enables tumor-informed tests with higher sensitivity' },
      { id: 'no', label: "No / I don't think so", description: 'Tumor-naive tests are still available and effective' },
      { id: 'not-sure', label: "I'm not sure", description: "We'll show you both options — ask your oncologist" },
    ],
  },
  treatmentStatus: {
    heading: 'Where are you in your treatment journey?',
    description: 'This helps us understand the right timing for MRD testing',
    options: [
      { id: 'just-finished', label: 'I just finished treatment', description: 'Main use case for MRD testing', icon: '✓' },
      { id: 'finished-while-ago', label: 'I finished treatment a while ago', description: 'Ongoing surveillance monitoring', icon: '📅' },
      { id: 'between-treatments', label: "I'm between treatments", description: 'Monitoring during treatment gaps', icon: '🔄' },
      { id: 'pre-treatment', label: "I haven't started treatment yet", description: 'MRD testing is typically for post-treatment', icon: '⏳' },
    ],
    preTreatmentWarning: {
      title: 'MRD testing is for post-treatment monitoring',
      get text() {
        return `These tests detect residual cancer after treatment. If you're choosing a treatment path, you might want to explore the "${JOURNEY_CONFIG.tds.label}" journey instead.`;
      },
    },
    continueAnywayLabel: 'Continue anyway',
  },
  insurance: {
    heading: "Let's talk about coverage",
    description: 'This helps us highlight financial assistance options',
    hasInsuranceQuestion: 'Do you have health insurance?',
    insuranceTypeQuestion: 'What type of insurance?',
    insuranceTypes: [
      { id: 'private', label: 'Private' },
      { id: 'medicare', label: 'Medicare' },
      { id: 'medicaid', label: 'Medicaid' },
      { id: 'va', label: 'VA/Military' },
      { id: 'other', label: 'Other' },
    ],
    noInsuranceNote: "Many test providers offer financial assistance programs. We'll highlight those options in your results.",
    costSensitivityQuestion: 'How sensitive are you to out-of-pocket costs?',
    costOptions: [
      { id: 'very-sensitive', label: 'Very sensitive', description: 'I need to minimize costs' },
      { id: 'somewhat-sensitive', label: 'Somewhat sensitive', description: 'I want to understand options' },
      { id: 'not-sensitive', label: 'Not sensitive', description: "Cost isn't a major factor" },
    ],
  },
  results: {
    heading: 'Tests That Match Your Situation',
    description: 'Based on your answers, here are MRD tests to discuss with your oncologist',
    financialNote: {
      boldText: 'Financial assistance may be available.',
      text: "We've highlighted tests with assistance programs based on your cost sensitivity.",
    },
    actions: {
      save: 'Save these results',
      email: 'Email this list',
      print: 'Print for my doctor',
    },
    nextButtonLabel: 'See next steps',
  },
  nextSteps: {
    heading: 'What Now?',
    description: "Here's how to move forward with MRD testing",
    talkToOncologist: {
      title: 'Talk to Your Oncologist',
      description: 'Bring this information to your next appointment. Your oncologist can help determine which test is right for your specific situation, and can order the test directly.',
    },
    questionsTitle: 'Questions to Ask Your Doctor',
    questionsList: [
      'Is MRD testing recommended for my specific cancer type and stage?',
      'Which MRD test would you recommend for me, and why?',
      'Was my tumor tissue saved, and is it available for testing?',
      'How often should I have MRD testing done?',
      'What would a positive or negative result mean for my treatment plan?',
      'Will my insurance cover this test, and are there financial assistance options?',
    ],
    printQuestionsLabel: 'Print These Questions',
    savePrompt: 'Want to save your results and track your MRD testing journey?',
    createAccountLabel: 'Create an Account',
    comingSoonLabel: '(Coming soon)',
    doneLabel: 'Done',
  },
};

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Progress indicator showing step X of 7
 */
function ProgressIndicator({ currentStep, totalSteps }) {
  const percentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="mb-8">
      <div className="flex justify-between text-sm text-slate-600 mb-2">
        <span className="font-medium">Step {currentStep + 1} of {totalSteps}</span>
        <span>{Math.round(percentage)}% complete</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.accent} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Step navigation dots
 */
function StepDots({ steps, currentStep, onStepClick }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = index < currentStep;

        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`
                w-8 h-8 rounded-full flex items-center justify-center
                text-sm font-medium transition-all duration-200
                ${isComplete
                  ? `${colors.accent} text-white cursor-pointer hover:bg-emerald-600`
                  : isCurrent
                    ? `${colors.accentLight} ${colors.text} border-2 border-emerald-500`
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
              aria-label={`Step ${index + 1}: ${step.title}`}
            >
              {isComplete ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                index + 1
              )}
            </button>

            {index < steps.length - 1 && (
              <div
                className={`w-6 h-0.5 ${
                  index < currentStep ? colors.accent : 'bg-slate-200'
                } transition-colors duration-200`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Navigation buttons (Back / Continue)
 */
function NavigationButtons({ onBack, onNext, showBack = true, nextLabel = 'Continue', nextDisabled = false }) {
  return (
    <div className="flex justify-center gap-4 mt-8">
      {showBack && (
        <button
          onClick={onBack}
          className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl
                     hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
        >
          Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className={`px-6 py-3 ${colors.accent} ${colors.accentHover} text-white font-medium rounded-xl
                   transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.focus}
                   disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {nextLabel}
      </button>
    </div>
  );
}

/**
 * Info box component for educational content
 */
function InfoBox({ children, className = '' }) {
  return (
    <div className={`${colors.bg} ${colors.border} border rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Selectable option button
 */
function OptionButton({ selected, onClick, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`
        p-4 border-2 rounded-xl text-left w-full
        transition-all duration-200 ease-in-out
        hover:shadow-md hover:scale-[1.01]
        focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.focus}
        ${selected
          ? `${colors.border} ${colors.bg} ${colors.text}`
          : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Step Components
// ============================================================================

/**
 * Step 1: Welcome & Education
 * Warm introduction to MRD testing with key benefits
 */
function WelcomeStep({ onNext }) {
  const content = CONTENT.welcome;

  return (
    <div className="text-center py-6">
      {/* Icon */}
      <div className={`w-20 h-20 mx-auto mb-6 ${colors.accentLight} rounded-full flex items-center justify-center`}>
        <svg className={`w-10 h-10 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Headline */}
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
        {content.headline}
      </h2>

      {/* Educational content */}
      <div className="max-w-lg mx-auto space-y-4 text-left mb-8">
        <InfoBox>
          <p className="text-slate-700">
            <span className={`font-semibold ${colors.textDark}`}>{content.afterTreatment.boldText}</span>{content.afterTreatment.text}
          </p>
        </InfoBox>

        <InfoBox>
          <p className="text-slate-700">
            {content.earlyDetection.text}{' '}
            <span className={`font-semibold ${colors.textDark}`}>{content.earlyDetection.boldText}</span>{' '}
            {content.earlyDetection.endText}
          </p>
        </InfoBox>

        <div className={`${colors.accentLight} ${colors.border} border rounded-xl p-5 flex items-center gap-4`}>
          <div className={`w-12 h-12 ${colors.accent} rounded-full flex items-center justify-center flex-shrink-0`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className={`font-semibold ${colors.textDark}`}>{content.leadTime.title}</p>
            <p className="text-sm text-slate-600">
              {content.leadTime.description}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onNext}
        className={`px-8 py-4 ${colors.accent} ${colors.accentHover} text-white font-medium rounded-xl
                   transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.focus}`}
      >
        {content.buttonText}
      </button>
    </div>
  );
}

/**
 * Step 2: Cancer Type Selection
 * Grid of clickable cancer type buttons
 */
function CancerTypeStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.cancerType;

  const handleSelect = (cancerType) => {
    setWizardData(prev => ({ ...prev, cancerType }));
    // Auto-advance after selection
    setTimeout(() => onNext(), 300);
  };

  const handleNotSure = () => {
    setWizardData(prev => ({ ...prev, cancerType: 'not-sure' }));
    setTimeout(() => onNext(), 300);
  };

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      {/* Cancer type grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
        {CANCER_TYPES.map((type) => (
          <OptionButton
            key={type.id}
            selected={wizardData.cancerType === type.id}
            onClick={() => handleSelect(type.id)}
            className="text-center"
          >
            <span className="font-medium text-slate-900">{type.label}</span>
          </OptionButton>
        ))}
      </div>

      {/* Not sure option */}
      <div className="max-w-lg mx-auto">
        <button
          onClick={handleNotSure}
          className={`
            w-full p-4 border-2 rounded-xl text-center
            transition-all duration-200
            ${wizardData.cancerType === 'not-sure'
              ? `${colors.border} ${colors.bg}`
              : 'border-dashed border-slate-300 hover:border-slate-400 bg-white'
            }
          `}
        >
          <span className={`font-medium ${wizardData.cancerType === 'not-sure' ? colors.text : 'text-slate-700'}`}>
            {content.notSureLabel}
          </span>
          <p className="text-sm text-slate-500 mt-1">
            {content.notSureDescription}
          </p>
        </button>
      </div>

      <NavigationButtons onBack={onBack} showBack={true} onNext={onNext} nextDisabled={!wizardData.cancerType} />
    </div>
  );
}

/**
 * Step 3: Tumor Tissue Question
 * Explains tumor-informed vs tumor-naive tests
 */
function TumorTissueStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.tumorTissue;

  const handleSelect = (hasTumorTissue) => {
    setWizardData(prev => ({ ...prev, hasTumorTissue }));
    setTimeout(() => onNext(), 300);
  };

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      {/* Educational panel - text only, no button-like elements */}
      <div className="max-w-lg mx-auto mb-8">
        <InfoBox>
          <h3 className={`font-semibold ${colors.textDark} mb-3`}>{content.educationHeading}</h3>

          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">{content.tumorInformed.title}:</span>{' '}
              {content.tumorInformed.description}
            </p>

            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">{content.tumorNaive.title}:</span>{' '}
              {content.tumorNaive.description}
            </p>
          </div>
        </InfoBox>
      </div>

      {/* Options */}
      <div className="max-w-lg mx-auto space-y-3">
        {content.options.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.hasTumorTissue === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <span className="font-medium text-slate-900">{option.label}</span>
            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
          </OptionButton>
        ))}
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.hasTumorTissue} />
    </div>
  );
}

/**
 * Step 4: Treatment Status
 * Where the user is in their treatment journey
 */
function TreatmentStatusStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.treatmentStatus;
  const [showPreTreatmentNote, setShowPreTreatmentNote] = useState(false);

  const handleSelect = (treatmentStatus) => {
    if (treatmentStatus === 'pre-treatment') {
      setShowPreTreatmentNote(true);
      setWizardData(prev => ({ ...prev, treatmentStatus }));
    } else {
      setShowPreTreatmentNote(false);
      setWizardData(prev => ({ ...prev, treatmentStatus }));
      setTimeout(() => onNext(), 300);
    }
  };

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      {/* Options */}
      <div className="max-w-lg mx-auto space-y-3">
        {content.options.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.treatmentStatus === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{option.icon}</span>
              <div>
                <span className="font-medium text-slate-900">{option.label}</span>
                <p className="text-sm text-slate-500 mt-1">{option.description}</p>
              </div>
            </div>
          </OptionButton>
        ))}
      </div>

      {/* Pre-treatment warning */}
      {showPreTreatmentNote && (
        <div className="max-w-lg mx-auto mt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-amber-900">{content.preTreatmentWarning.title}</p>
                <p className="text-sm text-amber-800 mt-1">
                  {content.preTreatmentWarning.text}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <NavigationButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!wizardData.treatmentStatus}
        nextLabel={wizardData.treatmentStatus === 'pre-treatment' ? content.continueAnywayLabel : 'Continue'}
      />
    </div>
  );
}

/**
 * Step 5: Insurance & Cost Sensitivity
 * Coverage and cost preferences
 */
function InsuranceStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.insurance;

  const handleInsuranceChange = (hasInsurance) => {
    setWizardData(prev => ({
      ...prev,
      hasInsurance,
      insuranceType: hasInsurance ? prev.insuranceType : null
    }));
  };

  const handleInsuranceTypeChange = (insuranceType) => {
    setWizardData(prev => ({ ...prev, insuranceType }));
  };

  const handleCostSensitivityChange = (costSensitivity) => {
    setWizardData(prev => ({ ...prev, costSensitivity }));
  };

  const isComplete = wizardData.hasInsurance !== undefined &&
    (wizardData.hasInsurance === false || wizardData.insuranceType) &&
    wizardData.costSensitivity;

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      <div className="max-w-lg mx-auto space-y-8">
        {/* Insurance question */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">{content.hasInsuranceQuestion}</h3>
          <div className="flex gap-3">
            <button
              onClick={() => handleInsuranceChange(true)}
              className={`
                flex-1 py-3 px-4 border-2 rounded-xl font-medium transition-all
                ${wizardData.hasInsurance === true
                  ? `${colors.border} ${colors.bg} ${colors.text}`
                  : 'border-slate-200 hover:border-emerald-300'
                }
              `}
            >
              Yes
            </button>
            <button
              onClick={() => handleInsuranceChange(false)}
              className={`
                flex-1 py-3 px-4 border-2 rounded-xl font-medium transition-all
                ${wizardData.hasInsurance === false
                  ? `${colors.border} ${colors.bg} ${colors.text}`
                  : 'border-slate-200 hover:border-emerald-300'
                }
              `}
            >
              No
            </button>
          </div>

          {/* Insurance type follow-up */}
          {wizardData.hasInsurance === true && (
            <div className="mt-4">
              <p className="text-sm text-slate-600 mb-2">{content.insuranceTypeQuestion}</p>
              <div className="flex flex-wrap gap-2">
                {content.insuranceTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleInsuranceTypeChange(type.id)}
                    className={`
                      py-2 px-4 border-2 rounded-lg text-sm font-medium transition-all
                      ${wizardData.insuranceType === type.id
                        ? `${colors.border} ${colors.bg} ${colors.text}`
                        : 'border-slate-200 hover:border-emerald-300'
                      }
                    `}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No insurance note */}
          {wizardData.hasInsurance === false && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800">
                  {content.noInsuranceNote}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cost sensitivity question */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">{content.costSensitivityQuestion}</h3>
          <div className="space-y-2">
            {content.costOptions.map((option) => (
              <OptionButton
                key={option.id}
                selected={wizardData.costSensitivity === option.id}
                onClick={() => handleCostSensitivityChange(option.id)}
              >
                <span className="font-medium text-slate-900">{option.label}</span>
                <span className="text-slate-500 ml-2">— {option.description}</span>
              </OptionButton>
            ))}
          </div>
        </div>
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!isComplete} />
    </div>
  );
}

/**
 * Step 6: Results
 * Shows matching tests based on selections
 */
function ResultsStep({ wizardData, testData, onNext, onBack }) {
  const content = CONTENT.results;

  // Get cancer type label for display
  const getCancerLabel = (id) => {
    const type = CANCER_TYPES.find(t => t.id === id);
    return type?.label || 'your cancer type';
  };

  // Check if a test has financial assistance programs
  const checkFinancialAssistance = (test) => {
    const reimbursement = (test.reimbursement || '').toLowerCase();
    const reimbursementNote = (test.reimbursementNote || '').toLowerCase();
    const combined = reimbursement + ' ' + reimbursementNote;
    
    return (
      combined.includes('$0') ||
      combined.includes('financial assist') ||
      combined.includes('patient assist') ||
      combined.includes('copay assist') ||
      combined.includes('no out-of-pocket') ||
      combined.includes('compassionate') ||
      combined.includes('indigent')
    );
  };

  // Filter and match tests based on wizard data
  const getMatchingTests = () => {
    // If testData is provided and has items, filter it
    if (testData && testData.length > 0) {
      return testData
        .filter(test => {
          // Filter by tumor tissue requirement
          if (wizardData.hasTumorTissue === 'yes') {
            // Show all tests (tumor-informed preferred)
            return true;
          } else if (wizardData.hasTumorTissue === 'no') {
            // Only show tumor-naive tests
            return test.requiresTumorTissue !== 'Yes';
          }
          // 'not-sure' shows all
          return true;
        })
        .slice(0, 5) // Limit to 5 results
        .map(test => ({
          ...test,
          hasFinancialAssistance: checkFinancialAssistance(test),
        }));
    }

    // Placeholder results when no testData provided
    return [
      {
        id: 'signatera',
        name: 'Signatera',
        vendor: 'Natera',
        matchReason: `Personalized tumor-informed test available for ${getCancerLabel(wizardData.cancerType)}`,
        keyBenefit: 'Creates a custom assay from your tumor DNA',
        hasFinancialAssistance: true,
      },
      {
        id: 'guardant-reveal',
        name: 'Guardant Reveal',
        vendor: 'Guardant Health',
        matchReason: "Tumor-naive option if tissue isn't available",
        keyBenefit: 'No tumor tissue required',
        hasFinancialAssistance: true,
      },
      {
        id: 'foundationone-tracker',
        name: 'FoundationOne Tracker',
        vendor: 'Foundation Medicine',
        matchReason: 'Comprehensive tumor-informed MRD monitoring',
        keyBenefit: 'Integrated with CGP testing',
        hasFinancialAssistance: false,
      },
    ];
  };

  // Apply comparative badges to the matching tests
  const matchingTests = calculateComparativeBadges(getMatchingTests(), 'mrd');
  const showFinancialNote = wizardData.costSensitivity === 'very-sensitive' || wizardData.hasInsurance === false;

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      {/* Financial note */}
      {showFinancialNote && (
        <div className={`max-w-lg mx-auto mb-6 ${colors.bg} ${colors.border} border rounded-xl p-4`}>
          <div className="flex gap-3">
            <span className="text-xl">💰</span>
            <p className={`text-sm ${colors.textDark}`}>
              <span className="font-semibold">{content.financialNote.boldText}</span> {content.financialNote.text}
            </p>
          </div>
        </div>
      )}

      {/* Test cards */}
      <div className="max-w-lg mx-auto space-y-4 mb-8">
        {matchingTests.map((test) => (
          <div
            key={test.id}
            className="bg-white border-2 border-slate-200 rounded-xl p-5 hover:border-emerald-300 transition-colors"
          >
            {/* Comparative badges */}
            <ComparativeBadgeRow badges={test.comparativeBadges} />

            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-slate-900">{test.name}</h3>
                <p className="text-sm text-slate-500">{test.vendor}</p>
              </div>
              {test.hasFinancialAssistance && (
                <span className={`${colors.accentLight} ${colors.text} text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1`}>
                  💵 Assistance available
                </span>
              )}
            </div>
            <p className={`text-sm ${colors.text} mb-2`}>{test.matchReason}</p>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {test.keyBenefit}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="max-w-lg mx-auto flex flex-wrap gap-3 justify-center mb-6">
        <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          {content.actions.save}
        </button>
        <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {content.actions.email}
        </button>
        <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {content.actions.print}
        </button>
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextLabel={content.nextButtonLabel} />
    </div>
  );
}

/**
 * Step 7: Next Steps
 * Guidance on talking to oncologist, questions to ask
 */
function NextStepsStep({ wizardData, onBack, onComplete }) {
  const content = CONTENT.nextSteps;

  return (
    <div className="py-6">
      {/* Success icon */}
      <div className={`w-16 h-16 mx-auto mb-6 ${colors.accent} rounded-full flex items-center justify-center`}>
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Talk to oncologist section */}
        <InfoBox>
          <h3 className={`font-semibold ${colors.textDark} mb-3 flex items-center gap-2`}>
            <span className="text-xl">👩‍⚕️</span>
            {content.talkToOncologist.title}
          </h3>
          <p className="text-slate-700 text-sm">
            {content.talkToOncologist.description}
          </p>
        </InfoBox>

        {/* Questions to ask */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <span className="text-xl">❓</span>
            {content.questionsTitle}
          </h3>
          <div className="space-y-2">
            {content.questionsList.map((question, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg"
              >
                <div className={`w-6 h-6 ${colors.accentLight} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-xs font-medium ${colors.text}`}>{index + 1}</span>
                </div>
                <span className="text-sm text-slate-700">{question}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Print button */}
        <button
          className={`w-full py-3 ${colors.accentLight} ${colors.text} font-medium rounded-xl
                     hover:bg-emerald-200 transition-colors flex items-center justify-center gap-2`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {content.printQuestionsLabel}
        </button>

        {/* Save/account option (placeholder) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
          <p className="text-slate-600 text-sm mb-3">
            {content.savePrompt}
          </p>
          <button className={`px-6 py-2 ${colors.accent} ${colors.accentHover} text-white font-medium rounded-lg transition-colors`}>
            {content.createAccountLabel}
          </button>
          <p className="text-xs text-slate-500 mt-2">{content.comingSoonLabel}</p>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-8">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl
                     hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onComplete}
          className={`px-8 py-3 ${colors.accent} ${colors.accentHover} text-white font-medium rounded-xl
                     transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.focus}`}
        >
          {content.doneLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

/**
 * Map from PatientIntakeFlow cancer type labels to WatchingWizard cancer type IDs
 */
const CANCER_TYPE_MAP = {
  'Breast Cancer': 'breast',
  'Colorectal Cancer': 'colorectal',
  'Lung Cancer': 'lung',
  'Prostate Cancer': 'prostate',
  'Ovarian Cancer': 'ovarian',
  'Pancreatic Cancer': 'pancreatic',
  'Bladder Cancer': 'bladder',
  'Melanoma': 'melanoma',
  'Multiple Myeloma': 'multiple-myeloma',
  'Lymphoma': 'lymphoma',
  'Leukemia': 'other-solid', // Map to other since not in MRD list
  'Other / Multiple': 'other-solid',
};

/**
 * WatchingWizard - Multi-step wizard for MRD test discovery
 *
 * Guides post-treatment cancer patients through finding the right MRD test.
 * Key framing: "Confirming you're cancer-free" NOT "watching for cancer's return"
 * (avoiding anxiety-inducing language)
 *
 * @param {Object} props
 * @param {Function} props.onComplete - Called when wizard completes with all selections
 * @param {Function} props.onBack - Called when user wants to exit wizard (back to landing)
 * @param {Function} props.onExit - Called when user clicks Exit button (alternative to onBack)
 * @param {Function} props.onNavigate - Alternative navigation handler (used by App.jsx)
 * @param {Array} props.testData - MRD test data from data.js (for results step)
 * @param {string} props.initialCancerType - Pre-fill cancer type (label from PatientIntakeFlow, e.g., "Breast Cancer")
 */
export default function WatchingWizard({ onComplete, onBack, onExit, onNavigate, testData = [], initialCancerType }) {
  // Map initialCancerType from label to ID if provided
  const mappedCancerType = initialCancerType ? (CANCER_TYPE_MAP[initialCancerType] || null) : null;

  // Determine starting step: skip to step 2 (tumor-tissue) if cancer type is pre-filled
  const initialStep = mappedCancerType ? 2 : 0;

  // Current step in the wizard (0-indexed)
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Wizard data collected from user
  const [wizardData, setWizardData] = useState({
    cancerType: mappedCancerType,           // Selected cancer type or 'not-sure'
    hasTumorTissue: null,       // 'yes', 'no', or 'not-sure'
    treatmentStatus: null,      // 'just-finished', 'finished-while-ago', 'between-treatments', 'pre-treatment'
    hasInsurance: undefined,    // true or false
    insuranceType: null,        // 'private', 'medicare', 'medicaid', 'va', 'other'
    costSensitivity: null,      // 'very-sensitive', 'somewhat-sensitive', 'not-sensitive'
  });

  // Ref for scrolling to top on step change
  const containerRef = useRef(null);

  // Scroll to top when step changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Also scroll window for full-page scroll
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex) => {
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete(wizardData);
    }
  };

  // Handle exit - supports onExit, onBack, and onNavigate props
  const handleExit = () => {
    if (onExit) {
      onExit();
    } else if (onBack) {
      onBack();
    } else if (onNavigate) {
      onNavigate('patient-landing');
    }
  };

  // Render current step content
  const renderStepContent = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'welcome':
        return <WelcomeStep onNext={handleNext} />;
      case 'cancer-type':
        return (
          <CancerTypeStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'tumor-tissue':
        return (
          <TumorTissueStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'treatment-status':
        return (
          <TreatmentStatusStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'insurance':
        return (
          <InsuranceStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'results':
        return (
          <ResultsStep
            wizardData={wizardData}
            testData={testData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'next-steps':
        return (
          <NextStepsStep
            wizardData={wizardData}
            onBack={handleBack}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b ${colors.bgGradient}`}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${colors.accentLight} rounded-full flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">{watchingJourney.label} Journey</h1>
              <p className="text-sm text-slate-500">MRD Testing Guide</p>
            </div>
          </div>

          {/* Exit button */}
          <button
            onClick={handleExit}
            className="text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 text-sm
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 rounded-lg p-2"
            aria-label="Exit wizard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main
        ref={containerRef}
        className="max-w-2xl mx-auto px-4 sm:px-6 py-8 overflow-y-auto"
      >
        {/* Progress indicator */}
        <ProgressIndicator currentStep={currentStep} totalSteps={WIZARD_STEPS.length} />

        {/* Step dots navigation */}
        <StepDots
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {/* Current step badge */}
        <div className="text-center mb-6">
          <span className={`inline-block px-3 py-1 ${colors.accentLight} ${colors.text} rounded-full text-sm font-medium`}>
            {WIZARD_STEPS[currentStep].title}
          </span>
        </div>

        {/* Step content */}
        <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 md:p-8">
          {renderStepContent()}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-slate-500 mt-8 px-4">
          This guide is for educational purposes only and does not constitute medical advice.
          Always consult with your healthcare team about your specific situation.
        </p>
      </main>
    </div>
  );
}
