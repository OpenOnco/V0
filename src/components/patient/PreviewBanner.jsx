import React, { useState } from 'react';
import FeedbackModal from './FeedbackModal';

/**
 * Preview banner for patient portal prototype
 * Shows amber banner with feedback button that opens modal
 */
export default function PreviewBanner() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const MessageIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );

  return (
    <>
      <div className="bg-amber-400 border-b border-amber-500">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-900 text-sm">
            <span>🔬</span>
            <span className="font-semibold">Preview Version</span>
            <span className="hidden sm:inline">— Help us improve by sharing your thoughts</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-amber-900 bg-amber-200 hover:bg-amber-100 rounded-full transition-colors"
          >
            <MessageIcon />
            <span>Share Feedback</span>
          </button>
        </div>
      </div>
      
      <FeedbackModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
