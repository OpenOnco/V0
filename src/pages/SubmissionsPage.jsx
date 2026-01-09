import { useState, useEffect } from 'react';
import {
  getSiteConfig,
  DATABASE_CHANGELOG,
  mrdTestData,
  ecdTestData,
  cgpTestData,
  hctTestData
} from '../data';

// ALZ DISABLED placeholder
const ALZ_DATABASE_CHANGELOG = [];
const alzBloodTestData = [];

const SubmissionsPage = ({ prefill, onClearPrefill, vendorInvite, onClearVendorInvite }) => {
  const siteConfig = getSiteConfig();
  const isAlz = false; // ALZ DISABLED
  const domainChangelog = isAlz ? ALZ_DATABASE_CHANGELOG : DATABASE_CHANGELOG;
  
  const [submissionType, setSubmissionType] = useState(''); // 'new', 'correction', 'validation', 'bug', 'feature'
  const [submitterType, setSubmitterType] = useState(''); // 'vendor' or 'expert'
  const [category, setCategory] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  // New test fields
  const [newTestName, setNewTestName] = useState('');
  const [newTestVendor, setNewTestVendor] = useState('');
  const [newTestUrl, setNewTestUrl] = useState('');
  const [newTestNotes, setNewTestNotes] = useState('');
  
  // Correction fields
  const [existingTest, setExistingTest] = useState('');
  
  // Complete missing fields - multiple parameters with values
  const [completeFieldEntries, setCompleteFieldEntries] = useState([]);
  const [selectedParameter, setSelectedParameter] = useState('');
  const [newValue, setNewValue] = useState('');
  const [citation, setCitation] = useState('');
  
  // Vendor validation fields
  const [validationTest, setValidationTest] = useState('');
  const [validationEdits, setValidationEdits] = useState([]); // Array of {field, value, citation}
  const [validationField, setValidationField] = useState('');
  const [validationValue, setValidationValue] = useState('');
  const [validationCitation, setValidationCitation] = useState('');
  const [validationAttestation, setValidationAttestation] = useState(false);
  const [verifiedTestsSession, setVerifiedTestsSession] = useState([]); // Track tests verified in this session
  
  // Track if form was prefilled (from Competitions page navigation)
  const [isPrefilled, setIsPrefilled] = useState(false);
  
  // Track if this is an invited vendor (skip verification)
  const [isInvitedVendor, setIsInvitedVendor] = useState(false);
  
  // Handle vendor invite from app-level URL parsing
  useEffect(() => {
    if (vendorInvite && vendorInvite.email) {
      // Set up for vendor validation with pre-verified email
      setSubmissionType('validation');
      setSubmitterType('vendor');
      setContactEmail(vendorInvite.email);
      setVerificationStep('verified'); // Skip verification for invited vendors
      setIsInvitedVendor(true);
      
      // Parse name if provided (format: "First Last")
      if (vendorInvite.name) {
        const nameParts = vendorInvite.name.trim().split(' ');
        if (nameParts.length >= 1) {
          setFirstName(nameParts[0]);
        }
        if (nameParts.length >= 2) {
          setLastName(nameParts.slice(1).join(' '));
        }
      }
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      // Clear the invite after processing
      if (onClearVendorInvite) {
        onClearVendorInvite();
      }
    }
  }, [vendorInvite, onClearVendorInvite]);
  
  // ============================================
  // VENDOR INVITE FALLBACK - Direct URL Parsing
  // ============================================
  // Fallback handler for vendor invite URLs if vendorInvite prop wasn't provided.
  // This handles direct navigation to /submissions?invite=vendor&email=...
  //
  // URL format: /submissions?invite=vendor&email=person@company.com&name=John%20Doe
  //
  // Note: Primary handling is in main App component (line ~10737) which passes
  // vendorInvite prop. This is a fallback for edge cases.
  // ============================================
  useEffect(() => {
    // Only run if vendorInvite prop wasn't provided
    if (vendorInvite) return;
    
    const params = new URLSearchParams(window.location.search);
    const inviteType = params.get('invite');
    const inviteEmail = params.get('email');
    const inviteName = params.get('name');
    
    if (inviteType === 'vendor' && inviteEmail) {
      // Set up for vendor validation with pre-verified email
      setSubmissionType('validation');
      setSubmitterType('vendor');
      setContactEmail(inviteEmail);
      setVerificationStep('verified'); // Skip verification for invited vendors
      setIsInvitedVendor(true);
      
      // Parse name if provided (format: "First Last")
      if (inviteName) {
        const nameParts = inviteName.trim().split(' ');
        if (nameParts.length >= 1) {
          setFirstName(nameParts[0]);
        }
        if (nameParts.length >= 2) {
          setLastName(nameParts.slice(1).join(' '));
        }
      }
      
      // Clean up URL without reloading page
      window.history.replaceState({}, '', window.location.pathname);
      
      // Scroll to top
      window.scrollTo(0, 0);
    }
  }, [vendorInvite]);
  
  // Handle prefill from navigation (e.g., from Competitions page)
  useEffect(() => {
    if (prefill) {
      if (prefill.submissionType) {
        setSubmissionType(prefill.submissionType);
      }
      if (prefill.prefillCategory) {
        setCategory(prefill.prefillCategory);
      }
      if (prefill.prefillTest) {
        setExistingTest(prefill.prefillTest);
        setIsPrefilled(true); // Mark as prefilled to lock selections
      }
      // Scroll to top of page
      window.scrollTo(0, 0);
      // Clear prefill after applying
      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefill, onClearPrefill]);
  
  // Bug/Feature feedback fields
  const [feedbackDescription, setFeedbackDescription] = useState('');
  
  // Email verification states
  const [verificationStep, setVerificationStep] = useState('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Get existing tests for correction dropdown
  const existingTests = {
    MRD: mrdTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    ECD: ecdTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    CGP: cgpTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    HCT: hctTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    'ALZ-BLOOD': alzBloodTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
  };

  // Parameters available for correction by category
  const parameterOptions = {
    MRD: [
      { key: 'sensitivity', label: 'Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'analyticalSpecificity', label: 'Analytical Specificity (%)' },
      { key: 'clinicalSpecificity', label: 'Clinical Specificity (%)' },
      { key: 'lod', label: 'LOD (Detection Threshold)' },
      { key: 'lod95', label: 'LOD95 (95% Confidence)' },
      { key: 'variantsTracked', label: 'Variants Tracked' },
      { key: 'initialTat', label: 'Initial Turnaround Time (days)' },
      { key: 'followUpTat', label: 'Follow-up Turnaround Time (days)' },
      { key: 'bloodVolume', label: 'Blood Volume (mL)' },
      { key: 'cfdnaInput', label: 'cfDNA Input (ng)' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'cptCodes', label: 'CPT Codes' },
      { key: 'clinicalTrials', label: 'Clinical Trials' },
      { key: 'totalParticipants', label: 'Total Trial Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    ECD: [
      { key: 'sensitivity', label: 'Overall Sensitivity (%)' },
      { key: 'stageISensitivity', label: 'Stage I Sensitivity (%)' },
      { key: 'stageIISensitivity', label: 'Stage II Sensitivity (%)' },
      { key: 'stageIIISensitivity', label: 'Stage III Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'ppv', label: 'Positive Predictive Value (%)' },
      { key: 'npv', label: 'Negative Predictive Value (%)' },
      { key: 'tat', label: 'Turnaround Time (days)' },
      { key: 'listPrice', label: 'List Price ($)' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'screeningInterval', label: 'Screening Interval' },
      { key: 'clinicalTrials', label: 'Clinical Trials' },
      { key: 'totalParticipants', label: 'Total Trial Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    CGP: [
      { key: 'genesAnalyzed', label: 'Genes Analyzed' },
      { key: 'biomarkersReported', label: 'Biomarkers Reported' },
      { key: 'fdaCompanionDxCount', label: 'FDA CDx Indications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'sampleRequirements', label: 'Sample Requirements' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'listPrice', label: 'List Price ($)' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    HCT: [
      { key: 'genesAnalyzed', label: 'Genes Analyzed' },
      { key: 'sensitivity', label: 'Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'sampleRequirements', label: 'Sample Requirements' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'listPrice', label: 'List Price ($)' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    'ALZ-BLOOD': [
      { key: 'sensitivity', label: 'Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'concordanceWithPET', label: 'PET Concordance (%)' },
      { key: 'concordanceWithCSF', label: 'CSF Concordance (%)' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'sampleRequirements', label: 'Sample Requirements' },
      { key: 'fdaStatus', label: 'FDA/Regulatory Status' },
      { key: 'reimbursement', label: 'Reimbursement/Coverage' },
      { key: 'listPrice', label: 'List Price ($)' },
      { key: 'totalParticipants', label: 'Validation Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
  };

  // Get current value of selected parameter for the selected test
  const getCurrentValue = () => {
    if (!existingTest || !selectedParameter || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : category === 'CGP' ? cgpTestData : category === 'HCT' ? hctTestData : alzBloodTestData;
    const test = testList.find(t => t.id === existingTest);
    if (!test || selectedParameter === 'other') return '';
    const value = test[selectedParameter];
    return value !== null && value !== undefined ? String(value) : 'Not specified';
  };

  // Get vendor name for selected test (for email validation)
  const getSelectedTestVendor = () => {
    if (!existingTest || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : category === 'CGP' ? cgpTestData : hctTestData;
    const test = testList.find(t => t.id === existingTest);
    return test?.vendor || '';
  };

  // Validate email format
  const validateEmailFormat = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if email domain is free (Gmail, Yahoo, etc.)
  const isFreeEmail = (email) => {
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'live.com', 'msn.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return freeProviders.includes(domain);
  };

  // ============================================
  // EMAIL DOMAIN TO VENDOR NAME MATCHING
  // ============================================
  // EMAIL DOMAIN TO VENDOR NAME MATCHING
  // ============================================
  // Validates that an email domain matches a vendor name.
  // Used to ensure vendor submissions come from legitimate company emails.
  //
  // Matching Strategy:
  //   1. Extract domain from email: dan.norton@personalis.com → "personalis"
  //   2. Clean both domain and vendor name (remove non-alphanumeric, lowercase)
  //   3. Check if vendor name appears in domain OR domain appears in vendor name
  //
  // Examples:
  //   - personalis.com + "Personalis" → ✓ match
  //   - genomictestingcooperative.com + "Genomic Testing Cooperative (GTC)" → ✓ match
  //   - guardanthealth.com + "Guardant Health" → ✓ match
  //
  // This handles cases where:
  //   - Vendor name has extra text: "Genomic Testing Cooperative (GTC)"
  //   - Domain has subdomain: "dan.norton@personalis.com"
  //   - Different capitalization or punctuation
  // ============================================
  const emailMatchesVendor = (email, vendor) => {
    if (!email || !vendor) return false;
    // Get full domain after @ (e.g., "ryght.ai" or "ryghtinc.com")
    const fullDomain = email.split('@')[1]?.toLowerCase() || '';
    // Clean vendor name to just alphanumeric (e.g., "Ryght Inc." -> "ryghtinc")
    const vendorClean = vendor.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Clean domain to just alphanumeric for matching (e.g., "ryght.ai" -> "ryghtai")
    const domainClean = fullDomain.replace(/[^a-z0-9]/g, '');
    // Get domain without TLD for matching (e.g., "genomictestingcooperativecom" -> "genomictestingcooperative")
    const domainWithoutTld = fullDomain.split('.').slice(0, -1).join('').replace(/[^a-z0-9]/g, '');
    // Check if vendor name appears in domain OR domain appears in vendor name
    // This handles cases like "Genomic Testing Cooperative (GTC)" where vendor has extra text
    return domainClean.includes(vendorClean) || vendorClean.includes(domainWithoutTld);
  };

  // Validate email based on submitter type
  const validateEmail = () => {
    if (!validateEmailFormat(contactEmail)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    if (isFreeEmail(contactEmail)) {
      setEmailError('Please use a company/institutional email (not Gmail, Yahoo, etc.)');
      return false;
    }

    // Block vendor domain emails when claiming Independent Expert
    if (submitterType === 'expert' && (submissionType === 'new' || submissionType === 'correction')) {
      const emailDomain = contactEmail.split('@')[1]?.toLowerCase() || '';
      // Known vendor domains - comprehensive list
      const knownVendorDomains = [
        { domain: 'ryght.ai', vendor: 'Ryght AI' },
        { domain: 'illumina.com', vendor: 'Illumina' },
        { domain: 'guardanthealth.com', vendor: 'Guardant Health' },
        { domain: 'natera.com', vendor: 'Natera' },
        { domain: 'foundationmedicine.com', vendor: 'Foundation Medicine' },
        { domain: 'grail.com', vendor: 'Grail' },
        { domain: 'exact.com', vendor: 'Exact Sciences' },
        { domain: 'exactsciences.com', vendor: 'Exact Sciences' },
        { domain: 'tempus.com', vendor: 'Tempus' },
        { domain: 'personalis.com', vendor: 'Personalis' },
        { domain: 'neogenomics.com', vendor: 'NeoGenomics' },
        { domain: 'labcorp.com', vendor: 'Labcorp' },
        { domain: 'quest.com', vendor: 'Quest Diagnostics' },
        { domain: 'questdiagnostics.com', vendor: 'Quest Diagnostics' },
        { domain: 'adaptivebiotech.com', vendor: 'Adaptive Biotechnologies' },
        { domain: 'caris.com', vendor: 'Caris Life Sciences' },
        { domain: 'carislifesciences.com', vendor: 'Caris Life Sciences' },
        { domain: 'roche.com', vendor: 'Roche' },
        { domain: 'veracyte.com', vendor: 'Veracyte' },
        { domain: 'myriad.com', vendor: 'Myriad Genetics' },
        { domain: 'invitae.com', vendor: 'Invitae' },
        { domain: 'biofiredefense.com', vendor: 'BioFire' },
        { domain: 'biofiredx.com', vendor: 'BioFire' },
        { domain: 'freenome.com', vendor: 'Freenome' },
        { domain: 'c2i-genomics.com', vendor: 'C2i Genomics' },
        { domain: 'sagadiagnostics.com', vendor: 'SAGA Diagnostics' },
        { domain: 'billiontoone.com', vendor: 'BillionToOne' },
        { domain: 'sophiagenetics.com', vendor: 'SOPHiA GENETICS' },
        { domain: 'genomictestingcooperative.com', vendor: 'Genomic Testing Cooperative (GTC)' },
      ];
      
      const matchedVendor = knownVendorDomains.find(v => emailDomain === v.domain || emailDomain.endsWith('.' + v.domain));
      if (matchedVendor) {
        setEmailError(`Your email domain (${emailDomain}) appears to be from ${matchedVendor.vendor}. Please select "Test Vendor Representative" instead.`);
        return false;
      }
    }

    // Only check vendor email match for vendor submissions on test data
    if (submitterType === 'vendor' && (submissionType === 'new' || submissionType === 'correction')) {
      const vendor = submissionType === 'new' ? newTestVendor : getSelectedTestVendor();
      if (!emailMatchesVendor(contactEmail, vendor)) {
        setEmailError(`For vendor submissions, email domain must contain "${vendor || 'vendor name'}"`);
        return false;
      }
    }

    setEmailError('');
    return true;
  };

  // Send verification code
  const sendVerificationCode = async () => {
    if (!validateEmail()) return;

    setIsSendingCode(true);
    setVerificationError('');

    let vendor = 'OpenOnco';
    let testName = submissionType === 'bug' ? 'Bug Report' : submissionType === 'feature' ? 'Feature Request' : '';
    
    if (submissionType === 'new') {
      vendor = newTestVendor;
      testName = newTestName;
    } else if (submissionType === 'correction') {
      vendor = getSelectedTestVendor();
      testName = existingTests[category]?.find(t => t.id === existingTest)?.name;
    }

    try {
      const response = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contactEmail,
          vendor: vendor,
          testName: testName
        })
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationToken(data.token);
        setVerificationStep('verify');
      } else {
        setVerificationError(data.error || 'Failed to send verification code');
      }
    } catch (error) {
      setVerificationError('Network error. Please try again.');
    }

    setIsSendingCode(false);
  };

  // Verify the code
  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      setVerificationError('Please enter the 6-digit code');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationToken,
          code: verificationCode
        })
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationStep('verified');
      } else {
        setVerificationError(data.error || 'Verification failed');
      }
    } catch (error) {
      setVerificationError('Network error. Please try again.');
    }

    setIsVerifying(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (verificationStep !== 'verified') {
      setEmailError('Please verify your email first');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    let submission = {
      submissionType,
      submitter: {
        firstName,
        lastName,
        email: contactEmail,
      },
      emailVerified: true,
      timestamp: new Date().toISOString(),
    };

    if (submissionType === 'bug' || submissionType === 'feature') {
      submission.feedback = {
        type: submissionType === 'bug' ? 'Bug Report' : 'Feature Request',
        description: feedbackDescription,
      };
    } else if (submissionType === 'validation') {
      // Vendor Test Validation submission
      const testData = getValidationTestData();
      
      // Auto-capture any pending edit that wasn't explicitly added
      let allEdits = [...validationEdits];
      if (validationField && validationValue && validationCitation) {
        allEdits.push({
          field: validationField,
          value: validationValue,
          citation: validationCitation
        });
      }
      
      const categoryFullName = {
        'MRD': 'Minimal Residual Disease',
        'ECD': 'Early Cancer Detection',
        'CGP': 'Comprehensive Genomic Profiling',
        'HCT': 'Hereditary Cancer Testing'
      }[getValidationTestCategory()] || getValidationTestCategory();
      
      submission.submitterType = 'vendor';
      submission.category = getValidationTestCategory();
      
      // Email formatting helpers
      const testNameDisplay = testData?.name || `Test ID: ${validationTest}`;
      const vendorDisplay = testData?.vendor || 'Unknown Vendor';
      
      submission.emailSubject = `OpenOnco Vendor Validation: ${testNameDisplay} (${getValidationTestCategory()}) - ${isInvitedVendor ? 'Invited Vendor' : 'Vendor Representative'}`;
      submission.emailSummary = {
        header: `OpenOnco Vendor Validation Request: ${testNameDisplay} (${getValidationTestCategory()}) - ${isInvitedVendor ? 'Invited Vendor' : 'Vendor Representative'}`,
        verificationBadge: `✓ Email Verified: ${contactEmail}${isInvitedVendor ? ' (Invited)' : ''}`,
        details: [
          { label: 'Submitter Type', value: isInvitedVendor ? 'Vendor Representative (Invited)' : 'Vendor Representative' },
          { label: 'Category', value: `${getValidationTestCategory()} - ${categoryFullName}` },
          { label: 'Test Name', value: testNameDisplay },
          { label: 'Vendor', value: vendorDisplay },
          { label: 'Edits Submitted', value: allEdits.length > 0 ? `${allEdits.length} field(s)` : 'None (validation only)' },
          { label: 'Attestation', value: validationAttestation ? '✓ Confirmed' : '✗ Not confirmed' }
        ],
        editsFormatted: allEdits.map(e => `• ${e.field}: ${e.value} (Citation: ${e.citation})`).join('\n')
      };
      
      // Also add correction-compatible object for server email template compatibility
      submission.correction = {
        testId: validationTest,
        testName: testNameDisplay,
        vendor: vendorDisplay,
        parameter: allEdits.length > 0 ? 'Vendor Validation + Edits' : 'Vendor Validation (No Edits)',
        parameterLabel: allEdits.length > 0 ? `Vendor Validation with ${allEdits.length} edit(s)` : 'Vendor Validation Only',
        currentValue: 'See current test data',
        newValue: allEdits.length > 0 
          ? allEdits.map(e => `${e.field}: ${e.value}`).join('; ') 
          : 'Vendor attests all data is accurate',
        citation: allEdits.length > 0 
          ? allEdits.map(e => e.citation).join(', ')
          : 'Vendor attestation'
      };
      
      submission.validation = {
        testId: validationTest,
        testName: testNameDisplay,
        vendor: vendorDisplay,
        edits: allEdits,
        isInvitedVendor: isInvitedVendor,
        attestation: {
          confirmed: validationAttestation,
          submitterName: `${firstName} ${lastName}`,
          submitterEmail: contactEmail,
          timestamp: new Date().toISOString(),
        }
      };
    } else {
      submission.submitterType = submitterType;
      submission.category = category;
      
      if (submissionType === 'new') {
        submission.newTest = {
          name: newTestName,
          vendor: newTestVendor,
          performanceUrl: newTestUrl,
          additionalNotes: newTestNotes,
        };
      } else if (submissionType === 'correction') {
        submission.correction = {
          testId: existingTest,
          testName: existingTests[category]?.find(t => t.id === existingTest)?.name,
          vendor: getSelectedTestVendor(),
          parameter: selectedParameter,
          parameterLabel: parameterOptions[category]?.find(p => p.key === selectedParameter)?.label,
          currentValue: getCurrentValue(),
          newValue: newValue,
          citation: citation,
        };
      }
    }

    try {
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission })
      });

      const data = await response.json();

      if (response.ok) {
        // Track this test as verified in the session (for vendor validation)
        if (submissionType === 'validation' && validationTest) {
          setVerifiedTestsSession(prev => [...prev, validationTest]);
        }
        setSubmitted(true);
      } else {
        setSubmitError(data.error || 'Failed to submit. Please try again.');
      }
    } catch (error) {
      setSubmitError('Network error. Please try again.');
    }

    setIsSubmitting(false);
  };

  const resetForm = () => {
    setSubmissionType('');
    setSubmitterType('');
    setCategory('');
    setFirstName('');
    setLastName('');
    setContactEmail('');
    setEmailError('');
    setSubmitted(false);
    setNewTestName('');
    setNewTestVendor('');
    setNewTestUrl('');
    setNewTestNotes('');
    setExistingTest('');
    setSelectedParameter('');
    setNewValue('');
    setCitation('');
    setFeedbackDescription('');
    setVerificationStep('form');
    setVerificationCode('');
    setVerificationToken('');
    setVerificationError('');
    setIsSubmitting(false);
    setSubmitError('');
    // Validation fields
    setValidationTest('');
    setValidationEdits([]);
    setValidationField('');
    setValidationValue('');
    setValidationCitation('');
    setValidationAttestation(false);
    setVerifiedTestsSession([]); // Clear session tracking on full reset
  };

  // Reset just validation fields for verifying another test (keeps email verified)
  const resetValidationOnly = () => {
    setSubmitted(false);
    setValidationTest('');
    setValidationEdits([]);
    setValidationField('');
    setValidationValue('');
    setValidationCitation('');
    setValidationAttestation(false);
    setIsSubmitting(false);
    setSubmitError('');
  };

  // ============================================
  // VENDOR TEST FILTERING - Domain Matching
  // ============================================
  // Filters the test dropdown to show only tests from the vendor's company.
  // Uses email domain to match vendor names.
  //
  // Matching Logic:
  //   1. Extract domain from email: dan.norton@personalis.com → "personalis"
  //   2. Compare against vendor names (case-insensitive, alphanumeric only)
  //   3. Fuzzy match: checks if domain appears in vendor name OR vendor name in domain
  //
  // Examples:
  //   - personalis.com → matches "Personalis"
  //   - genomictestingcooperative.com → matches "Genomic Testing Cooperative (GTC)"
  //   - guardanthealth.com → matches "Guardant Health"
  //
  // This is used in the vendor validation flow to show only relevant tests.
  // ============================================
  // Get vendor domain from email for filtering tests
  const getVendorDomainFromEmail = (email) => {
    if (!email || !email.includes('@')) return '';
    const domain = email.split('@')[1]?.toLowerCase() || '';
    // Extract company name from domain (e.g., guardanthealth.com -> guardant)
    return domain.split('.')[0];
  };
  
  // Get tests that match the vendor's email domain
  const getVendorTests = (includeVerified = false) => {
    const domain = getVendorDomainFromEmail(contactEmail);
    if (!domain) return [];
    
    const allTests = [...mrdTestData, ...ecdTestData, ...cgpTestData, ...hctTestData];
    return allTests.filter(test => {
      const vendorLower = test.vendor.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchesVendor = vendorLower.includes(domain) || domain.includes(vendorLower.slice(0, 5));
      const notVerifiedYet = includeVerified || !verifiedTestsSession.includes(test.id);
      return matchesVendor && notVerifiedYet;
    }).map(t => ({
      id: t.id,
      name: t.name,
      vendor: t.vendor,
      category: mrdTestData.find(m => m.id === t.id) ? 'MRD' :
                ecdTestData.find(e => e.id === t.id) ? 'ECD' :
                cgpTestData.find(c => c.id === t.id) ? 'CGP' : 'HCT'
    }));
  };

  // Get the selected validation test data
  const getValidationTestData = () => {
    if (!validationTest) return null;
    const allTests = [...mrdTestData, ...ecdTestData, ...cgpTestData, ...hctTestData];
    return allTests.find(t => t.id === validationTest);
  };

  // Get category for validation test
  const getValidationTestCategory = () => {
    if (!validationTest) return null;
    if (mrdTestData.find(t => t.id === validationTest)) return 'MRD';
    if (ecdTestData.find(t => t.id === validationTest)) return 'ECD';
    if (cgpTestData.find(t => t.id === validationTest)) return 'CGP';
    if (hctTestData.find(t => t.id === validationTest)) return 'HCT';
    return null;
  };

  if (submitted) {
    // For vendor validation, show option to verify another test
    const remainingTests = submissionType === 'validation' ? getVendorTests() : [];
    const allVendorTests = submissionType === 'validation' ? getVendorTests(true) : [];
    const verifiedCount = verifiedTestsSession.length;
    
    if (submissionType === 'validation') {
      return (
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-200">
            <div className="flex items-center justify-center gap-3 mb-4">
              <svg className="w-16 h-16 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-emerald-800 mb-2">Test Verified!</h2>
            <p className="text-emerald-700 mb-4">
              Your validation has been submitted. The test will receive the <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white">VENDOR VERIFIED</span> badge after successful review.
            </p>
            
            {/* Progress indicator */}
            <div className="bg-white rounded-lg p-4 mb-6 border border-emerald-200">
              <div className="text-sm text-emerald-700 font-medium mb-2">Session Progress</div>
              <div className="text-2xl font-bold text-emerald-800">
                {verifiedCount} of {allVendorTests.length} tests verified
              </div>
              {verifiedCount > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                  {verifiedTestsSession.map(testId => {
                    const test = allVendorTests.find(t => t.id === testId);
                    return test ? (
                      <span key={testId} className="inline-flex items-center px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">
                        ✓ {test.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            
            {remainingTests.length > 0 ? (
              <>
                <p className="text-emerald-600 mb-4">
                  You have <strong>{remainingTests.length}</strong> more test{remainingTests.length > 1 ? 's' : ''} to verify. Would you like to continue?
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button 
                    onClick={resetValidationOnly} 
                    className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verify Another Test
                  </button>
                  <button 
                    onClick={resetForm} 
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Done for Now
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-emerald-100 rounded-lg p-4 mb-6 border border-emerald-300">
                  <div className="text-emerald-800 font-semibold text-lg mb-1">🎉 All Tests Verified!</div>
                  <p className="text-emerald-700 text-sm">
                    You've verified all {allVendorTests.length} test{allVendorTests.length > 1 ? 's' : ''} for your company. Thank you for your contribution!
                  </p>
                </div>
                <button 
                  onClick={resetForm} 
                  className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      );
    }
    
    // Default success screen for other submission types
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-200">
          <svg className="w-16 h-16 text-emerald-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">Request Submitted!</h2>
          <p className="text-emerald-700 mb-6">Your request has been submitted successfully. We'll review it and update our database soon. Thank you for contributing!</p>
          <button onClick={resetForm} className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  // Check if form is ready for email verification
  const isReadyForVerification = () => {
    if (!submissionType || !firstName || !lastName || !contactEmail) return false;
    
    if (submissionType === 'bug' || submissionType === 'feature') {
      return feedbackDescription.trim().length > 0;
    }
    
    if (submissionType === 'validation') {
      return validationTest && validationAttestation;
    }
    
    if (!submitterType || !category) return false;
    
    if (submissionType === 'new') {
      return newTestName && newTestVendor && newTestUrl;
    } else if (submissionType === 'correction') {
      return existingTest && selectedParameter && newValue && citation;
    }
    
    return false;
  };
  
  // Add a validation edit
  const addValidationEdit = () => {
    if (!validationField || !validationValue || !validationCitation) return;
    setValidationEdits([...validationEdits, {
      field: validationField,
      value: validationValue,
      citation: validationCitation
    }]);
    setValidationField('');
    setValidationValue('');
    setValidationCitation('');
  };
  
  // Remove a validation edit
  const removeValidationEdit = (index) => {
    setValidationEdits(validationEdits.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Submissions</h1>
      <p className="text-gray-600 mb-8">Help us improve {siteConfig.name} with your feedback and data contributions.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Test Data Update - hide when prefilled OR when validation selected */}
        {!isPrefilled && submissionType !== 'validation' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Test Data Update</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setSubmissionType('new'); setExistingTest(''); setSelectedParameter(''); setFeedbackDescription(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'new' ? 'border-[#2A63A4] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-800">Suggest a New Test</div>
              <div className="text-sm text-gray-500">Notify us of a test not in our database</div>
            </button>
            <button
              type="button"
              onClick={() => { setSubmissionType('correction'); setNewTestName(''); setNewTestVendor(''); setNewTestUrl(''); setFeedbackDescription(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'correction' ? 'border-[#2A63A4] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-800">File a Correction</div>
              <div className="text-sm text-gray-500">Update existing test data</div>
            </button>
          </div>
          
          <label className="block text-sm font-semibold text-gray-700 mt-6 mb-3">Bug Reports & Feature Requests</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setSubmissionType('bug'); setSubmitterType(''); setCategory(''); setNewTestName(''); setNewTestVendor(''); setExistingTest(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'bug' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`font-semibold ${submissionType === 'bug' ? 'text-red-700' : 'text-gray-800'}`}>Report a Bug</div>
              <div className="text-sm text-gray-500">Something isn't working correctly</div>
            </button>
            <button
              type="button"
              onClick={() => { setSubmissionType('feature'); setSubmitterType(''); setCategory(''); setNewTestName(''); setNewTestVendor(''); setExistingTest(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'feature' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`font-semibold ${submissionType === 'feature' ? 'text-purple-700' : 'text-gray-800'}`}>Request a Feature</div>
              <div className="text-sm text-gray-500">Suggest an improvement or new capability</div>
            </button>
          </div>
          </div>
        )}

        {/* Vendor Test Validation - Below other options */}
        {!isPrefilled && (
          <div className={`rounded-xl border-2 p-6 transition-all ${submissionType === 'validation' ? 'border-emerald-500 bg-gradient-to-r from-emerald-50 to-teal-50' : 'border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 hover:border-emerald-300'}`}>
            <button
              type="button"
              onClick={() => { 
                setSubmissionType('validation'); 
                setSubmitterType('vendor');
                setCategory('');
                setExistingTest(''); 
                setSelectedParameter(''); 
                setFeedbackDescription(''); 
                setCompleteFieldEntries([]);
                setNewTestName('');
                setNewTestVendor('');
                setValidationTest('');
                setValidationEdits([]);
                setValidationAttestation(false);
              }}
              className="w-full text-left"
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${submissionType === 'validation' ? 'bg-emerald-500' : 'bg-emerald-400'}`}>
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${submissionType === 'validation' ? 'text-emerald-800' : 'text-emerald-700'}`}>
                      Vendor Test Validation
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white border border-emerald-600">
                      VENDOR VERIFIED
                    </span>
                  </div>
                  <div className="text-sm text-emerald-600">Verify and update your company's test data to earn the VENDOR VERIFIED badge</div>
                </div>
                <svg className={`w-6 h-6 transition-transform ${submissionType === 'validation' ? 'text-emerald-600 rotate-90' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* Submitter Type - show for all data submissions including prefilled */}
        {(submissionType === 'new' || submissionType === 'correction') && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">I am submitting as a...</label>
            <select
              value={submitterType}
              onChange={(e) => { setSubmitterType(e.target.value); setEmailError(''); setVerificationStep('form'); }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
            >
              <option value="">-- Select --</option>
              <option value="vendor">Test Vendor Representative</option>
              <option value="expert">Independent Expert / Researcher</option>
            </select>
            {submitterType === 'vendor' && (
              <p className="text-sm text-amber-600 mt-2">⚠️ We will verify that your email comes from the vendor's domain</p>
            )}
            {submitterType === 'expert' && (
              <>
                <p className="text-sm text-amber-600 mt-2">⚠️ Vendor employees should select "Test Vendor Representative" above</p>
                <p className="text-sm text-gray-500 mt-1">Expert submissions require a company or institutional email</p>
              </>
            )}
          </div>
        )}

        {/* Category Selection - only for new/correction, not validation */}
        {submitterType && submissionType !== 'validation' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Test Category</label>
            <div className={`grid gap-3 ${isAlz ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {(isAlz ? [
                { key: 'ALZ-BLOOD', label: 'ALZ-BLOOD', desc: 'Blood Biomarkers', color: 'indigo' },
              ] : [
                { key: 'MRD', label: 'MRD', desc: 'Minimal Residual Disease', color: 'orange' },
                { key: 'ECD', label: 'ECD', desc: 'Early Cancer Detection', color: 'emerald' },
                { key: 'TDS', label: 'TDS', desc: 'Comprehensive Genomic Profiling', color: 'violet' },
                { key: 'HCT', label: 'HCT', desc: 'Hereditary Cancer Testing', color: 'sky' },
              ]).map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { setCategory(cat.key); setExistingTest(''); setSelectedParameter(''); setCompleteFieldEntries([]); }}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${category === cat.key ? `border-${cat.color}-500 bg-${cat.color}-50` : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className={`font-bold ${category === cat.key ? `text-${cat.color}-700` : 'text-gray-800'}`}>{cat.label}</div>
                  <div className="text-xs text-gray-500">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NEW TEST: Basic Info + URL */}
        {submissionType === 'new' && category && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">New Test Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Test Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  placeholder="e.g., Signatera, Galleri, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Vendor/Company <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newTestVendor}
                  onChange={(e) => { setNewTestVendor(e.target.value); setEmailError(''); setVerificationStep('form'); }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  placeholder="e.g., Natera, GRAIL, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">URL with Test Performance Data <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={newTestUrl}
                  onChange={(e) => setNewTestUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  placeholder="https://..."
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Link to publication, vendor page, or FDA approval with performance data</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Additional Notes</label>
                <textarea
                  value={newTestNotes}
                  onChange={(e) => setNewTestNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  rows={3}
                  placeholder="Any additional context about this test..."
                />
              </div>
            </div>
          </div>
        )}

        {/* CORRECTION: Select Test → Select Parameter → New Value */}
        {submissionType === 'correction' && category && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Correction Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Select Test <span className="text-red-500">*</span></label>
                <select
                  value={existingTest}
                  onChange={(e) => { setExistingTest(e.target.value); setSelectedParameter(''); setNewValue(''); setEmailError(''); setVerificationStep('form'); }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                >
                  <option value="">-- Select a test --</option>
                  {existingTests[category]?.map(test => (
                    <option key={test.id} value={test.id}>{test.name} ({test.vendor})</option>
                  ))}
                </select>
              </div>

              {existingTest && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Parameter to Correct <span className="text-red-500">*</span></label>
                  <select
                    value={selectedParameter}
                    onChange={(e) => { setSelectedParameter(e.target.value); setNewValue(''); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                    required
                  >
                    <option value="">-- Select parameter --</option>
                    {parameterOptions[category]?.map(param => (
                      <option key={param.key} value={param.key}>{param.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedParameter && (
                <>
                  {selectedParameter !== 'other' && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-sm text-gray-500">Current value: </span>
                      <span className="text-sm font-medium text-gray-800">{getCurrentValue()}</span>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {selectedParameter === 'other' ? 'Describe the correction' : 'New Value'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                      placeholder={selectedParameter === 'other' ? 'Describe the parameter and new value...' : 'Enter the correct value'}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Citation/Source URL <span className="text-red-500">*</span></label>
                    <input
                      type="url"
                      value={citation}
                      onChange={(e) => setCitation(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                      placeholder="https://..."
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">Link to publication or source supporting this value</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* VENDOR TEST VALIDATION FORM */}
        {submissionType === 'validation' && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">Vendor Test Validation</h3>
                <p className="text-sm text-emerald-600">Verify your company's test data and earn the VENDOR VERIFIED badge</p>
              </div>
            </div>

            {/* Special banner for invited vendors */}
            {isInvitedVendor && (
              <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-4 flex items-center gap-3 mb-4">
                <svg className="w-8 h-8 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
                <div>
                  <p className="font-semibold text-emerald-800">Welcome! You've been personally invited to validate your test data.</p>
                  <p className="text-sm text-emerald-700">Your email has been pre-verified. Just complete your name and select your test below.</p>
                </div>
              </div>
            )}

            {/* Step 1: Verify Email */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-full text-white text-sm font-bold flex items-center justify-center ${isInvitedVendor ? 'bg-emerald-400' : 'bg-emerald-500'}`}>
                  {isInvitedVendor ? '✓' : '1'}
                </span>
                <span className="font-semibold text-emerald-800">
                  {isInvitedVendor ? 'Your Information' : 'Verify Your Vendor Email'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Show locked email for invited vendors */}
              {isInvitedVendor && verificationStep === 'verified' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                  <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-emerald-800 font-medium">Email Pre-Verified</p>
                    <p className="text-emerald-700 text-sm">{contactEmail}</p>
                  </div>
                  <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded font-medium">INVITED</span>
                </div>
              )}

              {verificationStep === 'form' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Work Email <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => { setContactEmail(e.target.value); setEmailError(''); setValidationTest(''); }}
                        className={`flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="you@yourcompany.com"
                      />
                      <button
                        type="button"
                        onClick={sendVerificationCode}
                        disabled={isSendingCode || !contactEmail || !firstName || !lastName}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {isSendingCode ? 'Sending...' : 'Verify Email'}
                      </button>
                    </div>
                    {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                    {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
                    <p className="text-sm text-emerald-600 mt-2">⚠️ You must use your company email to verify your affiliation with the vendor</p>
                  </div>
                </>
              )}

              {verificationStep === 'verify' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800">
                      A verification code has been sent to <strong>{contactEmail}</strong>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center text-2xl tracking-widest"
                      placeholder="• • • • • •"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={verifyCode}
                      disabled={isVerifying || verificationCode.length !== 6}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                  {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
                  <button
                    type="button"
                    onClick={() => { setVerificationStep('form'); setVerificationCode(''); setVerificationError(''); }}
                    className="text-emerald-600 text-sm hover:underline"
                  >
                    ← Use a different email
                  </button>
                </>
              )}

              {verificationStep === 'verified' && !isInvitedVendor && (
                <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-4 flex items-center gap-3">
                  <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-emerald-800 font-medium">Email Verified!</p>
                    <p className="text-emerald-700 text-sm">{contactEmail}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select Test (only after email verified) */}
            {verificationStep === 'verified' && (
              <div className="mt-8 pt-6 border-t border-emerald-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">{isInvitedVendor ? '1' : '2'}</span>
                  <span className="font-semibold text-emerald-800">Select Your Test</span>
                </div>
                
                {getVendorTests().length > 0 ? (
                  <select
                    value={validationTest}
                    onChange={(e) => { setValidationTest(e.target.value); setValidationEdits([]); setValidationAttestation(false); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select one of your company's tests --</option>
                    {getVendorTests().map(test => (
                      <option key={test.id} value={test.id}>{test.name} ({test.category})</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                    <p className="font-medium">No tests found for your company</p>
                    <p className="text-sm mt-1">We couldn't find tests matching your email domain. Please use "Suggest a New Test" or contact us if you believe this is an error.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review & Edit Data (only after test selected) */}
            {validationTest && (
              <div className="mt-8 pt-6 border-t border-emerald-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">{isInvitedVendor ? '2' : '3'}</span>
                  <span className="font-semibold text-emerald-800">Review & Update Data (Optional)</span>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Review the current data below. You can add corrections or updates - each change requires a citation.
                </p>

                {/* Current Data Display */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 max-h-64 overflow-y-auto">
                  <h4 className="font-medium text-gray-800 mb-2">{getValidationTestData()?.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {getValidationTestCategory() && parameterOptions[getValidationTestCategory()]?.slice(0, -1).map(param => {
                      const testData = getValidationTestData();
                      const value = testData?.[param.key];
                      return (
                        <div key={param.key} className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-500">{param.label}:</span>
                          <span className="font-medium text-gray-800">{value || '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add Edit Form */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add a correction or update:</label>
                  <div className="grid grid-cols-1 gap-3">
                    <select
                      value={validationField}
                      onChange={(e) => setValidationField(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select field to update --</option>
                      {getValidationTestCategory() && parameterOptions[getValidationTestCategory()]?.map(param => (
                        <option key={param.key} value={param.key}>{param.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={validationValue}
                      onChange={(e) => setValidationValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="New value"
                    />
                    <input
                      type="url"
                      value={validationCitation}
                      onChange={(e) => setValidationCitation(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Citation URL (required)"
                    />
                    <button
                      type="button"
                      onClick={addValidationEdit}
                      disabled={!validationField || !validationValue || !validationCitation}
                      className="w-full bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      + Add Update
                    </button>
                  </div>
                </div>

                {/* Pending Edits */}
                {validationEdits.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pending updates ({validationEdits.length}):</label>
                    <div className="space-y-2">
                      {validationEdits.map((edit, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white rounded-lg border border-emerald-200 p-3">
                          <div className="flex-1">
                            <span className="font-medium text-gray-800">{parameterOptions[getValidationTestCategory()]?.find(p => p.key === edit.field)?.label || edit.field}</span>
                            <span className="text-gray-500 mx-2">→</span>
                            <span className="text-emerald-700">{edit.value}</span>
                            <p className="text-xs text-gray-400 truncate">{edit.citation}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeValidationEdit(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4: Attestation */}
                <div className="mt-8 pt-6 border-t border-emerald-200">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">{isInvitedVendor ? '3' : '4'}</span>
                    <span className="font-semibold text-emerald-800">Vendor Attestation</span>
                  </div>
                  
                  <label className="flex items-start gap-3 p-4 bg-white rounded-lg border-2 border-emerald-300 cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={validationAttestation}
                      onChange={(e) => setValidationAttestation(e.target.checked)}
                      className="mt-1 w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-gray-800">
                        I confirm on behalf of {getValidationTestData()?.vendor || 'this vendor'} that the information displayed above {validationEdits.length > 0 ? '(with my proposed updates) ' : ''}is accurate and complete to the best of my knowledge as of today's date.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Bug Report / Feature Request Form */}
        {(submissionType === 'bug' || submissionType === 'feature') && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className={`text-lg font-semibold mb-4 ${submissionType === 'bug' ? 'text-red-700' : 'text-purple-700'}`}>
              {submissionType === 'bug' ? 'Bug Report' : 'Feature Request'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {submissionType === 'bug' ? 'Describe the bug' : 'Describe your feature idea'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={feedbackDescription}
                onChange={(e) => setFeedbackDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                rows={6}
                placeholder={submissionType === 'bug' 
                  ? 'Please describe what happened, what you expected to happen, and steps to reproduce the issue...'
                  : 'Please describe the feature you would like to see and how it would help you...'}
                required
              />
            </div>
          </div>
        )}

        {/* Your Information - Bug/Feature */}
        {(submissionType === 'bug' || submissionType === 'feature') && feedbackDescription && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Information</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
            </div>

            {/* Email Verification for Bug/Feature */}
            {verificationStep === 'form' && (
              <>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); setEmailError(''); }}
                    className={`flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="you@company.com"
                  />
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={isSendingCode || !contactEmail || !firstName || !lastName}
                    className="bg-[#2A63A4] text-white px-4 py-2 rounded-lg hover:bg-[#1E4A7A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isSendingCode ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
                {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
                <p className="text-sm text-gray-500 mt-2">Company or institutional email required (not Gmail, Yahoo, etc.)</p>
              </>
            )}

            {verificationStep === 'verify' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800">
                    A verification code has been sent to <strong>{contactEmail}</strong>
                  </p>
                </div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Enter 6-digit code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] text-center text-2xl tracking-widest"
                    placeholder="• • • • • •"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {verificationError && <p className="text-red-500 text-sm mt-2">{verificationError}</p>}
                <button
                  type="button"
                  onClick={() => { setVerificationStep('form'); setVerificationCode(''); setVerificationError(''); setVerificationToken(''); }}
                  className="text-[#2A63A4] text-sm mt-2 hover:underline"
                >
                  ← Use a different email
                </button>
                <p className="text-gray-500 text-xs mt-3">
                  Code not arriving? Corporate firewalls sometimes block verification emails.{' '}
                  <a 
                    href="https://www.linkedin.com/in/alexgdickinson/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#2A63A4] hover:underline"
                  >
                    DM Alex on LinkedIn
                  </a>
                  {' '}to submit directly.
                </p>
              </>
            )}

            {verificationStep === 'verified' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-emerald-800 font-medium">Email Verified!</p>
                  <p className="text-emerald-700 text-sm">{contactEmail}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Your Information - Test Data */}
        {category && (
          submissionType === 'new' ? newTestName && newTestVendor : 
          submissionType === 'correction' ? existingTest && selectedParameter :
          false
        ) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Information</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
            </div>

            {/* Email Verification */}
            {verificationStep === 'form' && (
              <>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); setEmailError(''); }}
                    className={`flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder={submitterType === 'vendor' ? `you@${(submissionType === 'new' ? newTestVendor : getSelectedTestVendor()).toLowerCase().replace(/[^a-z]/g, '')}...` : 'you@company.com'}
                  />
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={isSendingCode || !contactEmail || !firstName || !lastName}
                    className="bg-[#2A63A4] text-white px-4 py-2 rounded-lg hover:bg-[#1E4A7A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isSendingCode ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
                {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
              </>
            )}

            {verificationStep === 'verify' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800">
                    A verification code has been sent to <strong>{contactEmail}</strong>
                  </p>
                </div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Enter 6-digit code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] text-center text-2xl tracking-widest"
                    placeholder="• • • • • •"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {verificationError && <p className="text-red-500 text-sm mt-2">{verificationError}</p>}
                <button
                  type="button"
                  onClick={() => { setVerificationStep('form'); setVerificationCode(''); setVerificationError(''); setVerificationToken(''); }}
                  className="text-[#2A63A4] text-sm mt-2 hover:underline"
                >
                  ← Use a different email
                </button>
                <p className="text-gray-500 text-xs mt-3">
                  Code not arriving? Corporate firewalls sometimes block verification emails.{' '}
                  <a 
                    href="https://www.linkedin.com/in/alexgdickinson/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#2A63A4] hover:underline"
                  >
                    DM Alex on LinkedIn
                  </a>
                  {' '}to submit directly.
                </p>
              </>
            )}

            {verificationStep === 'verified' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-emerald-800 font-medium">Email Verified!</p>
                  <p className="text-emerald-700 text-sm">{contactEmail}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        {isReadyForVerification() && (
          <>
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {submitError}
              </div>
            )}
            {submissionType === 'validation' ? (
              /* Special Big Submit Button for Vendor Validation */
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-white text-lg font-medium">
                    {validationEdits.length > 0 
                      ? `Submitting validation with ${validationEdits.length} update${validationEdits.length > 1 ? 's' : ''}`
                      : 'Confirming current data is accurate'}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={verificationStep !== 'verified' || isSubmitting || !validationAttestation}
                  className="w-full bg-white text-emerald-700 px-8 py-5 rounded-xl font-bold transition-all text-xl shadow-md hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Validation...
                    </>
                  ) : !validationAttestation ? (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Check the attestation box above
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submit Vendor Validation
                    </>
                  )}
                </button>
                <p className="text-center text-emerald-100 text-sm mt-3">
                  This test will receive the VENDOR VERIFIED badge after successful review
                </p>
              </div>
            ) : (
              /* Standard Submit Button */
              <button
                type="submit"
                disabled={verificationStep !== 'verified' || isSubmitting}
                className="w-full text-white px-8 py-4 rounded-xl font-semibold transition-all text-lg shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #2A63A4, #1E4A7A)' }}
              >
                {isSubmitting ? 'Submitting...' : verificationStep !== 'verified' ? 'Verify Email to Submit Request' : 'Submit Request'}
              </button>
            )}
          </>
        )}
      </form>

      {/* Database Changelog Section */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Database Changelog</h2>
        <p className="text-gray-600 mb-6">Recent updates to the {siteConfig.name} test database, including community contributions.</p>
        
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {domainChangelog.map((entry, idx) => (
              <div 
                key={`${entry.testId}-${idx}`} 
                className={`p-4 flex items-start gap-4 ${idx !== domainChangelog.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                {/* Entry number */}
                <div className="flex-shrink-0 w-8 text-right">
                  <span className="text-sm font-mono text-gray-400">#{domainChangelog.length - idx}</span>
                </div>
                
                {/* Type indicator */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  entry.type === 'added' ? 'bg-emerald-100 text-emerald-700' :
                  entry.type === 'updated' ? 'bg-blue-100 text-blue-700' :
                  entry.type === 'feature' ? 'bg-purple-100 text-purple-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {entry.type === 'added' ? '+' : entry.type === 'updated' ? '↑' : entry.type === 'feature' ? '★' : '−'}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{entry.testName}</span>
                    {entry.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      entry.category === 'MRD' ? 'bg-orange-100 text-orange-700' :
                      entry.category === 'ECD' ? 'bg-emerald-100 text-emerald-700' :
                      entry.category === 'CGP' ? 'bg-violet-100 text-violet-700' :
                      entry.category === 'HCT' ? 'bg-sky-100 text-sky-700' :
                      entry.category === 'ALZ-BLOOD' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-violet-100 text-violet-700'
                    }`}>
                      {entry.category}
                    </span>}
                    {entry.vendor && <span className="text-xs text-gray-400">{entry.vendor}</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{entry.date}</span>
                    <span>• {
                      !entry.affiliation || entry.affiliation === 'OpenOnco' || entry.affiliation === 'OpenAlz'
                        ? siteConfig.name :
                      !entry.vendor
                        ? (entry.contributor ? `${entry.contributor} (${entry.affiliation})` : entry.affiliation) :
                      entry.vendor.toLowerCase().includes(entry.affiliation.toLowerCase()) || 
                      entry.affiliation.toLowerCase().includes(entry.vendor.split(' ')[0].toLowerCase())
                        ? `Vendor update: ${entry.contributor ? entry.contributor + ' (' + entry.affiliation + ')' : entry.affiliation}`
                        : entry.contributor ? `${entry.contributor} (${entry.affiliation})` : entry.affiliation
                    }</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


export default SubmissionsPage;
