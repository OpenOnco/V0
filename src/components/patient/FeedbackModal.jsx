import React, { useState } from 'react';
import { getSessionContext } from '../../utils/sessionTracking';

/**
 * Simple feedback modal for patient portal preview
 */
export default function FeedbackModal({ isOpen, onClose, testName = null }) {
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, sending, success, error
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const sessionContext = getSessionContext();
      
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback.trim(),
          email: email.trim() || null,
          testName,
          sessionContext,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send feedback');
      }

      setStatus('success');
      setFeedback('');
      setEmail('');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2000);

    } catch (err) {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  const handleClose = () => {
    onClose();
    setStatus('idle');
    setFeedback('');
    setEmail('');
    setErrorMsg('');
  };

  // Inline SVG icons
  const XIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const SendIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );

  const CheckIcon = () => (
    <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">
            {testName ? `Report Issue: ${testName}` : 'Share Feedback'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {status === 'success' ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckIcon />
              <p className="text-lg font-medium text-slate-900 mt-3">Thank you!</p>
              <p className="text-slate-600">Your feedback has been sent.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={testName 
                  ? "What's wrong with this test's information?" 
                  : "What's on your mind? Bug reports, suggestions, or general feedback welcome..."
                }
                className="w-full h-32 p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={status === 'sending'}
                autoFocus
              />
              
              <div className="mt-3">
                <label className="block text-sm text-slate-600 mb-1">
                  Open to follow-up questions? Leave your email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                  disabled={status === 'sending'}
                />
              </div>
              
              {errorMsg && (
                <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                  disabled={status === 'sending'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!feedback.trim() || status === 'sending'}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SendIcon />
                  {status === 'sending' ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
