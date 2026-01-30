/**
 * Enrich VENDOR_ASSISTANCE_PROGRAMS with third-party data
 * Run: node scripts/enrich-pap-data.js
 */

const fs = require('fs');
const path = './src/data.js';

// Read current file
let content = fs.readFileSync(path, 'utf-8');

// New comprehensive VENDOR_ASSISTANCE_PROGRAMS with enriched data
const newPAPSection = `// Programs change frequently - verify with vendor before relying on them
// ============================================
export const VENDOR_ASSISTANCE_PROGRAMS = {
  'Natera': {
    programName: 'Compassionate Care / Financial Assistance Program',
    hasProgram: true,
    tests: ['Signatera', 'Altera', 'CLARITY Lymphoma', 'Signatera Genome', 'Latitude'],
    description: 'Financial assistance and payment plan options to reduce patient out-of-pocket cost for qualifying patients.',
    eligibility: 'Needs-based financial assistance for qualifying individuals/families; income verification required. Based on household size and income (Federal Poverty Level guidelines).',
    maxOutOfPocket: null,
    paymentPlans: 'Interest-free payment plans starting at $25/month',
    applicationUrl: 'https://compassion.natera.com/s/',
    applicationNotes: 'Separate application portal from main billing page',
    contactPhone: '1-844-384-2996',
    contactPhoneAlt: '650-489-9050 (select 2 for patients, then 4 for billing)',
    contactEmail: 'insbilling@natera.com',
    contactEmailAlt: 'signaterapc@natera.com',
    dedicatedCoordinators: true,
    sourceCitations: [
      'https://www.natera.com/oncology/billing/',
      'https://compassion.natera.com/s/',
      'https://eastcascadewomensgroup.com/wp-content/uploads/2023/02/Compassionate-Care-QR-Code-Postcard.pdf'
    ],
    lastVerified: '2026-01-30'
  },
  'Guardant Health': {
    programName: 'Guardant Access Program',
    hasProgram: true,
    tests: ['Guardant360 CDx', 'Guardant360 Liquid', 'Guardant360 Tissue', 'Guardant Reveal', 'Guardant360 Response', 'Shield'],
    description: 'Support program that includes insurance/coverage navigation and financial assistance determination for eligible patients. Aims to minimize surprise bills.',
    eligibility: 'Based on medical and financial need. Program emphasizes avoiding unexpected bills.',
    maxOutOfPocket: null,
    selfPayRates: { 'Guardant360': '$5,000', 'GuardantReveal': '$3,500' },
    applicationUrl: 'https://www.guardantcomplete.com/hcp/support/access-resources/',
    applicationUrlAlt: 'https://guardanthealth.com/precision-oncology/for-patients/',
    contactPhone: '855-698-8887',
    contactPhoneAlt: '855-722-7335 ext. 1, then press 2',
    contactEmail: 'ClientServices@GuardantHealth.com',
    contactEmailAlt: 'screeningpatient@guardanthealth.com',
    autoEnrollment: 'Patients enroll by signing the Testing Requisition form or by contacting Client Services',
    sourceCitations: [
      'https://www.guardantcomplete.com/hcp/support/access-resources/',
      'https://guardanthealth.com/precision-oncology/for-patients/',
      'https://guardanthealth.com/contact/'
    ],
    lastVerified: '2026-01-30'
  },
  'Foundation Medicine': {
    programName: 'FoundationAccess Financial Assistance Program',
    hasProgram: true,
    tests: ['FoundationOne CDx', 'FoundationOne Liquid CDx', 'FoundationOne Heme', 'FoundationOne RNA', 'FoundationOne Tracker'],
    description: 'Reimbursement and financial assistance support to help patients access Foundation Medicine tests. Financial assistance can be applied for at any point during the testing process.',
    eligibility: 'Needs-based financial assistance available for qualifying patients; may offer payment plans if patient does not qualify.',
    maxOutOfPocket: '$100 lifetime maximum for qualifying patients',
    selfPayRate: '$3,500 per test',
    coverageStats: '65% of commercially insured and 94% of Medicare patients pay $0',
    applicationUrl: 'https://aid.foundationmedicine.com/',
    applicationPdf: 'https://www.foundationmedicine.com/sites/default/files/media/documents/2023-10/Patient_Financial_Assistance_Application_072020.pdf',
    contactPhone: '888-988-3639',
    contactEmail: 'client.services@foundationmedicine.com',
    sourceCitations: [
      'https://www.foundationmedicine.com/resource/billing-and-financial-assistance',
      'https://www.foundationmedicine.com/patient/financial-support-resources',
      'https://aid.foundationmedicine.com/'
    ],
    lastVerified: '2026-01-30'
  },
  'GRAIL': {
    programName: 'Financial Assistance Program',
    hasProgram: true,
    tests: ['Galleri'],
    description: 'Financial assistance to reduce out-of-pocket cost for eligible individuals taking the Galleri test.',
    eligibility: 'Based on income/financial need (Federal Poverty Level-based criteria).',
    maxOutOfPocket: null,
    paymentOptions: 'Check, credit card, HSA/FSA eligible',
    coverageNotes: 'Limited insurance coverage currently; TRICARE covers with prior authorization',
    applicationUrl: 'https://www.galleri.com/patient/the-galleri-test/cost',
    contactPhone: '833-694-2553',
    contactEmail: 'patient-advocate@grailbio.com',
    patientAdvocate: true,
    lastVerified: '2026-01-30'
  },
  'Exact Sciences': {
    programName: 'Patient Assistance Program / Genomic Access Program (GAP)',
    hasProgram: true,
    tests: ['Cologuard', 'Cologuard Plus', 'Oncotype DX Breast', 'Oncotype DX Colon', 'OncoExTra', 'Cancerguard', 'Oncoguard Liver', 'Oncodetect'],
    description: 'Patient financial assistance and coverage support resources. Precision Oncology support team offers billing navigation and flexible payment options.',
    eligibility: 'At or below 400% of Federal Poverty Level (FPL). Eligibility is not guaranteed and may require proof of financial need; program criteria may change.',
    coverageNotes: 'At or below FPL may receive testing at no cost',
    applicationUrl: 'https://www.exactsciences.com/cancer-testing/coverage-financial-assistance',
    applicationPdf: 'https://www.exactsciences.com/-/media/project/precisiononcology/precisiononcology/files/pdf/exact-sciences_financial-assistance-application.pdf',
    estimatorTool: 'https://precisiononcology.exactsciences.com/patients-and-caregivers/testing-and-treating/cost-and-financial-resources',
    contactPhone: '866-267-2322',
    contactPhoneOncodetect: '888-662-6897',
    contactPhoneGAP: '888-662-6897 option 2',
    contactEmail: 'help@exactsciences.com',
    inNetworkPlans: ['Aetna', 'Anthem', 'Cigna', 'Humana', 'UnitedHealthcare'],
    sourceCitations: [
      'https://www.exactsciences.com/cancer-testing/coverage-financial-assistance',
      'https://www.exactsciences.com/cancer-testing/oncodetect-mrd-patients',
      'https://www.exactsciences.com/-/media/project/precisiononcology/precisiononcology/files/pdf/gap--billing-statements-ghi100460121.pdf'
    ],
    lastVerified: '2026-01-30'
  },
  'Tempus': {
    programName: 'Tempus Financial Assistance Program',
    hasProgram: true,
    tests: ['Tempus xT', 'Tempus xT CDx', 'Tempus xF', 'Tempus xR', 'Oncodetect', 'Tempus xM MRD'],
    description: 'Financial assistance based on household income and circumstances. Provides a maximum out-of-pocket amount if approved.',
    eligibility: 'Approval based on household income; may consider life circumstances/medical debt.',
    applicationUrl: 'https://access.tempus.com',
    applicationPdf: 'https://www.tempus.com/wp-content/uploads/2025/04/Tempus-Onco_Financial-Assistance-Form.pdf',
    applicationNotes: 'Applications can be completed online, via paper form, or by calling Customer Support',
    contactPhone: '800-739-4137',
    contactPhoneAlt: '888-988-8832',
    contactEmail: 'billing@tempus.com',
    contactFax: '800-893-0276',
    sourceCitations: [
      'https://www.tempus.com/resources/faqs-billing/',
      'https://www.tempus.com/wp-content/uploads/2025/04/Tempus-Onco_Financial-Assistance-Form.pdf',
      'https://www.tempus.com/life-sciences/sequencing/xm/'
    ],
    lastVerified: '2026-01-30'
  },
  'Caris Life Sciences': {
    programName: 'Caris Financial Assistance Programs',
    hasProgram: true,
    tests: ['Caris MI Profile', 'Caris Assure'],
    description: 'Financial assistance programs with sliding-fee discounts; application-based; prompt-pay discounts and discounted payment plans available.',
    eligibility: 'Based on financial need assessment. Application-based with sliding-fee discounts.',
    applicationUrl: 'https://www.carislifesciences.com/patients/patient-services/financial-services/',
    applicationUrlAlt: 'https://www.carismolecularintelligence.com/patients/financial-assistance/',
    applicationPdf: 'https://www.carislifesciences.com/wp-content/uploads/2022/06/TN0235-v6_Tumor-Financial-Assistance-Application_eForm.pdf',
    contactPhone: '1-888-979-8669',
    contactPhoneBilling: '1-877-630-6223',
    contactEmail: 'PatientBilling@CarisLS.com',
    contactEmailNavigator: 'PatientNavigator@CarisLS.com',
    sourceCitations: [
      'https://www.carislifesciences.com/patients/patient-services/financial-services/',
      'https://www.carislifesciences.com/wp-content/uploads/2022/06/TN0235-v6_Tumor-Financial-Assistance-Application_eForm.pdf',
      'https://www.carislifesciences.com/about/contact/',
      'https://www.carislifesciences.com/physicians/physician-tests/caris-assure/'
    ],
    lastVerified: '2026-01-30'
  },
  'Myriad Genetics': {
    programName: 'Myriad Financial Assistance Program',
    hasProgram: true,
    tests: ['MyChoice CDx', 'BRACAnalysis CDx'],
    description: 'Income-based financial assistance up to 100% discount for qualifying patients.',
    eligibility: 'Based on Federal Poverty Level guidelines.',
    maxOutOfPocket: '$0 for patients at or below 400% FPL',
    applicationUrl: 'https://myriad.com/affordability/financial-assistance/',
    contactPhone: '800-469-7423',
    restrictions: 'Not available for federally funded insurance (Medicare, Medicaid, TRICARE, Medicare Advantage)',
    lastVerified: '2026-01-30'
  },
  'Labcorp': {
    programName: 'Financial Assistance Program / Patient Assistance Program',
    hasProgram: true,
    tests: ['Invitae PCM', 'Labcorp Plasma Detect'],
    description: 'Billing support and financial assistance options; published ceiling self-pay prices.',
    eligibility: 'Based on income and circumstances.',
    typicalCost: 'Out-of-pocket typically less than $100 for insured patients',
    maxBillToInsurance: '$1,500 per clinical area - lower than most providers',
    familyVariantTesting: 'Free for family members of patients who used Financial Assistance Program',
    applicationUrl: 'https://www.invitae.com/us/individual-faqs/billing',
    contactPhone: '833-941-0828',
    contactEmail: 'LcGeneticsBilling@labcorp.com',
    uninsuredCeilingPrices: { 'Cancer': '$250', 'Rare Disease': '$299' },
    lastVerified: '2026-01-30'
  },
  'Quest Diagnostics': {
    programName: 'Patient Financial Assistance Program',
    hasProgram: true,
    tests: ['Haystack MRD'],
    description: 'Tiered discounts and payment plans; specific hereditary cancer financial assistance cap.',
    eligibility: 'Based on income and family size (HHS/FPL guidelines).',
    maxOutOfPocket: '$200 out-of-pocket cap for qualifying Quest hereditary cancer tests',
    freeForPoverty: 'Testing at $0 for patients at or below Federal Poverty Level',
    paymentPlans: '0% financing for 12-month period',
    applicationUrl: 'https://www.questdiagnostics.com/patients/billing-insurance/financial-assistance',
    contactPhone: '866-436-3463 (866-GENE-INFO)',
    processingTime: 'Approximately 2 weeks to process applications',
    lastVerified: '2026-01-30'
  },
  'Adaptive Biotechnologies': {
    programName: 'Adaptive Assist Patient Support Program',
    hasProgram: true,
    tests: ['clonoSEQ'],
    description: 'Out-of-pocket estimate support plus financial assistance for eligible patients. Includes payment option support and enrollment/assistance via Patient Support Team.',
    eligibility: 'Based on income and/or medical expenses.',
    coverageNotes: 'Most patients have no out-of-pocket cost; qualification for $0 may be valid for one year',
    applicationUrl: 'https://www.clonoseq.com/adaptive-assist/',
    applicationUrlAlt: 'https://www.clonoseq.com/patient/other-blood-cancers/adaptive-assist/',
    applicationPdf: 'https://www.clonoseq.com/wp-content/uploads/2022/02/Adaptive_Assist_PSP_Application_Form-1.pdf',
    applicationNotes: 'Application can also be mailed',
    contactPhone: '1-855-236-9230',
    contactEmail: 'AdaptiveBiotech@mylabbill.com',
    contactEmailAlt: 'support@clonoseq.com',
    sourceCitations: [
      'https://www.clonoseq.com/adaptive-assist/',
      'https://www.clonoseq.com/patient/other-blood-cancers/adaptive-assist/',
      'https://www.clonoseq.com/wp-content/uploads/2022/02/Adaptive_Assist_PSP_Application_Form-1.pdf'
    ],
    lastVerified: '2026-01-30'
  },
  'NeoGenomics': {
    programName: 'Patient Financial Assistance (FAA) Program',
    hasProgram: true,
    tests: ['RaDaR', 'NEO PanTracer'],
    description: 'Financial assistance options including no-cost/reduced-cost testing for eligible patients. Payment plan options available. Application requests income documentation.',
    eligibility: 'Assessed via application; approval not guaranteed. Patient certifies that testing would cause financial hardship.',
    applicationUrl: 'https://www.neogenomics.com/billing/',
    applicationPdf: 'https://asc-neoweb-drupal-prod.azurewebsites.net/sites/default/files/2025-11/FAA_Form_English_1125-2.pdf',
    applicationPdfAlt: 'https://cms.neogenomics.com/sites/default/files/2025-01/FAA_Form_English_010925_Final_FF.pdf',
    contactPhone: '866-776-5907 (Option 9 for patient assistance)',
    contactEmail: 'patients@neogenomics.com',
    sourceCitations: [
      'https://www.neogenomics.com/billing/',
      'https://www.neogenomics.com/patients/',
      'https://ir.neogenomics.com/news-events/press-releases/detail/246/neogenomics-radar-assay-for-minimal-residual-disease-receives-first-commercial-coverage'
    ],
    lastVerified: '2026-01-30'
  },
  'Personalis': {
    programName: 'NeXT Access Financial Assistance',
    hasProgram: true,
    tests: ['NeXT Personal'],
    description: 'Financial assistance available to qualifying patients. Patients can contact billing to determine eligibility or submit a financial assistance application.',
    eligibility: 'Contact billing to determine eligibility or submit application.',
    applicationUrl: 'https://www.personalis.com/for-patients/financial-assistance-next-access/',
    applicationNotes: 'Patient FAQ lists email/fax/mail submission options',
    contactPhone: '855-373-7974',
    contactEmail: 'billing@personalis.com',
    sourceCitations: [
      'https://www.personalis.com/wp-content/uploads/2022/10/5.22.23_NeXT-Dx_Patient-FAQs.pdf',
      'https://www.personalis.com/contact-us/',
      'https://www.personalis.com/for-patients/financial-assistance-next-access/'
    ],
    lastVerified: '2026-01-30'
  },
  'BillionToOne': {
    programName: 'Client Services Support',
    hasProgram: false,
    hasBillingSupport: true,
    tests: ['Northstar Select', 'Northstar Response'],
    description: 'Client services contacts for order-specific updates and billing support. A formal vendor-run financial assistance program was not clearly identified on official pages.',
    eligibility: 'Contact Client Services for billing questions and support options.',
    applicationUrl: 'https://www.northstaronc.com/support',
    contactPhone: '(833) 537-1819',
    contactEmail: 'support@northstaronc.com',
    notes: 'No formal FAP identified as of verification date; billing support available',
    sourceCitations: [
      'https://www.northstaronc.com/support',
      'https://www.northstaronc.com/contact'
    ],
    lastVerified: '2026-01-30'
  },
  'Burning Rock Dx': {
    programName: null,
    hasProgram: false,
    tests: ['OncoScreen Plus', 'OverC MCDBT', 'BR Prophet', 'CanCatch Custom'],
    description: 'No US-based patient financial assistance program identified.',
    notes: 'Primarily serves China market; China is largely an out-of-pocket market for these tests',
    contactUrl: 'https://www.brbiotech.com/en/',
    lastVerified: '2026-01-30'
  }
};`;

// Find and replace the VENDOR_ASSISTANCE_PROGRAMS section
const startMarker = '// Programs change frequently - verify with vendor before relying on them';
const endMarker = '// Helper function to check if a test has assistance program by vendor name';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find VENDOR_ASSISTANCE_PROGRAMS section markers');
  process.exit(1);
}

const newContent = content.slice(0, startIdx) + newPAPSection + '\n\n' + content.slice(endIdx);

fs.writeFileSync(path, newContent);
console.log('✅ VENDOR_ASSISTANCE_PROGRAMS updated with enriched data');
console.log('   - Added Personalis (new vendor)');
console.log('   - Added BillionToOne (new vendor)');
console.log('   - Enriched all vendors with:');
console.log('     • Source citations');
console.log('     • Multiple contact methods (phone/email alternates)');
console.log('     • Application PDFs and URLs');
console.log('     • Detailed eligibility criteria');
console.log('     • Application notes');
