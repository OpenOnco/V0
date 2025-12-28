// Quality Grade Badge
const QualityGrade = ({ percentage }) => {
  let grade, bgColor, textColor;
  if (percentage >= 95) { grade = 'A+'; bgColor = 'bg-emerald-100'; textColor = 'text-emerald-700'; }
  else if (percentage >= 90) { grade = 'A'; bgColor = 'bg-emerald-50'; textColor = 'text-emerald-600'; }
  else if (percentage >= 80) { grade = 'B'; bgColor = 'bg-blue-50'; textColor = 'text-blue-600'; }
  else if (percentage >= 70) { grade = 'C'; bgColor = 'bg-yellow-50'; textColor = 'text-yellow-600'; }
  else { grade = 'D'; bgColor = 'bg-red-50'; textColor = 'text-red-600'; }
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${bgColor} ${textColor}`}>{grade}</span>;
};

export default QualityGrade;
