import React, { useState, useMemo } from 'react';
import { track } from '@vercel/analytics';
import {
  mrdTestData,
  ecdTestData,
  trmTestData,
  tdsTestData,
  DOMAINS,
  getDomain,
  COMPANY_CONTRIBUTIONS,
  VENDOR_VERIFIED,
} from '../../data';
import { calculateTestCompleteness } from '../../utils/testMetrics';
import VendorBadge from '../badges/VendorBadge';
import { LifecycleNavigator } from '../navigation';
import PerformanceMetricWithWarning from '../ui/PerformanceMetricWithWarning';

// Placeholder for ALZ data (disabled)
const alzBloodTestData = [];

const TestShowcase = ({ 
  onNavigate, 
  patientMode = false, 
  hideNavigator = false, 
  showQuickSearch = true,
  searchQuery: externalSearchQuery,
  setSearchQuery: externalSetSearchQuery
}) => {
  const [selectedTest, setSelectedTest] = useState(null);
  const [sortBy, setSortBy] = useState('vendor');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  // Use external state if provided, otherwise use internal state
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalSetSearchQuery || setInternalSearchQuery;

  // Get current domain for filtering
  const currentDomain = getDomain();
  
  // Get dynamic test counts
  const testCounts = {
    ECD: typeof ecdTestData !== 'undefined' ? ecdTestData.length : 13,
    TDS: typeof tdsTestData !== 'undefined' ? tdsTestData.length : 14,
    TRM: typeof trmTestData !== 'undefined' ? trmTestData.length : 11,
    MRD: typeof mrdTestData !== 'undefined' ? mrdTestData.length : 18,
    'ALZ-BLOOD': typeof alzBloodTestData !== 'undefined' ? alzBloodTestData.length : 9,
  };

  // Combine tests with their category, filtered by domain
  const baseTests = useMemo(() => {
    if (currentDomain === DOMAINS.ALZ) {
      return alzBloodTestData.map(t => ({ ...t, category: 'ALZ-BLOOD', color: 'indigo' }));
    }
    // Default: oncology domain
    return [
      ...mrdTestData.map(t => ({ ...t, category: 'MRD', color: 'orange' })),
      ...ecdTestData.map(t => ({ ...t, category: 'ECD', color: 'emerald' })),
      ...trmTestData.map(t => ({ ...t, category: 'TRM', color: 'sky' })),
      ...tdsTestData.map(t => ({ ...t, category: 'TDS', color: 'violet' }))
    ];
  }, [currentDomain]);

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
  // Each category has different "standard" metrics, so we normalize accordingly
  const calcOpenness = (test, category) => {
    const hasValue = (val) => val != null && val !== '' && val !== 'N/A';
    let score = 0;
    let maxScore = 100;
    
    // UNIVERSAL FIELDS (70 pts max across all categories)
    if (hasValue(test.listPrice)) score += 30;  // Gold standard - hardest to find
    if (test.numPublications != null && test.numPublications > 0) score += 15;
    if (hasValue(test.tat) || hasValue(test.initialTat)) score += 10;
    if (hasValue(test.bloodVolume) || hasValue(test.sampleType) || hasValue(test.sampleCategory)) score += 10;
    if (test.totalParticipants != null && test.totalParticipants > 0) score += 5;
    
    // CATEGORY-SPECIFIC FIELDS (30 pts max - metrics that ALL tests in category can have)
    const cat = category || test.category;
    switch (cat) {
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

  // Count tests per vendor
  const vendorTestCounts = useMemo(() => {
    const counts = {};
    baseTests.forEach(t => {
      counts[t.vendor] = (counts[t.vendor] || 0) + 1;
    });
    return counts;
  }, [baseTests]);

  // Calculate vendor-level openness scores (for ranking sort)
  // Matches the logic in DatabaseSummary - vendors with 2+ tests get ranked, single-test vendors go to bottom
  const vendorOpennessScores = useMemo(() => {
    const scores = {};
    const vendorData = {};
    // Aggregate scores by vendor
    baseTests.forEach(t => {
      if (!vendorData[t.vendor]) {
        vendorData[t.vendor] = { total: 0, count: 0 };
      }
      vendorData[t.vendor].total += calcOpenness(t);
      vendorData[t.vendor].count += 1;
    });
    // Calculate average score - only vendors with 2+ tests qualify
    Object.entries(vendorData).forEach(([vendor, data]) => {
      if (data.count >= 2) {
        scores[vendor] = data.total / data.count;
      } else {
        scores[vendor] = -1; // Single-test vendors go to bottom
      }
    });
    return scores;
  }, [baseTests]);

  // Get TAT value for sorting
  const getTat = (test) => {
    const tat = test.tat || test.initialTat || test.followUpTat;
    if (tat == null) return 999; // No TAT = sort to end
    const days = typeof tat === 'number' ? tat : parseInt(tat);
    return isNaN(days) ? 999 : days;
  };

  // Sort tests based on selected option - non-BC (MISS) tests always at end
  const allTests = useMemo(() => {
    const sorted = [...baseTests];
    
    // Helper to check if test is BC (Baseline Complete)
    const isBC = (test) => calculateTestCompleteness(test, test.category).percentage === 100;
    
    // Priority order: 1) VENDOR VERIFIED, 2) BC tests, 3) Non-BC tests
    const prioritySort = (a, b) => {
      const aVerified = VENDOR_VERIFIED[a.id] !== undefined;
      const bVerified = VENDOR_VERIFIED[b.id] !== undefined;
      // VENDOR VERIFIED tests always come first
      if (aVerified && !bVerified) return -1;
      if (!aVerified && bVerified) return 1;
      
      // Then BC tests
      const aBC = isBC(a);
      const bBC = isBC(b);
      if (aBC && !bBC) return -1;
      if (!aBC && bBC) return 1;
      return 0;
    };
    
    switch (sortBy) {
      case 'category':
        const categoryOrder = { 'MRD': 0, 'ECD': 1, 'TRM': 2, 'TDS': 3, 'ALZ-BLOOD': 4 };
        return sorted.sort((a, b) => prioritySort(a, b) || (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99) || a.vendor.localeCompare(b.vendor));
      case 'tat':
        return sorted.sort((a, b) => prioritySort(a, b) || getTat(a) - getTat(b));
      case 'reimbursement':
        return sorted.sort((a, b) => prioritySort(a, b) || countReimbursement(b) - countReimbursement(a) || a.vendor.localeCompare(b.vendor));
      case 'vendorTests':
        return sorted.sort((a, b) => prioritySort(a, b) || vendorTestCounts[b.vendor] - vendorTestCounts[a.vendor] || a.vendor.localeCompare(b.vendor));
      case 'openness':
        // Sort by vendor openness ranking (same as openness award logic)
        // Vendors with 2+ tests get ranked by average score, single-test vendors go to bottom
        return sorted.sort((a, b) => {
          const priority = prioritySort(a, b);
          if (priority !== 0) return priority;
          const scoreA = vendorOpennessScores[a.vendor] ?? -1;
          const scoreB = vendorOpennessScores[b.vendor] ?? -1;
          if (scoreA !== scoreB) return scoreB - scoreA;
          // Within same vendor score, sort by individual test score
          return calcOpenness(b) - calcOpenness(a) || a.vendor.localeCompare(b.vendor);
        });
      case 'vendor':
      default:
        // Sort alphabetically by vendor name, then by test name
        return sorted.sort((a, b) => prioritySort(a, b) || a.vendor.localeCompare(b.vendor) || a.name.localeCompare(b.name));
    }
  }, [sortBy, vendorTestCounts, vendorOpennessScores, baseTests]);

  // Filter tests based on search query (supports multi-word: "exact ecd" matches Exact Sciences ECD tests)
  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return allTests;
    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    return allTests.filter(test => {
      // Include productType in search - "kit" finds all IVD kits, "service" finds central lab services
      const productTypeSearchable = test.productType === 'Laboratory IVD Kit' ? 'kit ivd laboratory' :
                                    test.productType === 'Self-Collection' ? 'self-collection home' :
                                    'service central lab';
      // Include cancer types in search - "prostate" finds tests for prostate cancer
      const cancerTypesSearchable = Array.isArray(test.cancerTypes) ? test.cancerTypes.join(' ') : (test.cancerTypes || '');
      const searchableText = `${test.name} ${test.vendor} ${test.category} ${productTypeSearchable} ${cancerTypesSearchable}`.toLowerCase();
      return terms.every(term => searchableText.includes(term));
    });
  }, [allTests, searchQuery]);

  // Get patient-friendly parameters
  const getPatientParams = (test) => {
    const params = [];
    
    // Reimbursement status - most important for patients
    if (test.reimbursement) {
      const reimb = test.reimbursement.toLowerCase();
      if (reimb.includes('medicare') && !reimb.includes('not yet') && !reimb.includes('no established')) {
        if (test.commercialPayers && test.commercialPayers.length > 0) {
          params.push({ label: 'Insurance', value: '✓ Medicare + Private', type: 'good' });
        } else {
          params.push({ label: 'Insurance', value: '✓ Medicare', type: 'good' });
        }
      } else if (test.commercialPayers && test.commercialPayers.length > 0) {
        params.push({ label: 'Insurance', value: '✓ Some Private', type: 'neutral' });
      } else if (reimb.includes('emerging') || reimb.includes('varies')) {
        params.push({ label: 'Insurance', value: 'Check coverage', type: 'neutral' });
      } else {
        params.push({ label: 'Insurance', value: 'Ask provider', type: 'neutral' });
      }
    }
    
    // Price if available (mainly ECD tests)
    if (test.listPrice != null) {
      params.push({ label: 'List Price', value: `$${test.listPrice.toLocaleString()}`, type: 'neutral' });
    } else if (test.medicareRate != null) {
      params.push({ label: 'Medicare Rate', value: `$${test.medicareRate.toLocaleString()}`, type: 'neutral' });
    }
    
    // Blood-only vs requires tissue
    if (test.approach === 'Tumor-naïve' || test.requiresTumorTissue === 'No') {
      params.push({ label: 'Sample', value: 'Blood only', type: 'good' });
    } else if (test.approach === 'Tumor-informed' || test.requiresTumorTissue === 'Yes') {
      params.push({ label: 'Sample', value: 'Blood + tissue', type: 'neutral' });
    }
    
    // Wait time
    const tat = test.tat || test.initialTat || test.followUpTat;
    if (tat != null) {
      const days = typeof tat === 'number' ? tat : parseInt(tat);
      if (!isNaN(days)) {
        params.push({ label: 'Results in', value: `~${days} days`, type: 'neutral' });
      }
    }
    
    // Cancer types covered
    if (test.cancerTypes && test.cancerTypes.length > 0) {
      const count = test.cancerTypes.length;
      if (test.testScope?.includes('Multi-cancer') || count > 5) {
        params.push({ label: 'Screens for', value: 'Multiple cancers', type: 'good' });
      } else if (count === 1) {
        const cancer = test.cancerTypes[0].split(/[;,]/)[0].trim();
        params.push({ label: 'For', value: cancer.length > 15 ? cancer.slice(0,15) + '...' : cancer, type: 'neutral' });
      } else {
        params.push({ label: 'Covers', value: `${count} cancer types`, type: 'neutral' });
      }
    }
    
    // FDA status in simple terms
    if (test.fdaStatus) {
      const fda = test.fdaStatus.toLowerCase();
      if (fda.includes('fda approved') || fda.includes('fda-approved')) {
        params.push({ label: 'FDA', value: '✓ Approved', type: 'good' });
      } else if (fda.includes('breakthrough')) {
        params.push({ label: 'FDA', value: 'Fast-tracked', type: 'neutral' });
      }
    }
    
    return params.length > 0 ? params : [{ label: 'Category', value: test.category, type: 'neutral' }];
  };

  // Get numerical parameters for a test (clinician/academic view)
  const getParams = (test) => {
    const params = [];
    
    // Helper to extract just the number from a value that might have notes
    const extractNumber = (val) => {
      if (val == null) return null;
      if (typeof val === 'number') return val;
      const match = String(val).match(/^[~]?[\d.]+/);
      return match ? match[0] : null;
    };
    
    // Helper to format percent values - truncate long strings
    const formatPercent = (val) => {
      if (val == null) return null;
      if (typeof val === 'number') return `${val}%`;
      const str = String(val);
      if (str.length <= 10) return str.includes('%') ? str : `${str}%`;
      const match = str.match(/^[>≥~]?\d+(?:\.\d+)?%?/);
      return match ? (match[0].includes('%') ? match[0] : `${match[0]}%`) : null;
    };
    
    // Clinical parameters (from patient studies)
    const sensDisplay = formatPercent(test.sensitivity);
    if (sensDisplay) params.push({ label: 'Sensitivity', value: sensDisplay, type: 'clinical' });
    const specDisplay = formatPercent(test.specificity);
    if (specDisplay) params.push({ label: 'Specificity', value: specDisplay, type: 'clinical' });
    if (test.ppv != null) params.push({ label: 'PPV', value: `${test.ppv}%`, type: 'clinical' });
    if (test.npv != null) params.push({ label: 'NPV', value: `${test.npv}%`, type: 'clinical' });
    if (test.stageISensitivity != null) params.push({ label: 'Stage I Sens.', value: `${test.stageISensitivity}%`, type: 'clinical' });
    if (test.stageIISensitivity != null) params.push({ label: 'Stage II Sens.', value: `${test.stageIISensitivity}%`, type: 'clinical' });
    
    const leadTime = extractNumber(test.leadTimeVsImaging);
    if (leadTime != null) params.push({ label: 'Early Warning vs Imaging', value: `${leadTime} days`, type: 'clinical' });
    
    // Trial/publication parameters (evidence base)
    if (test.totalParticipants != null && test.totalParticipants > 0) params.push({ label: 'Trial Participants', value: test.totalParticipants.toLocaleString(), type: 'clinical' });
    if (test.numPublications != null && test.numPublications > 0) params.push({ label: 'Publications', value: test.numPublicationsPlus ? `${test.numPublications}+` : test.numPublications, type: 'clinical' });
    
    // Analytical parameters (lab validation)
    if (test.lod != null) params.push({ label: 'LOD', value: test.lod, type: 'analytical' });
    if (test.variantsTracked != null && typeof test.variantsTracked === 'number') params.push({ label: 'Variants Tracked', value: test.variantsTracked, type: 'analytical' });
    
    // Cancer coverage
    if (test.cancerTypes != null && test.cancerTypes.length > 0) params.push({ label: 'Cancer Types', value: test.cancerTypes.length, type: 'analytical' });
    
    // Operational parameters (logistics/specs)
    const initialTat = extractNumber(test.initialTat);
    const followUpTat = extractNumber(test.followUpTat);
    const tat = extractNumber(test.tat);
    
    if (initialTat != null) params.push({ label: 'Initial TAT', value: `${initialTat} days`, type: 'operational' });
    if (followUpTat != null) params.push({ label: 'Follow-up TAT', value: `${followUpTat} days`, type: 'operational' });
    if (tat != null && initialTat == null) params.push({ label: 'TAT', value: `${tat} days`, type: 'operational' });
    
    if (test.listPrice != null) {
      params.push({ label: 'List Price', value: `$${test.listPrice.toLocaleString()}`, type: 'operational' });
    } else if (test.medicareRate != null) {
      params.push({ label: 'Medicare Rate', value: `$${test.medicareRate.toLocaleString()}`, type: 'operational' });
    }
    if (test.bloodVolume != null) params.push({ label: 'Blood Volume', value: `${test.bloodVolume} mL`, type: 'operational' });
    if (test.cancersDetected != null && typeof test.cancersDetected === 'number') params.push({ label: 'Cancers Detected', value: test.cancersDetected, type: 'operational' });
    
    return params.length > 0 ? params : [{ label: 'Category', value: test.category, type: 'operational' }];
  };

  // Color classes for parameter types
  const paramTypeColors = {
    clinical: 'text-emerald-600',    // Green - validated in patient studies
    analytical: 'text-violet-600',   // Purple - lab/bench validation
    operational: 'text-slate-600',   // Gray - logistics/specs
    good: 'text-emerald-600',        // Patient: positive indicator
    neutral: 'text-slate-600'        // Patient: neutral indicator
  };
  // Static badge params - get top 2-3 key metrics for each test
  const getBadgeParams = (test) => {
    const badges = [];
    
    // Helper to format sensitivity/specificity - truncate long strings
    const formatPercent = (val) => {
      if (val == null) return null;
      if (typeof val === 'number') return `${val}%`;
      // If it's a string, check if it starts with a number or >/>= symbol
      const str = String(val);
      // If it's a short value (like "95" or ">99%"), use it directly
      if (str.length <= 10) return str.includes('%') ? str : `${str}%`;
      // For long strings, extract first number/percentage
      const match = str.match(/^[>≥~]?\d+(?:\.\d+)?%?/);
      return match ? (match[0].includes('%') ? match[0] : `${match[0]}%`) : null;
    };
    
    // Sensitivity (most important clinical metric)
    const sensDisplay = formatPercent(test.sensitivity);
    if (sensDisplay) {
      badges.push({ label: 'Sens', value: sensDisplay, type: 'clinical' });
    }
    
    // Specificity
    const specDisplay = formatPercent(test.specificity);
    if (specDisplay) {
      badges.push({ label: 'Spec', value: specDisplay, type: 'clinical' });
    }
    
    // TAT
    const tat = test.tat || test.initialTat;
    if (tat != null) {
      const days = typeof tat === 'number' ? tat : parseInt(tat);
      if (!isNaN(days)) badges.push({ label: 'TAT', value: `${days}d`, type: 'operational' });
    }
    
    // Publications
    if (test.numPublications != null && test.numPublications > 0) {
      badges.push({ label: 'Pubs', value: test.numPublications, type: 'clinical' });
    }
    
    // Price (list price preferred, Medicare rate as fallback)
    if (test.listPrice != null) {
      badges.push({ label: '$', value: `${(test.listPrice/1000).toFixed(1)}k`, type: 'operational' });
    } else if (test.medicareRate != null) {
      badges.push({ label: '~$', value: `${(test.medicareRate/1000).toFixed(1)}k`, type: 'operational' });
    }
    
    // Return top 3 badges max
    return badges.slice(0, 3);
  };

  // Patient-friendly static badges
  const getPatientBadges = (test) => {
    const badges = [];
    
    // Insurance coverage (most important for patients)
    const reimb = test.reimbursement?.toLowerCase() || '';
    const hasMedicare = reimb.includes('medicare') && !reimb.includes('not yet');
    const hasPrivate = test.commercialPayers && test.commercialPayers.length > 0;
    
    if (hasMedicare && hasPrivate) {
      badges.push({ label: '✓', value: 'Medicare + Private', type: 'good' });
    } else if (hasMedicare) {
      badges.push({ label: '✓', value: 'Medicare', type: 'good' });
    } else if (hasPrivate) {
      badges.push({ label: '~', value: 'Some Insurance', type: 'neutral' });
    }
    
    // TAT
    const tat = test.tat || test.initialTat;
    if (tat != null) {
      const days = typeof tat === 'number' ? tat : parseInt(tat);
      if (!isNaN(days)) badges.push({ label: '⏱', value: `${days} days`, type: 'neutral' });
    }
    
    // Sample type
    if (test.approach === 'Tumor-naïve' || test.requiresTumorTissue === 'No') {
      badges.push({ label: '💉', value: 'Blood only', type: 'good' });
    }
    
    return badges.slice(0, 3);
  };

  const colorClasses = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500', text: 'text-orange-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-500', text: 'text-emerald-600' },
    red: { bg: 'bg-sky-100', border: 'border-sky-300', badge: 'bg-sky-500', text: 'text-sky-600' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-500', text: 'text-sky-600' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-500', text: 'text-violet-600' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-500', text: 'text-indigo-600' }
  };

  // Category button config for non-patient view
  const categoryButtons = [
    { id: 'ECD', name: 'Early Cancer Detection', phase: 'Healthy / Screening', icon: '🔬', color: 'emerald' },
    { id: 'TDS', name: 'Treatment Decision Support', phase: 'Newly Diagnosed', icon: '🧬', color: 'violet' },
    { id: 'TRM', name: 'Treatment Response Monitoring', phase: 'Active Treatment', icon: '📊', color: 'sky' },
    { id: 'MRD', name: 'Minimal Residual Disease', phase: 'Surveillance', icon: '🎯', color: 'orange' },
  ];

  const categoryColorClasses = {
    emerald: { bg: 'bg-emerald-50', bgHover: 'hover:bg-emerald-100', border: 'border-emerald-200', borderHover: 'hover:border-emerald-400', text: 'text-emerald-700', iconBg: 'bg-emerald-500' },
    violet: { bg: 'bg-violet-50', bgHover: 'hover:bg-violet-100', border: 'border-violet-200', borderHover: 'hover:border-violet-400', text: 'text-violet-700', iconBg: 'bg-violet-500' },
    sky: { bg: 'bg-sky-50', bgHover: 'hover:bg-sky-100', border: 'border-sky-200', borderHover: 'hover:border-sky-400', text: 'text-sky-700', iconBg: 'bg-sky-500' },
    orange: { bg: 'bg-orange-50', bgHover: 'hover:bg-orange-100', border: 'border-orange-200', borderHover: 'hover:border-orange-400', text: 'text-orange-700', iconBg: 'bg-orange-500' },
  };

  // ========== PATIENT MODE: Simple search + grid only (same cards as R&D) ==========
  if (patientMode) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search Box - Bland/neutral styling */}
        <div className="p-4">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-base font-semibold text-gray-700 mb-2 text-center">If you're a DIY person, you can browse details on all {allTests.length} tests here:</p>
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
        </div>

        {/* Test Cards Grid - Same as R&D */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {searchQuery 
                ? `Search results (${filteredTests.length})` 
                : `All tests (${allTests.length})`}
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
                  {/* DISCONTINUED text overlay */}
                  {isDiscontinued && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-gray-400/40 font-bold text-lg tracking-wider transform -rotate-12">
                        DISCONTINUED
                      </span>
                    </div>
                  )}
                  {/* RUO (Research Use Only) text overlay */}
                  {isRUO && !isDiscontinued && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-amber-500/50 font-bold text-sm tracking-wider transform -rotate-12">
                        RESEARCH ONLY
                      </span>
                    </div>
                  )}
                  {/* INCOMPLETE text overlay for non-BC tests */}
                  {!isBC && !isDiscontinued && !isRUO && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-red-400/40 font-bold text-lg tracking-wider transform -rotate-12">
                        INCOMPLETE
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isDiscontinued ? 'text-gray-400' : 'text-slate-800'}`}>{test.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{test.vendor}<VendorBadge vendor={test.vendor} size="xs" /></p>
                    </div>
                    {isDiscontinued ? (
                      <span className="bg-gray-200 text-gray-600 text-[9px] px-1 py-0.5 rounded font-medium ml-1 flex-shrink-0">
                        DISC
                      </span>
                    ) : (
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                        {/* VENDOR VERIFIED badge - green, pulsing */}
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
                        {/* INPUT badge - light green (only if not verified) */}
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
                        {/* Kit/Service badge */}
                        {test.productType === 'Laboratory IVD Kit' ? (
                          <span className="inline-flex items-center bg-indigo-100 text-indigo-700 text-[9px] px-1 rounded font-medium h-[18px]" title="Laboratory IVD Kit">
                            🔬Kit
                          </span>
                        ) : test.productType === 'Self-Collection' ? (
                          <span className="inline-flex items-center bg-teal-100 text-teal-700 text-[9px] px-1 rounded font-medium h-[18px]" title="Self-Collection">
                            🏠Home
                          </span>
                        ) : null}
                        {/* Category badge */}
                        <span className={`inline-flex items-center ${colors.badge} text-white text-[9px] px-1 rounded font-medium h-[18px]`}>
                          {test.category}
                        </span>
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
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-500">ECD</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
              <span className="text-slate-500">TDS</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              <span className="text-slate-500">TRM</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              <span className="text-slate-500">MRD</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ========== CLINICIAN/ACADEMIC VIEW: Categories + Chat + Search ==========
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Lifecycle Navigator - can be hidden when rendered separately */}
      {!hideNavigator && (
        <div className="p-4">
          <h3 className="text-lg font-bold text-slate-800 mb-3 text-center">Click on a Test Category to see Details and do Comparisons:</h3>
          <LifecycleNavigator onNavigate={onNavigate} />
        </div>
      )}


      {/* Quick Search - Full Width Below (only if not hidden) */}
      {showQuickSearch && (
        <div className={`px-4 ${hideNavigator ? 'pt-4' : ''} pb-4`}>
          <div className="bg-gradient-to-br from-red-100 to-red-200 rounded-xl p-3 border-2 border-red-300 shadow-sm hover:border-red-400 hover:shadow-md transition-all cursor-pointer">
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
        </div>
      )}


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
                {/* DISCONTINUED text overlay */}
                {isDiscontinued && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-gray-400/40 font-bold text-lg tracking-wider transform -rotate-12">
                      DISCONTINUED
                    </span>
                  </div>
                )}
                {/* RUO (Research Use Only) text overlay */}
                {isRUO && !isDiscontinued && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-amber-500/50 font-bold text-sm tracking-wider transform -rotate-12">
                      RESEARCH ONLY
                    </span>
                  </div>
                )}
                {/* INCOMPLETE text overlay for non-BC tests */}
                {!isBC && !isDiscontinued && !isRUO && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-red-400/40 font-bold text-lg tracking-wider transform -rotate-12">
                      INCOMPLETE
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDiscontinued ? 'text-gray-400' : 'text-slate-800'}`}>{test.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{test.vendor}<VendorBadge vendor={test.vendor} size="xs" /></p>
                  </div>
                  {isDiscontinued ? (
                    <span className="bg-gray-200 text-gray-600 text-[9px] px-1 py-0.5 rounded font-medium ml-1 flex-shrink-0">
                      DISC
                    </span>
                  ) : (
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                      {/* VENDOR VERIFIED badge - green, pulsing */}
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
                      {/* INPUT badge - light green (only if not verified) */}
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
                      {/* Kit/Service badge */}
                      {test.productType === 'Laboratory IVD Kit' ? (
                        <span className="inline-flex items-center bg-indigo-100 text-indigo-700 text-[9px] px-1 rounded font-medium h-[18px]" title="Laboratory IVD Kit">
                          🔬Kit
                        </span>
                      ) : test.productType === 'Self-Collection' ? (
                        <span className="inline-flex items-center bg-teal-100 text-teal-700 text-[9px] px-1 rounded font-medium h-[18px]" title="Self-Collection">
                          🏠Home
                        </span>
                      ) : null}
                      {/* Category badge */}
                      <span className={`inline-flex items-center ${colors.badge} text-white text-[9px] px-1 rounded font-medium h-[18px]`}>
                        {test.category}
                      </span>
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
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-500">ECD</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
            <span className="text-slate-500">TDS</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span className="text-slate-500">TRM</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            <span className="text-slate-500">MRD</span>
          </span>
        </div>
      </div>

      {/* Test Detail Modal - Clinician/Academic View */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedTest(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {(() => {
              const category = selectedTest.category;
              const colorSchemes = {
                MRD: { headerBg: 'bg-gradient-to-r from-orange-500 to-amber-500' },
                ECD: { headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
                TRM: { headerBg: 'bg-gradient-to-r from-sky-500 to-blue-500' },
                TDS: { headerBg: 'bg-gradient-to-r from-violet-500 to-purple-500' }
              };
              const clrs = colorSchemes[category] || colorSchemes.MRD;
              const hasMedicare = selectedTest.reimbursement?.toLowerCase().includes('medicare') && !selectedTest.reimbursement?.toLowerCase().includes('not yet');
              const hasPrivate = selectedTest.commercialPayers && selectedTest.commercialPayers.length > 0;
              
              return (
                <>
                  <div className={`flex justify-between items-start p-5 ${clrs.headerBg}`} style={{ flexShrink: 0 }}>
                    <div className="flex-1 mr-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {hasMedicare && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Medicare</span>}
                        {hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Private Insurance</span>}
                        {selectedTest.fdaStatus && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">{selectedTest.fdaStatus.split(' - ')[0]}</span>}
                      </div>
                      <h2 className="text-2xl font-bold text-white">{selectedTest.name}</h2>
                      <p className="text-white/80">{selectedTest.vendor}</p>
                    </div>
                    <button onClick={() => setSelectedTest(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-5 overflow-y-auto" style={{ flex: 1 }}>
                    <div className="grid grid-cols-3 gap-4">
                      {selectedTest.sensitivity != null && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <PerformanceMetricWithWarning 
                            value={selectedTest.sensitivity} 
                            label="Sensitivity" 
                            test={selectedTest} 
                            metric="sensitivity"
                            size="lg"
                          />
                        </div>
                      )}
                      {selectedTest.specificity != null && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <PerformanceMetricWithWarning 
                            value={selectedTest.specificity} 
                            label="Specificity" 
                            test={selectedTest} 
                            metric="specificity"
                            size="lg"
                          />
                        </div>
                      )}
                      {(selectedTest.initialTat || selectedTest.tat) && (
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-slate-600">{selectedTest.initialTat || selectedTest.tat}</p>
                          <p className="text-xs text-gray-500">TAT</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-gray-200 px-5 py-4 flex justify-between items-center bg-gray-50" style={{ flexShrink: 0 }}>
                    <p className="text-sm text-gray-500">View full details in the navigator</p>
                    <button
                      onClick={() => { setSelectedTest(null); onNavigate(selectedTest.category, selectedTest.id); }}
                      className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90"
                      style={{ backgroundColor: '#2A63A4' }}
                    >
                      Open {category} Navigator
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestShowcase;
