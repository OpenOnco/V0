import React, { useState } from 'react';

// Performance Metric with Sample Size Warning
// Displays sensitivity/specificity with warning when 100% comes from small cohort
const PerformanceMetricWithWarning = ({
  value,
  label,
  test,
  metric = 'sensitivity', // 'sensitivity' or 'specificity'
  size = 'lg' // 'sm', 'md', 'lg'
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (value == null) return null;

  // Check if this metric needs a warning (100% or ≥99.9% with small sample or analytical validation)
  const needsWarning = (value >= 99.9 || value === 100) &&
    (test.smallSampleWarning || test.analyticalValidationWarning);

  // Get warning details
  const getWarningText = () => {
    if (test.analyticalValidationWarning) {
      return 'Analytical validation only - clinical performance may differ';
    }
    if (test.smallSampleWarning && test.validationCohortSize) {
      return `Small validation cohort (n=${test.validationCohortSize})`;
    }
    if (test.smallSampleWarning) {
      return 'Small validation cohort - interpret with caution';
    }
    return null;
  };

  const warningText = getWarningText();

  const sizeClasses = {
    sm: { value: 'text-lg', label: 'text-[10px]' },
    md: { value: 'text-xl', label: 'text-xs' },
    lg: { value: 'text-2xl', label: 'text-xs' }
  };

  // Format display value
  const displayValue = typeof value === 'number'
    ? `${value}${test[`${metric}Plus`] ? '+' : ''}%`
    : `${value}${String(value).includes('%') ? '' : '%'}`;

  return (
    <div className="text-center relative">
      <div className="relative inline-block">
        <p className={`font-bold ${needsWarning ? 'text-amber-600' : 'text-emerald-600'} ${sizeClasses[size].value}`}>
          {displayValue}
          {needsWarning && (
            <span
              className="inline-block ml-1 cursor-help"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
            >
              <svg className="w-4 h-4 inline text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          )}
        </p>
        {/* Warning Tooltip */}
        {needsWarning && showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-amber-900 text-white text-xs rounded-lg shadow-xl">
            <div className="font-semibold mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Interpret with caution
            </div>
            <div className="text-amber-100">{warningText}</div>
            {test.validationCohortStudy && (
              <div className="text-amber-200 mt-1 text-[10px]">
                Study: {test.validationCohortStudy}
              </div>
            )}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-amber-900" />
          </div>
        )}
      </div>
      <p className={`text-gray-500 ${sizeClasses[size].label}`}>{label}</p>
    </div>
  );
};

export default PerformanceMetricWithWarning;
