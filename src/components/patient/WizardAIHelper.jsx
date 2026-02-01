import React, { useState, useRef, useEffect } from 'react';

/**
 * WizardAIHelper - A floating AI chat bubble that helps patients through the wizard
 * 
 * Features:
 * - Floating bubble that expands into a chat panel
 * - Context-aware: knows what step the user is on
 * - Brief, direct responses like a knowledgeable doctor
 * - Mobile responsive: bottom-right on mobile, right of wizard on desktop
 */

// Wizard step descriptions for AI context
const STEP_CONTEXT = {
  'landing': {
    name: 'Introduction',
    description: 'Learning about MRD testing',
    helpTopics: [
      'What is MRD testing?',
      'How does it detect cancer?',
      'Is this right for me?'
    ]
  },
  'test-lookup': {
    name: 'Test Details',
    description: 'Learning about a specific MRD test',
    helpTopics: [
      'How does this test work?',
      'Is it covered by my insurance?',
      'Are there payment plans?'
    ]
  },
  'treatment-gate': {
    name: 'Treatment Status',
    description: 'Checking if treatment is complete',
    helpTopics: [
      'Why does treatment status matter?',
      'What if I\'m still in treatment?',
      'What counts as "completed"?'
    ]
  },
  'location': {
    name: 'Location',
    description: 'Selecting region for test availability',
    helpTopics: [
      'Are tests available outside the US?',
      'Does location affect my options?'
    ]
  },
  'cancer-type': {
    name: 'Cancer Type',
    description: 'Selecting cancer type',
    helpTopics: [
      'Does my cancer type matter?',
      'What if I had multiple cancers?',
      'Not sure of my exact type?'
    ]
  },
  'tumor-tissue': {
    name: 'Tumor Tissue',
    description: 'Checking if tumor tissue was saved',
    helpTopics: [
      'Tumor-informed vs tumor-naive?',
      'How do I find out if tissue was saved?',
      'What if I don\'t have tissue?'
    ]
  },
  'insurance': {
    name: 'Insurance & Coverage',
    description: 'Insurance information',
    helpTopics: [
      'Will insurance cover this?',
      'What if I don\'t have insurance?',
      'Financial assistance programs?'
    ]
  },
  'results': {
    name: 'Test Results',
    description: 'Viewing matching tests',
    helpTopics: [
      'How do I choose between tests?',
      'What do the badges mean?',
      'What\'s sensitivity?'
    ]
  },
  'next-steps': {
    name: 'Next Steps',
    description: 'How to talk to your oncologist',
    helpTopics: [
      'How do I bring this up with my doctor?',
      'What questions should I ask?',
      'How soon can I get tested?'
    ]
  }
};

// Build concise system prompt - direct like a doctor
function buildHelperSystemPrompt(currentStep, wizardData) {
  const stepInfo = STEP_CONTEXT[currentStep] || STEP_CONTEXT['landing'];

  // Build context about what the user has already selected
  const userSelections = [];
  if (wizardData.country) userSelections.push(`Location: ${wizardData.country}`);
  if (wizardData.cancerType) userSelections.push(`Cancer: ${wizardData.cancerType}`);
  if (wizardData.hasTumorTissue) userSelections.push(`Tissue: ${wizardData.hasTumorTissue}`);
  if (wizardData.completedTreatment) userSelections.push(`Treatment done: ${wizardData.completedTreatment}`);
  if (wizardData.insuranceProvider) userSelections.push(`Insurance: ${wizardData.insuranceProvider}`);
  // Test-lookup specific context
  if (wizardData.selectedTest) userSelections.push(`Test: ${wizardData.selectedTest}`);
  if (wizardData.testVendor) userSelections.push(`Vendor: ${wizardData.testVendor}`);
  if (wizardData.testApproach) userSelections.push(`Approach: ${wizardData.testApproach}`);
  if (wizardData.hasMedicareCoverage !== undefined) userSelections.push(`Medicare covered: ${wizardData.hasMedicareCoverage ? 'Yes' : 'Varies'}`);
  
  return `You help patients understand MRD testing. Be warm but BRIEF - 1-2 sentences max. Answer like a knowledgeable friend who happens to be a doctor: direct, clear, no fluff.

CONTEXT: Patient is on "${stepInfo.name}" step of the MRD test finder.
${userSelections.length > 0 ? `Their info: ${userSelections.join(', ')}` : ''}

STYLE RULES:
- 1-2 sentences. Period. No exceptions unless they ask for detail.
- No bullet points, no lists, no headers
- Don't repeat their question back
- Don't say "Great question!" or similar filler
- End with action or reassurance, not "let me know if you have questions"

KEY FACTS (use when relevant):
- MRD = blood test detecting cancer DNA, catches recurrence 6-15 months before scans
- Tumor-informed (Signatera) = needs your tumor tissue, more sensitive
- Tumor-naive (Guardant Reveal) = no tissue needed, still effective
- Most tests covered by Medicare; all major vendors have financial assistance
- Testing typically every 3-6 months; oncologist decides frequency
- Positive result = early warning, not diagnosis; negative = reassuring but keep monitoring

STEP-SPECIFIC:
- Treatment step: MRD is for post-treatment surveillance. Still in treatment → different tests exist.
- Tissue step: Ask your oncologist if tissue was saved. No tissue → tumor-naive tests work fine.
- Insurance step: Financial assistance exists even without insurance. Cost shouldn't stop the conversation.
- Results step: Your oncologist picks the final test. Badges show relative strengths.

NEVER: recommend specific tests, give medical advice, interpret symptoms, make outcome claims.

Be direct. Be helpful. Be brief.`;
}

