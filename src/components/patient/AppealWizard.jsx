import React, { useState, useMemo } from 'react';
import { JOURNEY_CONFIG } from './journeyConfig';
import { useInsuranceGrouped, useAssistanceProgram } from '../../dal';
import { PATIENT_ASSISTANCE_RESOURCES } from '../../data';

// Get MRD journey configuration
const mrdJourney = JOURNEY_CONFIG.mrd;

// Common denial reasons and rebuttals
const DENIAL_REASONS = [
  {
    id: 'experimental',
    reason: '"Test is experimental or investigational"',
    rebuttal: 'MRD testing is supported by clinical evidence and NCCN guidelines for many cancer types. The test has FDA breakthrough device designation and/or Medicare coverage.',
    askDoctor: 'Can you provide a letter of medical necessity citing clinical evidence and guidelines?',
  },
  {
    id: 'not-medically-necessary',
    reason: '"Not medically necessary"',
    rebuttal: 'MRD testing provides clinically actionable information for treatment decisions and surveillance. Early detection of recurrence can change management and improve outcomes.',
    askDoctor: 'Can you document in the appeal why MRD testing is medically necessary for my specific situation?',
  },
  {
    id: 'not-covered',
    reason: '"Service not covered under your plan"',
    rebuttal: 'Request an exception for coverage based on medical necessity. Many plans cover MRD testing when properly documented, even if not explicitly listed.',
    askDoctor: 'Can you submit a prior authorization or request an exception for coverage?',
  },
  {
    id: 'wrong-diagnosis',
    reason: '"Diagnosis codes don\'t support testing"',
    rebuttal: 'This may be a coding issue. The correct ICD-10 codes for MRD monitoring should be used along with the cancer diagnosis codes.',
    askDoctor: 'Can you review the diagnosis codes submitted with the claim and resubmit if needed?',
  },
];

// Questions to ask your oncologist about appeals
const ONCOLOGIST_QUESTIONS = [
  'Can you write a letter of medical necessity explaining why this test is important for my care?',
  'Are there clinical studies or guidelines you can cite to support the appeal?',
  'Has this test been covered for other patients in similar situations?',
  'Can your billing department help with the appeal process?',
  'Is there a patient advocate at the cancer center who can help?',
];

/**
 * AppealWizard - Path 3: "My insurance denied coverage"
 *
 * Helps patients whose insurance denied coverage for MRD testing.
 * Provides denial rebuttals, questions for oncologist, and resources.
 */
export default function AppealWizard({ testData = [], onNavigate, onBack }) {
  const [selectedTest, setSelectedTest] = useState('');
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Get insurance providers from DAL
  const { providersByCategory: insuranceByCategory } = useInsuranceGrouped();

  // Get assistance program for selected test's vendor
  const selectedTestData = useMemo(() => {
    return testData.find(t => t.id === selectedTest);
  }, [selectedTest, testData]);

  const { program: assistanceProgram } = useAssistanceProgram(selectedTestData?.vendor);

  // Handle form submission
  const handleSubmit = () => {
    if (selectedTest && selectedInsurer) {
      setShowResults(true);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (showResults) {
      setShowResults(false);
    } else if (onBack) {
      onBack();
    } else if (onNavigate) {
      onNavigate('patient-landing');
    }
  };

  // Get the selected denial reason data
  const selectedDenialData = DENIAL_REASONS.find(d => d.id === denialReason);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Appeal Help</h1>
              <p className="text-sm text-slate-500">Get help with your denial</p>
            </div>
          </div>

          <button
            onClick={handleBack}
            className="text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 text-sm
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 rounded-lg p-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {!showResults ? (
          /* Step 1: Select test and insurer */
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Let's help with your appeal
              </h2>
              <p className="text-slate-600">
                Tell us about your situation and we'll provide resources to help
              </p>
            </div>

            {/* Test selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Which test was denied?
              </label>
              <select
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Select a test...</option>
                {testData.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.name} ({test.vendor})
                  </option>
                ))}
                <option value="other">Other / Not listed</option>
              </select>
            </div>

            {/* Insurance selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Which insurance company denied coverage?
              </label>
              <select
                value={selectedInsurer}
                onChange={(e) => setSelectedInsurer(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Select your insurance...</option>
                <optgroup label="Government Programs">
                  {insuranceByCategory.government?.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Major National Plans">
                  {insuranceByCategory.national?.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Regional Plans">
                  {insuranceByCategory.regional?.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <option value="other">Other (not listed)</option>
              </select>
            </div>

            {/* Denial reason selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                What reason did they give for the denial? (optional)
              </label>
              <select
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Select a reason (or skip)...</option>
                {DENIAL_REASONS.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.reason}
                  </option>
                ))}
                <option value="unknown">I'm not sure / Other reason</option>
              </select>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!selectedTest || !selectedInsurer}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
            >
              Get appeal help
            </button>
          </div>
        ) : (
          /* Step 2: Show results and resources */
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Here's how to fight back
              </h2>
              <p className="text-slate-600">
                You have the right to appeal. Here are resources to help.
              </p>
            </div>

            {/* Denial-specific guidance */}
            {selectedDenialData && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Responding to: {selectedDenialData.reason}
                </h3>
                <p className="text-amber-800 text-sm mb-4">
                  {selectedDenialData.rebuttal}
                </p>
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-900">Ask your oncologist:</p>
                  <p className="text-sm text-amber-800 italic">{selectedDenialData.askDoctor}</p>
                </div>
              </div>
            )}

            {/* Questions to ask your oncologist */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-xl">👩‍⚕️</span>
                Questions for your oncologist
              </h3>
              <div className="space-y-2">
                {ONCOLOGIST_QUESTIONS.map((question, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-amber-600">{index + 1}</span>
                    </div>
                    <span className="text-sm text-slate-700">{question}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial assistance option */}
            {assistanceProgram && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <span className="text-xl">💝</span>
                  Alternative: Financial Assistance
                </h3>
                <p className="text-blue-800 text-sm mb-4">
                  While you appeal, you may also qualify for the vendor's financial assistance program.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  {assistanceProgram.applicationUrl && (
                    <a
                      href={assistanceProgram.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600
                                 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Apply for {selectedTestData?.vendor} assistance
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* External resources */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-xl">🤝</span>
                Organizations that can help
              </h3>
              <div className="space-y-4">
                {PATIENT_ASSISTANCE_RESOURCES.map((resource) => (
                  <div key={resource.name} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1"
                    >
                      {resource.name}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <p className="text-sm text-slate-600 mt-1">{resource.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Appeal tips */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                General appeal tips
              </h3>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span><strong>Act quickly</strong> — Most appeals have deadlines (often 30-180 days from denial)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span><strong>Get it in writing</strong> — Request the denial in writing if you don't have it</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span><strong>Document everything</strong> — Keep copies of all letters and communications</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span><strong>Ask for help</strong> — Your oncologist's office and hospital billing department can assist</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span><strong>Don't give up</strong> — Many denials are reversed on appeal</span>
                </li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowResults(false)}
                className="flex-1 py-3 px-4 border border-slate-300 text-slate-700 font-medium rounded-xl
                           hover:bg-slate-50 transition-colors"
              >
                Start over
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl
                           transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print this guide
              </button>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-center text-xs text-slate-500 mt-8 px-4">
          This guide is for educational purposes only and does not constitute legal or medical advice.
          Always consult with your healthcare team and consider seeking professional help for complex appeals.
        </p>
      </main>
    </div>
  );
}
