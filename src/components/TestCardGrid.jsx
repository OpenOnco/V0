/**
 * TestCardGrid - Quick Search + Test Cards Grid
 * 
 * This component displays:
 * 1. Quick Search input for filtering tests
 * 2. Sortable grid of test cards with badges
 * 
 * It does NOT include the LifecycleNavigator (2x2 category grid) -
 * that's rendered separately in the HomePage layout.
 * 
 * Props:
 * - onNavigate: function(category, testId) - called when a test card is clicked
 * - variant: 'rnd' | 'patient' - styling variant (default: 'rnd')
 */

import { useState, useMemo } from 'react';

// These will be passed as props or imported from data files
// For now, we'll export a factory function that takes dependencies

export const createTestCardGrid = ({
  mrdTestData,
  ecdTestData,
  cgpTestData,
  hctTestData,
  COMPANY_CONTRIBUTIONS,
  VENDOR_VERIFIED,
  MINIMUM_PARAMS,
  calculateTestCompleteness,
  colorClasses,
  VendorBadge
}) => {

  const TestCardGrid = ({ onNavigate, variant = 'rnd' }) => {
    const [sortBy, setSortBy] = useState('vendor');
    const [searchQuery, setSearchQuery] = useState('');

    // Combine tests with their category
    const baseTests = useMemo(() => {
      return [
        ...mrdTestData.map(t => ({ ...t, category: 'MRD', color: 'orange' })),
        ...ecdTestData.map(t => ({ ...t, category: 'ECD', color: 'emerald' })),
        ...cgpTestData.map(t => ({ ...t, category: 'CGP', color: 'violet' })),
        ...hctTestData.map(t => ({ ...t, category: 'HCT', color: 'rose' }))
      ];
    }, []);

    // Helper to count reimbursement entities
    const countReimbursement = (test) => {
      let count = 0;
      if (test.reimbursement) {
        const reimb = test.reimbursement.toLowerCase();
        if (reimb.includes('medicare') && !reimb.includes('not yet') && !reimb.includes('no established')) {
          count += 1;
        }
      }
      if (test.commercialPayers && test.commercialPayers.length > 0) {
        count += test.commercialPayers.length;
      }
      return count;
    };

    // Helper to calculate openness score - CATEGORY-NORMALIZED
    const calcOpenness = (test, category) => {
      const hasValue = (val) => val != null && val !== '' && val !== 'N/A';
      let score = 0;
      
      // UNIVERSAL FIELDS (70 pts max)
      if (hasValue(test.listPrice)) score += 30;
      if (test.numPublications != null && test.numPublications > 0) score += 15;
      if (hasValue(test.tat) || hasValue(test.initialTat)) score += 10;
      if (hasValue(test.bloodVolume) || hasValue(test.sampleType) || hasValue(test.sampleCategory)) score += 10;
      if (test.totalParticipants != null && test.totalParticipants > 0) score += 5;
      
      // CATEGORY-SPECIFIC FIELDS (30 pts max)
      const cat = category || test.category;
      switch (cat) {
        case 'ECD':
          if (hasValue(test.sensitivity)) score += 15;
          if (hasValue(test.specificity)) score += 15;
          break;
        case 'MRD':
          if (hasValue(test.lod) || hasValue(test.lod95)) score += 30;
          break;
        case 'HCT':
          if (hasValue(test.genesAnalyzed)) score += 30;
          break;
        case 'CGP':
          if (hasValue(test.genesAnalyzed)) score += 15;
          if (hasValue(test.tmb) || hasValue(test.msi)) score += 15;
          break;
        default:
          if (hasValue(test.sensitivity)) score += 15;
          if (hasValue(test.specificity)) score += 15;
      }
      
      return score;
    };

    // Count tests per vendor
    const vendorTestCounts = useMemo(() => {
      const counts = {};
      baseTests.forEach(t => {
        counts[t.vendor] = (counts[t.vendor] || 0) + 1;
      });
      return counts;
    }, [baseTests]);

    // Calculate vendor-level openness scores
    const vendorOpennessScores = useMemo(() => {
      const scores = {};
      const vendorData = {};
      baseTests.forEach(t => {
        if (!vendorData[t.vendor]) {
          vendorData[t.vendor] = { total: 0, count: 0 };
        }
        vendorData[t.vendor].total += calcOpenness(t);
        vendorData[t.vendor].count += 1;
      });
      Object.entries(vendorData).forEach(([vendor, data]) => {
        scores[vendor] = data.count >= 2 ? data.total / data.count : -1;
      });
      return scores;
    }, [baseTests]);

    // Get TAT value for sorting
    const getTat = (test) => {
      const tat = test.tat || test.initialTat || test.followUpTat;
      if (tat == null) return 999;
      const days = typeof tat === 'number' ? tat : parseInt(tat);
      return isNaN(days) ? 999 : days;
    };

    // Sort tests
    const allTests = useMemo(() => {
      const sorted = [...baseTests];
      const isBC = (test) => calculateTestCompleteness(test, test.category).percentage === 100;
      
      const prioritySort = (a, b) => {
        const aVerified = VENDOR_VERIFIED[a.id] !== undefined;
        const bVerified = VENDOR_VERIFIED[b.id] !== undefined;
        if (aVerified && !bVerified) return -1;
        if (!aVerified && bVerified) return 1;
        const aBC = isBC(a);
        const bBC = isBC(b);
        if (aBC && !bBC) return -1;
        if (!aBC && bBC) return 1;
        return 0;
      };
      
      switch (sortBy) {
        case 'category':
          const categoryOrder = { 'MRD': 0, 'ECD': 1, 'CGP': 2, 'HCT': 3, 'ALZ-BLOOD': 4 };
          return sorted.sort((a, b) => prioritySort(a, b) || (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99) || a.vendor.localeCompare(b.vendor));
        case 'tat':
          return sorted.sort((a, b) => prioritySort(a, b) || getTat(a) - getTat(b));
        case 'reimbursement':
          return sorted.sort((a, b) => prioritySort(a, b) || countReimbursement(b) - countReimbursement(a) || a.vendor.localeCompare(b.vendor));
        case 'vendorTests':
          return sorted.sort((a, b) => prioritySort(a, b) || vendorTestCounts[b.vendor] - vendorTestCounts[a.vendor] || a.vendor.localeCompare(b.vendor));
        case 'openness':
          return sorted.sort((a, b) => {
            const priority = prioritySort(a, b);
            if (priority !== 0) return priority;
            const scoreA = vendorOpennessScores[a.vendor] ?? -1;
            const scoreB = vendorOpennessScores[b.vendor] ?? -1;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return calcOpenness(b) - calcOpenness(a) || a.vendor.localeCompare(b.vendor);
          });
        case 'vendor':
        default:
          return sorted.sort((a, b) => prioritySort(a, b) || a.vendor.localeCompare(b.vendor) || a.name.localeCompare(b.name));
      }
    }, [sortBy, vendorTestCounts, vendorOpennessScores, baseTests]);

    // Filter tests
    const filteredTests = useMemo(() => {
      if (!searchQuery.trim()) return allTests;
      const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
      return allTests.filter(test => {
        const productTypeSearchable = test.productType === 'Laboratory IVD Kit' ? 'kit ivd laboratory' :
                                      test.productType === 'Self-Collection' ? 'self-collection home' :
                                      'service central lab';
        const searchableText = `${test.name} ${test.vendor} ${test.category} ${productTypeSearchable}`.toLowerCase();
        return terms.every(term => searchableText.includes(term));
      });
    }, [allTests, searchQuery]);

    // Get badge params for a test
    const getBadgeParams = (test) => {
      const badges = [];
      const formatPercent = (val) => {
        if (val == null) return null;
        if (typeof val === 'number') return `${val}%`;
        const str = String(val);
        if (str.length <= 10) return str.includes('%') ? str : `${str}%`;
        const match = str.match(/^[>≥~]?\d+(?:\.\d+)?%?/);
        return match ? (match[0].includes('%') ? match[0] : `${match[0]}%`) : null;
      };

      const sensDisplay = formatPercent(test.sensitivity);
      if (sensDisplay) badges.push({ label: 'Sens', value: sensDisplay, type: 'clinical' });
      const specDisplay = formatPercent(test.specificity);
      if (specDisplay) badges.push({ label: 'Spec', value: specDisplay, type: 'clinical' });
      
      const tat = test.tat || test.initialTat;
      if (tat != null) {
        const days = typeof tat === 'number' ? tat : parseInt(tat);
        if (!isNaN(days)) badges.push({ label: 'TAT', value: `${days}d`, type: 'operational' });
      }
      
      if (test.numPublications != null && test.numPublications > 0) {
        badges.push({ label: 'Pubs', value: test.numPublicationsPlus ? `${test.numPublications}+` : test.numPublications, type: 'clinical' });
      }
      
      return badges.slice(0, 3);
    };

    const isPatient = variant === 'patient';

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Quick Search */}
        <div className="p-4">
          {isPatient ? (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-base font-semibold text-gray-700 mb-2 text-center">
                If you're a DIY person, you can browse details on all {allTests.length} tests here:
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by test name, vendor, cancer type..."
                  className="w-full px-4 py-2.5 pl-10 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-red-100 to-red-200 rounded-xl p-3 border-2 border-red-300 shadow-sm hover:border-red-400 hover:shadow-md transition-all">
              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1.5 text-center">Quick Search</p>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name, vendor, cancer..."
                  className="w-full px-3 py-1.5 pl-8 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Test Cards Grid */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {searchQuery 
                ? `Search results (${filteredTests.length})` 
                : `All the tests we track (${allTests.length})`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 cursor-pointer hover:bg-slate-100"
              >
                <option value="vendor">Alphabetical</option>
                <option value="category">By Category</option>
                <option value="tat">By TAT (fastest)</option>
                <option value="reimbursement">By Coverage</option>
                <option value="vendorTests">By # Tests</option>
                <option value="openness">By Openness</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredTests.length === 0 && searchQuery && (
              <div className="col-span-full text-center py-8 text-slate-500">
                No test or vendor match found.
              </div>
            )}
            {filteredTests.map(test => {
              const badges = getBadgeParams(test);
              const colors = colorClasses[test.color];
              const isDiscontinued = test.isDiscontinued === true;
              const isRUO = test.isRUO === true;
              const hasCompanyComm = COMPANY_CONTRIBUTIONS[test.id] !== undefined;
              const hasVendorVerified = VENDOR_VERIFIED[test.id] !== undefined;
              const isBC = calculateTestCompleteness(test, test.category).percentage === 100;
              
              return (
                <div
                  key={test.id}
                  onClick={() => onNavigate(test.category, test.id)}
                  className={`relative ${colors.border} ${colors.bg} border rounded-lg p-2 cursor-pointer hover:shadow-md transition-all`}
                >
                  {/* Overlay text for special states */}
                  {isDiscontinued && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-gray-400/40 font-bold text-lg tracking-wider transform -rotate-12">DISCONTINUED</span>
                    </div>
                  )}
                  {isRUO && !isDiscontinued && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-amber-500/50 font-bold text-sm tracking-wider transform -rotate-12">RESEARCH ONLY</span>
                    </div>
                  )}
                  {!isBC && !isDiscontinued && !isRUO && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-red-400/40 font-bold text-lg tracking-wider transform -rotate-12">INCOMPLETE</span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isDiscontinued ? 'text-gray-400' : 'text-slate-800'}`}>{test.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{test.vendor}<VendorBadge vendor={test.vendor} size="xs" /></p>
                    </div>
                    {isDiscontinued ? (
                      <span className="bg-gray-200 text-gray-600 text-[9px] px-1 py-0.5 rounded font-medium ml-1 flex-shrink-0">DISC</span>
                    ) : (
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                        {hasVendorVerified && (
                          <div className="relative group flex items-center">
                            <span className="inline-flex items-center bg-emerald-500 text-white text-[9px] px-1 rounded font-bold cursor-help h-[18px] animate-pulse shadow-sm">
                              ✓ VENDOR VERIFIED
                            </span>
                            <div className="absolute right-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                              <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Verified</p>
                              <p className="font-medium">{VENDOR_VERIFIED[test.id].name}</p>
                              <p className="text-gray-300">{VENDOR_VERIFIED[test.id].company}</p>
                              <p className="text-gray-400 text-[9px]">{VENDOR_VERIFIED[test.id].verifiedDate}</p>
                            </div>
                          </div>
                        )}
                        {hasCompanyComm && !hasVendorVerified && (
                          <div className="relative group flex items-center">
                            <span className="inline-flex items-center bg-emerald-100 text-emerald-700 text-[9px] px-1 rounded font-medium cursor-help h-[18px]">
                              ✓ VENDOR INPUT
                            </span>
                            <div className="absolute right-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                              <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Input</p>
                              <p className="font-medium">{COMPANY_CONTRIBUTIONS[test.id].name}</p>
                              <p className="text-gray-300">{COMPANY_CONTRIBUTIONS[test.id].company}</p>
                              <p className="text-gray-400 text-[9px]">{COMPANY_CONTRIBUTIONS[test.id].date}</p>
                            </div>
                          </div>
                        )}
                        {test.productType === 'Laboratory IVD Kit' && (
                          <span className="inline-flex items-center bg-indigo-100 text-indigo-700 text-[9px] px-1 rounded font-medium h-[18px]" title="Laboratory IVD Kit">🔬Kit</span>
                        )}
                        {test.productType === 'Self-Collection' && (
                          <span className="inline-flex items-center bg-teal-100 text-teal-700 text-[9px] px-1 rounded font-medium h-[18px]" title="Self-Collection">🏠Home</span>
                        )}
                        <span className={`inline-flex items-center ${colors.badge} text-white text-[9px] px-1 rounded font-medium h-[18px]`}>{test.category}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {badges.map((badge, idx) => (
                      <span 
                        key={idx}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          badge.type === 'clinical' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {badge.label}: {badge.value}
                      </span>
                    ))}
                    {badges.length === 0 && (
                      <span className="text-[10px] text-slate-400">No data</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compact Legend */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-2 border-t border-slate-200 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="bg-indigo-100 text-indigo-700 px-1 rounded">🔬Kit</span>
              <span className="text-slate-500">IVD Kit</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-teal-100 text-teal-700 px-1 rounded">🏠Home</span>
              <span className="text-slate-500">Self-Collect</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span className="text-slate-500">ECD</span></span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span><span className="text-slate-500">CGP</span></span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span><span className="text-slate-500">MRD</span></span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span className="text-slate-500">HCT</span></span>
          </div>
        </div>
      </div>
    );
  };

  return TestCardGrid;
};

export default createTestCardGrid;
