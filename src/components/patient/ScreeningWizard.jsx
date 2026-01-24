import React, { useState, useRef, useEffect } from 'react';
import { useTestsByCategory } from '../../dal/hooks/useTests';
import { calculateComparativeBadges } from '../../utils/comparativeBadges';
import { ComparativeBadgeRow } from '../badges/ComparativeBadge';

// ============================================================================
// Configuration
// ============================================================================

// Screening journey configuration (sky blue theme)
const screeningJourney = {
  id: 'screening',
  label: 'Screening',
  colors: {
    bg: 'bg-sky-50',
    hover: 'hover:bg-sky-100',
    border: 'border-sky-200',
    accent: 'bg-sky-500',
    text: 'text-sky-700',
  },
};

// Wizard steps
const WIZARD_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Learn about early detection' },
  { id: 'goal', title: 'Your Goal', description: 'What are you looking for?' },
  { id: 'cancer-type', title: 'Cancer Type', description: 'Which cancer to screen for?' },
  { id: 'doctor', title: 'Doctor', description: 'Working with your doctor' },
  { id: 'cost', title: 'Cost', description: 'Budget considerations' },
  { id: 'results', title: 'Results', description: 'Tests that match your needs' },
  { id: 'next-steps', title: 'Next Steps', description: 'What to do now' },
];

// Screening goal options
const GOAL_OPTIONS = [
  { id: 'multi-cancer', label: 'Many cancers at once', description: 'Screen for 50+ cancer types with one test' },
  { id: 'specific-cancer', label: 'A specific cancer', description: 'Target one cancer type for focused screening' },
  { id: 'not-sure', label: 'Not sure yet', description: "We'll help you understand your options" },
];

// Specific cancer type options (for single-cancer screening)
const CANCER_TYPE_OPTIONS = [
  { id: 'colorectal', label: 'Colorectal', description: 'Colon and rectal cancer' },
  { id: 'liver', label: 'Liver', description: 'Hepatocellular carcinoma' },
  { id: 'lung', label: 'Lung', description: 'Lung cancer screening' },
  { id: 'other', label: 'Other', description: 'Ask your doctor about other options' },
];

// Doctor involvement options
const DOCTOR_OPTIONS = [
  { id: 'has-doctor', label: 'Yes, I have a doctor', description: 'My doctor can order tests for me' },
  { id: 'needs-doctor', label: 'I need help finding one', description: 'Show me tests with ordering support' },
  { id: 'self-order', label: 'I want to order myself', description: 'Show me direct-to-consumer options' },
];

// Cost sensitivity tiers
const COST_OPTIONS = [
  { id: 'budget-conscious', label: 'Budget-conscious', description: 'I need the most affordable option', tier: 1 },
  { id: 'value-focused', label: 'Value-focused', description: 'Balance of cost and coverage', tier: 2 },
  { id: 'comprehensive', label: 'Comprehensive', description: 'Best coverage regardless of cost', tier: 3 },
];

// Build color scheme (sky blue theme)
const colors = {
  bg: screeningJourney.colors.bg,
  bgLight: 'bg-sky-50/50',
  bgGradient: 'from-sky-50/50 to-white',
  border: screeningJourney.colors.border,
  borderLight: 'border-sky-100',
  accent: screeningJourney.colors.accent,
  accentHover: 'hover:bg-sky-600',
  accentLight: 'bg-sky-100',
  text: screeningJourney.colors.text,
  textDark: 'text-sky-900',
  textLight: 'text-sky-600',
  ring: 'ring-sky-500',
  focus: 'focus:ring-sky-500',
};

