import React, { useState, useRef } from 'react';
import { PATIENT_INFO_CONTENT } from '../../config/patientContent';
import Chat from '../Chat';
import TestDetailModal from '../test/TestDetailModal';
import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../../data';

/**
 * Journey card content configuration
 */
const JOURNEY_CARDS = {
  tds: {
    id: 'tds',
    title: 'Tests that help choose my treatment',
    subtitle: 'Tests that help guide therapy decisions',
    image: '/images/journey-treatment.png',
    imageAlt: 'Doctor and patient in conversation',
    modalKey: 'therapy',
    label: 'Choosing Treatment',
  },
  trm: {
    id: 'trm',
    title: 'Tests that track my response to treatment',
    subtitle: 'Tests that monitor how well treatment is working',
    image: '/images/journey-tracking.png',
    imageAlt: 'Patient during treatment, smiling',
    modalKey: 'monitoring',
    label: 'Tracking Response',
  },
  mrd: {
    id: 'mrd',
    title: 'Tests that watch over me after treatment',
    subtitle: 'Tests that give you peace of mind',
    image: '/images/journey-keeping-watch.png',
    imageAlt: 'Survivor outdoors hiking',
    modalKey: 'surveillance',
    label: 'Keeping Watch After Treatment',
  },
};

/**
 * Cancer types for dropdown
 */
const CANCER_TYPES = [
  'Breast Cancer',
  'Colorectal Cancer',
  'Lung Cancer',
  'Prostate Cancer',
  'Ovarian Cancer',
  'Pancreatic Cancer',
  'Bladder Cancer',
  'Melanoma',
  'Multiple Myeloma',
  'Lymphoma',
  'Leukemia',
  'Other / Multiple',
];

/**
 * Educational modal component with two CTA buttons
 */
