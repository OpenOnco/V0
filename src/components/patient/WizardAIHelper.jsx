import React, { useState, useRef, useEffect } from 'react';

/**
 * WizardAIHelper - A floating AI chat bubble that helps patients through the wizard
 * 
 * Features:
 * - Floating bubble that expands into a chat panel
 * - Context-aware: knows what step the user is on
 * - Pre-loaded with MRD education, FAQ content, and wizard guidance
 * - Warm, patient-friendly tone
 */

// Wizard step descriptions for AI context
const STEP_CONTEXT = {
  'landing': {
    name: 'Introduction',
    description: 'The patient is on the landing page learning about MRD testing for the first time.',
    helpTopics: [
      'What is MRD testing?',
      'How does it detect cancer?',
      'Is this right for me?'
    ]
  },
  'treatment-gate': {
    name: 'Treatment Status',
    description: 'The patient is being asked if they have completed cancer treatment.',
    helpTopics: [
      'Why does treatment status matter?',
      'What if I\'m still in treatment?',
      'What counts as "completed treatment"?'
    ]
  },
  'location': {
    name: 'Location',
    description: 'The patient is selecting their country/region for test availability.',
    helpTopics: [
      'Are tests available outside the US?',
      'Does location affect my options?'
    ]
  },
  'cancer-type': {
    name: 'Cancer Type',
    description: 'The patient is selecting what type of cancer they were treated for.',
    helpTopics: [
      'Does my cancer type affect which tests work?',
      'What if I had multiple cancers?',
      'What if I\'m not sure of my exact type?'
    ]
  },
  'tumor-tissue': {
    name: 'Tumor Tissue',
    description: 'The patient is being asked if tumor tissue was saved from their surgery/biopsy. This determines tumor-informed vs tumor-naive test eligibility.',
    helpTopics: [
      'What\'s the difference between tumor-informed and tumor-naive?',
      'How do I find out if tissue was saved?',
      'What if I don\'t have tissue?'
    ]
  },
  'insurance': {
    name: 'Insurance & Coverage',
    description: 'The patient is providing insurance information to help filter tests by coverage.',
    helpTopics: [
      'Will my insurance cover MRD testing?',
      'What if I don\'t have insurance?',
      'Are there financial assistance programs?'
    ]
  },
  'results': {
    name: 'Test Results',
    description: 'The patient is viewing MRD tests that match their situation.',
    helpTopics: [
      'How do I choose between these tests?',
      'What do the badges mean?',
      'What\'s sensitivity and specificity?'
    ]
  },
  'next-steps': {
    name: 'Next Steps',
    description: 'The patient has their results and is seeing how to talk to their oncologist.',
    helpTopics: [
      'How do I bring this up with my doctor?',
      'What questions should I ask?',
      'How soon can I get tested?'
    ]
  }
};

