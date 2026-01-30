import { useAssistanceProgram } from '../../dal';

/**
 * AssistanceBadge - displays a badge when vendor has financial assistance program
 *
 * Props:
 * - vendor: string - the vendor name
 * - size: 'xs' | 'sm' | 'md' - badge size
 * - showTooltip: boolean - whether to show tooltip on hover (default true)
 */
const AssistanceBadge = ({ vendor, size = 'sm', showTooltip = true }) => {
  const { program } = useAssistanceProgram(vendor);

  if (!program?.hasProgram) return null;

  const sizeClasses = {
    xs: 'text-[9px] px-1 py-0.5',
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1'
  };

  const badge = (
    <span
      className={`inline-flex items-center gap-0.5 ${sizeClasses[size]} rounded font-medium bg-rose-100 text-rose-700 border border-rose-200 cursor-help`}
      title={!showTooltip ? (program?.programName || 'Financial Assistance Available') : undefined}
    >
      <span className="text-rose-500">💝</span>
      <span>Assistance</span>
    </span>
  );

  if (!showTooltip || !program) return badge;

  const rules = program.eligibilityRules;

  // Format FPL thresholds as compact string
  const formatFPLThresholds = (thresholds) => {
    if (!thresholds?.length) return null;
    return thresholds
      .slice(0, 3) // Limit to 3 tiers
      .map(t => `≤${t.maxFPL}% = ${t.maxOOP}`)
      .join(', ');
  };

  return (
    <div className="relative group inline-flex">
      {badge}
      <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <p className="text-rose-400 font-bold text-[11px] mb-1">💝 Financial Assistance</p>
        {program.programName && <p className="font-medium">{program.programName}</p>}
        {program.description && <p className="text-gray-300 mt-1">{program.description}</p>}

        {rules && (
          <div className="mt-1.5 pt-1.5 border-t border-gray-700 space-y-1">
            {rules.fplThresholds?.length > 0 && (
              <p className="text-emerald-400">
                <span className="text-gray-400">FPL: </span>
                {formatFPLThresholds(rules.fplThresholds)}
              </p>
            )}
            {rules.processingTime && (
              <p className="text-gray-300">
                <span className="text-gray-400">Processing: </span>
                {rules.processingTime}
              </p>
            )}
            {rules.requiredDocumentation?.length > 0 && (
              <p className="text-gray-300">
                <span className="text-gray-400">Docs: </span>
                {rules.requiredDocumentation.slice(0, 2).join(', ')}
                {rules.requiredDocumentation.length > 2 && '...'}
              </p>
            )}
            {(rules.medicareEligible || rules.medicaidEligible) && (
              <p className="text-cyan-400 text-[9px]">
                {[
                  rules.medicareEligible && 'Medicare eligible',
                  rules.medicaidEligible && 'Medicaid eligible'
                ].filter(Boolean).join(' • ')}
              </p>
            )}
          </div>
        )}

        {!rules && program.eligibility && (
          <p className="text-gray-400 mt-1 text-[9px]">Eligibility: {program.eligibility}</p>
        )}
        {!rules && program.maxOutOfPocket && (
          <p className="text-emerald-400 font-medium mt-1">Max cost: {program.maxOutOfPocket}</p>
        )}
      </div>
    </div>
  );
};

export default AssistanceBadge;
