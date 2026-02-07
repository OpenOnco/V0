/**
 * DigestSignup — Physician MRD Weekly Digest signup form
 *
 * Props:
 *   compact (boolean) — slim version for homepage embed
 *   className (string) — additional CSS classes
 */

import React, { useState } from 'react';

const CANCER_TYPES = [
  { value: 'colorectal', label: 'Colorectal' },
  { value: 'breast', label: 'Breast' },
  { value: 'lung_nsclc', label: 'Lung (NSCLC)' },
  { value: 'bladder', label: 'Bladder' },
  { value: 'pancreatic', label: 'Pancreatic' },
  { value: 'melanoma', label: 'Melanoma' },
  { value: 'ovarian', label: 'Ovarian' },
];

const CONTENT_TYPES = [
  { value: 'clinical_evidence', label: 'Clinical evidence' },
  { value: 'coverage_updates', label: 'Coverage updates' },
  { value: 'new_tests', label: 'New tests' },
  { value: 'guideline_updates', label: 'Guideline updates' },
];

export default function DigestSignup({ compact = false, className = '' }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [selectedCancerTypes, setSelectedCancerTypes] = useState([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);

  const toggleCancerType = (value) => {
    setSelectedCancerTypes(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleContentType = (value) => {
    setSelectedContentTypes(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/mrd-digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          institution: institution.trim() || undefined,
          cancerTypes: selectedCancerTypes.length > 0 ? selectedCancerTypes : undefined,
          contentTypes: selectedContentTypes.length > 0 ? selectedContentTypes : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className={`bg-emerald-50 border border-emerald-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-2 text-emerald-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-sm">Check your email to confirm</p>
            <p className="text-xs text-emerald-600 mt-0.5">Click the confirmation link we sent to start receiving the weekly digest.</p>
          </div>
        </div>
      </div>
    );
  }

  // Compact version for homepage embed
  if (compact) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-800">MRD Weekly Digest</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Weekly curated MRD/ctDNA clinical updates delivered to your inbox.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {status === 'submitting' ? 'Signing up...' : 'Subscribe'}
            </button>
          </form>
          {status === 'error' && (
            <p className="text-xs text-red-600 mt-2">{errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Full version for digest page
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900">Subscribe to MRD Weekly Digest</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Curated MRD/ctDNA clinical developments delivered weekly. Evidence highlights, coverage updates, new tests, and guideline changes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (required) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="physician@hospital.edu"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Preferences toggle */}
          <button
            type="button"
            onClick={() => setShowPreferences(!showPreferences)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showPreferences ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Customize preferences (optional)
          </button>

          {showPreferences && (
            <div className="space-y-4 pl-2 border-l-2 border-emerald-100">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Institution */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Institution</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Memorial Sloan Kettering"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Cancer type interests */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cancer type interests</label>
                <div className="flex flex-wrap gap-2">
                  {CANCER_TYPES.map(ct => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => toggleCancerType(ct.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedCancerTypes.includes(ct.value)
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">Leave empty for all cancer types</p>
              </div>

              {/* Content preferences */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Content preferences</label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map(ct => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => toggleContentType(ct.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedContentTypes.includes(ct.value)
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">Leave empty for all content types</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {status === 'submitting' ? 'Subscribing...' : 'Subscribe to Weekly Digest'}
          </button>

          {status === 'error' && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <p className="text-xs text-slate-400 text-center">
            You can unsubscribe at any time. We respect your privacy.
          </p>
        </form>
      </div>
    </div>
  );
}
