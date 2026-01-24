import React, { useState } from 'react';
import {
  createCategoryMeta,
  BUILD_INFO,
} from '../../data';
import { useTestVerification, useTestContribution } from '../../dal';
import { calculateTestCompleteness } from '../../utils/testMetrics';
import Badge from '../ui/Badge';
import VendorBadge from '../badges/VendorBadge';
import ProductTypeBadge from '../badges/ProductTypeBadge';
import AssistanceBadge from '../badges/AssistanceBadge';
import FeedbackModal from '../patient/FeedbackModal';

// Create categoryMeta using imported function with BUILD_INFO sources
const categoryMeta = createCategoryMeta(BUILD_INFO.sources);

// ============================================
// Test Card
// ============================================
const TestCard = ({ test, isSelected, onSelect, category, onShowDetail }) => {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const colorVariant = categoryMeta[category]?.color || 'amber';
  const isDiscontinued = test.isDiscontinued === true;

  // DAL hooks for vendor verification and contributions
  const { isVerified: hasVendorVerified, verification } = useTestVerification(test.id);
  const { contribution } = useTestContribution(test.id);
  const hasCompanyComm = contribution !== null;

  // Calculate BC status - automatic when 100% minimum fields complete
  const completeness = calculateTestCompleteness(test, category);
  const isBC = completeness.percentage === 100;

  return (
    <div className="relative">
      <div id={`test-card-${test.id}`} data-testid="test-card" className={`relative h-full flex flex-col bg-white rounded-xl border-2 p-4 transition-all overflow-hidden ${isSelected ? 'border-emerald-500 shadow-md shadow-emerald-100' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* DISCONTINUED text overlay */}
      {isDiscontinued && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-gray-400/30 font-bold text-4xl tracking-wider transform -rotate-12">
            DISCONTINUED
          </span>
        </div>
      )}
      {/* INCOMPLETE text overlay for non-BC tests */}
      {!isBC && !isDiscontinued && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-red-400/30 font-bold text-4xl tracking-wider transform -rotate-12">
            INCOMPLETE
          </span>
        </div>
      )}
      {/* Header - clickable to show detail modal */}
      <div className="cursor-pointer flex-1" data-testid="test-card-clickable" onClick={() => onShowDetail && onShowDetail(test)}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isDiscontinued && <Badge variant="slate">DISCONTINUED</Badge>}
              {/* VENDOR VERIFIED badge - green, pulsing */}
              {!isDiscontinued && hasVendorVerified && (
                <div className="relative group inline-flex">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white animate-pulse shadow-sm">
                    ✓ VENDOR VERIFIED
                  </span>
                  <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Verified</p>
                    <p className="font-medium">{verification?.name}</p>
                    <p className="text-gray-300">{verification?.company}</p>
                    <p className="text-gray-400 text-[9px]">{verification?.verifiedDate}</p>
                  </div>
                </div>
              )}
              {/* INPUT badge - light green (only if not verified) */}
              {!isDiscontinued && hasCompanyComm && !hasVendorVerified && (
                <div className="relative group inline-flex">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                    ✓ VENDOR INPUT
                  </span>
                  <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Input</p>
                    <p className="font-medium">{contribution?.name}</p>
                    <p className="text-gray-300">{contribution?.company}</p>
                    <p className="text-gray-400 text-[9px]">{contribution?.date}</p>
                  </div>
                </div>
              )}
              {/* Product Type Badge - IVD Kit vs Service */}
              {!isDiscontinued && test.productType && <ProductTypeBadge productType={test.productType} size="xs" />}
              {/* Financial Assistance Badge */}
              {!isDiscontinued && <AssistanceBadge vendor={test.vendor} size="sm" />}
              {/* Medicare/Private Coverage badges - use structured data if available */}
              {!isDiscontinued && (test.medicareCoverage?.status === 'COVERED' || test.reimbursement?.toLowerCase().includes('medicare')) && test.commercialPayers && test.commercialPayers.length > 0
                ? <Badge variant="success">Medicare+Private</Badge>
                : !isDiscontinued && (test.medicareCoverage?.status === 'COVERED' || test.reimbursement?.toLowerCase().includes('medicare'))
                  ? <Badge variant="success">Medicare</Badge>
                  : !isDiscontinued && test.medicareCoverage?.status === 'NOT_COVERED'
                    ? <Badge variant="slate" title="Not currently covered by Medicare">No Medicare</Badge>
                    : !isDiscontinued && (test.medicareCoverage?.status === 'PENDING_COVERAGE' || test.medicareCoverage?.status === 'PENDING_FDA')
                      ? <Badge variant="amber" title="Medicare coverage pending">Pending</Badge>
                      : !isDiscontinued && test.commercialPayers && test.commercialPayers.length > 0
                        ? <Badge variant="blue">Private</Badge>
                        : null}
              {test.adltStatus && <Badge variant="amber" title="CMS Advanced Diagnostic Laboratory Test - annual rate updates based on private payer data">ADLT</Badge>}
              {test.codeType === 'PLA' && <Badge variant="slate" title="Proprietary Laboratory Analyses code - specific to this laboratory's test">PLA</Badge>}
              {category === 'ECD' && (test.listPrice ? (
                <Badge variant="amber">${test.listPrice}</Badge>
              ) : test.medicareRate && (
                <Badge variant="amber" title="Medicare rate - actual list price may vary">~${test.medicareRate}</Badge>
              ))}
              {test.totalParticipants && <Badge variant="blue">{test.totalParticipants.toLocaleString()} trial participants</Badge>}
              {test.numPublications && <Badge variant="purple">{test.numPublications}{test.numPublicationsPlus ? '+' : ''} pubs</Badge>}
              {test.approach && <Badge variant={colorVariant}>{test.approach}</Badge>}
              {test.testScope && <Badge variant={colorVariant}>{test.testScope}</Badge>}
            </div>
            <h3 className={`font-semibold ${isDiscontinued ? 'text-gray-400' : 'text-gray-900'}`}>{test.name}</h3>
            <p className="text-sm text-gray-500">{test.vendor}<VendorBadge vendor={test.vendor} size="sm" /></p>
            {/* Platform Required - for IVD Kits */}
            {test.platformRequired && (
              <p className="text-xs text-indigo-600 mt-0.5">
                <span className="font-medium">Platform:</span> {test.platformRequired}
              </p>
            )}
          </div>
          {/* Prominent comparison checkbox - click selects for comparison, hidden on mobile */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(test.id); }}
            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all flex-shrink-0 ${
              isSelected
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-white border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
            }`}
            title={isSelected ? 'Remove from comparison' : 'Add to comparison'}
            data-testid="compare-button"
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              isSelected ? 'bg-white border-white' : 'border-current'
            }`}>
              {isSelected && <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-xs font-medium hidden sm:inline">{isSelected ? 'Selected' : 'Compare'}</span>
          </button>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {category !== 'CGP' && test.sensitivity != null && (
            <div>
              <p className={`text-lg font-bold ${(test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : 'text-emerald-600'}`}>
                {test.sensitivity}%
                {test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                  <span className="inline-block ml-0.5" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'})` : 'Analytical validation only'}>
                    <svg className="w-3 h-3 inline text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">Reported Sens.</p>
            </div>
          )}
          {category !== 'CGP' && test.specificity != null && (
            <div>
              <p className={`text-lg font-bold ${(test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : 'text-emerald-600'}`}>
                {test.specificity}%
                {test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                  <span className="inline-block ml-0.5" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'})` : 'Analytical validation only'}>
                    <svg className="w-3 h-3 inline text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">Specificity</p>
            </div>
          )}
          {/* LOD display - show both LOD and LOD95 when available */}
          {category !== 'CGP' && (test.lod != null || test.lod95 != null) && (
            <div>
              {test.lod != null && test.lod95 != null ? (
                // Both values available - show stacked with monitoring indicator
                <>
                  <p className="text-sm font-bold text-violet-600">{test.lod}</p>
                  <p className="text-xs text-violet-400">{test.lod95}</p>
                  <p className="text-xs text-gray-500">LOD / LOD95</p>
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-violet-500 font-medium mt-0.5 cursor-help" title="Both LOD and LOD95 are reported; see expert notes on how to interpret the gap.">
                    LOD+95
                  </span>
                </>
              ) : test.lod != null ? (
                // Only LOD
                <>
                  <p className="text-lg font-bold text-violet-600">{test.lod}</p>
                  <p className="text-xs text-gray-500">LOD</p>
                </>
              ) : (
                // Only LOD95
                <>
                  <p className="text-lg font-bold text-violet-600">{test.lod95}</p>
                  <p className="text-xs text-gray-500">LOD95</p>
                </>
              )}
            </div>
          )}
          {category === 'MRD' && test.followUpTat && <div><p className="text-lg font-bold text-slate-600">{test.followUpTat}d</p><p className="text-xs text-gray-500">TAT</p></div>}
          {category === 'HCT' && test.leadTimeVsImaging && <div><p className="text-lg font-bold text-emerald-600">{test.leadTimeVsImaging}d</p><p className="text-xs text-gray-500">Early Warning</p></div>}
          {category === 'ECD' && test.stageISensitivity && <div><p className="text-lg font-bold text-emerald-600">{test.stageISensitivity}%</p><p className="text-xs text-gray-500">Stage I</p></div>}
          {category === 'ECD' && test.ppv != null && <div><p className="text-lg font-bold text-emerald-600">{test.ppv}%</p><p className="text-xs text-gray-500">PPV</p></div>}
          {category === 'CGP' && test.genesAnalyzed && <div><p className="text-lg font-bold text-violet-600">{test.genesAnalyzed}</p><p className="text-xs text-gray-500">Genes</p></div>}
          {category === 'CGP' && test.fdaCompanionDxCount && <div><p className="text-lg font-bold text-emerald-600">{test.fdaCompanionDxCount}</p><p className="text-xs text-gray-500">CDx</p></div>}
          {category === 'CGP' && test.tat && <div><p className="text-lg font-bold text-slate-600">{test.tat}</p><p className="text-xs text-gray-500">TAT</p></div>}
        </div>

        {/* Cancer types */}
        <div className="flex flex-wrap gap-1 mb-2">
          {test.cancerTypes && test.cancerTypes.slice(0, 3).map((type, i) => <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{type.length > 20 ? type.slice(0, 20) + '...' : type}</span>)}
          {test.cancerTypes && test.cancerTypes.length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{test.cancerTypes.length - 3}</span>}
        </div>

        {/* Clinical settings - MRD only */}
        {category === 'MRD' && test.clinicalSettings && test.clinicalSettings.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {test.clinicalSettings.slice(0, 4).map((setting, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded text-[10px] font-medium">
                {setting === 'Post-Surgery' ? 'Post-Surg' :
                 setting === 'Surveillance' ? 'Surveil' :
                 setting === 'Neoadjuvant' ? 'Neoadj' :
                 setting === 'Post-Adjuvant' ? 'Post-Adj' : setting}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Show detail button - pushed to bottom */}
      <div className="border-t border-gray-100 pt-2 mt-auto flex items-center justify-between">
        <button
          onClick={() => onShowDetail && onShowDetail(test)}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
        >
          Show detail
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFeedbackModal(true);
          }}
          className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 transition-colors"
          title="Report an error or suggest a correction"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="hidden sm:inline">Report error</span>
        </button>
      </div>
    </div>
    
    <FeedbackModal 
      isOpen={showFeedbackModal}
      onClose={() => setShowFeedbackModal(false)}
      testName={`${test.name} (${test.id})`}
    />
    </div>
  );
};

export default TestCard;
