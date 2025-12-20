import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Analytics } from '@vercel/analytics/react';
import { track } from '@vercel/analytics';
import {
  mrdTestData,
  ecdTestData,
  trmTestData,
  tdsTestData,
  // ALZ DISABLED: alzBloodTestData,
  DATABASE_CHANGELOG,
  RECENTLY_ADDED_TESTS,
  // ALZ DISABLED: ALZ_DATABASE_CHANGELOG,
  // ALZ DISABLED: ALZ_RECENTLY_ADDED_TESTS,
  getChangelog,
  getRecentlyAddedTests,
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
  GLOSSARY,
  CATEGORY_STANDARDS,
  STANDARDS_BODIES,
  COMPANY_CONTRIBUTIONS,
  VENDOR_VERIFIED,
} from './data';

// ALZ DISABLED: Placeholder constants to prevent errors
const alzBloodTestData = [];
const ALZ_DATABASE_CHANGELOG = [];
const ALZ_RECENTLY_ADDED_TESTS = [];

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
// Vendor Badges - Awards and recognition
// ============================================
const VENDOR_BADGES = {
  'Exact Sciences': [
    { id: 'openness-leader', icon: '📊', label: 'Openness Leader', tooltip: 'Top 3 in OpenOnco Data Openness Ranking' }
  ],
};

// ============================================
// Tier 1 Citation Metrics - Dynamic calculation
// ============================================
// Tier 1 = Performance metrics that MUST have citations
// These are the clinically critical numbers patients/clinicians rely on
const TIER1_FIELDS = [
  'sensitivity', 'specificity', 'ppv', 'npv',
  'lod', 'lod95',
  'stageISensitivity', 'stageIISensitivity', 'stageIIISensitivity', 'stageIVSensitivity',
  'landmarkSensitivity', 'landmarkSpecificity',
  'longitudinalSensitivity', 'longitudinalSpecificity',
  'advancedAdenomaSensitivity',
  'leadTimeVsImaging'
];

const calculateTier1Metrics = (allTestData) => {
  let totalDataPoints = 0;
  let citedDataPoints = 0;
  
  allTestData.forEach(test => {
    TIER1_FIELDS.forEach(field => {
      const value = test[field];
      // Check if field has a non-null, non-empty value
      if (value != null && value !== '' && value !== 'N/A') {
        totalDataPoints++;
        // Check if corresponding citation field exists and has value
        const citationField = `${field}Citations`;
        const citation = test[citationField];
        if (citation && citation.trim() !== '') {
          citedDataPoints++;
        }
      }
    });
  });
  
  const coverage = totalDataPoints > 0 ? (citedDataPoints / totalDataPoints * 100) : 0;
  
  return {
    totalTier1DataPoints: totalDataPoints,
    citedDataPoints: citedDataPoints,
    citationCoverage: coverage.toFixed(1)
  };
};

// ============================================
// Category Quality Metrics Calculator
// ============================================
const calculateCategoryMetrics = (tests, category) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!tests || tests.length === 0) return null;
  
  const minFields = minParams?.core?.map(p => p.key) || [];
  const allFields = tests.length > 0 ? Object.keys(tests[0]) : [];
  const dataFields = allFields.filter(f => !f.endsWith('Citations') && !f.endsWith('Citation') && !f.endsWith('Notes') && f !== 'id');
  
  const hasVal = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';
  const hasCite = (val) => val && String(val).trim() !== '' && val !== 'N/A';
  
  const minFieldCompletion = tests.map(test => {
    const filled = minFields.filter(field => hasVal(test[field])).length;
    return { test: test.name, filled, total: minFields.length, complete: filled === minFields.length };
  });
  
  const testsWithAllMinFields = minFieldCompletion.filter(t => t.complete).length;
  
  let totalFieldSlots = 0, filledFieldSlots = 0;
  tests.forEach(test => {
    dataFields.forEach(field => {
      totalFieldSlots++;
      if (hasVal(test[field])) filledFieldSlots++;
    });
  });
  
  let tier1DataPoints = 0, tier1Cited = 0;
  tests.forEach(test => {
    TIER1_FIELDS.forEach(field => {
      const value = test[field];
      if (value != null && value !== '' && value !== 'N/A') {
        tier1DataPoints++;
        const citationField = `${field}Citations`;
        if (hasCite(test[citationField])) tier1Cited++;
      }
    });
  });
  
  const fieldCompletionRates = minFields.map(field => {
    const filled = tests.filter(t => hasVal(t[field])).length;
    const citationField = `${field}Citations`;
    const cited = tests.filter(t => hasCite(t[citationField])).length;
    return {
      field,
      label: minParams.core.find(p => p.key === field)?.label || field,
      filled,
      total: tests.length,
      percentage: Math.round((filled / tests.length) * 100),
      cited,
      citedPercentage: filled > 0 ? Math.round((cited / filled) * 100) : 0,
    };
  });
  
  return {
    testCount: tests.length,
    fieldCount: dataFields.length,
    totalDataPoints: tests.length * dataFields.length,
    filledDataPoints: filledFieldSlots,
    overallFillRate: totalFieldSlots > 0 ? Math.round((filledFieldSlots / totalFieldSlots) * 100) : 0,
    minFieldsRequired: minFields.length,
    testsWithAllMinFields,
    minFieldCompletionRate: Math.round((testsWithAllMinFields / tests.length) * 100),
    tier1DataPoints,
    tier1Cited,
    tier1CitationRate: tier1DataPoints > 0 ? Math.round((tier1Cited / tier1DataPoints) * 100) : 0,
    fieldCompletionRates,
    minFieldCompletion,
  };
};

