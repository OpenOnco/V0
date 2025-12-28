import React, { useState, useMemo } from 'react';
import {
  mrdTestData,
  ecdTestData,
  trmTestData,
  tdsTestData,
  getDomain,
  getStagesByDomain,
  lifecycleColorClasses,
  RECENTLY_ADDED_TESTS,
} from '../../data';
import VendorBadge from '../badges/VendorBadge';

// Placeholder for ALZ data (disabled)
const alzBloodTestData = [];

// ============================================
// Lifecycle Navigator Components
// ============================================

// Get test counts dynamically - will be populated after test data is defined
export const getTestCount = (stageId) => {
  switch(stageId) {
    case 'ECD': return typeof ecdTestData !== 'undefined' ? ecdTestData.length : 13;
    case 'TDS': return 8; // Placeholder until TDS data exists
    case 'TRM': return typeof trmTestData !== 'undefined' ? trmTestData.length : 9;
    case 'MRD': return typeof mrdTestData !== 'undefined' ? mrdTestData.length : 15;
    default: return 0;
  }
};

// Get sample tests for each stage
export const getSampleTests = (stageId) => {
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
export const LifecycleNavigator = ({ onNavigate }) => {
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
// Recently Added Tests Banner - Full width at top of showcase
// ============================================
export const RecentlyAddedBanner = ({ onNavigate }) => {
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
export const CancerTypeNavigator = ({ onNavigate }) => {
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
