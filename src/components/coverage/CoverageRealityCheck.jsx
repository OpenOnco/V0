import React, { useState } from 'react';

// Inline SVG Icon Components (replacing lucide-react)
const CheckCircle = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircle = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertTriangle = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ChevronDown = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUp = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const ExternalLink = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const Info = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ShieldAlert = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const DollarSign = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Status styling matching MedicareCoverageDisplay patterns
const PAYER_STATUS_STYLES = {
  COVERED: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle,
    label: 'Covered'
  },
  PARTIAL: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: AlertTriangle,
    label: 'Partial'
  },
  EXPERIMENTAL: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
    label: 'Experimental'
  },
  INVESTIGATIONAL: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
    label: 'Investigational'
  },
  LIMITED_EVIDENCE: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
    label: 'Limited Evidence'
  },
  RESTRICTIVE: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: AlertTriangle,
    label: 'Restrictive'
  },
  NOT_COVERED: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
    label: 'Not Covered'
  }
};

// Friendly names for payer keys
const PAYER_NAMES = {
  aetna: 'Aetna',
  cigna: 'Cigna',
  united: 'UnitedHealthcare',
  anthem: 'Anthem BCBS',
  humana: 'Humana',
  geisinger: 'Geisinger',
  bcbsLouisiana: 'BCBS Louisiana',
  bcbsMassachusetts: 'BCBS Massachusetts'
};

const PayerStatusBadge = ({ status }) => {
  const style = PAYER_STATUS_STYLES[status] || PAYER_STATUS_STYLES.NOT_COVERED;
  const Icon = style.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      <Icon className="w-3 h-3" />
      {style.label}
    </span>
  );
};

const PayerRow = ({ payerKey, payerData, isExpanded, onToggle }) => {
  const payerName = PAYER_NAMES[payerKey] || payerKey;
  const style = PAYER_STATUS_STYLES[payerData.status] || PAYER_STATUS_STYLES.NOT_COVERED;

  return (
    <div className={`border rounded-lg ${style.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-2.5 ${style.bg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{payerName}</span>
          <PayerStatusBadge status={payerData.status} />
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-3 bg-white space-y-2 text-sm">
          {payerData.policy && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Policy</span>
              <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                {payerData.policy}
              </span>
            </div>
          )}

          {payerData.coveredIndications && payerData.coveredIndications.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Covered Indications</span>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {payerData.coveredIndications.map((indication, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {indication}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {payerData.notes && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Notes</span>
              <p className="text-xs text-gray-600 italic">{payerData.notes}</p>
            </div>
          )}

          {payerData.policyUrl && (
            <a
              href={payerData.policyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              View Policy <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export const CoverageRealityCheck = ({ test }) => {
  const [expandedPayers, setExpandedPayers] = useState({});
  const [showVendorClaims, setShowVendorClaims] = useState(false);

  const coverage = test.coverageCrossReference;

  if (!coverage) {
    return null;
  }

  const togglePayer = (payerKey) => {
    setExpandedPayers(prev => ({
      ...prev,
      [payerKey]: !prev[payerKey]
    }));
  };

  // Separate major payers from regional/smaller ones
  const majorPayers = ['aetna', 'cigna', 'united', 'anthem', 'humana'];
  const privatePayers = coverage.privatePayers || {};

  const majorPayerEntries = Object.entries(privatePayers).filter(([key]) => majorPayers.includes(key));
  const otherPayerEntries = Object.entries(privatePayers).filter(([key]) => !majorPayers.includes(key));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-amber-600" />
        <h3 className="text-sm font-semibold text-gray-800">Coverage Reality Check</h3>
        <span className="text-[10px] text-gray-400 ml-auto">
          Verified {coverage.lastVerified}
        </span>
      </div>

      {/* Key Insight Banner */}
      {coverage.analysis?.keyInsight && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">{coverage.analysis.keyInsight}</p>
          </div>
        </div>
      )}

      {/* Vendor Claims (Collapsible) */}
      {coverage.vendorClaims && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowVendorClaims(!showVendorClaims)}
            className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-xs font-medium text-gray-600">What the vendor claims</span>
            {showVendorClaims ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showVendorClaims && (
            <div className="p-3 space-y-2 text-xs">
              {coverage.vendorClaims.commercialClaimed && (
                <div>
                  <span className="text-gray-500">Commercial claim:</span>
                  <p className="text-gray-700 italic">"{coverage.vendorClaims.commercialClaimed}"</p>
                </div>
              )}
              {coverage.vendorClaims.medicareClaimed && (
                <div>
                  <span className="text-gray-500">Medicare indications claimed:</span>
                  <p className="text-gray-700">{coverage.vendorClaims.medicareClaimed.join(', ')}</p>
                </div>
              )}
              {coverage.vendorClaims.cashPay && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-500">Cash pay:</span>
                  <span className="text-gray-700 font-medium">{coverage.vendorClaims.cashPay}</span>
                </div>
              )}
              {coverage.vendorClaims.url && (
                <a
                  href={coverage.vendorClaims.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  Vendor billing page <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Medicare Summary */}
      {coverage.medicare && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-800">Medicare</span>
            <PayerStatusBadge status={coverage.medicare.status} />
          </div>
          {coverage.medicare.policies && coverage.medicare.policies.length > 0 && (
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] text-emerald-600">Policies:</span>
              {coverage.medicare.policies.map((policy, i) => (
                <span key={i} className="font-mono text-[10px] text-emerald-700 bg-emerald-100 px-1 rounded">
                  {policy}
                </span>
              ))}
            </div>
          )}
          {coverage.medicare.indications && (
            <p className="text-[10px] text-emerald-700">
              {coverage.medicare.indications.join(' • ')}
            </p>
          )}
          {coverage.medicare.rate && (
            <p className="text-[10px] text-emerald-600 mt-1">
              Rate: {coverage.medicare.rate}
            </p>
          )}
        </div>
      )}

      {/* Major Private Payers */}
      {majorPayerEntries.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-gray-600">Major Commercial Payers</span>
          {majorPayerEntries.map(([key, data]) => (
            <PayerRow
              key={key}
              payerKey={key}
              payerData={data}
              isExpanded={expandedPayers[key]}
              onToggle={() => togglePayer(key)}
            />
          ))}
        </div>
      )}

      {/* Other Payers (Regional, etc.) */}
      {otherPayerEntries.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-gray-600">Regional / Other Payers</span>
          {otherPayerEntries.map(([key, data]) => (
            <PayerRow
              key={key}
              payerKey={key}
              payerData={data}
              isExpanded={expandedPayers[key]}
              onToggle={() => togglePayer(key)}
            />
          ))}
        </div>
      )}

      {/* Patient Guidance */}
      {coverage.analysis?.patientGuidance && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs font-medium text-gray-700 block mb-1">Patient Guidance</span>
              <p className="text-xs text-gray-600">{coverage.analysis.patientGuidance}</p>
            </div>
          </div>
        </div>
      )}

      {/* Accuracy Assessment */}
      {coverage.analysis?.vendorClaimAccuracy && (
        <div className="text-[10px] text-gray-400 text-right">
          {coverage.analysis.vendorClaimAccuracy}
        </div>
      )}
    </div>
  );
};

export default CoverageRealityCheck;
