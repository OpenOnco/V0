import React, { useState, useEffect } from 'react';
import DigestSignup from '../components/physician/DigestSignup';

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

function PreferenceManager({ token }) {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Local edit state
  const [cancerTypes, setCancerTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [frequency, setFrequency] = useState('weekly');

  useEffect(() => {
    fetch(`/api/mrd-digest/preferences?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.preferences) {
          setPrefs(data.preferences);
          setCancerTypes(data.preferences.cancer_types || []);
          setContentTypes(data.preferences.content_types || []);
          setFrequency(data.preferences.frequency || 'weekly');
        } else {
          setError('Subscription not found.');
        }
      })
      .catch(() => setError('Failed to load preferences.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/mrd-digest/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          cancerTypes: cancerTypes.length > 0 ? cancerTypes : null,
          contentTypes: contentTypes.length > 0 ? contentTypes : null,
          frequency,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500">Loading your preferences...</div>
    );
  }

  if (error && !prefs) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const toggleCancerType = (value) => {
    setCancerTypes(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const toggleContentType = (value) => {
    setContentTypes(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-slate-900 mb-2">Manage Your Digest Preferences</h2>
      <p className="text-sm text-slate-500 mb-6">Subscribed as <strong>{prefs.email}</strong></p>

      <div className="space-y-6">
        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Delivery frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Cancer types */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Cancer type interests</label>
          <div className="flex flex-wrap gap-2">
            {CANCER_TYPES.map(ct => (
              <button
                key={ct.value}
                type="button"
                onClick={() => toggleCancerType(ct.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  cancerTypes.includes(ct.value)
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

        {/* Content types */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Content preferences</label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map(ct => (
              <button
                key={ct.value}
                type="button"
                onClick={() => toggleContentType(ct.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  contentTypes.includes(ct.value)
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

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
          {error && prefs && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}

const DigestPage = () => {
  const params = new URLSearchParams(window.location.search);
  const manageToken = params.get('manage');

  // Preference management mode
  if (manageToken) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <PreferenceManager token={manageToken} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Weekly Digest
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">MRD/ctDNA Clinical Intelligence</h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto">
          Stay current on MRD/ctDNA developments without tracking dozens of sources. AI-curated, physician-reviewed, delivered weekly.
        </p>
      </div>

      {/* What you get */}
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {[
          { title: 'Clinical Evidence', desc: 'Top PubMed findings and preprints with AI-generated clinical relevance summaries.', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { title: 'Coverage Updates', desc: 'Payer policy changes for MRD/ctDNA tests — know when coverage expands or restricts.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
          { title: 'New Tests & FDA', desc: 'Vendor launches, breakthrough designations, and FDA clearances as they happen.', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
          { title: 'Guideline Updates', desc: 'NCCN, ESMO, and ASCO guideline changes affecting MRD/ctDNA clinical practice.', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
        ].map(({ title, desc, icon }) => (
          <div key={title} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
              </svg>
              <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            </div>
            <p className="text-sm text-slate-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* Signup form */}
      <div className="mb-16">
        <DigestSignup />
      </div>

      {/* Sample preview */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">Sample Digest Preview</h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
            <h3 className="text-white font-bold text-lg">OpenOnco MRD Weekly Digest</h3>
            <p className="text-emerald-200 text-sm">Week of January 27, 2026</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide text-emerald-700 mb-2">Clinical Evidence</h4>
              <div className="space-y-3">
                <div className="border-l-2 border-emerald-200 pl-3">
                  <p className="text-sm font-medium text-slate-800">CIRCULATE-Japan: ctDNA-guided adjuvant therapy in stage II-III CRC</p>
                  <p className="text-xs text-slate-500">JAMA Oncology &mdash; ctDNA-negative patients safely de-escalated from adjuvant therapy with no difference in DFS at 3 years.</p>
                </div>
                <div className="border-l-2 border-emerald-200 pl-3">
                  <p className="text-sm font-medium text-slate-800">Signatera MRD clearance predicts immunotherapy response in melanoma</p>
                  <p className="text-xs text-slate-500">Nature Medicine &mdash; Serial ctDNA monitoring during anti-PD-1 therapy identified molecular responders 8 weeks before imaging.</p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-emerald-700 mb-2">Coverage Updates</h4>
              <div className="border-l-2 border-blue-200 pl-3">
                <p className="text-sm font-medium text-slate-800">Aetna expands Signatera coverage to stage II CRC</p>
                <p className="text-xs text-slate-500">Policy CPB 0715 updated to include stage II colorectal cancer for MRD monitoring. Effective March 1, 2026.</p>
              </div>
            </div>
            <div className="text-center pt-2">
              <p className="text-xs text-slate-400 italic">This is a sample. Actual content is AI-curated from live data sources.</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'When is the digest sent?', a: 'Every Monday morning (Pacific Time). Content is curated from the previous week\'s crawls of PubMed, payer policies, vendor announcements, and clinical guidelines.' },
            { q: 'How is the content curated?', a: 'Our automated crawlers surface new content weekly. An AI model generates clinical relevance summaries, and each digest is reviewed before sending.' },
            { q: 'Can I customize what I receive?', a: 'Yes. You can filter by cancer type (e.g., only colorectal and breast) and content type (e.g., only coverage updates). Use the preferences link in any digest email to adjust.' },
            { q: 'How do I unsubscribe?', a: 'Every email includes a one-click unsubscribe link. You can also manage your subscription from the preferences page.' },
            { q: 'Is my email shared with anyone?', a: 'No. OpenOnco is a non-profit. Your email is used solely for digest delivery and is never shared with third parties.' },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-1">{q}</h3>
              <p className="text-sm text-slate-500">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DigestPage;