// Category color schemes for quality dashboard
const CATEGORY_COLORS = {
  MRD: { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500', text: 'text-orange-700' },
  ECD: { bg: 'bg-emerald-50', border: 'border-emerald-200', accent: 'bg-emerald-500', text: 'text-emerald-700' },
  TRM: { bg: 'bg-sky-50', border: 'border-sky-200', accent: 'bg-sky-500', text: 'text-sky-700' },
  TDS: { bg: 'bg-violet-50', border: 'border-violet-200', accent: 'bg-violet-500', text: 'text-violet-700' },
};

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

// Helper to check if vendor has badges
const getVendorBadges = (vendor) => {
  if (!vendor) return [];
  // Check exact match first
  if (VENDOR_BADGES[vendor]) return VENDOR_BADGES[vendor];
  // Check if vendor name contains a badge key
  for (const [key, badges] of Object.entries(VENDOR_BADGES)) {
    if (vendor.includes(key) || key.includes(vendor)) return badges;
  }
  return [];
};

// VendorBadge component - displays badges next to vendor name
const VendorBadge = ({ vendor, size = 'sm' }) => {
  const badges = getVendorBadges(vendor);
  if (badges.length === 0) return null;
  
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
  
  return (
    <>
      {badges.map(badge => (
        <span 
          key={badge.id}
          className={`${sizeClasses[size]} cursor-help ml-1 inline-flex items-center`}
          title={badge.tooltip}
        >
          <span className="hover:scale-110 transition-transform">{badge.icon}</span>
        </span>
      ))}
    </>
  );
};


// CompanyCommunicationBadge component - displays CC badge for company-submitted tests
const CompanyCommunicationBadge = ({ testId, size = 'sm' }) => {
  const contribution = COMPANY_CONTRIBUTIONS[testId];
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


// Product Type Badge Component
const ProductTypeBadge = ({ productType, size = 'sm' }) => {
  const config = getProductTypeConfig(productType);
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };
  
  return (
    <span 
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} ${config.bgColor} ${config.textColor} border ${config.borderColor} rounded-full font-medium`}
      title={config.description}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

// ============================================
// Performance Metric with Sample Size Warning
// ============================================
// Displays sensitivity/specificity with warning when 100% comes from small cohort
const PerformanceMetricWithWarning = ({ 
  value, 
  label, 
  test, 
  metric = 'sensitivity', // 'sensitivity' or 'specificity'
  size = 'lg' // 'sm', 'md', 'lg'
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  if (value == null) return null;
  
  // Check if this metric needs a warning (100% or ≥99.9% with small sample or analytical validation)
  const needsWarning = (value >= 99.9 || value === 100) && 
    (test.smallSampleWarning || test.analyticalValidationWarning);
  
  // Get warning details
  const getWarningText = () => {
    if (test.analyticalValidationWarning) {
      return 'Analytical validation only - clinical performance may differ';
    }
    if (test.smallSampleWarning && test.validationCohortSize) {
      return `Small validation cohort (n=${test.validationCohortSize})`;
    }
    if (test.smallSampleWarning) {
      return 'Small validation cohort - interpret with caution';
    }
    return null;
  };
  
  const warningText = getWarningText();
  
  const sizeClasses = {
    sm: { value: 'text-lg', label: 'text-[10px]' },
    md: { value: 'text-xl', label: 'text-xs' },
    lg: { value: 'text-2xl', label: 'text-xs' }
  };
  
  // Format display value
  const displayValue = typeof value === 'number' 
    ? `${value}${test[`${metric}Plus`] ? '+' : ''}%`
    : `${value}${String(value).includes('%') ? '' : '%'}`;
  
  return (
    <div className="text-center relative">
      <div className="relative inline-block">
        <p className={`font-bold ${needsWarning ? 'text-amber-600' : 'text-emerald-600'} ${sizeClasses[size].value}`}>
          {displayValue}
          {needsWarning && (
            <span 
              className="inline-block ml-1 cursor-help"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
            >
              <svg className="w-4 h-4 inline text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          )}
        </p>
        {/* Warning Tooltip */}
        {needsWarning && showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-amber-900 text-white text-xs rounded-lg shadow-xl">
            <div className="font-semibold mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Interpret with caution
            </div>
            <div className="text-amber-100">{warningText}</div>
            {test.validationCohortStudy && (
              <div className="text-amber-200 mt-1 text-[10px]">
                Study: {test.validationCohortStudy}
              </div>
            )}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-amber-900" />
          </div>
        )}
      </div>
      <p className={`text-gray-500 ${sizeClasses[size].label}`}>{label}</p>
    </div>
  );
};

// ============================================
// Glossary Tooltip Component
// ============================================
const GlossaryTooltip = ({ termKey, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const term = GLOSSARY[termKey];
  
  if (!term) return children || null;
  
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center gap-0.5 text-inherit border-b border-dotted border-current cursor-help hover:text-emerald-600 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children || term.term}
        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl">
          <div className="font-semibold mb-1">{term.term}</div>
          <div className="text-gray-300 text-xs mb-2">{term.definition}</div>
          <a 
            href={term.sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            onClick={(e) => e.stopPropagation()}
          >
            Source: {term.source}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  );
};

// ============================================
// External Resource Link Component
// ============================================
const ExternalResourceLink = ({ resource, compact = false }) => {
  const sourceColors = {
    'NCI': 'bg-blue-50 text-blue-700 border-blue-200',
    'FDA': 'bg-purple-50 text-purple-700 border-purple-200',
    'BLOODPAC': 'bg-orange-50 text-orange-700 border-orange-200',
    'FRIENDS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'NCCN': 'bg-violet-50 text-violet-700 border-violet-200',
    'LUNGEVITY': 'bg-pink-50 text-pink-700 border-pink-200',
    'ILSA': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'ASCO': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  
  const typeIcons = {
    'definition': '📖',
    'standards': '📋',
    'regulatory': '⚖️',
    'research': '🔬',
    'guidelines': '📜',
    'patient-education': '💡',
    'education': '🎓',
    'overview': '📄',
  };
  
  if (compact) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sourceColors[resource.source] || 'bg-gray-50 text-gray-700 border-gray-200'} hover:shadow-sm transition-shadow`}
      >
        <span>{typeIcons[resource.type] || '🔗'}</span>
        <span>{resource.title}</span>
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  }
  
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all bg-white group"
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{typeIcons[resource.type] || '🔗'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 group-hover:text-emerald-600 transition-colors">
              {resource.title}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{resource.description}</p>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${sourceColors[resource.source] || 'bg-gray-100 text-gray-600'}`}>
            {resource.source}
          </span>
        </div>
      </div>
    </a>
  );
};

// ============================================
// External Resources Section Component
// ============================================
const ExternalResourcesSection = ({ category, compact = false }) => {
  const categoryResources = EXTERNAL_RESOURCES[category] || [];
  const generalResources = EXTERNAL_RESOURCES.general || [];
  const standards = CATEGORY_STANDARDS[category];
  
  // Filter resources for clinician/researcher audience
  const filteredCategoryResources = categoryResources.filter(r => 
    r.audience.includes('clinician') || r.audience.includes('researcher')
  );
  const filteredGeneralResources = generalResources.filter(r => 
    r.audience.includes('clinician')
  );
  
  // Get primary resources for compact view
  const primaryResources = filteredCategoryResources.filter(r => r.isPrimary);
  
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {primaryResources.slice(0, 3).map(resource => (
          <ExternalResourceLink key={resource.id} resource={resource} compact />
        ))}
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Standards & Resources</h3>
        {standards && (
          <span className="text-xs text-gray-500 italic">{standards.attribution}</span>
        )}
      </div>
      
      {/* Category-specific resources */}
      {filteredCategoryResources.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Key References</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredCategoryResources.slice(0, 4).map(resource => (
              <ExternalResourceLink key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      )}
      
      {/* General resources */}
      {filteredGeneralResources.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">General Resources</h4>
          <div className="flex flex-wrap gap-2">
            {filteredGeneralResources.map(resource => (
              <ExternalResourceLink key={resource.id} resource={resource} compact />
            ))}
          </div>
        </div>
      )}
      
      {/* Standards attribution */}
      {standards && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">Referenced standards:</span>
            <a 
              href={standards.primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {standards.primary}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            {standards.secondary && (
              <>
                <span className="text-gray-400">•</span>
                <a 
                  href={standards.secondaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {standards.secondary}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Markdown Renderer Component
// ============================================
const Markdown = ({ children, className = '' }) => {
  if (!children) return null;
  
  // Sanitize href to prevent XSS via javascript:, data:, etc.
  const sanitizeHref = (url) => {
    try {
      const parsed = new URL(url, window.location.origin);
      return ['http:', 'https:'].includes(parsed.protocol) ? url : null;
    } catch {
      return null;
    }
  };
  
  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let listType = null;
    let key = 0;

    const flushList = () => {
      if (currentList.length > 0) {
        if (listType === 'ul') {
          elements.push(<ul key={key++} className="list-disc list-inside my-2 space-y-1">{currentList}</ul>);
        } else {
          elements.push(<ol key={key++} className="list-decimal list-inside my-2 space-y-1">{currentList}</ol>);
        }
        currentList = [];
        listType = null;
      }
    };

    const parseInline = (text) => {
      const parts = [];
      let remaining = text;
      let partKey = 0;

      while (remaining.length > 0) {
        // Bold: **text** or __text__
        let match = remaining.match(/^(\*\*|__)(.+?)\1/);
        if (match) {
          parts.push(<strong key={partKey++} className="font-semibold">{parseInline(match[2])}</strong>);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Italic: *text* or _text_
        match = remaining.match(/^(\*|_)(.+?)\1/);
        if (match) {
          parts.push(<em key={partKey++} className="italic">{parseInline(match[2])}</em>);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Inline code: `code`
        match = remaining.match(/^`([^`]+)`/);
        if (match) {
          parts.push(<code key={partKey++} className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{match[1]}</code>);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Links: [text](url)
        match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
          const safeHref = sanitizeHref(match[2]);
          if (safeHref) {
            parts.push(<a key={partKey++} href={safeHref} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700">{match[1]}</a>);
          } else {
            parts.push(<span key={partKey++} className="text-gray-500">{match[1]}</span>);
          }
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Plain text up to next special char
        match = remaining.match(/^[^*_`\[]+/);
        if (match) {
          parts.push(match[0]);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Single special char that didn't match
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      }

      return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
    };

    // Helper to parse table cells from a row
    const parseTableRow = (line) => {
      return line
        .split('|')
        .map(cell => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (arr[0] !== '' && idx === 0) || (arr[arr.length-1] !== '' && idx === arr.length - 1))
        .filter(cell => cell !== '');
    };

    // Check if a line is a table separator (|---|---|)
    const isTableSeparator = (line) => {
      return /^\|?[\s\-:|]+\|?$/.test(line) && line.includes('-');
    };

    // Check if a line looks like a table row
    const isTableRow = (line) => {
      return line.includes('|') && !isTableSeparator(line);
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Table detection: look for pattern of row, separator, rows
      if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushList();
        
        // Parse header
        const headerCells = parseTableRow(line);
        
        // Skip separator
        i += 2;
        
        // Parse body rows
        const bodyRows = [];
        while (i < lines.length && isTableRow(lines[i])) {
          bodyRows.push(parseTableRow(lines[i]));
          i++;
        }
        
        // Render table
        elements.push(
          <div key={key++} className="overflow-x-auto my-2">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {headerCells.map((cell, idx) => (
                    <th key={idx} className="border border-gray-300 px-3 py-1.5 text-left font-semibold text-gray-700">
                      {parseInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="border border-gray-300 px-3 py-1.5 text-gray-600">
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        flushList();
        const level = headerMatch[1].length;
        const content = parseInline(headerMatch[2]);
        const headerClasses = {
          1: 'text-lg font-bold mt-3 mb-2',
          2: 'text-base font-bold mt-3 mb-1.5',
          3: 'text-sm font-semibold mt-2 mb-1',
          4: 'text-sm font-semibold mt-2 mb-1',
          5: 'text-sm font-medium mt-1 mb-1',
          6: 'text-sm font-medium mt-1 mb-1'
        };
        const Tag = `h${level}`;
        elements.push(<Tag key={key++} className={headerClasses[level]}>{content}</Tag>);
        i++;
        continue;
      }

      // Unordered list
      const ulMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        currentList.push(<li key={key++}>{parseInline(ulMatch[1])}</li>);
        i++;
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        currentList.push(<li key={key++}>{parseInline(olMatch[1])}</li>);
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        flushList();
        i++;
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(<p key={key++} className="my-1">{parseInline(line)}</p>);
      i++;
    }

    flushList();
    return elements;
  };

  return <div className={className}>{renderMarkdown(children)}</div>;
};

// Helper to get persona from localStorage (used by chat components)
const getStoredPersona = () => {
  try {
    return localStorage.getItem('openonco-persona');
  } catch {
    return null;
  }
};

// ============================================
// Lifecycle Navigator Components
// ============================================

// Get test counts dynamically - will be populated after test data is defined
const getTestCount = (stageId) => {
  switch(stageId) {
    case 'ECD': return typeof ecdTestData !== 'undefined' ? ecdTestData.length : 13;
    case 'TDS': return 8; // Placeholder until TDS data exists
    case 'TRM': return typeof trmTestData !== 'undefined' ? trmTestData.length : 9;
    case 'MRD': return typeof mrdTestData !== 'undefined' ? mrdTestData.length : 15;
    default: return 0;
  }
};

// Get sample tests for each stage
const getSampleTests = (stageId) => {
  switch(stageId) {
    case 'ECD': return ['Galleri', 'Shield', 'Cancerguard', 'Freenome CRC', 'GRAIL NHS', 'Cologuard Plus'];
    case 'TDS': return ['FoundationOne CDx', 'Guardant360 CDx', 'Tempus xT CDx', 'MSK-IMPACT', 'MI Cancer Seek', 'OncoExTra'];
    case 'TRM': return ['Reveal TRM', 'Signatera (IO Monitoring)', 'NeXT Personal', 'RaDaR', 'Oncodetect'];
    case 'MRD': return ['Signatera', 'Reveal MRD', 'RaDaR', 'Oncodetect', 'Invitae Personalis', 'FoundationOne Tracker'];
    default: return [];
  }
};

// Arrow button component for lifecycle flow
const LifecycleFlowArrow = ({ direction, color }) => {
  const colors = lifecycleColorClasses[color];
  
  const positions = {
    right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
    down: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
    up: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };
  
  const rotations = {
    right: 'rotate-0',
    down: 'rotate-90',
    left: 'rotate-180',
    up: '-rotate-90',
  };
  
  return (
    <div className={`absolute z-20 ${positions[direction]}`}>
      <div className={`
        w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200
        bg-white shadow-md border ${colors.border}
        group-hover:${colors.bg} group-hover:shadow-lg group-hover:scale-110
        ${rotations[direction]}
      `}>
        <svg 
          className={`w-3.5 h-3.5 transition-colors duration-200 ${colors.textLight} group-hover:text-white`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

// Scrolling test names marquee
const LifecycleScrollingTests = ({ tests, color }) => {
  const colors = lifecycleColorClasses[color];
  const testString = tests.join('  •  ');
  const scrollContent = `${testString}  •  ${testString}  •  `;
  
  return (
    <div className={`mt-3 pt-2 border-t transition-colors duration-200 overflow-hidden ${colors.border}`}>
      <div className="relative">
        <div 
          className="flex whitespace-nowrap text-xs text-gray-400 group-hover:text-gray-600"
          style={{
            animation: 'lifecycleScroll 15s linear infinite',
          }}
        >
          <span className="pr-4">{scrollContent}</span>
        </div>
      </div>
    </div>
  );
};

// Individual lifecycle stage card
const LifecycleStageCard = ({ stage, isHovered, onClick, onMouseEnter, onMouseLeave, testCount }) => {
  const colors = lifecycleColorClasses[stage.color];
  const sampleTests = getSampleTests(stage.id);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        relative px-5 py-9 rounded-xl text-left transition-all duration-200 h-full
        border-2 shadow-md cursor-pointer
        ${isHovered 
          ? `${colors.bgMedium} ${colors.borderActive} shadow-lg scale-[1.02]` 
          : `${colors.bgLight} ${colors.border} hover:shadow-lg hover:scale-[1.01]`
        }
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`
          w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200
          ${isHovered 
            ? `${colors.bg} text-white shadow-md` 
            : `${colors.bgMedium} ${colors.text}`
          }
        `}>
          <span className="text-2xl">{stage.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-bold leading-tight transition-colors duration-200 ${
            isHovered ? colors.textDark : colors.text
          }`}>
            {stage.phase}: {stage.acronym}
          </h3>
          <p className={`text-sm font-semibold mt-1 transition-colors duration-200 ${
            isHovered ? colors.textDark : colors.text
          }`}>
            {stage.name}
          </p>
          <p className={`text-sm font-semibold mt-1 transition-colors duration-200 ${colors.text}`}>
            {`Explore ${testCount} tests →`}
          </p>
        </div>
      </div>
      
      <LifecycleScrollingTests 
        tests={sampleTests} 
        isHighlighted={isHovered}
        color={stage.color}
      />
      
      <LifecycleFlowArrow 
        direction={stage.arrowDirection} 
        isPulsing={isHovered} 
        color={stage.color}
      />
    </button>
  );
};

// Main lifecycle navigator component - static tiles (no animation loop)
const LifecycleNavigator = ({ onNavigate }) => {
  const [hoveredStageId, setHoveredStageId] = useState(null);

  // Filter stages by current domain
  const currentDomain = getDomain();
  const domainStages = useMemo(() => {
    return getStagesByDomain(currentDomain).sort((a, b) => a.gridPosition - b.gridPosition);
  }, [currentDomain]);

  // Get dynamic test counts
  const testCounts = {
    ECD: typeof ecdTestData !== 'undefined' ? ecdTestData.length : 13,
    TDS: typeof tdsTestData !== 'undefined' ? tdsTestData.length : 10,
    TRM: typeof trmTestData !== 'undefined' ? trmTestData.length : 9,
    MRD: typeof mrdTestData !== 'undefined' ? mrdTestData.length : 15,
    'ALZ-BLOOD': typeof alzBloodTestData !== 'undefined' ? alzBloodTestData.length : 9,
  };

  const handleSelect = (stageId) => {
    onNavigate(stageId);
  };
  
  return (
    <div className="relative">
      <div className={`grid ${domainStages.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-2'} gap-6`}>
        {domainStages.map((stage) => (
          <LifecycleStageCard
            key={stage.id}
            stage={stage}
            isHovered={hoveredStageId === stage.id}
            onClick={() => handleSelect(stage.id)}
            onMouseEnter={() => setHoveredStageId(stage.id)}
            onMouseLeave={() => setHoveredStageId(null)}
            testCount={testCounts[stage.id]}
          />
        ))}
      </div>
    </div>
  );
};


// ============================================
// Build Info - Auto-generated when code is built
// ============================================
const BUILD_INFO = {
  date: new Date(__BUILD_DATE__).toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }),
  sources: {
    MRD: 'https://docs.google.com/spreadsheets/d/16F_QRjpiqlrCK1f5fPSHQsODdE5QVPrrdx-0rfKAa5U/edit',
    ECD: 'https://docs.google.com/spreadsheets/d/1eFZg2EtdnR4Ly_lrXoZxzI4Z2bH23LDkCAVCXrewwnI/edit',
    TRM: 'https://docs.google.com/spreadsheets/d/1ZgvK8AgZzZ4XuZEija_m1FSffnnhvIgmVCkQvP1AIXE/edit',
    TDS: 'https://docs.google.com/spreadsheets/d/1HxYNQ9s4qJKHxFMkYjW1uXBq3Zg3nVkFp3mQZQvZF0s/edit'
  }
};

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
    nccnGuidelines: 'nccn', technologyDifferentiator: 'techDiff',
    sensitivityNotes: 'sensN', specificityNotes: 'specN', ppvDefinition: 'ppvDef', npvDefinition: 'npvDef',
    genesAnalyzed: 'genes', fdaCompanionDxCount: 'cdxCount', tmb: 'tmb', msi: 'msi',
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

const chatTestData = {
  MRD: mrdTestData.map(compressTestForChat),
  ECD: ecdTestData.map(compressTestForChat),
  TRM: trmTestData.map(compressTestForChat),
  TDS: tdsTestData.map(compressTestForChat),
};

// Key legend for chatbot prompt
const chatKeyLegend = `KEY: nm=name, vn=vendor, pType=product type (Self-Collection/Laboratory IVD Kit/Central Lab Service), platform=required instrument, ap=approach, mt=method, samp=sample type, ca=cancers, sens/spec=sensitivity/specificity%, aSpec=analytical specificity% (lab validation), cSpec=clinical specificity% (real-world, debatable in MRD), s1-s4=stage I-IV sensitivity, ppv/npv=predictive values, lod=detection threshold, lod95=95% confidence limit (gap between lod and lod95 means serial testing helps), tumorReq=requires tumor, vars=variants tracked, bvol=blood volume mL, cfIn=cfDNA input ng (critical for pharma - determines analytical sensitivity ceiling), tat1/tat2=initial/followup TAT days, lead=lead time vs imaging days, fda=FDA status, reimb=reimbursement, privIns=commercial payers, regions=availability (US/EU/UK/International/RUO), avail=clinical availability status, trial=participants, pubs=publications, scope=test scope, pop=target population, origAcc=tumor origin accuracy%, price=list price, respDef=response definition, nccn=NCCN guidelines, genes=genes analyzed, cdxCount=FDA CDx indications, tmb/msi=TMB/MSI reporting.`;

// Persona-specific chatbot style instructions
const getPersonaStyle = (persona) => {
  const lengthRule = `LENGTH: Keep responses under 20 lines. Be concise - lead with the answer, then add essential context. Use short paragraphs. Avoid lengthy preambles.`;
  const scopeReminder = `REMEMBER: Only discuss tests in the database. For medical questions about diseases, genetics, screening decisions, or result interpretation, say "Please discuss with your healthcare provider."`;
  
  switch(persona) {
    case 'Patient':
      return `AUDIENCE: Patient or caregiver seeking to understand options.
STYLE: Use clear, accessible language. Avoid jargon - if you must use technical terms, briefly explain them. Be warm but careful not to give medical advice. Focus ONLY on explaining what tests exist and their basic attributes. Do NOT suggest whether someone should get tested or interpret what results might mean.
IMPORTANT: If asked about disease inheritance, genetics, or whether they should be screened, say "That's an important question for your healthcare provider - they can assess your individual situation."
${lengthRule}
${scopeReminder}`;
    case 'Clinician':
      return `AUDIENCE: Healthcare professional comparing tests for patients.
STYLE: Be direct and clinical. Use standard medical terminology freely. Focus on actionable metrics: sensitivity, specificity, LOD, TAT, reimbursement status, FDA clearance. When describing a test, always note its "targetPopulation" field so the clinician can assess fit.
IMPORTANT: If the described patient doesn't match a test's target population, explicitly note this discrepancy rather than recommending the test.
${lengthRule}
${scopeReminder}`;
    case 'Academic/Industry':
      return `AUDIENCE: Researcher or industry professional studying the landscape.
STYLE: Be technical and detailed. Include methodology details, analytical performance metrics, and validation data. Reference publications and trial data when relevant. Discuss technology differentiators and emerging approaches.
${lengthRule}
${scopeReminder}`;
    default:
      return `STYLE: Be concise and helpful. Lead with key insights. Use prose not bullets.
${lengthRule}
${scopeReminder}`;
  }
};

// ============================================
// UI Components
// ============================================
const Checkbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer py-1 group">
    <div 
      onClick={onChange}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
        checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 group-hover:border-gray-400'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

// Collapsible filter section component
const FilterSection = ({ title, defaultOpen = false, activeCount = 0, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors -mx-2 px-2 rounded"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
          {activeCount > 0 && (
            <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
};

const Badge = ({ children, variant = 'default', title }) => {
  const styles = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-100 text-red-700 border-red-300',
    sky: 'bg-sky-100 text-sky-700 border-sky-300',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[variant]}`} title={title}>
      {children}
    </span>
  );
};

// ============================================
// Header
// ============================================
const Header = ({ currentPage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const siteConfig = getSiteConfig();

  const handleNavigate = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = ['home', 'submissions', 'how-it-works', 'data-sources', 'faq', 'learn', 'about'];
  const getLabel = (page) => ({
    'home': 'Home',
    'learn': 'Learn',
    'data-sources': 'Data Download',
    'how-it-works': 'How it Works',
    'submissions': 'Submissions',
    'faq': 'FAQ',
    'about': 'About'
  }[page] || page);
  
  return (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
      <div className="cursor-pointer hidden sm:flex items-center flex-shrink-0" onClick={() => handleNavigate('home')}>
        <img src="data:image/jpeg;base64,/9j/4QDoRXhpZgAATU0AKgAAAAgABgESAAMAAAABAAEAAAEaAAUAAAABAAAAVgEbAAUAAAABAAAAXgEoAAMAAAABAAIAAAITAAMAAAABAAEAAIdpAAQAAAABAAAAZgAAAAAAAABIAAAAAQAAAEgAAAABAAiQAAAHAAAABDAyMjGRAQAHAAAABAECAwCShgAHAAAAEgAAAMygAAAHAAAABDAxMDCgAQADAAAAAQABAACgAgAEAAAAAQAABKagAwAEAAAAAQAAAmKkBgADAAAAAQAAAAAAAAAAQVNDSUkAAABTY3JlZW5zaG90AAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYYXBwbAQAAABtbnRyUkdCIFhZWiAH5gABAAEAAAAAAABhY3NwQVBQTAAAAABBUFBMAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWFwcGwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApkZXNjAAAA/AAAADBjcHJ0AAABLAAAAFB3dHB0AAABfAAAABRyWFlaAAABkAAAABRnWFlaAAABpAAAABRiWFlaAAABuAAAABRyVFJDAAABzAAAACBjaGFkAAAB7AAAACxiVFJDAAABzAAAACBnVFJDAAABzAAAACBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAABQAAAAcAEQAaQBzAHAAbABhAHkAIABQADNtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADQAAAAcAEMAbwBwAHkAcgBpAGcAaAB0ACAAQQBwAHAAbABlACAASQBuAGMALgAsACAAMgAwADIAMlhZWiAAAAAAAAD21QABAAAAANMsWFlaIAAAAAAAAIPfAAA9v////7tYWVogAAAAAAAASr8AALE3AAAKuVhZWiAAAAAAAAAoOAAAEQsAAMi5cGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltzZjMyAAAAAAABDEIAAAXe///zJgAAB5MAAP2Q///7ov///aMAAAPcAADAbv/bAIQAAQEBAQEBAgEBAgMCAgIDBAMDAwMEBgQEBAQEBgcGBgYGBgYHBwcHBwcHBwgICAgICAkJCQkJCwsLCwsLCwsLCwECAgIDAwMFAwMFCwgGCAsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsL/90ABAAJ/8AAEQgASgCQAwEiAAIRAQMRAf/EAaIAAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKCxAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6AQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgsRAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A/Qb9p7/goj/wVg/Y5/bO8ZeA7mKPxD4f+1X3iDR9FvtMjvv+KaS4ZI51l04+fFCoG1nlG6Pq4xiv1s/4J8f8FkP2fv23Lm0+HWuxjwT8QJ0zFpF1Os1vqG1cs1hcjas+ACTGQkoXnaV5rhfGvP8AwcG+C4iMg/BrUsj/ALiS1+G/xl/YC8YftD/E/wDau+NvwGkNvrvwj+Jb+Rotri1Sew/s+0vJHtJE2tBeQys00RUqpOR8rHeP0Wnh8tx1GFLEU1Sn7OL546K7lyJOO29rv8UfF/8AChhak6uHm6kOZrkeui10f5Jfc9j+4emu6xqXc4Ar8FP+CN//AAVSP7V/hyH9n347agk3xB0uyW50/UyBGNf09VH73aAALuJSvnooAcFZFADFU+B/+C1f/BVLxL8QPGlz/wAE9/2QLuWaSa7i0bxLqNhJ5ct7fXTrCmkWkuVCgu6pcyhgNx8kEYlK/N0+GcY8e8vkrNbvoo/zenb7tD2pZ7hfqaxcHdPRLrft/XTyPqH9vP8A4L++CPhL4tufgf8AsY6Vb+P/ABQk/wBgfV5S8mkx3hJTyLaOD99qE4f5dsOI93yh2YFR+X/hH9sf/gu3+0J4T8YfHXwF4iurfw/4EuLm21tbOx0uxhsJ7JRJPC1td/6SWiU/OuCR0+9kV9rf8Erf2C2/Yl/4KUW3wr+JEtprXidfhRb+ILpkiQ22m315qDQNBZHaCEjjhCebwX5wFXC16R+w/wD8mW/txH/qoXxB/k9fUqWXYKnKGEoRqW5Pemubm5nbRdPKx866eNxklPEVpU0+b3Yvltyrutz5C/Z7/wCC/X7Xfwjbw5dfth+EF8VeF/FFnDqOm6raWbaPf3VjKgZLi034s71CpUkI0eB1IPFf1Tfs3/tO/BH9rT4a2/xV+BGuw63pUx8uXYDHPazgAtDcQth4ZVzyjgHuOMGv5nPjP4f0fxR/wb9/se+H9bh8y31S++F+mTFTskFvqElvbTBHHzITHIQCvQ49K+N/jL4X+OH/AAQu/bst7z4Na+uraHr1t9vsrS6fauq6QkhRrK/RRjzYWyIbhBuXIdRgyxssVkuBzLmjhIqlXUppRXwz5Lf+Auz6afpusbjMrkniJ+0w+mv2o3/Nf8Np1/uprC8S+J/Dvgzw/eeKvFt9b6ZpmnQtcXV3dSLDBDFGMs7u2FVVA5J4FfMXwE/bZ+Afx+/ZkT9q3RdXh0nwvbWktzqz6i6xNpL2q5uYrvnajQ4552sMMpKkGv41/wBtX9t79oj/AILbftQ6F+yF+zaTovgLU7149B0m/LW6X/2ZfMfVtXQYYxxIPMgsj9zKbx9odRb/ACmWZBXxVadOp7kKfxt/Zt+umx9Fic0o06MalN8zlblS632+R+qf7VX/AAct/Dvwr4sPgj9iPwHc/FSWKXaNRmkls7O/Kbj5OnRRRS3Vy8gXEUnlLG2Qyb1r9Gv+CqPxW/az+HX7JGk/HT9mwat4e1zQymr699mNjPaWWlx25ku1vEuhulEfAj+zL5m9ckeXuB/mD8D/AAr1T/gk5+1xq/7U/hTV7rxB4W+CvxNsvh/4rmuYoxLLoniDSLO5numVVwgSWcMu3n/R0UHLtn+wv/gon4/8F+Gv+Cd/xg8f65Il1oq+CNWmzH86zJNaOIwn97eWULjrkV7eNwuDwuJwX1KipQbWru+Zu3utaJWTT0X2keZSqYmth8TGvPlnbRLTlXSzXex/PX8Dv+C9v7WfwnvdLg/a78Dx+JNC1aFbm21LT7R9HvJrZuBNbiX/AES7TPeN0XtuB4r+nD9mf9qv4FftdfD1fiV8CNdi1ixVhDcxYMV1Zz4B8m5gbDwyAfwsORyuRg1/Pn+3b8H08Jf8E6f2Nfgd44h8z/irPCWjalGpMbFLuyljuEDLhkJDnkHIOPSvgX9qD4Z/Ff8A4Ipftr6X4i/Z48UGfS9etZdQ0yG7LH7Rp0UypJp2pKMCZUaQCGVR5gHzjDhvN9Kvk2XZpFfU4qlXlz8qXwSUHb/t3TXTT1PFw2a47L5S+tS9pSjyXv8AFHmV/n218tj+4+qeo6hYaTYzapqkyW1tbI0sssrBI0RBlmZjgBQOSTwBXx5+x3+3D8Hf2wfgCPjj4Vuo9LGmoya/Y3UqiTSLmJPMkSdvu+WE/eJL9x4iHHBr+Pj/AIKpf8FXfHX/AAUb+K9l+yJ+zHeC1+GWsara6JZq0htx4nu7qVYY5rpsErp25gY4tpEifvJAylI6+Sy3h7FYrFSw0lycnxN/Z/rov01Pq8ZnGHoUI173Uvht1/r/AIB+rX7bH/ByN8Kfh5rEvw5/Yk0KP4kap5gt1125d49FaVshVtEiVri/YnG3ylWN+iOx4rwf/gnT+2//AMFgv2sP+Ch2h/Dz4xTy6V4X8JFdS8a6BFpFvo62mm6jZ3a2JmS7JvP3lzGhVEPmDblwqHmz+yr/AME7vCv/AAT0/wCCtv7OvwvOrSeJvEGr+AfFera/qEq7baXUoms4wbWBs+TFErMsfJcg5Y5r7+/Yq/5Tnftff9i34I/9Bva+grf2bQw1WGDoqX7rmU5avWap6Lp1atbppocNGjjKlSNTE1be98MdFor2ffsf/9D+qTxP8Ebm8/4LI+F/2g/+Er8ORQ2fwyvdF/4R2S6I1+VpL0S/ao7fobVQNjP2fiuO/ZX+BTeC/F37Yt+PGPhnVP8AhPPF1zfeXp1/58mjb9Ht4PJ1Ndo+zTDb5pT5v3TK3fA828aQ2/8AxEQ+CbgRp5v/AApbUl37Bv2/2mvG7Gce2cV8mfDH9pL4P/sqW/8AwUF+JPxlvxY2F18SZNMtIYlD3F7fXmh2ccVvBGMGSR2bp0AyxwATX1ao150lCDu3ShZJf9PFZfeePTnCPtJS0SlL8j8cv2yv2ZNH/YPb4C+Ovg3480mfXfEXg2xvy/hi9Mvl6np9uIptW06bkmyuxNtjfHBOOQ5r0/8A4Jyf8E7vCXxf+Dd1+1Lqnjfw/Z+JNJ+JnhS10+LWL37OLCGw1W3vLvzThi19qqsI7VG4dChBDSsR45/wSZ/4J5/Fr/gpV8VdE8b/AB4ubmP4ffDjRdN8N6nqNq32bz/7JtmittG05o9uxLd5GlnkTAjwI+XeQRWfjp8Hfiz/AME0v2o2+EHxGmuJfBtz4g8P6/58UIeLWtI0DVIr63njj/5+bU7kdF+ZXOMbJI6/R513Wi8tjiE8VGzbstY81+X5Lp28nK3wsqCwlVY10f3EtEv5Xbe2yTa/rRH9flp8IJ4v+Cr9/wDHb/hI9DMU3wytdE/sIXP/ABOlMeozTfajB0FqQ2wP/fBFfJX7K37NF74G/Zf/AGqvBdx458IaqfHPjHxjqMd7pt8ZbPSl1HdiDUXP+png/wCXhRwmK6j4XeO/A/xW/wCCzS/FD4dX1tq+i678DtNu7G/ttrpPby6tcMpVxzj/AGex6gGvj39h62tI/wBiv9uRIoY0V/iF8Qi4WNVDEh8lgByT3J61+dexqxotOVtKOlvPRfI+uhVpymnGPWp+X6nq/jr9k6a//wCCSv7MfwDHxC8GW58E6v8ADuc69Nqe3RdU/sa4t32WFzs/fPdbMWo2jzCQOM19G/thfsSeAf2t/wBuHSLL4o61oh0S8+GGuaIdHNxt8QJcz31rLDqVnFjhLUpjzv4ZGVcYJr8uviWqt/wQX/Yr+UH/AIn3wi7f9PdpXl3/AAXX/bH1H4N/t0Wl9+z34ktLbxPY/DTVfCOtXtu6tcaKmtXcFwWRgCI7ryYAY8/6sPvKk7QfSwuDxdXFqnQqWlz19bbP3ddNr6enQvMK2HpYdvEK8fc07/L+u5+IXxrPj/4Qaf8AEr9ljRPGCatoMOtG21mPR7hTpWs3WhTARSPgHAR0AkUHajo8cnmLHiv6d/2HP+CVvhT9lfxT+zL8TNO8VeG7vxa15rmueJr17k/ataOp6a6xWmlf89LWz3q209VTzD82a/Pz9kX/AIIKfF3x5+xNq/xj8Uyz+F/iFrCQX3hPw5dZghisoMMI79eSk96nCZybYFSwL7xXHf8ABO79pLxP4B/au+Cn7P37Rd2uh6F8MfEOuw2LawPJuNJutTtHtv7OlZsrHF5r4jGQqkoqkxshP1GbVo5hhqscBWXNT5vaJJe/+7avpvtbT5fDG/x2Ai8DWh9ap+5Nx9nf7PvrTy016ee7t/QR4N/YT+Hvxs1j9rz4VfGXWNJ1/wAOfF3xdZXU9not4X1HS1h0jT4FjuflBtroPB50QUkhGRwecD3b9sj4E/AP41/sU3XweuPFtj4J8AeGLzSxdXSSxLp0Ft4eu4mayuGf5FhJh8iTkFfqMV4D+yFcy2fxy/bfurNzDND43hZXjGx1YeGtOIOQAcjqD9McYr8qdNuZ7v8A4NQ/Ht/eMZ55tA8RTSPL87PI2rTMzsWzuZm+ZmOSTyea+Jhga0qtOarW5Z4dLTZ1Kad7baKCXmfaVMTB1Pq0oJucKj+UJJW/8mP1+/4Ka/CDSfj34M+B954e8Y+GPDdho/xE0LXbafW737LDqEMKvst7JlyJbiVWHlJ0YCqX7W37JvgD9o7/AIKFfD2f4pav4dutAb4feKtFu/C95d7NZvlvZ7JhdWdvty0dsY8PMCDE7oB96vgb/gqba2k/7H/7EPnwxyLF8SvADIGjVthFo2CoI+UjsRgjtXzZ/wAF2v21Nd/Zq/4KBeB/HXwB1bTT4s8OfDvxHo17cNIrPojazcWjJO/8KSiGGSSMSYUKCzYA50yzC4qp9WpYaetqyWlraW38/wAOhlWqYaEq9SrHT3LrvporfhY/GX9ozwZ4n/Zh+JnxY/ZF8E+N31fRt48P6vPpk4aLVLKE+fFbXiqMNJHv2zxDGXLKfkdkr9iP2cv+CSnhDw1+xd8FfjbbeNvCMfjjxZ8RPCvi3UNY1O7MdqdMtJmlj0bTZRy9weC3TzrgPkBAqjxr/gnD/wAEKPiP8f8A9mLxF8dvjHqd94U1fxLYq/gq1vRJ9okl3GVtS1VHxIy3rHCxOBKEJnfbK4SL5D8KfFD4w/s9+LPD/wCxx+0DAukaF4O+J+g+Jb221Pn+xLqznH2iWFiNv2aeJzMWXCn/AFy8s4H3WJrLMIvD4Kuva02vaWS9+ytf77aeVukb/GqDyyfNiaX7qd+T+5re3lp/W9v65PjN8C7vxF/wVz+DPx+j8T+HrOHw54K8S6Y2hXV55et3hvZbZhNa22395BF5eJX3DYSowc8ZH7MP7P8Ae+B/+Cq37Rnx5m8VeHNSh8Z6L4XtY9FsLwy6xp39ni5Be9t9uIkl8z9ywJ3bTwMc+VfHDUdO1f8A4Ln/ALOuqaVLFc21z8NfF80M0ZV0eN57EqyMOqkHIIOCKP2PI4l/4LSftWOkaKx8P+DssFAY8XeMkDJx2z0r86+rzWDcufT2CdrdPbpW+/X8D9AlVtVirfbt/wCSM//R+uP28P8AgrT8OP2ff+Ct17+0j8PNCuPEFx4B8Hap8OprPU5BpNu2t/bjJv8AOcOWtl2gbkUs+flHFfP37KP/AASu/a7/AOCpfx+1v9qf9pGwu/hj4E8Wa7L4j1CcxyWl1fzyxxwGPSrKf95CphiWI3twisE3GFX3iRP7EPCf7Cf7Gvgf4qar8cfC/wAMfDdr4x1u8mv73Wv7Pie/muZ23SSGZ1ZwzNycEV9YAAV9e+JqeHoxp4Clyz5VFzb1tvZLZa9fw2PChlE51HLEzvG91FaL59zzD4M/Bn4Zfs+/DPR/g98HdGt9A8OaDbrbWVlartjjRf1ZmPLMeWJyea8Y/bM/Yx+Dv7cHwfn+FHxZt2ieJjcaVqtsFF7pd5tKrPAzAjodrxsCkiEo4INfW1LXy9PE1adVV4Samtb9bnsTo050/ZSiuW1rdLH8K+gaD+2T/wAEIv2mT8UfGfhaDxN4WubeTSTqStKukXthLMJT5E/zjTrkyYbyZxtLEqplz5g7P9lv/gpp+z78MP2XP2i/hx8QbTWLPxB8XfEXiXXdGtraya6hSPXEPlRzTp8isjHa5+7gZHHFf2yappOla7p02ka1bRXlpcKUlhmQSRup7MrAgj2Ir4C8R/8ABJr/AIJteK9Zl17Wvgv4Wa5mYvIYbFYEZj1JSIoh/KvslxPg8TB/2hQfO+W8oO1+XbR6L+ttD5X/AFexOGkvqNVcivaMltdWdmj+N/xV+3h8Uv2hf2J/gd/wTK+B/gW/k1z4eWfhwtfWTG81S61TQVQRPZ2sCsYoRKquJpsbcDOwc1+3H/BLn/ghtf8Aw78V2n7U37dqx6v4t+0/2rYeHZpRepbXzt5n2zUp8st1ehsOqAtFC/zbpXVHX+g/4Ofs6fAb9nrRP+Ec+Bfg7RvCNkfvRaRZRWgb/e8tQW/E17NiubMeK3OlPD4Cn7KEm23e8nff0T7L0vY7cLkP71YjGz9pNbaWS+X9emgYGMV+MH/BT7/gkh4K/bY025+J/wAMTaaF8SIrbyXkuFxY6zAowtvehQSrAZEVwqlo84KumVr9n+3FA4r5vAZhXwVaOIw0uWS/q3oexjMHRxVJ0a0bx/rY/h3+A/7an7Sf/BLLxD45+B37T/gK/vG8dPvvJNTuTFqLXEVmtlHJaXUm+3vofLSLIVywxyVPyDiLn9u74C+GP+CFXiX/AIJ03x1ZviFrOmarp1qV06Q6eZL29e5jLXA+VV8thu44PGDX9xfjr4cfD/4o6BN4T+JWiWHiDS5xiS01G3juYWB45SRWX9K+E9X/AOCQX/BMrXboXWrfBTwtLhtwj+x4hz/1zBCfhtxX2kOKcuqrnxOHcZ80JvkejlBNR0eys7WXlqfLU+H8dh60ZUK6lBKUUpLVRlZvbfWK3+4/kM/a2/4KdeOf2/PBHwi/ZC/Zq+H2rw6x8NLrSNTsbm0b+0Nan1TT7ZrSOSKytkkEECs/mLNMwAIG7YMmv1e/4Jk/8EF/Elj42h/ar/4KNhNV8QTXn9s2vhaaYXpbUHfzftmsXAylzcK+GS2jLQROAS8xSMx/0r/B/wDZ++Bv7Pvh8eFfgZ4P0bwhpwGPs+j2MNnGfqIlXP416/Xl4vie1D6rl9P2UO97yfz6X8vkz1sLk1qnt8TPnn9yWlthkaKiBFGAOMV+Y3/BRT/gmJ8J/wBvLw2mteZH4b8f6VbmHTNfSLzA0Y+YW15GCpmti3IGQ8ZO6NlOc/p3RXzmDxlbC1Y18PLlktrf1t5bHq4nC0sRTdKtG8X0P4KdMk/bP/4JJftK+DfiX+0B4UutYsfAVlqOj6It1du2h/2fqfl+bHZaisZWJd0aNHFKqMCMeUFxX6Yf8E1v29/hd8W/+Cp/xG+JFzpmpaK/xv07RdM0OyljWcxXOiw3c04mliJjVDHzGw69ODX9SuraPpOvafLpOt20V5azjbJDOiyRuvoVYEEfhXyl4Y/YD/Yt8DfFSw+Nvgj4Y+HtF8VaZNJcWupafZJaTRyyo0bsPK2rlkdlOR0NfX1+KcJi6FRYrD2qyhy80HpvzL3Xt7yu929T5yhkOKw1an9Xr3pJp8sltpbRry0S0S00P//S/v3FLTVp1AHxt+3R+3D8F/2APgPefHf4zvPNbxyraWGnWQVrzULxwWSCEOyoPlUs7uyxxRqXdlUE1+OOu/8ABaT/AIKE/DXwVF+0T8Zv2N9Y0X4SyBbh9Uj1+2k1S2s5MeXNPaPHGkSsCOWmCrxuKjkcB/wcfy/2d46/Za1zxgceDrL4g20urFuIVjjubWSRpc8bFtlmZ88eWG7V++v7Y2u/DTR/2QviX4g+JklqPDCeFdVe/kuNpga1a1cEHPykMCAB34xX01CjhcPhcPUqUFUdVy3clZJpWjyta9db9NDyZ1atSrWhCfLyWtou19fLppY6f4BftJ/CH9pT4HaB+0L8L9TWfwz4jtxNbS3A+zyRtuKPDKj4Mc0UitHJGeVdSK9h/wCEh0Iat/YH2yD7djd9m8xfN24znZndjHtX8C8Enjrwh/waz2uueKlZrmH4maZc24lyAfJ1e3EnTHH2lJenevf/APgp/wDsB/CD9gz9iHwR/wAFKfgj4g8QXfxxg1TQb+88T3+qz3Woa3cXcaMer7EVAAFihVYfJDRldhNdb4Yo/WHQ9ta9WdKHu3u48tru6sveWttO1tso5rP2Cq8l7RjJ620fb7tNvkf246jqumaPatfapPHbQLjdJK4RB+JwKLDVdM1W0F/pk8dzA3SSJw6HHoV4r+PH/gon8QvGf7U3/BVv4ffsz/Fj4d698YPAnh/wDbeKP+FeaHfQWCapqN5hpLm4W6ubW3mhtSEVo3Yn5l2LjfX0z/wTC+AX7TP7PH7W/wAXYfDXwZ8VfBv4AeK/C8t7YeH9e1SxvbPTdZt/LG2zjtb268oTCSckIqoERQeQtefUyKMMKq06yU3FSUfd2vay9697a/Dbpc6o45ynyxh7t7f1pa3Tf5H9MVx4w8KWlnHqN1qVpFbzNsjkeZFRmHYHOCfYV5D+05+018Jv2Rvgdrn7QPxlvWs/D+gwq8nkoZp55JCEihgjXmSWVyEjRepIr+LL/gl5/wAExP2ff20f+CR/iH42fHC71jUL3wfa6pbeE9PF7KulaI9papPJPDaBvKlkuZTumMyvkfKMDNYf7SvxO+Knxm/4Nofgh408b3N7q9pF4it7XU2Z5LidrKAzx28Zc5eRh8saFiWJxyTXox4YofW1h1WbtVVOXu8u97W1fSLXSz7o4ZZxP2Drez+xzR1v+FtOnyP2YtP+C0f/AAUD8Q+AW/aY8Ifsc6zc/B7yjepq0mv2w1WTTwCTcpZxxurR4GciUqV5BK81+y37Gf7avwX/AG4P2d9O/aO+FM0trplw0lve2mobIrnTryDAlt59rNHlcgq6M0ciFXRmRlJ9a8D+Ifh3L8DtI8VadcWp8Lf2HBcRzqV+yiwFuG3bh8vliP8ADFfxDfsh2k3/AA4e/bi17Tbdh4Sv9VuG0aMho4mtltbTATGML5JhTA6Yx2rChg8NmFKfs6KpOM4RVnJ3U3y6qTeq30t6HRKvVoVYRlLmUoyfRfD2t09T+7+XxN4divLfTZr63W4ugGgiMqB5AehRc5YfStO7vbSwtnvL2RYYoxlnchVUe5OAK/g4/bC/4J//AAk8Ff8ABFTw5/wU1Gr6/qPxoXTvD2pweILzVLhms7e6njjis7SNXVLaK0Rx9nMYDBlDOXJbd9//APBSnxf4v/a1/aD/AGJf2Gvihruoaf4E+LlimseKlsLqSzOpzR2e8QyvEVLKxUqEJ27n3Y3KtT/q7Tk4ezrXjeope7a3soqUrK+um3w/IUc0lZ3p9Ita/wA2ivorfjof1e6Trej65bfbNEuobuEHbvgdZFz6ZUkVT/4Szwx/av8AYX9oWv23O37P5yebn02Zz+lfgT+01+yT8Iv+CP8A+w98dfjP+wBHqfgy/wBe0SwsY9PgvJLmw065e4+zf2ha28+9YpwlxlmA2sY0JBwa/Knxl/wSy/ZK0H/gh4v/AAUV0l9S/wCFzR+Crfx9/wAJkmtXrX8t/NGk5t1uDMZPLOfJT5twbDffrDC5PhqyU/bNQlNQj7ivdrquayS8m/Q2qY2pGXs1D3krvXS22mm+nkf22duKWvhv/gmp8WvHnx1/YM+FPxZ+J1w154g1rw9ay31xIoV55kBjMzBQBmXbvOABk8V9yV4Vei6VSVKW8Xb7tDuo1VUpxqR2aTP/0/79wMUtFFAHyz+2D+x58C/24/gtefAr4+afLeaRcSxXUE1rM1td2d3Acxz28yYZHXp3VlJRgVJU/jun/Bvhpmv6Fpfwu+LP7SnxS8V/DrSponi8Lz3dpbWzJCcpGZIbdXVVwNhj2FCAUKkAj+i6ivRwua4vDQ9nRnZb9NH3V1o/SxzVcJRqO84Lt8j+dL/gvt8HNE+Ef/BHWP4Rfs9+Gvs+k+FNe8KQ6XpGl2sk6w21lfwkBYoVZ2VVXLYBJ5PWo/hd/wAEFfhB4oi+G2v/ABG+KPjzxB8PvC0Vjq2l/D7VbuOfS7O4MaSmMSyRfahD5n/LLzB8mYc+USh/oxoropZ5iaWGWHpO3vSk335lFfJqzs1rqyZYKnKpzzV9Eren9fgj8vv22P8Agl18M/2vfiT4V+Pfhfxf4g+FfxK8HRm207xP4VeGO4Nqc4gmimjkikRSx2HaHUFlDbWZT2H7K/7Cnjv4B+IfEvjL4sfHDxx8XNV8R6ZHpI/4SSW2js7GBGdi1ta2sEUayuX+Z23EhQOAK/RGiuN5hiHRVBy91aLRaLeydrpeV7Gqw9NS5lHU/Nj9i3/gmr8PP2KP2O9c/Y28H+KNV1vR9ba/LahfRWsd1EL+FYCFWCGOL5FUEZTk9c1T+BP/AAS1/Z5+En/BP2H/AIJx+NJ7zxz4HSG4gebUhHbXZE0xmR0e0SERSQNgwyRhXUqGzu5r9M6KJ5jiZOUnN3clJ9PeV7PTtdijhqSSioqyVvl29D+ckf8ABvbaQ+EJfgxZ/tM/FOH4ZyyHd4VE9ibU25bJg3G15jI4IK898mv0v8X/APBN/wDZ71H9gTWv+Cdnw6juPCPgrWdMl0557Tbc3gM8nmzTu9wJBNPM+WkklDF2Yk1+g9Fa1s4xlXlc6nwvmVklr30Su/Nk08HQhdRglpb5dj8wfjT/AMEvvhn8bP8AgnDYf8E29e8U6ra+HbDTdL00axDDatfOmlyJIjNG0Jt8yFAGAiAAPyheMUf2uv8AglL8EP2vPgt4C+G3iHXdZ8N+IfhnFbx+HfFejtFFqdqYERDkPG0Lq/lqxUp8rqrptZVI/Uyis6eZ4qDi4TtZuS9XZP70kmtrDlhaLVnBWsl8lsvkflN8A/8AglV4K8AeE/iJ4d/aL+Iviz44T/E7R4fD+sT+LbmPammQ+btht47ZIliO6Z28wZk3bcMNox8ax/8ABvd4UufC8HwQ8Q/tB/EzUvhFbXwvV8EyXNmlphZPMEX2hLZZgobkMpWQN84YP81f0R0VrTznGQblCpa9nstGlZNK1k0tmrEywVCW8F2+XY5HwF4F8IfDDwVpPw68A2EOlaJodpDYWFnbrtigt7dQkcaj0VQBXWFlXGeM8U6kwD1Fea227s6UklZH/9k=" alt="OpenOnco" className="h-14" />
      </div>
      <span className="sm:hidden text-xl font-bold text-[#2A63A4] cursor-pointer" onClick={() => handleNavigate('home')}>OpenOnco</span>
      <nav className="hidden sm:flex items-center flex-1 justify-evenly overflow-x-auto">
        {navItems.map(page => (
          <button
            key={page}
            onClick={() => handleNavigate(page)}
            className={`px-2 sm:px-4 py-2 rounded-lg text-sm sm:text-lg font-semibold transition-colors whitespace-nowrap ${
              currentPage === page ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {getLabel(page)}
          </button>
        ))}
      </nav>
      
      {/* Mobile hamburger button */}
      <button 
        className="sm:hidden p-2 rounded-lg hover:bg-gray-100"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {mobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
    
    {/* Mobile menu dropdown */}
    {mobileMenuOpen && (
      <div className="sm:hidden border-t border-gray-200 bg-white">
        <div className="flex flex-col py-2">
          {navItems.map(page => (
            <button
              key={page}
              onClick={() => handleNavigate(page)}
              className={`px-4 py-3 text-left font-medium ${
                currentPage === page ? 'bg-gray-100 text-gray-900' : 'text-gray-600'
              }`}
            >
              {getLabel(page)}
            </button>
          ))}
        </div>
      </div>
    )}
  </header>
  );
};

// ============================================
// Footer
// ============================================
const Footer = () => {
  const siteConfig = getSiteConfig();

  const disclaimers = {
    [DOMAINS.ONCO]: `OpenOnco is provided for informational and educational purposes only. The information on this website is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or treatment options. OpenOnco does not recommend or endorse any specific tests, physicians, products, procedures, or opinions. Nothing on this website constitutes reimbursement or coverage guidance, and should not be used to determine insurance coverage, patient financial responsibility, or billing practices. Reliance on any information provided by OpenOnco is solely at your own risk. Test performance data, pricing, and availability are subject to change and should be verified directly with test vendors.`,
    [DOMAINS.ALZ]: `OpenAlz is provided for informational and educational purposes only. The information on this website is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding Alzheimer's disease, cognitive symptoms, or treatment options. OpenAlz does not recommend or endorse any specific tests, physicians, products, procedures, or opinions. Nothing on this website constitutes reimbursement or coverage guidance, and should not be used to determine insurance coverage, patient financial responsibility, or billing practices. Reliance on any information provided by OpenAlz is solely at your own risk. Test performance data, pricing, and availability are subject to change and should be verified directly with test vendors.`,
  };

  return (
    <footer className="border-t border-gray-200 py-8 mt-12 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-sm text-gray-500 leading-relaxed text-justify">
          <strong>Disclaimer:</strong> {disclaimers[siteConfig.domain]}
        </p>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Built: {BUILD_INFO.date}
        </p>
      </div>
    </footer>
  );
};

// ============================================
// Unified Chat Component (All Categories)
// ============================================
const UnifiedChat = ({ isFloating = false, onClose = null }) => {
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length + tdsTestData.length;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const chatContainerRef = useRef(null);

  const suggestedQuestions = [
    "Patient with breast cancer, stage II, neo-adjuvant, US, age 72. What MRD tests fit this profile and are reimbursable?",
    "Compare Signatera and Reveal MRD"
  ];

  useEffect(() => { 
    if (chatContainerRef.current && messages.length > 0) {
      const container = chatContainerRef.current;
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const messageElements = container.querySelectorAll('[data-message-role="assistant"]');
        const lastAssistantEl = messageElements[messageElements.length - 1];
        if (lastAssistantEl) {
          // Use offsetTop to scroll within container only (not page)
          container.scrollTop = lastAssistantEl.offsetTop - 8;
        }
      }
    }
  }, [messages]);

  // Track persona from localStorage
  const [persona, setPersona] = useState(() => getStoredPersona() || 'Clinician');
  useEffect(() => {
    // Listen for persona changes and reset chat
    const handlePersonaChange = (e) => {
      setPersona(e.detail);
      setMessages([]);
      setShowSuggestions(true);
    };
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);

  const handleSuggestionClick = (question) => {
    setShowSuggestions(false);
    setInput('');
    submitQuestion(question);
  };

  // Memoize system prompt - recompute when persona changes
  const systemPrompt = useMemo(() => {
    return `You are a liquid biopsy test information assistant for OpenOnco. Your ONLY role is to help users explore and compare the specific tests in the database below.

STRICT SCOPE LIMITATIONS:
- ONLY discuss tests that exist in the database below
- NEVER speculate about disease genetics, heredity, inheritance patterns, or etiology - these are complex medical topics outside your scope
- NEVER suggest screening strategies or make recommendations about who should be tested
- NEVER interpret what positive or negative test results mean clinically
- NEVER make claims about diseases, conditions, or cancer types beyond what is explicitly stated in the test data
- If a user describes a patient/situation, check the "targetPopulation" field - if they don't clearly fit, say "This test is designed for [target population]. Please discuss with a healthcare provider whether it's appropriate for this situation."
- For ANY question outside the specific test data (disease inheritance, screening recommendations, result interpretation, treatment decisions): respond with "That's outside my scope. Please discuss with your healthcare provider."

WHAT YOU CAN DO:
- Compare tests in the database on their documented attributes (sensitivity, specificity, TAT, cost, coverage, etc.)
- Explain what data is available or not available for specific tests
- Help users understand the differences between test approaches (tumor-informed vs tumor-naïve, etc.)
- Direct users to the appropriate test category

DATABASE:
${JSON.stringify(chatTestData)}

${chatKeyLegend}

${getPersonaStyle(persona)}

Say "not specified" for missing data. When uncertain, err on the side of saying "please consult your healthcare provider."`;
  }, [persona]);

  const submitQuestion = async (question) => {
    setShowSuggestions(false);
    const newUserMessage = { role: 'user', content: question };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Limit history to last 6 messages to reduce token usage
      const recentMessages = updatedMessages.slice(-6);
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: 'all',
          persona: persona,
          testData: JSON.stringify(chatTestData),
          messages: recentMessages,
          model: selectedModel
        })
      });
      
      const data = await response.json();
      
      if (data && data.content && data.content[0] && data.content[0].text) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content[0].text }]);
      } else {
        console.log('Unexpected response:', data);
        setMessages(prev => [...prev, { role: 'assistant', content: "I received an unexpected response. Please try again." }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again in a moment." }]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    submitQuestion(userMessage);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`bg-white rounded-2xl border-2 border-[#9FC4E0] overflow-hidden shadow-lg ${isFloating ? 'flex flex-col' : ''}`} style={isFloating ? { height: '500px' } : {}}>
      <div className="bg-gradient-to-r from-[#EAF1F8] to-emerald-50 px-5 py-3 border-b border-[#D5E3F0] flex items-center justify-between flex-shrink-0">
        <p className="text-[#163A5E] text-sm">Query our database of {totalTests} MRD, ECD, TRM, and TDS tests</p>
        {isFloating && onClose && (
          <button onClick={onClose} className="text-[#2A63A4] hover:text-[#163A5E] p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div ref={chatContainerRef} className={`overflow-y-auto p-4 space-y-3 bg-gray-50 ${isFloating ? 'flex-1' : 'h-80'}`}>
        {/* Suggested Questions - shown when no messages */}
        {showSuggestions && messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col justify-center">
            <p className="text-sm text-gray-500 text-center mb-4">Try one of these questions:</p>
            <div className="grid grid-cols-1 gap-2">
              {suggestedQuestions.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(question)}
                  className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-[#EAF1F8] hover:border-[#6AA1C8] transition-colors shadow-sm"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} data-message-role={msg.role} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user' 
                  ? 'text-white rounded-br-md' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
              }`}
              style={msg.role === 'user' ? { backgroundColor: '#2A63A4' } : {}}
            >
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <Markdown className="text-sm">{msg.content}</Markdown>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex space-x-1.5">
              <div className="w-2 h-2 bg-[#4A82B0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-[#4A82B0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-[#4A82B0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
        <div className="flex gap-3 items-center">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
            title="Select AI model"
          >
            {CHAT_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your liquid biopsy test question here..." 
            className="flex-1 px-4 py-3 bg-white border-2 rounded-xl text-sm focus:outline-none shadow-sm placeholder:text-gray-400" 
            style={{ borderColor: '#6AA1C8' }}
          />
          <button 
            onClick={handleSubmit}
            disabled={isLoading} 
            className="text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            style={{ backgroundColor: '#2A63A4' }}
          >
            Ask
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">Powered by Claude AI. Responses may be inaccurate and should be independently verified.</p>
      </div>
    </div>
  );
};


// ============================================
// Recently Added Tests Banner - Full width at top of showcase
// ============================================
const RecentlyAddedBanner = ({ onNavigate }) => {
  const categoryColors = {
    MRD: 'bg-orange-500',
    ECD: 'bg-emerald-500',
    TRM: 'bg-sky-500',
    TDS: 'bg-violet-500'
  };

  const handleTestClick = (test) => {
    onNavigate(test.category, test.id);
  };

  // Take only the 5 most recent tests
  const recentTests = RECENTLY_ADDED_TESTS.slice(0, 5);

  return (
    <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <h3 className="text-sm font-semibold text-slate-700">Recently Added Tests</h3>
        <span className="text-xs text-slate-400">Updated weekly</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {recentTests.map((test) => (
          <div
            key={test.id}
            onClick={() => handleTestClick(test)}
            className="flex flex-col p-3 bg-white border border-slate-100 rounded-lg cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`${categoryColors[test.category]} text-white text-[10px] px-1.5 py-0.5 rounded font-medium`}>
                {test.category}
              </span>
              <span className="text-[10px] text-slate-400">{test.dateAdded}</span>
            </div>
            <span className="text-sm font-medium text-slate-800 group-hover:text-[#2A63A4] transition-colors truncate">
              {test.name}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {test.vendor}<VendorBadge vendor={test.vendor} size="xs" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


// ============================================
// Cancer Type Navigator - Browse tests by cancer type
// ============================================
const CancerTypeNavigator = ({ onNavigate }) => {
  // Combine all tests and extract cancer types
  const allTests = useMemo(() => [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD' })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD' })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM' })),
    ...tdsTestData.map(t => ({ ...t, category: 'TDS' })),
  ], []);

  // Normalize cancer type names and group tests
  const normalizeCancerType = (type) => {
    if (!type) return null;
    const lower = type.toLowerCase();
    // Normalize common variations
    if (lower.includes('colorectal') || lower.includes('colon') || lower.includes('crc')) return 'Colorectal';
    if (lower.includes('breast')) return 'Breast';
    if (lower.includes('lung') || lower.includes('nsclc')) return 'Lung';
    if (lower.includes('prostate')) return 'Prostate';
    if (lower.includes('pancrea')) return 'Pancreatic';
    if (lower.includes('liver') || lower.includes('hcc') || lower.includes('hepato')) return 'Liver';
    if (lower.includes('ovari')) return 'Ovarian';
    if (lower.includes('bladder') || lower.includes('urothelial')) return 'Bladder';
    if (lower.includes('gastric') || lower.includes('stomach') || lower.includes('esophag')) return 'Gastroesophageal';
    if (lower.includes('head') && lower.includes('neck')) return 'Head & Neck';
    if (lower.includes('melanoma') || lower.includes('skin')) return 'Melanoma';
    if (lower.includes('lymphoma') || lower.includes('leukemia') || lower.includes('hematolog')) return 'Blood Cancers';
    if (lower.includes('multi') || lower.includes('pan-cancer') || lower.includes('solid')) return 'Multi-cancer';
    if (lower.includes('thyroid')) return 'Thyroid';
    if (lower.includes('kidney') || lower.includes('renal')) return 'Kidney';
    return type; // Return original if no normalization match
  };

  // Build cancer type -> tests mapping
  const cancerTypeMap = useMemo(() => {
    const map = {};
    allTests.forEach(test => {
      const types = test.cancerTypes || [];
      types.forEach(type => {
        const normalized = normalizeCancerType(type);
        if (normalized) {
          if (!map[normalized]) map[normalized] = [];
          // Avoid duplicate test entries
          if (!map[normalized].find(t => t.id === test.id)) {
            map[normalized].push(test);
          }
        }
      });
    });
    return map;
  }, [allTests]);

  // Define major cancer types with icons and colors (sorted by test count)
  const cancerTypeConfig = {
    'Colorectal': { icon: '🔵', color: 'blue', description: 'Colon & rectal cancers' },
    'Breast': { icon: '🎀', color: 'pink', description: 'Breast cancer' },
    'Lung': { icon: '🫁', color: 'slate', description: 'NSCLC & lung cancers' },
    'Prostate': { icon: '♂️', color: 'indigo', description: 'Prostate cancer' },
    'Liver': { icon: '🟤', color: 'amber', description: 'HCC & liver cancers' },
    'Pancreatic': { icon: '🟡', color: 'yellow', description: 'Pancreatic cancer' },
    'Bladder': { icon: '💧', color: 'cyan', description: 'Bladder & urothelial' },
    'Ovarian': { icon: '🟣', color: 'purple', description: 'Ovarian cancer' },
    'Gastroesophageal': { icon: '🔴', color: 'red', description: 'Stomach & esophageal' },
    'Blood Cancers': { icon: '🩸', color: 'rose', description: 'Leukemia & lymphoma' },
    'Multi-cancer': { icon: '🎯', color: 'emerald', description: 'Pan-tumor tests' },
  };

  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', hover: 'hover:bg-blue-100 hover:border-blue-400' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', hover: 'hover:bg-pink-100 hover:border-pink-400' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', hover: 'hover:bg-slate-100 hover:border-slate-400' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', hover: 'hover:bg-indigo-100 hover:border-indigo-400' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', hover: 'hover:bg-amber-100 hover:border-amber-400' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', hover: 'hover:bg-yellow-100 hover:border-yellow-400' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', hover: 'hover:bg-cyan-100 hover:border-cyan-400' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', hover: 'hover:bg-purple-100 hover:border-purple-400' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', hover: 'hover:bg-red-100 hover:border-red-400' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', hover: 'hover:bg-rose-100 hover:border-rose-400' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', hover: 'hover:bg-emerald-100 hover:border-emerald-400' },
  };

  // Get sorted cancer types by test count
  const sortedCancerTypes = useMemo(() => {
    return Object.entries(cancerTypeMap)
      .filter(([type]) => cancerTypeConfig[type]) // Only show configured types
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 12); // Top 12 cancer types
  }, [cancerTypeMap]);

  // Handle click - navigate to category with search filter
  const handleCancerTypeClick = (cancerType, tests) => {
    // Find the category with most tests for this cancer type
    const categoryCounts = {};
    tests.forEach(t => {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    });
    const primaryCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Navigate to that category (the search/filter will need to be handled by CategoryPage)
    onNavigate(primaryCategory);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Browse by Cancer Type</h2>
        <p className="text-sm text-gray-500">Select a cancer type to see available tests</p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedCancerTypes.map(([cancerType, tests]) => {
            const config = cancerTypeConfig[cancerType];
            const colors = colorClasses[config?.color || 'slate'];
            const categories = [...new Set(tests.map(t => t.category))];
            
            return (
              <button
                key={cancerType}
                onClick={() => handleCancerTypeClick(cancerType, tests)}
                className={`
                  p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer
                  ${colors.bg} ${colors.border} ${colors.hover}
                  hover:shadow-md hover:scale-[1.02]
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{config?.icon || '🔬'}</span>
                  <span className={`font-semibold ${colors.text}`}>{cancerType}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {tests.length} tests across {categories.length} {categories.length === 1 ? 'category' : 'categories'}
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {categories.map(cat => (
                    <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600">
                      {cat}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};


// ============================================
// Test Showcase Component - Static badge parameters for each test
// ============================================
const TestShowcase = ({ onNavigate }) => {
  const [selectedTest, setSelectedTest] = useState(null);
  const [sortBy, setSortBy] = useState('vendor');
  const [searchQuery, setSearchQuery] = useState('');

  // Get current domain for filtering
  const currentDomain = getDomain();

  // Chat state for non-patient views
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const chatContainerRef = useRef(null);

  // Track persona
  const [persona, setPersona] = useState(getStoredPersona() || 'Clinician');
  useEffect(() => {
    const handlePersonaChange = (e) => setPersona(e.detail);
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);
  
  
  // Auto-scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      const container = chatContainerRef.current;
      // Scroll to bottom to show latest message
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);
  
  // Example questions for chat
  const exampleQuestions = [
    "Compare Signatera and Reveal MRD for colorectal cancer MRD monitoring",
    "What ECD tests have Medicare coverage?",
    "Which TDS tests have the fastest turnaround time?"
  ];
  
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
      const searchableText = `${test.name} ${test.vendor} ${test.category} ${productTypeSearchable}`.toLowerCase();
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
    if (leadTime != null) params.push({ label: 'Lead Time vs Imaging', value: `${leadTime} days`, type: 'clinical' });
    
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

  // Chat system prompt for non-patient views
  const chatTestData = [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD' })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD' })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM' })),
    ...tdsTestData.map(t => ({ ...t, category: 'TDS' }))
  ];

  const getPersonaStyle = (p) => {
    if (p === 'Clinician') return 'Respond in a clinical, professional tone suitable for oncologists and healthcare providers. Use medical terminology freely.';
    if (p === 'Academic/Industry') return 'Respond with technical depth suitable for researchers and industry professionals. Include analytical details and methodology notes where relevant.';
    return '';
  };

  const systemPrompt = useMemo(() => {
    return `You are a liquid biopsy test information assistant for OpenOnco. Your ONLY role is to help users explore and compare the specific tests in the database below.

STRICT SCOPE LIMITATIONS:
- ONLY discuss tests that exist in the database below
- NEVER speculate about disease genetics, heredity, inheritance patterns, or etiology
- NEVER suggest screening strategies or make recommendations about who should be tested
- NEVER interpret what positive or negative test results mean clinically
- For ANY question outside the specific test data: respond with "That's outside my scope. Please discuss with your healthcare provider."

WHAT YOU CAN DO:
- Compare tests in the database on their documented attributes (sensitivity, specificity, TAT, cost, coverage, etc.)
- Explain what data is available or not available for specific tests
- Help users understand the differences between test approaches (tumor-informed vs tumor-naïve, etc.)
- Direct users to the appropriate test category

DATABASE:
${JSON.stringify(chatTestData)}

${getPersonaStyle(persona)}

Say "not specified" for missing data. When uncertain, err on the side of saying "please consult your healthcare provider."`;
  }, [persona]);

  // Chat submit handler
  const handleChatSubmit = async (question) => {
    const q = question || chatInput;
    if (!q.trim()) return;
    
    setChatInput('');
    const newUserMessage = { role: 'user', content: q };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const recentMessages = updatedMessages.slice(-6);
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: 'all',
          persona: persona,
          testData: JSON.stringify(chatTestData),
          messages: recentMessages,
          model: selectedModel
        })
      });
      
      const data = await response.json();
      
      if (data?.content?.[0]?.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content[0].text }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "I received an unexpected response. Please try again." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again in a moment." }]);
    }
    setIsLoading(false);
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

  // ========== CLINICIAN/ACADEMIC VIEW: Categories + Chat + Search ==========
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Main Content: Side-by-side on desktop */}
      <div className="p-4 flex flex-col lg:flex-row gap-4">
        {/* Left: Lifecycle Navigator - Hidden on mobile */}
        <div className="hidden md:block lg:w-[55%] flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800 mb-3 text-center">Click on a Test Category for a Data Deep Dive:</h3>
          <LifecycleNavigator onNavigate={onNavigate} />
        </div>

        {/* Right: Search Tools */}
        <div className="w-full lg:w-[45%] flex flex-col gap-3">
          <h3 className="text-lg font-bold text-slate-800 text-center">Chat with Claude to Demystify the Tests:</h3>
          {/* Claude Chat Input */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-4 border-2 border-slate-300 flex-[2] flex flex-col shadow-sm hover:border-slate-400 hover:shadow-md transition-all cursor-pointer">
            {/* Example Questions - shown when no messages */}
            {messages.length === 0 && (
              <div className="flex flex-col mb-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-500 font-medium">Try asking:</span>
                  <button
                    onClick={() => handleChatSubmit("Compare Signatera and Reveal MRD for MRD monitoring")}
                    className="text-[11px] text-left bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-[#EAF1F8] hover:border-[#6AA1C8] hover:text-[#1E4A7A] transition-colors"
                  >
                    Compare Signatera and Reveal MRD for MRD monitoring
                  </button>
                  <button
                    onClick={() => handleChatSubmit("Which TDS tests have the fastest turnaround time?")}
                    className="text-[11px] text-left bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-[#EAF1F8] hover:border-[#6AA1C8] hover:text-[#1E4A7A] transition-colors"
                  >
                    Which TDS tests have the fastest turnaround time?
                  </button>
                  <button
                    onClick={() => handleChatSubmit("I am a patient, please use straightforward language")}
                    className="text-[11px] text-left bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-[#EAF1F8] hover:border-[#6AA1C8] hover:text-[#1E4A7A] transition-colors"
                  >
                    🩺 I am a patient, please use straightforward language
                  </button>
                  <button
                    onClick={() => handleChatSubmit("I am a physician, please use clinical language")}
                    className="text-[11px] text-left bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-[#EAF1F8] hover:border-[#6AA1C8] hover:text-[#1E4A7A] transition-colors"
                  >
                    👨‍⚕️ I am a physician, please use clinical language
                  </button>
                </div>
              </div>
            )}

            {/* Messages Area - shown when there are messages */}
            {messages.length > 0 && (
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-3 p-2 space-y-2 bg-white rounded-lg border border-slate-200 max-h-64">
                {messages.map((msg, i) => (
                  <div key={i} data-message-role={msg.role} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`max-w-[85%] rounded-xl px-3 py-1.5 ${msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-sm'}`}
                      style={msg.role === 'user' ? { backgroundColor: '#2A63A4' } : {}}
                    >
                      {msg.role === 'user' ? (
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <Markdown className="text-xs">{msg.content}</Markdown>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl rounded-bl-sm px-3 py-1.5">
                      <p className="text-xs text-slate-500">Thinking...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat Input - always at bottom */}
            <form onSubmit={(e) => { e.preventDefault(); handleChatSubmit(); }} className="flex flex-col gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Claude about tests..."
                  className="w-full px-3 py-2.5 pl-9 text-sm bg-blue-50 border-2 border-blue-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm"
                  disabled={isLoading}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div className="flex gap-2 justify-end">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none cursor-pointer"
                  title="Select AI model"
                >
                  {CHAT_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isLoading || !chatInput.trim()}
                  className="text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(to right, #2A63A4, #1E4A7A)' }}
                >
                  Ask
                </button>
              </div>
            </form>
          </div>

          {/* Text Search Bar - Smaller */}
          <div className="bg-gradient-to-br from-red-100 to-red-200 rounded-xl p-3 border-2 border-red-300 shadow-sm hover:border-red-400 hover:shadow-md transition-all cursor-pointer">
            <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1.5 text-center">Or: Quick Search</p>
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
                {/* INCOMPLETE text overlay for non-BC tests */}
                {!isBC && !isDiscontinued && !hasCompanyComm && !hasVendorVerified && (
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

// ============================================
// Stat of the Day Component
// ============================================
const StatOfTheDay = ({ onNavigate }) => {
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
  
  // Combine all tests
  const allTests = [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD', numIndications: t.cancerTypes?.length || 0 })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD', numIndications: t.cancerTypes?.length || 0 })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM', numIndications: t.cancerTypes?.length || 0 })),
    ...tdsTestData.map(t => ({ ...t, category: 'TDS', numIndications: t.cancerTypes?.length || 0 }))
  ];
  
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
// Baseline Complete (BC) - Data Completeness Calculation
// ============================================
// NOTE: BC status is awarded to tests that have all minimum required fields filled.
// When reviewing new test submissions, verify they meet BC requirements before adding.

// Calculate completeness score for a single test
const calculateTestCompleteness = (test, category) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!minParams?.core) return { filled: 0, total: 0, percentage: 0, missingFields: [] };
  
  const minFields = minParams.core;
  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';
  
  const filledFields = minFields.filter(p => hasValue(test[p.key]));
  const missingFields = minFields.filter(p => !hasValue(test[p.key]));
  const percentage = minFields.length > 0 
    ? Math.round((filledFields.length / minFields.length) * 100) 
    : 0;
  
  return {
    filled: filledFields.length,
    total: minFields.length,
    percentage,
    missingFields: missingFields.map(p => p.label)
  };
};

// ============================================
// Home Page (intro, navs, chat, and news)
// ============================================

const HomePage = ({ onNavigate }) => {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [persona, setPersona] = useState(() => getStoredPersona() || 'Academic/Industry');
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const chatContainerRef = useRef(null);

  // Save persona to localStorage when changed and notify other components
  const handlePersonaSelect = (selectedPersona) => {
    setPersona(selectedPersona);
    setMessages([]); // Reset chat so user can start fresh with new persona
    localStorage.setItem('openonco-persona', selectedPersona);
    // Track persona change with feature flags
    track('persona_changed', { 
      new_persona: selectedPersona 
    }, { 
      flags: [`persona-${selectedPersona.toLowerCase().replace(/[^a-z]/g, '-')}`] 
    });
    // Dispatch custom event so other components can respond to persona changes
    window.dispatchEvent(new CustomEvent('personaChanged', { detail: selectedPersona }));
  };

  // Auto-scroll to show assistant response when it arrives
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      const container = chatContainerRef.current;
      const lastMessage = messages[messages.length - 1];
      // When assistant responds, scroll container to show start of response
      if (lastMessage.role === 'assistant') {
        const messageElements = container.querySelectorAll('[data-message-role="assistant"]');
        const lastAssistantEl = messageElements[messageElements.length - 1];
        if (lastAssistantEl) {
          // Use offsetTop to scroll within container only (not page)
          container.scrollTop = lastAssistantEl.offsetTop - 8;
        }
      }
    }
  }, [messages]);
  
  const colorClasses = {
    orange: { card: 'bg-orange-50 border-orange-200 hover:border-orange-400 hover:shadow-lg hover:scale-[1.02] hover:bg-orange-100', btn: 'from-orange-500 to-orange-600' },
    green: { card: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:shadow-lg hover:scale-[1.02] hover:bg-emerald-100', btn: 'from-emerald-500 to-emerald-600' },
    red: { card: 'bg-sky-100 border-sky-300 hover:border-sky-500 hover:shadow-lg hover:scale-[1.02] hover:bg-sky-200', btn: 'from-sky-500 to-sky-600' },
  };

  // Calculate total data points dynamically
  const mrdParams = mrdTestData.length > 0 ? Object.keys(mrdTestData[0]).length : 0;
  const ecdParams = ecdTestData.length > 0 ? Object.keys(ecdTestData[0]).length : 0;
  const trmParams = trmTestData.length > 0 ? Object.keys(trmTestData[0]).length : 0;
  const totalDataPoints = (mrdTestData.length * mrdParams) + (ecdTestData.length * ecdParams) + (trmTestData.length * trmParams);
  
  // All tests combined for chat header ticker
  const exampleQuestions = [
    "Compare Signatera and Reveal MRD for colorectal cancer MRD monitoring",
    "What ECD tests have Medicare coverage?"
  ];

  // Memoize system prompt - recompute when persona changes
  const systemPrompt = useMemo(() => {
    return `You are a liquid biopsy test information assistant for OpenOnco. Your ONLY role is to help users explore and compare the specific tests in the database below.

STRICT SCOPE LIMITATIONS:
- ONLY discuss tests that exist in the database below
- NEVER speculate about disease genetics, heredity, inheritance patterns, or etiology - these are complex medical topics outside your scope
- NEVER suggest screening strategies or make recommendations about who should be tested
- NEVER interpret what positive or negative test results mean clinically
- NEVER make claims about diseases, conditions, or cancer types beyond what is explicitly stated in the test data
- If a user describes a patient/situation, check the "targetPopulation" field - if they don't clearly fit, say "This test is designed for [target population]. Please discuss with a healthcare provider whether it's appropriate for this situation."
- For ANY question outside the specific test data (disease inheritance, screening recommendations, result interpretation, treatment decisions): respond with "That's outside my scope. Please discuss with your healthcare provider."

WHAT YOU CAN DO:
- Compare tests in the database on their documented attributes (sensitivity, specificity, TAT, cost, coverage, etc.)
- Explain what data is available or not available for specific tests
- Help users understand the differences between test approaches (tumor-informed vs tumor-naïve, etc.)
- Direct users to the appropriate test category

DATABASE:
${JSON.stringify(chatTestData)}

${chatKeyLegend}

${getPersonaStyle(persona)}

Say "not specified" for missing data. When uncertain, err on the side of saying "please consult your healthcare provider."`;
  }, [persona]);

  const handleSubmit = async (question) => {
    const q = question || chatInput;
    if (!q.trim()) return;
    
    // Track homepage chat submission with feature flags
    const personaFlag = `persona-${persona.toLowerCase().replace(/[^a-z]/g, '-')}`;
    track('home_chat_message_sent', { 
      model: selectedModel,
      message_length: q.trim().length,
      is_suggested: question !== undefined
    }, { 
      flags: [personaFlag] 
    });
    
    setChatInput('');
    const newUserMessage = { role: 'user', content: q };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Limit history to last 6 messages to reduce token usage
      const recentMessages = updatedMessages.slice(-6);
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: 'all',
          persona: persona,
          testData: JSON.stringify(chatTestData),
          messages: recentMessages,
          model: selectedModel
        })
      });
      
      const data = await response.json();
      
      if (data?.content?.[0]?.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content[0].text }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "I received an unexpected response. Please try again." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again in a moment." }]);
    }
    setIsLoading(false);
  };

  // All personas use the same view, with chat prompt customized by persona
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
            {mrdTestData.length + ecdTestData.length + trmTestData.length + tdsTestData.length} Advanced Molecular Tests: Collected, Curated, Explained
          </h1>
        </div>

        {/* Browse Mode Toggle + Test Views */}
        <div className="mb-4">
          {/* Browse Mode Toggle */}
          <TestShowcase onNavigate={onNavigate} />
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

// Helper function to calculate minimum field completion stats for a category
const calculateMinimumFieldStats = (tests, category) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!minParams?.core) return { complete: 0, total: tests.length, percentage: 0 };
  
  const minFields = minParams.core.map(p => p.key);
  
  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';
  
  const completeTests = tests.filter(test => 
    minFields.every(field => hasValue(test[field]))
  );
  
  const percentage = tests.length > 0 
    ? Math.round((completeTests.length / tests.length) * 100) 
    : 0;
  
  return {
    complete: completeTests.length,
    total: tests.length,
    percentage
  };
};