export default function WizardAIHelper({ currentStep, wizardData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Track window width for responsive positioning
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Desktop threshold - when to switch from mobile to desktop positioning
  // 1024px is when the wizard (max-w-2xl = 672px) + button offset (360px) fits on screen
  const isDesktop = windowWidth >= 1024;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset chat when wizard step changes - show fresh questions for new step
  useEffect(() => {
    setMessages([]);
    setInputValue('');
  }, [currentStep]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Get step info for suggested questions
  const stepInfo = STEP_CONTEXT[currentStep] || STEP_CONTEXT['landing'];

  // Handle sending a message
  const handleSend = async (messageText = inputValue) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'MRD',
          persona: 'patient',
          testData: '[]',
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: 'claude-haiku-4-5-20251001',
          patientChatMode: 'wizard-helper',
          wizardHelperPrompt: buildHelperSystemPrompt(currentStep, wizardData)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.content?.[0]?.text || "I'm sorry, I couldn't generate a response. Please try again."
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick question click
  const handleQuickQuestion = (question) => {
    handleSend(question);
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button - bottom-right on mobile, right of wizard center on desktop */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed z-50
          w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 
          rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-in-out
          bottom-4 sm:bottom-6 lg:bottom-8
          ${isOpen 
            ? 'bg-slate-600 hover:bg-slate-700 rotate-0' 
            : 'bg-emerald-500 hover:bg-emerald-600 animate-pulse hover:animate-none'
          }
        `}
        style={isDesktop 
          ? { left: 'calc(50% + 360px)' }
          : { right: '16px' }
        }
        aria-label={isOpen ? 'Close helper' : 'Open AI helper'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-3xl sm:text-4xl lg:text-5xl">🤔</span>
        )}
      </button>

      {/* Chat Panel - full width with margins on mobile, positioned on desktop */}
      {isOpen && (
        <div 
          className="fixed z-50 
            max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 
            flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300
            bottom-20 sm:bottom-24 lg:bottom-32"
          style={isDesktop 
            ? { left: 'calc(50% + 280px)', width: '384px' }
            : { left: '16px', right: '16px' }
          }
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-sm sm:text-base">Need Help?</h3>
              <p className="text-emerald-100 text-xs truncate">Ask me anything about MRD testing</p>
            </div>
            {/* Close button in header for mobile */}
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-[180px] sm:min-h-[200px] max-h-[40vh] bg-slate-50">
            {messages.length === 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {/* Welcome message */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                  <p className="text-slate-700 text-sm">
                    👋 Quick questions about MRD testing? I'm here to help.
                  </p>
                </div>

                {/* Suggested questions */}
                <div className="space-y-2">
                  {stepInfo.helpTopics.map((topic, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(topic)}
                      className="w-full text-left px-3 py-2.5 bg-white border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors active:bg-emerald-100"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        message.role === 'user'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white text-slate-700 shadow-sm border border-slate-100'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your question..."
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors active:bg-emerald-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
