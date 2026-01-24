import React, { useState, useEffect } from 'react';
import {
  getTestUrl,
  comparisonParams,
  createCategoryMeta,
  BUILD_INFO,
} from '../../data';
import { useTestVerification, useTestContribution } from '../../dal';
import { TIER1_FIELDS, MINIMUM_PARAMS } from '../../config/testFields';
import { EXPERT_INSIGHTS } from '../../config/expertInsights';
import { calculateTestCompleteness } from '../../utils/testMetrics';
import { formatLOD, detectLodUnit, getLodUnitBadge } from '../../utils/formatting';
import * as analytics from '../../utils/analytics';
import VendorBadge, { getVendorBadges } from '../badges/VendorBadge';
import CompanyCommunicationBadge from '../badges/CompanyCommunicationBadge';
import Markdown from '../markdown/Markdown';
import ExternalResourcesSection, { ExternalResourceLink } from '../markdown/ExternalResourcesSection';
import { TestContext, ParameterLabel, InfoIcon, CitationTooltip, NoteTooltip, ExpertInsight, DataRow } from '../tooltips';
import GlossaryTooltip from '../GlossaryTooltip';
import PerformanceMetricWithWarning from '../ui/PerformanceMetricWithWarning';
import CircularProgress from '../ui/CircularProgress';
import QualityGrade from '../ui/QualityGrade';
import MedicareCoverageDisplay from '../coverage/MedicareCoverageDisplay';
import CoverageRealityCheck from '../coverage/CoverageRealityCheck';

// Create categoryMeta using imported function with BUILD_INFO sources
const categoryMeta = createCategoryMeta(BUILD_INFO.sources);