// Simple database stats for Data Download page
const DatabaseStatsSimple = () => {
  const mrdParams = mrdTestData.length > 0 ? Object.keys(mrdTestData[0]).length : 0;
  const ecdParams = ecdTestData.length > 0 ? Object.keys(ecdTestData[0]).length : 0;
  const trmParams = trmTestData.length > 0 ? Object.keys(trmTestData[0]).length : 0;
  const cgpParams = tdsTestData.length > 0 ? Object.keys(tdsTestData[0]).length : 0;
  
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length + tdsTestData.length;
  const totalDataPoints = (mrdTestData.length * mrdParams) + (ecdTestData.length * ecdParams) + (trmTestData.length * trmParams) + (tdsTestData.length * cgpParams);
  
  const allVendors = new Set([
    ...mrdTestData.map(t => t.vendor),
    ...ecdTestData.map(t => t.vendor),
    ...trmTestData.map(t => t.vendor),
    ...tdsTestData.map(t => t.vendor)
  ]);
  
  // Calculate Tier 1 citation metrics dynamically
  const allTestData = [...mrdTestData, ...ecdTestData, ...trmTestData, ...tdsTestData];
  const tier1Metrics = calculateTier1Metrics(allTestData);

  // Calculate minimum field completion for each category
  const mrdCompletion = calculateMinimumFieldStats(mrdTestData, 'MRD');
  const ecdCompletion = calculateMinimumFieldStats(ecdTestData, 'ECD');
  const trmCompletion = calculateMinimumFieldStats(trmTestData, 'TRM');
  const tdsCompletion = calculateMinimumFieldStats(tdsTestData, 'TDS');

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
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">{mrdTestData.length}</div>
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
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">{ecdTestData.length}</div>
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
        <div className="flex items-center gap-2 p-2 bg-sky-50 rounded-lg border border-sky-100">
          <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold">{trmTestData.length}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">TRM</p>
            <p className="text-[10px] text-gray-500">{trmParams} fields</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 bg-sky-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all"
                  style={{ width: `${trmCompletion.percentage}%` }}
                />
              </div>
              <span className="text-[9px] text-sky-600 font-medium whitespace-nowrap" title="Tests with all minimum fields filled">{trmCompletion.complete}/{trmCompletion.total}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-100">
          <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">{tdsTestData.length}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">TDS</p>
            <p className="text-[10px] text-gray-500">{cgpParams} fields</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 bg-violet-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${tdsCompletion.percentage}%` }}
                />
              </div>
              <span className="text-[9px] text-violet-600 font-medium whitespace-nowrap" title="Tests with all minimum fields filled">{tdsCompletion.complete}/{tdsCompletion.total}</span>
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
            <span className="text-gray-400 hover:text-gray-600 cursor-help text-sm">ⓘ</span>
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

// ============================================
// ============================================
// Openness Ranking Component (Top 3)
// ============================================
const OpennessAward = () => {
  const [showFAQ, setShowFAQ] = useState(false);
  
  // Add category to each test for proper openness scoring
  const allTests = [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD' })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD' })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM' })),
    ...tdsTestData.map(t => ({ ...t, category: 'TDS' }))
  ];
  
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

  if (top3.length === 0) return null;

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

// ============================================
// Placeholder Pages
// ============================================
const PlaceholderPage = ({ title, description }) => (
  <div className="max-w-4xl mx-auto px-6 py-16 text-center">
    <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
    <p className="text-gray-600">{description}</p>
  </div>
);

// ============================================
// FAQ Page
// ============================================
// ============================================
// Learn Page
// ============================================
const LearnPage = ({ onNavigate }) => {
  const categories = [
    {
      id: 'ECD',
      phase: 'Screening',
      name: 'Early Cancer Detection (ECD)',
      acronym: 'ECD',
      color: 'emerald',
      icon: '🔬',
      clinicalQuestion: 'Can cancer be detected before clinical presentation?',
      description: 'Early cancer detection (ECD) tests screen asymptomatic individuals for cancer signals in blood or stool. These assays analyze tumor-derived molecules including ctDNA methylation patterns, fragmentomic features (cfDNA fragment size distributions and end motifs), and protein biomarkers. Single-cancer tests focus on one cancer type (e.g., colorectal), while multi-cancer early detection (MCED) tests screen for signals across 50+ cancer types.',
      technology: 'Most ECD tests rely on methylation profiling, as cancer-specific methylation patterns are more abundant and consistent than somatic mutations in early-stage disease. Machine learning classifiers trained on methylation arrays can detect cancer signals and predict tissue of origin. Some platforms combine methylation with fragmentomics or proteomics for improved sensitivity.',
      keyMetrics: [
        'Sensitivity by cancer type and stage (typically 20-40% for stage I, 70-90% for stage IV)',
        'Specificity (target >99% to minimize false positives in screening populations)',
        'Positive predictive value (PPV) depends heavily on cancer prevalence',
        'Cancer signal origin (CSO) accuracy for localization'
      ],
      challenges: [
        'Low ctDNA fraction in early-stage disease (<0.1% VAF)',
        'Clonal hematopoiesis of indeterminate potential (CHIP) confounds mutation-based approaches',
        'Requires large validation cohorts across diverse cancer types',
        'Clinical utility studies (mortality reduction) still in progress'
      ],
      testCount: ecdTestData.length
    },
    {
      id: 'TDS',
      phase: 'Diagnosis',
      name: 'Treatment Decision Support',
      acronym: 'TDS',
      color: 'violet',
      icon: '🧬',
      clinicalQuestion: 'What is the best treatment approach for this patient?',
      description: 'TDS tests help guide treatment decisions by providing molecular or biomarker information. This includes genomic profiling tests that identify actionable mutations for targeted therapy selection, as well as risk stratification tests that help determine whether interventions like biopsies are needed.',
      technology: 'Includes multiple technologies: NGS-based comprehensive genomic profiling (CGP) from tumor tissue or liquid biopsy to identify targetable alterations; protein structure analysis for risk stratification; and other biomarker assays. Some tests are FDA-approved as companion diagnostics.',
      keyMetrics: [
        'Sensitivity and specificity for intended use case',
        'FDA approval status and guideline recommendations',
        'Turnaround time',
        'Coverage by Medicare and commercial payers'
      ],
      challenges: [
        'Matching test results to appropriate clinical decisions',
        'Variants of uncertain significance (VUS) interpretation in genomic tests',
        'Balancing sensitivity vs specificity for risk stratification',
        'Integration into clinical workflow'
      ],
      testCount: tdsTestData.length
    },
    {
      id: 'TRM',
      phase: 'Treatment',
      name: 'Treatment Response Monitoring',
      acronym: 'TRM',
      color: 'sky',
      icon: '📊',
      clinicalQuestion: 'Is the current therapy effective, and is resistance emerging?',
      description: 'TRM uses serial liquid biopsies to quantify ctDNA dynamics during active therapy. Decreasing ctDNA levels correlate with treatment response; rising levels may indicate progression or resistance—often weeks before radiographic changes are detectable.',
      technology: 'TRM approaches vary: some track specific mutations identified at baseline (tumor-informed), while others monitor a fixed panel of common cancer mutations (tumor-naïve). Quantification methods include variant allele frequency (VAF), absolute ctDNA concentration (copies/mL), or composite molecular response scores. Some platforms can detect emerging resistance mutations to guide therapy switching.',
      keyMetrics: [
        'Analytical sensitivity for quantification at low VAF',
        'Coefficient of variation (CV) for serial measurements',
        'Molecular response thresholds (fold-change or absolute cutoffs)',
        'Correlation with clinical outcomes (PFS, OS)'
      ],
      challenges: [
        'Standardization of "molecular response" definitions across platforms',
        'Optimal sampling intervals during therapy',
        'Integration with imaging-based response assessment',
        'Cost of serial testing'
      ],
      testCount: trmTestData.length
    },
    {
      id: 'MRD',
      phase: 'Surveillance',
      name: 'Minimal Residual Disease',
      acronym: 'MRD',
      color: 'orange',
      icon: '🎯',
      clinicalQuestion: 'Does molecular evidence of disease persist after curative-intent treatment?',
      description: 'MRD testing detects residual cancer at levels far below imaging resolution (typically 0.01-0.001% VAF). MRD-positive status after surgery correlates with higher recurrence risk; MRD-negative results support molecular complete response. Serial MRD testing during surveillance can detect recurrence months before clinical presentation.',
      technology: 'Tumor-informed MRD assays sequence the primary tumor to identify patient-specific mutations, then design custom PCR or hybrid capture panels to track those variants in plasma with maximum sensitivity. Tumor-naïve approaches use fixed panels or methylation signatures. Tumor-informed methods achieve lower LOD but require tissue and longer setup time.',
      keyMetrics: [
        'Limit of detection (LOD)—tumor-informed typically 0.001-0.01% VAF',
        'Sensitivity (% of relapsing patients detected MRD+)',
        'Specificity (% of non-relapsing patients correctly MRD-)',
        'Lead time before clinical/radiographic recurrence'
      ],
      challenges: [
        'Requires adequate tumor tissue for tumor-informed approaches',
        'Turnaround time for custom assay design (2-4 weeks)',
        'Optimal surveillance testing intervals not established for all cancers',
        'Clinical utility data (does MRD-guided therapy improve outcomes?) still maturing'
      ],
      testCount: mrdTestData.length
    }
  ];

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-50',
      bgMedium: 'bg-emerald-100',
      border: 'border-emerald-200',
      borderActive: 'border-emerald-500',
      text: 'text-emerald-600',
      textDark: 'text-emerald-700',
      button: 'bg-emerald-500 hover:bg-emerald-600',
      iconBg: 'bg-emerald-100',
    },
    violet: {
      bg: 'bg-violet-50',
      bgMedium: 'bg-violet-100',
      border: 'border-violet-200',
      borderActive: 'border-violet-500',
      text: 'text-violet-600',
      textDark: 'text-violet-700',
      button: 'bg-violet-500 hover:bg-violet-600',
      iconBg: 'bg-violet-100',
    },
    sky: {
      bg: 'bg-sky-50',
      bgMedium: 'bg-sky-100',
      border: 'border-sky-200',
      borderActive: 'border-sky-500',
      text: 'text-sky-600',
      textDark: 'text-sky-700',
      button: 'bg-sky-500 hover:bg-sky-600',
      iconBg: 'bg-sky-100',
    },
    orange: {
      bg: 'bg-orange-50',
      bgMedium: 'bg-orange-100',
      border: 'border-orange-200',
      borderActive: 'border-orange-500',
      text: 'text-orange-600',
      textDark: 'text-orange-700',
      button: 'bg-orange-500 hover:bg-orange-600',
      iconBg: 'bg-orange-100',
    },
    indigo: {
      bg: 'bg-indigo-50',
      bgMedium: 'bg-indigo-100',
      border: 'border-indigo-200',
      borderActive: 'border-indigo-500',
      text: 'text-indigo-600',
      textDark: 'text-indigo-700',
      button: 'bg-indigo-500 hover:bg-indigo-600',
      iconBg: 'bg-indigo-100',
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Advanced Molecular Diagnostics: An Overview
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
          Modern diagnostic technologies—from next-generation sequencing to protein biomarker analysis—enable blood-based tests across the full cancer care continuum, from early detection to post-treatment surveillance.
        </p>
      </div>

      {/* The Technology Section */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-6 sm:p-8 mb-12 border border-slate-200">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">The Underlying Technologies</h2>
        <p className="text-gray-700 mb-4">
          Advanced molecular diagnostics leverage multiple technologies to extract clinically actionable information from patient samples. <GlossaryTooltip termKey="cfdna"><strong>Cell-free DNA (cfDNA)</strong></GlossaryTooltip> analysis isolates DNA fragments released by cells into the bloodstream—in cancer patients, a fraction derives from tumor cells (<GlossaryTooltip termKey="ctdna"><strong>circulating tumor DNA or ctDNA</strong></GlossaryTooltip>), carrying the same somatic alterations present in the tumor. Beyond DNA, tests may analyze <GlossaryTooltip termKey="methylation">methylation patterns</GlossaryTooltip>, protein biomarkers, or structural variants.
        </p>
        <p className="text-gray-700 mb-6">
          These technologies answer different clinical questions depending on the patient's disease state:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">🔬</span>
            <div>
              <p className="font-semibold text-gray-900">Early Detection</p>
              <p className="text-sm text-gray-600">Detect cancer signals in asymptomatic individuals</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">🧬</span>
            <div>
              <p className="font-semibold text-gray-900">Treatment Decisions</p>
              <p className="text-sm text-gray-600">Guide therapy selection and intervention decisions</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-semibold text-gray-900">Response Monitoring</p>
              <p className="text-sm text-gray-600">Track <GlossaryTooltip termKey="ctdna">ctDNA</GlossaryTooltip> dynamics during active treatment</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-semibold text-gray-900"><GlossaryTooltip termKey="mrd">MRD</GlossaryTooltip> Detection</p>
              <p className="text-sm text-gray-600">Identify residual disease after curative treatment</p>
            </div>
          </div>
        </div>
        
        {/* ctDNA Signal Challenge */}
        <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">The <GlossaryTooltip termKey="ctdna">ctDNA</GlossaryTooltip> Signal Challenge</h3>
          <p className="text-sm text-gray-700 mb-3">
            The fraction of <GlossaryTooltip termKey="cfdna">cfDNA</GlossaryTooltip> that derives from tumor (<GlossaryTooltip termKey="ctdna">ctDNA</GlossaryTooltip> fraction) varies dramatically by clinical context, which drives the <GlossaryTooltip termKey="sensitivity">sensitivity</GlossaryTooltip> requirements for each test category:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Clinical Context</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Typical ctDNA Fraction</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Required <GlossaryTooltip termKey="lod">LOD</GlossaryTooltip></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 px-3 text-gray-700">Advanced cancer (TDS)</td>
                  <td className="py-2 px-3 text-gray-600">1–10%+</td>
                  <td className="py-2 px-3 text-gray-600">0.5–5% <GlossaryTooltip termKey="vaf">VAF</GlossaryTooltip></td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-700">Early-stage screening (ECD)</td>
                  <td className="py-2 px-3 text-gray-600">0.01–0.1%</td>
                  <td className="py-2 px-3 text-gray-600">&lt;0.1% VAF</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-700">Post-surgery surveillance (<GlossaryTooltip termKey="mrd">MRD</GlossaryTooltip>)</td>
                  <td className="py-2 px-3 text-gray-600">0.001–0.01%</td>
                  <td className="py-2 px-3 text-gray-600">&lt;0.01% VAF</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-700">Treatment monitoring (TRM)</td>
                  <td className="py-2 px-3 text-gray-600">Variable (dynamic)</td>
                  <td className="py-2 px-3 text-gray-600">Quantitative accuracy</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Category Sections */}
      <div className="space-y-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-8">Test Categories: Technical Deep Dive</h2>
        
        {categories.map((cat) => {
          const colors = colorClasses[cat.color];
          return (
            <div key={cat.id} className={`${colors.bg} ${colors.border} border-2 rounded-2xl overflow-hidden`}>
              {/* Category Header */}
              <div className={`${colors.bgMedium} px-6 py-4 border-b ${colors.border}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{cat.icon}</span>
                  <div>
                    <p className={`text-xs font-semibold ${colors.text} uppercase tracking-wide`}>{cat.phase}</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{cat.name} ({cat.acronym})</h3>
                  </div>
                </div>
              </div>
              
              {/* Category Content */}
              <div className="p-6 space-y-6">
                {/* Clinical Question */}
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Clinical Question</p>
                  <p className="text-lg font-medium text-gray-900 italic">"{cat.clinicalQuestion}"</p>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Overview</h4>
                  <p className="text-gray-700">{cat.description}</p>
                </div>

                {/* Technology */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Technology & Methodology</h4>
                  <p className="text-gray-700">{cat.technology}</p>
                </div>

                {/* Two columns for metrics and challenges */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Key Performance Metrics</h4>
                    <ul className="space-y-2">
                      {cat.keyMetrics.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700 text-sm">
                          <span className={`${colors.text} mt-1`}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Technical Challenges</h4>
                    <ul className="space-y-2">
                      {cat.challenges.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700 text-sm">
                          <span className={`${colors.text} mt-1`}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-2">
                  <button
                    onClick={() => onNavigate(cat.id)}
                    className={`${colors.button} text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2`}
                  >
                    Explore {cat.testCount} {cat.acronym} Tests
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Reference Table */}
      <div className="mt-12 bg-white rounded-2xl border-2 border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Quick Reference: Test Category Selection</h2>
        <p className="text-gray-600 text-center mb-6">Match clinical context to the appropriate test category:</p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Clinical Context</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Test Category</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Primary Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('ECD')}>
                <td className="py-3 px-4 text-gray-700">Asymptomatic screening</td>
                <td className="py-3 px-4"><span className="text-emerald-600 font-medium">ECD →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">Cancer signal detected (Y/N), tissue of origin</td>
              </tr>
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('TDS')}>
                <td className="py-3 px-4 text-gray-700">Newly diagnosed / therapy selection</td>
                <td className="py-3 px-4"><span className="text-violet-600 font-medium">TDS →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">Actionable mutations, MSI, TMB, fusions</td>
              </tr>
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('TRM')}>
                <td className="py-3 px-4 text-gray-700">On active systemic therapy</td>
                <td className="py-3 px-4"><span className="text-sky-600 font-medium">TRM →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">ctDNA quantification, molecular response</td>
              </tr>
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('MRD')}>
                <td className="py-3 px-4 text-gray-700">Post-curative treatment surveillance</td>
                <td className="py-3 px-4"><span className="text-orange-600 font-medium">MRD →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">MRD status (positive/negative), recurrence risk</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Terms Glossary */}
      <div className="mt-12 bg-white rounded-2xl border-2 border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Key Terms Glossary</h2>
        <p className="text-gray-600 text-center mb-6">Hover or tap any term for its definition and authoritative source</p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Core Concepts */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Core Concepts</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="liquid-biopsy" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ctdna" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="cfdna" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="mrd" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="bloodpac" /></div>
            </div>
          </div>
          
          {/* Testing Approaches */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Testing Approaches</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="tumor-informed" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="tumor-naive" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ngs" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="cgp" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="methylation" /></div>
            </div>
          </div>
          
          {/* Performance Metrics */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Performance Metrics</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="sensitivity" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="specificity" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="lod" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="vaf" /></div>
            </div>
          </div>
          
          {/* MRD & Response */}
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <h3 className="text-sm font-semibold text-orange-700 uppercase tracking-wide mb-3">MRD & Response</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="molecular-response" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ctdna-clearance" /></div>
            </div>
            <p className="text-xs text-orange-600 mt-3">Per BLOODPAC MRD Lexicon</p>
          </div>
          
          {/* Regulatory & Clinical */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Regulatory & Clinical</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="nccn" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="companion-dx" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="fda-approved" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ldt" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="chip" /></div>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          Definitions sourced from NCI, BLOODPAC, FDA, ASCO, and Friends of Cancer Research
        </p>
      </div>

      {/* Authoritative Resources Section */}
      <div className="mt-12 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Authoritative Resources</h2>
        <p className="text-gray-600 text-center mb-6">OpenOnco terminology and standards are informed by these organizations</p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* BLOODPAC */}
          <a 
            href="https://www.bloodpac.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔬</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">BLOODPAC</span>
            </div>
            <p className="text-sm text-gray-600">Cancer Moonshot consortium developing liquid biopsy standards and the MRD Terminology Lexicon</p>
          </a>
          
          {/* Friends of Cancer Research */}
          <a 
            href="https://friendsofcancerresearch.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🤝</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">Friends of Cancer Research</span>
            </div>
            <p className="text-sm text-gray-600">ctMoniTR project validating ctDNA as an early efficacy endpoint in clinical trials</p>
          </a>
          
          {/* NCI */}
          <a 
            href="https://www.cancer.gov" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏛️</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">National Cancer Institute</span>
            </div>
            <p className="text-sm text-gray-600">Authoritative definitions and the NCI Liquid Biopsy Consortium for early detection research</p>
          </a>
          
          {/* FDA */}
          <a 
            href="https://www.fda.gov/media/183874/download" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚖️</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">FDA Guidance</span>
            </div>
            <p className="text-sm text-gray-600">December 2024 guidance on ctDNA for early-stage solid tumor drug development</p>
          </a>
        </div>
        
        {/* Additional Resources */}
        <div className="mt-6 pt-6 border-t border-emerald-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Additional Standards Bodies</h3>
          <div className="flex flex-wrap justify-center gap-3">
            <a 
              href="https://www.nccn.org/guidelines/guidelines-detail" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              📜 NCCN Guidelines
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a 
              href="https://fnih.org/our-programs/international-liquid-biopsy-standardization-alliance-ilsa/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-cyan-300 hover:text-cyan-600 transition-colors"
            >
              🌐 ILSA (Global Standards)
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a 
              href="https://www.lungevity.org/patients-care-partners/navigating-your-diagnosis/biomarker-testing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-pink-300 hover:text-pink-600 transition-colors"
            >
              💡 LUNGevity Patient Resources
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a 
              href="https://ascopubs.org/doi/10.1200/EDBK-25-481114" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              🎓 ASCO Education
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

    </div>
  );
};