const EducationalModal = ({ journeyCode, onClose, onContinue }) => {
  if (!journeyCode || !JOURNEY_CARDS[journeyCode]) return null;
  
  const card = JOURNEY_CARDS[journeyCode];
  const info = PATIENT_INFO_CONTENT[card.modalKey];
  
  if (!info) return null;
  
  const colorSchemes = {
    violet: { bg: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', icon: 'bg-violet-100' },
    rose: { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'bg-rose-100' },
    orange: { bg: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'bg-orange-100' },
  };
  const colors = colorSchemes[info.color] || colorSchemes.violet;
  
  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - compact */}
        <div className="px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl ${colors.icon} flex items-center justify-center flex-shrink-0`}>
              <span className="text-2xl">{info.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900">{info.title}</h2>
              <p className="text-sm text-slate-500">{info.subtitle}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content - scrollable, compact */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-3">
            {info.content.map((section, idx) => (
              <div key={idx}>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">{section.heading}</h3>
                {section.text && (
                  <p className="text-slate-600 leading-relaxed text-sm">{section.text}</p>
                )}
                {section.list && (
                  <ul className="mt-1.5 space-y-1">
                    {section.list.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-600 text-sm">
                        <span className="text-blue-500 mt-0.5">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer - prominent CTAs */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex-shrink-0 bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-500 mb-2 text-center">What would you like to do?</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onContinue('find')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
            >
              <span className="text-slate-700 font-medium text-sm">Find the right tests for me</span>
              <span className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all">→</span>
            </button>
            <button
              onClick={() => onContinue('learn')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
            >
              <span className="text-slate-500 text-sm">Or, learn more about these tests</span>
              <span className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Step indicator component
 */
const StepIndicator = ({ currentStep }) => {
  return (
    <div className="flex justify-center gap-2 mb-6">
      {[1, 2, 3].map(step => (
        <div
          key={step}
          className={`w-10 h-1 rounded-full transition-colors ${
            step < currentStep ? 'bg-emerald-500' :
            step === currentStep ? 'bg-blue-600' :
            'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
};

/**
 * Main patient intake flow component
 */
const PatientIntakeFlow = ({ testData }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCancer, setSelectedCancer] = useState('');
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [chatMode, setChatMode] = useState(null); // 'learn' | 'find'
  const [showModal, setShowModal] = useState(false);
  const [pendingJourney, setPendingJourney] = useState(null);
  const [selectedTestForModal, setSelectedTestForModal] = useState(null); // For test detail popup
  
  const step2Ref = useRef(null);
  const step3Ref = useRef(null);
  
  // All test data for lookup
  const allTestData = {
    MRD: mrdTestData,
    ECD: ecdTestData,
    TRM: trmTestData,
    TDS: tdsTestData
  };
  
  // Handle clicking a test link in chat - show detail modal
  const handleTestClick = (testIds) => {
    if (!testIds || testIds.length === 0) return;
    const testId = testIds[0]; // Just use first one
    
    // Parse category from ID (e.g., 'mrd-1' -> 'MRD')
    const match = testId.match(/^([a-z]+)-/);
    if (!match) return;
    
    const categoryMap = { mrd: 'MRD', ecd: 'ECD', trm: 'TRM', tds: 'TDS' };
    const category = categoryMap[match[1]];
    if (!category) return;
    
    // Find the test in that category
    const tests = allTestData[category];
    const test = tests?.find(t => t.id === testId);
    if (test) {
      setSelectedTestForModal({ test, category });
    }
  };
  
  // Handle cancer type selection
  const handleCancerSelect = (value) => {
    if (!value) return;
    setSelectedCancer(value);
    setCurrentStep(2);
    
    // Scroll to step 2
    setTimeout(() => {
      step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };
  
  // Handle journey card click - show modal
  const handleJourneyClick = (journeyCode) => {
    setPendingJourney(journeyCode);
    setShowModal(true);
  };
  
  // Continue from modal with selected mode
  const handleModalContinue = (mode) => {
    setSelectedJourney(pendingJourney);
    setChatMode(mode);
    setShowModal(false);
    setCurrentStep(3);
    
    // Scroll to step 3
    setTimeout(() => {
      step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };
  
  // Handle mode switch
  const handleModeSwitch = () => {
    const newMode = chatMode === 'learn' ? 'find' : 'learn';
    setChatMode(newMode);
  };
  
  // Reset to step 1
  const handleStartOver = () => {
    setSelectedCancer('');
    setSelectedJourney(null);
    setChatMode(null);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Change cancer type (go back to step 1)
  const handleChangeCancer = () => {
    setSelectedCancer('');
    setSelectedJourney(null);
    setChatMode(null);
    setCurrentStep(1);
  };
  
  // Change journey (go back to step 2)
  const handleChangeJourney = () => {
    setSelectedJourney(null);
    setChatMode(null);
    setCurrentStep(2);
    setTimeout(() => {
      step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };
  
  // Get chat context for pre-seeding
  const getChatContext = () => {
    if (!selectedCancer || !selectedJourney) return null;
    const journey = JOURNEY_CARDS[selectedJourney];
    return {
      cancerType: selectedCancer,
      journeyStage: journey?.label || '',
      journeyCode: selectedJourney,
      chatMode: chatMode, // 'learn' or 'find'
    };
  };
  
  const isStep1Complete = currentStep > 1;
  const isStep2Complete = currentStep > 2;
  
  // Get mode label for display
  const getModeLabel = () => {
    return chatMode === 'learn' ? 'Learning' : 'Finding Tests';
  };
  
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
          Find the Right Test in 3 Simple Steps
        </h1>
        <p className="text-slate-500">
          We'll guide you to relevant blood tests based on your situation.
        </p>
        <StepIndicator currentStep={currentStep} />
      </div>
      
      {/* Breadcrumb (shows after step 2) */}
      {isStep2Complete && (
        <div className="flex items-center gap-2 mb-5 text-sm flex-wrap">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
            {selectedCancer}
          </span>
          <span className="text-slate-300">→</span>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
            {JOURNEY_CARDS[selectedJourney]?.label}
          </span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full font-medium ${
            chatMode === 'learn' 
              ? 'bg-purple-100 text-purple-700' 
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {getModeLabel()}
          </span>
          <button
            onClick={handleStartOver}
            className="ml-auto text-slate-500 hover:text-slate-700 text-sm underline"
          >
            Start over
          </button>
        </div>
      )}
      
      {/* Step 1: Cancer Type */}
      <div className={`bg-white rounded-2xl border p-6 mb-4 transition-all ${
        isStep1Complete 
          ? 'border-emerald-300 bg-emerald-50/50' 
          : 'border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
            isStep1Complete 
              ? 'bg-emerald-500 text-white' 
              : 'bg-blue-600 text-white'
          }`}>
            {isStep1Complete ? '✓' : '1'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              What kind of cancer are you concerned about?
            </h2>
            <p className="text-sm text-slate-500">
              This helps us show you the most relevant tests
            </p>
          </div>
        </div>
        
        {isStep1Complete ? (
          <div className="flex items-center justify-between bg-emerald-100/50 rounded-lg px-4 py-3">
            <span className="font-medium text-emerald-800">{selectedCancer}</span>
            <button
              onClick={handleChangeCancer}
              className="text-blue-600 hover:text-blue-700 text-sm underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative max-w-md">
            <select
              value={selectedCancer}
              onChange={(e) => handleCancerSelect(e.target.value)}
              className="w-full px-4 py-3.5 text-base border-2 border-slate-200 rounded-xl bg-white appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Select cancer type...</option>
              {CANCER_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        )}
      </div>
      
      {/* Step 2: Journey Selection */}
      <div 
        ref={step2Ref}
        className={`bg-white rounded-2xl border p-6 mb-4 transition-all ${
          isStep2Complete 
            ? 'border-emerald-300 bg-emerald-50/50' 
            : isStep1Complete 
              ? 'border-slate-200 shadow-sm' 
              : 'border-slate-200 opacity-40 pointer-events-none'
        }`}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
            isStep2Complete 
              ? 'bg-emerald-500 text-white' 
              : isStep1Complete 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-200 text-slate-400'
          }`}>
            {isStep2Complete ? '✓' : '2'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Where are you in your journey?
            </h2>
            <p className="text-sm text-slate-500">
              Click to learn more about each stage
            </p>
          </div>
        </div>
        
        {isStep2Complete ? (
          <div className="flex items-center justify-between bg-emerald-100/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-medium text-emerald-800">
                {JOURNEY_CARDS[selectedJourney]?.label}
              </span>
              <span className="text-emerald-600">•</span>
              <span className={`text-sm ${chatMode === 'learn' ? 'text-purple-600' : 'text-emerald-600'}`}>
                {getModeLabel()}
              </span>
            </div>
            <button
              onClick={handleChangeJourney}
              className="text-blue-600 hover:text-blue-700 text-sm underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(JOURNEY_CARDS).map(([code, card]) => (
              <button
                key={code}
                onClick={() => handleJourneyClick(code)}
                disabled={!isStep1Complete}
                className="relative rounded-xl overflow-hidden border-2 border-transparent transition-all hover:shadow-lg hover:-translate-y-1 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
              >
                <div className="aspect-[4/3] bg-slate-800">
                  <img 
                    src={card.image} 
                    alt={card.imageAlt}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 items-center justify-center text-slate-400 text-xs hidden"
                  >
                    {card.imageAlt}
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left text-white flex items-end h-1/2">
                  <h3 className="font-bold text-lg leading-snug">{card.title}</h3>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Step 3: Chat */}
      <div 
        ref={step3Ref}
        className={`bg-white rounded-2xl border p-6 transition-all ${
          isStep2Complete 
            ? 'border-slate-200 shadow-sm' 
            : 'border-slate-200 opacity-40 pointer-events-none'
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
              isStep2Complete 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-200 text-slate-400'
            }`}>
              3
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {chatMode === 'learn' 
                  ? 'Learn about these tests' 
                  : 'Let\'s find the right test for you'}
              </h2>
              <p className="text-sm text-slate-500">
                {chatMode === 'learn'
                  ? 'Ask questions and understand your options'
                  : 'Chat with our guide to explore your options'}
              </p>
            </div>
          </div>
          
          {/* Mode switch button */}
          {isStep2Complete && (
            <button
              onClick={handleModeSwitch}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                chatMode === 'learn'
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              {chatMode === 'learn' ? (
                <>
                  <span>🔍</span>
                  <span>Switch to Find Tests</span>
                </>
              ) : (
                <>
                  <span>📚</span>
                  <span>Switch to learn more about tests</span>
                </>
              )}
            </button>
          )}
        </div>
        
        {isStep2Complete && (
          <Chat 
            key={selectedJourney}
            persona="patient"
            testData={testData}
            variant="full"
            showModeToggle={false}
            resizable={true}
            showTitle={false}
            initialHeight={600}
            patientContext={getChatContext()}
            onViewTests={handleTestClick}
          />
        )}
      </div>
      
      {/* Educational Modal */}
      {showModal && (
        <EducationalModal
          journeyCode={pendingJourney}
          onClose={() => setShowModal(false)}
          onContinue={handleModalContinue}
        />
      )}
      
      {/* Test Detail Modal */}
      {selectedTestForModal && (
        <TestDetailModal
          test={selectedTestForModal.test}
          category={selectedTestForModal.category}
          onClose={() => setSelectedTestForModal(null)}
          persona="patient"
        />
      )}
    </div>
  );
};

export default PatientIntakeFlow;
