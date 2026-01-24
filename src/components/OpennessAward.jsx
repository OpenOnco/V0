import { useState } from 'react';
import { useAllTests } from '../dal/hooks/useTests';

const OpennessAward = () => {
  const [showFAQ, setShowFAQ] = useState(false);
  const { tests: allTests, loading } = useAllTests();

  // Tests from DAL already have category field assigned
  
  // Helper functions
  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';

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
      case 'HCT':
        // HCT: Gene count is key for hereditary testing
        if (hasValue(test.genesAnalyzed)) score += 30;
        break;
      case 'CGP':
        // CGP: Panel size + biomarker reporting (TMB/MSI) - all CGP tests have these
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

  // Get qualifying vendors (2+ tests) sorted by score
  const qualifyingVendors = Object.entries(vendorScores)
    .filter(([_, data]) => data.count >= 2)
    .map(([vendor, data]) => ({
      vendor,
      avgScore: data.total / data.count,
      testCount: data.count,
      tests: data.tests
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const top3 = qualifyingVendors.slice(0, 3);
  
  // Calculate field average score
  const fieldAvgScore = qualifyingVendors.length > 0 
    ? Math.round(qualifyingVendors.reduce((sum, v) => sum + v.avgScore, 0) / qualifyingVendors.length)
    : 0;

  // Don't render until we have data
  if (loading || top3.length === 0) return null;

  const rankStyles = [
    { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-500', icon: '🥇' },
    { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600', badge: 'bg-slate-400', icon: '🥈' },
    { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-400', icon: '🥉' }
  ];

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Top 3 Vendors by Data Openness</h3>
        <span className="text-[10px] text-slate-500">Min. 2 tests to qualify</span>
      </div>
      
      {/* Top 3 Ranking */}
      <div className="space-y-2">
        {top3.map((vendor, index) => (
          <div 
            key={vendor.vendor} 
            className={`flex items-center gap-3 p-2.5 rounded-lg border ${rankStyles[index].bg} ${rankStyles[index].border}`}
          >
            <span className="text-xl">{rankStyles[index].icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${rankStyles[index].text} truncate`}>{vendor.vendor}</p>
              <p className="text-[10px] text-slate-500">{vendor.testCount} tests</p>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-white text-sm font-bold ${rankStyles[index].badge}`}>
              {Math.round(vendor.avgScore)}
            </div>
          </div>
        ))}
      </div>
      
      {/* Field average comparison */}
      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Field average: <span className="font-semibold text-slate-700">{fieldAvgScore}</span> across {qualifyingVendors.length} qualifying vendors
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
      
      {/* FAQ Section */}
      {showFAQ && (
        <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-700 space-y-4">
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">What is the Openness Score?</h4>
            <p className="text-xs text-slate-600">
              The OpenOnco Openness Score measures how completely vendors disclose key information about their tests. 
              It rewards vendors who publish pricing, performance data, and clinical evidence—information that helps 
              patients and clinicians make informed decisions.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">How is it calculated?</h4>
            <p className="text-xs text-slate-600 mb-2">Each test is scored based on disclosure of key fields (weights sum to 100):</p>
            <div className="bg-white/60 rounded-lg p-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 pr-4 font-semibold text-slate-700">Field</th>
                    <th className="text-center py-1.5 px-2 font-semibold text-slate-700">Weight</th>
                    <th className="text-left py-1.5 pl-4 font-semibold text-slate-700">Why it matters</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 font-medium">List Price</td>
                    <td className="text-center py-1.5 px-2 font-bold text-amber-600">30%</td>
                    <td className="py-1.5 pl-4">Most critical for access decisions</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 font-medium">Sensitivity</td>
                    <td className="text-center py-1.5 px-2 font-bold text-amber-600">15%</td>
                    <td className="py-1.5 pl-4">Detection rate / true positive rate</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 font-medium">Specificity</td>
                    <td className="text-center py-1.5 px-2 font-bold text-amber-600">15%</td>
                    <td className="py-1.5 pl-4">Reduces unnecessary follow-ups</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 font-medium">Publications</td>
                    <td className="text-center py-1.5 px-2 font-bold text-amber-600">15%</td>
                    <td className="py-1.5 pl-4">Evidence of independent validation</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 font-medium">Turnaround Time</td>
                    <td className="text-center py-1.5 px-2 font-bold text-amber-600">10%</td>
                    <td className="py-1.5 pl-4">Practical info for clinicians</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 font-medium">Sample Info</td>
                    <td className="text-center py-1.5 px-2 font-bold text-amber-600">10%</td>
                    <td className="py-1.5 pl-4">Blood volume, sample type, or category</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-4 font-medium">Trial Participants</td>
                    <td className="text-center py-1.5 px-2 font-bold text-amber-600">5%</td>
                    <td className="py-1.5 pl-4">Clinical evidence depth</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="py-1.5 pr-4 font-bold text-slate-800">Total</td>
                    <td className="text-center py-1.5 px-2 font-bold text-slate-800">100%</td>
                    <td className="py-1.5 pl-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Who is eligible?</h4>
            <p className="text-xs text-slate-600">
              Vendors must have <strong>2 or more tests</strong> in the OpenOnco database to qualify for ranking. 
              The vendor's score is the <strong>average</strong> across all their tests. This prevents a single 
              well-documented test from dominating while encouraging comprehensive disclosure across product portfolios.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">How can vendors improve their score?</h4>
            <p className="text-xs text-slate-600">
              Publish your list price, disclose sensitivity and specificity from validation studies, maintain an 
              active publication record, and provide clear sample requirements. Vendors can submit updated information 
              through our Submissions page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpennessAward;
