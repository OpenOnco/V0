/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  DEPLOYMENT WORKFLOW - READ BEFORE PUSHING TO PRODUCTION                  ║
 * ║                                                                           ║
 * ║  See: /DEPLOY WORKFLOW.md                                                 ║
 * ║                                                                           ║
 * ║  Quick version:                                                           ║
 * ║    1. npm run test:smoke           (local smoke tests)                    ║
 * ║    2. vercel --yes                 (deploy to preview)                    ║
 * ║    3. TEST_URL=<preview> npm test  (full tests against preview)           ║
 * ║    4. Manual verification          (check preview in browser)             ║
 * ║    5. vercel --prod --yes          (deploy to production)                 ║
 * ║                                                                           ║
 * ║  Or just run: ./workflow.sh                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Analytics } from '@vercel/analytics/react';
import { track } from '@vercel/analytics';
import {
  DOMAINS,
  getDomain,
  getSiteConfig,
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGES_BY_GRID,
  getStagesByDomain,
  lifecycleColorClasses,
  PRODUCT_TYPES,
  getProductTypeConfig,
  createCategoryMeta,
  filterConfigs,
  comparisonParams,
  SEO_DEFAULTS,
  PAGE_SEO,
  slugify,
  getTestUrl,
  getTestBySlug,
  getAbsoluteUrl,
  generateTestSchema,
  generateCategorySchema,
  generateOrganizationSchema,
  EXTERNAL_RESOURCES,
  CATEGORY_STANDARDS,
  STANDARDS_BODIES,
  BUILD_INFO,
} from './data';

// Component imports
import { getStoredPersona, savePersona } from './utils/persona';
import { trackPageVisit, trackTestView, trackPersona } from './utils/sessionTracking';
import * as analytics from './utils/analytics';
import PersonaGate from './components/PersonaGate';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Footer from './components/Footer';
import DatabaseSummary from './components/DatabaseSummary';
import OpennessAward from './components/OpennessAward';
import FAQPage from './pages/FAQPage';
import LearnPage from './pages/LearnPage';
import AboutPage from './pages/AboutPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import HowItWorksPage from './pages/HowItWorksPage';
import SubmissionsPage from './pages/SubmissionsPage';
import AdminDiscoveriesPage from './pages/AdminDiscoveriesPage';
import Chat from './components/Chat';
import MRDChat from './components/physician/MRDChat';
import MRDNavigator from './components/physician/MRDNavigator';
import DigestSignup from './components/physician/DigestSignup';
import RDDigestSignup from './components/research/RDDigestSignup';
import DigestPage from './pages/DigestPage';
import { VENDOR_BADGES } from './config/vendors';
import { CATEGORY_COLORS } from './config/categories';
import { TIER1_FIELDS, PARAMETER_DEFINITIONS, PARAMETER_CHANGELOG, MINIMUM_PARAMS, FIELD_DEFINITIONS } from './config/testFields';
import { PATIENT_INFO_CONTENT } from './config/patientContent';
import { calculateTier1Metrics, calculateCategoryMetrics, calculateTestCompleteness, calculateMinimumFieldStats } from './utils/testMetrics';
import CircularProgress from './components/ui/CircularProgress';
import QualityGrade from './components/ui/QualityGrade';
import Checkbox from './components/ui/Checkbox';
import FilterSection from './components/ui/FilterSection';
import Badge from './components/ui/Badge';
import VendorBadge, { getVendorBadges } from './components/badges/VendorBadge';
import CompanyCommunicationBadge from './components/badges/CompanyCommunicationBadge';
import ProductTypeBadge from './components/badges/ProductTypeBadge';
import Markdown from './components/markdown/Markdown';
import { TestContext, ParameterLabel, InfoIcon, CitationTooltip, NoteTooltip, ExpertInsight, DataRow } from './components/tooltips';
import WatchingWizard from './components/patient/WatchingWizard';
import TestLookupWizard from './components/patient/TestLookupWizard';
import AppealWizard from './components/patient/AppealWizard';
import { LifecycleNavigator, RecentlyAddedBanner, CancerTypeNavigator, getTestCount, getSampleTests } from './components/navigation';
import TestShowcase from './components/test/TestShowcase';
import TestDetailModal, { ComparisonModal } from './components/test/TestDetailModal';
import CategoryPage from './components/CategoryPage';
import { ComparePage, COMPARISON_PAGES } from './pages/ComparePage';
import { useAllTests, useTestCounts, useTestsByCategories, useVendors, useChangelog } from './dal';

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  CLAUDE: READ THIS FIRST WHEN EDITING TEST DATA                            ║
// ║                                                                            ║
// ║  When adding, updating, or removing ANY test:                              ║
// ║  1. Update DATABASE_CHANGELOG (line ~35) - this is your memory!            ║
// ║  2. Update RECENTLY_ADDED_TESTS if adding a new test                       ║
// ║  3. Then edit the actual test data array                                   ║
// ║                                                                            ║
// ║  The changelog is visible to users in the Submissions page UI.             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ============================================
// SEO Component - Dynamic meta tags
// ============================================
const SEO = ({ title, description, path = '/', type = 'website', structuredData = null }) => {
  const fullTitle = title ? `${title} | ${SEO_DEFAULTS.siteName}` : SEO_DEFAULTS.siteName;
  const fullUrl = `${SEO_DEFAULTS.siteUrl}${path}`;
  const desc = description || SEO_DEFAULTS.defaultDescription;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SEO_DEFAULTS.siteName} />
      <meta property="og:image" content={SEO_DEFAULTS.defaultImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

// ============================================
// Chat Model Options
// ============================================
const CHAT_MODELS = [
  { id: 'claude-haiku-4-5-20251001', name: 'More speed', description: 'Fast responses' },
  { id: 'claude-sonnet-4-5-20250929', name: 'More thinking', description: 'Deeper analysis' },
];




// ============================================
// Build Info - Auto-generated when code is built
// ============================================
// BUILD_INFO imported from data.js
// ============================================

// Create categoryMeta using imported function with BUILD_INFO sources
const categoryMeta = createCategoryMeta(BUILD_INFO.sources);

// Compressed test data for chatbot - keeps all fields but shortens keys and removes nulls/citations
const compressTestForChat = (test) => {
  // Key mapping: long names → short names
  const keyMap = {
    id: 'id', name: 'nm', vendor: 'vn', approach: 'ap', method: 'mt', sampleCategory: 'samp',
    productType: 'pType', platformRequired: 'platform',
    cancerTypes: 'ca', indicationsNotes: 'ind', sensitivity: 'sens', specificity: 'spec',
    analyticalSpecificity: 'aSpec', clinicalSpecificity: 'cSpec',
    ppv: 'ppv', npv: 'npv', lod: 'lod', lod95: 'lod95', lodNotes: 'lodN', requiresTumorTissue: 'tumorReq',
    requiresMatchedNormal: 'normReq', variantsTracked: 'vars', initialTat: 'tat1', followUpTat: 'tat2',
    leadTimeVsImaging: 'lead', bloodVolume: 'bvol', cfdnaInput: 'cfIn', fdaStatus: 'fda', reimbursement: 'reimb',
    reimbursementNote: 'reimbN', commercialPayers: 'privIns', availableRegions: 'regions', clinicalAvailability: 'avail',
    cptCodes: 'cpt', cptCode: 'cpt', totalParticipants: 'trial', numPublications: 'pubs',
    numPublicationsPlus: 'pubsPlus', exampleTestReport: 'rpt', clinicalTrials: 'trials',
    testScope: 'scope', targetPopulation: 'pop', indicationGroup: 'indGrp',
    stageISensitivity: 's1', stageIISensitivity: 's2', stageIIISensitivity: 's3', stageIVSensitivity: 's4',
    tumorOriginAccuracy: 'origAcc', tumorOriginAccuracyNotes: 'origN',
    performanceNotes: 'perfN', leadTimeNotes: 'leadN', tat: 'tat',
    sampleType: 'sampT', sampleVolume: 'sampV', sampleStability: 'sampStab',
    listPrice: 'price', screeningInterval: 'interval',
    landmarkSensitivity: 'lmSens', landmarkSpecificity: 'lmSpec',
    longitudinalSensitivity: 'loSens', longitudinalSpecificity: 'loSpec',
    responseDefinition: 'respDef', independentValidation: 'indepVal',
    nccnNamedInGuidelines: 'nccnNamed', nccnGuidelineReference: 'nccnRef', vendorClaimsNCCNAlignment: 'vendorNCCN', vendorNCCNAlignmentIndications: 'vendorNCCNInd', technologyDifferentiator: 'techDiff',
    sensitivityNotes: 'sensN', specificityNotes: 'specN', ppvDefinition: 'ppvDef', npvDefinition: 'npvDef',
    genesAnalyzed: 'genes', fdaCompanionDxCount: 'cdxCount', tmb: 'tmb', msi: 'msi',
    validationCohortSize: 'valCohort', analyticalValidationWarning: 'analWarn',
  };
  
  const compressed = {};
  for (const [key, value] of Object.entries(test)) {
    // Skip null, undefined, empty arrays, and citation fields
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key.toLowerCase().includes('citation')) continue;
    
    // Use short key if available
    const shortKey = keyMap[key] || key;
    compressed[shortKey] = value;
  }
  return compressed;
};