// Build the comprehensive system prompt
function buildHelperSystemPrompt(currentStep, wizardData) {
  const stepInfo = STEP_CONTEXT[currentStep] || STEP_CONTEXT['landing'];
  
  // Build context about what the user has already selected
  const userSelections = [];
  if (wizardData.country) userSelections.push(`Location: ${wizardData.country}`);
  if (wizardData.cancerType) userSelections.push(`Cancer type: ${wizardData.cancerType}`);
  if (wizardData.hasTumorTissue) userSelections.push(`Tumor tissue available: ${wizardData.hasTumorTissue}`);
  if (wizardData.completedTreatment) userSelections.push(`Completed treatment: ${wizardData.completedTreatment}`);
  if (wizardData.hasInsurance !== undefined) userSelections.push(`Has insurance: ${wizardData.hasInsurance}`);
  if (wizardData.insuranceProvider) userSelections.push(`Insurance provider: ${wizardData.insuranceProvider}`);
  
  return `You are a friendly, knowledgeable helper guiding a cancer patient through OpenOnco's MRD test finder wizard. You are warm, empathetic, and use simple language.

**CURRENT WIZARD CONTEXT:**
- Current step: ${stepInfo.name}
- Step description: ${stepInfo.description}
- Suggested help topics for this step: ${stepInfo.helpTopics.join(', ')}
${userSelections.length > 0 ? `- User's selections so far: ${userSelections.join('; ')}` : '- User has not made any selections yet'}

**YOUR ROLE:**
1. Answer questions about the current wizard step
2. Explain MRD testing concepts in simple terms
3. Help with decisions they're facing in the wizard
4. Provide reassurance and emotional support
5. Never give medical advice - always defer to their oncologist

**MRD TESTING KNOWLEDGE BASE:**

What is MRD Testing?
MRD stands for "Minimal Residual Disease" or "Molecular Residual Disease." These are blood tests that can detect tiny traces of cancer DNA floating in your bloodstream - even when amounts are too small to see on a CT scan or PET scan. After cancer treatment, MRD tests help answer the question: "Did we get it all?"

How MRD Tests Work:
- Your blood contains tiny fragments of DNA from cells throughout your body
- If cancer cells are present (even microscopic amounts), they release DNA fragments too
- MRD tests look for these cancer-specific DNA fragments
- They can detect cancer at levels 100-1000x smaller than imaging can see

Why This Matters:
- MRD tests can detect cancer recurrence 6-15 months BEFORE a CT or PET scan would show anything
- A negative MRD result gives peace of mind that treatment worked
- A positive result lets your oncologist act early, when options are best
- It's just a simple blood draw - no radiation, no invasive procedures

Tumor-Informed vs Tumor-Naive Tests:
- **Tumor-informed tests** (like Signatera): First analyze your original tumor tissue to find YOUR cancer's unique DNA "fingerprint," then look for that exact fingerprint in your blood. More sensitive, but requires saved tumor tissue.
- **Tumor-naive tests** (like Guardant Reveal): Look for common cancer signals without needing tumor tissue. Good option if tissue wasn't saved or isn't available.

Common Patient Questions:

Q: Is MRD testing right for me?
A: MRD testing is designed for people who have completed curative-intent treatment (surgery, chemo, radiation) and are now in the surveillance/monitoring phase. If you're still in active treatment or have advanced/metastatic cancer, different tests may be more appropriate. Your oncologist can help determine if MRD testing fits your situation.

Q: Will insurance cover this?
A: Coverage varies by test and insurance plan. Medicare covers several MRD tests. Most major private insurers are starting to cover them too. Many test companies also have financial assistance programs - Natera offers payment plans from $25/month, Foundation Medicine has programs where qualifying patients pay $100 maximum, and others have similar programs.

Q: What if I don't have tumor tissue saved?
A: You can still get tested! Tumor-naive tests like Guardant Reveal don't require tissue. They're slightly less sensitive but still very effective. Also, your hospital may have saved tissue without you knowing - ask your oncologist to check.

Q: How often should I test?
A: This varies by cancer type and your doctor's recommendation. Common schedules are every 3-6 months during active surveillance. Your oncologist will determine the right frequency for your situation.

Q: What does a positive result mean?
A: A positive MRD result means the test detected some cancer DNA in your blood. This doesn't necessarily mean cancer is back or visible anywhere - it's an early warning that warrants closer monitoring and discussion with your oncologist about next steps.

Q: What does a negative result mean?
A: A negative result means no cancer DNA was detected. This is reassuring! However, no test is 100% perfect, so continued monitoring with your oncologist is still important.

Q: How accurate are these tests?
A: Modern MRD tests are very accurate - typically 90-100% specificity (meaning very few false positives) and sensitivity varies by test and tumor burden. The "Highest Sensitivity" badge indicates tests with the best detection capabilities.

**WIZARD-SPECIFIC GUIDANCE:**

For the Treatment Gate step:
- MRD testing is specifically for post-treatment surveillance
- If someone hasn't completed treatment, explain they may want to look at Treatment Response Monitoring (TRM) tests instead
- "Completed treatment" includes surgery, chemotherapy, radiation, or combination - they should be in the monitoring/surveillance phase

For the Tumor Tissue step:
- This is about whether tissue was SAVED, not whether they had surgery
- Tissue is typically saved during surgery or biopsy - they can ask their oncologist
- If unsure, recommend they ask their medical team before deciding
- Not having tissue doesn't disqualify them - there are tumor-naive options

For the Insurance step:
- Almost all tests have financial assistance programs
- Even uninsured patients have options
- Cost shouldn't prevent them from discussing MRD testing with their doctor

For the Results step:
- Help explain what the badges mean (Highest Sensitivity, Fastest Results, etc.)
- Explain the difference between tests shown
- Remind them their oncologist will help choose the right one

**COMMUNICATION STYLE:**
- Use "you" and speak directly to them
- Keep responses to 2-4 sentences unless they ask for more detail
- Use simple language, avoid medical jargon
- Be warm and reassuring - this is an anxious time for patients
- Always end by reinforcing that their oncologist can help with specific decisions
- Use emoji sparingly (one per response max) to add warmth

**THINGS TO NEVER DO:**
- Never recommend a specific test over another
- Never give dosing, treatment, or medical advice
- Never diagnose or interpret symptoms
- Never make claims about outcomes or survival
- Never discourage them from talking to their doctor

Remember: You're a guide and educator, not a medical advisor. Your job is to help them understand their options so they can have an informed conversation with their oncologist.`;
}

export default function WizardAIHelper({ currentStep, wizardData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
          testData: '[]', // Not needed for helper
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: 'claude-haiku-4-5-20251001',
          patientChatMode: 'wizard-helper',
          // Pass wizard context through a custom field that the API can use
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
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-in-out
          ${isOpen 
            ? 'bg-slate-600 hover:bg-slate-700 rotate-0' 
            : 'bg-emerald-500 hover:bg-emerald-600 animate-pulse hover:animate-none'
          }
        `}
        aria-label={isOpen ? 'Close helper' : 'Open AI helper'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Need Help?</h3>
              <p className="text-emerald-100 text-xs">Ask me anything about MRD testing</p>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[40vh] bg-slate-50">
            {messages.length === 0 ? (
              <div className="space-y-4">
                {/* Welcome message */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                  <p className="text-slate-700 text-sm">
                    Hi! 👋 I'm here to help you through this guide. You're on the <strong>{stepInfo.name}</strong> step.
                  </p>
                  <p className="text-slate-600 text-sm mt-2">
                    Ask me anything about MRD testing, or tap a question below:
                  </p>
                </div>

                {/* Suggested questions */}
                <div className="space-y-2">
                  {stepInfo.helpTopics.map((topic, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(topic)}
                      className="w-full text-left px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
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
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
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
