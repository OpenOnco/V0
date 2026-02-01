import React, { useState, useMemo } from 'react';
import { JOURNEY_CONFIG } from './journeyConfig';
import { useAssistanceProgram } from '../../dal';
import TestDetailModal from '../test/TestDetailModal';
import WizardAIHelper from './WizardAIHelper';

// Get MRD journey configuration for colors
const mrdJourney = JOURNEY_CONFIG.mrd;

// Build color scheme from journey config
const colors = {
  bg: mrdJourney.colors.bg,
  border: mrdJourney.colors.border,
  accent: mrdJourney.colors.accent,
  accentHover: 'hover:bg-emerald-600',
  accentLight: 'bg-emerald-100',
  text: mrdJourney.colors.text,
  textDark: 'text-emerald-900',
  focus: 'focus:ring-emerald-500',
};

// Questions to ask your doctor
const DOCTOR_QUESTIONS = [
  'Is this test recommended for my specific cancer type and stage?',
  'How does this test work, and what can it tell us?',
  'What would a positive or negative result mean for my treatment plan?',
  'How often should I have this test done?',
  'Will my insurance cover this test?',
  'Are there financial assistance programs available?',
];


/**
 * TestLookupWizard - Path 1: "My doctor recommended a test"
 *
 * Fast-track wizard for patients who already know which test their doctor recommended.
 * Shows test info, costs, and coverage without requiring full wizard completion.
 */
