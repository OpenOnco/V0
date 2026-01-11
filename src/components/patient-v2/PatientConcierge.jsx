import React, { useState, useRef, useEffect } from 'react';
import Chat from '../Chat';

// Concierge system prompt configuration
const CONCIERGE_CONFIG = {
  systemPromptAddition: `
You are a warm, supportive patient concierge for OpenOnco, a nonprofit educational resource about cancer testing. Your role is to help patients and caregivers navigate the website and find the right information.

IMPORTANT GUIDELINES:
- You are a NAVIGATOR and EDUCATOR, not a medical advisor
- NEVER recommend specific tests or treatments
- NEVER interpret test results or make clinical suggestions
- ALWAYS direct users to speak with their healthcare team for medical decisions

Your tone should be:
- Warm and empathetic, like a helpful librarian or patient advocate
- Humble - acknowledge what you don't know
- Directional - guide people to the right resources on our site
- Educational - explain concepts in plain language when asked

You can help with:
1. Explaining what different sections of our site offer
2. Helping users understand which journey stage they might be in
3. Explaining general concepts about cancer testing (not specific recommendations)
4. Pointing users to our insurance help resources
5. Answering questions about how to use the site

Example responses:
- "I can help you find information about that! Based on what you've shared, you might want to explore our 'Choosing' section which covers treatment selection testing. Would you like me to explain more about what you'd find there?"
- "That's a great question for your oncology team - they know your specific situation best. What I can do is help you understand the general categories of tests that exist, so you feel more prepared for that conversation."
- "I'm not qualified to say whether a specific test is right for you, but I can explain what MRD testing generally looks for. Would that be helpful?"

Remember: You're here to empower patients with knowledge and help them navigate, not to make medical decisions for them.
`,
  placeholder: 'Ask me anything about navigating the site...',
  welcomeMessage: "Hi! I'm here to help you find what you need on OpenOnco. I can point you to the right resources, explain how the site works, or help you understand general concepts about cancer testing. What can I help you with today?",
};

export default function PatientConcierge({ testData, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const containerRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setHasUnread(false);
    setShowWelcome(false);
  };

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-6 right-6 z-50 ${className}`}
    >
      {/* Expanded Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 h-[500px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden flex flex-col animate-slide-up">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-rose-500 to-rose-400 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Patient Concierge</h3>
                <p className="text-rose-100 text-xs">Here to help you navigate</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors p-1"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Welcome Message */}
          <div className="px-4 py-3 bg-rose-50 border-b border-rose-100">
            <p className="text-sm text-rose-800">
              {CONCIERGE_CONFIG.welcomeMessage}
            </p>
          </div>

          {/* Chat Component */}
          <div className="flex-1 overflow-hidden">
            <Chat
              persona="patient"
              testData={testData}
              variant="full"
              showModeToggle={false}
              resizable={false}
              showTitle={false}
              initialHeight={350}
              className="h-full border-0 shadow-none"
              patientContext={{
                chatMode: 'learn',
                isConcierge: true,
              }}
            />
          </div>

          {/* Disclaimer Footer */}
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center">
              For navigation help only. Not medical advice.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Tooltip */}
      {showWelcome && !isOpen && (
        <div className="absolute bottom-16 right-0 w-64 bg-white rounded-xl shadow-lg border border-rose-100 p-4 animate-fade-in">
          <button
            onClick={() => setShowWelcome(false)}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="text-sm text-slate-700 pr-4">
            Need help finding what you're looking for? I'm here to guide you.
          </p>
          <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r border-b border-rose-100 transform rotate-45" />
        </div>
      )}

      {/* Chat Bubble Button */}
      <button
        onClick={handleToggle}
        className={`
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2
          ${isOpen
            ? 'bg-rose-600 hover:bg-rose-700'
            : 'bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700'
          }
        `}
        aria-label={isOpen ? 'Close chat' : 'Open patient concierge'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}

        {/* Unread Indicator */}
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
