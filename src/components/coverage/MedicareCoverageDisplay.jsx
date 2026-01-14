import React from 'react';

/**
 * MedicareCoverageDisplay - Shows structured Medicare coverage status
 * 
 * Props:
 * - medicareCoverage: The structured coverage object from data.js
 * - fallbackReimbursement: Legacy reimbursement string (for backward compatibility)
 * - fallbackNote: Legacy reimbursementNote string
 * - showDetails: Whether to show expanded details (default: false)
 */

// Status badge colors
const STATUS_STYLES = {
  COVERED: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    icon: '✓',
    label: 'Medicare Covered'
  },
  NOT_COVERED: {
    bg: 'bg-red-100',
    text: 'text-red-700', 
    border: 'border-red-300',
    icon: '✗',
    label: 'Not Covered'
  },
  PENDING_COVERAGE: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
    icon: '⏳',
    label: 'Pending Coverage'
  },
  PENDING_FDA: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
    icon: '⏳',
    label: 'Pending FDA'
  },
  EXPECTED_COVERAGE: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    icon: '→',
    label: 'Expected'
  },
  NOT_YET_AVAILABLE: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '—',
    label: 'Not Yet Available'
  },
  UNKNOWN: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    border: 'border-gray-200',
    icon: '?',
    label: 'Unknown'
  }
};

// Policy type labels
const POLICY_LABELS = {
  LCD: 'Local Coverage Determination',
  NCD: 'National Coverage Determination',
  CLFS: 'Clinical Lab Fee Schedule'
};

// Compact badge for card view
export const MedicareCoverageBadge = ({ medicareCoverage, reimbursement }) => {
  // If we have structured data, use it
  if (medicareCoverage?.status) {
    const style = STATUS_STYLES[medicareCoverage.status] || STATUS_STYLES.UNKNOWN;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        <span>{style.icon}</span>
        <span>{medicareCoverage.status === 'COVERED' ? 'Medicare' : style.label}</span>
      </span>
    );
  }
  
  // Fallback to legacy string parsing
  if (reimbursement) {
    const lower = reimbursement.toLowerCase();
    if (lower.includes('not covered') || lower.includes('not yet')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          <span>✗</span>
          <span>Not Covered</span>
        </span>
      );
    }
    if (lower.includes('medicare') || lower.includes('covered')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
          <span>✓</span>
          <span>Medicare</span>
        </span>
      );
    }
    if (lower.includes('pending') || lower.includes('emerging')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
          <span>⏳</span>
          <span>Pending</span>
        </span>
      );
    }
  }
  
  return null;
};

// Full display for detail modal
const MedicareCoverageDisplay = ({ 
  medicareCoverage, 
  fallbackReimbursement, 
  fallbackNote,
  showDetails = false 
}) => {
  // If no structured data, fall back to legacy display
  if (!medicareCoverage?.status) {
    if (!fallbackReimbursement) return null;
    return (
      <div className="py-1.5">
        <div className="flex justify-between items-start">
          <span className="text-xs text-gray-500">Medicare</span>
          <span className="text-sm text-gray-700 text-right max-w-[70%]">{fallbackReimbursement}</span>
        </div>
        {fallbackNote && (
          <p className="text-xs text-gray-500 mt-1">{fallbackNote}</p>
        )}
      </div>
    );
  }
  
  const style = STATUS_STYLES[medicareCoverage.status] || STATUS_STYLES.UNKNOWN;
  
  return (
    <div className="py-2">
      {/* Status row */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500">Medicare Coverage</span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${style.bg} ${style.text} border ${style.border}`}>
          <span className="text-base">{style.icon}</span>
          <span>{style.label}</span>
        </span>
      </div>
      
      {/* Policy info */}
      {medicareCoverage.policyNumber && (
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-gray-500">
            {medicareCoverage.policyType && POLICY_LABELS[medicareCoverage.policyType]}
          </span>
          <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
            {medicareCoverage.policyType === 'LCD' ? medicareCoverage.policyNumber : `NCD ${medicareCoverage.policyNumber}`}
          </span>
        </div>
      )}
      
      {/* Policy name */}
      {medicareCoverage.policyName && (
        <p className="text-xs text-gray-600 mb-2 italic">
          {medicareCoverage.policyName}
        </p>
      )}
      
      {/* Covered indications */}
      {medicareCoverage.coveredIndications?.length > 0 && medicareCoverage.status === 'COVERED' && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-600 mb-1">Covered Indications:</p>
          <ul className="text-xs text-gray-600 space-y-0.5">
            {medicareCoverage.coveredIndications.slice(0, showDetails ? undefined : 3).map((indication, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>{indication}</span>
              </li>
            ))}
            {!showDetails && medicareCoverage.coveredIndications.length > 3 && (
              <li className="text-gray-400 italic">
                +{medicareCoverage.coveredIndications.length - 3} more...
              </li>
            )}
          </ul>
        </div>
      )}
      
      {/* Reimbursement rate */}
      {medicareCoverage.reimbursementRate && (
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">Reimbursement</span>
          <span className="text-sm font-semibold text-emerald-600">
            {medicareCoverage.reimbursementRate}
          </span>
        </div>
      )}
      
      {/* CPT code */}
      {medicareCoverage.cptCode && (
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">CPT/PLA Code</span>
          <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
            {medicareCoverage.cptCode}
          </span>
        </div>
      )}
      
      {/* Notes */}
      {medicareCoverage.notes && (
        <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
          {medicareCoverage.notes}
        </p>
      )}
      
      {/* Last verified */}
      {medicareCoverage.lastVerified && (
        <p className="text-[10px] text-gray-400 mt-1">
          Verified: {medicareCoverage.lastVerified}
        </p>
      )}
    </div>
  );
};

export default MedicareCoverageDisplay;