// Step content - all strings centralized for easy editing
const CONTENT = {
  welcome: {
    headline: 'Catching Cancer Early',
    intro: {
      boldText: 'Early detection',
      text: ' can make all the difference. Blood-based screening tests can find cancer signals before symptoms appear.',
    },
    benefits: {
      text: 'When cancer is found early, treatment is often',
      boldText: 'more effective',
      endText: ' and less invasive.',
    },
    coverage: {
      title: 'From single to 50+ cancer types',
      description: 'Modern screening tests range from targeting one cancer to comprehensive multi-cancer detection',
    },
    buttonText: "Let's explore your options",
  },
  goal: {
    heading: 'What are you looking for?',
    description: 'This helps us find the right type of screening test for you',
  },
  cancerType: {
    heading: 'Which cancer are you most interested in screening for?',
    description: 'Select the cancer type you want to focus on',
  },
  doctor: {
    heading: 'Do you have a doctor to work with?',
    description: 'Some tests require a doctor\'s order, others can be ordered directly',
  },
  cost: {
    heading: 'What\'s your budget preference?',
    description: 'This helps us highlight tests that fit your financial situation',
    insuranceNote: 'Many screening tests are not covered by insurance. We\'ll show you options at different price points.',
  },
  results: {
    heading: 'Tests That Match Your Needs',
    description: 'Based on your answers, here are screening tests to consider',
    noResultsMessage: 'No tests match your exact criteria. Try adjusting your preferences.',
    actions: {
      save: 'Save results',
      email: 'Email list',
      print: 'Print for doctor',
    },
    nextButtonLabel: 'See next steps',
  },
  nextSteps: {
    heading: 'What Now?',
    description: "Here's how to move forward with early detection screening",
    talkToDoctor: {
      title: 'Talk to Your Doctor',
      description: 'Discuss these options with your healthcare provider. They can help determine which test is right for your risk profile and health history.',
    },
    questionsTitle: 'Questions to Ask Your Doctor',
    questionsList: [
      'Am I a good candidate for cancer screening blood tests?',
      'Which screening test would you recommend based on my risk factors?',
      'What happens if a screening test comes back positive?',
      'How often should I repeat screening tests?',
      'Are there any risks or downsides to screening I should know about?',
      'Will insurance cover any of these tests?',
    ],
    printQuestionsLabel: 'Print These Questions',
    doneLabel: 'Done',
  },
};

// ============================================================================
// Helper Components
// ============================================================================

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
                  ? `${colors.accent} text-white cursor-pointer hover:bg-sky-600`
                  : isCurrent
                    ? `${colors.accentLight} ${colors.text} border-2 border-sky-500`
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

function InfoBox({ children, className = '' }) {
  return (
    <div className={`${colors.bg} ${colors.border} border rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

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
          : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'
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

function WelcomeStep({ onNext }) {
  const content = CONTENT.welcome;

  return (
    <div className="text-center py-6">
      {/* Icon */}
      <div className={`w-20 h-20 mx-auto mb-6 ${colors.accentLight} rounded-full flex items-center justify-center`}>
        <svg className={`w-10 h-10 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

        <InfoBox>
          <p className="text-slate-700">
            {content.benefits.text}{' '}
            <span className={`font-semibold ${colors.textDark}`}>{content.benefits.boldText}</span>{' '}
            {content.benefits.endText}
          </p>
        </InfoBox>

        <div className={`${colors.accentLight} ${colors.border} border rounded-xl p-5 flex items-center gap-4`}>
          <div className={`w-12 h-12 ${colors.accent} rounded-full flex items-center justify-center flex-shrink-0`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className={`font-semibold ${colors.textDark}`}>{content.coverage.title}</p>
            <p className="text-sm text-slate-600">
              {content.coverage.description}
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

function GoalStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.goal;

  const handleSelect = (goal) => {
    setWizardData(prev => ({ ...prev, goal }));
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

      <div className="max-w-lg mx-auto space-y-3">
        {GOAL_OPTIONS.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.goal === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <span className="font-medium text-slate-900">{option.label}</span>
            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
          </OptionButton>
        ))}
      </div>

      <NavigationButtons onBack={onBack} showBack={true} onNext={onNext} nextDisabled={!wizardData.goal} />
    </div>
  );
}

function CancerTypeStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.cancerType;

  const handleSelect = (specificCancer) => {
    setWizardData(prev => ({ ...prev, specificCancer }));
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

      <div className="max-w-lg mx-auto space-y-3">
        {CANCER_TYPE_OPTIONS.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.specificCancer === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <span className="font-medium text-slate-900">{option.label}</span>
            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
          </OptionButton>
        ))}
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.specificCancer} />
    </div>
  );
}

function DoctorStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.doctor;

  const handleSelect = (doctorStatus) => {
    setWizardData(prev => ({ ...prev, doctorStatus }));
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

      <div className="max-w-lg mx-auto space-y-3">
        {DOCTOR_OPTIONS.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.doctorStatus === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <span className="font-medium text-slate-900">{option.label}</span>
            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
          </OptionButton>
        ))}
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.doctorStatus} />
    </div>
  );
}

function CostStep({ wizardData, setWizardData, onNext, onBack }) {
  const content = CONTENT.cost;

  const handleSelect = (costPreference) => {
    setWizardData(prev => ({ ...prev, costPreference }));
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

      <div className="max-w-lg mx-auto space-y-3 mb-6">
        {COST_OPTIONS.map((option) => (
          <OptionButton
            key={option.id}
            selected={wizardData.costPreference === option.id}
            onClick={() => handleSelect(option.id)}
          >
            <span className="font-medium text-slate-900">{option.label}</span>
            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
          </OptionButton>
        ))}
      </div>

      {/* Insurance note */}
      <div className="max-w-lg mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              {content.insuranceNote}
            </p>
          </div>
        </div>
      </div>

      <NavigationButtons onBack={onBack} onNext={onNext} nextDisabled={!wizardData.costPreference} />
    </div>
  );
}

