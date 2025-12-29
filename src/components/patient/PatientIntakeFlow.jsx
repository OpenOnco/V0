import React, { useState, useRef } from 'react';
import { PATIENT_INFO_CONTENT } from '../../config/patientContent';
import Chat from '../Chat';

/**
 * Journey card content configuration
 */
const JOURNEY_CARDS = {
  tds: {
    id: 'tds',
    title: 'Choosing the Right Treatment',
    subtitle: 'Tests that help guide therapy decisions',
    image: '/images/journey-treatment.png',
    imageAlt: 'Doctor and patient in conversation',
    modalKey: 'therapy',
    label: 'Choosing Treatment',
  },
  trm: {
    id: 'trm',
    title: 'Tracking Treatment Response',
    subtitle: 'Tests that monitor how well treatment is working',
    image: '/images/journey-tracking.png',
    imageAlt: 'Patient during treatment, smiling',
    modalKey: 'monitoring',
    label: 'Tracking Response',
  },
  mrd: {
    id: 'mrd',
    title: 'Keeping Watch After Treatment',
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
 * Journey card with two CTA buttons
 */
const JourneyCard = ({ code, card, onSelect, isUnlocked }) => {
  return (
    <div 
      className={`relative rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-800 transition-all ${
        isUnlocked ? 'hover:shadow-lg hover:border-slate-300' : 'opacity-50'
      }`}
    >
      {/* Image */}
      <div className="aspect-[4/3]">
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
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
      
      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="font-semibold text-sm leading-tight mb-1">{card.title}</h3>
        <p className="text-xs text-white/70 mb-3">{card.subtitle}</p>
        
        {/* Two CTA buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => isUnlocked && onSelect(code, 'learn')}
            disabled={!isUnlocked}
            className="w-full py-2 px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span>📚</span>
            <span>Learn about this</span>
          </button>
          <button
            onClick={() => isUnlocked && onSelect(code, 'find')}
            disabled={!isUnlocked}
            className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span>🔍</span>
            <span>Find the right test</span>
          </button>
        </div>
      </div>
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
  
  const step2Ref = useRef(null);
  const step3Ref = useRef(null);
  
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
  
  // Handle journey + mode selection from card buttons
  const handleJourneySelect = (journeyCode, mode) => {
    setSelectedJourney(journeyCode);
    setChatMode(mode);
    setCurrentStep(3);
    
    // Scroll to step 3
    setTimeout(() => {
      step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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
              Choose to learn about testing or find the right test for you
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
              <JourneyCard
                key={code}
                code={code}
                card={card}
                onSelect={handleJourneySelect}
                isUnlocked={isStep1Complete}
              />
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
        <div className="flex items-start gap-4 mb-5">
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
        
        {isStep2Complete && (
          <Chat 
            key={`${selectedJourney}-${chatMode}`} // Reset chat when selections change
            persona="patient"
            testData={testData}
            variant="full"
            showModeToggle={false}
            resizable={false}
            showTitle={false}
            initialHeight={300}
            patientContext={getChatContext()}
          />
        )}
      </div>
    </div>
  );
};

export default PatientIntakeFlow;
