/**
 * Shared Coverage Helper Functions
 *
 * These functions are shared between WatchingWizard and TestLookupWizard
 * for coverage checking and next steps guidance.
 */

// Map payer IDs from coverageCrossReference.privatePayers to display labels
export const PAYER_LABELS = {
  aetna: 'Aetna',
  cigna: 'Cigna',
  united: 'UnitedHealthcare',
  anthem: 'Anthem / BCBS',
  humana: 'Humana',
  kaiser: 'Kaiser Permanente',
};

/**
 * Check if patient's cancer type and stage match a coverage indication string
 * Handles various formats like "Colorectal Stage II-IV", "CRC", "pan-cancer", etc.
 *
 * @param {string} indicationString - Coverage indication string from test data
 * @param {string} cancerType - Patient's cancer type (e.g., 'colorectal', 'breast')
 * @param {string} stage - Patient's cancer stage (e.g., 'stage-2', 'stage-3', 'unsure')
 * @returns {boolean} Whether the indication matches
 */
export function matchesIndication(indicationString, cancerType, stage) {
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
  if (!stage || stage === 'unsure' || stage === 'not-sure') return true;

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

/**
 * Check Medicare coverage for a test given patient's cancer type and stage
 *
 * @param {object} test - Test object with medicareCoverage and coverageCrossReference
 * @param {string} cancerType - Patient's cancer type
 * @param {string} stage - Patient's cancer stage
 * @returns {object} Coverage result with hasCoverage, indicationMatch, policy, etc.
 */
export function checkMedicareCoverage(test, cancerType, stage) {
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

/**
 * Get private payer coverage for a test
 *
 * @param {object} test - Test object with coverageCrossReference
 * @param {string} payerId - Payer ID (e.g., 'aetna', 'cigna')
 * @param {string} cancerType - Patient's cancer type
 * @param {string} stage - Patient's cancer stage
 * @returns {object|null} Payer coverage result or null if no data
 */
export function getPayerCoverage(test, payerId, cancerType, stage) {
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

/**
 * Get list of payers we have data for from a test
 *
 * @param {object} test - Test object
 * @returns {Array} Array of payer objects with id, label, status
 */
export function getAvailablePayers(test) {
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

/**
 * Get ALL unique payers across ALL tests (for autocomplete)
 *
 * @param {Array} testData - Array of test objects
 * @returns {Array} Array of unique payer objects sorted by label
 */
export function getAllPayersFromTests(testData) {
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

/**
 * Returns contextual "Next Steps" based on coverage conclusion
 *
 * @param {string} insuranceType - 'medicare' | 'private' | 'none'
 * @param {object} coverageResult - medicareCoverageResult or payerCoverageResult
 * @param {object} test - selectedTest object
 * @param {object} assistanceProgram - from useAssistanceProgram hook
 * @param {string} cancerType - selected cancer type
 * @param {string} cancerStage - selected stage
 * @returns {object|null} { title, icon, steps: [{ heading, detail }] }
 */
export function getNextSteps(insuranceType, coverageResult, test, assistanceProgram, cancerType, cancerStage) {
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
      icon: 'heart',
      steps: [
        {
          heading: 'Apply for financial assistance first',
          detail: `${programName} offers income-based assistance. Many patients qualify for reduced or no cost.`,
        },
        {
          heading: 'Contact billing to discuss options',
          detail: contactPhone
            ? `Call ${contactPhone} - Ask about payment plans and cash-pay pricing.`
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
        icon: 'check',
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
      optionsDetail = `If covered: Medicare Part B pays 80% after deductible. If not covered: ${vendorName}'s ${programName} may help.`;
      if (contactPhone) {
        optionsDetail += ` Call ${contactPhone}`;
      }
    } else {
      optionsDetail = 'If covered: Medicare Part B pays 80% after deductible. If not covered: Financial assistance may be available.';
    }

    return {
      title: 'Your Next Steps',
      icon: 'clipboard',
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
        icon: 'phone',
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
        icon: 'check',
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
      const parts = [`${vendorName}'s ${programName} may help cover costs if insurance doesn't.`];
      if (contactPhone) {
        parts.push(`Call ${contactPhone}`);
      }
      assistanceDetail = parts.join(' ');
    } else {
      assistanceDetail = `${vendorName} may offer a patient assistance program that can help cover costs.`;
    }

    return {
      title: 'Your Next Steps',
      icon: 'clipboard',
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
 * Get coverage status badge info for display
 * Returns appropriate badge configuration based on insurance type and coverage result
 *
 * @param {string} insuranceType - 'medicare' | 'private' | 'none'
 * @param {object} coverageResult - Coverage check result
 * @param {object} assistanceProgram - Assistance program info (optional)
 * @returns {object|null} { label, variant, icon }
 */
export function getCoverageBadge(insuranceType, coverageResult, assistanceProgram) {
  if (!insuranceType) return null;

  // No insurance - show assistance availability
  if (insuranceType === 'none') {
    if (assistanceProgram) {
      return {
        label: 'Assistance available',
        variant: 'assistance',
        icon: 'dollar',
      };
    }
    return null;
  }

  // Medicare path
  if (insuranceType === 'medicare') {
    if (!coverageResult) return null;

    if (coverageResult.hasCoverage && coverageResult.indicationMatch !== false) {
      return {
        label: 'Coverage likely',
        variant: 'covered',
        icon: 'check',
      };
    }
    if (coverageResult.hasCoverage && coverageResult.indicationMatch === false) {
      return {
        label: 'Check coverage',
        variant: 'uncertain',
        icon: 'question',
      };
    }
    return {
      label: 'Coverage uncertain',
      variant: 'uncertain',
      icon: 'question',
    };
  }

  // Private insurance path
  if (insuranceType === 'private') {
    if (!coverageResult) return null;

    if (coverageResult.isOther || coverageResult.noTestData) {
      return {
        label: 'Verify coverage',
        variant: 'uncertain',
        icon: 'phone',
      };
    }
    if (coverageResult.status === 'COVERED' ||
        (coverageResult.status === 'PARTIAL' && coverageResult.indicationMatch)) {
      return {
        label: 'Coverage likely',
        variant: 'covered',
        icon: 'check',
      };
    }
    if (coverageResult.status === 'PARTIAL') {
      return {
        label: 'Partial coverage',
        variant: 'partial',
        icon: 'minus',
      };
    }
    return {
      label: 'Check coverage',
      variant: 'uncertain',
      icon: 'question',
    };
  }

  return null;
}
