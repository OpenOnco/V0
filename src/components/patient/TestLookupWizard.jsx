import React, { useState, useMemo } from 'react';
import { JOURNEY_CONFIG } from './journeyConfig';
import { useAssistanceProgram } from '../../dal';
import TestDetailModal from '../test/TestDetailModal';
import WizardAIHelper from './WizardAIHelper';

// Cancer type options (shared with WatchingWizard)
const CANCER_TYPES = [
  { id: 'colorectal', label: 'Colorectal' },
  { id: 'breast', label: 'Breast' },
  { id: 'lung', label: 'Lung' },
  { id: 'bladder', label: 'Bladder' },
  { id: 'ovarian', label: 'Ovarian' },
  { id: 'prostate', label: 'Prostate' },
  { id: 'pancreatic', label: 'Pancreatic' },
  { id: 'melanoma', label: 'Melanoma' },
  { id: 'multiple-myeloma', label: 'Multiple Myeloma' },
  { id: 'lymphoma', label: 'Lymphoma' },
  { id: 'other-solid', label: 'Other solid tumor' },
];

// Cancer stage options
const CANCER_STAGES = [
  { id: 'stage-1', label: 'Stage I' },
  { id: 'stage-2', label: 'Stage II' },
  { id: 'stage-3', label: 'Stage III' },
  { id: 'stage-4', label: 'Stage IV' },
  { id: 'unsure', label: "I'm not sure" },
];

// Map payer IDs from coverageCrossReference.privatePayers to display labels
const PAYER_LABELS = {
  aetna: 'Aetna',
  cigna: 'Cigna',
  united: 'UnitedHealthcare',
  anthem: 'Anthem / BCBS',
  humana: 'Humana',
  kaiser: 'Kaiser Permanente',
};

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

/**
 * Returns contextual "Next Steps" based on coverage conclusion
 * @param {string} insuranceType - 'medicare' | 'private' | 'none'
 * @param {object} coverageResult - medicareCoverageResult or payerCoverageResult
 * @param {object} test - selectedTest object
 * @param {object} assistanceProgram - from useAssistanceProgram hook
 * @param {string} cancerType - selected cancer type
 * @param {string} cancerStage - selected stage
 * @returns {object} { title, icon, steps: [{ heading, detail }] }
 */
function getNextSteps(insuranceType, coverageResult, test, assistanceProgram, cancerType, cancerStage) {
  if (!insuranceType) return null;

  const testName = test?.name || 'this test';
  const vendorName = test?.vendor || 'the vendor';
  const cptCode = test?.cptCodes || '';
  const programName = assistanceProgram?.programName || `${vendorName} Patient Assistance Program`;
  const contactPhone = assistanceProgram?.contactPhone || '';

  // No insurance path
  if (insuranceType === 'none') {
    return {
      title: 'Your Next Steps',
      icon: '💝',
      steps: [
        {
          heading: 'Apply for financial assistance first',
          detail: `${programName} offers income-based assistance. Many patients qualify for reduced or no cost.`,
        },
        {
          heading: 'Contact billing to discuss options',
          detail: contactPhone
            ? `📞 ${contactPhone} — Ask about payment plans and cash-pay pricing.`
            : `Contact ${vendorName} billing to ask about payment plans and self-pay options.`,
        },
        {
          heading: 'Compare if multiple options exist',
          detail: 'Some tests have alternatives with different pricing. Your doctor can advise on options.',
        },
      ],
    };
  }

  // Medicare path
  if (insuranceType === 'medicare') {
    if (!coverageResult) return null;

    // Medicare - indication appears covered
    if (coverageResult.hasCoverage && coverageResult.indicationMatch !== false) {
      const policyNumber = coverageResult.policy || 'MolDX';
      return {
        title: 'Your Next Steps',
        icon: '✅',
        steps: [
          {
            heading: "Confirm with your doctor's office",
            detail: `"I looked up ${testName} on OpenOnco and it shows Medicare policy ${policyNumber} covers my indication. Can you confirm this applies to me?"`,
          },
          {
            heading: 'Order should be straightforward',
            detail: "Medicare typically processes covered tests without prior authorization. Your doctor's office handles the order.",
          },
          {
            heading: 'Understand your costs',
            detail: 'Medicare Part B typically covers 80% after deductible. Ask about any expected out-of-pocket costs.',
          },
        ],
      };
    }

    // Medicare - couldn't confirm coverage
    // Build options step with assistance info
    let optionsDetail;
    if (assistanceProgram) {
      optionsDetail = `If covered: Medicare Part B pays 80% after deductible. If not covered: ${programName} may help.`;
      if (contactPhone) {
        optionsDetail += ` 📞 ${contactPhone}`;
      }
    } else {
      optionsDetail = 'If covered: Medicare Part B pays 80% after deductible. If not covered: Financial assistance may be available.';
    }

    return {
      title: 'Your Next Steps',
      icon: '📋',
      steps: [
        {
          heading: 'Ask your doctor about coverage',
          detail: `"I looked up coverage on OpenOnco but couldn't confirm for my specific indication. Can you check if Medicare would cover this?"`,
        },
        {
          heading: 'Request a coverage determination (if needed)',
          detail: 'Your doctor can request an Advance Beneficiary Notice (ABN) if coverage is uncertain.',
        },
        {
          heading: 'Know your options',
          detail: optionsDetail,
          hasAssistanceLink: !!assistanceProgram?.applicationUrl,
        },
      ],
    };
  }

  // Private insurance path
  if (insuranceType === 'private') {
    if (!coverageResult) return null;

    // Private - no data for this payer (isOther or noTestData)
    if (coverageResult.isOther || coverageResult.noTestData) {
      return {
        title: 'Your Next Steps',
        icon: '📞',
        steps: [
          {
            heading: 'Call your insurance to verify coverage',
            detail: cptCode
              ? `Ask: "Is CPT code ${cptCode} for ${testName} covered under my plan?" Get the representative's name and reference number.`
              : `Ask: "Is ${testName} by ${vendorName} covered under my plan?" Get the representative's name and reference number.`,
          },
          {
            heading: "Have your doctor's office verify",
            detail: 'They can also call to confirm coverage and get prior authorization requirements.',
          },
          {
            heading: 'Get everything in writing',
            detail: 'Request a written coverage determination before the test. This protects you from surprise bills.',
          },
        ],
      };
    }

    // Private - indication appears covered
    if (coverageResult.status === 'COVERED' || (coverageResult.status === 'PARTIAL' && coverageResult.indicationMatch)) {
      const payerLabel = coverageResult.label || 'your insurer';
      const policyRef = coverageResult.policy || '';
      return {
        title: 'Your Next Steps',
        icon: '✅',
        steps: [
          {
            heading: 'Ask your doctor to submit prior authorization',
            detail: policyRef
              ? `"I found that ${payerLabel} policy ${policyRef} covers this test for my indication. Can you submit prior auth referencing this policy?"`
              : `"I found that ${payerLabel} appears to cover this test for my indication. Can you submit prior authorization?"`,
          },
          {
            heading: 'Get approval in writing',
            detail: 'Ask for the authorization number and keep a copy. Coverage can vary by specific plan.',
          },
          {
            heading: 'Confirm your costs',
            detail: 'Ask about your deductible, copay, or coinsurance for this test.',
          },
        ],
      };
    }

    // Private - couldn't confirm, experimental, or not covered
    // Build actionable financial assistance detail
    let assistanceDetail;
    if (assistanceProgram) {
      const parts = [`${programName} may help cover costs if insurance doesn't.`];
      if (contactPhone) {
        parts.push(`📞 ${contactPhone}`);
      }
      assistanceDetail = parts.join(' ');
    } else {
      assistanceDetail = `${vendorName} may offer a patient assistance program that can help cover costs.`;
    }

    return {
      title: 'Your Next Steps',
      icon: '📋',
      steps: [
        {
          heading: 'Your doctor can still request prior authorization',
          detail: "Even if our data shows limited coverage, your specific plan may differ. Worth requesting.",
        },
        {
          heading: 'If denied, ask about appeals',
          detail: "Denials can often be appealed with medical necessity documentation. Your doctor's office can help with this process.",
        },
        {
          heading: 'Ask about financial assistance',
          detail: assistanceDetail,
          hasAssistanceLink: !!assistanceProgram?.applicationUrl,
        },
      ],
    };
  }

  return null;
}


