import { useState } from 'react';
import { mrdTestData, ecdTestData, trmTestData, tdsTestData, BUILD_INFO, DATABASE_CHANGELOG } from '../data';

const DatabaseSummary = () => {
  const [showFAQ, setShowFAQ] = useState(false);
  
  // Dynamically count actual fields per test
  const mrdParams = mrdTestData.length > 0 ? Object.keys(mrdTestData[0]).length : 0;
  const ecdParams = ecdTestData.length > 0 ? Object.keys(ecdTestData[0]).length : 0;
  const trmParams = trmTestData.length > 0 ? Object.keys(trmTestData[0]).length : 0;
  const cgpParams = tdsTestData.length > 0 ? Object.keys(tdsTestData[0]).length : 0;
  
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length + tdsTestData.length;
  const totalDataPoints = (mrdTestData.length * mrdParams) + (ecdTestData.length * ecdParams) + (trmTestData.length * trmParams) + (tdsTestData.length * cgpParams);
  
  // Add category to each test for proper openness scoring
  const allTests = [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD' })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD' })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM' })),
    ...tdsTestData.map(t => ({ ...t, category: 'TDS' }))
  ];
  
  const allVendors = new Set([
    ...mrdTestData.map(t => t.vendor),
    ...ecdTestData.map(t => t.vendor),
    ...trmTestData.map(t => t.vendor),
    ...tdsTestData.map(t => t.vendor)
  ]);

  // Helper functions
  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';

  // Check if test has meaningful reimbursement (inclusion criteria for award)
  const hasReimbursement = (test) => {
    const reimb = (test.reimbursement || '').toLowerCase();
    if (!reimb) return false;
    if (reimb.includes('not applicable')) return false;
    if (reimb.includes('not established')) return false;
    if (reimb.includes('no established')) return false;
    if (reimb.includes('no specific')) return false;
    if (reimb === 'self-pay') return false;
    if (reimb === 'coverage varies') return false;
    if (reimb.startsWith('coverage emerging')) return false;
    return reimb.includes('medicare') || reimb.includes('covered') || (test.commercialPayers && test.commercialPayers.length > 0);
  };

  // Calculate openness score per test (0-100) - CATEGORY-NORMALIZED
  // Each category has different "standard" metrics, so we normalize accordingly
  const calcTestScore = (test) => {
    let score = 0;
    
    // UNIVERSAL FIELDS (70 pts max across all categories)
    if (hasValue(test.listPrice)) score += 30;  // Gold standard - hardest to find
    if (test.numPublications != null && test.numPublications > 0) score += 15;
    if (hasValue(test.tat) || hasValue(test.initialTat)) score += 10;
    if (hasValue(test.bloodVolume) || hasValue(test.sampleType) || hasValue(test.sampleCategory)) score += 10;
    if (test.totalParticipants != null && test.totalParticipants > 0) score += 5;
    
    // CATEGORY-SPECIFIC FIELDS (30 pts max - metrics that ALL tests in category can have)
    switch (test.category) {
      case 'ECD':
        // ECD: Sensitivity/specificity are key for screening tests
        if (hasValue(test.sensitivity)) score += 15;
        if (hasValue(test.specificity)) score += 15;
        break;
      case 'MRD':
        // MRD: LOD is THE key metric (all MRD tests report this)
        if (hasValue(test.lod) || hasValue(test.lod95)) score += 30;
        break;
      case 'TRM':
        // TRM: Sensitivity/specificity for mutation detection
        if (hasValue(test.sensitivity)) score += 15;
        if (hasValue(test.specificity)) score += 15;
        break;
      case 'TDS':
        // TDS/CGP: Panel size + biomarker reporting (TMB/MSI) - all CGP tests have these
        if (hasValue(test.genesAnalyzed)) score += 15;
        if (hasValue(test.tmb) || hasValue(test.msi)) score += 15;
        break;
      default:
        // Fallback to sensitivity/specificity
        if (hasValue(test.sensitivity)) score += 15;
        if (hasValue(test.specificity)) score += 15;
    }
    
    return score;
  };

  // Normalize vendor names
  const normalizeVendor = (v) => {
    if (!v) return 'Unknown';
    if (v.includes('Guardant')) return 'Guardant Health';
    if (v.includes('Foundation Medicine')) return 'Foundation Medicine';
    return v;
  };

  // Count reimbursed tests for stats display
  const reimbursedTests = allTests.filter(hasReimbursement);
  
  // Group ALL tests by vendor for openness scoring
  const vendorScores = {};
  allTests.forEach(test => {
    const vendor = normalizeVendor(test.vendor);
    if (!vendorScores[vendor]) {
      vendorScores[vendor] = { scores: [], total: 0, count: 0, tests: [] };
    }
    const score = calcTestScore(test);
    vendorScores[vendor].scores.push(score);
    vendorScores[vendor].total += score;
    vendorScores[vendor].count += 1;
    vendorScores[vendor].tests.push({ name: test.name, score });
  });

  // Get qualifying vendors (2+ tests) sorted by score for Top 3
  const qualifyingVendorsList = Object.entries(vendorScores)
    .filter(([_, data]) => data.count >= 2)
    .map(([vendor, data]) => ({
      vendor,
      avgScore: data.total / data.count,
      testCount: data.count,
      tests: data.tests
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const top3 = qualifyingVendorsList.slice(0, 3);

  // Data quality metrics - calculate fill rates for key fields
  const calcFillRate = (tests, checkFn) => {
    if (!tests || tests.length === 0) return 0;
    const filled = tests.filter(checkFn).length;
    return Math.round((filled / tests.length) * 100);
  };

  const dataQualityMetrics = [
    { label: 'List Price', rate: calcFillRate(allTests, t => hasValue(t.listPrice)), color: 'amber', description: 'published pricing' },
    { label: 'Sensitivity', rate: calcFillRate(allTests, t => hasValue(t.sensitivity)), color: 'emerald', description: 'detection rate' },
    { label: 'Specificity', rate: calcFillRate(allTests, t => hasValue(t.specificity)), color: 'emerald', description: 'true negative rate' },
    { label: 'TAT', rate: calcFillRate(allTests, t => hasValue(t.tat) || hasValue(t.initialTat)), color: 'sky', description: 'turnaround time' },
    { label: 'Publications', rate: calcFillRate(allTests, t => t.numPublications != null && t.numPublications > 0), color: 'violet', description: 'peer-reviewed' }
  ];

  // Calculate field average score (all qualifying vendors with 2+ tests)
  const qualifyingVendors = Object.entries(vendorScores).filter(([_, data]) => data.count >= 2);
  const fieldAvgScore = qualifyingVendors.length > 0 
    ? Math.round(qualifyingVendors.reduce((sum, [_, data]) => sum + (data.total / data.count), 0) / qualifyingVendors.length)
    : 0;

  const getBarColor = (color) => ({
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500'
  }[color] || 'bg-slate-500');

  const getTextColor = (color) => ({
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    sky: 'text-sky-600',
    violet: 'text-violet-600'
  }[color] || 'text-slate-600');

  // Green gradient styles for Top 3 (dark to light)
  const rankStyles = [
    { bg: 'bg-gradient-to-r from-emerald-100 to-emerald-50', border: 'border-emerald-500', text: 'text-emerald-800' },
    { bg: 'bg-gradient-to-r from-emerald-50 to-green-50', border: 'border-emerald-400', text: 'text-emerald-700' },
    { bg: 'bg-gradient-to-r from-green-50 to-teal-50', border: 'border-emerald-300', text: 'text-emerald-600' }
  ];

  return (
    <div className="bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl p-6">

      {/* Header with key stats */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-700">Data Openness Overview</h2>
        <div className="text-xs text-slate-500">Updated {BUILD_INFO.date.split(' ').slice(0, 2).join(' ')}</div>
      </div>

      {/* Top 3 Vendors Ranking - Horizontal */}
      {top3.length > 0 && (
        <div className="bg-white/40 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Top 3 Vendors by Data Openness</h3>
            <span className="text-[10px] text-slate-500">Min. 2 tests to qualify</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {top3.map((vendor, index) => (
              <div 
                key={vendor.vendor} 
                className={`flex items-center px-3 py-4 rounded-lg border ${rankStyles[index].bg} ${rankStyles[index].border}`}
              >
                <div className="w-16 flex-shrink-0 flex items-center justify-center">
                  <span className={`text-5xl font-bold ${rankStyles[index].text} opacity-40`}>{index + 1}</span>
                </div>
                <div className="flex flex-col items-center text-center flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${rankStyles[index].text} truncate w-full`}>{vendor.vendor}</p>
                  <p className="text-[10px] text-slate-500 mb-1">{vendor.testCount} tests</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-2xl font-bold ${rankStyles[index].text}`}>{Math.round(vendor.avgScore)}</span>
                    <span className="text-sm text-slate-400">vs</span>
                    <span className="text-xl font-bold text-slate-400">{fieldAvgScore}</span>
                    <span className="text-xs text-slate-400">(Avg)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-3">
              <span>{qualifyingVendors.length} vendors with 2+ tests</span>
              <span>•</span>
              <span>{DATABASE_CHANGELOG.length} changelog entries</span>
            </div>
            <button 
              onClick={() => setShowFAQ(!showFAQ)}
              className="text-xs text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1"
            >
              {showFAQ ? 'Hide' : 'Methodology'}
              <svg className={`w-3 h-3 transition-transform ${showFAQ ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {/* Methodology FAQ */}
          {showFAQ && (
            <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-700 space-y-3">
              <p className="text-xs text-slate-600">
                The Openness Score measures vendor data disclosure using <strong>category-normalized</strong> metrics. 
                Universal fields: <strong>Price (30%)</strong>, <strong>Publications (15%)</strong>, <strong>TAT (10%)</strong>, 
                <strong> Sample Info (10%)</strong>, <strong>Trial Participants (5%)</strong>. 
                Plus 30% for category-specific metrics (e.g., Sens/Spec for ECD/TRM, LOD for MRD, Genes/CDx for TDS). 
                Vendor scores are averaged across all their tests.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Data Completeness Section */}
      <div className="bg-white/40 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Data Completeness by Field</h3>
        <div className="space-y-3">
          {dataQualityMetrics.map(({ label, rate, color, description }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <span className="text-[10px] text-slate-400">{description}</span>
                </div>
                <span className={`text-sm font-bold ${getTextColor(color)}`}>{rate}%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getBarColor(color)} rounded-full transition-all duration-500`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-500 text-center">
          Completeness rates reflect publicly available data across {totalTests} tests from {allVendors.size} vendors.
        </p>
      </div>
    </div>
  );
};

export default DatabaseSummary;
