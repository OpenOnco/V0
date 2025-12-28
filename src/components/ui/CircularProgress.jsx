// CircularProgress component for quality visualization
const CircularProgress = ({ value, size = 80, strokeWidth = 8, color = 'emerald' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const colorMap = {
    emerald: { stroke: '#10b981', bg: '#d1fae5' },
    orange: { stroke: '#f97316', bg: '#ffedd5' },
    sky: { stroke: '#0ea5e9', bg: '#e0f2fe' },
    violet: { stroke: '#8b5cf6', bg: '#ede9fe' },
  };
  const colors = colorMap[color] || colorMap.emerald;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.bg} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.stroke} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700 ease-out" />
    </svg>
  );
};

export default CircularProgress;
