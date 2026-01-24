import React, { useState, useRef, useEffect } from 'react';
import { useTestsByCategory } from '../../../dal/hooks/useTests';
import { JOURNEY_CONFIG } from '../../patient-v2/journeyConfig';

// ============================================================================
// Configuration
// ============================================================================

// Get TDS/Choosing journey configuration for colors and label
const choosingJourney = JOURNEY_CONFIG.tds;

// Wizard steps for CGP/TDS journey
const WIZARD_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Learn about CGP testing' },
  { id: 'treatment-status', title: 'Treatment Status', description: 'Where are you in treatment?' },
  { id: 'prior-testing', title: 'Prior Testing', description: 'Have you had genomic testing?' },
  { id: 'sample-preference', title: 'Sample Type', description: 'Tissue or blood test?' },
  { id: 'goals', title: 'Goals', description: 'What are you hoping to find?' },
  { id: 'insurance', title: 'Coverage', description: 'Insurance and costs' },
  { id: 'results', title: 'Results', description: 'Tests that match your situation' },
];

// Build violet color scheme (matches "Choosing Treatment" journey)
const colors = {
  bg: choosingJourney.colors.bg,                    // bg-violet-50
  bgLight: 'bg-violet-50/50',                       // Soft background with transparency
  bgGradient: 'from-violet-50/50 to-white',         // Gradient backgrounds
  border: choosingJourney.colors.border,            // border-violet-200
  borderLight: 'border-violet-100',                 // Lighter border
  accent: choosingJourney.colors.accent,            // bg-violet-500
  accentHover: 'hover:bg-violet-600',               // Darker on hover
  accentLight: 'bg-violet-100',                     // Light violet for badges
  text: choosingJourney.colors.text,                // text-violet-700
  textDark: 'text-violet-900',                      // Darker text
  textLight: 'text-violet-600',                     // Lighter text
  ring: 'ring-violet-500',                          // Focus ring color
  focus: 'focus:ring-violet-500',                   // Focus state
};

