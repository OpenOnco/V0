import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { track } from '@vercel/analytics';
import * as analytics from '../utils/analytics';
import {
  filterConfigs,
  VENDOR_VERIFIED,
  getProductTypeConfig,
  createCategoryMeta,
  BUILD_INFO,
} from '../data';
import { getStoredPersona } from '../utils/persona';
import { calculateTestCompleteness } from '../utils/testMetrics';
import { getSuggestedTests } from '../utils/suggestions';
import Checkbox from './ui/Checkbox';
import FilterSection from './ui/FilterSection';
import VendorBadge from './badges/VendorBadge';
import ProductTypeBadge from './badges/ProductTypeBadge';
import TestDetailModal, { ComparisonModal } from './test/TestDetailModal';
import TestCard from './test/TestCard';
import ExternalResourcesSection from './markdown/ExternalResourcesSection';

// Create categoryMeta using imported function with BUILD_INFO sources
const categoryMeta = createCategoryMeta(BUILD_INFO.sources);

// ============================================
// Category Page
// ============================================
const CategoryPage = ({ category, initialSelectedTestId, initialCompareIds, onClearInitialTest }) => {
  const meta = categoryMeta[category];
  const config = filterConfigs[category];
  const tests = meta.tests;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApproaches, setSelectedApproaches] = useState([]);
  const [selectedCancerTypes, setSelectedCancerTypes] = useState([]);
  const [selectedIndicationGroups, setSelectedIndicationGroups] = useState([]); // For ECD cancer type filtering
  const [selectedReimbursement, setSelectedReimbursement] = useState([]);
  const [selectedTestScopes, setSelectedTestScopes] = useState([]);
  const [selectedSampleCategories, setSelectedSampleCategories] = useState([]);
  const [selectedFdaStatus, setSelectedFdaStatus] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedClinicalSettings, setSelectedClinicalSettings] = useState([]);
  const [minParticipants, setMinParticipants] = useState(0);
  const [minPublications, setMinPublications] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  // Performance filters
  const [minSensitivity, setMinSensitivity] = useState(0);
  const [minSpecificity, setMinSpecificity] = useState(0);
  const [maxTat, setMaxTat] = useState(30);
  // Additional filters
  const [nccnOnly, setNccnOnly] = useState(false);
  const [tumorTissueRequired, setTumorTissueRequired] = useState('any'); // 'any', 'yes', 'no'
  const [minGenes, setMinGenes] = useState(0);
  const [minCdx, setMinCdx] = useState(0);
  const [selectedProductTypes, setSelectedProductTypes] = useState([]);
  const [selectedTests, setSelectedTests] = useState(() => {
    // Initialize from either comparison IDs or single test ID
    if (initialCompareIds && initialCompareIds.length >= 2) {
      return initialCompareIds;
    }
    return initialSelectedTestId ? [initialSelectedTestId] : [];
  });
  const [showComparison, setShowComparison] = useState(() => {
    // Auto-open comparison if we have compare IDs
    return initialCompareIds && initialCompareIds.length >= 2;
  });
  const [detailTest, setDetailTest] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const filterScrollRef = useRef(null);
  const scrollLockRef = useRef(null);
  
  // Track persona for conditional rendering
  const [persona, setPersona] = useState(() => getStoredPersona() || 'Clinician');
  useEffect(() => {
    const handlePersonaChange = (e) => setPersona(e.detail);
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);
  
  
  // Handler to show test detail with tracking
  const handleShowDetail = (test) => {
    const personaFlag = `persona-${persona.toLowerCase().replace(/[^a-z]/g, '-')}`;
    // Vercel Analytics
    track('test_detail_viewed', { 
      category: category,
      test_id: test.id,
      test_name: test.name,
      vendor: test.vendor
    }, { 
      flags: [personaFlag, `category-${category.toLowerCase()}`] 
    });
    // PostHog tracking
    analytics.trackTestView(test, 'category_page');
    setDetailTest(test);
  };
  
  // Helper to update slider values with scroll position preservation
  const updateSlider = (setter) => (e) => {
    // Capture scroll position
    const scrollY = window.scrollY;
    
    // Clear any pending scroll restoration
    if (scrollLockRef.current) {
      clearInterval(scrollLockRef.current);
    }
    
    // Update the value
    setter(Number(e.target.value));
    
    // Restore scroll repeatedly for 200ms to fight browser behavior
    const startTime = Date.now();
    scrollLockRef.current = setInterval(() => {
      window.scrollTo(0, scrollY);
      if (Date.now() - startTime > 200) {
        clearInterval(scrollLockRef.current);
      }
    }, 10);
  };

  // Handle initial selected test - open detail modal if coming from direct link
  useEffect(() => {
    if (initialSelectedTestId) {
      // Find the test and open its detail modal
      const test = tests.find(t => t.id === initialSelectedTestId);
      if (test) {
        setDetailTest(test);
      }
      onClearInitialTest?.();
    }
  }, [initialSelectedTestId, tests]);

  useEffect(() => {
    // Only scroll to top if not navigating to a specific test
    if (!initialSelectedTestId) {
      window.scrollTo(0, 0);
    }
  }, [category]);

  useEffect(() => {
    const checkScroll = () => {
      const el = filterScrollRef.current;
      if (el) {
        const canScroll = el.scrollHeight > el.clientHeight;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
        setCanScrollMore(canScroll && !isAtBottom);
      }
    };
    checkScroll();
    const el = filterScrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [category]);
  
  // Cleanup scroll lock interval on unmount
  useEffect(() => {
    return () => {
      if (scrollLockRef.current) {
        clearInterval(scrollLockRef.current);
      }
    };
  }, []);

  const filteredTests = useMemo(() => {
    return tests.filter(test => {
      if (searchQuery) {
        const terms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        // Include productType in search - "kit" finds all IVD kits, "service" finds central lab services
        const productTypeSearchable = test.productType === 'Laboratory IVD Kit' ? 'kit ivd laboratory' :
                                      test.productType === 'Self-Collection' ? 'self-collection home' :
                                      'service central lab';
        const searchableText = `${test.name} ${test.vendor} ${category} ${productTypeSearchable}`.toLowerCase();
        if (!terms.every(term => searchableText.includes(term))) return false;
      }
      if (selectedApproaches.length > 0 && !selectedApproaches.includes(test.approach)) return false;
      if (selectedCancerTypes.length > 0 && !test.cancerTypes?.some(ct => selectedCancerTypes.includes(ct))) return false;
      if (selectedReimbursement.length > 0) {
        const matchesReimbursement = selectedReimbursement.some(r => {
          if (r === 'Commercial') return test.commercialPayers && test.commercialPayers.length > 0;
          if (r === 'Medicare') {
            const reimb = (test.reimbursement || '').toLowerCase();
            // Check for positive Medicare coverage indicators
            const hasPositive = reimb === 'medicare' || 
              reimb.startsWith('medicare ') ||
              reimb.includes('medicare covered') || 
              reimb.includes('medicare lcd') ||
              reimb.includes('broad medicare') ||
              reimb.includes('medicare (moldx)') ||
              reimb.includes('(moldx)') ||
              reimb.includes('moldx');
            // Exclude only if the PRIMARY status is no coverage (not just "additional coverage emerging")
            const hasNegative = reimb.includes('not yet established') || 
              reimb.includes('not routinely') || 
              reimb.includes('no established') ||
              reimb.includes('not applicable') ||
              reimb.startsWith('coverage emerging');  // Only exclude if starts with "Coverage emerging" (meaning primary status is emerging)
            return hasPositive && !hasNegative;
          }
          return test.reimbursement === r;
        });
        if (!matchesReimbursement) return false;
      }
      if (selectedTestScopes.length > 0) {
        // Use prefix matching for test scopes (e.g., 'Single-cancer' matches 'Single-cancer (CRC)', 'Single-cancer (Lung)', etc.)
        const matchesScope = selectedTestScopes.some(scope => test.testScope?.startsWith(scope));
        if (!matchesScope) return false;
      }
      // Indication Group filter for ECD (cancer type filtering)
      if (selectedIndicationGroups.length > 0 && category === 'ECD') {
        if (!test.indicationGroup || !selectedIndicationGroups.includes(test.indicationGroup)) return false;
      }
      if (selectedSampleCategories.length > 0 && !selectedSampleCategories.includes(test.sampleCategory)) return false;
      if (minParticipants > 0 && (!test.totalParticipants || test.totalParticipants < minParticipants)) return false;
      if (minPublications > 0 && (!test.numPublications || test.numPublications < minPublications)) return false;
      if (category === 'ECD' && maxPrice < 1000 && test.listPrice && test.listPrice > maxPrice) return false;
      if (selectedFdaStatus.length > 0) {
        const testFda = test.fdaStatus || '';
        const matchesFda = selectedFdaStatus.some(status => {
          if (status === 'FDA Approved') return testFda.includes('FDA Approved') || testFda.includes('FDA-approved');
          if (status === 'FDA Breakthrough') return testFda.includes('Breakthrough');
          if (status === 'LDT') return testFda.includes('LDT');
          if (status === 'Investigational') return testFda.includes('Investigational') || testFda.includes('Research');
          return false;
        });
        if (!matchesFda) return false;
      }
      if (selectedRegions.length > 0) {
        const testRegions = test.availableRegions || [];
        // If test has no regions specified, infer from clinicalAvailability text
        const avail = test.clinicalAvailability?.toLowerCase() || '';
        const effectiveRegions = testRegions.length > 0 ? testRegions : 
          (avail.includes('shipping') || avail.includes('commercially available') || 
           avail.includes('launched') || avail.includes('us ') || avail.includes('in us') ||
           avail.includes('quest') || avail.includes('labcorp') ? ['US'] : []);
        const matchesRegion = selectedRegions.some(r => {
          if (r === 'US') return effectiveRegions.includes('US') || effectiveRegions.includes('US-only');
          if (r === 'International') return effectiveRegions.includes('International') || effectiveRegions.includes('Global') || effectiveRegions.length > 1;
          if (r === 'RUO') return effectiveRegions.includes('RUO') || test.clinicalAvailability?.includes('RUO');
          return effectiveRegions.includes(r);
        });
        if (!matchesRegion) return false;
      }
      // Clinical Settings filter (MRD only)
      if (selectedClinicalSettings.length > 0 && test.clinicalSettings) {
        const hasMatchingSetting = selectedClinicalSettings.some(s => test.clinicalSettings.includes(s));
        if (!hasMatchingSetting) return false;
      }
      // Performance filters
      if (minSensitivity > 0) {
        const sens = parseFloat(test.sensitivity);
        if (isNaN(sens) || sens < minSensitivity) return false;
      }
      if (minSpecificity > 0) {
        const spec = parseFloat(test.specificity);
        if (isNaN(spec) || spec < minSpecificity) return false;
      }
      if (maxTat < 30) {
        // Check tat, initialTat, or followUpTat
        const tatVal = test.tat || test.initialTat || test.followUpTat;
        if (tatVal) {
          const tatNum = parseFloat(tatVal);
          if (!isNaN(tatNum) && tatNum > maxTat) return false;
        }
      }
      // NCCN filter - only tests actually named in NCCN guidelines
      if (nccnOnly && !test.nccnNamedInGuidelines) return false;
      // Tumor tissue requirement filter
      if (tumorTissueRequired === 'yes' && test.requiresTumorTissue !== 'Yes') return false;
      if (tumorTissueRequired === 'no' && test.requiresTumorTissue !== 'No') return false;
      // Genes analyzed filter (TDS)
      if (minGenes > 0 && (!test.genesAnalyzed || test.genesAnalyzed < minGenes)) return false;
      // Companion Dx count filter (TDS)
      if (minCdx > 0 && (!test.fdaCompanionDxCount || test.fdaCompanionDxCount < minCdx)) return false;
      // Product Type filter (IVD Kit vs Service)
      if (selectedProductTypes.length > 0) {
        const testProductType = test.productType || 'Central Lab Service'; // Default to service for existing tests
        if (!selectedProductTypes.includes(testProductType)) return false;
      }
      return true;
    }).sort((a, b) => {
      // Priority: 1) VENDOR VERIFIED (newest first), 2) BC tests, 3) Non-BC tests
      const aVerifiedData = VENDOR_VERIFIED[a.id];
      const bVerifiedData = VENDOR_VERIFIED[b.id];
      const aVerified = aVerifiedData !== undefined;
      const bVerified = bVerifiedData !== undefined;
      
      if (aVerified && !bVerified) return -1;
      if (!aVerified && bVerified) return 1;
      
      // Both verified: sort by date (newest first)
      if (aVerified && bVerified) {
        const aDate = aVerifiedData.verifiedDate || '1970-01-01';
        const bDate = bVerifiedData.verifiedDate || '1970-01-01';
        if (aDate !== bDate) return bDate.localeCompare(aDate);
      }
      
      // Then sort non-BC (MISS) tests to end
      const aBC = calculateTestCompleteness(a, category).percentage === 100;
      const bBC = calculateTestCompleteness(b, category).percentage === 100;
      if (aBC && !bBC) return -1;
      if (!aBC && bBC) return 1;
      // Within same status, sort by vendor then test name
      return a.vendor.localeCompare(b.vendor) || a.name.localeCompare(b.name);
    });
  }, [tests, searchQuery, selectedApproaches, selectedCancerTypes, selectedIndicationGroups, selectedReimbursement, selectedTestScopes, selectedSampleCategories, selectedFdaStatus, selectedRegions, selectedClinicalSettings, minParticipants, minPublications, maxPrice, minSensitivity, minSpecificity, maxTat, nccnOnly, tumorTissueRequired, minGenes, minCdx, selectedProductTypes, category]);

  const testsToCompare = useMemo(() => tests.filter(t => selectedTests.includes(t.id)), [tests, selectedTests]);
  const suggestedTests = useMemo(() => getSuggestedTests(selectedTests, tests), [selectedTests, tests]);
  const toggle = (setter) => (val) => setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const clearFilters = () => { setSearchQuery(''); setSelectedApproaches([]); setSelectedCancerTypes([]); setSelectedReimbursement([]); setSelectedTestScopes([]); setSelectedSampleCategories([]); setSelectedFdaStatus([]); setSelectedRegions([]); setSelectedClinicalSettings([]); setMinParticipants(0); setMinPublications(0); setMaxPrice(1000); setMinSensitivity(0); setMinSpecificity(0); setMaxTat(30); setNccnOnly(false); setTumorTissueRequired('any'); setMinGenes(0); setMinCdx(0); setSelectedProductTypes([]); };
  const hasFilters = searchQuery || selectedApproaches.length || selectedCancerTypes.length || selectedIndicationGroups.length || selectedReimbursement.length || selectedTestScopes.length || selectedSampleCategories.length || selectedFdaStatus.length || selectedRegions.length || selectedClinicalSettings.length || minParticipants > 0 || minPublications > 0 || maxPrice < 1000 || minSensitivity > 0 || minSpecificity > 0 || maxTat < 30 || nccnOnly || tumorTissueRequired !== 'any' || minGenes > 0 || minCdx > 0 || selectedProductTypes.length;

  const colorClasses = { orange: 'from-orange-500 to-orange-600', green: 'from-emerald-500 to-emerald-600', red: 'from-sky-500 to-sky-600', violet: 'from-violet-500 to-violet-600', indigo: 'from-indigo-500 to-indigo-600' };

  return (
    <>
      <style>{`
        * { overflow-anchor: none !important; }
      `}</style>
      <div className="max-w-7xl mx-auto px-6 py-8" style={{ overflowAnchor: 'none' }}>
      <div className="mb-8">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${colorClasses[meta.color]} text-white text-sm font-medium mb-3`}>
          {meta.shortTitle}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {meta.title}
        </h1>
        <p className="text-gray-600">{meta.description}</p>
        
        {/* Parameter type legend - hide for patients */}
        {(
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="text-slate-500">Data types:</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-slate-500">Clinical</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500"></span>
              <span className="text-slate-500">Analytical</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span className="text-slate-500">Operational</span>
            </span>
          </div>
        )}
        
        
        {/* Quick resources bar - shown for cancer categories */}
        {['MRD', 'ECD', 'TRM', 'TDS'].includes(category) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Quick links:</span>
            <ExternalResourcesSection category={category} compact />
          </div>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Browse Tests</h2>
          <button 
            className="md:hidden px-3 py-1.5 text-sm font-medium bg-gray-100 rounded-lg"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <aside className={`${showMobileFilters ? 'block' : 'hidden'} md:block w-full md:w-64 flex-shrink-0`}>
            <div className="bg-white rounded-xl border border-gray-200 sticky top-24 max-h-[calc(100vh-120px)] flex flex-col overflow-hidden">
              <div className="p-5 pb-0 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Filters</h3>
                  {hasFilters && <button onClick={clearFilters} className="text-xs text-emerald-600 hover:text-emerald-700">Clear all</button>}
                </div>
                <div className="mb-5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Search</label>
                  <input type="text" placeholder="Test or vendor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div ref={filterScrollRef} className="flex-1 overflow-y-auto px-5 pb-5 overscroll-contain">


              {/* ========== UNIFIED FILTERS FOR ALL CATEGORIES ========== */}
              
              {/* Cancer Type Section - FIRST FILTER */}
              <FilterSection
                title="Cancer Type"
                defaultOpen={false}
                activeCount={category === 'ECD' ? selectedIndicationGroups.length : selectedCancerTypes.length}
              >
                {category === 'ECD' ? (
                  /* ECD uses indicationGroups for cleaner cancer type filtering */
                  <>
                    <div className="space-y-1">
                      {config.indicationGroups?.map(ig => (
                        <Checkbox 
                          key={ig} 
                          label={ig === 'MCED' ? 'Multi-Cancer (MCED)' : ig === 'CRC' ? 'Colorectal (CRC)' : ig} 
                          checked={selectedIndicationGroups.includes(ig)} 
                          onChange={() => toggle(setSelectedIndicationGroups)(ig)} 
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  /* MRD, TRM, TDS use cancerTypes */
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {config.cancerTypes?.map(t => (
                      <Checkbox 
                        key={t} 
                        label={t.length > 30 ? t.slice(0,30)+'...' : t} 
                        checked={selectedCancerTypes.includes(t)} 
                        onChange={() => toggle(setSelectedCancerTypes)(t)} 
                      />
                    ))}
                  </div>
                )}
              </FilterSection>

              {/* Sample Type Section - NEW TOP-LEVEL FILTER */}
              {config.sampleCategories && config.sampleCategories.length > 1 && (
                <FilterSection
                  title="Sample Type"
                  defaultOpen={false}
                  activeCount={selectedSampleCategories.length}
                >
                  <div className="space-y-1">
                    {config.sampleCategories.map(s => (
                      <Checkbox 
                        key={s} 
                        label={s} 
                        checked={selectedSampleCategories.includes(s)} 
                        onChange={() => toggle(setSelectedSampleCategories)(s)} 
                      />
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Product Type Section - IVD Kit vs Service */}
              {config.productTypes && (
                <FilterSection
                  title="Product Type"
                  defaultOpen={false}
                  activeCount={selectedProductTypes.length}
                >
                  <div className="space-y-1">
                    {config.productTypes.map(pt => {
                      const ptConfig = getProductTypeConfig(pt);
                      return (
                        <label key={pt} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedProductTypes.includes(pt)}
                            onChange={() => toggle(setSelectedProductTypes)(pt)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="flex items-center gap-1.5 text-sm text-gray-700 group-hover:text-gray-900">
                            <span>{ptConfig.icon}</span>
                            <span>{ptConfig.label}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {(
                    <p className="text-xs text-gray-400 mt-2 italic">
                      🏠 Self-collection: patient collects at home<br/>
                      🔬 Lab Kit: IVD kit run at any equipped lab<br/>
                      🏥 Service: sample shipped to central lab
                    </p>
                  )}
                </FilterSection>
              )}

              {/* Clinical Section - now without cancer types (moved to top) */}
              <FilterSection 
                title="Clinical" 
                defaultOpen={false}
                activeCount={selectedTestScopes.length + selectedClinicalSettings.length}
              >
                {/* Clinical Setting - MRD only */}
                {category === 'MRD' && config.clinicalSettings && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 mt-3 block">Clinical Setting</label>
                    <div className="space-y-0.5">
                      {config.clinicalSettings.map(s => (
                        <Checkbox 
                          key={s} 
                          label={s === 'Post-Surgery' ? 'Post-Surgery (landmark)' : s === 'Surveillance' ? 'Surveillance (longitudinal)' : s}
                          checked={selectedClinicalSettings.includes(s)} 
                          onChange={() => toggle(setSelectedClinicalSettings)(s)} 
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 italic">Filter by validated clinical context</p>
                  </>
                )}
                {/* Test Scope - for ECD only */}
                {category === 'ECD' && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 block">Scope</label>
                    {config.testScopes?.map(s => <Checkbox key={s} label={(s === 'Single-cancer' ? 'Single-cancer (CRC, Lung, Liver, etc.)' : 'Multi-cancer (MCED)')} checked={selectedTestScopes.includes(s)} onChange={() => toggle(setSelectedTestScopes)(s)} />)}
                  </>
                )}
              </FilterSection>

              {/* Methodology Section */}
              {(
                <FilterSection 
                  title="Methodology" 
                  defaultOpen={false}
                  activeCount={selectedApproaches.length + (tumorTissueRequired !== 'any' ? 1 : 0)}
                >
                  {/* Approach - for MRD, TRM, TDS */}
                  {category !== 'ECD' && config.approaches && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 block">Approach</label>
                      {config.approaches.map(a => <Checkbox key={a} label={a} checked={selectedApproaches.includes(a)} onChange={() => toggle(setSelectedApproaches)(a)} />)}
                    </>
                  )}
                  {/* Tumor Tissue Requirement - MRD only */}
                  {category === 'MRD' && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 mt-3 block">Tumor Tissue Required</label>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tumorTissue" checked={tumorTissueRequired === 'any'} onChange={() => setTumorTissueRequired('any')} className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-sm text-gray-700">Any</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tumorTissue" checked={tumorTissueRequired === 'no'} onChange={() => setTumorTissueRequired('no')} className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-sm text-gray-700">No (tumor-naïve)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tumorTissue" checked={tumorTissueRequired === 'yes'} onChange={() => setTumorTissueRequired('yes')} className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-sm text-gray-700">Yes (tumor-informed)</span>
                        </label>
                      </div>
                    </>
                  )}
                </FilterSection>
              )}

              {/* Regulatory & Access Section */}
              <FilterSection 
                title="Regulatory & Access" 
                defaultOpen={false}
                activeCount={selectedFdaStatus.length + selectedReimbursement.length + selectedRegions.length + (nccnOnly ? 1 : 0)}
              >
                {/* FDA Status - all categories, clinician only */}
                {config.fdaStatuses && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 block">FDA Status</label>
                    {config.fdaStatuses.map(f => <Checkbox key={f} label={f} checked={selectedFdaStatus.includes(f)} onChange={() => toggle(setSelectedFdaStatus)(f)} />)}
                  </>
                )}
                {/* NCCN Named - MRD, TRM (not ECD, TDS), clinician only */}
                {(category === 'MRD' || category === 'TRM') && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 mt-3 block">Guidelines</label>
                    <Checkbox label="NCCN Named" checked={nccnOnly} onChange={() => setNccnOnly(!nccnOnly)} />
                  </>
                )}
                {/* Coverage - all categories */}
                <label className="text-xs text-gray-500 mb-1 mt-3 block">Coverage</label>
                {config.reimbursements?.map(r => <Checkbox key={r} label={r === 'Medicare' ? 'Medicare' : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
                {/* Availability - MRD, ECD, TRM (not TDS) */}
                {config.regions && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 mt-3 block">Availability</label>
                    {config.regions.map(r => <Checkbox key={r} label={r === 'RUO' ? 'Research Use Only' : r === 'International' ? 'International/Global' : r} checked={selectedRegions.includes(r)} onChange={() => toggle(setSelectedRegions)(r)} />)}
                  </>
                )}
              </FilterSection>

              {/* Performance Section */}
              {(
                <FilterSection 
                  title="Performance" 
                  defaultOpen={false}
                  activeCount={(minSensitivity > 0 ? 1 : 0) + (minSpecificity > 0 ? 1 : 0) + (maxTat < 30 ? 1 : 0) + (minGenes > 0 ? 1 : 0) + (minCdx > 0 ? 1 : 0)}
                >
                  {/* Sensitivity - MRD, ECD, TRM (not TDS) */}
                  {category !== 'TDS' && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Min Sensitivity: {minSensitivity === 0 ? 'Any' : `${minSensitivity}%+`}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="99"
                        step="5"
                        value={minSensitivity}
                        onChange={updateSlider(setMinSensitivity)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1 mb-4">
                        <span>Any</span>
                        <span>50%</span>
                        <span>99%</span>
                      </div>
                    </>
                  )}
                  {/* Specificity - MRD, ECD, TRM (not TDS) */}
                  {category !== 'TDS' && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Min Specificity: {minSpecificity === 0 ? 'Any' : `${minSpecificity}%+`}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="99"
                        step="5"
                        value={minSpecificity}
                        onChange={updateSlider(setMinSpecificity)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1 mb-4">
                        <span>Any</span>
                        <span>50%</span>
                        <span>99%</span>
                      </div>
                    </>
                  )}
                  {/* TAT - MRD, TRM, TDS (not ECD) */}
                  {category !== 'ECD' && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Max Turnaround: {maxTat >= 30 ? 'Any' : `${maxTat} days`}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={maxTat}
                        onChange={updateSlider(setMaxTat)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1 mb-4">
                        <span>1 day</span>
                        <span>14 days</span>
                        <span>Any</span>
                      </div>
                    </>
                  )}
                  {/* Genes Analyzed - TDS only */}
                  {category === 'TDS' && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Min Genes Analyzed: {minGenes === 0 ? 'Any' : minGenes >= 500 ? '500+' : minGenes}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="500"
                        step="50"
                        value={minGenes}
                        onChange={updateSlider(setMinGenes)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1 mb-4">
                        <span>Any</span>
                        <span>250</span>
                        <span>500+</span>
                      </div>
                    </>
                  )}
                  {/* FDA Companion Dx Count - TDS only */}
                  {category === 'TDS' && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Min FDA Companion Dx: {minCdx === 0 ? 'Any' : minCdx}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="5"
                        value={minCdx}
                        onChange={updateSlider(setMinCdx)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Any</span>
                        <span>30</span>
                        <span>60</span>
                      </div>
                    </>
                  )}
                </FilterSection>
              )}

              {/* Validation Section */}
              <FilterSection 
                title="Validation" 
                defaultOpen={false}
                activeCount={(minParticipants > 0 ? 1 : 0) + (minPublications > 0 ? 1 : 0) + (maxPrice < 1000 ? 1 : 0)}
              >
                {/* Price - ECD only */}
                {category === 'ECD' && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Max List Price: {maxPrice >= 1000 ? 'Any' : `$${maxPrice}`}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="50"
                      value={maxPrice}
                      onChange={updateSlider(setMaxPrice)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1 mb-4">
                      <span>$0</span>
                      <span>$500</span>
                      <span>$1000+</span>
                    </div>
                  </>
                )}
                {/* Trial Participants - MRD, ECD, TRM (not TDS), clinician only */}
                {category !== 'TDS' && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Min Trial Participants: {minParticipants === 0 ? 'Any' : category === 'ECD' ? (minParticipants >= 100000 ? '100,000+' : minParticipants.toLocaleString()) : (minParticipants >= 1000 ? '1,000+' : minParticipants.toLocaleString())}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={category === 'ECD' ? '100000' : '1000'}
                      step={category === 'ECD' ? '10000' : '100'}
                      value={minParticipants}
                      onChange={updateSlider(setMinParticipants)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1 mb-4">
                      <span>0</span>
                      <span>{category === 'ECD' ? '50k' : '500'}</span>
                      <span>{category === 'ECD' ? '100k+' : '1,000+'}</span>
                    </div>
                  </>
                )}
                {/* Publications - all categories, clinician only */}
                {(
                  <>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Min Publications: {minPublications === 0 ? 'Any' : category === 'ECD' ? (minPublications >= 20 ? '20+' : minPublications) : category === 'TDS' ? (minPublications >= 1000 ? '1,000+' : minPublications) : (minPublications >= 100 ? '100+' : minPublications)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={category === 'ECD' ? '20' : category === 'TDS' ? '1000' : '100'}
                      step={category === 'ECD' ? '2' : category === 'TDS' ? '50' : '5'}
                      value={minPublications}
                      onChange={updateSlider(setMinPublications)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0</span>
                      <span>{category === 'ECD' ? '10' : category === 'TDS' ? '500' : '50'}</span>
                      <span>{category === 'ECD' ? '20+' : category === 'TDS' ? '1,000+' : '100+'}</span>
                    </div>
                  </>
                )}
              </FilterSection>

              </div>
              {canScrollMore && (
                <div className="h-8 bg-gradient-to-t from-white via-white to-transparent flex-shrink-0 -mt-8 relative z-10 pointer-events-none flex items-end justify-center pb-1">
                  <svg className="w-4 h-4 text-gray-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              )}
            </div>
          </aside>

          <div className="flex-1" style={{ overflowAnchor: 'none', contain: 'layout' }}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">Showing {filteredTests.length} of {tests.length} tests</p>
              {selectedTests.length === 0 && (
                <p className="hidden md:block text-sm text-gray-400 italic">💡 Select tests to compare them side-by-side</p>
              )}
              {selectedTests.length === 1 && (
                <p className="hidden md:block text-sm text-orange-600">Select at least one more test to compare</p>
              )}
              {selectedTests.length >= 2 && (
                <button 
                  onClick={() => {
                  // Track comparison with feature flags (Vercel Analytics)
                  const personaFlag = `persona-${persona.toLowerCase().replace(/[^a-z]/g, '-')}`;
                  track('tests_compared', { 
                    category: category,
                    test_count: selectedTests.length,
                    test_ids: selectedTests.join(',')
                  }, { 
                    flags: [personaFlag, `category-${category.toLowerCase()}`] 
                  });
                  // PostHog tracking
                  analytics.trackTestComparison(testsToCompare, 'category_page');
                  setShowComparison(true);
                }} 
                  className="hidden md:flex bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium items-center gap-2"
                  data-testid="compare-tests-button"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Compare ({selectedTests.length})
                </button>
              )}
            </div>
            
            {/* Smart Comparison Suggestions - Hidden on mobile */}
            {selectedTests.length >= 1 && suggestedTests.length > 0 && (
              <div className="hidden md:block mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-800">Suggested Comparisons</span>
                  <span className="text-xs text-blue-600">based on your selection</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedTests.map(({ test, matchReason }) => (
                    <button
                      key={test.id}
                      onClick={() => setSelectedTests(prev => [...prev, test.id])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-full text-sm hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                    >
                      <span className="font-medium text-gray-700 group-hover:text-blue-700">{test.name}</span>
                      {matchReason && <span className="text-xs text-blue-500">({matchReason})</span>}
                      <svg className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ minHeight: '800px', overflowAnchor: 'none', contain: 'layout' }}>
              {filteredTests.map(test => 
                <TestCard key={test.id} test={test} category={category} isSelected={selectedTests.includes(test.id)} onSelect={(id) => toggle(setSelectedTests)(id)} onShowDetail={handleShowDetail} />
              )}
            </div>
            {filteredTests.length === 0 && <div className="text-center py-12 text-gray-500"><p>No tests match your filters.</p><button onClick={clearFilters} className="text-emerald-600 text-sm mt-2">Clear filters</button></div>}
          </div>
        </div>
      </section>

      {/* Full Resources Section - for cancer categories */}
      {['MRD', 'ECD', 'TRM', 'TDS'].includes(category) && (
        <section className="mt-10">
          <ExternalResourcesSection category={category} />
        </section>
      )}

      {showComparison && testsToCompare.length >= 2 && (
        <ComparisonModal tests={testsToCompare} category={category} onClose={() => setShowComparison(false)} onRemoveTest={(id) => { setSelectedTests(prev => prev.filter(i => i !== id)); if (selectedTests.length <= 2) setShowComparison(false); }} />
      )}
      
      {detailTest && (
        <TestDetailModal test={detailTest} category={category} onClose={() => setDetailTest(null)} />
      )}
    </div>
    </>
  );
};

export default CategoryPage;
