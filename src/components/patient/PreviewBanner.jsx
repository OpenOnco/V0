import React, { useState } from 'react';
import { getSessionContext } from '../../utils/sessionTracking';

/**
 * Preview banner for patient portal prototype
 * Displays persistent warning that this is a preview version
 * Includes quick feedback link with session context
 */

// Google Form URL for feedback
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScp-_BbFAEK5fDaQs7uz9qr8jyFz3aKGZxbdounzM0B_y2GZw/viewform';

const PreviewBanner = ({ onDismiss }) => {
  const [showCopied, setShowCopied] = useState(false);

  const handleFeedbackClick = (e) => {
    // Copy session context to clipboard for pasting into form
    const context = getSessionContext();
    const contextText = `Session: ${context.duration}\nPersona: ${context.persona}\nPages visited: ${context.pages}\nTests viewed: ${context.testsViewed}`;
    
    navigator.clipboard.writeText(contextText).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }).catch(() => {
      // Clipboard failed, still open the form
    });
    
    // Open form in new tab
    window.open(FEEDBACK_FORM_URL, '_blank');
  };

  return (
    <div className="bg-amber-50 border-b-2 border-amber-300 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-center gap-2 sm:gap-4 text-sm">
          {/* Microscope emoji + Preview text */}
          <span className="flex items-center gap-2">
            <span className="text-lg">🔬</span>
            <span className="font-semibold text-amber-800">Preview Version</span>
          </span>
          
          <span className="text-amber-400 hidden sm:inline">—</span>
          
          <span className="text-amber-700 hidden sm:inline">
            You're helping us improve OpenOnco
          </span>
          
          {/* Feedback button */}
          <button
            onClick={handleFeedbackClick}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full text-xs font-medium transition-colors border border-amber-300"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Share Feedback
            {showCopied && (
              <span className="text-emerald-600 ml-1">(context copied!)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewBanner;
