/**
 * Comprehensive PAP Rules Enrichment
 * Adds detailed eligibility rules, FPL thresholds, and documentation requirements
 * Sources: Vendor PDFs, web pages, third-party research
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../src/data.js');

// Comprehensive eligibility rules from all sources
const ELIGIBILITY_RULES = {
  'Myriad Genetics': {
    fplThresholds: [
      { maxFPL: 100, discount: '100%', maxOOP: '$0', notes: 'Free testing' },
      { maxFPL: 200, discount: '100%', maxOOP: '$0', notes: 'Free testing' },
      { maxFPL: 300, discount: 'Tiered', maxOOP: '$100', notes: 'Reduced cost' },
      { maxFPL: 400, discount: 'Tiered', maxOOP: '$249', notes: 'GeneSight $200, others $249' }
    ],
    householdSizeConsidered: true,
    householdSizeChart: 'Uses HHS Poverty Guidelines with specific dollar amounts per household size (1-8+)',
    requiredDocumentation: ['Income verification', 'Household size attestation'],
    uninsuredEligible: true,
    medicareEligible: false,
    medicaidEligible: false,
    tricareEligible: false,
    medicareAdvantageEligible: false,
    medicaidException: 'Limited state-funded plans (emergency-only, non-coverage states) may qualify',
    paymentPlanTerms: 'Interest-free payment plans available',
    restrictions: [
      'Not available for federally funded insurance (Medicare, Medicaid, TRICARE, Medicare Advantage)',
      'Program may be terminated or modified at any time'
    ],
    lastVerifiedRules: '2025-02-23',
    rulesSource: 'https://myriad-library.s3.amazonaws.com/mfap/MFAP+2022+Financial+Criteria+05-22.pdf'
  },
  
  'Quest Diagnostics': {
    fplThresholds: [
      { maxFPL: 100, discount: '100%', maxOOP: '$0', notes: 'Free testing' },
      { maxFPL: 200, discount: 'Capped', maxOOP: '$100', notes: 'Max $100 per bill' },
      { maxFPL: 400, discount: 'Capped', maxOOP: '$200', notes: 'Hereditary cancer tests max $200' }
    ],
    householdSizeConsidered: true,
    householdSizeChart: 'Uses HHS FPL guidelines updated annually',
    requiredDocumentation: ['Income verification', 'Household size attestation'],
    uninsuredEligible: true,
    medicareEligible: true,
    medicaidEligible: true,
    paymentPlanTerms: '0% financing for 12-month period',
    processingTime: '~2 weeks',
    restrictions: [
      'Discounts up to 100% based on HHS guidelines',
      'High-cost genetics/oncology testing has supplemental program (200-400% FPL)'
    ],
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.questdiagnostics.com/patients/billing-insurance/financial-assistance'
  },

  'Foundation Medicine': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: '$100', notes: 'Max $100 lifetime for qualifying patients' }
    ],
    householdSizeConsidered: true,
    householdSizeChart: 'Gross annual household income + family size considered',
    requiredDocumentation: [
      'Total gross annual household income',
      'Number of family members in household',
      'Extenuating circumstances checklist (optional)'
    ],
    extenuatingCircumstances: [
      'Retired/fixed income',
      'Disability',
      'Significant credit card debt',
      'Significant medical expenses',
      'Supporting family members outside household',
      'Alimony/child support',
      'Loss of income due to diagnosis/treatment',
      'Unforeseen expenses',
      'Non-local travel expenses for treatment',
      'College expenses'
    ],
    uninsuredEligible: true,
    medicareEligible: true,
    medicaidEligible: true,
    medicaidZeroCost: true,
    medicalDebtConsidered: true,
    paymentPlanTerms: 'Payment plans available if not qualifying for full assistance',
    restrictions: [
      'Only available to domestic US residents',
      'Not available for patients who choose self-pay when insured'
    ],
    applicationUrl: 'https://aid.foundationmedicine.com/',
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.foundationmedicine.com/sites/default/files/media/documents/2023-10/Patient_Financial_Assistance_Application_072020.pdf'
  },

  'Exact Sciences': {
    fplThresholds: [
      { maxFPL: 400, discount: 'Needs-based', maxOOP: null, notes: 'At or below 400% FPL may qualify' }
    ],
    householdSizeConsidered: true,
    householdSizeChart: 'Annual gross household income + household size',
    requiredDocumentation: [
      'W2 tax form from last year',
      'Federal or State tax return showing gross income',
      'Latest payroll statement or Social Security check',
      'Unemployment earnings documentation',
      'Proof of government assistance (Medicaid, SNAP, SSI, Home Energy Assistance)'
    ],
    alternativeDocumentation: 'Written description of financial need if documents unavailable',
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    medicalDebtConsidered: true,
    paymentPlanTerms: 'Payment options available (call 866-267-2322)',
    restrictions: [
      'Eligibility not guaranteed',
      'Availability limited',
      'Program criteria may change',
      'Payments will not be refunded if made before requesting assistance'
    ],
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.exactsciences.com/-/media/project/precisiononcology/precisiononcology/files/pdf/exact-sciences_financial-assistance-application.pdf'
  },

  'Tempus': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'Based on household income assessment' }
    ],
    householdSizeConsidered: true,
    householdSizeChart: 'Number of family members supported by gross annual household income',
    extenuatingCircumstances: [
      'Alimony/child support >$1,000/month',
      'Non-local travel costs >$1,000',
      'Supporting family outside household',
      'Qualified for charity care',
      'Disability enrollment',
      'Credit card debt >$5,000',
      'Medical expenses >$5,000',
      'Permanent income loss due to diagnosis/treatment'
    ],
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    medicalDebtConsidered: true,
    processingTime: '5-7 business days',
    applicationUrl: 'https://access.tempus.com',
    specialInsuranceNotes: 'Specific plans may have different consideration: BCBSNC, BCBSSC, BCBSVT, CBC, CareSource (OH/WV/KY/NC)',
    restrictions: [
      'Information must be truthful and complete or assistance may be withdrawn'
    ],
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.tempus.com/wp-content/uploads/2025/04/Tempus-Onco_Financial-Assistance-Form.pdf'
  },

  'Caris Life Sciences': {
    fplThresholds: [
      { maxFPL: null, discount: 'Sliding scale', maxOOP: null, notes: 'Income-based sliding fee discounts' }
    ],
    incomeRanges: '$0-$9,999 up to >$150,000 (sliding scale)',
    householdSizeConsidered: true,
    requiredDocumentation: ['Reason for financial assistance request'],
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    paymentPlanTerms: 'Prompt pay discounts and discounted payment plans available',
    restrictions: [
      'Guidelines may change or program discontinued without notice',
      'Submission does not constitute approval or guarantee eligibility'
    ],
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.carislifesciences.com/wp-content/uploads/2022/06/TN0235-v6_Tumor-Financial-Assistance-Application_eForm.pdf'
  },

  'Adaptive Biotechnologies': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'Based on income and/or medical expenses' }
    ],
    householdSizeConsidered: true,
    householdSizeChart: 'Income + household size OR medical expenses as % of household income',
    requiredDocumentation: [
      'Tax return',
      'W-2',
      'Recent pay stub',
      'Or comparable document demonstrating financial need'
    ],
    documentationDeadline: '45 days if documentation requested',
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    medicalDebtConsidered: true,
    processingTime: '10 working days',
    restrictions: [
      'Must be US citizen or legal resident',
      'Must be age 18+ (under 18 requires parent/guardian)',
      'Must have insurance that doesn\'t cover full cost OR be uninsured',
      'Cannot seek reimbursement from HSA/FSA for assisted services',
      'Test cannot be stopped once in process based on estimate'
    ],
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.clonoseq.com/wp-content/uploads/2022/02/Adaptive_Assist_PSP_Application_Form-1.pdf'
  },

  'Natera': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'Based on FPL guidelines' }
    ],
    householdSizeConsidered: true,
    householdSizeChart: 'Federal Poverty Level guidelines',
    requiredDocumentation: ['Income verification required'],
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    paymentPlanTerms: 'Interest-free payment plans starting at $25/month',
    applicationUrl: 'https://compassion.natera.com/s/',
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.natera.com/oncology/billing/'
  },

  'Guardant Health': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'Medical and financial need assessment' }
    ],
    householdSizeConsidered: null,
    requiredDocumentation: null,
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    applicationUrl: 'https://www.guardantcomplete.com/hcp/support/access-resources/',
    enrollmentMethod: 'Via testing requisition or Client Services contact',
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://guardanthealth.com/precision-oncology/for-patients/'
  },

  'NeoGenomics': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'Financial hardship assessment' }
    ],
    householdSizeConsidered: true,
    requiredDocumentation: ['Income documentation', 'Financial hardship certification'],
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    applicationUrl: 'https://www.neogenomics.com/billing/',
    restrictions: [
      'Patient certifies that testing would cause financial hardship',
      'Approval not guaranteed'
    ],
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.neogenomics.com/patients/'
  },

  'GRAIL': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'FPL-based criteria' }
    ],
    householdSizeConsidered: true,
    requiredDocumentation: ['Income verification'],
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.galleri.com/patient/cost-coverage'
  },

  'Labcorp': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'Income and circumstances based' }
    ],
    householdSizeConsidered: true,
    requiredDocumentation: ['Income verification', 'Circumstances documentation'],
    uninsuredEligible: true,
    medicareEligible: null,
    medicaidEligible: null,
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.labcorp.com/billing'
  },

  'Personalis': {
    fplThresholds: [
      { maxFPL: null, discount: 'Needs-based', maxOOP: null, notes: 'Contact billing for eligibility' }
    ],
    householdSizeConsidered: null,
    requiredDocumentation: ['Financial assistance application'],
    uninsuredEligible: true,
    applicationUrl: 'https://www.personalis.com/for-patients/financial-assistance-next-access/',
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.personalis.com/wp-content/uploads/2022/10/5.22.23_NeXT-Dx_Patient-FAQs.pdf'
  },

  'BillionToOne': {
    fplThresholds: null,
    householdSizeConsidered: null,
    requiredDocumentation: null,
    uninsuredEligible: null,
    notes: 'No formal financial assistance program publicly identified',
    applicationUrl: 'https://www.northstaronc.com/support',
    lastVerifiedRules: '2026-01-30',
    rulesSource: 'https://www.northstaronc.com/support'
  }
};

async function main() {
  console.log('=== Adding Eligibility Rules to PAP Data ===\n');
  
  // Read current data.js
  let content = fs.readFileSync(DATA_FILE, 'utf8');
  
  // Find each vendor in VENDOR_ASSISTANCE_PROGRAMS and add eligibilityRules
  for (const [vendor, rules] of Object.entries(ELIGIBILITY_RULES)) {
    console.log(`Processing: ${vendor}`);
    
    // Create eligibilityRules object as string
    const rulesStr = JSON.stringify(rules, null, 4)
      .replace(/"(\w+)":/g, '$1:')  // Remove quotes from keys
      .replace(/"/g, "'");          // Single quotes for strings
    
    // Find the vendor entry and add eligibilityRules after lastVerified
    const vendorPattern = new RegExp(
      `(['"]${vendor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*:\\s*\\{[^}]*lastVerified:\\s*['"][^'"]+['"])`,
      's'
    );
    
    const match = content.match(vendorPattern);
    if (match) {
      // Check if eligibilityRules already exists
      const vendorSection = content.slice(match.index, match.index + 2000);
      if (vendorSection.includes('eligibilityRules:')) {
        console.log(`  ⚠️  Already has eligibilityRules, skipping`);
        continue;
      }
      
      // Add eligibilityRules after lastVerified
      const replacement = match[1] + `,\n    eligibilityRules: ${rulesStr.split('\n').join('\n    ')}`;
      content = content.replace(match[1], replacement);
      console.log(`  ✅ Added eligibilityRules`);
    } else {
      console.log(`  ⚠️  Vendor not found in data.js`);
    }
  }
  
  // Write updated content
  fs.writeFileSync(DATA_FILE, content);
  console.log('\n=== Done ===');
  console.log(`Updated ${DATA_FILE}`);
}

main().catch(console.error);