// ============================================
// Minimum Fields Section - Shows completion status for BC (Baseline Complete)
// ============================================
const MinimumFieldsSection = ({ test, category }) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!minParams?.core) return null;

  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';

  const fields = minParams.core.map(p => ({
    key: p.key,
    label: p.label,
    value: test[p.key],
    filled: hasValue(test[p.key])
  }));

  const filledCount = fields.filter(f => f.filled).length;
  const totalCount = fields.length;
  const isBC = filledCount === totalCount;

  const formatDisplayValue = (val) => {
    if (val == null || val === '') return '—';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'number') return val.toLocaleString();
    return String(val);
  };

  return (
    <div className={`mt-4 p-4 rounded-xl border-2 ${isBC ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">Minimum Fields</h3>
          {isBC ? (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">{filledCount}/{totalCount} Complete</span>
          ) : (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
              INCOMPLETE ({filledCount}/{totalCount})
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
          <div
            className={`h-full rounded-full transition-all ${isBC ? 'bg-emerald-500' : 'bg-red-400'}`}
            style={{ width: `${(filledCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {fields.map(field => (
          <div
            key={field.key}
            className={`p-2 rounded-lg border ${field.filled ? 'bg-white border-gray-200' : 'bg-red-100/50 border-red-300 border-dashed'}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {field.filled ? (
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`text-xs font-medium ${field.filled ? 'text-gray-700' : 'text-red-700'}`}>{field.label}</span>
            </div>
            <p className={`text-sm truncate ${field.filled ? 'text-gray-900' : 'text-red-600 italic'}`}>
              {field.filled ? formatDisplayValue(field.value) : 'Missing'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Test Detail Modal
// ============================================
const TestDetailModal = ({ test, category, onClose }) => {
  const [linkCopied, setLinkCopied] = useState(false);

  // DAL hooks for vendor verification and contributions
  const { isVerified, verification } = useTestVerification(test?.id);
  const { contribution } = useTestContribution(test?.id);

  // Track test view in PostHog when modal opens
  useEffect(() => {
    if (test) {
      analytics.trackTestView(test, 'modal', category);
    }
  }, [test?.id, category]);

  if (!test) return null;
  
  const meta = categoryMeta[category];
  
  // Calculate BC status
  const completeness = calculateTestCompleteness(test, category);
  const isBC = completeness.percentage === 100;
  
  // Copy shareable link to clipboard (SEO-friendly URL)
  const copyLink = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${getTestUrl(test, category)}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };
  
  // Print styles for test detail - fixed for multi-page printing
  const printStyles = `
    @media print {
      /* Hide everything except the print area */
      body * {
        visibility: hidden;
      }
      .test-detail-print-area,
      .test-detail-print-area * {
        visibility: visible;
      }
      
      /* Reset modal positioning for print */
      .test-detail-modal-root {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .test-detail-print-area { 
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
      }
      
      /* Allow content to flow across pages */
      .test-detail-print-area,
      .test-detail-print-area > div {
        max-height: none !important;
        overflow: visible !important;
        height: auto !important;
      }
      
      /* Hide interactive elements */
      .print\\:hidden { display: none !important; }
      
      @page { margin: 0.5in; }
    }
  `;
  
  // Category-specific color schemes
  const colorSchemes = {
    MRD: { 
      headerBg: 'bg-gradient-to-r from-orange-500 to-amber-500', 
      sectionBg: 'bg-orange-50',
      sectionBorder: 'border-orange-200',
      sectionTitle: 'text-orange-800'
    },
    ECD: { 
      headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500', 
      sectionBg: 'bg-emerald-50',
      sectionBorder: 'border-emerald-200',
      sectionTitle: 'text-emerald-800'
    },
    CGP: {
      headerBg: 'bg-gradient-to-r from-violet-500 to-purple-500',
      sectionBg: 'bg-violet-50',
      sectionBorder: 'border-violet-200',
      sectionTitle: 'text-violet-800'
    },
    HCT: {
      headerBg: 'bg-gradient-to-r from-sky-500 to-cyan-500',
      sectionBg: 'bg-sky-50',
      sectionBorder: 'border-sky-200',
      sectionTitle: 'text-sky-800'
    }
  };
  const colors = colorSchemes[category] || colorSchemes.MRD;
  
  // Helper for coverage status - use structured data if available, fall back to legacy string
  const hasMedicare = test.medicareCoverage?.status === 'COVERED' || 
    (test.reimbursement?.toLowerCase().includes('medicare') && 
    !test.reimbursement?.toLowerCase().includes('not yet') &&
    !test.reimbursement?.toLowerCase().includes('no established'));
  const hasPrivate = test.commercialPayers && test.commercialPayers.length > 0;
  const requiresTissue = test.approach === 'Tumor-informed' || test.requiresTumorTissue === 'Yes' || test.sampleCategory === 'Tissue';
  const isDiscontinued = test.isDiscontinued === true;
  const isRUO = test.isRUO === true;
  
  // Section component for consistent styling
  const Section = ({ title, children, expertTopic }) => (
    <div className={`rounded-xl border ${colors.sectionBorder} overflow-hidden`}>
      <div className={`${colors.sectionBg} px-4 py-2 border-b ${colors.sectionBorder} flex items-center gap-2`}>
        <h3 className={`font-semibold text-sm uppercase tracking-wide ${colors.sectionTitle} leading-none`}>{title}</h3>
        {expertTopic && <ExpertInsight topic={expertTopic} />}
      </div>
      <div className="bg-white p-4">
        {children}
      </div>
    </div>
  );
  
  // Patient-friendly yes/no indicator
  const YesNo = ({ yes, label }) => (
    <div className="flex items-center gap-2 py-1">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
        yes ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
      }`}>
        {yes ? '✓' : '✗'}
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );

  return (
    <TestContext.Provider value={test}>
      <style>{printStyles}</style>
      <div className="test-detail-modal-root fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white" data-testid="test-detail-modal" onClick={onClose}>
        <div className="test-detail-print-area bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          {/* Discontinued Banner */}
          {isDiscontinued && (
            <div className="bg-red-600 text-white px-5 py-3 flex items-center gap-3" style={{ flexShrink: 0 }}>
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold">THIS TEST HAS BEEN DISCONTINUED</p>
                <p className="text-sm text-red-100">{test.discontinuedReason || 'This product is no longer commercially available.'}</p>
              </div>
            </div>
          )}
          {/* RUO (Research Use Only) Banner */}
          {isRUO && !isDiscontinued && (
            <div className="bg-amber-500 text-white px-5 py-3 flex items-center gap-3" style={{ flexShrink: 0 }}>
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <div>
                <p className="font-bold">RESEARCH ONLY — NOT YET AVAILABLE FOR CLINICAL USE</p>
                <p className="text-sm text-amber-100">This test is not yet available for clinical ordering. {test.fdaStatusNotes || 'Clinical availability expected in the future.'}</p>
              </div>
            </div>
          )}
          {/* Header */}
          <div className={`flex justify-between items-start p-5 ${colors.headerBg}`} style={{ flexShrink: 0 }}>
            <div className="flex-1 mr-4">
              <div className="flex flex-wrap gap-2 mb-2">
                {/* VENDOR VERIFIED badge - green, pulsing */}
                {isVerified && verification && (
                  <div className="relative group flex items-center">
                    <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-xs font-bold cursor-help animate-pulse shadow-sm">
                      ✓ VERIFIED
                    </span>
                    <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Verified</p>
                      <p className="font-medium">{verification.verifierName}</p>
                      <p className="text-gray-300">{verification.vendorName}</p>
                      <p className="text-gray-400 text-[9px]">{verification.verifiedDate}</p>
                    </div>
                  </div>
                )}
                {/* VENDOR DATA badge - orange (only if not verified) */}
                {contribution && !isVerified && (
                  <div className="relative group flex items-center">
                    <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-medium cursor-help">
                      VENDOR
                    </span>
                    <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <p className="text-orange-400 font-bold text-[11px] mb-1">Vendor Data</p>
                      <p className="font-medium">{contribution.name}</p>
                      <p className="text-gray-300">{contribution.vendorName}</p>
                      <p className="text-gray-400 text-[9px]">{contribution.date}</p>
                    </div>
                  </div>
                )}
                {hasMedicare && hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Medicare+Private</span>}
                {hasMedicare && !hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Medicare</span>}
                {!hasMedicare && hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Private Insurance</span>}
                {test.fdaStatus && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">{test.fdaStatus.split(' - ')[0]}</span>}
                {test.approach && (
                  <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">
                    {test.approach === 'Tumor-informed' ? (
                      <GlossaryTooltip termKey="tumor-informed">{test.approach}</GlossaryTooltip>
                    ) : test.approach === 'Tumor-naïve' || test.approach === 'Tumor-naive' ? (
                      <GlossaryTooltip termKey="tumor-naive">{test.approach}</GlossaryTooltip>
                    ) : test.approach}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white">{test.name}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-white/80">{test.vendor} • OpenOnco.org</p>
                {!isBC && (
                  <span className="px-3 py-1 bg-red-500/80 text-white text-sm font-bold rounded">
                    INCOMPLETE
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={copyLink} 
                className="p-2 hover:bg-white/20 rounded-xl transition-colors print:hidden relative"
                title="Copy link to this test"
                data-testid="share-link-button"
              >
                {linkCopied ? (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); window.print(); }} 
                className="p-2 hover:bg-white/20 rounded-xl transition-colors print:hidden"
                title="Print or save as PDF"
                data-testid="print-button"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors print:hidden">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 space-y-4" style={{ flex: 1 }}>
          
          {/* Patient View */}
          {false ? (
            <>
              {/* Quick Facts for Patients */}
              <Section title="Quick Facts">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <YesNo yes={hasMedicare} label="Medicare coverage (age 65+)" />
                    <YesNo yes={hasPrivate} label="Private insurance options" />
                    <YesNo yes={!requiresTissue} label="Blood draw only (no surgery needed)" />
                    {category === 'CGP' && test.fdaCompanionDxCount && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">✓</span>
                        <span className="text-sm text-gray-700">FDA-approved for {test.fdaCompanionDxCount} drug matches</span>
                      </div>
                    )}
                  </div>
                  <div>
                    {category !== 'CGP' && (test.initialTat || test.tat) && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {test.initialTat || test.tat}
                        </span>
                        <span className="text-sm text-gray-700">days for results</span>
                      </div>
                    )}
                    {category === 'CGP' && test.tat && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">⏱</span>
                        <span className="text-sm text-gray-700">Results in {test.tat}</span>
                      </div>
                    )}
                    {category === 'CGP' && test.genesAnalyzed && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">🧬</span>
                        <span className="text-sm text-gray-700">Tests {test.genesAnalyzed} genes</span>
                      </div>
                    )}
                    {test.cancerTypes && (
                      <p className="text-sm text-gray-600 py-1">
                        Tests for: {test.cancerTypes.slice(0, 3).join(', ')}{test.cancerTypes.length > 3 ? ` +${test.cancerTypes.length - 3} more` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
              
              {/* What This Test Does */}
              <Section title="What This Test Does">
                <p className="text-gray-700">
                  {category === 'MRD' && "This test looks for tiny amounts of cancer DNA in your blood after treatment. It can help your doctor know if treatment worked and watch for cancer coming back earlier than traditional scans."}
                  {category === 'ECD' && "This test screens your blood for signs of cancer before you have symptoms. Finding cancer early often means better treatment options and outcomes."}
                  {category === 'HCT' && "This test tracks whether your cancer treatment is working by measuring cancer DNA in your blood over time, potentially detecting changes before imaging can."}
                  {category === 'CGP' && "This test analyzes hundreds of genes in your tumor to find specific mutations that can be targeted with specialized treatments. It helps your doctor match you with the most effective therapies and clinical trials for your cancer."}
                </p>
              </Section>
              
              {/* How It Works */}
              <Section title="How It Works">
                <p className="text-gray-700">
                  {category === 'CGP' 
                    ? (test.sampleCategory === 'Tissue' 
                        ? "Your doctor will send a sample of your tumor (from surgery or biopsy) to the lab. The test analyzes hundreds of genes to find specific mutations that can be matched to targeted treatments."
                        : "A simple blood draw is used to capture tumor DNA circulating in your bloodstream. The test analyzes this DNA to identify mutations that can guide treatment decisions.")
                    : (requiresTissue 
                        ? "Your doctor will need a sample of your tumor (from surgery or biopsy) plus a blood draw. The test creates a personalized profile based on your specific cancer's DNA mutations."
                        : "Just a simple blood draw at your doctor's office or lab - no tumor sample needed. The test looks for general cancer signals in your blood.")}
                </p>
                {test.bloodVolume && <p className="text-sm text-gray-500 mt-2">Blood sample: {test.bloodVolume} mL (about {Math.round(test.bloodVolume / 5)} teaspoons)</p>}
                {category === 'CGP' && test.tat && <p className="text-sm text-gray-500 mt-2">Results typically available in: {test.tat}</p>}
              </Section>
              
              {/* Insurance & Cost */}
              <Section title="Insurance & Cost">
                <div className="space-y-2">
                  {test.reimbursement && <p className="text-sm"><span className="font-medium">Medicare:</span> {test.reimbursement}</p>}
                  {hasPrivate && (
                    <p className="text-sm"><span className="font-medium">Private insurers:</span> {test.commercialPayers.join(', ')}</p>
                  )}
                  {test.commercialPayersNotes && <p className="text-xs text-gray-500 mt-1">{test.commercialPayersNotes}</p>}
                  {(category === 'ECD' || category === 'CGP') && (test.listPrice ? (
                    <p className="text-sm mt-2"><span className="font-medium">List price (without insurance):</span> ${test.listPrice.toLocaleString()}</p>
                  ) : test.medicareRate && (
                    <p className="text-sm mt-2"><span className="font-medium">Estimated price:</span> ~${test.medicareRate.toLocaleString()} <span className="text-xs text-gray-500">(Medicare rate - actual price may vary)</span></p>
                  ))}
                </div>
              </Section>
              
              {/* Questions for Your Doctor */}
              <Section title="Questions to Ask Your Doctor">
                <ul className="space-y-1 text-gray-700">
                  <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Is this test right for my type and stage of cancer?</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Will my insurance cover this test?</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500">•</span> How will the results change my treatment plan?</li>
                  {category === 'MRD' && <li className="flex items-start gap-2"><span className="text-blue-500">•</span> How often should I be retested?</li>}
                  {category === 'ECD' && <li className="flex items-start gap-2"><span className="text-blue-500">•</span> What happens if the test finds something?</li>}
                  {category === 'CGP' && <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Are there targeted therapies or clinical trials that match my results?</li>}
                </ul>
              </Section>
            </>
          ) : (
            /* Clinician/Academic View */
            <>
              {/* TDS-specific content */}
              {category === 'CGP' && (
                <>
                  {/* Genomic Coverage */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title="Genomic Coverage">
                      <div className="space-y-1">
                        <DataRow label="Genes Analyzed" value={test.genesAnalyzed} citations={test.genesAnalyzedCitations} notes={test.genesAnalyzedNotes} />
                        {test.geneListUrl && (
                          <div className="py-1.5 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Gene List</span>
                            <a 
                              href={test.geneListUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-sm font-medium hover:underline" 
                              style={{ color: '#2A63A4' }}
                            >View Full List →</a>
                          </div>
                        )}
                        <DataRow label="Biomarkers" value={test.biomarkersReported?.join(', ')} citations={test.biomarkersReportedCitations} />
                        <DataRow label="Method" value={test.method} citations={test.methodCitations} />
                      </div>
                    </Section>
                    
                    <Section title="Sample & Turnaround">
                      <div className="space-y-1">
                        <DataRow label="Sample Type" value={test.sampleCategory} />
                        <DataRow label="Sample Requirements" value={test.sampleRequirements} citations={test.sampleRequirementsCitations} notes={test.sampleRequirementsNotes} />
                        <DataRow label="Turnaround Time" value={test.tat} citations={test.tatCitations} notes={test.tatNotes} />
                      </div>
                    </Section>
                  </div>

                  {/* FDA CDx & Guidelines */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title={<><GlossaryTooltip termKey="companion-dx">FDA Companion Diagnostics</GlossaryTooltip></>}>
                      <div className="space-y-1">
                        {test.fdaCompanionDxCount && (
                          <div className="py-1.5 flex justify-between items-center">
                            <span className="text-xs text-gray-500">FDA CDx Indications</span>
                            <span className="text-lg font-bold text-emerald-600">{test.fdaCompanionDxCount}</span>
                          </div>
                        )}
                        {test.fdaCompanionDxCountNotes && <p className="text-xs text-gray-500 mt-1">{test.fdaCompanionDxCountNotes}</p>}
                        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4">
                          <span className="text-xs text-gray-500"><GlossaryTooltip termKey="fda-approved">FDA Status</GlossaryTooltip></span>
                          <span className="text-sm font-medium text-gray-900">{test.fdaStatus || '—'}</span>
                        </div>
                        {test.fdaApprovalDate && <DataRow label="FDA Approval Date" value={test.fdaApprovalDate} citations={test.fdaApprovalDateCitations} />}
                      </div>
                    </Section>
                    
                    <Section title="Guidelines & Coverage">
                      <div className="space-y-1">
                        {/* NCCN Status - New Schema */}
                        {test.nccnNamedInGuidelines ? (
                          <>
                            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <GlossaryTooltip termKey="nccn">NCCN</GlossaryTooltip> Named in Guidelines
                              </span>
                              <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                Yes
                              </span>
                            </div>
                            {test.nccnGuidelineReference && <DataRow label="Guideline Reference" value={test.nccnGuidelineReference} notes={test.nccnGuidelinesNotes} />}
                          </>
                        ) : test.vendorClaimsNCCNAlignment ? (
                          <>
                            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                Vendor Claims <GlossaryTooltip termKey="nccn">NCCN</GlossaryTooltip> Alignment
                              </span>
                              <span className="text-sm font-medium text-amber-600">Biomarker Coverage</span>
                            </div>
                            {test.vendorNCCNAlignmentIndications && test.vendorNCCNAlignmentIndications.length > 0 && (
                              <DataRow label="Indications Claimed" value={test.vendorNCCNAlignmentIndications.join(', ')} notes={test.vendorNCCNAlignmentNotes} citations={test.vendorNCCNAlignmentCitation} />
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <GlossaryTooltip termKey="nccn">NCCN</GlossaryTooltip> Status
                            </span>
                            <span className="text-sm font-medium text-gray-400">Not specified</span>
                          </div>
                        )}
                        <MedicareCoverageDisplay 
                          medicareCoverage={test.medicareCoverage}
                          fallbackReimbursement={test.reimbursement}
                          fallbackNote={test.reimbursementNote}
                        />
                        {!test.medicareCoverage?.reimbursementRate && test.medicareRate && (
                          <div className="py-1.5 flex justify-between items-center">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              Medicare CLFS Rate
                              {test.adltStatus && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium" title="Advanced Diagnostic Laboratory Test - receives annual rate updates based on weighted median of private payer rates">ADLT</span>}
                            </span>
                            <span className="text-sm font-semibold text-emerald-600">${test.medicareRate.toLocaleString()}</span>
                          </div>
                        )}
                        {test.listPrice ? (
                          <DataRow label="List Price" value={`$${test.listPrice.toLocaleString()}`} citations={test.listPriceCitations} />
                        ) : test.medicareRate && !test.listPrice && (
                          <DataRow label="List Price (est.)" value={`~$${test.medicareRate.toLocaleString()}`} notes="Medicare rate shown - actual list price may vary" citations="https://www.cms.gov/medicare/payment/fee-schedules/clinical-laboratory" />
                        )}
                        <DataRow label={test.codeType === 'PLA' ? 'PLA Code' : 'CPT Codes'} value={test.cptCodes} citations={test.cptCodesCitations} notes={test.codeType === 'PLA' ? 'Proprietary Laboratory Analyses - specific to this laboratory' : null} />
                      </div>
                    </Section>
                  </div>

                  {/* Clinical Evidence */}
                  <Section title="Clinical Evidence">
                    <div className="space-y-1">
                      <DataRow label="Target Population" value={test.targetPopulation} citations={test.targetPopulationCitations} />
                      <DataRow label="Cancer Types" value={test.cancerTypes?.join(', ')} citations={test.cancerTypesCitations} />
                      <DataRow label="Clinical Availability" value={test.clinicalAvailability} citations={test.clinicalAvailabilityCitations} notes={test.clinicalAvailabilityNotes} />
                      {test.numPublications && (
                        <div className="py-1.5 flex justify-between items-center">
                          <span className="text-xs text-gray-500">Publications</span>
                          <span className="text-sm font-semibold text-purple-600">{test.numPublications}{test.numPublicationsPlus ? '+' : ''}</span>
                        </div>
                      )}
                    </div>
                  </Section>
                </>
              )}

              {/* Non-TDS content (MRD, ECD, TRM) */}
              {category !== 'CGP' && (
                <>
              {/* Two-column layout for key metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Performance Metrics */}
                <Section title={<>Test Performance <span className="font-normal text-xs opacity-70">(click terms for definitions)</span></>} expertTopic="sensitivity">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                      <span className="text-xs text-gray-500"><ParameterLabel label="Reported Sensitivity" useGroupHover={true} /></span>
                      <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                        {test.sensitivity ? (
                          <>
                            <span className={(test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : ''}>
                              {test.sensitivity}%
                            </span>
                            {test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                              <span className="ml-1" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'}) - ${test.validationCohortStudy || 'interpret with caution'}` : 'Analytical validation only - clinical performance may differ'}>
                                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </span>
                            )}
                          </>
                        ) : '—'}
                        {test.sensitivity && <CitationTooltip citations={test.sensitivityCitations} />}
                        {test.sensitivity && <NoteTooltip notes={test.sensitivityNotes} value={test.sensitivity} />}
                      </span>
                    </div>
                    {test.advancedAdenomaSensitivity && <DataRow label="Advanced Adenoma Sensitivity" value={test.advancedAdenomaSensitivity} unit="%" citations={test.advancedAdenomaSensitivityCitations} notes={test.advancedAdenomaSensitivityNotes} />}
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                      <span className="text-xs text-gray-500"><ParameterLabel label="Reported Specificity" useGroupHover={true} /></span>
                      <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                        {test.specificity ? (
                          <>
                            <span className={(test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : ''}>
                              {test.specificity}%
                            </span>
                            {test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                              <span className="ml-1" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'}) - ${test.validationCohortStudy || 'interpret with caution'}` : 'Analytical validation only - clinical performance may differ'}>
                                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </span>
                            )}
                          </>
                        ) : '—'}
                        {test.specificity && <CitationTooltip citations={test.specificityCitations} />}
                        {test.specificity && <NoteTooltip notes={test.specificityNotes} value={test.specificity} />}
                      </span>
                    </div>
                    {test.analyticalSpecificity && <DataRow label="Analytical Specificity" value={test.analyticalSpecificity} unit="%" citations={test.analyticalSpecificityCitations} />}
                    {test.clinicalSpecificity && <DataRow label="Clinical Specificity" value={test.clinicalSpecificity} unit="%" citations={test.clinicalSpecificityCitations} />}
                    <DataRow label="PPV" value={test.ppv} unit="%" citations={test.ppvCitations} notes={test.ppvNotes} />
                    <DataRow label="NPV" value={test.npv} unit="%" citations={test.npvCitations} notes={test.npvNotes} />
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                      <span className="text-xs text-gray-500"><ParameterLabel label="LOD (Limit of Detection)" useGroupHover={true} /></span>
                      <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                        {test.lod ? formatLOD(test.lod) : '—'}
                        {test.lod && <CitationTooltip citations={test.lodCitations} />}
                        {test.lod && <NoteTooltip notes={test.lodNotes} value={test.lod} />}
                      </span>
                    </div>
                    {test.lod95 && (
                      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                        <span className="text-xs text-gray-500"><ParameterLabel label="LOD95 (95% Confidence)" useGroupHover={true} /></span>
                        <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                          {test.lod95}
                          <CitationTooltip citations={test.lod95Citations} />
                          <NoteTooltip notes={test.lod95Notes} value={test.lod95} />
                        </span>
                      </div>
                    )}
                    {/* Validation Cohort Warning */}
                    {(test.smallSampleWarning || test.analyticalValidationWarning) && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="text-xs">
                            <p className="font-semibold text-amber-800">
                              {test.analyticalValidationWarning ? 'Analytical Validation Only' : 'Small Validation Cohort'}
                            </p>
                            <p className="text-amber-700 mt-0.5">
                              {test.analyticalValidationWarning 
                                ? 'Performance metrics from analytical validation (e.g., dilution series). Clinical performance may differ.' 
                                : `Validation cohort${test.validationCohortSize ? ` n=${test.validationCohortSize}` : ''} is smaller than typical. Interpret 100% values with caution.`}
                            </p>
                            {test.validationCohortStudy && (
                              <p className="text-amber-600 mt-1">
                                <span className="font-medium">Study:</span> {test.validationCohortStudy}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
                
                {/* Sample & TAT */}
                <Section title="Sample & Turnaround">
                  <div className="space-y-1">
                    <DataRow label="Sample Type" value={test.sampleCategory} />
                    {/* New sample fields with fallback to legacy bloodVolume */}
                    <DataRow 
                      label="Sample Volume" 
                      value={test.sampleVolumeMl || test.bloodVolume} 
                      unit=" mL" 
                      citations={test.sampleCitations || test.bloodVolumeCitations} 
                      notes={test.bloodVolumeNotes} 
                    />
                    {test.sampleTubeType && (
                      <DataRow label="Collection Tube" value={test.sampleTubeType} />
                    )}
                    {test.sampleTubeCount && (
                      <DataRow label="Tubes Required" value={test.sampleTubeCount} />
                    )}
                    {test.cfdnaInput && <DataRow label="cfDNA Input" value={test.cfdnaInput} unit=" ng" citations={test.cfdnaInputCitations} />}
                    {category === 'MRD' && (
                      <>
                        <DataRow label="Initial TAT" value={test.initialTat} unit=" days" citations={test.initialTatCitations} notes={test.initialTatNotes} />
                        <DataRow label="Follow-up TAT" value={test.followUpTat} unit=" days" citations={test.followUpTatCitations} notes={test.followUpTatNotes} />
                      </>
                    )}
                    {category !== 'MRD' && <DataRow label="TAT" value={test.tat} citations={test.tatCitations} notes={test.tatNotes} />}
                    {test.leadTimeVsImaging && <DataRow label="Early Warning vs Imaging" value={test.leadTimeVsImaging} unit=" days" citations={test.leadTimeVsImagingCitations} notes={test.leadTimeVsImagingNotes} />}
                    {test.variantsTracked && <DataRow label="Variants Tracked" value={test.variantsTracked} citations={test.variantsTrackedCitations} notes={test.variantsTrackedNotes} />}
                  </div>
                </Section>
              </div>
              
              {/* Stage-Specific Performance (if available) */}
              {(test.stageISensitivity || test.stageIISensitivity || test.stageIIISensitivity || test.stageIVSensitivity || 
                test.landmarkSensitivity || test.longitudinalSensitivity) && (
                <Section title="Stage & Timepoint Performance" expertTopic="stageSpecific">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {test.stageISensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageISensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage I</p>
                      </div>
                    )}
                    {test.stageIISensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageIISensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage II</p>
                      </div>
                    )}
                    {test.stageIIISensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageIIISensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage III</p>
                      </div>
                    )}
                    {test.stageIVSensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageIVSensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage IV</p>
                      </div>
                    )}
                  </div>
                  {(test.landmarkSensitivity || test.longitudinalSensitivity) && (
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
                      {test.landmarkSensitivity && <DataRow label="Landmark Sensitivity" value={test.landmarkSensitivity} unit="%" citations={test.landmarkSensitivityCitations} />}
                      {test.landmarkSpecificity && <DataRow label="Landmark Specificity" value={test.landmarkSpecificity} unit="%" citations={test.landmarkSpecificityCitations} />}
                      {test.longitudinalSensitivity && <DataRow label="Longitudinal Sensitivity" value={test.longitudinalSensitivity} unit="%" citations={test.longitudinalSensitivityCitations} />}
                      {test.longitudinalSpecificity && <DataRow label="Longitudinal Specificity" value={test.longitudinalSpecificity} unit="%" citations={test.longitudinalSpecificityCitations} />}
                    </div>
                  )}
                </Section>
              )}
              
              {/* Two-column layout for regulatory/evidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Regulatory & Coverage */}
                <Section title="Regulatory & Coverage">
                  <div className="space-y-1">
                    <DataRow label="FDA Status" value={test.fdaStatus} citations={test.fdaStatusCitations} notes={test.fdaStatusNotes} />
                    <MedicareCoverageDisplay 
                      medicareCoverage={test.medicareCoverage}
                      fallbackReimbursement={test.reimbursement}
                      fallbackNote={test.reimbursementNote}
                    />
                    {!test.medicareCoverage?.reimbursementRate && test.medicareRate && (
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          Medicare CLFS Rate
                          {test.adltStatus && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium" title="Advanced Diagnostic Laboratory Test - receives annual rate updates based on weighted median of private payer rates">ADLT</span>}
                        </span>
                        <span className="text-sm font-semibold text-emerald-600">${test.medicareRate.toLocaleString()}</span>
                      </div>
                    )}
                    {hasPrivate && <DataRow label="Private Insurance" value={test.commercialPayers.join(', ')} notes={test.commercialPayersNotes} citations={test.commercialPayersCitations} />}
                    <DataRow label={test.codeType === 'PLA' ? 'PLA Code' : 'CPT Code'} value={test.cptCodes || test.cptCode} notes={test.codeType === 'PLA' ? 'Proprietary Laboratory Analyses - specific to this laboratory' : null} citations={test.cptCodesCitations} />
                    <DataRow label="Clinical Availability" value={test.clinicalAvailability} citations={test.clinicalAvailabilityCitations} notes={test.clinicalAvailabilityNotes} />
                    {test.availableRegions && test.availableRegions.length > 0 && (
                      <DataRow label="Available Regions" value={test.availableRegions.join(', ')} />
                    )}
                    {category === 'ECD' && (test.listPrice ? (
                      <DataRow label="List Price" value={`$${test.listPrice}`} citations={test.listPriceCitations} />
                    ) : test.medicareRate && (
                      <DataRow label="List Price (est.)" value={`~$${test.medicareRate.toLocaleString()}`} notes="Medicare rate shown - actual list price may vary" citations="https://www.cms.gov/medicare/payment/fee-schedules/clinical-laboratory" />
                    ))}
                  </div>
                </Section>
                
                {/* Clinical Evidence */}
                <Section title="Clinical Evidence" expertTopic="clinicalTrials">
                  <div className="space-y-1">
                    {test.totalParticipants && (
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="text-xs text-gray-500">Trial Participants</span>
                        <span className="text-sm font-semibold" style={{ color: '#2A63A4' }}>{test.totalParticipants.toLocaleString()}</span>
                      </div>
                    )}
                    {test.numPublications && (
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="text-xs text-gray-500">Publications</span>
                        <span className="text-sm font-semibold text-purple-600">{test.numPublications}{test.numPublicationsPlus ? '+' : ''}</span>
                      </div>
                    )}
                    <DataRow label="Independent Validation" value={test.independentValidation} notes={test.independentValidationNotes} citations={test.independentValidationCitations} />
                    {test.clinicalTrials && (
                      <div className="pt-2 mt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Key Trials</p>
                        <div className="text-xs text-gray-700 space-y-1">
                          {test.clinicalTrials.split(/[;|]/).slice(0, 5).map((trial, idx) => {
                            const trimmed = trial.trim();
                            if (!trimmed) return null;
                            const nctMatch = trimmed.match(/NCT\d+/);
                            return (
                              <div key={idx} className="flex items-start gap-1">
                                <span className="text-gray-400">•</span>
                                {nctMatch ? (
                                  <a 
                                    href={`https://clinicaltrials.gov/study/${nctMatch[0]}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="hover:underline" 
                                    style={{ color: '#2A63A4' }}
                                  >
                                    {trimmed.replace(/https?:\/\/[^\s]+/g, '').trim()}
                                  </a>
                                ) : (
                                  <span>{trimmed}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              </div>

              {test.coverageCrossReference && (
                <CoverageRealityCheck test={test} />
              )}

              {/* Requirements & Method */}
              <Section title="Test Requirements & Method">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <DataRow label="Approach" value={test.approach} expertTopic="tumorInformed" citations={test.approachCitations} />
                    <DataRow label="Requires Tumor Tissue" value={requiresTissue ? 'Yes' : 'No'} notes={test.requiresTumorTissueNotes} />
                    <DataRow label="Requires Matched Normal" value={test.requiresMatchedNormal} />
                  </div>
                  <div className="space-y-1">
                    {test.method && <DataRow label="Method" value={test.method} citations={test.methodCitations} />}
                    {test.targetPopulation && <DataRow label="Target Population" value={test.targetPopulation} citations={test.targetPopulationCitations} />}
                    {test.indicationGroup && <DataRow label="Indication Group" value={test.indicationGroup} />}
                  </div>
                </div>
              </Section>
              
              {/* Cancer Types */}
              {test.cancerTypes && test.cancerTypes.length > 0 && (
                <Section title="Cancer Types">
                  <div className="flex flex-wrap gap-1">
                    {test.cancerTypes.map((type, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{type}</span>
                    ))}
                  </div>
                </Section>
              )}
              
              {/* Clinical Settings - MRD only */}
              {category === 'MRD' && test.clinicalSettings && test.clinicalSettings.length > 0 && (
                <Section title="Validated Clinical Settings">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {test.clinicalSettings.map((setting, i) => (
                      <span key={i} className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs font-medium">
                        {setting === 'Post-Surgery' ? '🔬 Post-Surgery (landmark)' : 
                         setting === 'Surveillance' ? '📊 Surveillance (longitudinal)' :
                         setting === 'Neoadjuvant' ? '💊 Neoadjuvant' :
                         setting === 'Post-Adjuvant' ? '✅ Post-Adjuvant' : setting}
                      </span>
                    ))}
                  </div>
                  {test.clinicalSettingsNotes && (
                    <p className="text-xs text-gray-500 mt-2">{test.clinicalSettingsNotes}</p>
                  )}
                </Section>
              )}
              
              {/* BLOODPAC Standards Reference - MRD only */}
              {category === 'MRD' && (
                <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📋</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">
                        MRD terminology on OpenOnco follows the <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/" target="_blank" rel="noopener noreferrer" className="font-medium text-orange-700 hover:text-orange-800 underline">BLOODPAC MRD Lexicon</a> standards.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <GlossaryTooltip termKey="tumor-informed"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">Tumor-informed</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="tumor-naive"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">Tumor-naïve</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="molecular-response"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">Molecular Response</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="ctdna-clearance"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">ctDNA Clearance</span></GlossaryTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                </>
              )}
              
              {/* TRM Standards Reference - ctMoniTR */}
              {category === 'HCT' && (
                <div className="mt-4 p-3 bg-gradient-to-r from-sky-50 to-cyan-50 rounded-lg border border-sky-200">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📊</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">
                        Treatment response monitoring endpoints follow the <a href="https://friendsofcancerresearch.org/ctdna/" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 hover:text-sky-800 underline">Friends of Cancer Research ctMoniTR</a> evidentiary framework.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <GlossaryTooltip termKey="molecular-response"><span className="text-xs px-2 py-0.5 bg-white rounded border border-sky-200 text-sky-700">Molecular Response</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="vaf"><span className="text-xs px-2 py-0.5 bg-white rounded border border-sky-200 text-sky-700">VAF</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="ctdna"><span className="text-xs px-2 py-0.5 bg-white rounded border border-sky-200 text-sky-700">ctDNA</span></GlossaryTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* TDS Standards Reference - NCCN */}
              {category === 'CGP' && (
                <div className="mt-4 p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-200">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📋</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">
                        Biomarker recommendations reference <a href="https://www.nccn.org/guidelines/guidelines-detail" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 hover:text-violet-800 underline">NCCN Clinical Practice Guidelines</a>. FDA companion diagnostics listed per <a href="https://www.fda.gov/medical-devices/in-vitro-diagnostics/companion-diagnostics" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 hover:text-violet-800 underline">FDA CDx database</a>.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <GlossaryTooltip termKey="nccn"><span className="text-xs px-2 py-0.5 bg-white rounded border border-violet-200 text-violet-700">NCCN</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="companion-dx"><span className="text-xs px-2 py-0.5 bg-white rounded border border-violet-200 text-violet-700">Companion Dx</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="cgp"><span className="text-xs px-2 py-0.5 bg-white rounded border border-violet-200 text-violet-700">CGP</span></GlossaryTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Example Report Link */}
              {test.exampleTestReport && (
                <div className="text-center pt-2">
                  <a href={test.exampleTestReport} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline" style={{ color: '#2A63A4' }}>
                    View Example Test Report →
                  </a>
                </div>
              )}
              
              {/* Minimum Fields Section - for VC eligibility */}
              {MINIMUM_PARAMS[category] && (
                <MinimumFieldsSection test={test} category={category} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </TestContext.Provider>
  );
};

// ============================================
// Comparison Modal
const ComparisonModal = ({ tests, category, onClose, onRemoveTest }) => {
  const params = comparisonParams[category] || comparisonParams.MRD;
  const meta = categoryMeta[category];
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Generate shareable link
  const getShareableLink = () => {
    const testIds = tests.map(t => t.id).join(',');
    return `${window.location.origin}?category=${category}&compare=${testIds}`;
  };
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareableLink());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = getShareableLink();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };
  
  // Print styles - fixed for multi-page printing
  const printStyles = `
    @media print {
      /* Hide everything except the print area */
      body * {
        visibility: hidden;
      }
      .comparison-print-area,
      .comparison-print-area * {
        visibility: visible;
      }
      
      /* Reset modal positioning for print */
      .comparison-modal-root {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .comparison-print-area { 
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
      }
      
      /* Allow content to flow across pages */
      .comparison-print-area,
      .comparison-print-area > div {
        max-height: none !important;
        overflow: visible !important;
        height: auto !important;
      }
      
      /* Table should break across pages naturally */
      .comparison-print-area table { 
        font-size: 9px;
      }
      .comparison-print-area thead { 
        display: table-header-group;
      }
      .comparison-print-area tr { 
        page-break-inside: avoid;
      }
      .comparison-print-area th, 
      .comparison-print-area td { 
        padding: 3px 5px;
      }
      
      /* Hide interactive elements */
      .print\\:hidden { display: none !important; }
      
      @page { 
        margin: 0.4in; 
        size: landscape;
      }
    }
  `;
  
  // Detect LOD units across all tests being compared
  const lodUnits = tests.map(t => detectLodUnit(t.lod)).filter(Boolean);
  const lod95Units = tests.map(t => detectLodUnit(t.lod95)).filter(Boolean);
  const uniqueLodUnits = [...new Set(lodUnits)];
  const uniqueLod95Units = [...new Set(lod95Units)];
  const hasLodUnitMismatch = uniqueLodUnits.length > 1 || uniqueLod95Units.length > 1;
  
  // Category-specific color schemes
  const colorSchemes = {
    MRD: { 
      headerBg: 'bg-gradient-to-r from-orange-500 to-amber-500', 
      headerText: 'text-white',
      accent: 'bg-orange-50 border-orange-200',
      accentText: 'text-orange-700',
      lightBg: 'bg-orange-50/50',
      border: 'border-orange-100',
      closeBtnHover: 'hover:bg-orange-400/20'
    },
    ECD: { 
      headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500', 
      headerText: 'text-white',
      accent: 'bg-emerald-50 border-emerald-200',
      accentText: 'text-emerald-700',
      lightBg: 'bg-emerald-50/50',
      border: 'border-emerald-100',
      closeBtnHover: 'hover:bg-emerald-400/20'
    },
    CGP: {
      headerBg: 'bg-gradient-to-r from-violet-500 to-purple-500',
      headerText: 'text-white',
      accent: 'bg-violet-50 border-violet-200',
      accentText: 'text-violet-700',
      lightBg: 'bg-violet-50/50',
      border: 'border-violet-100',
      closeBtnHover: 'hover:bg-violet-400/20'
    },
    HCT: {
      headerBg: 'bg-gradient-to-r from-sky-500 to-cyan-500',
      headerText: 'text-white',
      accent: 'bg-sky-50 border-sky-200',
      accentText: 'text-sky-700',
      lightBg: 'bg-sky-50/50',
      border: 'border-sky-100',
      closeBtnHover: 'hover:bg-sky-400/20'
    }
  };
  const colors = colorSchemes[category] || colorSchemes.MRD;
  
  return (
    <>
      <style>{printStyles}</style>
      <div className="comparison-modal-root fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:backdrop-blur-none" data-testid="comparison-modal" onClick={onClose}>
        <div className="comparison-print-area bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          {/* Colored Header */}
          <div className={`flex justify-between items-center p-5 ${colors.headerBg}`} style={{ flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center print:hidden">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className={`text-xl font-bold ${colors.headerText} print:text-black`}>Comparing {tests.length} Tests</h2>
                <p className="text-white/80 text-sm print:text-gray-600">{meta?.title || category} Category • OpenOnco.org</p>
              </div>
            </div>
          <div className="flex items-center gap-2">
            {/* Copy Link Button */}
            <button 
              onClick={copyLink} 
              className={`p-2 ${colors.closeBtnHover} rounded-xl transition-colors print:hidden flex items-center gap-1`}
              title="Copy shareable link"
              data-testid="share-link-button"
            >
              {linkCopied ? (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
              {linkCopied && <span className="text-white text-xs">Copied!</span>}
            </button>
            <button 
              onClick={() => window.print()} 
              className={`p-2 ${colors.closeBtnHover} rounded-xl transition-colors print:hidden`}
              title="Print or save as PDF"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
            <button onClick={onClose} className={`p-2 ${colors.closeBtnHover} rounded-xl transition-colors print:hidden`}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Expert Warning Banner */}
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-3" style={{ flexShrink: 0 }}>
          <div className="w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">E</div>
          <div className="text-sm">
            <p className="font-medium text-amber-800">Comparison Limitations</p>
            <p className="text-amber-700 text-xs mt-1">
              Performance metrics may not be directly comparable across tests due to differences in methodology 
              (analytical vs clinical, landmark vs longitudinal), patient populations, and reporting standards. 
              See <span className="font-medium">[E]</span> icons for context.
            </p>
            {hasLodUnitMismatch && (
              <p className="text-red-700 text-xs mt-2 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                LOD values below use different units ({uniqueLodUnits.join(', ')}) — cannot be directly compared. Unit badges shown for clarity.
              </p>
            )}
            <p className="text-amber-600 text-[10px] mt-1 italic">— Expert Advisors: MR, SW</p>
          </div>
        </div>
        
        {/* Table Content */}
        <div style={{ overflow: 'auto', flex: '1 1 auto' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`text-left p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider ${colors.lightBg} min-w-[140px] sticky top-0 z-10`}>
                  Parameter
                </th>
                {tests.map((test, i) => (
                  <th key={test.id} className={`text-left p-4 min-w-[200px] sticky top-0 z-10 ${colors.lightBg}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className={`flex-1 p-3 rounded-xl ${colors.accent} border`}>
                        <p className={`font-bold ${colors.accentText}`}>{test.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{test.vendor}<VendorBadge vendor={test.vendor} size="xs" /></p>
                      </div>
                      <button 
                        onClick={() => onRemoveTest(test.id)} 
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0 print:hidden"
                        title="Remove from comparison"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {params.map((param, idx) => (
                <tr key={param.key} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} hover:bg-gray-100/50 transition-colors`}>
                  <td className={`p-4 text-sm font-medium text-gray-600 ${colors.border} border-b`}>
                    <span className="flex items-center gap-1">
                      {param.label}
                      {category !== 'CGP' && (param.key === 'sensitivity' || param.key === 'specificity') && <ExpertInsight topic={param.key} />}
                      {category !== 'CGP' && param.key === 'lod' && <ExpertInsight topic="lod" />}
                      {category !== 'CGP' && param.key === 'lod95' && <ExpertInsight topic="lodVsLod95" />}
                      {category !== 'CGP' && (param.key === 'sensitivityStagesReported' || param.key === 'stageIISensitivity' || param.key === 'stageIIISensitivity') && <ExpertInsight topic="stageSpecific" />}
                    </span>
                  </td>
                  {tests.map(test => {
                    let value = param.key === 'cancerTypesStr' ? test.cancerTypes?.join(', ') 
                      : param.key === 'commercialPayersStr' ? test.commercialPayers?.join(', ')
                      : param.key === 'availableRegionsStr' ? (test.availableRegions?.join(', ') || 'US')
                      : param.key === 'biomarkersReportedStr' ? test.biomarkersReported?.join(', ')
                      : param.key === 'clinicalSettingsStr' ? test.clinicalSettings?.join(', ')
                      : param.key === 'sampleVolumeMl' ? (test.sampleVolumeMl || test.bloodVolume)
                      : test[param.key];
                    const hasValue = value != null && value !== '';
                    
                    // For LOD/LOD95, add unit badge
                    const isLodField = param.key === 'lod' || param.key === 'lod95';
                    const lodUnit = isLodField ? detectLodUnit(value) : null;
                    const unitBadge = lodUnit ? getLodUnitBadge(lodUnit) : null;
                    
                    return (
                      <td key={test.id} className={`p-4 text-sm ${colors.border} border-b ${hasValue ? 'text-gray-900' : 'text-gray-300'}`}>
                        {hasValue ? (
                          <span className="flex items-center gap-2">
                            <span>{String(value)}</span>
                            {unitBadge && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${unitBadge.bg} ${unitBadge.text}`}>
                                {unitBadge.label}
                              </span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className={`p-4 ${colors.lightBg} border-t ${colors.border} flex-shrink-0 print:hidden`}>
          <p className="text-xs text-gray-500 text-center">
            Click the × next to a test name to remove it from comparison • Use print button to save as PDF
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export { ComparisonModal };
export default TestDetailModal;