// Hook to get chat-compressed test data
const useChatTestData = () => {
  const { testsByCategory } = useTestsByCategories();
  return useMemo(() => ({
    MRD: (testsByCategory.MRD || []).map(compressTestForChat),
    ECD: (testsByCategory.ECD || []).map(compressTestForChat),
    CGP: (testsByCategory.CGP || []).map(compressTestForChat),
  }), [testsByCategory]);
};


// ============================================
// Stat of the Day Component
// ============================================
const StatOfTheDay = ({ onNavigate }) => {
  // Get all tests via DAL
  const { tests: dalTests } = useAllTests();

  // Day-based stat rotation (0=Sunday through 6=Saturday)
  const dayStats = [
    { key: 'totalParticipants', label: 'Trial Participants', unit: '', description: 'Most patients in clinical trials', higherIsBetter: true, format: (v) => v?.toLocaleString(), filter: (v) => v != null && v > 0 },
    { key: 'variantsTracked', label: 'Variants Tracked', unit: '', description: 'Most variants tracked (more ≠ better)', higherIsBetter: true, format: (v) => Number(v)?.toLocaleString(), filter: (v) => v != null && !isNaN(Number(v)) && Number(v) > 0, getValue: (t) => Number(t.variantsTracked) },
    { key: 'tat', label: 'Turnaround Time', unit: ' days', description: 'Fastest turnaround', higherIsBetter: false, format: (v) => v, filter: (v) => v != null && v > 0 },
    { key: 'sensitivity', label: 'Reported Sensitivity', unit: '%', description: 'Highest reported sensitivity (methodology varies)', higherIsBetter: true, format: (v) => v, filter: (v) => v != null && v > 0 && v < 100 },
    { key: 'specificity', label: 'Reported Specificity', unit: '%', description: 'Highest reported specificity (methodology varies)', higherIsBetter: true, format: (v) => v, filter: (v) => v != null && v > 0 && v < 100 },
    { key: 'numIndications', label: 'Cancer Indications', unit: '', description: 'Most cancer types covered', higherIsBetter: true, format: (v) => v, filter: (v) => v != null && v > 0, getValue: (t) => t.cancerTypes?.length || 0 },
    { key: 'numPublications', label: 'Publications', unit: '', description: 'Most peer-reviewed publications', higherIsBetter: true, format: (v) => v, filter: (v) => v != null && v > 0 },
  ];

  // Add numIndications to tests (tests already have category from DAL)
  const allTests = useMemo(() =>
    dalTests.map(t => ({ ...t, numIndications: t.cancerTypes?.length || 0 })),
    [dalTests]
  );
  
  // Get today's stat based on day of week
  const dayOfWeek = new Date().getDay();
  const todayStat = dayStats[dayOfWeek];
  
  // Get value for a test (using custom getValue if defined)
  const getStatValue = (test) => {
    if (todayStat.getValue) return todayStat.getValue(test);
    return test[todayStat.key];
  };
  
  // Filter tests that have valid data for today's stat
  const testsWithStat = allTests
    .filter(t => {
      const val = getStatValue(t);
      return todayStat.filter(val);
    })
    .sort((a, b) => {
      const aVal = getStatValue(a);
      const bVal = getStatValue(b);
      return todayStat.higherIsBetter ? bVal - aVal : aVal - bVal;
    })
    .slice(0, 3);
  
  const categoryColors = {
    MRD: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500', text: 'text-orange-600' },
    ECD: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-500', text: 'text-emerald-600' },
    TRM: { bg: 'bg-sky-100', border: 'border-sky-300', badge: 'bg-sky-500', text: 'text-sky-600' },
    TDS: { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-500', text: 'text-violet-600' }
  };

  if (!todayStat || testsWithStat.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-base font-bold text-slate-800">Stat of the Day Top 3: <span style={{ color: '#2A63A4' }}>{todayStat.label}</span></h3>
        </div>
        <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      </div>
      
      <div className="flex gap-3">
        {testsWithStat.map((test, idx) => {
          const colors = categoryColors[test.category];
          const statValue = getStatValue(test);
          return (
            <div
              key={test.id}
              onClick={() => onNavigate(test.category, test.id)}
              className={`flex-1 ${colors.bg} ${colors.border} border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-slate-300">#{idx + 1}</span>
                  <span className={`${colors.badge} text-white text-[10px] px-1.5 py-0.5 rounded font-medium`}>
                    {test.category}
                  </span>
                </div>
                <p className={`text-lg font-bold ${colors.text}`}>
                  {todayStat.format(statValue)}{todayStat.unit}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate">{test.name}</p>
              <p className="text-xs text-slate-500 truncate">{test.vendor}<VendorBadge vendor={test.vendor} size="xs" /></p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// Home Page (intro, navs, chat, and news)
// ============================================

const PatientInfoModal = ({ type, onClose, onStartChat }) => {
  if (!type || !PATIENT_INFO_CONTENT[type]) return null;
  
  const info = PATIENT_INFO_CONTENT[type];
  const colorSchemes = {
    violet: { bg: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
    rose: { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    orange: { bg: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  };
  const colors = colorSchemes[info.color] || colorSchemes.violet;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`${colors.bg} px-6 py-5 text-white`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-3xl mb-2 block">{info.icon}</span>
              <h2 className="text-2xl font-bold">{info.title}</h2>
              <p className="text-white/80 mt-1">{info.subtitle}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="space-y-6">
            {info.content.map((section, idx) => (
              <div key={idx}>
                <h3 className={`font-semibold ${colors.text} mb-2`}>{section.heading}</h3>
                {section.text && <p className="text-gray-600 leading-relaxed">{section.text}</p>}
                {section.list && (
                  <ul className="mt-2 space-y-2">
                    {section.list.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-600">
                        <span className={colors.text}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          
          {/* CTA */}
          <div className={`mt-6 p-4 ${colors.light} ${colors.border} border rounded-xl`}>
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-medium">Have questions about your specific situation?</span> Our AI assistant can help you understand your options and prepare for conversations with your doctor.
            </p>
            <button
              onClick={() => {
                onClose();
                if (onStartChat) onStartChat();
              }}
              className={`w-full py-2.5 ${colors.bg} text-white rounded-lg font-medium hover:opacity-90 transition-opacity`}
            >
              Chat With Us →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Sponsor Logo Bar Component
// ============================================
const SponsorBar = ({ className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col ${className}`}>
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center mb-2 flex-shrink-0">OpenOnco is Supported By</p>
    <div className="flex-1 flex items-center justify-center min-h-0">
      <img
        src="/sponsorlogobar.png"
        alt="Our Sponsors: DeciBio, Streck, Wilson Sonsini"
        className="w-full h-full object-contain"
      />
    </div>
  </div>
);

const HomePage = ({ onNavigate, persona, chatTestData }) => {
  const [searchQuery, setSearchQuery] = useState(''); // Quick Search state for R&D/Medical personas
  const { tests: allTests } = useAllTests();
  const [rdDigestSubscribed] = useState(() => {
    try { return localStorage.getItem('oo_rd_digest_subscribed') === '1'; } catch { return false; }
  });

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative">
        {/* Build timestamp */}
        <div className="absolute top-2 right-6 text-xs text-gray-400">
          Build: {BUILD_INFO.date}
        </div>

        {/* Banner */}
        <div className="bg-slate-50 rounded-2xl px-6 py-4 sm:px-8 sm:py-5 lg:px-10 lg:py-6 border border-slate-200 mb-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 text-center">
            {allTests.length} Advanced Molecular Tests: Collected, Curated, Explained
          </h1>
        </div>

        {/* Two-column layout: Left (Categories + Quick Search) | Right (Chat + Digest Signup) */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          {/* Left column: LifecycleNavigator + Quick Search */}
          <div className="lg:w-1/2 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex-1">
              <h3 className="text-lg font-bold text-slate-800 mb-3 text-center">Click on a Test Category to see Details and do Comparisons:</h3>
              <LifecycleNavigator onNavigate={onNavigate} />
            </div>

            {/* Quick Search */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-4">
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
            </div>
          </div>

          {/* Right column: Chat + Digest Signup */}
          <div className="lg:w-1/2 flex flex-col gap-4">
            {persona === 'medical' ? (
              <MRDChat compact className="flex-1" />
            ) : (
              <Chat
                persona={persona}
                testData={chatTestData}
                variant="sidebar"
                showModeToggle={false}
                resizable={false}
                showTitle={true}
                className="flex-1"
              />
            )}

            {/* Digest Signup */}
            {persona === 'medical' && (
              <DigestSignup compact className="mt-0" />
            )}
            {persona === 'rnd' && !rdDigestSubscribed && (
              <RDDigestSignup compact className="mt-0" />
            )}
          </div>
        </div>

        {/* Full-width SponsorBar */}
        <div className="mb-4">
          <SponsorBar />
        </div>

        {/* Test Cards (full width) */}
        <div className="mb-4">
          <TestShowcase 
            onNavigate={onNavigate} 
            hideNavigator={true} 
            showQuickSearch={false} 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </div>

        {/* Data Openness Overview (includes Top 3 ranking) - hidden on mobile */}
        <div className="hidden md:block mb-4">
          <DatabaseSummary />
        </div>
      </div>
    </div>
  );
};

// ============================================
// Database Summary Component (Reusable)
// ============================================

// Simple database stats for Data Download page
const DatabaseStatsSimple = () => {
  // Get tests via DAL
  const { tests: allTestData, loading } = useAllTests();
  const { testsByCategory } = useTestsByCategories();
  const { counts } = useTestCounts();

  // Derive stats from DAL data
  const { totalTests, totalDataPoints, allVendors, categoryParams, completions } = useMemo(() => {
    if (!allTestData.length) {
      return {
        totalTests: 0,
        totalDataPoints: 0,
        allVendors: new Set(),
        categoryParams: { MRD: 0, ECD: 0, CGP: 0, HCT: 0 },
        completions: { MRD: { completion: 0 }, ECD: { completion: 0 }, CGP: { completion: 0 }, HCT: { completion: 0 } },
      };
    }

    // Calculate params per category
    const catParams = {};
    for (const cat of ['MRD', 'ECD', 'CGP', 'HCT']) {
      const tests = testsByCategory[cat] || [];
      catParams[cat] = tests.length > 0 ? Object.keys(tests[0]).length : 0;
    }

    // Calculate data points
    let dataPoints = 0;
    for (const cat of ['MRD', 'ECD', 'CGP', 'HCT']) {
      const tests = testsByCategory[cat] || [];
      dataPoints += tests.length * catParams[cat];
    }

    // Get vendors
    const vendorSet = new Set(allTestData.map(t => t.vendor).filter(Boolean));

    // Calculate completions
    const comps = {};
    for (const cat of ['MRD', 'ECD', 'CGP', 'HCT']) {
      comps[cat] = calculateMinimumFieldStats(testsByCategory[cat] || [], cat);
    }

    return {
      totalTests: allTestData.length,
      totalDataPoints: dataPoints,
      allVendors: vendorSet,
      categoryParams: catParams,
      completions: comps,
    };
  }, [allTestData, testsByCategory]);

  const tier1Metrics = useMemo(() => calculateTier1Metrics(allTestData), [allTestData]);
  const mrdCompletion = completions.MRD;
  const ecdCompletion = completions.ECD;
  const cgpCompletion = completions.CGP;
  const hctCompletion = completions.HCT;
  const mrdParams = categoryParams.MRD;
  const ecdParams = categoryParams.ECD;
  const cgpParams = categoryParams.CGP;
  const hctParams = categoryParams.HCT;

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Database Overview</h3>
      
      {/* Main stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-800">{totalTests}</p>
          <p className="text-xs text-gray-500">Total Tests</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-800">{allVendors.size}</p>
          <p className="text-xs text-gray-500">Vendors</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-800">{totalDataPoints.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Data Points</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-800">4</p>
          <p className="text-xs text-gray-500">Categories</p>
        </div>
      </div>
      
      {/* Category breakdown with completion stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">{counts.MRD}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">MRD</p>
            <p className="text-[10px] text-gray-500">{mrdParams} fields</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 bg-orange-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${mrdCompletion.percentage}%` }}
                />
              </div>
              <span className="text-[9px] text-orange-600 font-medium whitespace-nowrap" title="Tests with all minimum fields filled">{mrdCompletion.complete}/{mrdCompletion.total}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">{counts.ECD}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">ECD</p>
            <p className="text-[10px] text-gray-500">{ecdParams} fields</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 bg-emerald-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${ecdCompletion.percentage}%` }}
                />
              </div>
              <span className="text-[9px] text-emerald-600 font-medium whitespace-nowrap" title="Tests with all minimum fields filled">{ecdCompletion.complete}/{ecdCompletion.total}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-100">
          <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">{counts.CGP}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">CGP</p>
            <p className="text-[10px] text-gray-500">{cgpParams} fields</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 bg-violet-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${cgpCompletion.percentage}%` }}
                />
              </div>
              <span className="text-[9px] text-violet-600 font-medium whitespace-nowrap" title="Tests with all minimum fields filled">{cgpCompletion.complete}/{cgpCompletion.total}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-100">
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">{counts.HCT}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">HCT</p>
            <p className="text-[10px] text-gray-500">{hctParams} fields</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${hctCompletion.percentage}%` }}
                />
              </div>
              <span className="text-[9px] text-purple-600 font-medium whitespace-nowrap" title="Tests with all minimum fields filled">{hctCompletion.complete}/{hctCompletion.total}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Citation Quality - Tier 1 Performance Metrics */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">Citation Quality</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Performance Metrics</span>
          <div className="relative group flex items-center">
            <span className="text-gray-400 hover:text-gray-600 cursor-help text-xs border-b border-dotted border-gray-400">?</span>
            <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <p className="font-semibold mb-2">Performance Metrics with Sources</p>
              <div className="space-y-1.5 text-gray-300">
                <p><span className="text-white">Core:</span> sensitivity, specificity, PPV, NPV</p>
                <p><span className="text-white">Detection Limit:</span> LOD, LOD95</p>
                <p><span className="text-white">Stage-Specific:</span> Stage I–IV sensitivity</p>
                <p><span className="text-white">MRD:</span> landmark & longitudinal sens/spec</p>
                <p><span className="text-white">Screening:</span> advanced adenoma sensitivity, lead time vs imaging</p>
              </div>
              <p className="mt-2 text-gray-400 text-[10px]">Tracks how many performance claims have citations.</p>
              <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xl font-bold text-blue-800">{tier1Metrics.totalTier1DataPoints}</p>
            <p className="text-[10px] text-blue-600">Performance Metrics</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xl font-bold text-blue-800">{tier1Metrics.citedDataPoints}</p>
            <p className="text-[10px] text-blue-600">Cited</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
            <p className="text-xl font-bold text-green-700">{tier1Metrics.citationCoverage}%</p>
            <p className="text-[10px] text-green-600">Coverage</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SourceDataPage = () => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Get tests via DAL
  const { tests: allTestsFromDal } = useAllTests();
  const { testsByCategory } = useTestsByCategories();
  const { counts } = useTestCounts();
  const { vendors } = useVendors();
  const { changelog } = useChangelog();

  // Build contribution lookup from vendors
  const contributionTestIds = useMemo(() => {
    const ids = new Set();
    for (const vendor of vendors) {
      for (const contribution of vendor.contributions || []) {
        ids.add(contribution.testId);
      }
    }
    return ids;
  }, [vendors]);

  // Calculate metrics for all categories
  const metrics = useMemo(() => ({
    MRD: calculateCategoryMetrics(testsByCategory.MRD || [], 'MRD'),
    ECD: calculateCategoryMetrics(testsByCategory.ECD || [], 'ECD'),
    CGP: calculateCategoryMetrics(testsByCategory.CGP || [], 'CGP'),
    HCT: calculateCategoryMetrics(testsByCategory.HCT || [], 'HCT'),
  }), [testsByCategory]);

  // Calculate aggregate metrics
  const aggregate = useMemo(() => {
    const allTests = allTestsFromDal;
    const allVendors = new Set(allTests.map(t => t.vendor));
    
    // Count tests with vendor contributions
    const testsWithVendorContribution = allTests.filter(t => contributionTestIds.has(t.id)).length;
    
    let totalTier1 = 0, citedTier1 = 0;
    Object.values(metrics).forEach(m => {
      if (m) { totalTier1 += m.tier1DataPoints; citedTier1 += m.tier1Cited; }
    });
    
    const totalDataPoints = Object.values(metrics).reduce((sum, m) => sum + (m?.totalDataPoints || 0), 0);
    const filledDataPoints = Object.values(metrics).reduce((sum, m) => sum + (m?.filledDataPoints || 0), 0);
    
    return {
      totalTests: allTests.length,
      totalVendors: allVendors.size,
      totalDataPoints,
      filledDataPoints,
      overallFillRate: totalDataPoints > 0 ? Math.round((filledDataPoints / totalDataPoints) * 100) : 0,
      tier1DataPoints: totalTier1,
      tier1Cited: citedTier1,
      tier1CitationRate: totalTier1 > 0 ? ((citedTier1 / totalTier1) * 100).toFixed(1) : 0,
      testsWithVendorContribution,
      vendorContributionRate: allTests.length > 0 ? ((testsWithVendorContribution / allTests.length) * 100).toFixed(1) : 0,
    };
  }, [metrics, allTestsFromDal, contributionTestIds]);

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateAllTestsJson = () => {
    const allData = {
      meta: {
        version: BUILD_INFO.date,
        generatedAt: new Date().toISOString(),
        source: 'OpenOnco',
        website: 'https://openonco.org',
        qualityMetrics: aggregate,
      },
      changelog: changelog,
      categories: {
        MRD: { name: 'Molecular Residual Disease', testCount: counts.MRD, tests: testsByCategory.MRD || [], metrics: metrics.MRD },
        ECD: { name: 'Early Cancer Detection', testCount: counts.ECD, tests: testsByCategory.ECD || [], metrics: metrics.ECD },
        CGP: { name: 'Comprehensive Genomic Profiling', testCount: counts.CGP, tests: testsByCategory.CGP || [], metrics: metrics.CGP },
        HCT: { name: 'Hereditary Cancer Testing', testCount: counts.HCT, tests: testsByCategory.HCT || [], metrics: metrics.HCT },
      },
      totalTests: aggregate.totalTests
    };
    return JSON.stringify(allData, null, 2);
  };

  const downloadJson = () => {
    downloadFile(generateAllTestsJson(), 'OpenOnco_AllTests.json', 'application/json;charset=utf-8;');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Data Download</h1>
        <p className="text-gray-600 mb-4">OpenOnco is committed to openness. All data is open and downloadable.</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-700">Last Updated: {BUILD_INFO.date}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 max-w-md mx-auto">
        {[{ id: 'overview', label: 'Overview' }, { id: 'quality', label: 'Data Quality' }, { id: 'download', label: 'Download' }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Hero Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-bold text-gray-900">{aggregate.totalTests}</p>
              <p className="text-sm text-gray-500 mt-1">Total Tests</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-bold text-gray-900">{aggregate.totalVendors}</p>
              <p className="text-sm text-gray-500 mt-1">Vendors</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-bold text-gray-900">{aggregate.totalDataPoints.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Data Points</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-bold text-gray-900">4</p>
              <p className="text-sm text-gray-500 mt-1">Categories</p>
            </div>
          </div>

          {/* Vendor Contribution Stats */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Vendor Contributions</h3>
                  <p className="text-sm text-gray-600">Tests with data verified or provided by vendors</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-emerald-600">{aggregate.vendorContributionRate}%</p>
                <p className="text-sm text-gray-500">{aggregate.testsWithVendorContribution} of {aggregate.totalTests} tests</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <div className="w-full bg-emerald-100 rounded-full h-3">
                <div 
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${aggregate.vendorContributionRate}%` }}
                />
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white animate-pulse">✓ VENDOR VERIFIED</span>
                  <span>Vendor completed full validation process - highest trust tier, sorted to top</span>
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">✓ VENDOR INPUT</span>
                  <span>Data contributed or corrected by vendor representative</span>
                </p>
              </div>
            </div>
          </div>

          {/* Category Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {['MRD', 'ECD', 'CGP', 'HCT'].map(category => {
              const m = metrics[category];
              const colors = CATEGORY_COLORS[category];
              if (!m) return null;
              
              return (
                <div key={category} className={`${colors.bg} ${colors.border} border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md`} onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${colors.accent} flex items-center justify-center text-white font-bold text-lg`}>{m.testCount}</div>
                      <div>
                        <h3 className="font-bold text-gray-900">{category}</h3>
                        <p className="text-xs text-gray-500">{m.fieldCount} fields tracked</p>
                      </div>
                    </div>
                    <QualityGrade percentage={m.minFieldCompletionRate} />
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">Baseline Complete</span>
                        <span className={`font-medium ${colors.text}`}>{m.testsWithAllMinFields}/{m.testCount}</span>
                      </div>
                      <div className="h-2 bg-white rounded-full overflow-hidden">
                        <div className={`h-full ${colors.accent} rounded-full transition-all duration-500`} style={{ width: `${m.minFieldCompletionRate}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">Citation Coverage</span>
                        <span className={`font-medium ${colors.text}`}>{m.tier1CitationRate}%</span>
                      </div>
                      <div className="h-2 bg-white rounded-full overflow-hidden">
                        <div className={`h-full ${colors.accent} rounded-full transition-all duration-500`} style={{ width: `${m.tier1CitationRate}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  {expandedCategory === category && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Required Field Completion</h4>
                      <div className="space-y-2">
                        {m.fieldCompletionRates.map(field => (
                          <div key={field.field} className="flex items-center gap-2">
                            <div className="w-28 text-xs text-gray-600 truncate" title={field.label}>{field.label}</div>
                            <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                              <div className={`h-full ${colors.accent} rounded-full`} style={{ width: `${field.percentage}%` }} />
                            </div>
                            <div className="w-12 text-xs text-right font-medium text-gray-700">{field.filled}/{field.total}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Citation Quality */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Citation Quality</h3>
              <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Performance Metrics</span>
              <div className="relative group inline-block ml-1">
                <span className="text-gray-400 hover:text-gray-600 cursor-help text-xs border-b border-dotted border-gray-400">?</span>
                <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <p className="font-semibold mb-2">Performance Metrics with Sources</p>
                  <div className="space-y-1.5 text-gray-300">
                    <p><span className="text-white">Core:</span> sensitivity, specificity, PPV, NPV</p>
                    <p><span className="text-white">Detection Limit:</span> LOD, LOD95</p>
                    <p><span className="text-white">Stage-Specific:</span> Stage I–IV sensitivity</p>
                    <p><span className="text-white">MRD:</span> landmark & longitudinal sens/spec</p>
                  </div>
                  <p className="mt-2 text-gray-400 text-[10px]">Tracks how many performance claims have citations.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-2xl font-bold text-blue-800">{aggregate.tier1DataPoints}</p>
                <p className="text-xs text-blue-600 mt-1">Performance Metrics</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-2xl font-bold text-blue-800">{aggregate.tier1Cited}</p>
                <p className="text-xs text-blue-600 mt-1">Cited</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-2xl font-bold text-green-700">{aggregate.tier1CitationRate}%</p>
                <p className="text-xs text-green-600 mt-1">Coverage</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Quality Tab */}
      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Quality Framework</h3>
            <p className="text-sm text-gray-600 mb-6">OpenOnco tracks data quality across multiple dimensions to ensure clinical reliability. Our Baseline Complete (BC) standard requires all minimum fields for each category to be filled.</p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {['MRD', 'ECD', 'CGP', 'HCT'].map(category => {
                const m = metrics[category];
                const colors = CATEGORY_COLORS[category];
                if (!m) return null;
                
                return (
                  <div key={category} className="text-center">
                    <div className="relative inline-flex items-center justify-center mb-3">
                      <CircularProgress value={m.minFieldCompletionRate} size={100} strokeWidth={10} color={category === 'MRD' ? 'orange' : category === 'ECD' ? 'emerald' : category === 'CGP' ? 'violet' : 'purple'} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-800">{m.minFieldCompletionRate}%</span>
                      </div>
                    </div>
                    <h4 className={`font-semibold ${colors.text}`}>{category}</h4>
                    <p className="text-xs text-gray-500">{m.testsWithAllMinFields} of {m.testCount} BC</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-Category Breakdown */}
          {['MRD', 'ECD', 'CGP', 'HCT'].map(category => {
            const m = metrics[category];
            const colors = CATEGORY_COLORS[category];
            if (!m) return null;
            
            return (
              <div key={category} className={`${colors.bg} ${colors.border} border rounded-xl p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">{category} Quality Breakdown</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{m.testCount} tests</span>
                    <QualityGrade percentage={m.minFieldCompletionRate} />
                  </div>
                </div>
                
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <p className="text-2xl font-bold text-gray-800">{m.overallFillRate}%</p>
                    <p className="text-xs text-gray-500">Overall Fill Rate</p>
                    <p className="text-[10px] text-gray-400 mt-1">{m.filledDataPoints.toLocaleString()} / {m.totalDataPoints.toLocaleString()} fields</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <p className="text-2xl font-bold text-gray-800">{m.minFieldCompletionRate}%</p>
                    <p className="text-xs text-gray-500">Baseline Complete</p>
                    <p className="text-[10px] text-gray-400 mt-1">{m.testsWithAllMinFields} / {m.testCount} tests</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <p className="text-2xl font-bold text-gray-800">{m.tier1CitationRate}%</p>
                    <p className="text-xs text-gray-500">Citation Coverage</p>
                    <p className="text-[10px] text-gray-400 mt-1">{m.tier1Cited} / {m.tier1DataPoints} cited</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-700">Required Fields ({m.minFieldsRequired})</h4>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {m.fieldCompletionRates.map(field => (
                      <div key={field.field} className="px-4 py-2.5 flex items-center gap-4">
                        <div className="w-32 text-sm text-gray-700">{field.label}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${colors.accent} rounded-full transition-all`} style={{ width: `${field.percentage}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-600 w-16 text-right">{field.filled}/{field.total}</span>
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          {field.citedPercentage > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{field.citedPercentage}% cited</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Download Tab */}
      {activeTab === 'download' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border-2 border-slate-300 p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Complete Dataset (All Categories)</h3>
                  <p className="text-sm text-gray-500">{aggregate.totalTests} tests • MRD + ECD + CGP + HCT • JSON format with quality metrics</p>
                </div>
              </div>
              <button onClick={downloadJson} className="flex items-center gap-2 px-6 py-3 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium text-white shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download JSON
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">What's Included</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Complete Test Data</h4>
                    <p className="text-xs text-gray-500">All fields for every test including performance metrics, regulatory status, and pricing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Source Citations</h4>
                    <p className="text-xs text-gray-500">Links to peer-reviewed publications, FDA documents, and vendor sources</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Quality Metrics</h4>
                    <p className="text-xs text-gray-500">Per-category and per-test quality scores, completion rates, and citation coverage</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Version Metadata</h4>
                    <p className="text-xs text-gray-500">Timestamp, version info, and database update history</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Data Sources & Attribution</h3>
            <p className="text-sm text-gray-600 mb-4">OpenOnco compiles publicly available information from multiple authoritative sources:</p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Vendor websites and product documentation</span></div>
              <div className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>FDA approval documents and PMA summaries</span></div>
              <div className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>Peer-reviewed publications and clinical trials</span></div>
              <div className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span><span>CMS coverage determinations</span></div>
            </div>
            <p className="text-xs text-gray-500 mt-4">This data is provided for informational purposes only. Always verify with official sources for clinical decision-making.</p>
          </div>
        </div>
      )}
    </div>
  );
};


// Tooltip components imported from ./components/tooltips

// ============================================
// Main App
// ============================================
export default function App() {
  // Map URL paths to page names
  // New plain-language URLs: /risk, /screen, /treat, /monitor
  // Legacy URLs redirect: /mrd→/monitor, /ecd→/screen, /trm→/monitor, /tds→/treat
  const pathToPage = {
    '/': 'home',
    '/submissions': 'submissions',
    '/how-it-works': 'how-it-works',
    '/data-sources': 'data-sources',
    '/faq': 'faq',
    '/learn': 'learn',
    '/about': 'about',
    '/privacy': 'privacy',
    '/terms': 'terms',
    // New plain-language category URLs
    '/risk': 'HCT',
    '/screen': 'ECD',
    '/treat': 'CGP',
    '/monitor': 'MRD',
    // Legacy URLs (kept for backward compatibility)
    '/mrd': 'MRD',
    '/ecd': 'ECD',
    '/trm': 'MRD',  // TRM merged into MRD
    '/tds': 'CGP',  // TDS renamed to CGP
    '/alz-blood': 'ALZ-BLOOD',
    // Persona direct access routes
    '/patients': 'home',
    '/patient': 'patient-landing',
    '/rnd': 'home',
    '/physician': 'home',
    '/clinician': 'home',
    '/clinicians': 'home',
    '/medical': 'home',
    // Patient journey routes
    '/patient/watching': 'patient-watching',
    '/patient/mrd': 'patient-watching',  // Alias for watching (MRD = monitoring)
    '/patient/lookup': 'patient-lookup',  // Path 1: Test lookup
    '/patient/appeal': 'patient-appeal',  // Path 3: Appeal help
    // Digest
    '/digest': 'digest',
    // Admin routes
    '/admin/discoveries': 'admin-discoveries',
    '/patient/screening': 'patient-screening',
    '/patient/choosing': 'patient-choosing',
    '/patient/measuring': 'patient-measuring',
    '/patient/insurance-denied': 'patient-insurance-denied',
    '/patient/financial-assistance': 'patient-financial-assistance'
  };

  // Map URL paths to personas (for direct persona access)
  const pathToPersona = {
    '/patients': 'patient',
    '/patient': 'patient',
    '/rnd': 'rnd',
    '/physician': 'medical',
    '/clinician': 'medical',
    '/clinicians': 'medical',
    '/medical': 'medical',
    // Patient journey routes
    '/patient/watching': 'patient',
    '/patient/mrd': 'patient',  // Alias for watching
    '/patient/lookup': 'patient',  // Path 1: Test lookup
    '/patient/appeal': 'patient',  // Path 3: Appeal help
    '/patient/screening': 'patient',
    '/patient/choosing': 'patient',
    '/patient/measuring': 'patient',
    '/patient/insurance-denied': 'patient',
    '/patient/financial-assistance': 'patient'
  };

  const pageToPath = {
    'home': '/',
    'submissions': '/submissions',
    'how-it-works': '/how-it-works',
    'data-sources': '/data-sources',
    'faq': '/faq',
    'learn': '/learn',
    'about': '/about',
    'privacy': '/privacy',
    'terms': '/terms',
    // Primary URLs (new plain-language)
    'HCT': '/risk',
    'ECD': '/screen',
    'CGP': '/treat',
    'MRD': '/monitor',
    'ALZ-BLOOD': '/alz-blood',
    // Patient routes
    'patient-landing': '/patient',
    // Patient journey routes
    'patient-watching': '/patient/watching',
    'patient-lookup': '/patient/lookup',  // Path 1: Test lookup
    'patient-appeal': '/patient/appeal',  // Path 3: Appeal help
    'digest': '/digest',
    'admin-discoveries': '/admin/discoveries',
    'patient-screening': '/patient/screening',
    'patient-choosing': '/patient/choosing',
    'patient-measuring': '/patient/measuring',
    'patient-insurance-denied': '/patient/insurance-denied',
    'patient-financial-assistance': '/patient/financial-assistance'
  };

  // Category URL prefixes for test routes (supports both old and new URLs)
  const categoryPrefixes = {
    // New plain-language prefixes
    'risk': 'HCT',
    'screen': 'ECD',
    'treat': 'CGP',
    'monitor': 'MRD',
    // Legacy prefixes (for backward compatibility)
    'mrd': 'MRD',
    'ecd': 'ECD',
    'trm': 'MRD',  // TRM tests now in MRD
    'tds': 'CGP',  // TDS renamed to CGP
    'alz-blood': 'ALZ-BLOOD'
  };

  // Initialize currentPage from URL path (handles /mrd/signatera style URLs)
  const getInitialPage = () => {
    const path = window.location.pathname.toLowerCase();

    // Check for comparison pages: /compare/signatera-vs-guardant-reveal
    const compareMatch = path.match(/^\/compare\/([a-z0-9-]+)$/);
    if (compareMatch) {
      const [, slug] = compareMatch;
      if (COMPARISON_PAGES[slug]) {
        return { page: 'compare', compareSlug: slug, testSlug: null, testId: null, persona: null };
      }
    }

    // Check for individual test routes: /monitor/signatera, /treat/foundationone, /mrd/test-name (legacy)
    const testRouteMatch = path.match(/^\/(risk|screen|treat|monitor|mrd|ecd|trm|tds|alz-blood)\/([a-z0-9-]+)$/);
    if (testRouteMatch) {
      const [, categoryPrefix, testSlug] = testRouteMatch;
      const category = categoryPrefixes[categoryPrefix];
      const test = getTestBySlug(testSlug, category);
      if (test) {
        return { page: category, testSlug, testId: test.id };
      }
    }

    // Standard page routing
    const urlPersona = pathToPersona[path] || null;
    return { page: pathToPage[path] || 'home', testSlug: null, testId: null, persona: urlPersona };
  };

  const initialRoute = getInitialPage();

  // Get MRD tests for WatchingWizard (via DAL)
  const { testsByCategory: appTestsByCategory } = useTestsByCategories();
  const mrdTestsForWizard = appTestsByCategory.MRD || [];
  // Get chat test data
  const chatTestData = useChatTestData();

  const [currentPage, setCurrentPage] = useState(initialRoute.page);
  const [initialSelectedTestId, setInitialSelectedTestId] = useState(initialRoute.testId);
  const [initialCompareIds, setInitialCompareIds] = useState(null);
  const [currentCompareSlug, setCurrentCompareSlug] = useState(initialRoute.compareSlug || null);
  const [submissionPrefill, setSubmissionPrefill] = useState(null);
  const [vendorInvite, setVendorInvite] = useState(null);
  // Digest confirmation banner
  const [showDigestConfirmed, setShowDigestConfirmed] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('digest_confirmed') === 'true';
  });
  // Key to force wizard remount when navigating home
  const [wizardResetKey, setWizardResetKey] = useState(0);
  // Persona from URL takes precedence, then localStorage, then default to 'rnd'
  // Persona determined by URL only: /patients = patient, everything else = rnd
  const [persona, setPersona] = useState(() => initialRoute.persona || 'rnd');
  // Show persona gate if no URL persona specified and no stored persona
  const [showPersonaGate, setShowPersonaGate] = useState(() => {
    return !initialRoute.persona && !getStoredPersona();
  });

  // Save persona to localStorage if it came from URL (so it persists)
  useEffect(() => {
    if (initialRoute.persona) {
      savePersona(initialRoute.persona);
      // Clean up URL to just show /
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Handle persona selection (from gate or selector)
  const handlePersonaChange = (newPersona) => {
    setPersona(newPersona);
    savePersona(newPersona);
    setShowPersonaGate(false);
    trackPersona(newPersona); // Track persona for feedback context
    analytics.identifyPersona(newPersona); // PostHog persona tracking
    window.dispatchEvent(new CustomEvent('personaChanged', { detail: newPersona }));

    // Navigate to home when switching away from a persona-specific page
    if (currentPage.startsWith('patient-')) {
      handleNavigate('home');
    }
  };

  // Check URL parameters on mount for direct test links and comparison links (backward compatibility)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const testId = params.get('test');
    const compareIds = params.get('compare');
    
      // ============================================
    // VENDOR INVITE URL HANDLING
    // ============================================
    // Parse vendor invite URL parameters:
    //   /submissions?invite=vendor&email=person@company.com&name=John%20Doe
    //
    // This allows vendors to be invited via custom links that:
    //   - Skip email verification (trusted link)
    //   - Pre-fill email and name fields
    //   - Auto-filter test dropdown to their company's tests
    //
    // See SubmissionsPage component (line ~4959) for full documentation
    // ============================================
    const inviteType = params.get('invite');
    const inviteEmail = params.get('email');
    const inviteName = params.get('name');
    
    if (inviteType === 'vendor' && inviteEmail) {
      setVendorInvite({ email: inviteEmail, name: inviteName });
      // Clear URL parameters after reading (clean URL, no reload)
      window.history.replaceState({}, '', window.location.pathname);
      return; // Don't process other params
    }

    // Security: Validate test IDs to prevent injection attacks
    // Valid format: lowercase letters followed by hyphen and digits (e.g., mrd-1, ecd-12, tds-5)
    const isValidTestId = (id) => /^[a-z]+-\d+$/.test(id);

    if (category && ['MRD', 'ECD', 'CGP', 'HCT', 'ALZ-BLOOD'].includes(category)) {
      setCurrentPage(category);
      if (testId && isValidTestId(testId)) {
        setInitialSelectedTestId(testId);
      }
      if (compareIds) {
        // Parse comma-separated test IDs for comparison, validating each one
        const ids = compareIds.split(',')
          .map(id => id.trim())
          .filter(id => id && isValidTestId(id));
        if (ids.length >= 2) {
          setInitialCompareIds(ids);
        }
      }
      // Clear URL parameters after reading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  // Listen for persona changes to force re-render
  useEffect(() => {
    const handlePersonaChange = (e) => setPersona(e.detail);
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();

      // Check for individual test routes: /mrd/test-name
      const testRouteMatch = path.match(/^\/(mrd|ecd|trm|tds|alz-blood)\/([a-z0-9-]+)$/);
      if (testRouteMatch) {
        const [, categoryPrefix, testSlug] = testRouteMatch;
        const category = categoryPrefixes[categoryPrefix];
        const test = getTestBySlug(testSlug, category);
        if (test) {
          setCurrentPage(category);
          setInitialSelectedTestId(test.id);
          return;
        }
      }

      // Check for comparison routes: /compare/slug
      const compareMatch = path.match(/^\/compare\/([a-z0-9-]+)$/);
      if (compareMatch) {
        const [, slug] = compareMatch;
        if (COMPARISON_PAGES[slug]) {
          setCurrentPage('compare');
          setCurrentCompareSlug(slug);
          setInitialSelectedTestId(null);
          return;
        }
      }

      const page = pathToPage[path] || 'home';
      setCurrentPage(page);
      setInitialSelectedTestId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Emit feature flags to DOM for Vercel Analytics tracking
  useEffect(() => {
    const flags = {
      persona: persona.toLowerCase().replace(/[^a-z]/g, '-'),
      page: currentPage,
    };
    document.documentElement.dataset.flags = JSON.stringify(flags);
  }, [persona, currentPage]);

  const handleNavigate = (page, testIdOrOptions = null) => {
    // Handle options object for special navigation (like prefill for submissions)
    let testId = null;
    if (testIdOrOptions && typeof testIdOrOptions === 'object') {
      // It's an options object
      if (testIdOrOptions.prefillTest) {
        setSubmissionPrefill(testIdOrOptions);
      }
    } else {
      testId = testIdOrOptions;
    }
    
    // Track navigation with feature flags (Vercel Analytics)
    const personaFlag = `persona-${persona.toLowerCase().replace(/[^a-z]/g, '-')}`;
    if (['MRD', 'ECD', 'CGP', 'HCT'].includes(page)) {
      track('category_viewed', {
        category: page,
        from_test_link: testId !== null
      }, {
        flags: [personaFlag, `category-${page.toLowerCase()}`]
      });
      // PostHog tracking
      analytics.trackCategoryView(page, categoryMeta[page]?.tests?.length || 0);
    }

    // Track individual test view when navigating directly to a test
    if (testId && ['MRD', 'ECD', 'CGP', 'HCT', 'TDS', 'TRM'].includes(page)) {
      const tests = categoryMeta[page]?.tests || [];
      const test = tests.find(t => t.id === testId);
      if (test) {
        analytics.trackTestView(test, 'direct_navigation', page);
      }
    }

    if (page !== currentPage && !['MRD', 'ECD', 'CGP', 'HCT'].includes(page)) {
      track('page_viewed', { 
        page: page 
      }, { 
        flags: [personaFlag] 
      });
      // PostHog tracking
      analytics.trackPageView(page, { persona });
    }
    
    // Always update state and scroll, even if already on the page
    setCurrentPage(page);
    setInitialSelectedTestId(testId || null);
    trackPageVisit(page); // Track for feedback context
    // Reset wizard when navigating to home/patient-landing (forces remount)
    if (page === 'home' || page === 'patient-landing') {
      setWizardResetKey(k => k + 1);
    }
    // Clear compare IDs when navigating away from category pages
    if (!['MRD', 'ECD', 'CGP', 'HCT', 'ALZ-BLOOD'].includes(page)) {
      setInitialCompareIds(null);
    }
    // Update URL without page reload
    const newPath = pageToPath[page] || '/';
    window.history.pushState({page}, '', newPath);
    // Always scroll to top when navigating (use requestAnimationFrame to ensure it happens after render)
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  // Get SEO config for current page
  const getSEOForPage = () => {
    const seoConfig = PAGE_SEO[currentPage] || PAGE_SEO.home;
    let structuredData = null;

    // Add structured data based on page type
    if (currentPage === 'home') {
      structuredData = generateOrganizationSchema();
    } else if (['MRD', 'ECD', 'CGP', 'HCT', 'ALZ-BLOOD'].includes(currentPage)) {
      const categoryMeta = createCategoryMeta();
      const tests = categoryMeta[currentPage]?.tests || [];
      structuredData = generateCategorySchema(currentPage, tests);
    }

    return { ...seoConfig, structuredData };
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        // Patient persona goes directly to MRD WatchingWizard
        if (persona === 'patient') {
          return (
            <WatchingWizard
              key={wizardResetKey}
              onNavigate={handleNavigate}
              onBack={null}  // No back button on home
              onComplete={() => {}}
              testData={mrdTestsForWizard}
            />
          );
        }
        if (persona === 'medical') {
          return <MRDNavigator testData={chatTestData} onNavigate={handleNavigate} currentPage={currentPage} />;
        }
        return <HomePage onNavigate={handleNavigate} persona={persona} chatTestData={chatTestData} />;
      case 'learn': return <LearnPage onNavigate={handleNavigate} />;
      case 'compare': return <ComparePage comparisonSlug={currentCompareSlug} onNavigate={handleNavigate} />;
      case 'MRD': case 'ECD': case 'CGP': case 'HCT': case 'ALZ-BLOOD': return <CategoryPage key={`${currentPage}-${persona}`} category={currentPage} initialSelectedTestId={initialSelectedTestId} initialCompareIds={initialCompareIds} onClearInitialTest={() => { setInitialSelectedTestId(null); setInitialCompareIds(null); }} />;
      case 'data-sources': return <SourceDataPage />;
      case 'how-it-works': return <HowItWorksPage />;
      case 'submissions': return <SubmissionsPage prefill={submissionPrefill} onClearPrefill={() => setSubmissionPrefill(null)} vendorInvite={vendorInvite} onClearVendorInvite={() => setVendorInvite(null)} />;
      case 'faq': return <FAQPage />;
      case 'about': return <AboutPage />;
      case 'privacy': return <PrivacyPage />;
      case 'terms': return <TermsPage />;
      case 'digest': return <DigestPage />;
      // Admin routes
      case 'admin-discoveries': return <AdminDiscoveriesPage />;
      // Patient journey routes (keep for direct navigation)
      case 'patient-landing':
      case 'patient-watching': return (
        <WatchingWizard
          key={wizardResetKey}
          onNavigate={handleNavigate}
          onBack={null}
          onComplete={() => {}}
          testData={mrdTestsForWizard}
        />
      );
      case 'patient-lookup': return (
        <TestLookupWizard
          testData={mrdTestsForWizard}
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('patient-landing')}
        />
      );
      case 'patient-appeal': return (
        <AppealWizard
          testData={mrdTestsForWizard}
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('patient-landing')}
        />
      );
      case 'patient-choosing': return <div className="max-w-4xl mx-auto px-6 py-12"><h1 className="text-2xl font-bold text-slate-900">Choosing Journey</h1><p className="text-slate-600 mt-4">Coming soon...</p></div>;
      case 'patient-measuring': return <div className="max-w-4xl mx-auto px-6 py-12"><h1 className="text-2xl font-bold text-slate-900">Measuring Journey</h1><p className="text-slate-600 mt-4">Coming soon...</p></div>;
      case 'patient-insurance-denied': return (
        <AppealWizard
          testData={mrdTestsForWizard}
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('patient-landing')}
        />
      );
      case 'patient-financial-assistance': return <div className="max-w-4xl mx-auto px-6 py-12"><h1 className="text-2xl font-bold text-slate-900">Financial Assistance</h1><p className="text-slate-600 mt-4">Coming soon...</p></div>;
      default: return <HomePage onNavigate={handleNavigate} chatTestData={chatTestData} />;
    }
  };

  const seoConfig = getSEOForPage();
  const isFullPageMode = false;

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <SEO
          title={seoConfig.title}
          description={seoConfig.description}
          path={seoConfig.path}
          structuredData={seoConfig.structuredData}
        />
        {showPersonaGate && <PersonaGate onSelect={handlePersonaChange} />}
        <div className="min-h-screen bg-gray-50 flex flex-col" style={{ background: isFullPageMode ? '#F5F3EE' : undefined }}>
          {!isFullPageMode && <Header currentPage={currentPage} onNavigate={handleNavigate} persona={persona} onPersonaChange={handlePersonaChange} />}
          {showDigestConfirmed && !isFullPageMode && (
            <div className="bg-emerald-600 text-white text-center py-2.5 px-4 text-sm font-medium">
              Your MRD Weekly Digest subscription is confirmed! You'll receive your first digest next Monday.
              <button onClick={() => { setShowDigestConfirmed(false); window.history.replaceState({}, '', '/'); }} className="ml-3 underline hover:no-underline">Dismiss</button>
            </div>
          )}
          <main className="flex-1" key={`main-${persona}`}>{renderPage()}</main>
          {!isFullPageMode && <Footer />}
          <Analytics />
        </div>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