/**
 * TestLookupWizard - Path 1: "My doctor recommended a test"
 *
 * Fast-track wizard for patients who already know which test their doctor recommended.
 * Shows test info, costs, and coverage without requiring full wizard completion.
 */
// Helper: Check if patient's cancer type and stage match a coverage indication string
function matchesIndication(indicationString, cancerType, stage) {
  if (!indicationString || !cancerType) return false;

  const indication = indicationString.toLowerCase();
  const cancer = cancerType.toLowerCase();

  // Check if cancer type is mentioned
  const cancerMatches =
    indication.includes(cancer) ||
    (cancer === 'lung' && indication.includes('nsclc')) ||
    (cancer === 'colorectal' && (indication.includes('crc') || indication.includes('colon') || indication.includes('rectal'))) ||
    (cancer === 'ovarian' && (indication.includes('ovarian') || indication.includes('fallopian') || indication.includes('peritoneal'))) ||
    indication.includes('multi-solid') ||
    indication.includes('pan-cancer') ||
    indication.includes('pan-solid');

  if (!cancerMatches) return false;

  // If no stage or unsure, just return cancer match
  if (!stage || stage === 'unsure') return true;

  // Check stage - extract stage number from ID (e.g., 'stage-2' -> '2')
  const stageNum = stage.replace('stage-', '');

  // Check for stage ranges like "Stage II-IV" or "Stage I-III"
  const stageRangeMatch = indication.match(/stage\s*([i]+)-([i]+)/i);
  if (stageRangeMatch) {
    const romanToNum = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4 };
    const minStage = romanToNum[stageRangeMatch[1].toLowerCase()] || 0;
    const maxStage = romanToNum[stageRangeMatch[2].toLowerCase()] || 4;
    const patientStage = parseInt(stageNum);
    return patientStage >= minStage && patientStage <= maxStage;
  }

  // Check for specific stage mentions
  const romanNumerals = { '1': 'i', '2': 'ii', '3': 'iii', '4': 'iv' };
  const stageRoman = romanNumerals[stageNum];

  // Match patterns like "stage II", "stage-II", "stage 2", etc.
  const hasStageMatch =
    indication.includes(`stage ${stageRoman}`) ||
    indication.includes(`stage-${stageRoman}`) ||
    indication.includes(`stage ${stageNum}`) ||
    indication.includes(`stage-${stageNum}`);

  // If no specific stage mentioned in indication, assume all stages covered
  if (!indication.includes('stage')) return true;

  return hasStageMatch;
}

// Helper: Check Medicare coverage for a test given patient's cancer type and stage
function checkMedicareCoverage(test, cancerType, stage) {
  const medicareCov = test?.medicareCoverage;
  const crossRef = test?.coverageCrossReference?.medicare;

  if (!medicareCov && !crossRef) {
    return { hasCoverage: false, reason: 'no-data' };
  }

  const status = medicareCov?.status || crossRef?.status;
  if (status !== 'COVERED') {
    return { hasCoverage: false, reason: 'not-covered', status };
  }

  // Get covered indications from either source
  const indications = [
    ...(medicareCov?.coveredIndications || []),
    ...(crossRef?.indications || []),
  ];

  if (indications.length === 0) {
    // Covered but no specific indications listed - generic coverage
    return {
      hasCoverage: true,
      indicationMatch: null,
      policy: medicareCov?.policyNumber || crossRef?.policies?.[0],
      policyName: medicareCov?.policyName,
      indications,
      notes: medicareCov?.notes || crossRef?.notes,
    };
  }

  // Check if patient's indication matches
  const matchingIndication = indications.find(ind => matchesIndication(ind, cancerType, stage));

  return {
    hasCoverage: status === 'COVERED',
    indicationMatch: !!matchingIndication,
    matchedIndication: matchingIndication,
    policy: medicareCov?.policyNumber || crossRef?.policies?.[0],
    policyName: medicareCov?.policyName,
    rate: crossRef?.rate,
    indications,
    notes: medicareCov?.notes || crossRef?.notes,
  };
}

