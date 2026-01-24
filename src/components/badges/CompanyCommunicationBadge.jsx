import { useTestContribution } from '../../dal';

// CompanyCommunicationBadge component - displays CC badge for company-submitted tests
const CompanyCommunicationBadge = ({ testId, size = 'sm' }) => {
  const { contribution } = useTestContribution(testId);
  if (!contribution) return null;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
  };

  const tooltip = `${contribution.name} (${contribution.company})\nSubmitted: ${contribution.date}${contribution.note ? '\n' + contribution.note : ''}`;

  return (
    <span
      className={`${sizeClasses[size]} bg-sky-100 text-sky-700 rounded-full font-medium whitespace-nowrap cursor-help hover:bg-sky-200 transition-colors`}
      title={tooltip}
    >
      CC
    </span>
  );
};

export default CompanyCommunicationBadge;
