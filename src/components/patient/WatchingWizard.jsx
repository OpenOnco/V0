import React, { useState, useRef, useEffect } from 'react';
import { JOURNEY_CONFIG } from '../patient-v2/journeyConfig';
import { calculateComparativeBadges } from '../../utils/comparativeBadges';
import { ComparativeBadgeRow } from '../badges/ComparativeBadge';
import { 
  hasAssistanceProgram, 
  VENDOR_ASSISTANCE_PROGRAMS,
  INSURANCE_PROVIDERS,
  ALL_INSURANCE_PROVIDERS,
  AVAILABLE_REGIONS,
  isTestCoveredByInsurance,
  isTestAvailableInRegion,
} from '../../data';
import { getVendorAvailabilityUS } from '../../config/vendors';
import TestDetailModal from '../test/TestDetailModal';

// ============================================================================
// Configuration
// ============================================================================

// Get MRD/Watching journey configuration for colors and label
const watchingJourney = JOURNEY_CONFIG.mrd;

// Wizard steps - treatment gate first to exit early if not a fit
const WIZARD_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Learn about MRD testing' },
  { id: 'treatment-gate', title: 'Treatment', description: 'Have you completed treatment?' },
  { id: 'location', title: 'Location', description: 'Where are you located?' },
  { id: 'cancer-type', title: 'Cancer Type', description: 'What cancer were you treated for?' },
  { id: 'tumor-tissue', title: 'Tumor Tissue', description: 'Was tumor tissue saved?' },
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
  location: {
    heading: 'Where are you located?',
    description: 'This helps us show tests available in your area',
    countryQuestion: 'Select your country',
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
  treatmentGate: {
    heading: 'Have you completed cancer treatment?',
    description: 'MRD testing is designed for monitoring after treatment',
    yesOption: {
      label: 'Yes, I\'ve completed treatment',
      description: 'Surgery, chemo, radiation, or other treatment',
    },
    noOption: {
      label: 'No, not yet',
      description: 'I\'m still in treatment or haven\'t started',
    },
    notYetWarning: {
      title: 'MRD testing is for post-treatment monitoring',
      get text() {
        return `These tests detect residual cancer after treatment completes. If you're exploring treatment options, you might want to check out the "${JOURNEY_CONFIG.tds.label}" journey instead.`;
      },
    },
    continueAnywayLabel: 'Continue anyway',
  },
  insurance: {
    heading: "Let's talk about coverage",
    description: 'This helps us find tests covered by your insurance',
    hasInsuranceQuestion: 'Do you have health insurance?',
    insuranceProviderQuestion: 'Select your insurance provider',
    insuranceProviderDescription: 'We\'ll show tests covered by your plan',
    noInsuranceNote: "No problem — we'll show you options with financial assistance programs.",
    costSensitivityQuestion: 'Is cost a concern?',
    costOptions: [
      { id: 'cost-sensitive', label: 'Yes, I need to minimize costs', description: 'Show only tests with financial assistance' },
      { id: 'not-sensitive', label: 'No, cost is not a major factor', description: 'Show all available tests' },
    ],
  },
  results: {
    heading: 'Tests That Match Your Situation',
    description: 'Based on your answers, here are MRD tests to discuss with your oncologist',
    noResultsHeading: 'No Exact Matches Found',
    noResultsDescription: 'We couldn\'t find tests that match all your criteria. Here are some options:',
    financialNote: {
      boldText: 'Financial assistance may be available.',
      text: "We've highlighted tests with assistance programs.",
    },
    insuranceCoverageNote: {
      boldText: 'Coverage confirmed.',
      text: 'These tests are covered by your insurance provider.',
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
 * Step 2: Location
 * Country selection, and US state if in USA
 */
function LocationStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.location;

  const handleCountrySelect = (country) => {
    setWizardData(prev => ({ ...prev, country }));
  };

  const canProceed = !!wizardData.country;

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      {/* Country selection */}
      <div className="max-w-md mx-auto mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {content.countryQuestion}
        </label>
        <select
          value={wizardData.country || ''}
          onChange={(e) => handleCountrySelect(e.target.value)}
          className={`w-full p-3 border-2 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 ${colors.focus} ${colors.border}`}
        >
          <option value="">Select country...</option>
          {AVAILABLE_REGIONS.map((region) => (
            <option key={region.id} value={region.id}>{region.label}</option>
          ))}
        </select>
      </div>

      <NavigationButtons onBack={onBack} showBack={true} onNext={onNext} nextDisabled={!canProceed} />
    </div>
  );
}

/**
 * Step 3: Cancer Type Selection
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
 * Step 5: Treatment Gate
 * Simple yes/no: Have you completed treatment?
 */
function TreatmentGateStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.treatmentGate;
  const [showNotYetNote, setShowNotYetNote] = useState(false);

  const handleSelect = (completedTreatment) => {
    setWizardData(prev => ({ ...prev, completedTreatment }));
    if (completedTreatment === 'yes') {
      setShowNotYetNote(false);
      setTimeout(() => onNext(), 300);
    } else {
      setShowNotYetNote(true);
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

      {/* Yes/No options */}
      <div className="max-w-lg mx-auto space-y-3">
        <OptionButton
          selected={wizardData.completedTreatment === 'yes'}
          onClick={() => handleSelect('yes')}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">✓</span>
            <div>
              <span className="font-medium text-slate-900">{content.yesOption.label}</span>
              <p className="text-sm text-slate-500 mt-1">{content.yesOption.description}</p>
            </div>
          </div>
        </OptionButton>

        <OptionButton
          selected={wizardData.completedTreatment === 'no'}
          onClick={() => handleSelect('no')}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <span className="font-medium text-slate-900">{content.noOption.label}</span>
              <p className="text-sm text-slate-500 mt-1">{content.noOption.description}</p>
            </div>
          </div>
        </OptionButton>
      </div>

      {/* Not yet warning */}
      {showNotYetNote && (
        <div className="max-w-lg mx-auto mt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-amber-900">{content.notYetWarning.title}</p>
                <p className="text-sm text-amber-800 mt-1">
                  {content.notYetWarning.text}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <NavigationButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!wizardData.completedTreatment}
        nextLabel={wizardData.completedTreatment === 'no' ? content.continueAnywayLabel : 'Continue'}
      />
    </div>
  );
}

/**
 * Step 6: Insurance & Cost Sensitivity
 * Coverage and cost preferences
 */
function InsuranceStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.insurance;

  const handleInsuranceChange = (hasInsurance) => {
    setWizardData(prev => ({
      ...prev,
      hasInsurance,
      insuranceProvider: hasInsurance ? prev.insuranceProvider : null,
      costSensitivity: null, // Reset cost sensitivity when insurance changes
    }));
  };

  const handleInsuranceProviderChange = (insuranceProvider) => {
    setWizardData(prev => ({ 
      ...prev, 
      insuranceProvider,
      costSensitivity: insuranceProvider === 'other' ? null : prev.costSensitivity, // Reset cost sensitivity if changing to/from other
    }));
  };

  const handleCostSensitivityChange = (costSensitivity) => {
    setWizardData(prev => ({ ...prev, costSensitivity }));
  };

  // Need cost sensitivity question if: no insurance OR selected "other" insurance
  const needsCostSensitivity = wizardData.hasInsurance === false || 
    (wizardData.hasInsurance === true && wizardData.insuranceProvider === 'other');

  // Complete when: 
  // - has insurance + selected known provider (not other), OR
  // - has insurance + selected "other" + cost preference, OR
  // - no insurance + cost preference
  const isComplete = wizardData.hasInsurance === true 
    ? (wizardData.insuranceProvider && wizardData.insuranceProvider !== 'other') || 
      (wizardData.insuranceProvider === 'other' && wizardData.costSensitivity)
    : wizardData.hasInsurance === false && wizardData.costSensitivity;

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

          {/* Insurance provider dropdown - shown if has insurance */}
          {wizardData.hasInsurance === true && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {content.insuranceProviderQuestion}
              </label>
              <p className="text-sm text-slate-500 mb-2">{content.insuranceProviderDescription}</p>
              <select
                value={wizardData.insuranceProvider || ''}
                onChange={(e) => handleInsuranceProviderChange(e.target.value)}
                className={`w-full p-3 border-2 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 ${colors.focus} ${colors.border}`}
              >
                <option value="">Select your insurance...</option>
                <optgroup label="Government Programs">
                  {INSURANCE_PROVIDERS.government.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Major National Plans">
                  {INSURANCE_PROVIDERS.national.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Regional Plans">
                  {INSURANCE_PROVIDERS.regional.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <option value="other">Other (not listed)</option>
              </select>
            </div>
          )}

          {/* "Other" insurance selected - explain and show cost question */}
          {wizardData.hasInsurance === true && wizardData.insuranceProvider === 'other' && (
            <div className="mt-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-amber-800">
                    We don't have coverage data for your insurance provider, so these tests may require out-of-pocket payment. Many vendors offer financial assistance programs.
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-slate-900 mb-3">{content.costSensitivityQuestion}</h3>
              <div className="space-y-2">
                {content.costOptions.map((option) => (
                  <OptionButton
                    key={option.id}
                    selected={wizardData.costSensitivity === option.id}
                    onClick={() => handleCostSensitivityChange(option.id)}
                  >
                    <span className="font-medium text-slate-900">{option.label}</span>
                    <p className="text-sm text-slate-500 mt-1">{option.description}</p>
                  </OptionButton>
                ))}
              </div>
            </div>
          )}

          {/* No insurance - show cost sensitivity question */}
          {wizardData.hasInsurance === false && (
            <div className="mt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-800">
                    {content.noInsuranceNote}
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-slate-900 mb-3">{content.costSensitivityQuestion}</h3>
              <div className="space-y-2">
                {content.costOptions.map((option) => (
                  <OptionButton
                    key={option.id}
                    selected={wizardData.costSensitivity === option.id}
                    onClick={() => handleCostSensitivityChange(option.id)}
                  >
                    <span className="font-medium text-slate-900">{option.label}</span>
                    <p className="text-sm text-slate-500 mt-1">{option.description}</p>
                  </OptionButton>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!isComplete} />
    </div>
  );
}

/**
 * Test Summary Modal Component
 * Shows Claude-generated plain-language summary of a test
 */
function TestSummaryModal({ test, wizardData, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get cancer type label for display
  const getCancerLabel = (id) => {
    const type = CANCER_TYPES.find(t => t.id === id);
    return type?.label || 'your cancer type';
  };

  // Get full financial assistance program object for the vendor
  const getAssistanceProgram = (vendor) => {
    const program = VENDOR_ASSISTANCE_PROGRAMS[vendor];
    if (program?.hasProgram) {
      return program;
    }
    // Check partial match
    for (const [key, value] of Object.entries(VENDOR_ASSISTANCE_PROGRAMS)) {
      if (vendor?.includes(key) && value?.hasProgram) {
        return value;
      }
    }
    return null;
  };

  // Get financial assistance details text for the vendor
  const getAssistanceDetails = (vendor) => {
    const program = getAssistanceProgram(vendor);
    if (program) {
      return program.description || 'Financial assistance available - contact vendor for details.';
    }
    return null;
  };

  // Check if we should show financial assistance info
  const showFinancialAssistance = (wizardData.costSensitivity === 'very-sensitive' || !wizardData.hasInsurance);
  const assistanceProgram = getAssistanceProgram(test.vendor);

  // Fetch summary from Claude API
  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);

      // Build a compact test data string for Claude
      const testInfo = {
        name: test.name,
        vendor: test.vendor,
        approach: test.approach,
        method: test.method,
        sensitivity: test.sensitivity,
        sensitivityNotes: test.sensitivityNotes,
        specificity: test.specificity,
        lod: test.lod,
        tat: test.initialTat || test.tat,
        followUpTat: test.followUpTat,
        fdaStatus: test.fdaStatus,
        reimbursement: test.reimbursement,
        cancerTypes: test.cancerTypes,
        earlyWarningDays: test.earlyWarningDays,
        leadTime: test.leadTime,
        comparativeBadges: test.comparativeBadges?.map(b => b.label),
      };

      // Check if vendor is widely available
      const isWidelyAvailable = getVendorAvailabilityUS(test.vendor) === 'widespread';

      const wizardContext = {
        cancerType: getCancerLabel(wizardData.cancerType),
        hasTumorTissue: wizardData.hasTumorTissue,
        hasInsurance: wizardData.hasInsurance,
        insuranceType: wizardData.insuranceType,
        costSensitivity: wizardData.costSensitivity,
      };

      const assistanceDetails = getAssistanceDetails(test.vendor);

      // Build standout qualities list
      const standoutQualities = [];
      if (test.comparativeBadges?.length > 0) {
        standoutQualities.push(...test.comparativeBadges.map(b => b.label));
      }
      if (isWidelyAvailable) {
        standoutQualities.push('Widely Available (any oncologist can order through major lab networks)');
      }

      const promptMessage = `You're helping a patient understand an MRD test that matched their situation. Write a clear, warm 3-4 paragraph summary.

PATIENT SITUATION:
- Cancer type: ${wizardContext.cancerType}
- Tumor tissue available: ${wizardContext.hasTumorTissue === 'yes' ? 'Yes' : wizardContext.hasTumorTissue === 'no' ? 'No' : 'Unsure'}
- Insurance: ${wizardContext.hasInsurance ? `Yes (${wizardContext.insuranceType || 'type unknown'})` : 'No'}
- Cost sensitivity: ${wizardContext.costSensitivity === 'very-sensitive' ? 'Very cost sensitive' : wizardContext.costSensitivity === 'somewhat-sensitive' ? 'Somewhat cost sensitive' : 'Cost not a major factor'}

TEST DETAILS:
${JSON.stringify(testInfo, null, 2)}

${assistanceDetails ? `FINANCIAL ASSISTANCE: ${assistanceDetails}` : ''}

${standoutQualities.length > 0 ? `STANDOUT QUALITIES (mention these as wins!): ${standoutQualities.join(', ')}` : ''}

Write the summary with these sections (use plain language, no medical jargon):
1. **What this test does** - Explain in simple terms what ${test.name} does and how it works
2. **Why it matched your situation** - Connect specific test features to the patient's answers (tumor tissue availability, cancer type, etc.)
3. **Key benefits** - Highlight the test's strengths${standoutQualities.length > 0 ? '. IMPORTANT: Explicitly mention these standout qualities as wins: ' + standoutQualities.join(', ') : ''}
${(wizardContext.costSensitivity === 'very-sensitive' || !wizardContext.hasInsurance) && assistanceDetails ? `4. **Financial help available** - Briefly mention that financial assistance is available (we will show a link separately)` : ''}

End with a reminder that their oncologist can help them decide if this test is right for them.`;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'MRD',
            persona: 'patient',
            testData: JSON.stringify([testInfo]),
            messages: [{ role: 'user', content: promptMessage }],
            model: 'claude-haiku-4-5-20251001',
            patientChatMode: 'learn',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate summary');
        }

        const data = await response.json();
        const summaryText = data.content?.[0]?.text || 'Unable to generate summary.';
        setSummary(summaryText);
      } catch (err) {
        console.error('Error fetching test summary:', err);
        setError('Unable to load summary. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [test, wizardData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`${colors.bg} ${colors.border} border-b px-6 py-4 flex items-center justify-between`}>
          <div>
            <h3 className="font-semibold text-slate-900">{test.name}</h3>
            <p className="text-sm text-slate-600">{test.vendor}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white/50 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className={`w-10 h-10 ${colors.accent} rounded-full flex items-center justify-center animate-pulse mb-4`}>
                <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-slate-600 text-sm">Preparing your personalized summary...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-sm text-red-700 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {summary && !loading && (
            <>
              <div className="prose prose-sm prose-slate max-w-none">
                {/* Parse and render markdown-like content */}
                {summary.split('\n\n').map((paragraph, idx) => {
                  // Check if it's a header (starts with **)
                  if (paragraph.startsWith('**') && paragraph.includes('**')) {
                    const headerMatch = paragraph.match(/^\*\*(.+?)\*\*/);
                    if (headerMatch) {
                      const headerText = headerMatch[1];
                      const restText = paragraph.replace(/^\*\*.+?\*\*\s*/, '');
                      return (
                        <div key={idx} className="mb-4">
                          <h4 className={`font-semibold ${colors.textDark} mb-1`}>{headerText}</h4>
                          {restText && <p className="text-slate-700 text-sm leading-relaxed">{restText}</p>}
                        </div>
                      );
                    }
                  }
                  return (
                    <p key={idx} className="text-slate-700 text-sm leading-relaxed mb-3">
                      {paragraph}
                    </p>
                  );
                })}
              </div>

              {/* Financial Assistance Link - shown for cost-sensitive patients */}
              {showFinancialAssistance && assistanceProgram?.applicationUrl && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💵</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-1">
                        {assistanceProgram.programName || 'Financial Assistance Program'}
                      </h4>
                      <p className="text-sm text-blue-800 mb-3">
                        {assistanceProgram.maxOutOfPocket && `Qualifying patients may pay ${assistanceProgram.maxOutOfPocket}. `}
                        {assistanceProgram.paymentPlans && `${assistanceProgram.paymentPlans}. `}
                        {!assistanceProgram.maxOutOfPocket && !assistanceProgram.paymentPlans && 'Financial assistance available based on eligibility.'}
                      </p>
                      <a
                        href={assistanceProgram.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Learn about financial assistance
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`${colors.bg} ${colors.border} border-t px-6 py-4`}>
          <button
            onClick={onClose}
            className={`w-full py-3 ${colors.accent} ${colors.accentHover} text-white font-medium rounded-xl transition-colors`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 6: Results
 * Shows matching tests based on selections
 */
function ResultsStep({ wizardData, testData, onNext, onBack }) {
  // State for test summary modal
  const [selectedTest, setSelectedTest] = useState(null);
  // State for full test detail modal
  const [detailTest, setDetailTest] = useState(null);
  // State for "More tests" expansion
  const [showMoreTests, setShowMoreTests] = useState(false);
  const content = CONTENT.results;

  // Get cancer type label for display
  const getCancerLabel = (id) => {
    const type = CANCER_TYPES.find(t => t.id === id);
    return type?.label || 'your cancer type';
  };

  // Check if a test has financial assistance programs (via vendor lookup)
  const checkFinancialAssistance = (test) => {
    return hasAssistanceProgram(test.vendor);
  };

  // Check if test matches cancer type
  const matchesCancerType = (test, cancerType) => {
    // If user didn't select a cancer type or isn't sure, show all tests
    if (!cancerType || cancerType === 'not-sure') return true;
    
    // If test has no cancer types defined, we can't match - be conservative and exclude
    if (!test.cancerTypes || test.cancerTypes.length === 0) return false;
    
    // Map wizard cancer types to data.js cancer type values
    // Breast cancer is a SOLID TUMOR, not a blood cancer
    const cancerTypeMap = {
      'colorectal': ['Colorectal', 'CRC', 'Colon'],
      'breast': ['Breast'],
      'lung': ['Lung', 'NSCLC', 'Non-small cell lung'],
      'bladder': ['Bladder', 'Urothelial'],
      'ovarian': ['Ovarian'],
      'prostate': ['Prostate'],
      'pancreatic': ['Pancreatic'],
      'melanoma': ['Melanoma'],
      'multiple-myeloma': ['Multiple Myeloma', 'MM', 'Myeloma'],
      'lymphoma': ['Lymphoma', 'DLBCL', 'B-cell', 'Hodgkin', 'NHL'],
      'other-solid': [], // Will only match multi-solid tests
    };
    
    // Blood/hematologic cancers - these should NOT match solid tumors
    const bloodCancers = ['multiple-myeloma', 'lymphoma'];
    const solidTumorCancers = ['colorectal', 'breast', 'lung', 'bladder', 'ovarian', 'prostate', 'pancreatic', 'melanoma', 'other-solid'];
    
    const searchTerms = cancerTypeMap[cancerType] || [];
    const isBloodCancer = bloodCancers.includes(cancerType);
    const isSolidTumor = solidTumorCancers.includes(cancerType);
    
    // Check if any cancer type matches
    return test.cancerTypes.some(ct => {
      const ctLower = ct.toLowerCase();
      
      // Blood cancer indicators - tests for these should NOT match solid tumors
      const isBloodTest = ctLower.includes('myeloma') || 
                          ctLower.includes('leukemia') || 
                          ctLower.includes('lymphoma') ||
                          ctLower.includes('all') ||
                          ctLower.includes('cll') ||
                          ctLower.includes('b-all') ||
                          ctLower.includes('aml') ||
                          ctLower.includes('hematologic');
      
      // If user has a solid tumor but test is for blood cancers, don't match
      if (isSolidTumor && isBloodTest) {
        return false;
      }
      
      // If user has blood cancer but test is specifically for solid tumors only, don't match
      if (isBloodCancer && (ctLower === 'solid tumor' || ctLower === 'all solid tumors')) {
        return false;
      }
      
      // Multi-cancer/pan-cancer solid tumor tests match solid tumors
      if (isSolidTumor && (ctLower.includes('multi-solid') || ctLower.includes('pan-cancer') || ctLower === 'solid tumor' || ctLower === 'all solid tumors')) {
        return true;
      }
      
      // Multi-solid specifically for 'other-solid' selection
      if (cancerType === 'other-solid' && (ctLower.includes('multi') || ctLower.includes('pan-') || ctLower.includes('solid'))) {
        return true;
      }
      
      // Check specific matches
      return searchTerms.some(term => ctLower.includes(term.toLowerCase()));
    });
  };

  // Filter and match tests based on wizard data with new logic
  const getMatchingTests = () => {
    if (!testData || testData.length === 0) {
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
      ];
    }

    // Apply all filters
    let filtered = testData.filter(test => {
      // 1. Filter by region/location
      if (wizardData.country && !isTestAvailableInRegion(test, wizardData.country)) {
        return false;
      }

      // 2. Filter by cancer type
      if (!matchesCancerType(test, wizardData.cancerType)) {
        return false;
      }

      // 3. Filter by tumor tissue availability
      if (wizardData.hasTumorTissue === 'no') {
        // No tumor tissue: only show tumor-naive tests
        const approach = test.approach?.toLowerCase() || '';
        const isTumorInformed = approach.includes('tumor-informed');
        // Handle both "naive" and "naïve" (with special i character)
        const isTumorNaive = approach.includes('tumor-naive') || approach.includes('tumor-naïve');
        
        // Exclude if tumor-informed only (not also tumor-naive)
        if (isTumorInformed && !isTumorNaive) {
          return false;
        }
        // Also exclude if explicitly requires tumor tissue
        if (test.requiresTumorTissue === 'Yes') {
          return false;
        }
      } else if (wizardData.hasTumorTissue === 'yes') {
        // Has tumor tissue: only show tumor-informed tests (they're more sensitive)
        const approach = test.approach?.toLowerCase() || '';
        const isTumorInformed = approach.includes('tumor-informed');
        // Handle both "naive" and "naïve" (with special i character)
        const isTumorNaive = approach.includes('tumor-naive') || approach.includes('tumor-naïve');
        
        // Exclude if tumor-naive only (not also tumor-informed)
        if (isTumorNaive && !isTumorInformed) {
          return false;
        }
      }
      // If 'not-sure', show all tests

      // 4. Financial filtering logic
      if (wizardData.hasInsurance === true && wizardData.insuranceProvider) {
        // Has insurance: only show tests covered by their insurance
        if (wizardData.insuranceProvider !== 'other') {
          if (!isTestCoveredByInsurance(test, wizardData.insuranceProvider)) {
            return false;
          }
        }
        // If "other" insurance selected, show all tests (can't filter)
      } else if (wizardData.hasInsurance === false) {
        // No insurance
        if (wizardData.costSensitivity === 'cost-sensitive') {
          // Cost sensitive: only show tests with financial assistance
          if (!checkFinancialAssistance(test)) {
            return false;
          }
        }
        // If not cost sensitive, show all tests
      }

      return true;
    });

    // Add financial assistance flag and match reasons
    return filtered.map(test => ({
      ...test,
      hasFinancialAssistance: checkFinancialAssistance(test),
      matchReason: generateMatchReason(test, wizardData),
    }));
  };

  // Generate a match reason based on test and wizard data
  const generateMatchReason = (test, data) => {
    const reasons = [];
    
    if (data.hasInsurance && data.insuranceProvider && data.insuranceProvider !== 'other') {
      const providerLabel = ALL_INSURANCE_PROVIDERS.find(p => p.id === data.insuranceProvider)?.label;
      if (providerLabel && isTestCoveredByInsurance(test, data.insuranceProvider)) {
        reasons.push(`Covered by ${providerLabel}`);
      }
    }
    
    if (test.approach?.toLowerCase().includes('tumor-informed') && data.hasTumorTissue === 'yes') {
      reasons.push('Uses your saved tumor tissue for personalized detection');
    } else if (test.approach?.toLowerCase().includes('tumor-naive') && data.hasTumorTissue === 'no') {
      reasons.push('Works without tumor tissue');
    }
    
    if (checkFinancialAssistance(test) && (!data.hasInsurance || data.costSensitivity === 'cost-sensitive')) {
      reasons.push('Financial assistance available');
    }
    
    return reasons.length > 0 ? reasons.join(' • ') : null;
  };

  // Apply comparative badges to the matching tests, then sort by badge count (more badges = higher)
  const matchingTests = calculateComparativeBadges(getMatchingTests(), 'mrd')
    .sort((a, b) => {
      const aBadges = a.comparativeBadges?.length || 0;
      const bBadges = b.comparativeBadges?.length || 0;
      return bBadges - aBadges; // Higher badge count first
    });
  const showFinancialNote = wizardData.costSensitivity === 'cost-sensitive' || wizardData.hasInsurance === false;
  const showInsuranceCoverageNote = wizardData.hasInsurance === true && wizardData.insuranceProvider && wizardData.insuranceProvider !== 'other';

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {matchingTests.length > 0 ? content.heading : content.noResultsHeading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {matchingTests.length > 0 ? content.description : content.noResultsDescription}
      </p>

      {/* Insurance coverage note */}
      {showInsuranceCoverageNote && matchingTests.length > 0 && (
        <div className={`max-w-lg mx-auto mb-6 bg-green-50 border-green-200 border rounded-xl p-4`}>
          <div className="flex gap-3">
            <span className="text-xl">✓</span>
            <p className={`text-sm text-green-800`}>
              <span className="font-semibold">{content.insuranceCoverageNote.boldText}</span> {content.insuranceCoverageNote.text}
            </p>
          </div>
        </div>
      )}

      {/* Financial assistance note */}
      {showFinancialNote && !showInsuranceCoverageNote && matchingTests.length > 0 && (
        <div className={`max-w-lg mx-auto mb-6 ${colors.bg} ${colors.border} border rounded-xl p-4`}>
          <div className="flex gap-3">
            <span className="text-xl">💰</span>
            <p className={`text-sm ${colors.textDark}`}>
              <span className="font-semibold">{content.financialNote.boldText}</span> {content.financialNote.text}
            </p>
          </div>
        </div>
      )}

      {/* No results message */}
      {matchingTests.length === 0 && (
        <div className="max-w-lg mx-auto mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-amber-900 text-sm">
                No tests matched all your criteria. Try selecting "Other insurance" or adjusting your answers. Your oncologist can help identify the best option for your situation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clickable hint header */}
      {matchingTests.length > 0 && (
        <div className="max-w-lg mx-auto mb-4">
          <div className={`flex items-center justify-center gap-2 text-sm ${colors.text} bg-emerald-50/50 rounded-lg py-2 px-4`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <span>Click any test below for a personalized summary</span>
          </div>
        </div>
      )}

      {/* Test cards - split into featured (with badges) and more tests (without badges) */}
      {(() => {
        // Only split into featured/more if we have more than 4 tests total
        // Otherwise show all tests in the main grid
        const shouldCollapse = matchingTests.length > 4;
        const featuredTests = shouldCollapse 
          ? matchingTests.filter(t => t.comparativeBadges?.length > 0)
          : matchingTests;
        const moreTests = shouldCollapse 
          ? matchingTests.filter(t => !t.comparativeBadges?.length)
          : [];
        
        // Helper to render a single test card
        const renderTestCard = (test) => {
          const showFinancialAssistance = test.hasFinancialAssistance && (
            wizardData.hasInsurance === false ||
            wizardData.insuranceProvider === 'other' ||
            wizardData.costSensitivity === 'cost-sensitive'
          );
          const isUSUser = wizardData.country === 'US';
          const availabilityTier = isUSUser ? getVendorAvailabilityUS(test.vendor) : null;
          const isWidelyAvailable = availabilityTier === 'widespread';
          
          return (
            <div
              key={test.id}
              className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="p-4">
                <ComparativeBadgeRow badges={test.comparativeBadges} />
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{test.name}</h3>
                    <p className="text-sm text-slate-500">{test.vendor}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {showFinancialAssistance && (
                      <span className={`${colors.accentLight} ${colors.text} text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1`}>
                        💵 Assistance
                      </span>
                    )}
                    {isWidelyAvailable && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        Widely Available
                      </span>
                    )}
                  </div>
                </div>
                {test.matchReason && (
                  <p className={`text-sm ${colors.text} mb-2 line-clamp-2`}>{test.matchReason}</p>
                )}
              </div>
              <div className="px-4 pb-4 flex flex-col gap-2">
                <button
                  onClick={() => setSelectedTest(test)}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Personalized summary
                </button>
                <button
                  onClick={() => setDetailTest(test)}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Technical details
                </button>
              </div>
            </div>
          );
        };
        
        return (
          <div className="max-w-5xl mx-auto mb-8 px-4">
            {/* Featured tests (with badges) - 2 column grid */}
            {featuredTests.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {featuredTests.map(renderTestCard)}
              </div>
            )}
            
            {/* More tests section (without badges) - collapsible */}
            {moreTests.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowMoreTests(!showMoreTests)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 font-medium transition-colors"
                >
                  <span>More tests ({moreTests.length})</span>
                  <svg 
                    className={`w-5 h-5 transition-transform ${showMoreTests ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showMoreTests && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {moreTests.map(renderTestCard)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Test Summary Modal */}
      {selectedTest && (
        <TestSummaryModal
          test={selectedTest}
          wizardData={wizardData}
          onClose={() => setSelectedTest(null)}
        />
      )}

      {/* Full Test Detail Modal */}
      {detailTest && (
        <TestDetailModal
          test={detailTest}
          category="MRD"
          onClose={() => setDetailTest(null)}
        />
      )}
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

  // Determine starting step: skip to step 3 (cancer-type) if cancer type is pre-filled
  const initialStep = mappedCancerType ? 3 : 0;

  // Current step in the wizard (0-indexed)
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Wizard data collected from user
  const [wizardData, setWizardData] = useState({
    country: null,              // Selected country/region
    cancerType: mappedCancerType,           // Selected cancer type or 'not-sure'
    hasTumorTissue: null,       // 'yes', 'no', or 'not-sure'
    completedTreatment: null,   // 'yes' or 'no'
    hasInsurance: undefined,    // true or false
    insuranceProvider: null,    // Insurance provider ID from INSURANCE_PROVIDERS
    costSensitivity: null,      // 'cost-sensitive' or 'not-sensitive'
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
      case 'location':
        return (
          <LocationStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
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
      case 'treatment-gate':
        return (
          <TreatmentGateStep
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