// Step content - all strings centralized for easy editing
const CONTENT = {
  welcome: {
    headline: 'Find the Right Treatment Path',
    intro: {
      boldText: 'Comprehensive genomic profiling (CGP)',
      text: ' analyzes your tumor to find specific mutations that can guide treatment decisions.',
    },
    targetedTherapy: {
      title: 'Targeted therapy options',
      description: 'CGP can identify mutations that match FDA-approved targeted drugs',
    },
    clinicalTrials: {
      title: 'Clinical trial eligibility',
      description: 'Many trials require specific mutations for enrollment',
    },
    personalizedPlan: {
      title: 'Personalized treatment plan',
      description: 'Results help your oncologist tailor therapy to your specific cancer',
    },
    buttonText: "Let's find your options",
  },
  treatmentStatus: {
    heading: 'Where are you in your treatment journey?',
    description: 'This helps us understand the best timing for CGP testing',
    options: [
      {
        id: 'starting-soon',
        label: 'Starting treatment soon',
        description: 'Newly diagnosed, planning treatment',
        icon: '🎯',
      },
      {
        id: 'exploring-options',
        label: 'Exploring treatment options',
        description: 'Weighing different approaches',
        icon: '🔍',
      },
      {
        id: 'seeking-alternatives',
        label: 'Already on treatment, looking for alternatives',
        description: 'Current treatment not working or looking ahead',
        icon: '🔄',
      },
      {
        id: 'not-sure',
        label: "I'm not sure",
        description: "That's okay - we can still help guide you",
        icon: '❓',
      },
    ],
  },
  priorTesting: {
    heading: 'Have you already had genomic testing?',
    description: 'This helps us avoid recommending tests you may have already done',
    educationHeading: 'What counts as genomic testing?',
    educationItems: [
      { title: 'CGP/NGS panels', description: 'FoundationOne, Tempus, Guardant360, etc.' },
      { title: 'Single-gene tests', description: 'BRCA, EGFR, ALK, or other specific mutations' },
    ],
    options: [
      { id: 'yes', label: 'Yes, I have had testing', description: "We'll focus on what might be new or different" },
      { id: 'no', label: 'No, not yet', description: "We'll show you comprehensive options" },
      { id: 'not-sure', label: "I'm not sure", description: "Your oncologist can check your records" },
    ],
  },
  samplePreference: {
    heading: 'What sample type works best for you?',
    description: 'Different tests use different sample types',
    educationHeading: 'Understanding your options',
    tumorTissue: {
      title: 'Tumor tissue (biopsy)',
      description: 'Most comprehensive results. Requires tissue from surgery or biopsy.',
    },
    bloodTest: {
      title: 'Blood test (liquid biopsy)',
      description: 'Non-invasive option. Detects tumor DNA circulating in blood.',
    },
    options: [
      { id: 'tissue-available', label: 'Tumor tissue is available', description: 'From recent surgery or biopsy' },
      { id: 'prefer-blood', label: 'I prefer a blood test', description: 'Less invasive, quicker turnaround' },
      { id: 'not-sure', label: "I'm not sure what's available", description: 'Your oncologist can help determine this' },
    ],
  },
  goals: {
    heading: 'What are you hoping to find?',
    description: 'This helps us prioritize the right tests for your goals',
    options: [
      {
        id: 'fda-therapies',
        label: 'FDA-approved targeted therapies',
        description: 'Proven treatments matched to your mutations',
        icon: '💊',
      },
      {
        id: 'clinical-trials',
        label: 'Clinical trial opportunities',
        description: 'Access to cutting-edge treatments',
        icon: '🔬',
      },
      {
        id: 'both',
        label: 'Both options',
        description: 'Explore all possible treatment paths',
        icon: '✨',
      },
    ],
    notSureLabel: "I'm not sure yet",
    notSureDescription: "That's okay - we'll show you options that cover both",
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
    heading: 'CGP Tests That Match Your Situation',
    description: 'Based on your answers, here are tests to discuss with your oncologist',
    financialNote: {
      boldText: 'Financial assistance may be available.',
      text: "We've highlighted tests with assistance programs based on your cost sensitivity.",
    },
    matchReasons: {
      'tissue-available': 'Tissue-based comprehensive genomic profiling',
      'prefer-blood': 'Liquid biopsy option for non-invasive testing',
      'not-sure': 'Flexible testing options available',
      'fda-therapies': 'Strong FDA-approved therapy matching',
      'clinical-trials': 'Extensive clinical trial matching',
      'both': 'Comprehensive therapy and trial matching',
    },
    actions: {
      save: 'Save these results',
      email: 'Email this list',
      print: 'Print for my doctor',
    },
    doneButtonLabel: 'Done',
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
                  ? `${colors.accent} text-white cursor-pointer hover:bg-violet-600`
                  : isCurrent
                    ? `${colors.accentLight} ${colors.text} border-2 border-violet-500`
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
          : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
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
 * Introduction to CGP testing and its benefits
 */
function WelcomeStep({ onNext }) {
  const content = CONTENT.welcome;

  return (
    <div className="text-center py-6">
      {/* Icon */}
      <div className={`w-20 h-20 mx-auto mb-6 ${colors.accentLight} rounded-full flex items-center justify-center`}>
        <svg className={`w-10 h-10 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
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
            <span className={`font-semibold ${colors.textDark}`}>{content.intro.boldText}</span>{content.intro.text}
          </p>
        </InfoBox>

        {/* Benefit cards */}
        <div className={`${colors.accentLight} ${colors.border} border rounded-xl p-5`}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 ${colors.accent} rounded-full flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-lg">💊</span>
              </div>
              <div>
                <p className={`font-semibold ${colors.textDark}`}>{content.targetedTherapy.title}</p>
                <p className="text-sm text-slate-600">{content.targetedTherapy.description}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 ${colors.accent} rounded-full flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-lg">🔬</span>
              </div>
              <div>
                <p className={`font-semibold ${colors.textDark}`}>{content.clinicalTrials.title}</p>
                <p className="text-sm text-slate-600">{content.clinicalTrials.description}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 ${colors.accent} rounded-full flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-lg">📋</span>
              </div>
              <div>
                <p className={`font-semibold ${colors.textDark}`}>{content.personalizedPlan.title}</p>
                <p className="text-sm text-slate-600">{content.personalizedPlan.description}</p>
              </div>
            </div>
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
 * Step 2: Treatment Status
 * Where the user is in their treatment journey
 */
function TreatmentStatusStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.treatmentStatus;

  const handleSelect = (treatmentStatus) => {
    setWizardData(prev => ({ ...prev, treatmentStatus }));
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

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.treatmentStatus} />
    </div>
  );
}

/**
 * Step 3: Prior Testing
 * Has the user had genomic testing before?
 */
function PriorTestingStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.priorTesting;

  const handleSelect = (priorTesting) => {
    setWizardData(prev => ({ ...prev, priorTesting }));
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

      {/* Educational panel */}
      <div className="max-w-lg mx-auto mb-8">
        <InfoBox>
          <h3 className={`font-semibold ${colors.textDark} mb-3`}>{content.educationHeading}</h3>
          <div className="space-y-3">
            {content.educationItems.map((item, index) => (
              <div key={index} className="flex gap-3">
                <div className={`w-6 h-6 ${colors.accent} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </InfoBox>
      </div>

      {/* Options */}
      <div className="max-w-lg mx-auto space-y-3">
        {content.options.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.priorTesting === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <span className="font-medium text-slate-900">{option.label}</span>
            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
          </OptionButton>
        ))}
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.priorTesting} />
    </div>
  );
}