export default function TestLookupWizard({ testData = [], onNavigate, onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [insuranceType, setInsuranceType] = useState(null); // 'medicare' | 'private' | 'none' | null

  // Get assistance program for selected test's vendor
  const { program: assistanceProgram } = useAssistanceProgram(selectedTest?.vendor);

  // Filter tests based on search query
  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return testData
      .filter(test =>
        test.name?.toLowerCase().includes(query) ||
        test.vendor?.toLowerCase().includes(query)
      )
      .slice(0, 8); // Limit to 8 results for typeahead
  }, [searchQuery, testData]);

  // Handle test selection from search
  const handleSelectTest = (test) => {
    setSelectedTest(test);
    setSearchQuery('');
    setInsuranceType(null);
  };

  // Handle back navigation
  const handleBack = () => {
    if (selectedTest) {
      setSelectedTest(null);
    } else if (onBack) {
      onBack();
    } else if (onNavigate) {
      onNavigate('patient-landing');
    }
  };

  // Get cost info for display
  const getCostInfo = () => {
    if (!selectedTest) return null;

    const medicareCoverage = selectedTest.medicareCoverage;
    const reimbursementRate = medicareCoverage?.reimbursementRate;
    const listPrice = selectedTest.listPrice;

    return {
      typicalCost: reimbursementRate || listPrice || null,
      hasMedicareCoverage: medicareCoverage?.status === 'COVERED',
      medicarePolicy: medicareCoverage?.policyNumber,
    };
  };

  const costInfo = getCostInfo();

  return (
    <div className={`min-h-screen bg-gradient-to-b from-rose-50/50 to-white`}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Test Lookup</h1>
              <p className="text-sm text-slate-500">Learn about your recommended test</p>
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
        {!selectedTest ? (
          /* Step 1: Search for test */
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Which test did your doctor recommend?
              </h2>
              <p className="text-slate-600">
                Search for the test name or vendor
              </p>
            </div>

            {/* Search input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., Signatera, Guardant Reveal, clonoSEQ..."
                className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl text-lg
                           focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                autoFocus
              />
            </div>

            {/* Search results */}
            {filteredTests.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {filteredTests.map((test) => (
                  <button
                    key={test.id}
                    onClick={() => handleSelectTest(test)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0
                               transition-colors focus:outline-none focus:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">{test.name}</div>
                    <div className="text-sm text-slate-500">{test.vendor}</div>
                  </button>
                ))}
              </div>
            )}

            {/* No results message */}
            {searchQuery.length > 2 && filteredTests.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p>No tests found matching "{searchQuery}"</p>
                <p className="text-sm mt-2">Try a different spelling or search for the vendor name</p>
              </div>
            )}

            {/* Popular tests hint */}
            {!searchQuery && (
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="font-medium text-slate-700 mb-3">Common MRD tests:</h3>
                <div className="flex flex-wrap gap-2">
                  {['Signatera', 'Guardant Reveal', 'clonoSEQ', 'FoundationOne Tracker'].map((name) => (
                    <button
                      key={name}
                      onClick={() => setSearchQuery(name)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700
                                 hover:border-rose-300 hover:bg-rose-50 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Show test info */
          <div className="space-y-6">
            {/* Test header */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedTest.name}</h2>
                  <p className="text-slate-600">{selectedTest.vendor}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(true)}
                  className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                >
                  Full details
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Insurance type selection - 3 buttons */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-4">What type of coverage do you have?</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setInsuranceType('medicare')}
                  className={`py-3 px-3 border-2 rounded-xl font-medium transition-all text-center
                    ${insuranceType === 'medicare'
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-slate-200 hover:border-rose-300'
                    }`}
                >
                  Medicare
                </button>
                <button
                  onClick={() => setInsuranceType('private')}
                  className={`py-3 px-3 border-2 rounded-xl font-medium transition-all text-center
                    ${insuranceType === 'private'
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-slate-200 hover:border-rose-300'
                    }`}
                >
                  Private Insurance
                </button>
                <button
                  onClick={() => setInsuranceType('none')}
                  className={`py-3 px-3 border-2 rounded-xl font-medium transition-all text-center
                    ${insuranceType === 'none'
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-slate-200 hover:border-rose-300'
                    }`}
                >
                  No Insurance
                </button>
              </div>
            </div>

            {/* Cost & Coverage section - tailored by insurance type */}
            {insuranceType !== null && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-slate-900">Cost & Coverage</h3>

                {/* Medicare-specific content */}
                {insuranceType === 'medicare' && (
                  <>
                    {costInfo?.hasMedicareCoverage ? (
                      <div className="flex items-start gap-3 bg-green-50 rounded-lg p-4">
                        <span className="text-xl">✓</span>
                        <div>
                          <p className="font-medium text-green-800">Medicare covered</p>
                          {costInfo.medicarePolicy && (
                            <p className="text-sm text-green-700 mt-1">Policy: {costInfo.medicarePolicy}</p>
                          )}
                          {costInfo.typicalCost && (
                            <p className="text-sm text-green-700 mt-1">
                              Medicare reimbursement: ~${costInfo.typicalCost.toLocaleString()}
                            </p>
                          )}
                          {selectedTest.medicareCoverage?.coveredIndications && (
                            <p className="text-sm text-green-700 mt-2">
                              Covered for: {selectedTest.medicareCoverage.coveredIndications.slice(0, 3).join(', ')}
                              {selectedTest.medicareCoverage.coveredIndications.length > 3 && ' and more'}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4">
                        <span className="text-xl">⚠️</span>
                        <div>
                          <p className="font-medium text-amber-800">Medicare coverage varies</p>
                          <p className="text-sm text-amber-700 mt-1">
                            Coverage may depend on your specific diagnosis and medical necessity.
                            Your oncologist can help determine if you qualify.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Private insurance content */}
                {insuranceType === 'private' && (
                  <>
                    <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-4">
                      <span className="text-xl">ℹ️</span>
                      <div>
                        <p className="font-medium text-blue-800">Coverage varies by plan</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Many private insurers cover MRD testing. Contact your insurance provider
                          or ask your oncologist's office to verify coverage before ordering.
                        </p>
                        {costInfo?.typicalCost && (
                          <p className="text-sm text-blue-700 mt-2">
                            List price if not covered: ~${costInfo.typicalCost.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {assistanceProgram && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <p className="text-sm text-slate-700">
                          <strong>Backup option:</strong> If your insurance denies coverage,
                          {selectedTest.vendor} offers a patient assistance program.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* No insurance content - lead with financial assistance */}
                {insuranceType === 'none' && (
                  <>
                    {assistanceProgram ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">💝</span>
                          <div className="flex-1">
                            <h4 className="font-semibold text-blue-900 mb-1">
                              {assistanceProgram.programName || 'Financial assistance available'}
                            </h4>
                            <p className="text-sm text-blue-800 mb-2">
                              {assistanceProgram.maxOutOfPocket
                                ? `Qualifying patients may pay ${assistanceProgram.maxOutOfPocket}`
                                : 'Income-based assistance available'}
                            </p>
                            {assistanceProgram.eligibilityRules?.fplThresholds?.[0] && (
                              <p className="text-xs text-blue-700 mb-3">
                                Income limit: Based on Federal Poverty Level guidelines
                              </p>
                            )}
                            {assistanceProgram.applicationUrl && (
                              <a
                                href={assistanceProgram.applicationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                                           text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Apply for assistance
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                        <span className="text-xl">💰</span>
                        <div>
                          <p className="font-medium text-slate-800">Contact {selectedTest.vendor} directly</p>
                          <p className="text-sm text-slate-600 mt-1">
                            Most vendors offer patient assistance programs for uninsured patients.
                            Ask about financial assistance options when scheduling your test.
                          </p>
                        </div>
                      </div>
                    )}
                    {costInfo?.typicalCost && (
                      <div className="text-sm text-slate-600 mt-2">
                        <p>Typical cost without assistance: ~${costInfo.typicalCost.toLocaleString()}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedTest(null)}
                className="flex-1 py-3 px-4 border border-slate-300 text-slate-700 font-medium rounded-xl
                           hover:bg-slate-50 transition-colors"
              >
                Search another test
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl
                           transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print for your visit
              </button>
            </div>

            {/* Questions to ask your doctor - MOVED TO END */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-xl">❓</span>
                Questions to ask your doctor
              </h3>
              <div className="space-y-2">
                {DOCTOR_QUESTIONS.map((question, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="w-6 h-6 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-rose-600">{index + 1}</span>
                    </div>
                    <span className="text-sm text-slate-700">{question}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-center text-xs text-slate-500 mt-8 px-4">
          This guide is for educational purposes only and does not constitute medical advice.
          Always consult with your healthcare team about your specific situation.
        </p>
      </main>

      {/* Test Detail Modal */}
      {showDetailModal && selectedTest && (
        <TestDetailModal
          test={selectedTest}
          category="MRD"
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {/* Floating AI Helper - only show when test is selected */}
      {selectedTest && (
        <WizardAIHelper
          currentStep="test-lookup"
          wizardData={{
            selectedTest: selectedTest?.name,
            testVendor: selectedTest?.vendor,
            testApproach: selectedTest?.approach,
            hasMedicareCoverage: costInfo?.hasMedicareCoverage,
          }}
        />
      )}
    </div>
  );
}