// ============================================
// FAQ Components
// ============================================
const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border-b border-gray-200 last:border-b-0">
    <button
      onClick={onClick}
      className="w-full py-5 px-6 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg font-medium text-gray-900 pr-4">{question}</span>
      <svg 
        className={`w-5 h-5 text-gray-500 transform transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isOpen && (
      <div className="pb-5 px-6 pr-12">
        <div className="prose prose-lg text-gray-600">{answer}</div>
      </div>
    )}
  </div>
);

const FAQPage = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const siteConfig = getSiteConfig();
  const isAlz = false; // ALZ DISABLED

  // OpenOnco FAQs
  const oncoFaqs = [
    {
      question: "What types of tests does OpenOnco cover?",
      answer: (
        <p>
          OpenOnco focuses on advanced molecular diagnostics—laboratory-developed tests (LDTs) and services that patients and clinicians can access directly. We cover four categories: <strong>Early Cancer Detection (ECD)</strong> for screening, <strong>Treatment Decision Support (TDS)</strong> for guiding treatment decisions in newly diagnosed patients, <strong>Treatment Response Monitoring (TRM)</strong> for patients on active treatment, and <strong>Minimal Residual Disease (MRD)</strong> for surveillance after treatment. We include tests using various technologies—genomic sequencing, methylation analysis, protein biomarkers, and more—as long as they're orderable clinical services rather than reagent kits laboratories must validate themselves.
        </p>
      )
    },
    {
      question: "Why aren't certain tests included in your database?",
      answer: (
        <div className="space-y-3">
          <p>
            We focus on tests that clinicians can order or patients can request directly. This means we exclude:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>IVD kits sold to laboratories</strong> (e.g., Oncomine Dx Target Test, TruSight Oncology Comprehensive)—these require labs to purchase, validate, and run themselves</li>
            <li><strong>Research-use-only (RUO) assays</strong> not available for clinical ordering</li>
            <li><strong>Tests no longer commercially available</strong></li>
          </ul>
          <p>
            If you believe we're missing a test that should be included, please use the Submissions tab to let us know.
          </p>
        </div>
      )
    },
    {
      question: "How do you decide what information to include for each test?",
      answer: (
        <p>
          We prioritize publicly available, verifiable information from peer-reviewed publications, FDA submissions, company websites, and clinical guidelines (like NCCN). Every data point includes citations so you can verify the source. We focus on information most relevant to test selection: performance metrics (sensitivity, specificity, LOD), regulatory status, turnaround time, sample requirements, cancer types covered, and reimbursement status.
        </p>
      )
    },
    {
      question: "How often is the database updated?",
      answer: (
        <p>
          We update the database regularly as new tests launch, FDA approvals occur, or performance data is published. The build date shown on the Data Download page indicates when the current version was deployed. You can also check the "Recently Added" section on the home page to see the latest additions.
        </p>
      )
    },
    {
      question: "What does it mean when a test is 'NCCN Recommended'?",
      answer: (
        <p>
          This indicates that the test covers biomarkers recommended in NCCN (National Comprehensive Cancer Network) clinical guidelines for the relevant cancer type(s). It's important to note that NCCN recommends testing for specific biomarkers but does not endorse specific commercial assays by name. A test marked as "NCCN Recommended" means it can detect the biomarkers that NCCN guidelines say should be tested—not that NCCN has specifically endorsed that particular test.
        </p>
      )
    },
    {
      question: "What's the difference between FDA-approved and LDT tests?",
      answer: (
        <div className="space-y-3">
          <p>
            <strong>FDA-approved/cleared tests</strong> have been reviewed by the FDA and meet specific analytical and clinical validation requirements. They often have companion diagnostic (CDx) claims linking test results to specific therapies.
          </p>
          <p>
            <strong>Laboratory-developed tests (LDTs)</strong> are developed and validated by individual CLIA-certified laboratories. While they must meet CLIA quality standards, they haven't undergone FDA premarket review. Many high-quality tests are LDTs—FDA approval status alone doesn't determine clinical utility.
          </p>
        </div>
      )
    },
    {
      question: "How should I interpret sensitivity and specificity numbers?",
      answer: (
        <div className="space-y-3">
          <p>
            <strong>Sensitivity</strong> measures how well a test detects disease when it's present (true positive rate). A 90% sensitivity means the test correctly identifies 90% of people who have the condition.
          </p>
          <p>
            <strong>Specificity</strong> measures how well a test correctly identifies people without disease (true negative rate). A 99% specificity means only 1% of healthy people will get a false positive.
          </p>
          <p>
            Important: These numbers can vary significantly based on the patient population, cancer stage, and how the study was conducted. Always look at the context and study population when comparing tests.
          </p>
        </div>
      )
    },
    {
      question: "Is OpenOnco affiliated with any test vendors?",
      answer: (
        <p>
          No. OpenOnco is an independent resource with no financial relationships with test vendors. We don't accept advertising or sponsorship. Our goal is to provide unbiased, transparent information to help patients and clinicians make informed decisions.
        </p>
      )
    },
    {
      question: "What standards and terminology does OpenOnco follow?",
      answer: (
        <div className="space-y-3">
          <p>
            OpenOnco aligns its terminology and categories with authoritative standards bodies and research consortiums to ensure consistency with the broader field. Our key references include:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>BLOODPAC MRD Lexicon</strong> — The Blood Profiling Atlas in Cancer consortium published a standardized terminology lexicon for MRD testing in 2025. We use their definitions for terms like "tumor-informed," "tumor-naïve," "molecular response," and "ctDNA clearance."
              <br /><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View BLOODPAC MRD Lexicon</a>
            </li>
            <li>
              <strong>FDA ctDNA Guidance (December 2024)</strong> — The FDA's guidance document on using ctDNA for early-stage solid tumor drug development informs how we describe regulatory pathways and clinical endpoints.
              <br /><a href="https://www.fda.gov/media/183874/download" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View FDA Guidance (PDF)</a>
            </li>
            <li>
              <strong>Friends of Cancer Research ctMoniTR</strong> — This multi-stakeholder project is validating ctDNA as an early efficacy endpoint. We reference their framework for treatment response monitoring.
              <br /><a href="https://friendsofcancerresearch.org/ctdna/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View ctMoniTR Project</a>
            </li>
            <li>
              <strong>NCI Cancer Dictionary</strong> — For patient-facing definitions of terms like "liquid biopsy" and "ctDNA," we reference the National Cancer Institute's authoritative definitions.
              <br /><a href="https://www.cancer.gov/publications/dictionaries/cancer-terms/def/liquid-biopsy" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View NCI Dictionary</a>
            </li>
            <li>
              <strong>NCCN Clinical Practice Guidelines</strong> — When we indicate a test covers "NCCN-recommended" biomarkers, we're referring to the National Comprehensive Cancer Network's evidence-based guidelines.
              <br /><a href="https://www.nccn.org/guidelines/guidelines-detail" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View NCCN Guidelines</a>
            </li>
          </ul>
          <p>
            For patient education resources, we recommend <a href="https://www.lungevity.org/patients-care-partners/navigating-your-diagnosis/biomarker-testing" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">LUNGevity's biomarker testing guides</a> and the <a href="https://noonemissed.org/lungcancer/us" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">No One Missed campaign</a>.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            You'll find links to these resources throughout OpenOnco on each category page under "Standards & Resources."
          </p>
        </div>
      )
    },
    {
      question: "How does the AI chat feature work, and can I trust its answers?",
      answer: (
        <div className="space-y-3">
          <p>
            Our chat feature is powered by Anthropic's Claude AI. We've designed it to <strong>only reference information from our test database</strong>—it cannot browse the internet or access external sources during your conversation. This means Claude's answers are grounded in the same curated, cited data you see throughout OpenOnco.
          </p>
          <p>
            However, <strong>AI language models can still make mistakes</strong>. They may occasionally misinterpret questions, make errors in reasoning, or present information in misleading ways. This is a limitation of current AI technology, not specific to our implementation.
          </p>
          <p>
            <strong>We strongly recommend:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Cross-checking any important information with vendor websites and official product documentation</li>
            <li>Verifying clinical claims with peer-reviewed publications (we provide citations throughout the database)</li>
            <li>If you're a patient, discussing test options with your doctor or healthcare provider before making decisions</li>
          </ul>
          <p>
            The chat is best used as a starting point for exploration—not as a definitive source for clinical decision-making.
          </p>
        </div>
      )
    },
    {
      question: "Can I download the data?",
      answer: (
        <p>
          Yes! Visit the Data Download tab to download the complete database in JSON format. The data is freely available for research, clinical decision support, or other non-commercial purposes.
        </p>
      )
    },
    {
      question: "How can I report an error or suggest a correction?",
      answer: (
        <p>
          Please use the Submissions tab and select "Request Changes to Test Data." Include the specific test name, the field that needs correction, and ideally a citation for the correct information. We take data accuracy seriously and will review all submissions.
        </p>
      )
    },
    {
      question: "What's the difference between the Patient and Clinician views?",
      answer: (
        <p>
          The Patient view simplifies information and focuses on practical questions: What does this test do? Is it covered by insurance? What's involved in getting tested? The Clinician and Academic/Industry views show more detailed technical information including performance metrics, FDA status, methodology details, and clinical validation data.
        </p>
      )
    },
    {
      question: "How do I contact OpenOnco?",
      answer: (
        <p>
          The best way to reach us is through the Submissions tab. Select the appropriate category for your inquiry—whether it's suggesting a new test, requesting data corrections, or providing general feedback. We review all submissions and will respond if needed.
        </p>
      )
    },
    {
      question: "What is the Openness Score?",
      answer: (
        <div className="space-y-4">
          <p>
            The OpenOnco Openness Score measures how completely vendors disclose key information about their tests. 
            It rewards vendors who publish pricing, performance data, and clinical evidence—information that helps 
            patients and clinicians make informed decisions. Vendors are ranked by their average score across all tests.
          </p>
          
          <p className="font-medium text-gray-800">How is it calculated?</p>
          <p>Each test is scored based on disclosure of key fields (weights sum to 100):</p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Field</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700 border-b">Weight</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Rationale</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b"><td className="py-2 px-3 font-medium">Price</td><td className="text-center py-2 px-3 font-bold text-amber-600">30%</td><td className="py-2 px-3">Hardest to find, gold standard of openness</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 font-medium">Publications</td><td className="text-center py-2 px-3 font-bold text-amber-600">15%</td><td className="py-2 px-3">Peer-reviewed evidence base</td></tr>
                <tr className="border-b"><td className="py-2 px-3 font-medium">Turnaround Time</td><td className="text-center py-2 px-3 font-bold text-amber-600">10%</td><td className="py-2 px-3">Practical info for clinicians</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 font-medium">Sample Info</td><td className="text-center py-2 px-3 font-bold text-amber-600">10%</td><td className="py-2 px-3">Blood volume, sample type, or category</td></tr>
                <tr className="border-b"><td className="py-2 px-3 font-medium">Trial Participants</td><td className="text-center py-2 px-3 font-bold text-amber-600">5%</td><td className="py-2 px-3">Clinical evidence depth</td></tr>
                <tr className="border-b bg-blue-50"><td className="py-2 px-3 font-medium italic" colSpan="3">+ Category-Specific Metrics (30%)</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 pl-6 text-xs">ECD (Screening)</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">Sensitivity + Specificity (cancer detection)</td></tr>
                <tr className="border-b"><td className="py-2 px-3 pl-6 text-xs">MRD</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">LOD (limit of detection)</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 pl-6 text-xs">TRM</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">Sensitivity + Specificity (mutation detection)</td></tr>
                <tr className="border-b"><td className="py-2 px-3 pl-6 text-xs">TDS (CGP)</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">Genes Analyzed + CDx Claims</td></tr>
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-200"><td className="py-2 px-3 font-bold">Total</td><td className="text-center py-2 px-3 font-bold text-amber-700">100%</td><td className="py-2 px-3"></td></tr>
              </tfoot>
            </table>
          </div>
          
          <p className="font-medium text-gray-800 mt-4">Why category-normalized scoring?</p>
          <p>
            Different test categories have different "standard" metrics. CGP tests don't report sensitivity/specificity 
            like screening tests do — they report panel size and companion diagnostic claims. MRD tests focus on limit 
            of detection. By normalizing per-category, we compare apples to apples.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">Who is eligible for ranking?</p>
          <p>
            Vendors must have <strong>2 or more tests</strong> in the OpenOnco database to qualify. The vendor's 
            score is the <strong>average</strong> across all their tests. This prevents a single well-documented 
            test from dominating while encouraging comprehensive disclosure across product portfolios.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">Why these weights?</p>
          <p>
            <strong>Price (30%)</strong> is weighted highest because it's the most commonly withheld information 
            and critically important for patients and healthcare systems. <strong>Category-specific metrics (30%)</strong> are 
            essential for clinical decision-making but vary by test type. <strong>Publications (15%)</strong> demonstrate commitment to 
            independent validation. Practical details like <strong>TAT and sample requirements (15% combined)</strong> help 
            with care coordination.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">How can vendors improve their score?</p>
          <p>
            Publish your list price, disclose the key performance metrics for your test category, maintain an 
            active publication record, and provide clear sample requirements. Vendors can submit updated information 
            through our Submissions page.
          </p>
        </div>
      )
    }
  ];

  // OpenAlz FAQs
  const alzFaqs = [
    {
      question: "What types of tests does OpenAlz cover?",
      answer: (
        <p>
          OpenAlz focuses on blood-based biomarker tests for Alzheimer's disease evaluation. We currently cover tests measuring pTau217, pTau181, and amyloid-beta ratios (Abeta42/40)—the leading plasma biomarkers for detecting Alzheimer's pathology. We include tests using various technologies including mass spectrometry and immunoassays, as long as they're clinically available or in late-stage development.
        </p>
      )
    },
    {
      question: "Why blood tests for Alzheimer's?",
      answer: (
        <div className="space-y-3">
          <p>
            Traditionally, diagnosing Alzheimer's disease required expensive PET scans (~$5,000-8,000) or invasive lumbar punctures for CSF analysis. Blood-based biomarkers are transforming the field by offering:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Accessibility</strong>—a simple blood draw vs. specialized imaging or spinal tap</li>
            <li><strong>Cost</strong>—typically $500-1,500 vs. thousands for PET imaging</li>
            <li><strong>Scalability</strong>—can be performed at any clinical laboratory</li>
            <li><strong>Early detection</strong>—can identify pathology years before symptoms</li>
          </ul>
          <p>
            The 2024 Alzheimer's Association appropriate use recommendations now support blood biomarkers as a first-line tool for evaluating patients with cognitive symptoms.
          </p>
        </div>
      )
    },
    {
      question: "What's the difference between pTau217 and Abeta42/40 tests?",
      answer: (
        <div className="space-y-3">
          <p>
            <strong>Abeta42/40 ratio</strong> measures amyloid-beta peptides in blood. A low ratio suggests amyloid plaque accumulation in the brain—one of the hallmarks of Alzheimer's pathology.
          </p>
          <p>
            <strong>pTau217</strong> (phosphorylated tau at position 217) is currently considered the most specific blood biomarker for Alzheimer's. It detects tau pathology and shows changes early in the disease process.
          </p>
          <p>
            Tests combining both biomarkers (like PrecivityAD2) generally show higher accuracy than single-biomarker tests.
          </p>
        </div>
      )
    },
    {
      question: "How accurate are blood tests compared to PET scans?",
      answer: (
        <div className="space-y-3">
          <p>
            The best blood biomarker tests show 88-93% concordance with amyloid PET imaging. This means they agree with PET results approximately 9 out of 10 times. For context:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>PrecivityAD2</strong> (pTau217 + Abeta42/40): ~88% concordance with amyloid PET</li>
            <li><strong>Lumipulse pTau217</strong>: ~91% concordance with amyloid PET</li>
            <li><strong>ALZpath pTau217</strong>: ~92% concordance with amyloid PET</li>
          </ul>
          <p>
            While not as definitive as PET imaging, blood tests can effectively screen patients to determine who would benefit from confirmatory PET scans, reducing unnecessary procedures and costs.
          </p>
        </div>
      )
    },
    {
      question: "Are these tests covered by insurance?",
      answer: (
        <div className="space-y-3">
          <p>
            Coverage varies significantly by test and payer:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>PrecivityAD2</strong>—Medicare coverage via LCD (first Alzheimer's blood test with Medicare coverage)</li>
            <li><strong>AD-Detect</strong>—Limited coverage, ~$500 out-of-pocket</li>
            <li><strong>Other tests</strong>—Coverage varies; many are primarily research use</li>
          </ul>
          <p>
            We're tracking reimbursement status for each test in our database to help patients and clinicians understand costs.
          </p>
        </div>
      )
    },
    {
      question: "Who should get tested?",
      answer: (
        <p>
          According to the 2024 Alzheimer's Association appropriate use recommendations, blood biomarker tests are most appropriate for adults 55+ with mild cognitive impairment (MCI) or mild dementia who are being evaluated for possible Alzheimer's disease. These tests help determine whether amyloid pathology may be contributing to cognitive symptoms, guiding further workup and treatment decisions. They are not currently recommended for asymptomatic screening in the general population.
        </p>
      )
    },
    {
      question: "Is OpenAlz affiliated with any test vendors?",
      answer: (
        <p>
          No. OpenAlz is an independent resource with no financial relationships with test vendors. We don't accept advertising or sponsorship. Our goal is to provide unbiased, transparent information to help patients and clinicians navigate the rapidly evolving landscape of Alzheimer's blood testing.
        </p>
      )
    },
    {
      question: "How does the AI chat feature work?",
      answer: (
        <div className="space-y-3">
          <p>
            Our chat feature is powered by Anthropic's Claude AI, designed to <strong>only reference information from our test database</strong>. This means answers are grounded in the same curated, cited data you see throughout OpenAlz.
          </p>
          <p>
            However, <strong>AI can make mistakes</strong>. We recommend cross-checking important information with test vendors and discussing options with your healthcare provider before making decisions about testing.
          </p>
        </div>
      )
    },
    {
      question: "How can I report an error or suggest a test to add?",
      answer: (
        <p>
          Please use the Submissions tab. We take data accuracy seriously and welcome corrections, new test suggestions, and general feedback.
        </p>
      )
    },
    {
      question: "How do I contact OpenAlz?",
      answer: (
        <p>
          The best way to reach us is through the Submissions tab. Select the appropriate category for your inquiry. We review all submissions and will respond if needed.
        </p>
      )
    },
  ];

  const faqs = isAlz ? alzFaqs : oncoFaqs;

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
      <p className="text-gray-600 mb-8">
        Common questions about {siteConfig.name}, our data, and how to use the platform.
      </p>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
        {faqs.map((faq, index) => (
          <FAQItem
            key={index}
            question={faq.question}
            answer={faq.answer}
            isOpen={openIndex === index}
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>

      {/* Openness Ranking - Hidden on mobile, only show for OpenOnco */}
      {!isAlz && (
        <div className="hidden md:block mt-8">
          <OpennessAward />
        </div>
      )}

      {/* Database Summary - Hidden on mobile */}
      <div className="hidden md:block mt-6">
        <DatabaseSummary />
      </div>
    </div>
  );
};

// ============================================
// About Page
// ============================================
const AboutPage = () => {
  const siteConfig = getSiteConfig();
  const isAlz = false; // ALZ DISABLED

  if (isAlz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">About OpenAlz</h1>
        <div className="prose prose-lg text-gray-700 space-y-6">
          <p>
            Hi, my name is <a href="https://www.linkedin.com/in/alexgdickinson/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline">Alex Dickinson</a>. I also run <a href="https://openonco.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline">OpenOnco</a>, a non-profit database of cancer diagnostic tests that I started in memory of my sister Ingrid, who died from a brain tumor when she was eleven.
          </p>
          <p>
            The same revolution in molecular diagnostics that's transforming cancer detection is now reaching Alzheimer's disease. Blood-based biomarkers like pTau217 and amyloid-beta ratios can now detect Alzheimer's pathology years before symptoms appear—and at a fraction of the cost of PET imaging.
          </p>
          <p>
            But this rapidly evolving landscape can be overwhelming. New tests are launching constantly, each with different technologies, performance characteristics, and availability. OpenAlz is an effort to collect, curate, and explain all the data on these tests—helping patients, caregivers, and clinicians make informed decisions.
          </p>
          <p>
            OpenAlz is a non-profit project, self-funded as an extension of my work on OpenOnco.
          </p>
        </div>
        <div className="mt-12 flex justify-center">
          <img 
            src="/IngridandAlex.jpeg" 
            alt="Ingrid and Alex" 
            className="rounded-xl shadow-lg max-w-md w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">About</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <p>
          Hi, my name is <a href="https://www.linkedin.com/in/alexgdickinson/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 underline">Alex Dickinson</a>. Like many of you, my friends and family have been impacted by cancer throughout my life. Most significantly for me, my sister Ingrid died from a brain tumor when she was eleven and I was seven—you can see us together in the photo below.
        </p>
        <p>
          Professionally I've had the good fortune to stumble into the amazing world of cancer diagnostics—the people, companies, and technologies. Along the way I've become convinced that the emerging new generation of molecular cancer tests (largely enabled by next-generation sequencing) will have an extraordinary impact on cancer detection and treatment.
        </p>
        <p>
          Because these tests detect biomolecular events at tiny concentrations—now approaching one in a billion—this is a very complex field, and test data and options can overwhelm doctors and patients alike. This confusion will only increase as the number of tests rapidly expands due to both advances in the technology and the decision to maintain a low level of test regulation in the US.
        </p>
        <p>
          OpenOnco is an effort to collect, curate, and explain to both patients and their doctors all the data on all these tests.
        </p>
        <p>
          OpenOnco is a non-profit that I am self-funding in memory of my sister Ingrid.
        </p>
      </div>
      <div className="mt-12 flex justify-center">
        <img 
          src="/IngridandAlex.jpeg" 
          alt="Ingrid and Alex" 
          className="rounded-xl shadow-lg max-w-md w-full"
        />
      </div>
    </div>
  );
};

// ============================================
// How It Works Page
// ============================================
const HowItWorksPage = () => {
  const siteConfig = getSiteConfig();
  const isAlz = false; // ALZ DISABLED

  if (isAlz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h1>
        <div className="prose prose-lg text-gray-700 space-y-6">

          <h2 className="text-2xl font-bold text-gray-900">OpenAlz is Open</h2>
          
          <p>
            The OpenAlz database is assembled from public sources including vendor documentation, peer-reviewed publications, clinical validation studies, and regulatory filings. Sources are cited to the best of our ability along with context and notes on data interpretation.
          </p>

          <p>
            The current version of the OpenAlz database is available for anyone to download—go to the <strong>Data Download</strong> tab. Go to the <strong>Submissions</strong> tab to tell us about a new test, request changes to test data, and send us bug reports and feature suggestions. You can also see our log of all data changes on the site.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10">Understanding the Tests</h2>
          
          <p>
            Blood-based Alzheimer's biomarkers are a rapidly evolving field. The main biomarkers we track are:
          </p>
          
          <ul className="list-disc list-inside space-y-2 mt-4">
            <li><strong>pTau217</strong> — Phosphorylated tau at position 217, currently the most AD-specific plasma biomarker</li>
            <li><strong>pTau181</strong> — Phosphorylated tau at position 181, the first validated plasma tau biomarker</li>
            <li><strong>Abeta42/40 ratio</strong> — Ratio of amyloid-beta 42 to 40, indicating amyloid plaque burden</li>
          </ul>
          
          <p className="mt-4">
            Tests use different technologies (mass spectrometry, immunoassays) and may measure single biomarkers or combinations. Performance is typically validated against amyloid PET imaging and/or CSF biomarkers.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10">Technical Information</h2>
          
          <p className="mt-4">
            OpenAlz is vibe-coded in React using Opus 4.5. The test database is hardcoded as a JSON structure inside the app. The app (and embedded database) are updated as-needed when new data or tools are added. You can find the build date of the version you are running under the <strong>Data Download</strong> tab.
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">

        <h2 className="text-2xl font-bold text-gray-900">OpenOnco is Open</h2>
        
        <p>
          The OpenOnco database is assembled from a wide variety of public sources including vendor databases, peer reviewed publications, and clinical trial registries. Sources are cited to the best of our ability along with context and notes on possible contradictory data and its resolution. Information on the database update process can be found below in the Technical Information section.
        </p>

        <p>
          The current version of the OpenOnco database is available for anyone to download in several formats - go to the <strong>Data Download</strong> tab. Go to the <strong>Submissions</strong> tab to tell us about a new test, request changes to test data, and send us bug reports and feature suggestions. You can also see our log of all data changes on the site.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-10">Technical Information</h2>
        
        <p className="mt-4">
          OpenOnco is vibe-coded in React using Opus 4.5. The test database is hardcoded as a JSON structure inside the app. The app (and embedded database) are updated as-needed when new data or tools are added. You can find the build date of the version you are running under the <strong>Data Download</strong> tab. Data for each build is cross-checked by GPT Pro 5.1, Gemini 3, and Opus 4.5. Once the models have beaten each other into submission, the new code is committed to GitHub and deployed on Vercel.
        </p>

      </div>
    </div>
  );
};

// ============================================
// Submissions Page
// ============================================
const SubmissionsPage = ({ prefill, onClearPrefill, vendorInvite, onClearVendorInvite }) => {
  const siteConfig = getSiteConfig();
  const isAlz = false; // ALZ DISABLED
  const domainChangelog = isAlz ? ALZ_DATABASE_CHANGELOG : DATABASE_CHANGELOG;
  
  const [submissionType, setSubmissionType] = useState(''); // 'new', 'correction', 'validation', 'bug', 'feature'
  const [submitterType, setSubmitterType] = useState(''); // 'vendor' or 'expert'
  const [category, setCategory] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  // New test fields
  const [newTestName, setNewTestName] = useState('');
  const [newTestVendor, setNewTestVendor] = useState('');
  const [newTestUrl, setNewTestUrl] = useState('');
  const [newTestNotes, setNewTestNotes] = useState('');
  
  // Correction fields
  const [existingTest, setExistingTest] = useState('');
  
  // Complete missing fields - multiple parameters with values
  const [completeFieldEntries, setCompleteFieldEntries] = useState([]);
  const [selectedParameter, setSelectedParameter] = useState('');
  const [newValue, setNewValue] = useState('');
  const [citation, setCitation] = useState('');
  
  // Vendor validation fields
  const [validationTest, setValidationTest] = useState('');
  const [validationEdits, setValidationEdits] = useState([]); // Array of {field, value, citation}
  const [validationField, setValidationField] = useState('');
  const [validationValue, setValidationValue] = useState('');
  const [validationCitation, setValidationCitation] = useState('');
  const [validationAttestation, setValidationAttestation] = useState(false);
  
  // Track if form was prefilled (from Competitions page navigation)
  const [isPrefilled, setIsPrefilled] = useState(false);
  
  // Track if this is an invited vendor (skip verification)
  const [isInvitedVendor, setIsInvitedVendor] = useState(false);
  
  // Handle vendor invite from app-level URL parsing
  useEffect(() => {
    if (vendorInvite && vendorInvite.email) {
      // Set up for vendor validation with pre-verified email
      setSubmissionType('validation');
      setSubmitterType('vendor');
      setContactEmail(vendorInvite.email);
      setVerificationStep('verified'); // Skip verification for invited vendors
      setIsInvitedVendor(true);
      
      // Parse name if provided (format: "First Last")
      if (vendorInvite.name) {
        const nameParts = vendorInvite.name.trim().split(' ');
        if (nameParts.length >= 1) {
          setFirstName(nameParts[0]);
        }
        if (nameParts.length >= 2) {
          setLastName(nameParts.slice(1).join(' '));
        }
      }
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      // Clear the invite after processing
      if (onClearVendorInvite) {
        onClearVendorInvite();
      }
    }
  }, [vendorInvite, onClearVendorInvite]);
  
  // Handle URL parameters for direct vendor invitations (fallback)
  // URL format: /submissions?invite=vendor&email=person@company.com&name=John%20Doe
  useEffect(() => {
    // Only run if vendorInvite prop wasn't provided
    if (vendorInvite) return;
    
    const params = new URLSearchParams(window.location.search);
    const inviteType = params.get('invite');
    const inviteEmail = params.get('email');
    const inviteName = params.get('name');
    
    if (inviteType === 'vendor' && inviteEmail) {
      // Set up for vendor validation with pre-verified email
      setSubmissionType('validation');
      setSubmitterType('vendor');
      setContactEmail(inviteEmail);
      setVerificationStep('verified'); // Skip verification for invited vendors
      setIsInvitedVendor(true);
      
      // Parse name if provided (format: "First Last")
      if (inviteName) {
        const nameParts = inviteName.trim().split(' ');
        if (nameParts.length >= 1) {
          setFirstName(nameParts[0]);
        }
        if (nameParts.length >= 2) {
          setLastName(nameParts.slice(1).join(' '));
        }
      }
      
      // Clean up URL without reloading page
      window.history.replaceState({}, '', window.location.pathname);
      
      // Scroll to top
      window.scrollTo(0, 0);
    }
  }, [vendorInvite]);
  
  // Handle prefill from navigation (e.g., from Competitions page)
  useEffect(() => {
    if (prefill) {
      if (prefill.submissionType) {
        setSubmissionType(prefill.submissionType);
      }
      if (prefill.prefillCategory) {
        setCategory(prefill.prefillCategory);
      }
      if (prefill.prefillTest) {
        setExistingTest(prefill.prefillTest);
        setIsPrefilled(true); // Mark as prefilled to lock selections
      }
      // Scroll to top of page
      window.scrollTo(0, 0);
      // Clear prefill after applying
      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefill, onClearPrefill]);
  
  // Bug/Feature feedback fields
  const [feedbackDescription, setFeedbackDescription] = useState('');
  
  // Email verification states
  const [verificationStep, setVerificationStep] = useState('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Get existing tests for correction dropdown
  const existingTests = {
    MRD: mrdTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    ECD: ecdTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    TRM: trmTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    TDS: tdsTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
    'ALZ-BLOOD': alzBloodTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
  };

  // Parameters available for correction by category
  const parameterOptions = {
    MRD: [
      { key: 'sensitivity', label: 'Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'analyticalSpecificity', label: 'Analytical Specificity (%)' },
      { key: 'clinicalSpecificity', label: 'Clinical Specificity (%)' },
      { key: 'lod', label: 'LOD (Detection Threshold)' },
      { key: 'lod95', label: 'LOD95 (95% Confidence)' },
      { key: 'variantsTracked', label: 'Variants Tracked' },
      { key: 'initialTat', label: 'Initial Turnaround Time (days)' },
      { key: 'followUpTat', label: 'Follow-up Turnaround Time (days)' },
      { key: 'bloodVolume', label: 'Blood Volume (mL)' },
      { key: 'cfdnaInput', label: 'cfDNA Input (ng)' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'cptCodes', label: 'CPT Codes' },
      { key: 'clinicalTrials', label: 'Clinical Trials' },
      { key: 'totalParticipants', label: 'Total Trial Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    ECD: [
      { key: 'sensitivity', label: 'Overall Sensitivity (%)' },
      { key: 'stageISensitivity', label: 'Stage I Sensitivity (%)' },
      { key: 'stageIISensitivity', label: 'Stage II Sensitivity (%)' },
      { key: 'stageIIISensitivity', label: 'Stage III Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'ppv', label: 'Positive Predictive Value (%)' },
      { key: 'npv', label: 'Negative Predictive Value (%)' },
      { key: 'tat', label: 'Turnaround Time (days)' },
      { key: 'listPrice', label: 'List Price ($)' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'screeningInterval', label: 'Screening Interval' },
      { key: 'clinicalTrials', label: 'Clinical Trials' },
      { key: 'totalParticipants', label: 'Total Trial Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    TRM: [
      { key: 'sensitivity', label: 'Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'lod', label: 'LOD (Detection Threshold)' },
      { key: 'lod95', label: 'LOD95 (95% Confidence)' },
      { key: 'leadTimeVsImaging', label: 'Lead Time vs Imaging (days)' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'clinicalTrials', label: 'Clinical Trials' },
      { key: 'totalParticipants', label: 'Total Trial Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    TDS: [
      { key: 'genesAnalyzed', label: 'Genes Analyzed' },
      { key: 'biomarkersReported', label: 'Biomarkers Reported' },
      { key: 'fdaCompanionDxCount', label: 'FDA CDx Indications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'sampleRequirements', label: 'Sample Requirements' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'listPrice', label: 'List Price ($)' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
    'ALZ-BLOOD': [
      { key: 'sensitivity', label: 'Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'concordanceWithPET', label: 'PET Concordance (%)' },
      { key: 'concordanceWithCSF', label: 'CSF Concordance (%)' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'sampleRequirements', label: 'Sample Requirements' },
      { key: 'fdaStatus', label: 'FDA/Regulatory Status' },
      { key: 'reimbursement', label: 'Reimbursement/Coverage' },
      { key: 'listPrice', label: 'List Price ($)' },
      { key: 'totalParticipants', label: 'Validation Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
  };

  // Get current value of selected parameter for the selected test
  const getCurrentValue = () => {
    if (!existingTest || !selectedParameter || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : category === 'TRM' ? trmTestData : category === 'TDS' ? tdsTestData : alzBloodTestData;
    const test = testList.find(t => t.id === existingTest);
    if (!test || selectedParameter === 'other') return '';
    const value = test[selectedParameter];
    return value !== null && value !== undefined ? String(value) : 'Not specified';
  };

  // Get vendor name for selected test (for email validation)
  const getSelectedTestVendor = () => {
    if (!existingTest || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : category === 'TRM' ? trmTestData : tdsTestData;
    const test = testList.find(t => t.id === existingTest);
    return test?.vendor || '';
  };

  // Validate email format
  const validateEmailFormat = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if email domain is free (Gmail, Yahoo, etc.)
  const isFreeEmail = (email) => {
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'live.com', 'msn.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return freeProviders.includes(domain);
  };

  // Check if email domain matches vendor
  // Check if email domain contains vendor name (loose match)
  const emailMatchesVendor = (email, vendor) => {
    if (!email || !vendor) return false;
    // Get full domain after @ (e.g., "ryght.ai" or "ryghtinc.com")
    const fullDomain = email.split('@')[1]?.toLowerCase() || '';
    // Clean vendor name to just alphanumeric (e.g., "Ryght Inc." -> "ryghtinc")
    const vendorClean = vendor.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Clean domain to just alphanumeric for matching (e.g., "ryght.ai" -> "ryghtai")
    const domainClean = fullDomain.replace(/[^a-z0-9]/g, '');
    // Get domain without TLD for matching (e.g., "genomictestingcooperativecom" -> "genomictestingcooperative")
    const domainWithoutTld = fullDomain.split('.').slice(0, -1).join('').replace(/[^a-z0-9]/g, '');
    // Check if vendor name appears in domain OR domain appears in vendor name
    // This handles cases like "Genomic Testing Cooperative (GTC)" where vendor has extra text
    return domainClean.includes(vendorClean) || vendorClean.includes(domainWithoutTld);
  };

  // Validate email based on submitter type
  const validateEmail = () => {
    if (!validateEmailFormat(contactEmail)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    if (isFreeEmail(contactEmail)) {
      setEmailError('Please use a company/institutional email (not Gmail, Yahoo, etc.)');
      return false;
    }

    // Block vendor domain emails when claiming Independent Expert
    if (submitterType === 'expert' && (submissionType === 'new' || submissionType === 'correction')) {
      const emailDomain = contactEmail.split('@')[1]?.toLowerCase() || '';
      // Known vendor domains - comprehensive list
      const knownVendorDomains = [
        { domain: 'ryght.ai', vendor: 'Ryght AI' },
        { domain: 'illumina.com', vendor: 'Illumina' },
        { domain: 'guardanthealth.com', vendor: 'Guardant Health' },
        { domain: 'natera.com', vendor: 'Natera' },
        { domain: 'foundationmedicine.com', vendor: 'Foundation Medicine' },
        { domain: 'grail.com', vendor: 'Grail' },
        { domain: 'exact.com', vendor: 'Exact Sciences' },
        { domain: 'exactsciences.com', vendor: 'Exact Sciences' },
        { domain: 'tempus.com', vendor: 'Tempus' },
        { domain: 'personalis.com', vendor: 'Personalis' },
        { domain: 'neogenomics.com', vendor: 'NeoGenomics' },
        { domain: 'labcorp.com', vendor: 'Labcorp' },
        { domain: 'quest.com', vendor: 'Quest Diagnostics' },
        { domain: 'questdiagnostics.com', vendor: 'Quest Diagnostics' },
        { domain: 'adaptivebiotech.com', vendor: 'Adaptive Biotechnologies' },
        { domain: 'caris.com', vendor: 'Caris Life Sciences' },
        { domain: 'carislifesciences.com', vendor: 'Caris Life Sciences' },
        { domain: 'roche.com', vendor: 'Roche' },
        { domain: 'veracyte.com', vendor: 'Veracyte' },
        { domain: 'myriad.com', vendor: 'Myriad Genetics' },
        { domain: 'invitae.com', vendor: 'Invitae' },
        { domain: 'biofiredefense.com', vendor: 'BioFire' },
        { domain: 'biofiredx.com', vendor: 'BioFire' },
        { domain: 'freenome.com', vendor: 'Freenome' },
        { domain: 'c2i-genomics.com', vendor: 'C2i Genomics' },
        { domain: 'sagadiagnostics.com', vendor: 'SAGA Diagnostics' },
        { domain: 'billiontoone.com', vendor: 'BillionToOne' },
        { domain: 'sophiagenetics.com', vendor: 'SOPHiA GENETICS' },
        { domain: 'genomictestingcooperative.com', vendor: 'Genomic Testing Cooperative (GTC)' },
      ];
      
      const matchedVendor = knownVendorDomains.find(v => emailDomain === v.domain || emailDomain.endsWith('.' + v.domain));
      if (matchedVendor) {
        setEmailError(`Your email domain (${emailDomain}) appears to be from ${matchedVendor.vendor}. Please select "Test Vendor Representative" instead.`);
        return false;
      }
    }

    // Only check vendor email match for vendor submissions on test data
    if (submitterType === 'vendor' && (submissionType === 'new' || submissionType === 'correction')) {
      const vendor = submissionType === 'new' ? newTestVendor : getSelectedTestVendor();
      if (!emailMatchesVendor(contactEmail, vendor)) {
        setEmailError(`For vendor submissions, email domain must contain "${vendor || 'vendor name'}"`);
        return false;
      }
    }

    setEmailError('');
    return true;
  };

  // Send verification code
  const sendVerificationCode = async () => {
    if (!validateEmail()) return;

    setIsSendingCode(true);
    setVerificationError('');

    let vendor = 'OpenOnco';
    let testName = submissionType === 'bug' ? 'Bug Report' : submissionType === 'feature' ? 'Feature Request' : '';
    
    if (submissionType === 'new') {
      vendor = newTestVendor;
      testName = newTestName;
    } else if (submissionType === 'correction') {
      vendor = getSelectedTestVendor();
      testName = existingTests[category]?.find(t => t.id === existingTest)?.name;
    }

    try {
      const response = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contactEmail,
          vendor: vendor,
          testName: testName
        })
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationToken(data.token);
        setVerificationStep('verify');
      } else {
        setVerificationError(data.error || 'Failed to send verification code');
      }
    } catch (error) {
      setVerificationError('Network error. Please try again.');
    }

    setIsSendingCode(false);
  };

  // Verify the code
  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      setVerificationError('Please enter the 6-digit code');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationToken,
          code: verificationCode
        })
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationStep('verified');
      } else {
        setVerificationError(data.error || 'Verification failed');
      }
    } catch (error) {
      setVerificationError('Network error. Please try again.');
    }

    setIsVerifying(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (verificationStep !== 'verified') {
      setEmailError('Please verify your email first');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    let submission = {
      submissionType,
      submitter: {
        firstName,
        lastName,
        email: contactEmail,
      },
      emailVerified: true,
      timestamp: new Date().toISOString(),
    };

    if (submissionType === 'bug' || submissionType === 'feature') {
      submission.feedback = {
        type: submissionType === 'bug' ? 'Bug Report' : 'Feature Request',
        description: feedbackDescription,
      };
    } else if (submissionType === 'validation') {
      // Vendor Test Validation submission
      const testData = getValidationTestData();
      
      // Auto-capture any pending edit that wasn't explicitly added
      let allEdits = [...validationEdits];
      if (validationField && validationValue && validationCitation) {
        allEdits.push({
          field: validationField,
          value: validationValue,
          citation: validationCitation
        });
      }
      
      const categoryFullName = {
        'MRD': 'Minimal Residual Disease',
        'ECD': 'Early Cancer Detection', 
        'TRM': 'Treatment Response Monitoring',
        'TDS': 'Treatment Decision Support'
      }[getValidationTestCategory()] || getValidationTestCategory();
      
      submission.submitterType = 'vendor';
      submission.category = getValidationTestCategory();
      
      // Email formatting helpers
      const testNameDisplay = testData?.name || `Test ID: ${validationTest}`;
      const vendorDisplay = testData?.vendor || 'Unknown Vendor';
      
      submission.emailSubject = `OpenOnco Vendor Validation: ${testNameDisplay} (${getValidationTestCategory()}) - ${isInvitedVendor ? 'Invited Vendor' : 'Vendor Representative'}`;
      submission.emailSummary = {
        header: `OpenOnco Vendor Validation Request: ${testNameDisplay} (${getValidationTestCategory()}) - ${isInvitedVendor ? 'Invited Vendor' : 'Vendor Representative'}`,
        verificationBadge: `✓ Email Verified: ${contactEmail}${isInvitedVendor ? ' (Invited)' : ''}`,
        details: [
          { label: 'Submitter Type', value: isInvitedVendor ? 'Vendor Representative (Invited)' : 'Vendor Representative' },
          { label: 'Category', value: `${getValidationTestCategory()} - ${categoryFullName}` },
          { label: 'Test Name', value: testNameDisplay },
          { label: 'Vendor', value: vendorDisplay },
          { label: 'Edits Submitted', value: allEdits.length > 0 ? `${allEdits.length} field(s)` : 'None (validation only)' },
          { label: 'Attestation', value: validationAttestation ? '✓ Confirmed' : '✗ Not confirmed' }
        ],
        editsFormatted: allEdits.map(e => `• ${e.field}: ${e.value} (Citation: ${e.citation})`).join('\n')
      };
      
      // Also add correction-compatible object for server email template compatibility
      submission.correction = {
        testId: validationTest,
        testName: testNameDisplay,
        vendor: vendorDisplay,
        parameter: allEdits.length > 0 ? 'Vendor Validation + Edits' : 'Vendor Validation (No Edits)',
        parameterLabel: allEdits.length > 0 ? `Vendor Validation with ${allEdits.length} edit(s)` : 'Vendor Validation Only',
        currentValue: 'See current test data',
        newValue: allEdits.length > 0 
          ? allEdits.map(e => `${e.field}: ${e.value}`).join('; ') 
          : 'Vendor attests all data is accurate',
        citation: allEdits.length > 0 
          ? allEdits.map(e => e.citation).join(', ')
          : 'Vendor attestation'
      };
      
      submission.validation = {
        testId: validationTest,
        testName: testNameDisplay,
        vendor: vendorDisplay,
        edits: allEdits,
        isInvitedVendor: isInvitedVendor,
        attestation: {
          confirmed: validationAttestation,
          submitterName: `${firstName} ${lastName}`,
          submitterEmail: contactEmail,
          timestamp: new Date().toISOString(),
        }
      };
    } else {
      submission.submitterType = submitterType;
      submission.category = category;
      
      if (submissionType === 'new') {
        submission.newTest = {
          name: newTestName,
          vendor: newTestVendor,
          performanceUrl: newTestUrl,
          additionalNotes: newTestNotes,
        };
      } else if (submissionType === 'correction') {
        submission.correction = {
          testId: existingTest,
          testName: existingTests[category]?.find(t => t.id === existingTest)?.name,
          vendor: getSelectedTestVendor(),
          parameter: selectedParameter,
          parameterLabel: parameterOptions[category]?.find(p => p.key === selectedParameter)?.label,
          currentValue: getCurrentValue(),
          newValue: newValue,
          citation: citation,
        };
      }
    }

    try {
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission })
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
      } else {
        setSubmitError(data.error || 'Failed to submit. Please try again.');
      }
    } catch (error) {
      setSubmitError('Network error. Please try again.');
    }

    setIsSubmitting(false);
  };

  const resetForm = () => {
    setSubmissionType('');
    setSubmitterType('');
    setCategory('');
    setFirstName('');
    setLastName('');
    setContactEmail('');
    setEmailError('');
    setSubmitted(false);
    setNewTestName('');
    setNewTestVendor('');
    setNewTestUrl('');
    setNewTestNotes('');
    setExistingTest('');
    setSelectedParameter('');
    setNewValue('');
    setCitation('');
    setFeedbackDescription('');
    setVerificationStep('form');
    setVerificationCode('');
    setVerificationToken('');
    setVerificationError('');
    setIsSubmitting(false);
    setSubmitError('');
    // Validation fields
    setValidationTest('');
    setValidationEdits([]);
    setValidationField('');
    setValidationValue('');
    setValidationCitation('');
    setValidationAttestation(false);
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-200">
          <svg className="w-16 h-16 text-emerald-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">Request Submitted!</h2>
          <p className="text-emerald-700 mb-6">Your request has been submitted successfully. We'll review it and update our database soon. Thank you for contributing!</p>
          <button onClick={resetForm} className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  // Check if form is ready for email verification
  const isReadyForVerification = () => {
    if (!submissionType || !firstName || !lastName || !contactEmail) return false;
    
    if (submissionType === 'bug' || submissionType === 'feature') {
      return feedbackDescription.trim().length > 0;
    }
    
    if (submissionType === 'validation') {
      return validationTest && validationAttestation;
    }
    
    if (!submitterType || !category) return false;
    
    if (submissionType === 'new') {
      return newTestName && newTestVendor && newTestUrl;
    } else if (submissionType === 'correction') {
      return existingTest && selectedParameter && newValue && citation;
    }
    
    return false;
  };
  
  // Get vendor domain from email for filtering tests
  const getVendorDomainFromEmail = (email) => {
    if (!email || !email.includes('@')) return '';
    const domain = email.split('@')[1]?.toLowerCase() || '';
    // Extract company name from domain (e.g., guardanthealth.com -> guardant)
    return domain.split('.')[0];
  };
  
  // Get tests that match the vendor's email domain
  const getVendorTests = () => {
    const domain = getVendorDomainFromEmail(contactEmail);
    if (!domain) return [];
    
    const allTests = [...mrdTestData, ...ecdTestData, ...trmTestData, ...tdsTestData];
    return allTests.filter(test => {
      const vendorLower = test.vendor.toLowerCase().replace(/[^a-z0-9]/g, '');
      return vendorLower.includes(domain) || domain.includes(vendorLower.slice(0, 5));
    }).map(t => ({
      id: t.id,
      name: t.name,
      vendor: t.vendor,
      category: mrdTestData.find(m => m.id === t.id) ? 'MRD' :
                ecdTestData.find(e => e.id === t.id) ? 'ECD' :
                trmTestData.find(r => r.id === t.id) ? 'TRM' : 'TDS'
    }));
  };
  
  // Get the selected validation test data
  const getValidationTestData = () => {
    if (!validationTest) return null;
    const allTests = [...mrdTestData, ...ecdTestData, ...trmTestData, ...tdsTestData];
    return allTests.find(t => t.id === validationTest);
  };
  
  // Get category for validation test
  const getValidationTestCategory = () => {
    if (!validationTest) return null;
    if (mrdTestData.find(t => t.id === validationTest)) return 'MRD';
    if (ecdTestData.find(t => t.id === validationTest)) return 'ECD';
    if (trmTestData.find(t => t.id === validationTest)) return 'TRM';
    if (tdsTestData.find(t => t.id === validationTest)) return 'TDS';
    return null;
  };
  
  // Add a validation edit
  const addValidationEdit = () => {
    if (!validationField || !validationValue || !validationCitation) return;
    setValidationEdits([...validationEdits, {
      field: validationField,
      value: validationValue,
      citation: validationCitation
    }]);
    setValidationField('');
    setValidationValue('');
    setValidationCitation('');
  };
  
  // Remove a validation edit
  const removeValidationEdit = (index) => {
    setValidationEdits(validationEdits.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Submissions</h1>
      <p className="text-gray-600 mb-8">Help us improve {siteConfig.name} with your feedback and data contributions.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Test Data Update - hide when prefilled OR when validation selected */}
        {!isPrefilled && submissionType !== 'validation' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Test Data Update</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setSubmissionType('new'); setExistingTest(''); setSelectedParameter(''); setFeedbackDescription(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'new' ? 'border-[#2A63A4] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-800">Suggest a New Test</div>
              <div className="text-sm text-gray-500">Notify us of a test not in our database</div>
            </button>
            <button
              type="button"
              onClick={() => { setSubmissionType('correction'); setNewTestName(''); setNewTestVendor(''); setNewTestUrl(''); setFeedbackDescription(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'correction' ? 'border-[#2A63A4] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-800">File a Correction</div>
              <div className="text-sm text-gray-500">Update existing test data</div>
            </button>
          </div>
          
          <label className="block text-sm font-semibold text-gray-700 mt-6 mb-3">Bug Reports & Feature Requests</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setSubmissionType('bug'); setSubmitterType(''); setCategory(''); setNewTestName(''); setNewTestVendor(''); setExistingTest(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'bug' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`font-semibold ${submissionType === 'bug' ? 'text-red-700' : 'text-gray-800'}`}>Report a Bug</div>
              <div className="text-sm text-gray-500">Something isn't working correctly</div>
            </button>
            <button
              type="button"
              onClick={() => { setSubmissionType('feature'); setSubmitterType(''); setCategory(''); setNewTestName(''); setNewTestVendor(''); setExistingTest(''); setCompleteFieldEntries([]); setValidationTest(''); setValidationEdits([]); setValidationAttestation(false); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'feature' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`font-semibold ${submissionType === 'feature' ? 'text-purple-700' : 'text-gray-800'}`}>Request a Feature</div>
              <div className="text-sm text-gray-500">Suggest an improvement or new capability</div>
            </button>
          </div>
          </div>
        )}

        {/* Vendor Test Validation - Below other options */}
        {!isPrefilled && (
          <div className={`rounded-xl border-2 p-6 transition-all ${submissionType === 'validation' ? 'border-emerald-500 bg-gradient-to-r from-emerald-50 to-teal-50' : 'border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 hover:border-emerald-300'}`}>
            <button
              type="button"
              onClick={() => { 
                setSubmissionType('validation'); 
                setSubmitterType('vendor');
                setCategory('');
                setExistingTest(''); 
                setSelectedParameter(''); 
                setFeedbackDescription(''); 
                setCompleteFieldEntries([]);
                setNewTestName('');
                setNewTestVendor('');
                setValidationTest('');
                setValidationEdits([]);
                setValidationAttestation(false);
              }}
              className="w-full text-left"
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${submissionType === 'validation' ? 'bg-emerald-500' : 'bg-emerald-400'}`}>
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${submissionType === 'validation' ? 'text-emerald-800' : 'text-emerald-700'}`}>
                      Vendor Test Validation
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white border border-emerald-600">
                      VENDOR VERIFIED
                    </span>
                  </div>
                  <div className="text-sm text-emerald-600">Verify and update your company's test data to earn the VENDOR VERIFIED badge</div>
                </div>
                <svg className={`w-6 h-6 transition-transform ${submissionType === 'validation' ? 'text-emerald-600 rotate-90' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* Submitter Type - show for all data submissions including prefilled */}
        {(submissionType === 'new' || submissionType === 'correction') && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">I am submitting as a...</label>
            <select
              value={submitterType}
              onChange={(e) => { setSubmitterType(e.target.value); setEmailError(''); setVerificationStep('form'); }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
            >
              <option value="">-- Select --</option>
              <option value="vendor">Test Vendor Representative</option>
              <option value="expert">Independent Expert / Researcher</option>
            </select>
            {submitterType === 'vendor' && (
              <p className="text-sm text-amber-600 mt-2">⚠️ We will verify that your email comes from the vendor's domain</p>
            )}
            {submitterType === 'expert' && (
              <>
                <p className="text-sm text-amber-600 mt-2">⚠️ Vendor employees should select "Test Vendor Representative" above</p>
                <p className="text-sm text-gray-500 mt-1">Expert submissions require a company or institutional email</p>
              </>
            )}
          </div>
        )}

        {/* Category Selection - only for new/correction, not validation */}
        {submitterType && submissionType !== 'validation' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Test Category</label>
            <div className={`grid gap-3 ${isAlz ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {(isAlz ? [
                { key: 'ALZ-BLOOD', label: 'ALZ-BLOOD', desc: 'Blood Biomarkers', color: 'indigo' },
              ] : [
                { key: 'MRD', label: 'MRD', desc: 'Minimal Residual Disease', color: 'orange' },
                { key: 'ECD', label: 'ECD', desc: 'Early Cancer Detection', color: 'emerald' },
                { key: 'TRM', label: 'TRM', desc: 'Treatment Response', color: 'sky' },
                { key: 'TDS', label: 'TDS', desc: 'Treatment Decisions', color: 'violet' },
              ]).map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { setCategory(cat.key); setExistingTest(''); setSelectedParameter(''); setCompleteFieldEntries([]); }}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${category === cat.key ? `border-${cat.color}-500 bg-${cat.color}-50` : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className={`font-bold ${category === cat.key ? `text-${cat.color}-700` : 'text-gray-800'}`}>{cat.label}</div>
                  <div className="text-xs text-gray-500">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NEW TEST: Basic Info + URL */}
        {submissionType === 'new' && category && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">New Test Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Test Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  placeholder="e.g., Signatera, Galleri, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Vendor/Company <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newTestVendor}
                  onChange={(e) => { setNewTestVendor(e.target.value); setEmailError(''); setVerificationStep('form'); }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  placeholder="e.g., Natera, GRAIL, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">URL with Test Performance Data <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={newTestUrl}
                  onChange={(e) => setNewTestUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  placeholder="https://..."
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Link to publication, vendor page, or FDA approval with performance data</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Additional Notes</label>
                <textarea
                  value={newTestNotes}
                  onChange={(e) => setNewTestNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  rows={3}
                  placeholder="Any additional context about this test..."
                />
              </div>
            </div>
          </div>
        )}

        {/* CORRECTION: Select Test → Select Parameter → New Value */}
        {submissionType === 'correction' && category && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Correction Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Select Test <span className="text-red-500">*</span></label>
                <select
                  value={existingTest}
                  onChange={(e) => { setExistingTest(e.target.value); setSelectedParameter(''); setNewValue(''); setEmailError(''); setVerificationStep('form'); }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                >
                  <option value="">-- Select a test --</option>
                  {existingTests[category]?.map(test => (
                    <option key={test.id} value={test.id}>{test.name} ({test.vendor})</option>
                  ))}
                </select>
              </div>

              {existingTest && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Parameter to Correct <span className="text-red-500">*</span></label>
                  <select
                    value={selectedParameter}
                    onChange={(e) => { setSelectedParameter(e.target.value); setNewValue(''); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                    required
                  >
                    <option value="">-- Select parameter --</option>
                    {parameterOptions[category]?.map(param => (
                      <option key={param.key} value={param.key}>{param.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedParameter && (
                <>
                  {selectedParameter !== 'other' && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-sm text-gray-500">Current value: </span>
                      <span className="text-sm font-medium text-gray-800">{getCurrentValue()}</span>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {selectedParameter === 'other' ? 'Describe the correction' : 'New Value'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                      placeholder={selectedParameter === 'other' ? 'Describe the parameter and new value...' : 'Enter the correct value'}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Citation/Source URL <span className="text-red-500">*</span></label>
                    <input
                      type="url"
                      value={citation}
                      onChange={(e) => setCitation(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                      placeholder="https://..."
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">Link to publication or source supporting this value</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* VENDOR TEST VALIDATION FORM */}
        {submissionType === 'validation' && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">Vendor Test Validation</h3>
                <p className="text-sm text-emerald-600">Verify your company's test data and earn the VENDOR VERIFIED badge</p>
              </div>
            </div>

            {/* Special banner for invited vendors */}
            {isInvitedVendor && (
              <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-4 flex items-center gap-3 mb-4">
                <svg className="w-8 h-8 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
                <div>
                  <p className="font-semibold text-emerald-800">Welcome! You've been personally invited to validate your test data.</p>
                  <p className="text-sm text-emerald-700">Your email has been pre-verified. Just complete your name and select your test below.</p>
                </div>
              </div>
            )}

            {/* Step 1: Verify Email */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-full text-white text-sm font-bold flex items-center justify-center ${isInvitedVendor ? 'bg-emerald-400' : 'bg-emerald-500'}`}>
                  {isInvitedVendor ? '✓' : '1'}
                </span>
                <span className="font-semibold text-emerald-800">
                  {isInvitedVendor ? 'Your Information' : 'Verify Your Vendor Email'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Show locked email for invited vendors */}
              {isInvitedVendor && verificationStep === 'verified' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                  <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-emerald-800 font-medium">Email Pre-Verified</p>
                    <p className="text-emerald-700 text-sm">{contactEmail}</p>
                  </div>
                  <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded font-medium">INVITED</span>
                </div>
              )}

              {verificationStep === 'form' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Work Email <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => { setContactEmail(e.target.value); setEmailError(''); setValidationTest(''); }}
                        className={`flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="you@yourcompany.com"
                      />
                      <button
                        type="button"
                        onClick={sendVerificationCode}
                        disabled={isSendingCode || !contactEmail || !firstName || !lastName}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {isSendingCode ? 'Sending...' : 'Verify Email'}
                      </button>
                    </div>
                    {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                    {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
                    <p className="text-sm text-emerald-600 mt-2">⚠️ You must use your company email to verify your affiliation with the vendor</p>
                  </div>
                </>
              )}

              {verificationStep === 'verify' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800">
                      A verification code has been sent to <strong>{contactEmail}</strong>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center text-2xl tracking-widest"
                      placeholder="• • • • • •"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={verifyCode}
                      disabled={isVerifying || verificationCode.length !== 6}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                  {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
                  <button
                    type="button"
                    onClick={() => { setVerificationStep('form'); setVerificationCode(''); setVerificationError(''); }}
                    className="text-emerald-600 text-sm hover:underline"
                  >
                    ← Use a different email
                  </button>
                </>
              )}

              {verificationStep === 'verified' && !isInvitedVendor && (
                <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-4 flex items-center gap-3">
                  <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-emerald-800 font-medium">Email Verified!</p>
                    <p className="text-emerald-700 text-sm">{contactEmail}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select Test (only after email verified) */}
            {verificationStep === 'verified' && (
              <div className="mt-8 pt-6 border-t border-emerald-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">{isInvitedVendor ? '1' : '2'}</span>
                  <span className="font-semibold text-emerald-800">Select Your Test</span>
                </div>
                
                {getVendorTests().length > 0 ? (
                  <select
                    value={validationTest}
                    onChange={(e) => { setValidationTest(e.target.value); setValidationEdits([]); setValidationAttestation(false); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select one of your company's tests --</option>
                    {getVendorTests().map(test => (
                      <option key={test.id} value={test.id}>{test.name} ({test.category})</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                    <p className="font-medium">No tests found for your company</p>
                    <p className="text-sm mt-1">We couldn't find tests matching your email domain. Please use "Suggest a New Test" or contact us if you believe this is an error.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review & Edit Data (only after test selected) */}
            {validationTest && (
              <div className="mt-8 pt-6 border-t border-emerald-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">{isInvitedVendor ? '2' : '3'}</span>
                  <span className="font-semibold text-emerald-800">Review & Update Data (Optional)</span>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Review the current data below. You can add corrections or updates - each change requires a citation.
                </p>

                {/* Current Data Display */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 max-h-64 overflow-y-auto">
                  <h4 className="font-medium text-gray-800 mb-2">{getValidationTestData()?.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {getValidationTestCategory() && parameterOptions[getValidationTestCategory()]?.slice(0, -1).map(param => {
                      const testData = getValidationTestData();
                      const value = testData?.[param.key];
                      return (
                        <div key={param.key} className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-500">{param.label}:</span>
                          <span className="font-medium text-gray-800">{value || '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add Edit Form */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add a correction or update:</label>
                  <div className="grid grid-cols-1 gap-3">
                    <select
                      value={validationField}
                      onChange={(e) => setValidationField(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select field to update --</option>
                      {getValidationTestCategory() && parameterOptions[getValidationTestCategory()]?.map(param => (
                        <option key={param.key} value={param.key}>{param.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={validationValue}
                      onChange={(e) => setValidationValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="New value"
                    />
                    <input
                      type="url"
                      value={validationCitation}
                      onChange={(e) => setValidationCitation(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Citation URL (required)"
                    />
                    <button
                      type="button"
                      onClick={addValidationEdit}
                      disabled={!validationField || !validationValue || !validationCitation}
                      className="w-full bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      + Add Update
                    </button>
                  </div>
                </div>

                {/* Pending Edits */}
                {validationEdits.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pending updates ({validationEdits.length}):</label>
                    <div className="space-y-2">
                      {validationEdits.map((edit, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white rounded-lg border border-emerald-200 p-3">
                          <div className="flex-1">
                            <span className="font-medium text-gray-800">{parameterOptions[getValidationTestCategory()]?.find(p => p.key === edit.field)?.label || edit.field}</span>
                            <span className="text-gray-500 mx-2">→</span>
                            <span className="text-emerald-700">{edit.value}</span>
                            <p className="text-xs text-gray-400 truncate">{edit.citation}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeValidationEdit(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4: Attestation */}
                <div className="mt-8 pt-6 border-t border-emerald-200">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">{isInvitedVendor ? '3' : '4'}</span>
                    <span className="font-semibold text-emerald-800">Vendor Attestation</span>
                  </div>
                  
                  <label className="flex items-start gap-3 p-4 bg-white rounded-lg border-2 border-emerald-300 cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={validationAttestation}
                      onChange={(e) => setValidationAttestation(e.target.checked)}
                      className="mt-1 w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-gray-800">
                        I confirm that I am an authorized representative of {getValidationTestData()?.vendor || 'this vendor'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        I attest that the information displayed above {validationEdits.length > 0 ? '(with my proposed updates)' : ''} is accurate and complete to the best of my knowledge as of today's date.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Bug Report / Feature Request Form */}
        {(submissionType === 'bug' || submissionType === 'feature') && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className={`text-lg font-semibold mb-4 ${submissionType === 'bug' ? 'text-red-700' : 'text-purple-700'}`}>
              {submissionType === 'bug' ? 'Bug Report' : 'Feature Request'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {submissionType === 'bug' ? 'Describe the bug' : 'Describe your feature idea'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={feedbackDescription}
                onChange={(e) => setFeedbackDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                rows={6}
                placeholder={submissionType === 'bug' 
                  ? 'Please describe what happened, what you expected to happen, and steps to reproduce the issue...'
                  : 'Please describe the feature you would like to see and how it would help you...'}
                required
              />
            </div>
          </div>
        )}

        {/* Your Information - Bug/Feature */}
        {(submissionType === 'bug' || submissionType === 'feature') && feedbackDescription && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Information</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
            </div>

            {/* Email Verification for Bug/Feature */}
            {verificationStep === 'form' && (
              <>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); setEmailError(''); }}
                    className={`flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="you@company.com"
                  />
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={isSendingCode || !contactEmail || !firstName || !lastName}
                    className="bg-[#2A63A4] text-white px-4 py-2 rounded-lg hover:bg-[#1E4A7A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isSendingCode ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
                {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
                <p className="text-sm text-gray-500 mt-2">Company or institutional email required (not Gmail, Yahoo, etc.)</p>
              </>
            )}

            {verificationStep === 'verify' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800">
                    A verification code has been sent to <strong>{contactEmail}</strong>
                  </p>
                </div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Enter 6-digit code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] text-center text-2xl tracking-widest"
                    placeholder="• • • • • •"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {verificationError && <p className="text-red-500 text-sm mt-2">{verificationError}</p>}
                <button
                  type="button"
                  onClick={() => { setVerificationStep('form'); setVerificationCode(''); setVerificationError(''); setVerificationToken(''); }}
                  className="text-[#2A63A4] text-sm mt-2 hover:underline"
                >
                  ← Use a different email
                </button>
                <p className="text-gray-500 text-xs mt-3">
                  Code not arriving? Corporate firewalls sometimes block verification emails.{' '}
                  <a 
                    href="https://www.linkedin.com/in/alexgdickinson/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#2A63A4] hover:underline"
                  >
                    DM Alex on LinkedIn
                  </a>
                  {' '}to submit directly.
                </p>
              </>
            )}

            {verificationStep === 'verified' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-emerald-800 font-medium">Email Verified!</p>
                  <p className="text-emerald-700 text-sm">{contactEmail}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Your Information - Test Data */}
        {category && (
          submissionType === 'new' ? newTestName && newTestVendor : 
          submissionType === 'correction' ? existingTest && selectedParameter :
          false
        ) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Information</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4]"
                  required
                />
              </div>
            </div>

            {/* Email Verification */}
            {verificationStep === 'form' && (
              <>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); setEmailError(''); }}
                    className={`flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder={submitterType === 'vendor' ? `you@${(submissionType === 'new' ? newTestVendor : getSelectedTestVendor()).toLowerCase().replace(/[^a-z]/g, '')}...` : 'you@company.com'}
                  />
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={isSendingCode || !contactEmail || !firstName || !lastName}
                    className="bg-[#2A63A4] text-white px-4 py-2 rounded-lg hover:bg-[#1E4A7A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isSendingCode ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
                {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                {verificationError && <p className="text-red-500 text-sm mt-1">{verificationError}</p>}
              </>
            )}

            {verificationStep === 'verify' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800">
                    A verification code has been sent to <strong>{contactEmail}</strong>
                  </p>
                </div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Enter 6-digit code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A63A4] text-center text-2xl tracking-widest"
                    placeholder="• • • • • •"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {verificationError && <p className="text-red-500 text-sm mt-2">{verificationError}</p>}
                <button
                  type="button"
                  onClick={() => { setVerificationStep('form'); setVerificationCode(''); setVerificationError(''); setVerificationToken(''); }}
                  className="text-[#2A63A4] text-sm mt-2 hover:underline"
                >
                  ← Use a different email
                </button>
                <p className="text-gray-500 text-xs mt-3">
                  Code not arriving? Corporate firewalls sometimes block verification emails.{' '}
                  <a 
                    href="https://www.linkedin.com/in/alexgdickinson/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#2A63A4] hover:underline"
                  >
                    DM Alex on LinkedIn
                  </a>
                  {' '}to submit directly.
                </p>
              </>
            )}

            {verificationStep === 'verified' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-emerald-800 font-medium">Email Verified!</p>
                  <p className="text-emerald-700 text-sm">{contactEmail}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        {isReadyForVerification() && (
          <>
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {submitError}
              </div>
            )}
            {submissionType === 'validation' ? (
              /* Special Big Submit Button for Vendor Validation */
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-white text-lg font-medium">
                    {validationEdits.length > 0 
                      ? `Submitting validation with ${validationEdits.length} update${validationEdits.length > 1 ? 's' : ''}`
                      : 'Confirming current data is accurate'}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={verificationStep !== 'verified' || isSubmitting || !validationAttestation}
                  className="w-full bg-white text-emerald-700 px-8 py-5 rounded-xl font-bold transition-all text-xl shadow-md hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Validation...
                    </>
                  ) : !validationAttestation ? (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Check the attestation box above
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submit Vendor Validation
                    </>
                  )}
                </button>
                <p className="text-center text-emerald-100 text-sm mt-3">
                  This test will receive the VENDOR VERIFIED badge after review
                </p>
              </div>
            ) : (
              /* Standard Submit Button */
              <button
                type="submit"
                disabled={verificationStep !== 'verified' || isSubmitting}
                className="w-full text-white px-8 py-4 rounded-xl font-semibold transition-all text-lg shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #2A63A4, #1E4A7A)' }}
              >
                {isSubmitting ? 'Submitting...' : verificationStep !== 'verified' ? 'Verify Email to Submit Request' : 'Submit Request'}
              </button>
            )}
          </>
        )}
      </form>

      {/* Database Changelog Section */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Database Changelog</h2>
        <p className="text-gray-600 mb-6">Recent updates to the {siteConfig.name} test database, including community contributions.</p>
        
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {domainChangelog.map((entry, idx) => (
              <div 
                key={`${entry.testId}-${idx}`} 
                className={`p-4 flex items-start gap-4 ${idx !== domainChangelog.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                {/* Entry number */}
                <div className="flex-shrink-0 w-8 text-right">
                  <span className="text-sm font-mono text-gray-400">#{domainChangelog.length - idx}</span>
                </div>
                
                {/* Type indicator */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  entry.type === 'added' ? 'bg-emerald-100 text-emerald-700' :
                  entry.type === 'updated' ? 'bg-blue-100 text-blue-700' :
                  entry.type === 'feature' ? 'bg-purple-100 text-purple-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {entry.type === 'added' ? '+' : entry.type === 'updated' ? '↑' : entry.type === 'feature' ? '★' : '−'}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{entry.testName}</span>
                    {entry.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      entry.category === 'MRD' ? 'bg-orange-100 text-orange-700' :
                      entry.category === 'ECD' ? 'bg-emerald-100 text-emerald-700' :
                      entry.category === 'TRM' ? 'bg-sky-100 text-sky-700' :
                      entry.category === 'ALZ-BLOOD' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-violet-100 text-violet-700'
                    }`}>
                      {entry.category}
                    </span>}
                    {entry.vendor && <span className="text-xs text-gray-400">{entry.vendor}</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{entry.date}</span>
                    <span>• {
                      !entry.affiliation || entry.affiliation === 'OpenOnco' || entry.affiliation === 'OpenAlz'
                        ? siteConfig.name :
                      !entry.vendor
                        ? (entry.contributor ? `${entry.contributor} (${entry.affiliation})` : entry.affiliation) :
                      entry.vendor.toLowerCase().includes(entry.affiliation.toLowerCase()) || 
                      entry.affiliation.toLowerCase().includes(entry.vendor.split(' ')[0].toLowerCase())
                        ? `Vendor update: ${entry.contributor ? entry.contributor + ' (' + entry.affiliation + ')' : entry.affiliation}`
                        : entry.contributor ? `${entry.contributor} (${entry.affiliation})` : entry.affiliation
                    }</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SourceDataPage = () => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate metrics for all categories
  const metrics = useMemo(() => ({
    MRD: calculateCategoryMetrics(mrdTestData, 'MRD'),
    ECD: calculateCategoryMetrics(ecdTestData, 'ECD'),
    TRM: calculateCategoryMetrics(trmTestData, 'TRM'),
    TDS: calculateCategoryMetrics(tdsTestData, 'TDS'),
  }), []);

  // Calculate aggregate metrics
  const aggregate = useMemo(() => {
    const allTests = [...mrdTestData, ...ecdTestData, ...trmTestData, ...tdsTestData];
    const allVendors = new Set(allTests.map(t => t.vendor));
    
    // Count tests with vendor contributions
    const testsWithVendorContribution = allTests.filter(t => COMPANY_CONTRIBUTIONS[t.id] !== undefined).length;
    
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
  }, [metrics]);

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
      changelog: DATABASE_CHANGELOG,
      categories: {
        MRD: { name: 'Molecular Residual Disease', testCount: mrdTestData.length, tests: mrdTestData, metrics: metrics.MRD },
        ECD: { name: 'Early Cancer Detection', testCount: ecdTestData.length, tests: ecdTestData, metrics: metrics.ECD },
        TRM: { name: 'Treatment Response Monitoring', testCount: trmTestData.length, tests: trmTestData, metrics: metrics.TRM },
        TDS: { name: 'Treatment Decision Support', testCount: tdsTestData.length, tests: tdsTestData, metrics: metrics.TDS },
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
            {['MRD', 'ECD', 'TRM', 'TDS'].map(category => {
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
                <span className="text-gray-400 hover:text-gray-600 cursor-help text-sm">ⓘ</span>
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
              {['MRD', 'ECD', 'TRM', 'TDS'].map(category => {
                const m = metrics[category];
                const colors = CATEGORY_COLORS[category];
                if (!m) return null;
                
                return (
                  <div key={category} className="text-center">
                    <div className="relative inline-flex items-center justify-center mb-3">
                      <CircularProgress value={m.minFieldCompletionRate} size={100} strokeWidth={10} color={category === 'MRD' ? 'orange' : category === 'ECD' ? 'emerald' : category === 'TRM' ? 'sky' : 'violet'} />
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
          {['MRD', 'ECD', 'TRM', 'TDS'].map(category => {
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
                  <p className="text-sm text-gray-500">{aggregate.totalTests} tests • MRD + ECD + TRM + TDS • JSON format with quality metrics</p>
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

// ============================================
// Chat Component
// ============================================
const CategoryChat = ({ category }) => {
  const meta = categoryMeta[category];
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I can help you understand ${meta.title} tests. Ask me about specific tests, comparisons, or clinical applications.` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [persona, setPersona] = useState(() => getStoredPersona() || 'Clinician');
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const chatContainerRef = useRef(null);

  useEffect(() => { 
    if (chatContainerRef.current && messages.length > 0) {
      const container = chatContainerRef.current;
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const messageElements = container.querySelectorAll('[data-message-role="assistant"]');
        const lastAssistantEl = messageElements[messageElements.length - 1];
        if (lastAssistantEl) {
          // Use offsetTop to scroll within container only (not page)
          container.scrollTop = lastAssistantEl.offsetTop - 8;
        }
      }
    }
  }, [messages]);
  
  // Listen for persona changes
  useEffect(() => {
    const handlePersonaChange = (e) => {
      setPersona(e.detail);
      setMessages([{ role: 'assistant', content: `Hi! I can help you understand ${meta.title} tests. Ask me about specific tests, comparisons, or clinical applications.` }]);
    };
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, [meta.title]);

  // Memoize system prompt - recomputed if category or persona changes
  const systemPrompt = useMemo(() => {
    return `You are a liquid biopsy test information assistant for OpenOnco, focused on ${meta.title} testing. Your ONLY role is to help users explore and compare the specific tests in the database below.

STRICT SCOPE LIMITATIONS:
- ONLY discuss ${category} tests that exist in the database below
- NEVER speculate about disease genetics, heredity, inheritance patterns, or etiology - these are complex medical topics outside your scope
- NEVER suggest screening strategies or make recommendations about who should be tested
- NEVER interpret what positive or negative test results mean clinically
- NEVER make claims about diseases, conditions, or cancer types beyond what is explicitly stated in the test data
- If a user describes a patient/situation, check the "targetPopulation" field - if they don't clearly fit, say "This test is designed for [target population]. Please discuss with a healthcare provider whether it's appropriate for this situation."
- For ANY question outside the specific test data (disease inheritance, screening recommendations, result interpretation, treatment decisions): respond with "That's outside my scope. Please discuss with your healthcare provider."

WHAT YOU CAN DO:
- Compare ${category} tests on their documented attributes (sensitivity, specificity, TAT, cost, coverage, etc.)
- Explain what data is available or not available for specific tests
- Help users understand the differences between test approaches
- Note when a test's target population may not match the user's described situation

${category} DATABASE:
${JSON.stringify(chatTestData[category])}

${chatKeyLegend}

${getPersonaStyle(persona)}

Say "not specified" for missing data. When uncertain, err on the side of saying "please consult your healthcare provider."`;
  }, [category, meta, persona]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    
    // Track chat submission with feature flags
    const personaFlag = `persona-${persona.toLowerCase().replace(/[^a-z]/g, '-')}`;
    track('chat_message_sent', { 
      category: category,
      model: selectedModel,
      message_length: userMessage.length
    }, { 
      flags: [personaFlag, `category-${category.toLowerCase()}`] 
    });
    
    setInput('');
    const newUserMessage = { role: 'user', content: userMessage };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Skip the initial greeting, limit to last 6 messages
      const conversationHistory = updatedMessages.slice(1).slice(-6);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category,
          persona: persona,
          testData: JSON.stringify(chatTestData[category]),
          messages: conversationHistory,
          model: selectedModel
        })
      });
      const data = await response.json();
      if (data && data.content && data.content[0] && data.content[0].text) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content[0].text }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "I received an unexpected response. Please try again." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Please try again." }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div ref={chatContainerRef} className="h-56 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} data-message-role={msg.role} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-emerald-500 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <Markdown className="text-sm">{msg.content}</Markdown>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2 items-center">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            title="Select AI model"
          >
            {CHAT_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Ask about ${meta.shortTitle}...`} className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={handleSubmit} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg text-sm font-medium">Send</button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">Powered by Claude AI. Responses may be inaccurate and should be independently verified.</p>
      </div>
    </div>
  );
};

// ============================================
// Info Icon Component (shows citations/notes on click)
// ============================================
// Helper function to format LOD as "ppm (% VAF)"
const formatLOD = (lod) => {
  // LOD values are now stored as strings in their original reported format
  // No conversion needed - just return as-is
  if (lod == null) return null;
  return String(lod);
};

// ============================================
// Parameter Definitions & Changelog
// ============================================
const PARAMETER_DEFINITIONS = {
  // Performance Metrics
  "Reported Sensitivity": "The proportion of true positive cases correctly identified by the test. May be analytical (lab conditions) or clinical (real-world), and may be landmark (single timepoint) or longitudinal (across multiple draws).",
  "Overall Sensitivity": "The proportion of true positive cases correctly identified by the test across all stages combined.",
  "Reported Specificity": "The proportion of true negative cases correctly identified by the test. High specificity means fewer false positives.",
  "Analytical Specificity": "Specificity measured under controlled laboratory conditions, typically higher than clinical specificity.",
  "Clinical Specificity": "Specificity measured in real-world clinical settings with actual patient samples.",
  "PPV": "Positive Predictive Value. The probability that a positive test result indicates true disease presence. Depends heavily on disease prevalence.",
  "NPV": "Negative Predictive Value. The probability that a negative test result indicates true absence of disease.",
  "LOD": "Limit of Detection. The lowest concentration of target analyte that can be reliably detected. Reported in various units (ppm, VAF%, MTM/mL).",
  "LOD (Detection Threshold)": "Limit of Detection. The lowest concentration of target analyte that can be reliably detected. Reported in various units (ppm, VAF%, MTM/mL).",
  "LOD95": "The concentration at which the test achieves 95% detection probability. More conservative than LOD and often more clinically relevant.",
  "LOD95 (95% Confidence)": "The concentration at which the test achieves 95% detection probability. More conservative than LOD and often more clinically relevant.",
  
  // Stage-specific
  "Stage I Sensitivity": "Detection rate for Stage I cancers, typically the most challenging due to lower tumor burden.",
  "Stage II Sensitivity": "Detection rate for Stage II cancers. Critical for adjuvant therapy decisions in MRD testing.",
  "Stage III Sensitivity": "Detection rate for Stage III cancers. Generally higher than earlier stages due to greater tumor burden.",
  "Stage IV Sensitivity": "Detection rate for Stage IV/metastatic cancers. Usually highest due to significant tumor burden.",
  "Stage-specific Sensitivity": "Sensitivity broken down by cancer stage. Earlier stages typically have lower detection rates.",
  
  // Landmark & Longitudinal
  "Landmark Sensitivity": "Detection rate at a single post-treatment timepoint (e.g., 4 weeks post-surgery).",
  "Landmark Specificity": "Specificity measured at a single post-treatment timepoint.",
  "Longitudinal Sensitivity": "Detection rate across multiple serial blood draws over time. Typically higher than landmark.",
  "Longitudinal Specificity": "Specificity measured across multiple serial timepoints.",
  
  // Turnaround & Sample
  "Sample Type": "The biological sample category required for testing (e.g., Blood, Tissue).",
  "Sample Category": "The biological sample category required for testing (e.g., Blood, Tissue).",
  "Initial TAT": "Turnaround time for the first test, which may include assay design for tumor-informed tests.",
  "Follow-up TAT": "Turnaround time for subsequent monitoring tests, typically faster than initial.",
  "TAT": "Turnaround Time. Days from sample receipt to result delivery.",
  "Lead Time vs Imaging": "How many days/months earlier the test can detect recurrence compared to standard imaging (CT/PET).",
  "Blood Volume": "Amount of blood required for the test, typically in milliliters (mL).",
  "cfDNA Input": "Amount of cell-free DNA required for analysis, in nanograms (ng).",
  "Variants Tracked": "Number of genetic variants monitored by the test. More variants may improve sensitivity but isn't always better.",
  "Sample Volume": "Volume of sample required for the test.",
  "Sample Stability": "How long the sample remains viable after collection.",
  "Sample Details": "Additional specifications about sample requirements.",
  
  // Requirements & Method
  "Approach": "Whether the test is tumor-informed (requires prior tissue) or tumor-naïve (blood only).",
  "Requires Tumor Tissue": "Whether a tumor sample is needed to design a personalized assay.",
  "Requires Matched Normal": "Whether a normal tissue sample is needed to filter germline variants.",
  "Method": "The laboratory technique used (e.g., PCR, NGS, methylation analysis).",
  "Target Population": "The intended patient population for the test.",
  "Indication Group": "The clinical indication category (e.g., screening, monitoring).",
  "Response Definition": "How the test defines treatment response.",
  "Screening Interval": "Recommended time between screening tests.",
  
  // Regulatory & Coverage
  "FDA Status": "Current FDA regulatory status (Approved, Breakthrough Designation, LDT, etc.).",
  "Medicare": "Medicare coverage and reimbursement status.",
  "Private Insurance": "Commercial insurance payers known to cover the test.",
  "CPT Codes": "Current Procedural Terminology codes used for billing.",
  "CPT Code": "Current Procedural Terminology code used for billing.",
  "Clinical Availability": "Current commercial availability status.",
  "Available Regions": "Geographic regions where the test is available.",
  "Independent Validation": "Whether the test has been validated by independent third parties.",
  "List Price": "Published list price before insurance, if available.",
  
  // Clinical Evidence
  "Total Trial Participants": "Total number of patients enrolled across key clinical trials.",
  "Peer-Reviewed Publications": "Number of peer-reviewed scientific publications about the test.",
  "Key Trials": "Major clinical trials evaluating the test.",
  
  // ECD-specific
  "Tumor Origin Prediction": "Accuracy of predicting the tissue of origin for detected cancers (multi-cancer tests).",
  "Lead Time Notes": "Additional context about detection lead time compared to standard methods."
};

const PARAMETER_CHANGELOG = {
  // Track value changes here as they occur
  // Format: "Parameter Name": [{ date: "YYYY-MM-DD", change: "Description of value change" }]
};

// ============================================
// Parameter Label Component (clickable with popup)
// ============================================
const ParameterLabel = ({ label, citations, notes, expertTopic, useGroupHover = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);
  
  const definition = PARAMETER_DEFINITIONS[label];
  const changelog = PARAMETER_CHANGELOG[label] || [];
  const expertInsight = expertTopic ? EXPERT_INSIGHTS[expertTopic] : null;
  
  // Only show as clickable if there's any content to display
  const hasContent = definition || notes || citations || changelog.length > 0 || expertInsight;
  
  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 380;
      const popupHeight = 400;
      
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 20) {
        left = Math.max(20, window.innerWidth - popupWidth - 20);
      }
      if (left < 20) left = 20;
      
      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = Math.max(20, rect.top - popupHeight - 8);
      }
      
      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);
  
  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  // Close on scroll outside popup
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);
  
  if (!hasContent) {
    return <span className="text-sm text-gray-600">{label}</span>;
  }
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`text-sm text-gray-600 underline-offset-2 cursor-pointer text-left leading-normal decoration-dotted ${
          useGroupHover 
            ? 'group-hover:text-[#2A63A4] group-hover:underline' 
            : 'hover:text-[#2A63A4] hover:underline'
        }`}
      >
        {label}
      </button>
      {isOpen && ReactDOM.createPortal(
        <div 
          ref={popupRef}
          className="fixed z-[9999] w-96 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center justify-between">
            <h4 className="font-semibold text-white text-sm">{label}</h4>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Scrollable content */}
          <div className="max-h-80 overflow-y-auto">
            {/* Definition */}
            {definition && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Definition</p>
                <p className="text-sm text-slate-700">{definition}</p>
              </div>
            )}
            
            {/* Expert Insight */}
            {expertInsight && (
              <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center">E</div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Expert Insight</p>
                </div>
                <p className="text-xs text-slate-600 whitespace-pre-line">{expertInsight.content}</p>
                <p className="text-[10px] text-slate-400 mt-2">Expert{expertInsight.experts?.includes(',') ? 's' : ''}: {expertInsight.experts || 'Advisory Panel'}</p>
              </div>
            )}
            
            {/* Notes (instance-specific) */}
            {notes && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes for This Test</p>
                <p className="text-sm text-slate-700">{notes}</p>
              </div>
            )}
            
            {/* Sources (instance-specific) */}
            {citations && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sources</p>
                <div className="space-y-1">
                  {citations.split('|').map((c, i) => {
                    const url = c.trim();
                    const isUrl = url.startsWith('http');
                    return (
                      <a 
                        key={i} 
                        href={isUrl ? url : '#'} 
                        target={isUrl ? "_blank" : undefined}
                        rel={isUrl ? "noopener noreferrer" : undefined}
                        className={`block text-xs ${isUrl ? 'text-[#2A63A4] hover:underline' : 'text-slate-600'}`}
                      >
                        → {url.length > 70 ? url.slice(0, 70) + '...' : url}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Changelog */}
            {changelog.length > 0 && (
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Change Log</p>
                <div className="space-y-2">
                  {changelog.map((entry, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-slate-400 font-mono">{entry.date}</span>
                      <p className="text-slate-600">{entry.change}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* No changelog message */}
            {changelog.length === 0 && (
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Change Log</p>
                <p className="text-xs text-slate-400 italic">No changes recorded for this parameter.</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// Legacy InfoIcon - kept for backward compatibility but no longer used in DataRow
const InfoIcon = ({ citations, notes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);
  
  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 288; // w-72 = 18rem = 288px
      const popupHeight = 200; // approximate
      
      // Calculate left position
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 20) {
        left = rect.right - popupWidth;
      }
      if (left < 20) left = 20;
      
      // Calculate top position
      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = rect.top - popupHeight - 8;
      }
      
      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);
  
  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  // Close on scroll outside popup
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      // Don't close if scrolling inside the popup
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);
  
  if (!citations && !notes) return null;
  
  return (
    <span className="inline-block ml-1">
      <button 
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 hover:text-gray-700 text-xs font-medium inline-flex items-center justify-center transition-colors cursor-pointer"
      >
        i
      </button>
      {isOpen && ReactDOM.createPortal(
        <div 
          ref={popupRef}
          className="fixed z-[9999] w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left" 
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {notes && (
            <div className={citations ? "mb-2" : ""}>
              <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
              <p className="text-xs text-gray-600">{notes}</p>
            </div>
          )}
          {citations && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Sources:</p>
              <p className="text-xs text-[#2A63A4] break-all">{citations.split('|').map((c, i) => (
                <a key={i} href={c.trim().startsWith('http') ? c.trim() : '#'} target="_blank" rel="noopener noreferrer" className="block hover:underline mb-1">
                  {c.trim().length > 60 ? c.trim().slice(0, 60) + '...' : c.trim()}
                </a>
              ))}</p>
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// Citation Tooltip - Shows source icon after parameter values
// ============================================
const CitationTooltip = ({ citations }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);
  
  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 320;
      const popupHeight = 150;
      
      let left = rect.left - popupWidth / 2 + rect.width / 2;
      if (left + popupWidth > window.innerWidth - 20) {
        left = window.innerWidth - popupWidth - 20;
      }
      if (left < 20) left = 20;
      
      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = rect.top - popupHeight - 8;
      }
      
      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);
  
  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  // Close on scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);
  
  if (!citations) return null;
  
  return (
    <span className="inline-flex items-center ml-1">
      <button 
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-4 h-4 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 text-[10px] font-medium inline-flex items-center justify-center transition-colors cursor-pointer"
        title="View source"
      >
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>
      {isOpen && ReactDOM.createPortal(
        <div 
          ref={popupRef}
          className="fixed z-[9999] w-80 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden" 
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-100 px-3 py-2 flex items-center justify-between border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Source</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-3 max-h-40 overflow-y-auto">
            <div className="space-y-1.5">
              {citations.split('|').map((c, i) => {
                const url = c.trim();
                const isUrl = url.startsWith('http');
                return (
                  <a 
                    key={i} 
                    href={isUrl ? url : '#'} 
                    target={isUrl ? "_blank" : undefined}
                    rel={isUrl ? "noopener noreferrer" : undefined}
                    className={`block text-xs ${isUrl ? 'text-[#2A63A4] hover:underline' : 'text-slate-600'} break-words`}
                  >
                    {isUrl ? (
                      <span className="flex items-start gap-1">
                        <svg className="w-3 h-3 flex-shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>{url.length > 60 ? url.slice(0, 60) + '...' : url}</span>
                      </span>
                    ) : (
                      <span className="flex items-start gap-1">
                        <svg className="w-3 h-3 flex-shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{url}</span>
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// Expert Insight Component - Shows expert context on metrics
// Attribution: Expert Advisors MR and SW
// ============================================
const EXPERT_INSIGHTS = {
  sensitivity: {
    title: "Understanding Sensitivity Claims",
    experts: "MR",
    content: `"Sensitivity" alone can be ambiguous. Here are helpful distinctions:

Clinical sensitivity refers to the percentage of patients who recurred that were correctly identified as MRD-positive. This is often what clinicians assume, but not always what's reported.

Analytical sensitivity refers to detection rate in lab validation conditions, which may differ from real-world clinical performance.

Landmark vs Longitudinal: Landmark measures detection at a single post-surgery timepoint. Longitudinal measures detection at any timepoint across multiple draws, which typically yields higher numbers.

Helpful questions to ask: What type of sensitivity? At what timeframe? For which stages? What was the sample size?`
  },
  stageSpecific: {
    title: "Why Stage-Specific Sensitivity Matters",
    experts: "MR",
    content: `When sensitivity is reported for combined stages (II, III, IV together), it can be helpful to understand the breakdown.

Stage II presents the greatest detection challenge due to lower tumor burden and less circulating tumor DNA. Yet Stage II is often where MRD-guided therapy decisions have the most impact.

Stage III/IV cases typically have more ctDNA and higher detection rates, which can lift overall sensitivity figures when stages are combined.

For a Stage II patient considering adjuvant therapy, stage-specific sensitivity data—when available—may be more directly relevant than blended numbers.

What to look for: Tests that report stage-specific data separately provide more granular information for decision-making.

Stage-specific reporting helps clinicians and patients make more informed comparisons, and we encourage vendors to provide this breakdown where feasible.`
  },
  stageMissing: {
    title: "Why Stage-Specific Data Matters",
    experts: "MR",
    content: `Stage-specific sensitivity data helps clinicians and patients make more informed decisions.

Why it's important: Stage II patients considering adjuvant therapy benefit from understanding how the test performs specifically for their situation, as detection rates typically vary by stage.

What you can do: Consider asking the vendor about stage-specific performance data—they may have additional information available.

We encourage vendors to provide stage-specific breakdowns where feasible, as this openness helps the entire field.`
  },
  specificity: {
    title: "Understanding Specificity Claims",
    experts: "MR, SW",
    content: `For MRD testing, specificity may be particularly important—especially in low-recurrence populations where most patients are already cured.

Analytical vs Clinical Specificity:
Analytical specificity measures how often the test correctly identifies negative samples as negative in the lab. This is important for repeat monitoring scenarios.

Clinical specificity measures how often MRD-negative results correspond with no eventual recurrence. Interpretation can be complex in studies where MRD-positive patients receive treatment.

Reporting considerations:
Per-timepoint vs per-patient reporting can yield different numbers. With serial testing, it's worth understanding how false positive probability may compound.

Analytical specificity becomes especially relevant with repeat testing, where even small false positive rates can accumulate over serial draws.`
  },
  analyticalVsClinicalSpecificity: {
    title: "Analytical vs Clinical Specificity",
    experts: "MR, SW",
    content: `These metrics answer different questions and are worth understanding separately:

Analytical Specificity
What it measures: How often does the test correctly identify truly negative samples as negative in laboratory conditions?
Why it matters: Important for repeat monitoring—even 99% specificity means approximately 5% cumulative false positive probability over 5 annual tests.
How it's measured: Typically using contrived samples or healthy donor plasma.

Clinical Specificity
What it measures: How often does an MRD-negative result correspond with no eventual recurrence?
Interpretation note: In interventional trials where MRD-positive patients receive treatment, the "true" recurrence rate without treatment isn't directly observable.
Context: This metric is sometimes better understood as negative predictive value (NPV) in context.

Why both matter:
Analytical specificity reflects the test's inherent performance characteristics.
Clinical specificity is influenced by both test performance and treatment effects.

When vendors report "specificity" without specifying type, it's reasonable to ask which measurement is being referenced.`
  },
  lod: {
    title: "Understanding LOD Comparisons",
    experts: "MR, SW",
    content: `LOD (Limit of Detection) values can be difficult to compare directly across different MRD test architectures. We display values exactly as reported by each vendor without conversion.

LOD vs LOD95 — an important distinction:
LOD (detection threshold): The level where signal can be detected, though not necessarily reliably.
LOD95: The level where detection occurs 95% of the time.

Why this matters for monitoring:
When LOD is significantly lower than LOD95, the test may detect lower levels occasionally. Serial testing provides additional opportunities for detection.
When LOD and LOD95 are similar, detection below the threshold is unlikely even with repeat testing.

Other comparison considerations:
Different units (ppm, VAF%, molecules/mL) don't convert directly.
Pre-analytical factors like extraction efficiency can affect results.

The gap between LOD and LOD95 can be particularly relevant for surveillance protocols where serial testing is planned.`
  },
  lodVsLod95: {
    title: "LOD vs LOD95: Why Both Matter",
    experts: "MR, SW",
    content: `Understanding both LOD and LOD95 provides helpful context for test performance:

The key distinction:
LOD (detection threshold): Signal can be detected, but not reliably at this level.
LOD95: Detection occurs 95% of the time at this level.

Why the gap between them matters:
If a test has LOD of 0.5 ppm but LOD95 of 5 ppm, this can actually be favorable for monitoring—there's a chance of detecting variants below 5 ppm with repeat testing, and serial samples provide multiple detection opportunities.

If LOD ≈ LOD95 (very close together), detection below LOD95 is unlikely even with multiple samples.

Practical implication:
Tests where LOD is notably lower than LOD95 may offer additional surveillance potential through serial testing. This gap is one factor worth considering when evaluating tests for monitoring protocols.`
  },
  bloodVolume: {
    title: "Blood Volume Context",
    experts: "MR",
    content: `Higher blood volume and more variants tracked don't automatically indicate better performance.

Error suppression and assay design can matter significantly—a smaller panel with excellent noise control may perform comparably to or better than a larger panel.

Different test architectures work in different ways, so direct comparisons based on volume or variant count alone may not reflect overall test quality.

Blood volume is primarily relevant for practical considerations (ease of blood draw) rather than as a direct quality indicator.`
  },
  cfdnaInput: {
    title: "cfDNA Input vs Blood Volume",
    experts: "SW",
    content: `For research applications, cfDNA input (measured in ng) can be as relevant as blood volume (mL).

Why this distinction matters:
Different extraction methods yield different cfDNA amounts from the same blood volume.
The amount of cfDNA that enters the assay affects the analytical sensitivity ceiling.
Genome equivalents analyzed (approximately 3.3 pg per haploid genome) represents the true denominator.

What to consider:
Blood volume (mL): How much blood is drawn
cfDNA yield: How much cfDNA is extracted
Input to assay (ng): How much cfDNA enters the test

A test using more blood but less cfDNA input may have different performance characteristics than one using less blood with more cfDNA input. Input amounts aren't always disclosed but can significantly impact sensitivity.`
  },
  tumorInformed: {
    title: "Tumor-Informed vs Tumor-Naïve",
    experts: "MR",
    content: `Both approaches have legitimate clinical applications:

Tumor-informed testing requires tumor tissue to identify patient-specific mutations, then tracks those in blood. Generally offers higher sensitivity but requires tissue availability.

Tumor-naïve (tumor-agnostic) testing works without tumor tissue, using common cancer signals such as mutations or methylation patterns. More convenient when tissue isn't available but may miss patient-specific variants.

Neither approach is universally superior—the best choice depends on clinical context, tissue availability, cancer type, and intended use.`
  },
  clinicalTrials: {
    title: "Interpreting Clinical Trial Data",
    experts: "MR",
    content: `Clinical sensitivity from interventional trials requires careful interpretation.

Treatment effects on outcomes: In trials where MRD-positive patients receive additional therapy, some may be cured by that treatment. This makes it difficult to determine how many would have recurred without intervention.

Stage composition: When results combine multiple stages (II, III, IV), it's helpful to understand the breakdown when available, as detection rates typically vary by stage.

These factors don't diminish the value of clinical trial data—they simply provide context for interpretation.`
  },
  mrdUseCases: {
    title: "MRD vs Treatment Response vs Surveillance",
    experts: "MR",
    content: `MRD tests can support three distinct clinical decisions:

Landmark MRD: A single post-surgery timepoint to help decide on adjuvant therapy. This is often the most clinically actionable use case.

Treatment Response Monitoring: Serial tests during therapy to assess whether treatment is working, based on ctDNA kinetics.

Surveillance: Periodic testing off-therapy to detect recurrence earlier than imaging.

Many assays span more than one use-case, but trial design, endpoints, and performance claims often target just one. Sensitivity figures from a surveillance study may not apply to landmark detection, and vice versa.

When comparing tests, consider which use-case the reported performance data reflects.`
  }
};