// Helper: Get private payer coverage for a test
function getPayerCoverage(test, payerId, cancerType, stage) {
  const privatePayers = test?.coverageCrossReference?.privatePayers;
  if (!privatePayers || !privatePayers[payerId]) {
    return null;
  }

  const payer = privatePayers[payerId];
  const indications = payer.coveredIndications || [];

  // Check if patient's indication matches any covered indication
  const matchingIndication = indications.find(ind => matchesIndication(ind, cancerType, stage));

  return {
    ...payer,
    indicationMatch: !!matchingIndication,
    matchedIndication: matchingIndication,
    label: PAYER_LABELS[payerId] || payerId,
  };
}

// Helper: Get list of payers we have data for from a test
function getAvailablePayers(test) {
  const privatePayers = test?.coverageCrossReference?.privatePayers;
  if (!privatePayers) return [];

  return Object.keys(privatePayers)
    .filter(id => privatePayers[id]) // Filter out null entries
    .map(id => ({
      id,
      label: PAYER_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1),
      status: privatePayers[id].status,
    }));
}

// Helper: Get ALL unique payers across ALL tests (for autocomplete)
function getAllPayersFromTests(testData) {
  const payerSet = new Set();

  testData.forEach(test => {
    const privatePayers = test?.coverageCrossReference?.privatePayers;
    if (privatePayers) {
      Object.keys(privatePayers).forEach(payerId => {
        if (privatePayers[payerId]) { // Filter out null entries
          payerSet.add(payerId);
        }
      });
    }
  });

  return Array.from(payerSet)
    .map(id => ({
      id,
      label: PAYER_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// External link confirmation component
function ExternalLinkConfirm({ url, siteName, onClose }) {
  const handleContinue = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 text-lg">Leaving OpenOnco</h3>
        </div>
        <p className="text-slate-600 mb-4">
          You're about to visit <strong>{siteName}</strong>'s website to apply for their financial assistance program.
        </p>
        <p className="text-sm text-slate-500 mb-6">
          OpenOnco is not affiliated with {siteName} and cannot guarantee the accuracy of information on external sites.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-slate-300 text-slate-700 font-medium rounded-lg
                       hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg
                       transition-colors flex items-center justify-center gap-2"
          >
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Plain language summary modal - uses Claude API to explain MRD and the test
function PlainLanguageSummaryModal({ test, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);

      // Build test info for Claude
      const testInfo = {
        name: test.name,
        vendor: test.vendor,
        approach: test.approach,
        method: test.method,
        sensitivity: test.sensitivity,
        specificity: test.specificity,
        tat: test.initialTat || test.tat,
        fdaStatus: test.fdaStatus,
        cancerTypes: test.cancerTypes,
        earlyWarningDays: test.earlyWarningDays,
        leadTime: test.leadTime,
      };

      const promptMessage = `You're helping a patient understand an MRD (Molecular Residual Disease) test that their doctor recommended. Write a clear, warm explanation in plain language.

TEST DETAILS:
${JSON.stringify(testInfo, null, 2)}

Write your response with these sections (use simple language a patient can understand, avoid medical jargon):

**What is MRD testing?**
Explain in 2-3 sentences what MRD (Molecular Residual Disease) testing is and why it matters. Use an analogy if helpful. Explain that it looks for tiny traces of cancer that can't be seen on scans.

**How ${test.name} works**
Explain in simple terms how this specific test detects cancer traces. Mention if it's a blood test. Keep it to 2-3 sentences.

**What makes this test useful**
Highlight 2-3 key benefits in plain language. For example: how sensitive it is, how fast results come back, what cancers it works for.

**What to expect**
Briefly explain what the patient can expect - it's a simple blood draw, results typically take X days, your doctor will explain results.

End with a reassuring note that their doctor recommended this test because it can provide valuable information about their care.`;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'MRD',
            persona: 'patient',
            testData: JSON.stringify([testInfo]),
            messages: [{ role: 'user', content: promptMessage }],
            model: 'claude-haiku-4-5-20251001',
            patientChatMode: 'learn',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate summary');
        }

        const data = await response.json();
        const summaryText = data.content?.[0]?.text || 'Unable to generate summary.';
        setSummary(summaryText);
      } catch (err) {
        console.error('Error fetching test summary:', err);
        // Fallback to static summary when API isn't available (e.g., local dev)
        const fallbackSummary = `**What is MRD testing?**
MRD stands for Molecular Residual Disease. Think of it like a super-sensitive radar for cancer. After treatment, scans might show no visible tumors, but tiny traces of cancer cells can still be hiding in your body. MRD tests can detect these microscopic traces through a simple blood draw.

**How ${test.name} works**
${test.name} is a blood test made by ${test.vendor}. It looks for tiny fragments of cancer DNA circulating in your bloodstream. ${test.approach === 'tumor-informed' ? 'This test is personalized to your specific tumor - it first analyzes your tumor tissue to know exactly what to look for in your blood.' : 'This test looks for common cancer-related mutations in your blood sample.'}

**What makes this test useful**
${test.sensitivity ? `• Very sensitive - can detect cancer at levels as low as ${test.sensitivity}` : '• Highly sensitive detection of cancer traces'}
${test.tat || test.initialTat ? `• Results typically come back in ${test.tat || test.initialTat}` : ''}
${test.cancerTypes?.length > 0 ? `• Works for multiple cancer types including ${test.cancerTypes.slice(0, 3).join(', ')}` : ''}

**What to expect**
The test requires a simple blood draw - no different from routine blood work. Your doctor's office will send the sample to the lab, and results typically take ${test.tat || test.initialTat || '1-2 weeks'}. Your doctor will explain what the results mean for your specific situation.

Your doctor recommended this test because it can provide valuable information about your treatment response and help guide your ongoing care.`;
        setSummary(fallbackSummary);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [test]);

  // Simple markdown-like rendering for bold headers
  const renderSummary = (text) => {
    if (!text) return null;

    // Split by ** markers and render
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // This is text that was between ** markers - render as heading
        return <h4 key={i} className="font-semibold text-slate-900 mt-4 mb-2 first:mt-0">{part}</h4>;
      }
      // Regular text - preserve line breaks
      return part.split('\n').map((line, j) => (
        <p key={`${i}-${j}`} className="text-slate-600 text-sm leading-relaxed mb-2 last:mb-0">
          {line}
        </p>
      ));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Understanding {test.name}</h3>
              <p className="text-sm text-slate-600">Plain language guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white/50 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center animate-pulse mb-4">
                <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-slate-600 text-sm">Creating your personalized guide...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-rose-600 hover:text-rose-700 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {summary && (
            <div className="prose prose-sm max-w-none">
              {renderSummary(summary)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TestLookupWizard({ testData = [], onNavigate, onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [insuranceType, setInsuranceType] = useState(null); // 'medicare' | 'private' | 'none' | null

  // New state for deep insurance integration
  const [cancerType, setCancerType] = useState(null);
  const [cancerStage, setCancerStage] = useState(null);
  const [selectedPayer, setSelectedPayer] = useState(null);
  const [payerSearchQuery, setPayerSearchQuery] = useState('');
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);

  // External link confirmation state
  const [externalLinkConfirm, setExternalLinkConfirm] = useState(null); // { url, siteName }

  // Handle external link click - show confirmation
  const handleExternalLink = (url, siteName) => {
    setExternalLinkConfirm({ url, siteName });
  };

  // Get assistance program for selected test's vendor
  const { program: assistanceProgram } = useAssistanceProgram(selectedTest?.vendor);

  // Get ALL payers we have data for across ALL tests (for autocomplete)
  const allKnownPayers = useMemo(() => {
    return getAllPayersFromTests(testData);
  }, [testData]);

  // Filter payers for autocomplete based on search query
  const filteredPayers = useMemo(() => {
    if (!payerSearchQuery.trim()) return allKnownPayers;
    const query = payerSearchQuery.toLowerCase();
    return allKnownPayers.filter(payer =>
      payer.label.toLowerCase().includes(query)
    );
  }, [payerSearchQuery, allKnownPayers]);

  // Get available payers for the selected test (still needed for checking if test has data)
  const availablePayers = useMemo(() => {
    if (!selectedTest) return [];
    return getAvailablePayers(selectedTest);
  }, [selectedTest]);

  // Check if selected payer has data for THIS test specifically
  const payerHasTestData = useMemo(() => {
    if (!selectedPayer || !selectedTest) return false;
    return availablePayers.some(p => p.id === selectedPayer);
  }, [selectedPayer, selectedTest, availablePayers]);

  // Check if selected payer is in our known payers list (we have data somewhere)
  const payerIsKnown = useMemo(() => {
    if (!selectedPayer) return false;
    return allKnownPayers.some(p => p.id === selectedPayer);
  }, [selectedPayer, allKnownPayers]);

  // Calculate Medicare coverage result
  const medicareCoverageResult = useMemo(() => {
    if (insuranceType !== 'medicare' || !selectedTest || !cancerType) return null;
    return checkMedicareCoverage(selectedTest, cancerType, cancerStage);
  }, [insuranceType, selectedTest, cancerType, cancerStage]);

  // Calculate private payer coverage result
  const payerCoverageResult = useMemo(() => {
    if (insuranceType !== 'private' || !selectedTest || !selectedPayer || !cancerType) return null;

    // User selected "Other / not listed"
    if (selectedPayer === 'other') {
      return { isOther: true };
    }

    // We know this payer but don't have data for THIS test
    if (payerIsKnown && !payerHasTestData) {
      const payerLabel = allKnownPayers.find(p => p.id === selectedPayer)?.label || selectedPayer;
      return { noTestData: true, payerLabel };
    }

    // We don't know this payer at all (shouldn't happen with autocomplete, but just in case)
    if (!payerIsKnown) {
      return { isOther: true };
    }

    // We have data for this payer on this test
    return getPayerCoverage(selectedTest, selectedPayer, cancerType, cancerStage);
  }, [insuranceType, selectedTest, selectedPayer, cancerType, cancerStage, payerIsKnown, payerHasTestData, allKnownPayers]);

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
    setCancerType(null);
    setCancerStage(null);
    setSelectedPayer(null);
    setPayerSearchQuery('');
    setShowPayerDropdown(false);
    setShowSummaryModal(false);
  };

  // Handle insurance type selection
  const handleInsuranceTypeSelect = (type) => {
    setInsuranceType(type);
    setCancerType(null);
    setCancerStage(null);
    setSelectedPayer(null);
    setPayerSearchQuery('');
    setShowPayerDropdown(false);
  };

  // Handle payer selection from autocomplete
  const handlePayerSelect = (payerId) => {
    setSelectedPayer(payerId);
    const payer = allKnownPayers.find(p => p.id === payerId);
    setPayerSearchQuery(payer?.label || '');
    setShowPayerDropdown(false);
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
    const crossRef = selectedTest.coverageCrossReference;

    // Priority: listPrice > cashPay > medicareRate > reimbursementRate
    const listPrice = selectedTest.listPrice;
    const cashPay = crossRef?.vendorClaims?.cashPay; // e.g., "$4,150"
    const medicareRate = selectedTest.medicareRate; // e.g., 3920
    const reimbursementRate = medicareCoverage?.reimbursementRate;

    // Parse cashPay string to number if present
    const cashPayNum = cashPay ? parseInt(cashPay.replace(/[^0-9]/g, '')) : null;

    let priceSource = null;
    let priceValue = null;

    if (listPrice) {
      priceSource = 'list';
      priceValue = listPrice;
    } else if (cashPayNum) {
      priceSource = 'cashPay';
      priceValue = cashPayNum;
    } else if (medicareRate) {
      priceSource = 'medicare';
      priceValue = medicareRate;
    } else if (reimbursementRate) {
      priceSource = 'medicare';
      priceValue = reimbursementRate;
    }

    return {
      priceValue,
      priceSource,
      hasMedicareCoverage: medicareCoverage?.status === 'COVERED',
      medicarePolicy: medicareCoverage?.policyNumber,
    };
  };

  const costInfo = getCostInfo();

  return (
    <div className={`min-h-screen bg-gradient-to-b from-rose-50/50 to-white print:bg-white print:min-h-0`}>
      {/* Print-only header */}
      <div className="hidden print:block print:mb-4 print:pb-4 print:border-b print:border-slate-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {selectedTest?.name || 'Test Information'}
            </h1>
            <p className="text-sm text-slate-600">
              {selectedTest?.vendor} • From OpenOnco.org
            </p>
          </div>
          <p className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Header - hide when printing */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-10 print:hidden">
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 print:py-0 print:px-0 print:max-w-none">
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
          <div className="space-y-6 print:space-y-3">
            {/* Test header - hide when printing (we have print-only header) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 print:hidden">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedTest.name}</h2>
                  <p className="text-slate-600">{selectedTest.vendor}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSummaryModal(true)}
                    className="text-base text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                  >
                    Explain this test to me
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(true)}
                    className="text-base text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                  >
                    Test technical details
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Insurance type selection - 3 buttons (hide when printing) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 print:hidden">
              <h3 className="font-semibold text-slate-900 mb-4">What type of coverage do you have?</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleInsuranceTypeSelect('medicare')}
                  className={`py-3 px-3 border-2 rounded-xl font-medium transition-all text-center
                    ${insuranceType === 'medicare'
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-slate-200 hover:border-rose-300'
                    }`}
                >
                  Medicare
                </button>
                <button
                  onClick={() => handleInsuranceTypeSelect('private')}
                  className={`py-3 px-3 border-2 rounded-xl font-medium transition-all text-center
                    ${insuranceType === 'private'
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-slate-200 hover:border-rose-300'
                    }`}
                >
                  Private Insurance
                </button>
                <button
                  onClick={() => handleInsuranceTypeSelect('none')}
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

            {/* Private Insurance: Payer Autocomplete (FIRST) - hide when printing */}
            {insuranceType === 'private' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 print:hidden">
                <label className="block font-medium text-slate-900 mb-2">
                  Who is your insurance provider?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={payerSearchQuery}
                    onChange={(e) => {
                      setPayerSearchQuery(e.target.value);
                      setShowPayerDropdown(true);
                      // Clear selection if user starts typing something different
                      if (selectedPayer && e.target.value !== allKnownPayers.find(p => p.id === selectedPayer)?.label) {
                        setSelectedPayer(null);
                        setCancerType(null);
                        setCancerStage(null);
                      }
                    }}
                    onFocus={() => setShowPayerDropdown(true)}
                    onBlur={() => {
                      // Delay to allow click on dropdown item
                      setTimeout(() => setShowPayerDropdown(false), 200);
                    }}
                    placeholder="Start typing your insurer name..."
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-700
                               focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                  {/* Autocomplete dropdown */}
                  {showPayerDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                      {filteredPayers.length > 0 ? (
                        <>
                          {filteredPayers.map((payer) => (
                            <button
                              key={payer.id}
                              onClick={() => handlePayerSelect(payer.id)}
                              className={`w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0
                                         transition-colors focus:outline-none focus:bg-slate-50
                                         ${selectedPayer === payer.id ? 'bg-rose-50 text-rose-700' : ''}`}
                            >
                              {payer.label}
                            </button>
                          ))}
                          <button
                            onClick={() => handlePayerSelect('other')}
                            className={`w-full px-4 py-3 text-left hover:bg-slate-50 border-t border-slate-200
                                       transition-colors focus:outline-none focus:bg-slate-50 text-slate-600
                                       ${selectedPayer === 'other' ? 'bg-rose-50 text-rose-700' : ''}`}
                          >
                            My insurer isn't listed
                          </button>
                        </>
                      ) : (
                        <div className="px-4 py-3 text-slate-500">
                          <p>No matching insurers found.</p>
                          <button
                            onClick={() => handlePayerSelect('other')}
                            className="mt-2 text-rose-600 hover:text-rose-700 font-medium"
                          >
                            Continue without selecting an insurer →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedPayer && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ {selectedPayer === 'other' ? "We'll show general guidance" : `Selected: ${allKnownPayers.find(p => p.id === selectedPayer)?.label}`}
                  </p>
                )}
              </div>
            )}

            {/* Cancer Type & Stage Selection (for Medicare, or for Private after payer selected) - hide when printing */}
            {(insuranceType === 'medicare' || (insuranceType === 'private' && selectedPayer)) && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 print:hidden">
                {/* Cancer Type Dropdown */}
                <div>
                  <label className="block font-medium text-slate-900 mb-2">
                    What type of cancer were you diagnosed with?
                  </label>
                  <select
                    value={cancerType || ''}
                    onChange={(e) => {
                      setCancerType(e.target.value || null);
                      setCancerStage(null);
                    }}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-700
                               focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="">Select cancer type...</option>
                    {CANCER_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stage Selection */}
                {cancerType && (
                  <div>
                    <label className="block font-medium text-slate-900 mb-2">
                      What stage was your cancer at diagnosis?
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {CANCER_STAGES.map((stage) => (
                        <button
                          key={stage.id}
                          onClick={() => setCancerStage(stage.id)}
                          className={`py-2 px-2 border-2 rounded-lg font-medium transition-all text-center text-sm
                            ${cancerStage === stage.id
                              ? 'border-rose-500 bg-rose-50 text-rose-700'
                              : 'border-slate-200 hover:border-rose-300'
                            }`}
                        >
                          {stage.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cost & Coverage Results - Medicare */}
            {insuranceType === 'medicare' && cancerType && cancerStage && medicareCoverageResult && (
              <div
                key={`medicare-${cancerType}-${cancerStage}`}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-fade-in print:p-4 print:space-y-2 print:border-slate-300"
              >
                <h3 className="font-semibold text-slate-900">Medicare Coverage</h3>

                {medicareCoverageResult.reason === 'no-data' ? (
                  // No Medicare data for this test
                  <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-medium text-slate-800">Coverage data not available</p>
                      <p className="text-sm text-slate-600 mt-1">
                        We don't have Medicare coverage data for this test. Your oncologist can help determine coverage.
                      </p>
                    </div>
                  </div>
                ) : medicareCoverageResult.hasCoverage && medicareCoverageResult.indicationMatch !== false ? (
                  // Coverage appears to match
                  <div className="flex items-start gap-3 bg-green-50 rounded-lg p-4">
                    <span className="text-xl">✓</span>
                    <div>
                      <p className="font-medium text-green-800">Your indication appears to be covered</p>
                      <div className="text-sm text-green-700 mt-2 space-y-1">
                        <p><strong>Based on our data:</strong></p>
                        {medicareCoverageResult.policy && (
                          <p>• Policy: {medicareCoverageResult.policy} {medicareCoverageResult.policyName ? `(${medicareCoverageResult.policyName})` : '(MolDX)'}</p>
                        )}
                        {medicareCoverageResult.matchedIndication && (
                          <p>• Matching indication: {medicareCoverageResult.matchedIndication}</p>
                        )}
                        <p>• Your selection: {CANCER_TYPES.find(c => c.id === cancerType)?.label} {CANCER_STAGES.find(s => s.id === cancerStage)?.label} ✓</p>
                        {medicareCoverageResult.rate && (
                          <p>• Reimbursement rate: {medicareCoverageResult.rate}</p>
                        )}
                      </div>
                      <div className="mt-4 bg-green-100 rounded-lg p-3">
                        <p className="text-sm font-medium text-green-900">What to tell your doctor:</p>
                        <p className="text-sm text-green-800 mt-1 italic">
                          "I'd like {selectedTest.name} for MRD monitoring. It appears to be covered under Medicare policy {medicareCoverageResult.policy || 'MolDX'} for my indication."
                        </p>
                      </div>
                      <p className="text-xs text-green-700 mt-3">
                        ⚠️ Coverage rules are complex — your doctor can confirm eligibility.
                      </p>
                    </div>
                  </div>
                ) : (
                  // We have data but indication doesn't match
                  <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-medium text-amber-800">We couldn't confirm coverage for your indication</p>
                      <div className="text-sm text-amber-700 mt-2 space-y-1">
                        <p><strong>Here's the coverage data we have:</strong></p>
                        {medicareCoverageResult.policy && (
                          <p>• Policy: {medicareCoverageResult.policy} {medicareCoverageResult.policyName ? `(${medicareCoverageResult.policyName})` : ''}</p>
                        )}
                        {medicareCoverageResult.indications?.length > 0 && (
                          <p>• Covered indications: {medicareCoverageResult.indications.slice(0, 3).join(', ')}{medicareCoverageResult.indications.length > 3 ? ` (+${medicareCoverageResult.indications.length - 3} more)` : ''}</p>
                        )}
                        <p>• Your selection: {CANCER_TYPES.find(c => c.id === cancerType)?.label} {CANCER_STAGES.find(s => s.id === cancerStage)?.label}</p>
                      </div>
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-800 font-medium">
                          ✨ This doesn't mean you're not covered — coverage rules are complex. Your oncologist can help determine eligibility.
                        </p>
                      </div>
                      {assistanceProgram && (
                        <div className="mt-4 bg-amber-100 rounded-lg p-3">
                          <p className="text-sm text-amber-900">
                            <strong>If cost is a concern:</strong> {assistanceProgram.programName || `${selectedTest.vendor} financial assistance`} may help.
                          </p>
                          {assistanceProgram.applicationUrl && (
                            <button
                              onClick={() => handleExternalLink(assistanceProgram.applicationUrl, selectedTest.vendor)}
                              className="inline-flex items-center gap-1 text-sm text-amber-800 hover:text-amber-900 font-medium mt-1"
                            >
                              Learn about assistance →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cost & Coverage Results - Private Insurance */}
            {insuranceType === 'private' && cancerType && cancerStage && selectedPayer && payerCoverageResult && (
              <div
                key={`private-${cancerType}-${cancerStage}-${selectedPayer}`}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-fade-in print:p-4 print:space-y-2 print:border-slate-300"
              >
                <h3 className="font-semibold text-slate-900">
                  {payerCoverageResult.isOther || payerCoverageResult.noTestData
                    ? 'Coverage Data'
                    : `${payerCoverageResult.label} Coverage Data for ${selectedTest.name}`}
                </h3>

                {payerCoverageResult.isOther ? (
                  // "Other" / insurer not in our data
                  <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-medium text-slate-800">We haven't been able to find coverage data for this insurer</p>
                      <div className="text-sm text-slate-700 mt-3 space-y-1">
                        <p><strong>What to share with your doctor's office:</strong></p>
                        <p>• Test: {selectedTest.name} by {selectedTest.vendor}</p>
                        <p>• Your indication: {CANCER_TYPES.find(c => c.id === cancerType)?.label} {CANCER_STAGES.find(s => s.id === cancerStage)?.label}</p>
                        {selectedTest.cptCodes && <p>• Billing code: CPT {selectedTest.cptCodes}</p>}
                      </div>
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-800 font-medium">
                          ✨ Your oncologist's office can verify coverage with your insurance provider. Many tests are covered even when we don't have the policy data.
                        </p>
                      </div>
                      {assistanceProgram && (
                        <div className="mt-4 bg-blue-50 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            <strong>💝 If cost is a concern:</strong> {assistanceProgram.programName || `${selectedTest.vendor} financial assistance`}
                          </p>
                          {assistanceProgram.applicationUrl && (
                            <button
                              onClick={() => handleExternalLink(assistanceProgram.applicationUrl, selectedTest.vendor)}
                              className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 font-medium mt-1"
                            >
                              Learn about assistance →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : payerCoverageResult.noTestData ? (
                  // We know this payer but don't have data for THIS test
                  <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-medium text-slate-800">
                        We have {payerCoverageResult.payerLabel} data on other tests, but haven't been able to access their policy on {selectedTest.name} yet
                      </p>
                      <div className="text-sm text-slate-700 mt-3 space-y-1">
                        <p><strong>What to share with your doctor's office:</strong></p>
                        <p>• Test: {selectedTest.name} by {selectedTest.vendor}</p>
                        <p>• Your indication: {CANCER_TYPES.find(c => c.id === cancerType)?.label} {CANCER_STAGES.find(s => s.id === cancerStage)?.label}</p>
                        {selectedTest.cptCodes && <p>• Billing code: CPT {selectedTest.cptCodes}</p>}
                      </div>
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-800 font-medium">
                          ✨ Your oncologist's office can verify coverage with {payerCoverageResult.payerLabel} directly. Coverage policies change frequently — your doctor can get the latest information.
                        </p>
                      </div>
                      {assistanceProgram && (
                        <div className="mt-4 bg-blue-50 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            <strong>💝 If cost is a concern:</strong> {assistanceProgram.programName || `${selectedTest.vendor} financial assistance`}
                          </p>
                          {assistanceProgram.applicationUrl && (
                            <button
                              onClick={() => handleExternalLink(assistanceProgram.applicationUrl, selectedTest.vendor)}
                              className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 font-medium mt-1"
                            >
                              Learn about assistance →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : payerCoverageResult.status === 'COVERED' || (payerCoverageResult.status === 'PARTIAL' && payerCoverageResult.indicationMatch) ? (
                  // Covered or partial with matching indication
                  <div className="flex items-start gap-3 bg-green-50 rounded-lg p-4">
                    <span className="text-xl">✓</span>
                    <div>
                      <p className="font-medium text-green-800">Your indication appears to be covered</p>
                      <div className="text-sm text-green-700 mt-2 space-y-1">
                        <p><strong>Here's what we have:</strong></p>
                        {payerCoverageResult.policy && <p>• Policy: {payerCoverageResult.policy}</p>}
                        {payerCoverageResult.coveredIndications?.length > 0 && (
                          <p>• Covered indications: {payerCoverageResult.coveredIndications.join(', ')}</p>
                        )}
                        <p>• Your selection: {CANCER_TYPES.find(c => c.id === cancerType)?.label} {CANCER_STAGES.find(s => s.id === cancerStage)?.label} ✓</p>
                      </div>
                      <div className="mt-4 bg-green-100 rounded-lg p-3">
                        <p className="text-sm font-medium text-green-900">Next steps:</p>
                        <ol className="text-sm text-green-800 mt-1 list-decimal list-inside">
                          <li>Ask your oncologist to submit prior authorization</li>
                          {payerCoverageResult.policy && <li>They can reference policy {payerCoverageResult.policy}</li>}
                        </ol>
                      </div>
                      <p className="text-xs text-green-700 mt-3">
                        ⚠️ Plans vary — your doctor's office can confirm coverage.
                      </p>
                    </div>
                  </div>
                ) : payerCoverageResult.status === 'PARTIAL' ? (
                  // Partial coverage but indication doesn't match
                  <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-medium text-amber-800">We couldn't confirm coverage for your indication</p>
                      <div className="text-sm text-amber-700 mt-2 space-y-1">
                        <p><strong>Here's the data we have:</strong></p>
                        {payerCoverageResult.policy && <p>• Policy: {payerCoverageResult.policy}</p>}
                        {payerCoverageResult.coveredIndications?.length > 0 && (
                          <p>• Covered indications: {payerCoverageResult.coveredIndications.join(', ')}</p>
                        )}
                        <p>• Your selection: {CANCER_TYPES.find(c => c.id === cancerType)?.label} {CANCER_STAGES.find(s => s.id === cancerStage)?.label}</p>
                        {payerCoverageResult.notes && <p>• Policy notes: "{payerCoverageResult.notes}"</p>}
                      </div>
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-800 font-medium">
                          ✨ This doesn't mean you're not covered — your oncologist can still request prior authorization. Plans and rules vary.
                        </p>
                      </div>
                      {assistanceProgram && (
                        <div className="mt-4 bg-amber-100 rounded-lg p-3">
                          <p className="text-sm text-amber-900">
                            <strong>💝 If cost is a concern:</strong> {assistanceProgram.programName || `${selectedTest.vendor} financial assistance`}
                          </p>
                          {assistanceProgram.applicationUrl && (
                            <button
                              onClick={() => handleExternalLink(assistanceProgram.applicationUrl, selectedTest.vendor)}
                              className="inline-flex items-center gap-1 text-sm text-amber-800 hover:text-amber-900 font-medium mt-1"
                            >
                              Learn about assistance →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Not covered or experimental
                  <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-medium text-amber-800">
                        {payerCoverageResult.status === 'EXPERIMENTAL'
                          ? 'This test is classified as experimental by this payer'
                          : 'Coverage not confirmed for this payer'}
                      </p>
                      <div className="text-sm text-amber-700 mt-2 space-y-1">
                        <p><strong>Here's what we have:</strong></p>
                        {payerCoverageResult.policy && <p>• Policy: {payerCoverageResult.policy}</p>}
                        {payerCoverageResult.notes && <p>• Notes: {payerCoverageResult.notes}</p>}
                      </div>
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-800 font-medium">
                          ✨ Your oncologist may still be able to request coverage through prior authorization or appeal. Coverage policies change — confirm with your plan directly.
                        </p>
                      </div>
                      {assistanceProgram && (
                        <div className="mt-4 bg-blue-50 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            <strong>💝 Financial assistance available:</strong> {assistanceProgram.programName || `${selectedTest.vendor}`}
                          </p>
                          {assistanceProgram.maxOutOfPocket && (
                            <p className="text-sm text-blue-700">Qualifying patients may pay {assistanceProgram.maxOutOfPocket}</p>
                          )}
                          {assistanceProgram.applicationUrl && (
                            <button
                              onClick={() => handleExternalLink(assistanceProgram.applicationUrl, selectedTest.vendor)}
                              className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                                         text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              Apply for assistance
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cost & Coverage - No Insurance */}
            {insuranceType === 'none' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 print:p-4 print:space-y-2 print:border-slate-300">
                <h3 className="font-semibold text-slate-900">Cost Without Insurance</h3>

                {/* Price info - with source-appropriate labeling */}
                {costInfo?.priceValue ? (
                  <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                    <span className="text-xl">💰</span>
                    <div>
                      {costInfo.priceSource === 'list' && (
                        <p className="font-medium text-slate-800">List price: ~${costInfo.priceValue.toLocaleString()} per test</p>
                      )}
                      {costInfo.priceSource === 'cashPay' && (
                        <p className="font-medium text-slate-800">Cash pay price: ~${costInfo.priceValue.toLocaleString()} per test</p>
                      )}
                      {costInfo.priceSource === 'medicare' && (
                        <>
                          <p className="font-medium text-slate-800">Medicare reimbursement rate: ~${costInfo.priceValue.toLocaleString()}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            This is what Medicare pays — actual self-pay costs may differ. Contact {selectedTest.vendor} for current pricing.
                          </p>
                        </>
                      )}
                      <p className="text-sm text-slate-600 mt-1">
                        {selectedTest.name} is typically done every 3-6 months during monitoring.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                    <span className="text-xl">💰</span>
                    <div>
                      <p className="font-medium text-slate-800">Contact {selectedTest.vendor} for pricing</p>
                      <p className="text-sm text-slate-600 mt-1">
                        We don't have current pricing information for this test.
                      </p>
                    </div>
                  </div>
                )}

                {/* Financial assistance */}
                {assistanceProgram ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">💝</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-blue-900 mb-1">
                          Financial Assistance Available
                        </h4>
                        <p className="font-medium text-blue-800 text-sm">
                          {assistanceProgram.programName || `${selectedTest.vendor} Patient Assistance Program`}
                        </p>
                        <ul className="text-sm text-blue-700 mt-2 space-y-1">
                          {assistanceProgram.eligibilityRules?.fplThresholds?.[0] && (
                            <li>• Income-based assistance (uses Federal Poverty Level)</li>
                          )}
                          {assistanceProgram.paymentPlans && (
                            <li>• {assistanceProgram.paymentPlans}</li>
                          )}
                          <li>• Many patients qualify for reduced or no cost</li>
                        </ul>
                        {assistanceProgram.applicationUrl && (
                          <button
                            onClick={() => handleExternalLink(assistanceProgram.applicationUrl, selectedTest.vendor)}
                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700
                                       text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Apply for Assistance
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        )}
                        {assistanceProgram.contactPhone && (
                          <p className="text-sm text-blue-700 mt-3">
                            📞 Questions? Call {selectedTest.vendor} billing: {assistanceProgram.contactPhone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="font-medium text-slate-800">Contact {selectedTest.vendor} directly</p>
                      <p className="text-sm text-slate-600 mt-1">
                        Most vendors offer patient assistance programs for uninsured patients.
                        Contact {selectedTest.vendor} billing to ask about financial assistance options.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons - hide when printing */}
            <div className="flex gap-3 print:hidden">
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
                Print this information
              </button>
            </div>

            {/* Contextual Next Steps - only show when we have a coverage conclusion */}
            {(() => {
              const nextSteps = getNextSteps(
                insuranceType,
                insuranceType === 'medicare' ? medicareCoverageResult : payerCoverageResult,
                selectedTest,
                assistanceProgram,
                cancerType,
                cancerStage
              );

              // Only show if we have next steps and user has completed the flow
              const showNextSteps = nextSteps && (
                insuranceType === 'none' ||
                (insuranceType === 'medicare' && cancerType && cancerStage && medicareCoverageResult) ||
                (insuranceType === 'private' && selectedPayer && cancerType && cancerStage && payerCoverageResult)
              );

              if (!showNextSteps) return null;

              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 print:p-4 print:border-slate-300">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 print:mb-2">
                    <span className="text-xl print:text-base">{nextSteps.icon}</span>
                    {nextSteps.title}
                  </h3>
                  <div className="space-y-4 print:space-y-2">
                    {nextSteps.steps.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 print:gap-2"
                      >
                        <div className="w-6 h-6 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 print:w-5 print:h-5">
                          <span className="text-xs font-bold text-rose-600">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 print:text-sm">{step.heading}</p>
                          <p className="text-sm text-slate-600 mt-1 print:text-xs print:mt-0.5">{step.detail}</p>
                          {step.hasAssistanceLink && assistanceProgram?.applicationUrl && (
                            <button
                              onClick={() => handleExternalLink(assistanceProgram.applicationUrl, selectedTest.vendor)}
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 print:hidden"
                            >
                              Apply for assistance →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-center text-xs text-slate-500 mt-8 px-4 print:mt-4 print:text-[10px] print:border-t print:border-slate-200 print:pt-3">
          This guide is for educational purposes only and does not constitute medical advice.
          Always consult with your healthcare team about your specific situation.
        </p>
      </main>

      {/* Test Detail Modal - hide when printing */}
      <div className="print:hidden">
        {showDetailModal && selectedTest && (
          <TestDetailModal
            test={selectedTest}
            category="MRD"
            onClose={() => setShowDetailModal(false)}
          />
        )}
      </div>

      {/* Plain Language Summary Modal - hide when printing */}
      <div className="print:hidden">
        {showSummaryModal && selectedTest && (
          <PlainLanguageSummaryModal
            test={selectedTest}
            onClose={() => setShowSummaryModal(false)}
          />
        )}
      </div>

      {/* External Link Confirmation Modal - hide when printing */}
      <div className="print:hidden">
        {externalLinkConfirm && (
          <ExternalLinkConfirm
            url={externalLinkConfirm.url}
            siteName={externalLinkConfirm.siteName}
            onClose={() => setExternalLinkConfirm(null)}
          />
        )}
      </div>

      {/* Floating AI Helper - only show when test is selected, hide when printing */}
      <div className="print:hidden">
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
    </div>
  );
}