/**
 * Step 4: Sample Preference
 * Tumor tissue vs blood test preference
 */
function SamplePreferenceStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.samplePreference;

  const handleSelect = (samplePreference) => {
    setWizardData(prev => ({ ...prev, samplePreference }));
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

      {/* Educational panel */}
      <div className="max-w-lg mx-auto mb-8">
        <InfoBox>
          <h3 className={`font-semibold ${colors.textDark} mb-3`}>{content.educationHeading}</h3>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className={`w-8 h-8 ${colors.accent} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">{content.tumorTissue.title}</p>
                <p className="text-sm text-slate-600">{content.tumorTissue.description}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">{content.bloodTest.title}</p>
                <p className="text-sm text-slate-600">{content.bloodTest.description}</p>
              </div>
            </div>
          </div>
        </InfoBox>
      </div>

      {/* Options */}
      <div className="max-w-lg mx-auto space-y-3">
        {content.options.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.samplePreference === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <span className="font-medium text-slate-900">{option.label}</span>
            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
          </OptionButton>
        ))}
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.samplePreference} />
    </div>
  );
}

/**
 * Step 5: Goals
 * FDA-approved therapies vs clinical trials vs both
 */
function GoalsStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.goals;

  const handleSelect = (goals) => {
    setWizardData(prev => ({ ...prev, goals }));
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

      {/* Options */}
      <div className="max-w-lg mx-auto space-y-3">
        {content.options.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.goals === option.id}
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

      {/* Not sure option */}
      <div className="max-w-lg mx-auto mt-4">
        <button
          onClick={() => handleSelect('not-sure')}
          className={`
            w-full p-4 border-2 rounded-xl text-center
            transition-all duration-200
            ${wizardData.goals === 'not-sure'
              ? `${colors.border} ${colors.bg}`
              : 'border-dashed border-slate-300 hover:border-slate-400 bg-white'
            }
          `}
        >
          <span className={`font-medium ${wizardData.goals === 'not-sure' ? colors.text : 'text-slate-700'}`}>
            {content.notSureLabel}
          </span>
          <p className="text-sm text-slate-500 mt-1">
            {content.notSureDescription}
          </p>
        </button>
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.goals} />
    </div>
  );
}

/**
 * Step 6: Insurance & Cost Sensitivity
 * Coverage and cost preferences (same pattern as WatchingWizard)
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
                  : 'border-slate-200 hover:border-violet-300'
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
                  : 'border-slate-200 hover:border-violet-300'
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
                        : 'border-slate-200 hover:border-violet-300'
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
 * Step 7: Results
 * Shows matching CGP tests based on selections with "why it matches"
 */
function ResultsStep({ wizardData, testData, onBack, onComplete }) {
  const content = CONTENT.results;

  // Get match reason based on wizard selections and test characteristics
  const getMatchReason = (test) => {
    const reasons = [];
    const sampleCategory = test.sampleCategory?.toLowerCase() || '';

    // Sample preference matching
    if (wizardData.samplePreference === 'tissue-available' && sampleCategory.includes('tissue')) {
      reasons.push('Matches your tissue availability');
    } else if (wizardData.samplePreference === 'prefer-blood' &&
               (sampleCategory.includes('blood') || sampleCategory.includes('plasma'))) {
      reasons.push('Blood-based as you prefer');
    }

    // FDA status matching for therapy goals
    if ((wizardData.goals === 'fda-therapies' || wizardData.goals === 'both') &&
        test.fdaStatus?.toLowerCase().includes('fda-approved')) {
      reasons.push('FDA-approved companion diagnostic');
    }

    // Clinical trials matching
    if (wizardData.goals === 'clinical-trials' || wizardData.goals === 'both') {
      reasons.push('Extensive clinical trial matching');
    }

    // Default reason if none matched
    if (reasons.length === 0) {
      reasons.push('Comprehensive genomic profiling for your cancer type');
    }

    return reasons[0];
  };

  // Generate key benefit based on test characteristics
  const getKeyBenefit = (test) => {
    const sampleCategory = test.sampleCategory?.toLowerCase() || '';

    if (sampleCategory.includes('blood') || sampleCategory.includes('plasma')) {
      return 'Non-invasive blood draw';
    }
    if (test.genesAnalyzed && parseInt(test.genesAnalyzed) > 300) {
      return `Analyzes ${test.genesAnalyzed}+ genes`;
    }
    if (test.fdaCompanionDxCount && test.fdaCompanionDxCount > 10) {
      return `${test.fdaCompanionDxCount} FDA companion diagnostic indications`;
    }
    return 'Comprehensive mutation analysis';
  };

  // Filter and match tests based on wizard data
  const getMatchingTests = () => {
    // If testData is provided and has items, filter it
    if (testData && testData.length > 0) {
      return testData
        .filter(test => {
          const sampleCategory = test.sampleCategory?.toLowerCase() || '';

          // Filter by sample preference
          if (wizardData.samplePreference === 'tissue-available') {
            // Show tissue-based tests
            return sampleCategory.includes('tissue') || !sampleCategory;
          } else if (wizardData.samplePreference === 'prefer-blood') {
            // Show blood/liquid biopsy tests
            return sampleCategory.includes('blood') || sampleCategory.includes('plasma');
          }
          // 'not-sure' shows all
          return true;
        })
        .filter(test => {
          // Additional filter by goals - prefer FDA-approved for therapy seekers
          if (wizardData.goals === 'fda-therapies') {
            return test.fdaStatus?.toLowerCase().includes('fda-approved') || test.fdaCompanionDxCount > 0;
          }
          return true;
        })
        .slice(0, 5) // Limit to 5 results
        .map(test => ({
          ...test,
          matchReason: getMatchReason(test),
          keyBenefit: getKeyBenefit(test),
          hasFinancialAssistance: test.reimbursementNote?.toLowerCase().includes('assistance') ||
                                  test.reimbursementNote?.toLowerCase().includes('$0') ||
                                  test.reimbursement?.toLowerCase().includes('medicare'),
        }));
    }

    // Placeholder results when no testData provided
    return [
      {
        id: 'foundationone-cdx',
        name: 'FoundationOne CDx',
        vendor: 'Foundation Medicine',
        matchReason: 'FDA-approved companion diagnostic with broad coverage',
        keyBenefit: 'Analyzes 324+ genes',
        hasFinancialAssistance: true,
      },
      {
        id: 'tempus-xt',
        name: 'Tempus xT',
        vendor: 'Tempus',
        matchReason: 'Comprehensive tissue-based profiling with clinical trial matching',
        keyBenefit: 'AI-powered insights',
        hasFinancialAssistance: true,
      },
      {
        id: 'guardant360',
        name: 'Guardant360',
        vendor: 'Guardant Health',
        matchReason: 'Liquid biopsy option when tissue is limited',
        keyBenefit: 'Non-invasive blood draw',
        hasFinancialAssistance: true,
      },
      {
        id: 'caris-mi',
        name: 'Caris Molecular Intelligence',
        vendor: 'Caris Life Sciences',
        matchReason: 'Multi-platform approach for comprehensive results',
        keyBenefit: 'Includes DNA, RNA, and protein analysis',
        hasFinancialAssistance: false,
      },
    ];
  };

  const matchingTests = getMatchingTests();
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
            className="bg-white border-2 border-slate-200 rounded-xl p-5 hover:border-violet-300 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-slate-900">{test.name}</h3>
                <p className="text-sm text-slate-500">{test.vendor}</p>
              </div>
              {test.hasFinancialAssistance && showFinancialNote && (
                <span className={`${colors.accentLight} ${colors.text} text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1`}>
                  💵 Financial aid
                </span>
              )}
            </div>
            <p className={`text-sm ${colors.text} mb-2`}>
              <span className="font-medium">Why it matches:</span> {test.matchReason}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {content.doneButtonLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

/**
 * Map from PatientIntakeFlow cancer type labels to internal IDs
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
  'Leukemia': 'leukemia',
  'Other / Multiple': 'other',
};

/**
 * ChoosingWizard - Multi-step wizard for CGP/TDS test discovery
 *
 * Guides cancer patients through finding the right CGP test for treatment selection.
 * Key focus: helping patients understand their options for targeted therapy and clinical trials.
 *
 * @param {Object} props
 * @param {Function} props.onComplete - Called when wizard completes with all selections
 * @param {Function} props.onBack - Called when user wants to exit wizard (back to landing)
 * @param {Function} props.onExit - Called when user clicks Exit button (alternative to onBack)
 * @param {Function} props.onNavigate - Alternative navigation handler (used by App.jsx)
 * @param {Array} props.testData - CGP test data (for results step)
 * @param {string} props.initialCancerType - Pre-fill cancer type (label from PatientIntakeFlow, e.g., "Breast Cancer")
 */
export default function ChoosingWizard({ onComplete, onBack, onExit, onNavigate, testData, initialCancerType }) {
  // Get CGP tests via DAL
  const { tests: cgpTests } = useTestsByCategory('CGP');
  // Use provided testData or default to DAL data
  const resolvedTestData = testData || cgpTests;
  // Map initialCancerType from label to ID if provided
  const mappedCancerType = initialCancerType ? (CANCER_TYPE_MAP[initialCancerType] || null) : null;

  // Current step in the wizard (0-indexed)
  const [currentStep, setCurrentStep] = useState(0);

  // Wizard data collected from user
  const [wizardData, setWizardData] = useState({
    cancerType: mappedCancerType,           // Pre-filled cancer type
    treatmentStatus: null,      // 'starting-soon', 'exploring-options', 'seeking-alternatives', 'not-sure'
    priorTesting: null,         // 'yes', 'no', 'not-sure'
    samplePreference: null,     // 'tissue-available', 'prefer-blood', 'not-sure'
    goals: null,                // 'fda-therapies', 'clinical-trials', 'both', 'not-sure'
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
      case 'treatment-status':
        return (
          <TreatmentStatusStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'prior-testing':
        return (
          <PriorTestingStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'sample-preference':
        return (
          <SamplePreferenceStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'goals':
        return (
          <GoalsStep
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
            testData={resolvedTestData}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Choosing Treatment Journey</h1>
              <p className="text-sm text-slate-500">CGP Testing Guide</p>
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