const ExpertInsight = ({ topic }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);
  const insight = EXPERT_INSIGHTS[topic];
  
  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 320;
      const popupHeight = 300; // approximate max height
      
      // Calculate left position - prefer left-aligned, but flip if too close to right edge
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 20) {
        left = rect.right - popupWidth;
      }
      // Ensure not off left edge
      if (left < 20) left = 20;
      
      // Calculate top position - prefer below, but flip if too close to bottom
      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = rect.top - popupHeight - 8;
      }
      
      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);
  
  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  // Close on scroll outside popup
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      // Don't close if scrolling inside the popup
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);
  
  if (!insight) return null;
  
  // Format expert names
  const formatExperts = (experts) => {
    if (!experts) return "Expert Advisors";
    const names = experts.split(', ').map(e => {
      if (e === 'MR') return 'MR';
      if (e === 'SW') return 'SW';
      return e;
    });
    return `Expert${names.length > 1 ? 's' : ''}: ${names.join(', ')}`;
  };
  
  return (
    <span className="inline-flex items-center ml-1 align-middle">
      <button 
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[10px] font-bold inline-flex items-center justify-center hover:bg-amber-200 hover:border-amber-400 transition-colors cursor-pointer"
        title="Expert insight available - click to view"
      >
        E
      </button>
      {isOpen && ReactDOM.createPortal(
        <div 
          ref={popupRef}
          className="fixed z-[9999] w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center">E</div>
                <h4 className="font-semibold text-slate-800 text-sm">{insight.title}</h4>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-4 py-3 text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
            {insight.content}
          </div>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-500">
              <span className="font-medium text-slate-600">{formatExperts(insight.experts)}</span>
            </p>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// Data Row Component for expanded view
// ============================================
const DataRow = ({ label, value, unit, citations, notes, expertTopic }) => {
  if (value === null || value === undefined) return null;
  const displayValue = `${value}${unit || ''}`;
  const isLongValue = typeof displayValue === 'string' && displayValue.length > 60;
  
  if (isLongValue) {
    // Stack layout for long values
    return (
      <div className="py-2 border-b border-gray-100 last:border-0 group cursor-pointer">
        <div className="mb-1 flex items-center gap-1">
          <ParameterLabel label={label} citations={citations} notes={notes} expertTopic={expertTopic} useGroupHover={true} />
          {expertTopic && <ExpertInsight topic={expertTopic} />}
        </div>
        <span className="text-sm font-medium text-gray-900 inline-flex items-center">
          {displayValue}
          <CitationTooltip citations={citations} />
        </span>
      </div>
    );
  }
  
  // Side-by-side layout for short values
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 gap-4 group cursor-pointer">
      <span className="flex-shrink-0 flex items-center gap-1">
        <ParameterLabel label={label} citations={citations} notes={notes} expertTopic={expertTopic} useGroupHover={true} />
        {expertTopic && <ExpertInsight topic={expertTopic} />}
      </span>
      <span className="text-sm font-medium text-gray-900 text-right inline-flex items-center">
        {displayValue}
        <CitationTooltip citations={citations} />
      </span>
    </div>
  );
};

// ============================================
// Test Card
// ============================================
const TestCard = ({ test, isSelected, onSelect, category, onShowDetail }) => {
  const colorVariant = categoryMeta[category]?.color || 'amber';
  const isDiscontinued = test.isDiscontinued === true;
  const hasCompanyComm = COMPANY_CONTRIBUTIONS[test.id] !== undefined;
  const hasVendorVerified = VENDOR_VERIFIED[test.id] !== undefined;
  
  // Calculate BC status - automatic when 100% minimum fields complete
  const completeness = calculateTestCompleteness(test, category);
  const isBC = completeness.percentage === 100;
  
  return (
    <div className="relative">
      <div id={`test-card-${test.id}`} data-testid="test-card" className={`relative h-full flex flex-col bg-white rounded-xl border-2 p-4 transition-all overflow-hidden ${isSelected ? 'border-emerald-500 shadow-md shadow-emerald-100' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* DISCONTINUED text overlay */}
      {isDiscontinued && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-gray-400/30 font-bold text-4xl tracking-wider transform -rotate-12">
            DISCONTINUED
          </span>
        </div>
      )}
      {/* INCOMPLETE text overlay for non-BC tests */}
      {!isBC && !isDiscontinued && !hasCompanyComm && !hasVendorVerified && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-red-400/30 font-bold text-4xl tracking-wider transform -rotate-12">
            INCOMPLETE
          </span>
        </div>
      )}
      {/* Header - clickable to show detail modal */}
      <div className="cursor-pointer flex-1" data-testid="test-card-clickable" onClick={() => onShowDetail && onShowDetail(test)}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isDiscontinued && <Badge variant="slate">DISCONTINUED</Badge>}
              {/* VENDOR VERIFIED badge - green, pulsing */}
              {!isDiscontinued && hasVendorVerified && (
                <div className="relative group inline-flex">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white animate-pulse shadow-sm">
                    ✓ VENDOR VERIFIED
                  </span>
                  <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Verified</p>
                    <p className="font-medium">{VENDOR_VERIFIED[test.id].name}</p>
                    <p className="text-gray-300">{VENDOR_VERIFIED[test.id].company}</p>
                    <p className="text-gray-400 text-[9px]">{VENDOR_VERIFIED[test.id].verifiedDate}</p>
                  </div>
                </div>
              )}
              {/* INPUT badge - light green (only if not verified) */}
              {!isDiscontinued && hasCompanyComm && !hasVendorVerified && (
                <div className="relative group inline-flex">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                    ✓ VENDOR INPUT
                  </span>
                  <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Input</p>
                    <p className="font-medium">{COMPANY_CONTRIBUTIONS[test.id].name}</p>
                    <p className="text-gray-300">{COMPANY_CONTRIBUTIONS[test.id].company}</p>
                    <p className="text-gray-400 text-[9px]">{COMPANY_CONTRIBUTIONS[test.id].date}</p>
                  </div>
                </div>
              )}
              {/* Product Type Badge - IVD Kit vs Service */}
              {!isDiscontinued && test.productType && <ProductTypeBadge productType={test.productType} size="xs" />}
              {!isDiscontinued && test.reimbursement?.toLowerCase().includes('medicare') && test.commercialPayers && test.commercialPayers.length > 0 
                ? <Badge variant="success">Medicare+Private</Badge>
                : !isDiscontinued && test.reimbursement?.toLowerCase().includes('medicare') 
                  ? <Badge variant="success">Medicare</Badge>
                  : !isDiscontinued && test.commercialPayers && test.commercialPayers.length > 0 
                    ? <Badge variant="blue">Private</Badge>
                    : null}
              {test.adltStatus && <Badge variant="amber" title="CMS Advanced Diagnostic Laboratory Test - annual rate updates based on private payer data">ADLT</Badge>}
              {test.codeType === 'PLA' && <Badge variant="slate" title="Proprietary Laboratory Analyses code - specific to this laboratory's test">PLA</Badge>}
              {category === 'ECD' && (test.listPrice ? (
                <Badge variant="amber">${test.listPrice}</Badge>
              ) : test.medicareRate && (
                <Badge variant="amber" title="Medicare rate - actual list price may vary">~${test.medicareRate}</Badge>
              ))}
              {test.totalParticipants && <Badge variant="blue">{test.totalParticipants.toLocaleString()} trial participants</Badge>}
              {test.numPublications && <Badge variant="purple">{test.numPublications}{test.numPublicationsPlus ? '+' : ''} pubs</Badge>}
              {test.approach && <Badge variant={colorVariant}>{test.approach}</Badge>}
              {test.testScope && <Badge variant={colorVariant}>{test.testScope}</Badge>}
            </div>
            <h3 className={`font-semibold ${isDiscontinued ? 'text-gray-400' : 'text-gray-900'}`}>{test.name}</h3>
            <p className="text-sm text-gray-500">{test.vendor}<VendorBadge vendor={test.vendor} size="sm" /></p>
            {/* Platform Required - for IVD Kits */}
            {test.platformRequired && (
              <p className="text-xs text-indigo-600 mt-0.5">
                <span className="font-medium">Platform:</span> {test.platformRequired}
              </p>
            )}
          </div>
          {/* Prominent comparison checkbox - click selects for comparison, hidden on mobile */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(test.id); }}
            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all flex-shrink-0 ${
              isSelected 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : 'bg-white border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
            }`}
            title={isSelected ? 'Remove from comparison' : 'Add to comparison'}
            data-testid="compare-button"
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              isSelected ? 'bg-white border-white' : 'border-current'
            }`}>
              {isSelected && <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-xs font-medium hidden sm:inline">{isSelected ? 'Selected' : 'Compare'}</span>
          </button>
        </div>
        
        {/* Key metrics grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {category !== 'TDS' && test.sensitivity != null && (
            <div>
              <p className={`text-lg font-bold ${(test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : 'text-emerald-600'}`}>
                {test.sensitivity}%
                {test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                  <span className="inline-block ml-0.5" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'})` : 'Analytical validation only'}>
                    <svg className="w-3 h-3 inline text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">Reported Sens.</p>
            </div>
          )}
          {category !== 'TDS' && test.specificity != null && (
            <div>
              <p className={`text-lg font-bold ${(test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : 'text-emerald-600'}`}>
                {test.specificity}%
                {test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                  <span className="inline-block ml-0.5" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'})` : 'Analytical validation only'}>
                    <svg className="w-3 h-3 inline text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">Specificity</p>
            </div>
          )}
          {/* LOD display - show both LOD and LOD95 when available */}
          {category !== 'TDS' && (test.lod != null || test.lod95 != null) && (
            <div>
              {test.lod != null && test.lod95 != null ? (
                // Both values available - show stacked with monitoring indicator
                <>
                  <p className="text-sm font-bold text-violet-600">{test.lod}</p>
                  <p className="text-xs text-violet-400">{test.lod95}</p>
                  <p className="text-xs text-gray-500">LOD / LOD95</p>
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-violet-500 font-medium mt-0.5" title="Both LOD and LOD95 are reported; see expert notes on how to interpret the gap.">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    LOD+95
                  </span>
                </>
              ) : test.lod != null ? (
                // Only LOD
                <>
                  <p className="text-lg font-bold text-violet-600">{test.lod}</p>
                  <p className="text-xs text-gray-500">LOD</p>
                </>
              ) : (
                // Only LOD95
                <>
                  <p className="text-lg font-bold text-violet-600">{test.lod95}</p>
                  <p className="text-xs text-gray-500">LOD95</p>
                </>
              )}
            </div>
          )}
          {category === 'MRD' && test.followUpTat && <div><p className="text-lg font-bold text-slate-600">{test.followUpTat}d</p><p className="text-xs text-gray-500">TAT</p></div>}
          {category === 'TRM' && test.leadTimeVsImaging && <div><p className="text-lg font-bold text-emerald-600">{test.leadTimeVsImaging}d</p><p className="text-xs text-gray-500">Lead Time</p></div>}
          {category === 'ECD' && test.stageISensitivity && <div><p className="text-lg font-bold text-emerald-600">{test.stageISensitivity}%</p><p className="text-xs text-gray-500">Stage I</p></div>}
          {category === 'ECD' && test.ppv != null && <div><p className="text-lg font-bold text-emerald-600">{test.ppv}%</p><p className="text-xs text-gray-500">PPV</p></div>}
          {category === 'TDS' && test.genesAnalyzed && <div><p className="text-lg font-bold text-violet-600">{test.genesAnalyzed}</p><p className="text-xs text-gray-500">Genes</p></div>}
          {category === 'TDS' && test.fdaCompanionDxCount && <div><p className="text-lg font-bold text-emerald-600">{test.fdaCompanionDxCount}</p><p className="text-xs text-gray-500">CDx</p></div>}
          {category === 'TDS' && test.tat && <div><p className="text-lg font-bold text-slate-600">{test.tat}</p><p className="text-xs text-gray-500">TAT</p></div>}
        </div>
        
        {/* Cancer types */}
        <div className="flex flex-wrap gap-1 mb-2">
          {test.cancerTypes && test.cancerTypes.slice(0, 3).map((type, i) => <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{type.length > 20 ? type.slice(0, 20) + '...' : type}</span>)}
          {test.cancerTypes && test.cancerTypes.length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{test.cancerTypes.length - 3}</span>}
        </div>
        
        {/* Clinical settings - MRD only */}
        {category === 'MRD' && test.clinicalSettings && test.clinicalSettings.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {test.clinicalSettings.slice(0, 4).map((setting, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded text-[10px] font-medium">
                {setting === 'Post-Surgery' ? 'Post-Surg' : 
                 setting === 'Surveillance' ? 'Surveil' :
                 setting === 'Neoadjuvant' ? 'Neoadj' :
                 setting === 'Post-Adjuvant' ? 'Post-Adj' : setting}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Show detail button - pushed to bottom */}
      <div className="border-t border-gray-100 pt-2 mt-auto">
        <button 
          onClick={() => onShowDetail && onShowDetail(test)}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
        >
          Show detail
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
    </div>
  );
};


// ============================================
// Minimum Parameters by Category
// ============================================
const MINIMUM_PARAMS = {
  MRD: {
    core: [
      { key: 'sensitivity', label: 'Sensitivity' },
      { key: 'specificity', label: 'Specificity' },
      { key: 'lod', label: 'Limit of Detection' },
      { key: 'numPublications', label: 'Publications' },
      { key: 'totalParticipants', label: 'Study Participants' },
      { key: 'initialTat', label: 'Initial TAT' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Medicare Coverage' },
    ]
  },
  ECD: {
    core: [
      { key: 'sensitivity', label: 'Sensitivity' },
      { key: 'specificity', label: 'Specificity' },
      { key: 'ppv', label: 'PPV' },
      { key: 'npv', label: 'NPV' },
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'listPrice', label: 'List Price' },
    ]
  },
  TRM: {
    // NOTE: TRM tests monitor ctDNA trends over time rather than binary MRD detection
    // They don't report traditional sensitivity/specificity metrics
    core: [
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
    ]
  },
  TDS: {
    // NOTE: CGP tests don't report single sensitivity/specificity values - 
    // performance varies by alteration type (SNVs, indels, CNAs, fusions)
    core: [
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
    ]
  },
};

const FIELD_DEFINITIONS = {
  name: { label: 'Test Name', tooltip: 'The official commercial name of the test' },
  vendor: { label: 'Vendor', tooltip: 'The company that manufactures the test' },
  sensitivity: { label: 'Sensitivity', tooltip: 'Proportion of true positives correctly identified' },
  specificity: { label: 'Specificity', tooltip: 'Proportion of true negatives correctly identified' },
  lod: { label: 'Limit of Detection', tooltip: 'Lowest concentration reliably detected' },
  ppv: { label: 'PPV', tooltip: 'Positive Predictive Value' },
  npv: { label: 'NPV', tooltip: 'Negative Predictive Value' },
  numPublications: { label: 'Publications', tooltip: 'Number of peer-reviewed publications' },
  totalParticipants: { label: 'Study Participants', tooltip: 'Total patients across validation studies' },
  tat: { label: 'Turnaround Time', tooltip: 'Time from sample to result' },
  initialTat: { label: 'Initial TAT', tooltip: 'Days for first result' },
  followUpTat: { label: 'Follow-up TAT', tooltip: 'Days for subsequent results' },
  fdaStatus: { label: 'FDA Status', tooltip: 'Regulatory approval status' },
  reimbursement: { label: 'Medicare Coverage', tooltip: 'Medicare reimbursement status' },
  listPrice: { label: 'List Price', tooltip: 'Published price without insurance' },
  clinicalAvailability: { label: 'Clinical Availability', tooltip: 'Current availability status' },
};

// ============================================
// Minimum Fields Section - Shows completion status for BC (Baseline Complete)
// ============================================
const MinimumFieldsSection = ({ test, category }) => {
  const minParams = MINIMUM_PARAMS[category];
  if (!minParams?.core) return null;
  
  const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';
  
  const fields = minParams.core.map(p => ({
    key: p.key,
    label: p.label,
    value: test[p.key],
    filled: hasValue(test[p.key])
  }));
  
  const filledCount = fields.filter(f => f.filled).length;
  const totalCount = fields.length;
  const isBC = filledCount === totalCount;
  
  const formatDisplayValue = (val) => {
    if (val == null || val === '') return '—';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'number') return val.toLocaleString();
    return String(val);
  };
  
  return (
    <div className={`mt-4 p-4 rounded-xl border-2 ${isBC ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">Minimum Fields</h3>
          {isBC ? (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">{filledCount}/{totalCount} Complete</span>
          ) : (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
              INCOMPLETE ({filledCount}/{totalCount})
            </span>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
          <div 
            className={`h-full rounded-full transition-all ${isBC ? 'bg-emerald-500' : 'bg-red-400'}`}
            style={{ width: `${(filledCount / totalCount) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {fields.map(field => (
          <div 
            key={field.key} 
            className={`p-2 rounded-lg border ${field.filled ? 'bg-white border-gray-200' : 'bg-red-100/50 border-red-300 border-dashed'}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {field.filled ? (
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`text-xs font-medium ${field.filled ? 'text-gray-700' : 'text-red-700'}`}>{field.label}</span>
            </div>
            <p className={`text-sm truncate ${field.filled ? 'text-gray-900' : 'text-red-600 italic'}`}>
              {field.filled ? formatDisplayValue(field.value) : 'Missing'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Test Detail Modal
// ============================================
const TestDetailModal = ({ test, category, onClose }) => {
  const [linkCopied, setLinkCopied] = useState(false);
  
  if (!test) return null;
  
  const meta = categoryMeta[category];
  
  // Calculate BC status
  const completeness = calculateTestCompleteness(test, category);
  const isBC = completeness.percentage === 100;
  
  // Copy shareable link to clipboard (SEO-friendly URL)
  const copyLink = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${getTestUrl(test, category)}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };
  
  // Print styles for test detail - fixed for multi-page printing
  const printStyles = `
    @media print {
      /* Hide everything except the print area */
      body * {
        visibility: hidden;
      }
      .test-detail-print-area,
      .test-detail-print-area * {
        visibility: visible;
      }
      
      /* Reset modal positioning for print */
      .test-detail-modal-root {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .test-detail-print-area { 
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
      }
      
      /* Allow content to flow across pages */
      .test-detail-print-area,
      .test-detail-print-area > div {
        max-height: none !important;
        overflow: visible !important;
        height: auto !important;
      }
      
      /* Hide interactive elements */
      .print\\:hidden { display: none !important; }
      
      @page { margin: 0.5in; }
    }
  `;
  
  // Category-specific color schemes
  const colorSchemes = {
    MRD: { 
      headerBg: 'bg-gradient-to-r from-orange-500 to-amber-500', 
      sectionBg: 'bg-orange-50',
      sectionBorder: 'border-orange-200',
      sectionTitle: 'text-orange-800'
    },
    ECD: { 
      headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500', 
      sectionBg: 'bg-emerald-50',
      sectionBorder: 'border-emerald-200',
      sectionTitle: 'text-emerald-800'
    },
    TRM: { 
      headerBg: 'bg-gradient-to-r from-rose-500 to-pink-500', 
      sectionBg: 'bg-rose-50',
      sectionBorder: 'border-rose-200',
      sectionTitle: 'text-rose-800'
    },
    TDS: { 
      headerBg: 'bg-gradient-to-r from-violet-500 to-purple-500', 
      sectionBg: 'bg-violet-50',
      sectionBorder: 'border-violet-200',
      sectionTitle: 'text-violet-800'
    }
  };
  const colors = colorSchemes[category] || colorSchemes.MRD;
  
  // Helper for coverage status
  const hasMedicare = test.reimbursement?.toLowerCase().includes('medicare') && 
    !test.reimbursement?.toLowerCase().includes('not yet') &&
    !test.reimbursement?.toLowerCase().includes('no established');
  const hasPrivate = test.commercialPayers && test.commercialPayers.length > 0;
  const requiresTissue = test.approach === 'Tumor-informed' || test.requiresTumorTissue === 'Yes' || test.sampleCategory === 'Tissue';
  const isDiscontinued = test.isDiscontinued === true;
  
  // Section component for consistent styling
  const Section = ({ title, children, expertTopic }) => (
    <div className={`rounded-xl border ${colors.sectionBorder} overflow-hidden`}>
      <div className={`${colors.sectionBg} px-4 py-2 border-b ${colors.sectionBorder} flex items-center gap-2`}>
        <h3 className={`font-semibold text-sm uppercase tracking-wide ${colors.sectionTitle} leading-none`}>{title}</h3>
        {expertTopic && <ExpertInsight topic={expertTopic} />}
      </div>
      <div className="bg-white p-4">
        {children}
      </div>
    </div>
  );
  
  // Patient-friendly yes/no indicator
  const YesNo = ({ yes, label }) => (
    <div className="flex items-center gap-2 py-1">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
        yes ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
      }`}>
        {yes ? '✓' : '✗'}
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );

  return (
    <>
      <style>{printStyles}</style>
      <div className="test-detail-modal-root fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white" data-testid="test-detail-modal" onClick={onClose}>
        <div className="test-detail-print-area bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          {/* Discontinued Banner */}
          {isDiscontinued && (
            <div className="bg-red-600 text-white px-5 py-3 flex items-center gap-3" style={{ flexShrink: 0 }}>
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold">THIS TEST HAS BEEN DISCONTINUED</p>
                <p className="text-sm text-red-100">{test.discontinuedReason || 'This product is no longer commercially available.'}</p>
              </div>
            </div>
          )}
          {/* Header */}
          <div className={`flex justify-between items-start p-5 ${colors.headerBg}`} style={{ flexShrink: 0 }}>
            <div className="flex-1 mr-4">
              <div className="flex flex-wrap gap-2 mb-2">
                {/* VENDOR VERIFIED badge - green, pulsing */}
                {VENDOR_VERIFIED[test.id] && (
                  <div className="relative group flex items-center">
                    <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-xs font-bold cursor-help animate-pulse shadow-sm">
                      ✓ VERIFIED
                    </span>
                    <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <p className="text-emerald-400 font-bold text-[11px] mb-1">Vendor Verified</p>
                      <p className="font-medium">{VENDOR_VERIFIED[test.id].name}</p>
                      <p className="text-gray-300">{VENDOR_VERIFIED[test.id].company}</p>
                      <p className="text-gray-400 text-[9px]">{VENDOR_VERIFIED[test.id].verifiedDate}</p>
                    </div>
                  </div>
                )}
                {/* VENDOR DATA badge - orange (only if not verified) */}
                {COMPANY_CONTRIBUTIONS[test.id] && !VENDOR_VERIFIED[test.id] && (
                  <div className="relative group flex items-center">
                    <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-medium cursor-help">
                      VENDOR
                    </span>
                    <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <p className="text-orange-400 font-bold text-[11px] mb-1">Vendor Data</p>
                      <p className="font-medium">{COMPANY_CONTRIBUTIONS[test.id].name}</p>
                      <p className="text-gray-300">{COMPANY_CONTRIBUTIONS[test.id].company}</p>
                      <p className="text-gray-400 text-[9px]">{COMPANY_CONTRIBUTIONS[test.id].date}</p>
                    </div>
                  </div>
                )}
                {hasMedicare && hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Medicare+Private</span>}
                {hasMedicare && !hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Medicare</span>}
                {!hasMedicare && hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Private Insurance</span>}
                {test.fdaStatus && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">{test.fdaStatus.split(' - ')[0]}</span>}
                {test.approach && (
                  <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">
                    {test.approach === 'Tumor-informed' ? (
                      <GlossaryTooltip termKey="tumor-informed">{test.approach}</GlossaryTooltip>
                    ) : test.approach === 'Tumor-naïve' || test.approach === 'Tumor-naive' ? (
                      <GlossaryTooltip termKey="tumor-naive">{test.approach}</GlossaryTooltip>
                    ) : test.approach}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white">{test.name}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-white/80">{test.vendor} • OpenOnco.org</p>
                {!isBC && (
                  <span className="px-3 py-1 bg-red-500/80 text-white text-sm font-bold rounded">
                    INCOMPLETE
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={copyLink} 
                className="p-2 hover:bg-white/20 rounded-xl transition-colors print:hidden relative"
                title="Copy link to this test"
                data-testid="share-link-button"
              >
                {linkCopied ? (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); window.print(); }} 
                className="p-2 hover:bg-white/20 rounded-xl transition-colors print:hidden"
                title="Print or save as PDF"
                data-testid="print-button"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors print:hidden">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 space-y-4" style={{ flex: 1 }}>
          
          {/* Patient View */}
          {false ? (
            <>
              {/* Quick Facts for Patients */}
              <Section title="Quick Facts">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <YesNo yes={hasMedicare} label="Medicare coverage (age 65+)" />
                    <YesNo yes={hasPrivate} label="Private insurance options" />
                    <YesNo yes={!requiresTissue} label="Blood draw only (no surgery needed)" />
                    {category === 'TDS' && test.fdaCompanionDxCount && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">✓</span>
                        <span className="text-sm text-gray-700">FDA-approved for {test.fdaCompanionDxCount} drug matches</span>
                      </div>
                    )}
                  </div>
                  <div>
                    {category !== 'TDS' && (test.initialTat || test.tat) && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {test.initialTat || test.tat}
                        </span>
                        <span className="text-sm text-gray-700">days for results</span>
                      </div>
                    )}
                    {category === 'TDS' && test.tat && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">⏱</span>
                        <span className="text-sm text-gray-700">Results in {test.tat}</span>
                      </div>
                    )}
                    {category === 'TDS' && test.genesAnalyzed && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">🧬</span>
                        <span className="text-sm text-gray-700">Tests {test.genesAnalyzed} genes</span>
                      </div>
                    )}
                    {test.cancerTypes && (
                      <p className="text-sm text-gray-600 py-1">
                        Tests for: {test.cancerTypes.slice(0, 3).join(', ')}{test.cancerTypes.length > 3 ? ` +${test.cancerTypes.length - 3} more` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
              
              {/* What This Test Does */}
              <Section title="What This Test Does">
                <p className="text-gray-700">
                  {category === 'MRD' && "This test looks for tiny amounts of cancer DNA in your blood after treatment. It can help your doctor know if treatment worked and watch for cancer coming back earlier than traditional scans."}
                  {category === 'ECD' && "This test screens your blood for signs of cancer before you have symptoms. Finding cancer early often means better treatment options and outcomes."}
                  {category === 'TRM' && "This test tracks whether your cancer treatment is working by measuring cancer DNA in your blood over time, potentially detecting changes before imaging can."}
                  {category === 'TDS' && "This test analyzes hundreds of genes in your tumor to find specific mutations that can be targeted with specialized treatments. It helps your doctor match you with the most effective therapies and clinical trials for your cancer."}
                </p>
              </Section>
              
              {/* How It Works */}
              <Section title="How It Works">
                <p className="text-gray-700">
                  {category === 'TDS' 
                    ? (test.sampleCategory === 'Tissue' 
                        ? "Your doctor will send a sample of your tumor (from surgery or biopsy) to the lab. The test analyzes hundreds of genes to find specific mutations that can be matched to targeted treatments."
                        : "A simple blood draw is used to capture tumor DNA circulating in your bloodstream. The test analyzes this DNA to identify mutations that can guide treatment decisions.")
                    : (requiresTissue 
                        ? "Your doctor will need a sample of your tumor (from surgery or biopsy) plus a blood draw. The test creates a personalized profile based on your specific cancer's DNA mutations."
                        : "Just a simple blood draw at your doctor's office or lab - no tumor sample needed. The test looks for general cancer signals in your blood.")}
                </p>
                {test.bloodVolume && <p className="text-sm text-gray-500 mt-2">Blood sample: {test.bloodVolume} mL (about {Math.round(test.bloodVolume / 5)} teaspoons)</p>}
                {category === 'TDS' && test.tat && <p className="text-sm text-gray-500 mt-2">Results typically available in: {test.tat}</p>}
              </Section>
              
              {/* Insurance & Cost */}
              <Section title="Insurance & Cost">
                <div className="space-y-2">
                  {test.reimbursement && <p className="text-sm"><span className="font-medium">Medicare:</span> {test.reimbursement}</p>}
                  {hasPrivate && (
                    <p className="text-sm"><span className="font-medium">Private insurers:</span> {test.commercialPayers.join(', ')}</p>
                  )}
                  {test.commercialPayersNotes && <p className="text-xs text-gray-500 mt-1">{test.commercialPayersNotes}</p>}
                  {(category === 'ECD' || category === 'TDS') && (test.listPrice ? (
                    <p className="text-sm mt-2"><span className="font-medium">List price (without insurance):</span> ${test.listPrice.toLocaleString()}</p>
                  ) : test.medicareRate && (
                    <p className="text-sm mt-2"><span className="font-medium">Estimated price:</span> ~${test.medicareRate.toLocaleString()} <span className="text-xs text-gray-500">(Medicare rate - actual price may vary)</span></p>
                  ))}
                </div>
              </Section>
              
              {/* Questions for Your Doctor */}
              <Section title="Questions to Ask Your Doctor">
                <ul className="space-y-1 text-gray-700">
                  <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Is this test right for my type and stage of cancer?</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Will my insurance cover this test?</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500">•</span> How will the results change my treatment plan?</li>
                  {category === 'MRD' && <li className="flex items-start gap-2"><span className="text-blue-500">•</span> How often should I be retested?</li>}
                  {category === 'ECD' && <li className="flex items-start gap-2"><span className="text-blue-500">•</span> What happens if the test finds something?</li>}
                  {category === 'TDS' && <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Are there targeted therapies or clinical trials that match my results?</li>}
                </ul>
              </Section>
            </>
          ) : (
            /* Clinician/Academic View */
            <>
              {/* TDS-specific content */}
              {category === 'TDS' && (
                <>
                  {/* Genomic Coverage */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title="Genomic Coverage">
                      <div className="space-y-1">
                        <DataRow label="Genes Analyzed" value={test.genesAnalyzed} citations={test.genesAnalyzedCitations} notes={test.genesAnalyzedNotes} />
                        {test.geneListUrl && (
                          <div className="py-1.5 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Gene List</span>
                            <a href={test.geneListUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline" style={{ color: '#2A63A4' }}>View Full List →</a>
                          </div>
                        )}
                        <DataRow label="Biomarkers" value={test.biomarkersReported?.join(', ')} citations={test.biomarkersReportedCitations} />
                        <DataRow label="Method" value={test.method} citations={test.methodCitations} />
                      </div>
                    </Section>
                    
                    <Section title="Sample & Turnaround">
                      <div className="space-y-1">
                        <DataRow label="Sample Type" value={test.sampleCategory} />
                        <DataRow label="Sample Requirements" value={test.sampleRequirements} citations={test.sampleRequirementsCitations} notes={test.sampleRequirementsNotes} />
                        <DataRow label="Turnaround Time" value={test.tat} citations={test.tatCitations} notes={test.tatNotes} />
                      </div>
                    </Section>
                  </div>

                  {/* FDA CDx & Guidelines */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title={<><GlossaryTooltip termKey="companion-dx">FDA Companion Diagnostics</GlossaryTooltip></>}>
                      <div className="space-y-1">
                        {test.fdaCompanionDxCount && (
                          <div className="py-1.5 flex justify-between items-center">
                            <span className="text-xs text-gray-500">FDA CDx Indications</span>
                            <span className="text-lg font-bold text-emerald-600">{test.fdaCompanionDxCount}</span>
                          </div>
                        )}
                        {test.fdaCompanionDxCountNotes && <p className="text-xs text-gray-500 mt-1">{test.fdaCompanionDxCountNotes}</p>}
                        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4">
                          <span className="text-xs text-gray-500"><GlossaryTooltip termKey="fda-approved">FDA Status</GlossaryTooltip></span>
                          <span className="text-sm font-medium text-gray-900">{test.fdaStatus || '—'}</span>
                        </div>
                        {test.fdaApprovalDate && <DataRow label="FDA Approval Date" value={test.fdaApprovalDate} citations={test.fdaApprovalDateCitations} />}
                      </div>
                    </Section>
                    
                    <Section title="Guidelines & Coverage">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <GlossaryTooltip termKey="nccn">NCCN</GlossaryTooltip> Recommended
                          </span>
                          <span className={`text-sm font-medium ${test.nccnRecommended ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {test.nccnRecommended ? 'Yes' : 'No'}
                          </span>
                        </div>
                        {test.nccnGuidelinesAligned && <DataRow label="NCCN Guidelines" value={test.nccnGuidelinesAligned.join(', ')} notes={test.nccnGuidelinesNotes} citations={test.nccnGuidelinesCitations} />}
                        <DataRow label="Medicare" value={test.reimbursement} notes={test.reimbursementNote} citations={test.reimbursementCitations} />
                        {test.medicareRate && (
                          <div className="py-1.5 flex justify-between items-center">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              Medicare CLFS Rate
                              {test.adltStatus && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium" title="Advanced Diagnostic Laboratory Test - receives annual rate updates based on weighted median of private payer rates">ADLT</span>}
                            </span>
                            <span className="text-sm font-semibold text-emerald-600">${test.medicareRate.toLocaleString()}</span>
                          </div>
                        )}
                        {test.listPrice ? (
                          <DataRow label="List Price" value={`$${test.listPrice.toLocaleString()}`} citations={test.listPriceCitations} />
                        ) : test.medicareRate && !test.listPrice && (
                          <DataRow label="List Price (est.)" value={`~$${test.medicareRate.toLocaleString()}`} notes="Medicare rate shown - actual list price may vary" citations="https://www.cms.gov/medicare/payment/fee-schedules/clinical-laboratory" />
                        )}
                        <DataRow label={test.codeType === 'PLA' ? 'PLA Code' : 'CPT Codes'} value={test.cptCodes} citations={test.cptCodesCitations} notes={test.codeType === 'PLA' ? 'Proprietary Laboratory Analyses - specific to this laboratory' : null} />
                      </div>
                    </Section>
                  </div>

                  {/* Clinical Evidence */}
                  <Section title="Clinical Evidence">
                    <div className="space-y-1">
                      <DataRow label="Target Population" value={test.targetPopulation} citations={test.targetPopulationCitations} />
                      <DataRow label="Cancer Types" value={test.cancerTypes?.join(', ')} citations={test.cancerTypesCitations} />
                      <DataRow label="Clinical Availability" value={test.clinicalAvailability} citations={test.clinicalAvailabilityCitations} notes={test.clinicalAvailabilityNotes} />
                      {test.numPublications && (
                        <div className="py-1.5 flex justify-between items-center">
                          <span className="text-xs text-gray-500">Publications</span>
                          <span className="text-sm font-semibold text-purple-600">{test.numPublications}{test.numPublicationsPlus ? '+' : ''}</span>
                        </div>
                      )}
                    </div>
                  </Section>
                </>
              )}

              {/* Non-TDS content (MRD, ECD, TRM) */}
              {category !== 'TDS' && (
                <>
              {/* Two-column layout for key metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Performance Metrics */}
                <Section title={<>Test Performance <span className="font-normal text-xs opacity-70">(hover terms for definitions)</span></>} expertTopic="sensitivity">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                      <span className="text-xs text-gray-500"><GlossaryTooltip termKey="sensitivity">Reported Sensitivity</GlossaryTooltip></span>
                      <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                        {test.sensitivity ? (
                          <>
                            <span className={(test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : ''}>
                              {test.sensitivity}%
                            </span>
                            {test.sensitivity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                              <span className="ml-1" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'}) - ${test.validationCohortStudy || 'interpret with caution'}` : 'Analytical validation only - clinical performance may differ'}>
                                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </span>
                            )}
                          </>
                        ) : '—'}
                        {test.sensitivity && <CitationTooltip citations={test.sensitivityCitations} />}
                      </span>
                    </div>
                    {test.advancedAdenomaSensitivity && <DataRow label="Advanced Adenoma Sensitivity" value={test.advancedAdenomaSensitivity} unit="%" citations={test.advancedAdenomaSensitivityCitations} notes={test.advancedAdenomaSensitivityNotes} />}
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                      <span className="text-xs text-gray-500"><GlossaryTooltip termKey="specificity">Reported Specificity</GlossaryTooltip></span>
                      <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                        {test.specificity ? (
                          <>
                            <span className={(test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning)) ? 'text-amber-600' : ''}>
                              {test.specificity}%
                            </span>
                            {test.specificity >= 99.9 && (test.smallSampleWarning || test.analyticalValidationWarning) && (
                              <span className="ml-1" title={test.smallSampleWarning ? `Small cohort (n=${test.validationCohortSize || '?'}) - ${test.validationCohortStudy || 'interpret with caution'}` : 'Analytical validation only - clinical performance may differ'}>
                                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </span>
                            )}
                          </>
                        ) : '—'}
                        {test.specificity && <CitationTooltip citations={test.specificityCitations} />}
                      </span>
                    </div>
                    {test.analyticalSpecificity && <DataRow label="Analytical Specificity" value={test.analyticalSpecificity} unit="%" citations={test.analyticalSpecificityCitations} />}
                    {test.clinicalSpecificity && <DataRow label="Clinical Specificity" value={test.clinicalSpecificity} unit="%" citations={test.clinicalSpecificityCitations} />}
                    <DataRow label="PPV" value={test.ppv} unit="%" citations={test.ppvCitations} notes={test.ppvNotes} />
                    <DataRow label="NPV" value={test.npv} unit="%" citations={test.npvCitations} notes={test.npvNotes} />
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                      <span className="text-xs text-gray-500"><GlossaryTooltip termKey="lod">LOD (Limit of Detection)</GlossaryTooltip></span>
                      <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                        {test.lod ? formatLOD(test.lod) : '—'}
                        {test.lod && <CitationTooltip citations={test.lodCitations} />}
                      </span>
                    </div>
                    {test.lod95 && (
                      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-4 group">
                        <span className="text-xs text-gray-500"><GlossaryTooltip termKey="lod">LOD95</GlossaryTooltip></span>
                        <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                          {test.lod95}
                          <CitationTooltip citations={test.lod95Citations} />
                        </span>
                      </div>
                    )}
                    {/* Validation Cohort Warning */}
                    {(test.smallSampleWarning || test.analyticalValidationWarning) && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="text-xs">
                            <p className="font-semibold text-amber-800">
                              {test.analyticalValidationWarning ? 'Analytical Validation Only' : 'Small Validation Cohort'}
                            </p>
                            <p className="text-amber-700 mt-0.5">
                              {test.analyticalValidationWarning 
                                ? 'Performance metrics from analytical validation (e.g., dilution series). Clinical performance may differ.' 
                                : `Validation cohort${test.validationCohortSize ? ` n=${test.validationCohortSize}` : ''} is smaller than typical. Interpret 100% values with caution.`}
                            </p>
                            {test.validationCohortStudy && (
                              <p className="text-amber-600 mt-1">
                                <span className="font-medium">Study:</span> {test.validationCohortStudy}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
                
                {/* Sample & TAT */}
                <Section title="Sample & Turnaround">
                  <div className="space-y-1">
                    <DataRow label="Sample Type" value={test.sampleCategory} />
                    <DataRow label="Blood Volume" value={test.bloodVolume} unit=" mL" citations={test.bloodVolumeCitations} notes={test.bloodVolumeNotes} />
                    {test.cfdnaInput && <DataRow label="cfDNA Input" value={test.cfdnaInput} unit=" ng" citations={test.cfdnaInputCitations} />}
                    {category === 'MRD' && (
                      <>
                        <DataRow label="Initial TAT" value={test.initialTat} unit=" days" citations={test.initialTatCitations} notes={test.initialTatNotes} />
                        <DataRow label="Follow-up TAT" value={test.followUpTat} unit=" days" citations={test.followUpTatCitations} notes={test.followUpTatNotes} />
                      </>
                    )}
                    {category !== 'MRD' && <DataRow label="TAT" value={test.tat} citations={test.tatCitations} notes={test.tatNotes} />}
                    {test.leadTimeVsImaging && <DataRow label="Lead Time vs Imaging" value={test.leadTimeVsImaging} unit=" days" citations={test.leadTimeVsImagingCitations} notes={test.leadTimeVsImagingNotes} />}
                    {test.variantsTracked && <DataRow label="Variants Tracked" value={test.variantsTracked} citations={test.variantsTrackedCitations} notes={test.variantsTrackedNotes} />}
                  </div>
                </Section>
              </div>
              
              {/* Stage-Specific Performance (if available) */}
              {(test.stageISensitivity || test.stageIISensitivity || test.stageIIISensitivity || test.stageIVSensitivity || 
                test.landmarkSensitivity || test.longitudinalSensitivity) && (
                <Section title="Stage & Timepoint Performance" expertTopic="stageSpecific">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {test.stageISensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageISensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage I</p>
                      </div>
                    )}
                    {test.stageIISensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageIISensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage II</p>
                      </div>
                    )}
                    {test.stageIIISensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageIIISensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage III</p>
                      </div>
                    )}
                    {test.stageIVSensitivity && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">{test.stageIVSensitivity}%</p>
                        <p className="text-xs text-gray-500">Stage IV</p>
                      </div>
                    )}
                  </div>
                  {(test.landmarkSensitivity || test.longitudinalSensitivity) && (
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
                      {test.landmarkSensitivity && <DataRow label="Landmark Sensitivity" value={test.landmarkSensitivity} unit="%" citations={test.landmarkSensitivityCitations} />}
                      {test.landmarkSpecificity && <DataRow label="Landmark Specificity" value={test.landmarkSpecificity} unit="%" citations={test.landmarkSpecificityCitations} />}
                      {test.longitudinalSensitivity && <DataRow label="Longitudinal Sensitivity" value={test.longitudinalSensitivity} unit="%" citations={test.longitudinalSensitivityCitations} />}
                      {test.longitudinalSpecificity && <DataRow label="Longitudinal Specificity" value={test.longitudinalSpecificity} unit="%" citations={test.longitudinalSpecificityCitations} />}
                    </div>
                  )}
                </Section>
              )}
              
              {/* Two-column layout for regulatory/evidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Regulatory & Coverage */}
                <Section title="Regulatory & Coverage">
                  <div className="space-y-1">
                    <DataRow label="FDA Status" value={test.fdaStatus} citations={test.fdaStatusCitations} />
                    <DataRow label="Medicare" value={test.reimbursement} notes={test.reimbursementNote} citations={test.reimbursementCitations} />
                    {test.medicareRate && (
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          Medicare CLFS Rate
                          {test.adltStatus && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium" title="Advanced Diagnostic Laboratory Test - receives annual rate updates based on weighted median of private payer rates">ADLT</span>}
                        </span>
                        <span className="text-sm font-semibold text-emerald-600">${test.medicareRate.toLocaleString()}</span>
                      </div>
                    )}
                    {hasPrivate && <DataRow label="Private Insurance" value={test.commercialPayers.join(', ')} notes={test.commercialPayersNotes} citations={test.commercialPayersCitations} />}
                    <DataRow label={test.codeType === 'PLA' ? 'PLA Code' : 'CPT Code'} value={test.cptCodes || test.cptCode} notes={test.codeType === 'PLA' ? 'Proprietary Laboratory Analyses - specific to this laboratory' : null} citations={test.cptCodesCitations} />
                    <DataRow label="Clinical Availability" value={test.clinicalAvailability} citations={test.clinicalAvailabilityCitations} notes={test.clinicalAvailabilityNotes} />
                    {test.availableRegions && test.availableRegions.length > 0 && (
                      <DataRow label="Available Regions" value={test.availableRegions.join(', ')} />
                    )}
                    {category === 'ECD' && (test.listPrice ? (
                      <DataRow label="List Price" value={`$${test.listPrice}`} citations={test.listPriceCitations} />
                    ) : test.medicareRate && (
                      <DataRow label="List Price (est.)" value={`~$${test.medicareRate.toLocaleString()}`} notes="Medicare rate shown - actual list price may vary" citations="https://www.cms.gov/medicare/payment/fee-schedules/clinical-laboratory" />
                    ))}
                  </div>
                </Section>
                
                {/* Clinical Evidence */}
                <Section title="Clinical Evidence" expertTopic="clinicalTrials">
                  <div className="space-y-1">
                    {test.totalParticipants && (
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="text-xs text-gray-500">Trial Participants</span>
                        <span className="text-sm font-semibold" style={{ color: '#2A63A4' }}>{test.totalParticipants.toLocaleString()}</span>
                      </div>
                    )}
                    {test.numPublications && (
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="text-xs text-gray-500">Publications</span>
                        <span className="text-sm font-semibold text-purple-600">{test.numPublications}{test.numPublicationsPlus ? '+' : ''}</span>
                      </div>
                    )}
                    <DataRow label="Independent Validation" value={test.independentValidation} notes={test.independentValidationNotes} citations={test.independentValidationCitations} />
                    {test.clinicalTrials && (
                      <div className="pt-2 mt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Key Trials</p>
                        <div className="text-xs text-gray-700 space-y-1">
                          {test.clinicalTrials.split(/[;|]/).slice(0, 5).map((trial, idx) => {
                            const trimmed = trial.trim();
                            if (!trimmed) return null;
                            const nctMatch = trimmed.match(/NCT\d+/);
                            return (
                              <div key={idx} className="flex items-start gap-1">
                                <span className="text-gray-400">•</span>
                                {nctMatch ? (
                                  <a href={`https://clinicaltrials.gov/study/${nctMatch[0]}`} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#2A63A4' }}>
                                    {trimmed.replace(/https?:\/\/[^\s]+/g, '').trim()}
                                  </a>
                                ) : (
                                  <span>{trimmed}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              </div>
              
              {/* Requirements & Method */}
              <Section title="Test Requirements & Method">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <DataRow label="Approach" value={test.approach} expertTopic="tumorInformed" citations={test.approachCitations} />
                    <DataRow label="Requires Tumor Tissue" value={requiresTissue ? 'Yes' : 'No'} notes={test.requiresTumorTissueNotes} />
                    <DataRow label="Requires Matched Normal" value={test.requiresMatchedNormal} />
                  </div>
                  <div className="space-y-1">
                    {test.method && <DataRow label="Method" value={test.method} citations={test.methodCitations} />}
                    {test.targetPopulation && <DataRow label="Target Population" value={test.targetPopulation} citations={test.targetPopulationCitations} />}
                    {test.indicationGroup && <DataRow label="Indication Group" value={test.indicationGroup} />}
                  </div>
                </div>
              </Section>
              
              {/* Cancer Types */}
              {test.cancerTypes && test.cancerTypes.length > 0 && (
                <Section title="Cancer Types">
                  <div className="flex flex-wrap gap-1">
                    {test.cancerTypes.map((type, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{type}</span>
                    ))}
                  </div>
                </Section>
              )}
              
              {/* Clinical Settings - MRD only */}
              {category === 'MRD' && test.clinicalSettings && test.clinicalSettings.length > 0 && (
                <Section title="Validated Clinical Settings">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {test.clinicalSettings.map((setting, i) => (
                      <span key={i} className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs font-medium">
                        {setting === 'Post-Surgery' ? '🔬 Post-Surgery (landmark)' : 
                         setting === 'Surveillance' ? '📊 Surveillance (longitudinal)' :
                         setting === 'Neoadjuvant' ? '💊 Neoadjuvant' :
                         setting === 'Post-Adjuvant' ? '✅ Post-Adjuvant' : setting}
                      </span>
                    ))}
                  </div>
                  {test.clinicalSettingsNotes && (
                    <p className="text-xs text-gray-500 mt-2">{test.clinicalSettingsNotes}</p>
                  )}
                </Section>
              )}
              
              {/* BLOODPAC Standards Reference - MRD only */}
              {category === 'MRD' && (
                <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📋</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">
                        MRD terminology on OpenOnco follows the <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/" target="_blank" rel="noopener noreferrer" className="font-medium text-orange-700 hover:text-orange-800 underline">BLOODPAC MRD Lexicon</a> standards.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <GlossaryTooltip termKey="tumor-informed"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">Tumor-informed</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="tumor-naive"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">Tumor-naïve</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="molecular-response"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">Molecular Response</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="ctdna-clearance"><span className="text-xs px-2 py-0.5 bg-white rounded border border-orange-200 text-orange-700">ctDNA Clearance</span></GlossaryTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                </>
              )}
              
              {/* TRM Standards Reference - ctMoniTR */}
              {category === 'TRM' && (
                <div className="mt-4 p-3 bg-gradient-to-r from-sky-50 to-cyan-50 rounded-lg border border-sky-200">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📊</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">
                        Treatment response monitoring endpoints follow the <a href="https://friendsofcancerresearch.org/ctdna/" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 hover:text-sky-800 underline">Friends of Cancer Research ctMoniTR</a> evidentiary framework.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <GlossaryTooltip termKey="molecular-response"><span className="text-xs px-2 py-0.5 bg-white rounded border border-sky-200 text-sky-700">Molecular Response</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="vaf"><span className="text-xs px-2 py-0.5 bg-white rounded border border-sky-200 text-sky-700">VAF</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="ctdna"><span className="text-xs px-2 py-0.5 bg-white rounded border border-sky-200 text-sky-700">ctDNA</span></GlossaryTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* TDS Standards Reference - NCCN */}
              {category === 'TDS' && (
                <div className="mt-4 p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-200">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📋</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">
                        Biomarker recommendations reference <a href="https://www.nccn.org/guidelines/guidelines-detail" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 hover:text-violet-800 underline">NCCN Clinical Practice Guidelines</a>. FDA companion diagnostics listed per <a href="https://www.fda.gov/medical-devices/in-vitro-diagnostics/companion-diagnostics" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 hover:text-violet-800 underline">FDA CDx database</a>.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <GlossaryTooltip termKey="nccn"><span className="text-xs px-2 py-0.5 bg-white rounded border border-violet-200 text-violet-700">NCCN</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="companion-dx"><span className="text-xs px-2 py-0.5 bg-white rounded border border-violet-200 text-violet-700">Companion Dx</span></GlossaryTooltip>
                        <GlossaryTooltip termKey="cgp"><span className="text-xs px-2 py-0.5 bg-white rounded border border-violet-200 text-violet-700">CGP</span></GlossaryTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Example Report Link */}
              {test.exampleTestReport && (
                <div className="text-center pt-2">
                  <a href={test.exampleTestReport} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline" style={{ color: '#2A63A4' }}>
                    View Example Test Report →
                  </a>
                </div>
              )}
              
              {/* Minimum Fields Section - for VC eligibility */}
              {MINIMUM_PARAMS[category] && (
                <MinimumFieldsSection test={test} category={category} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

// ============================================
// Comparison Modal
// ============================================
// Helper to detect LOD unit type from string value
const detectLodUnit = (lodValue) => {
  if (!lodValue) return null;
  const str = String(lodValue).toLowerCase();
  if (str.includes('ppm')) return 'ppm';
  if (str.includes('vaf') || str.includes('%')) return 'VAF';
  if (str.includes('mtm') || str.includes('molecules')) return 'MTM';
  if (str.includes('copies')) return 'copies';
  return 'other';
};

// Get badge color for LOD unit
const getLodUnitBadge = (unit) => {
  const badges = {
    'ppm': { bg: 'bg-violet-100', text: 'text-violet-700', label: 'ppm' },
    'VAF': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'VAF%' },
    'MTM': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'MTM' },
    'copies': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'copies' },
    'other': { bg: 'bg-gray-100', text: 'text-gray-600', label: '—' },
  };
  return badges[unit] || badges.other;
};

const ComparisonModal = ({ tests, category, onClose, onRemoveTest }) => {
  const params = comparisonParams[category] || comparisonParams.MRD;
  const meta = categoryMeta[category];
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Generate shareable link
  const getShareableLink = () => {
    const testIds = tests.map(t => t.id).join(',');
    return `${window.location.origin}?category=${category}&compare=${testIds}`;
  };
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareableLink());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = getShareableLink();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };
  
  // Print styles - fixed for multi-page printing
  const printStyles = `
    @media print {
      /* Hide everything except the print area */
      body * {
        visibility: hidden;
      }
      .comparison-print-area,
      .comparison-print-area * {
        visibility: visible;
      }
      
      /* Reset modal positioning for print */
      .comparison-modal-root {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .comparison-print-area { 
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
      }
      
      /* Allow content to flow across pages */
      .comparison-print-area,
      .comparison-print-area > div {
        max-height: none !important;
        overflow: visible !important;
        height: auto !important;
      }
      
      /* Table should break across pages naturally */
      .comparison-print-area table { 
        font-size: 9px;
      }
      .comparison-print-area thead { 
        display: table-header-group;
      }
      .comparison-print-area tr { 
        page-break-inside: avoid;
      }
      .comparison-print-area th, 
      .comparison-print-area td { 
        padding: 3px 5px;
      }
      
      /* Hide interactive elements */
      .print\\:hidden { display: none !important; }
      
      @page { 
        margin: 0.4in; 
        size: landscape;
      }
    }
  `;
  
  // Detect LOD units across all tests being compared
  const lodUnits = tests.map(t => detectLodUnit(t.lod)).filter(Boolean);
  const lod95Units = tests.map(t => detectLodUnit(t.lod95)).filter(Boolean);
  const uniqueLodUnits = [...new Set(lodUnits)];
  const uniqueLod95Units = [...new Set(lod95Units)];
  const hasLodUnitMismatch = uniqueLodUnits.length > 1 || uniqueLod95Units.length > 1;
  
  // Category-specific color schemes
  const colorSchemes = {
    MRD: { 
      headerBg: 'bg-gradient-to-r from-orange-500 to-amber-500', 
      headerText: 'text-white',
      accent: 'bg-orange-50 border-orange-200',
      accentText: 'text-orange-700',
      lightBg: 'bg-orange-50/50',
      border: 'border-orange-100',
      closeBtnHover: 'hover:bg-orange-400/20'
    },
    ECD: { 
      headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500', 
      headerText: 'text-white',
      accent: 'bg-emerald-50 border-emerald-200',
      accentText: 'text-emerald-700',
      lightBg: 'bg-emerald-50/50',
      border: 'border-emerald-100',
      closeBtnHover: 'hover:bg-emerald-400/20'
    },
    TRM: { 
      headerBg: 'bg-gradient-to-r from-rose-500 to-pink-500', 
      headerText: 'text-white',
      accent: 'bg-rose-50 border-rose-200',
      accentText: 'text-rose-700',
      lightBg: 'bg-rose-50/50',
      border: 'border-rose-100',
      closeBtnHover: 'hover:bg-rose-400/20'
    },
    TDS: { 
      headerBg: 'bg-gradient-to-r from-violet-500 to-purple-500', 
      headerText: 'text-white',
      accent: 'bg-violet-50 border-violet-200',
      accentText: 'text-violet-700',
      lightBg: 'bg-violet-50/50',
      border: 'border-violet-100',
      closeBtnHover: 'hover:bg-violet-400/20'
    }
  };
  const colors = colorSchemes[category] || colorSchemes.MRD;
  
  return (
    <>
      <style>{printStyles}</style>
      <div className="comparison-modal-root fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:backdrop-blur-none" data-testid="comparison-modal" onClick={onClose}>
        <div className="comparison-print-area bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          {/* Colored Header */}
          <div className={`flex justify-between items-center p-5 ${colors.headerBg}`} style={{ flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center print:hidden">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className={`text-xl font-bold ${colors.headerText} print:text-black`}>Comparing {tests.length} Tests</h2>
                <p className="text-white/80 text-sm print:text-gray-600">{meta?.title || category} Category • OpenOnco.org</p>
              </div>
            </div>
          <div className="flex items-center gap-2">
            {/* Copy Link Button */}
            <button 
              onClick={copyLink} 
              className={`p-2 ${colors.closeBtnHover} rounded-xl transition-colors print:hidden flex items-center gap-1`}
              title="Copy shareable link"
              data-testid="share-link-button"
            >
              {linkCopied ? (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
              {linkCopied && <span className="text-white text-xs">Copied!</span>}
            </button>
            <button 
              onClick={() => window.print()} 
              className={`p-2 ${colors.closeBtnHover} rounded-xl transition-colors print:hidden`}
              title="Print or save as PDF"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
            <button onClick={onClose} className={`p-2 ${colors.closeBtnHover} rounded-xl transition-colors print:hidden`}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Expert Warning Banner */}
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-3" style={{ flexShrink: 0 }}>
          <div className="w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">E</div>
          <div className="text-sm">
            <p className="font-medium text-amber-800">Comparison Limitations</p>
            <p className="text-amber-700 text-xs mt-1">
              Performance metrics may not be directly comparable across tests due to differences in methodology 
              (analytical vs clinical, landmark vs longitudinal), patient populations, and reporting standards. 
              See <span className="font-medium">[E]</span> icons for context.
            </p>
            {hasLodUnitMismatch && (
              <p className="text-red-700 text-xs mt-2 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                LOD values below use different units ({uniqueLodUnits.join(', ')}) — cannot be directly compared. Unit badges shown for clarity.
              </p>
            )}
            <p className="text-amber-600 text-[10px] mt-1 italic">— Expert Advisors: MR, SW</p>
          </div>
        </div>
        
        {/* Table Content */}
        <div style={{ overflow: 'auto', flex: '1 1 auto' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`text-left p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider ${colors.lightBg} min-w-[140px] sticky top-0 z-10`}>
                  Parameter
                </th>
                {tests.map((test, i) => (
                  <th key={test.id} className={`text-left p-4 min-w-[200px] sticky top-0 z-10 ${colors.lightBg}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className={`flex-1 p-3 rounded-xl ${colors.accent} border`}>
                        <p className={`font-bold ${colors.accentText}`}>{test.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{test.vendor}<VendorBadge vendor={test.vendor} size="xs" /></p>
                      </div>
                      <button 
                        onClick={() => onRemoveTest(test.id)} 
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0 print:hidden"
                        title="Remove from comparison"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {params.map((param, idx) => (
                <tr key={param.key} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} hover:bg-gray-100/50 transition-colors`}>
                  <td className={`p-4 text-sm font-medium text-gray-600 ${colors.border} border-b`}>
                    <span className="flex items-center gap-1">
                      {param.label}
                      {category !== 'TDS' && (param.key === 'sensitivity' || param.key === 'specificity') && <ExpertInsight topic={param.key} />}
                      {category !== 'TDS' && param.key === 'lod' && <ExpertInsight topic="lod" />}
                      {category !== 'TDS' && param.key === 'lod95' && <ExpertInsight topic="lodVsLod95" />}
                      {category !== 'TDS' && (param.key === 'sensitivityStagesReported' || param.key === 'stageIISensitivity' || param.key === 'stageIIISensitivity') && <ExpertInsight topic="stageSpecific" />}
                    </span>
                  </td>
                  {tests.map(test => {
                    let value = param.key === 'cancerTypesStr' ? test.cancerTypes?.join(', ') 
                      : param.key === 'commercialPayersStr' ? test.commercialPayers?.join(', ')
                      : param.key === 'availableRegionsStr' ? (test.availableRegions?.join(', ') || 'US')
                      : param.key === 'biomarkersReportedStr' ? test.biomarkersReported?.join(', ')
                      : param.key === 'clinicalSettingsStr' ? test.clinicalSettings?.join(', ')
                      : test[param.key];
                    const hasValue = value != null && value !== '';
                    
                    // For LOD/LOD95, add unit badge
                    const isLodField = param.key === 'lod' || param.key === 'lod95';
                    const lodUnit = isLodField ? detectLodUnit(value) : null;
                    const unitBadge = lodUnit ? getLodUnitBadge(lodUnit) : null;
                    
                    return (
                      <td key={test.id} className={`p-4 text-sm ${colors.border} border-b ${hasValue ? 'text-gray-900' : 'text-gray-300'}`}>
                        {hasValue ? (
                          <span className="flex items-center gap-2">
                            <span>{String(value)}</span>
                            {unitBadge && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${unitBadge.bg} ${unitBadge.text}`}>
                                {unitBadge.label}
                              </span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className={`p-4 ${colors.lightBg} border-t ${colors.border} flex-shrink-0 print:hidden`}>
          <p className="text-xs text-gray-500 text-center">
            Click the × next to a test name to remove it from comparison • Use print button to save as PDF
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

// ============================================
// Smart Comparison Suggestions
// ============================================
const getSuggestedTests = (selectedTestIds, allTests, maxSuggestions = 6) => {
  if (selectedTestIds.length === 0) return [];
  
  const selectedTests = allTests.filter(t => selectedTestIds.includes(t.id));
  const unselectedTests = allTests.filter(t => !selectedTestIds.includes(t.id));
  
  // Collect attributes from selected tests
  const selectedIndicationGroups = new Set(selectedTests.map(t => t.indicationGroup).filter(Boolean));
  const selectedCancerTypes = new Set(selectedTests.flatMap(t => t.cancerTypes || []));
  const selectedApproaches = new Set(selectedTests.map(t => t.approach).filter(Boolean));
  const selectedTestScopes = new Set(selectedTests.map(t => t.testScope).filter(Boolean));
  
  // Score each unselected test
  const scored = unselectedTests.map(test => {
    let score = 0;
    let matchReason = '';
    
    // Highest priority: Same indication group (e.g., CRC → CRC)
    if (test.indicationGroup && selectedIndicationGroups.has(test.indicationGroup)) {
      score += 100;
      matchReason = `${test.indicationGroup} tests`;
    }
    
    // High priority: Overlapping cancer types
    const testCancerTypes = test.cancerTypes || [];
    const overlappingCancers = testCancerTypes.filter(ct => selectedCancerTypes.has(ct));
    if (overlappingCancers.length > 0) {
      score += 30 * overlappingCancers.length;
      if (!matchReason) {
        const shortName = overlappingCancers[0].length > 15 
          ? overlappingCancers[0].slice(0, 15) + '...' 
          : overlappingCancers[0];
        matchReason = `${shortName}`;
      }
    }
    
    // Medium priority: Same test scope (single-cancer vs multi-cancer)
    if (test.testScope && selectedTestScopes.has(test.testScope)) {
      score += 20;
      if (!matchReason) matchReason = test.testScope;
    }
    
    // Lower priority: Same approach (tumor-informed vs tumor-naïve)
    if (test.approach && selectedApproaches.has(test.approach)) {
      score += 10;
      if (!matchReason) matchReason = test.approach;
    }
    
    return { test, score, matchReason };
  });
  
  // Sort by score and return top suggestions
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
};

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
    track('test_detail_viewed', { 
      category: category,
      test_id: test.id,
      test_name: test.name,
      vendor: test.vendor
    }, { 
      flags: [personaFlag, `category-${category.toLowerCase()}`] 
    });
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
      // NCCN filter
      if (nccnOnly && !test.nccnRecommended) return false;
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
      // Priority: 1) VENDOR VERIFIED, 2) BC tests, 3) Non-BC tests
      const aVerified = VENDOR_VERIFIED[a.id] !== undefined;
      const bVerified = VENDOR_VERIFIED[b.id] !== undefined;
      if (aVerified && !bVerified) return -1;
      if (!aVerified && bVerified) return 1;
      
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
                  activeCount={selectedApproaches.length + selectedSampleCategories.length + (tumorTissueRequired !== 'any' ? 1 : 0)}
                >
                  {/* Approach - for MRD, TRM, TDS */}
                  {category !== 'ECD' && config.approaches && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 block">Approach</label>
                      {config.approaches.map(a => <Checkbox key={a} label={a} checked={selectedApproaches.includes(a)} onChange={() => toggle(setSelectedApproaches)(a)} />)}
                    </>
                  )}
                  {/* Sample Type - all categories */}
                  {config.sampleCategories && (
                    <>
                      <label className="text-xs text-gray-500 mb-1 mt-3 block">Sample Type</label>
                      {config.sampleCategories.map(o => <Checkbox key={o} label={o} checked={selectedSampleCategories.includes(o)} onChange={() => toggle(setSelectedSampleCategories)(o)} />)}
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
                {/* NCCN Recommended - MRD, TRM (not ECD, TDS), clinician only */}
                {(category === 'MRD' || category === 'TRM') && (
                  <>
                    <label className="text-xs text-gray-500 mb-1 mt-3 block">Guidelines</label>
                    <Checkbox label="NCCN Recommended" checked={nccnOnly} onChange={() => setNccnOnly(!nccnOnly)} />
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
                  // Track comparison with feature flags
                  const personaFlag = `persona-${persona.toLowerCase().replace(/[^a-z]/g, '-')}`;
                  track('tests_compared', { 
                    category: category,
                    test_count: selectedTests.length,
                    test_ids: selectedTests.join(',')
                  }, { 
                    flags: [personaFlag, `category-${category.toLowerCase()}`] 
                  });
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

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Ask a Question</h2>
        <CategoryChat category={category} />
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

// ============================================
// Main App
// ============================================
export default function App() {
  // Map URL paths to page names
  const pathToPage = {
    '/': 'home',
    '/submissions': 'submissions',
    '/how-it-works': 'how-it-works',
    '/data-sources': 'data-sources',
    '/faq': 'faq',
    '/learn': 'learn',
    '/about': 'about',
    '/mrd': 'MRD',
    '/ecd': 'ECD',
    '/trm': 'TRM',
    '/tds': 'TDS',
    '/alz-blood': 'ALZ-BLOOD'
  };

  const pageToPath = {
    'home': '/',
    'submissions': '/submissions',
    'how-it-works': '/how-it-works',
    'data-sources': '/data-sources',
    'faq': '/faq',
    'learn': '/learn',
    'about': '/about',
    'MRD': '/mrd',
    'ECD': '/ecd',
    'TRM': '/trm',
    'TDS': '/tds',
    'ALZ-BLOOD': '/alz-blood'
  };

  // Category URL prefixes for test routes
  const categoryPrefixes = {
    'mrd': 'MRD',
    'ecd': 'ECD',
    'trm': 'TRM',
    'tds': 'TDS',
    'alz-blood': 'ALZ-BLOOD'
  };

  // Initialize currentPage from URL path (handles /mrd/signatera style URLs)
  const getInitialPage = () => {
    const path = window.location.pathname.toLowerCase();

    // Check for individual test routes: /mrd/test-name
    const testRouteMatch = path.match(/^\/(mrd|ecd|trm|tds|alz-blood)\/([a-z0-9-]+)$/);
    if (testRouteMatch) {
      const [, categoryPrefix, testSlug] = testRouteMatch;
      const category = categoryPrefixes[categoryPrefix];
      const test = getTestBySlug(testSlug, category);
      if (test) {
        return { page: category, testSlug, testId: test.id };
      }
    }

    // Standard page routing
    return { page: pathToPage[path] || 'home', testSlug: null, testId: null };
  };

  const initialRoute = getInitialPage();

  const [currentPage, setCurrentPage] = useState(initialRoute.page);
  const [initialSelectedTestId, setInitialSelectedTestId] = useState(initialRoute.testId);
  const [initialCompareIds, setInitialCompareIds] = useState(null);
  const [submissionPrefill, setSubmissionPrefill] = useState(null);
  const [vendorInvite, setVendorInvite] = useState(null);
  const [persona, setPersona] = useState(() => getStoredPersona() || 'Clinician');

  // Check URL parameters on mount for direct test links and comparison links (backward compatibility)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const testId = params.get('test');
    const compareIds = params.get('compare');
    
    // Handle vendor invite URLs for submissions page
    const inviteType = params.get('invite');
    const inviteEmail = params.get('email');
    const inviteName = params.get('name');
    
    if (inviteType === 'vendor' && inviteEmail) {
      setVendorInvite({ email: inviteEmail, name: inviteName });
      // Clear URL parameters after reading
      window.history.replaceState({}, '', window.location.pathname);
      return; // Don't process other params
    }

    // Security: Validate test IDs to prevent injection attacks
    // Valid format: lowercase letters followed by hyphen and digits (e.g., mrd-1, ecd-12, tds-5)
    const isValidTestId = (id) => /^[a-z]+-\d+$/.test(id);

    if (category && ['MRD', 'ECD', 'TRM', 'TDS', 'ALZ-BLOOD'].includes(category)) {
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
    
    // Track navigation with feature flags
    const personaFlag = `persona-${persona.toLowerCase().replace(/[^a-z]/g, '-')}`;
    if (['MRD', 'ECD', 'TRM', 'TDS'].includes(page)) {
      track('category_viewed', { 
        category: page,
        from_test_link: testId !== null 
      }, { 
        flags: [personaFlag, `category-${page.toLowerCase()}`] 
      });
    } else if (page !== currentPage) {
      track('page_viewed', { 
        page: page 
      }, { 
        flags: [personaFlag] 
      });
    }
    setCurrentPage(page);
    setInitialSelectedTestId(testId);
    // Update URL without page reload
    const newPath = pageToPath[page] || '/';
    window.history.pushState({page}, '', newPath);
  };

  // Get SEO config for current page
  const getSEOForPage = () => {
    const seoConfig = PAGE_SEO[currentPage] || PAGE_SEO.home;
    let structuredData = null;

    // Add structured data based on page type
    if (currentPage === 'home') {
      structuredData = generateOrganizationSchema();
    } else if (['MRD', 'ECD', 'TRM', 'TDS', 'ALZ-BLOOD'].includes(currentPage)) {
      const categoryMeta = createCategoryMeta();
      const tests = categoryMeta[currentPage]?.tests || [];
      structuredData = generateCategorySchema(currentPage, tests);
    }

    return { ...seoConfig, structuredData };
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage onNavigate={handleNavigate} />;
      case 'learn': return <LearnPage onNavigate={handleNavigate} />;
      case 'MRD': case 'ECD': case 'TRM': case 'TDS': case 'ALZ-BLOOD': return <CategoryPage key={`${currentPage}-${persona}`} category={currentPage} initialSelectedTestId={initialSelectedTestId} initialCompareIds={initialCompareIds} onClearInitialTest={() => { setInitialSelectedTestId(null); setInitialCompareIds(null); }} />;
      case 'data-sources': return <SourceDataPage />;
      case 'how-it-works': return <HowItWorksPage />;
      case 'submissions': return <SubmissionsPage prefill={submissionPrefill} onClearPrefill={() => setSubmissionPrefill(null)} vendorInvite={vendorInvite} onClearVendorInvite={() => setVendorInvite(null)} />;
      case 'faq': return <FAQPage />;
      case 'about': return <AboutPage />;
      default: return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const seoConfig = getSEOForPage();

  return (
    <HelmetProvider>
      <SEO
        title={seoConfig.title}
        description={seoConfig.description}
        path={seoConfig.path}
        structuredData={seoConfig.structuredData}
      />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header currentPage={currentPage} onNavigate={handleNavigate} />
        <main className="flex-1" key={`main-${persona}`}>{renderPage()}</main>
        <Footer />
        <Analytics />
      </div>
    </HelmetProvider>
  );
}