function ResultsStep({ wizardData, testData, onNext, onBack }) {
  const content = CONTENT.results;

  // Filter ECD tests based on wizard data
  const getMatchingTests = () => {
    let filteredTests = [...testData];

    // Filter by goal (multi-cancer vs single-cancer)
    if (wizardData.goal === 'multi-cancer') {
      // Multi-cancer tests: testScope contains "multi" or "MCED"
      filteredTests = filteredTests.filter(test => {
        const scope = (test.testScope || '').toLowerCase();
        return scope.includes('multi') || scope.includes('mced');
      });
    } else if (wizardData.goal === 'specific-cancer') {
      // Single cancer tests: match cancerTypes
      filteredTests = filteredTests.filter(test => {
        const scope = (test.testScope || '').toLowerCase();
        const isMultiCancer = scope.includes('multi') || scope.includes('mced');

        if (isMultiCancer) return false; // Exclude multi-cancer tests

        // Match specific cancer type
        const cancerTypes = test.cancerTypes || [];
        const cancerTypesLower = cancerTypes.map(c => c.toLowerCase()).join(' ');

        switch (wizardData.specificCancer) {
          case 'colorectal':
            return cancerTypesLower.includes('colorectal') || cancerTypesLower.includes('colon') || cancerTypesLower.includes('rectal');
          case 'liver':
            return cancerTypesLower.includes('liver') || cancerTypesLower.includes('hepato');
          case 'lung':
            return cancerTypesLower.includes('lung');
          case 'other':
            return true; // Show all single-cancer tests for "other"
          default:
            return true;
        }
      });
    }
    // 'not-sure' shows all tests

    // Sort by list price if cost preference is budget-conscious
    if (wizardData.costPreference === 'budget-conscious') {
      filteredTests = filteredTests.sort((a, b) => {
        const priceA = a.listPrice || 9999;
        const priceB = b.listPrice || 9999;
        return priceA - priceB;
      });
    }

    return filteredTests.slice(0, 5); // Limit to 5 results
  };

  // Apply comparative badges to the matching tests
  const matchingTests = calculateComparativeBadges(getMatchingTests(), 'ecd');

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return 'Contact for pricing';
    return `$${price.toLocaleString()}`;
  };

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {content.heading}
      </h2>
      <p className="text-slate-600 text-center mb-8">
        {content.description}
      </p>

      {/* Test cards */}
      <div className="max-w-lg mx-auto space-y-4 mb-8">
        {matchingTests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {content.noResultsMessage}
          </div>
        ) : (
          matchingTests.map((test) => (
            <div
              key={test.id}
              className="bg-white border-2 border-slate-200 rounded-xl p-5 hover:border-sky-300 transition-colors"
            >
              {/* Comparative badges */}
              <ComparativeBadgeRow badges={test.comparativeBadges} />

              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{test.name}</h3>
                  <p className="text-sm text-slate-500">{test.vendor}</p>
                </div>
                <span className={`${colors.accentLight} ${colors.text} text-xs font-medium px-2 py-1 rounded-full`}>
                  {formatPrice(test.listPrice)}
                </span>
              </div>

              {/* Test scope badge */}
              <div className="mb-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  {test.testScope || 'Screening'}
                </span>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {test.sensitivity && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Sensitivity: {test.sensitivity}%</span>
                  </div>
                )}
                {test.specificity && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Specificity: {test.specificity}%</span>
                  </div>
                )}
              </div>

              {/* FDA status */}
              {test.fdaStatus && (
                <p className="text-xs text-slate-500 mt-2">
                  {test.fdaStatus.includes('FDA') ? test.fdaStatus : `Status: ${test.fdaStatus}`}
                </p>
              )}
            </div>
          ))
        )}
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
        {/* Talk to doctor section */}
        <InfoBox>
          <h3 className={`font-semibold ${colors.textDark} mb-3 flex items-center gap-2`}>
            <span className="text-xl">👩‍⚕️</span>
            {content.talkToDoctor.title}
          </h3>
          <p className="text-slate-700 text-sm">
            {content.talkToDoctor.description}
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
                     hover:bg-sky-200 transition-colors flex items-center justify-center gap-2`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {content.printQuestionsLabel}
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
 * ScreeningWizard - Multi-step wizard for ECD test discovery
 *
 * Guides healthy individuals through finding the right early detection screening test.
 *
 * @param {Object} props
 * @param {Function} props.onComplete - Called when wizard completes with all selections
 * @param {Function} props.onBack - Called when user wants to exit wizard (back to landing)
 * @param {Function} props.onNavigate - Alternative navigation handler (used by App.jsx)
 */
export default function ScreeningWizard({ onComplete, onBack, onNavigate }) {
  // Get ECD tests via DAL
  const { tests: ecdTests } = useTestsByCategory('ECD');

  // Current step in the wizard (0-indexed)
  const [currentStep, setCurrentStep] = useState(0);

  // Wizard data collected from user
  const [wizardData, setWizardData] = useState({
    goal: null,              // 'multi-cancer', 'specific-cancer', 'not-sure'
    specificCancer: null,    // 'colorectal', 'liver', 'lung', 'other'
    doctorStatus: null,      // 'has-doctor', 'needs-doctor', 'self-order'
    costPreference: null,    // 'budget-conscious', 'value-focused', 'comprehensive'
  });

  // Ref for scrolling to top on step change
  const containerRef = useRef(null);

  // Scroll to top when step changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Navigation handlers
  const handleNext = () => {
    // Skip cancer type step if not choosing specific cancer
    if (WIZARD_STEPS[currentStep].id === 'goal' && wizardData.goal !== 'specific-cancer') {
      // Skip to doctor step (index 3)
      setCurrentStep(3);
      return;
    }

    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    // If on doctor step and goal isn't specific-cancer, go back to goal step
    if (WIZARD_STEPS[currentStep].id === 'doctor' && wizardData.goal !== 'specific-cancer') {
      setCurrentStep(1); // Go to goal step
      return;
    }

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

  // Handle exit - supports onBack and onNavigate props
  const handleExit = () => {
    if (onBack) {
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
      case 'goal':
        return (
          <GoalStep
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
      case 'doctor':
        return (
          <DoctorStep
            wizardData={wizardData}
            setWizardData={setWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 'cost':
        return (
          <CostStep
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
            testData={ecdTests}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">{screeningJourney.label} Journey</h1>
              <p className="text-sm text-slate-500">Early Detection Guide</p>
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
          Always consult with your healthcare provider about your specific situation.
        </p>
      </main>
    </div>
  );
}
