import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Analytics } from '@vercel/analytics/react';

// ============================================
// RECENTLY ADDED TESTS - UPDATE ON EACH DEPLOY
// ============================================
// ⚠️ IMPORTANT: When adding new tests, add them here FIRST with current date
// This powers the "Recently Added" section on the homepage
// Format: { id, name, vendor, category, dateAdded }
// Keep newest entries at top, maintain ~10 entries max
const RECENTLY_ADDED_TESTS = [
  { id: 'mrd-16', name: 'Invitae PCM', vendor: 'Labcorp (Invitae)', category: 'MRD', dateAdded: 'Dec 8, 2025' },
  { id: 'mrd-17', name: 'Labcorp Plasma Detect', vendor: 'Labcorp', category: 'MRD', dateAdded: 'Dec 8, 2025' },
  { id: 'trm-10', name: 'Guardant360 Response', vendor: 'Guardant Health', category: 'TRM', dateAdded: 'Dec 8, 2025' },
  { id: 'cgp-15', name: 'Neo Comprehensive', vendor: 'NeoGenomics', category: 'CGP', dateAdded: 'Dec 8, 2025' },
  { id: 'ecd-13', name: 'Signal-C', vendor: 'Universal DX', category: 'ECD', dateAdded: 'Dec 7, 2025' },
  { id: 'trm-9', name: 'MSK-ACCESS', vendor: 'SOPHiA GENETICS', category: 'TRM', dateAdded: 'Dec 7, 2025' },
  { id: 'ecd-12', name: 'ProVue Lung', vendor: 'PrognomiQ', category: 'ECD', dateAdded: 'Dec 5, 2025' },
  { id: 'mrd-15', name: 'Foresight CLARITY', vendor: 'Natera/Foresight', category: 'MRD', dateAdded: 'Dec 4, 2025' },
  { id: 'trm-8', name: 'Northstar Response', vendor: 'BillionToOne', category: 'TRM', dateAdded: 'Dec 3, 2025' },
];

// ============================================
// Vendor Badges - Awards and recognition
// ============================================
const VENDOR_BADGES = {
  'Exact Sciences': [
    { id: 'openness-2025', icon: '🏆', label: 'Openness Award 2025', tooltip: 'OpenOnco Openness Award 2025 — Highest data disclosure among vendors with 2+ tests' }
  ],
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

// ============================================
// Lifecycle Navigator Constants
// ============================================
const LIFECYCLE_STAGES = [
  { 
    id: 'ECD', 
    name: 'Early Cancer Detection',
    acronym: 'ECD',
    phase: 'Healthy / Screening',
    color: 'emerald',
    icon: '🔬',
    gridPosition: 0,
    arrowDirection: 'right',
  },
  { 
    id: 'CGP', 
    name: 'Comprehensive Genomic Profiling',
    acronym: 'CGP',
    phase: 'Newly Diagnosed',
    color: 'violet',
    icon: '🧬',
    gridPosition: 1,
    arrowDirection: 'down',
  },
  { 
    id: 'TRM', 
    name: 'Treatment Response Monitoring',
    acronym: 'TRM',
    phase: 'Active Treatment',
    color: 'sky',
    icon: '📊',
    gridPosition: 3,
    arrowDirection: 'left',
  },
  { 
    id: 'MRD', 
    name: 'Minimal Residual Disease',
    acronym: 'MRD',
    phase: 'Surveillance',
    color: 'orange',
    icon: '🎯',
    gridPosition: 2,
    arrowDirection: 'up',
  },
];

const LIFECYCLE_STAGES_BY_GRID = [...LIFECYCLE_STAGES].sort((a, b) => a.gridPosition - b.gridPosition);

const lifecycleColorClasses = {
  emerald: {
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    bgMedium: 'bg-emerald-100',
    border: 'border-emerald-200',
    borderActive: 'border-emerald-500',
    text: 'text-emerald-600',
    textLight: 'text-emerald-400',
    textDark: 'text-emerald-700',
  },
  violet: {
    bg: 'bg-violet-500',
    bgLight: 'bg-violet-50',
    bgMedium: 'bg-violet-100',
    border: 'border-violet-200',
    borderActive: 'border-violet-500',
    text: 'text-violet-600',
    textLight: 'text-violet-400',
    textDark: 'text-violet-700',
  },
  sky: {
    bg: 'bg-sky-500',
    bgLight: 'bg-sky-50',
    bgMedium: 'bg-sky-100',
    border: 'border-sky-200',
    borderActive: 'border-sky-500',
    text: 'text-sky-600',
    textLight: 'text-sky-400',
    textDark: 'text-sky-700',
  },
  orange: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    bgMedium: 'bg-orange-100',
    border: 'border-orange-200',
    borderActive: 'border-orange-500',
    text: 'text-orange-600',
    textLight: 'text-orange-400',
    textDark: 'text-orange-700',
  },
};

// ============================================
// Markdown Renderer Component
// ============================================
const Markdown = ({ children, className = '' }) => {
  if (!children) return null;
  
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
          parts.push(<a key={partKey++} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700">{match[1]}</a>);
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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

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
        continue;
      }

      // Unordered list
      const ulMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        currentList.push(<li key={key++}>{parseInline(ulMatch[1])}</li>);
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        currentList.push(<li key={key++}>{parseInline(olMatch[1])}</li>);
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        flushList();
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(<p key={key++} className="my-1">{parseInline(line)}</p>);
    }

    flushList();
    return elements;
  };

  return <div className={className}>{renderMarkdown(children)}</div>;
};

// Helper to get persona from localStorage (used by NewsFeed and chat components)
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
    case 'CGP': return 8; // Placeholder until CGP data exists
    case 'TRM': return typeof trmTestData !== 'undefined' ? trmTestData.length : 9;
    case 'MRD': return typeof mrdTestData !== 'undefined' ? mrdTestData.length : 15;
    default: return 0;
  }
};

// Get sample tests for each stage
const getSampleTests = (stageId) => {
  switch(stageId) {
    case 'ECD': return ['Galleri', 'Shield', 'Cancerguard', 'Freenome CRC', 'GRAIL NHS', 'Cologuard Plus'];
    case 'CGP': return ['FoundationOne CDx', 'Guardant360 CDx', 'Tempus xT CDx', 'MSK-IMPACT', 'MI Cancer Seek', 'OncoExTra'];
    case 'TRM': return ['Guardant360 Response', 'Signatera (IO Monitoring)', 'NeXT Personal', 'RaDaR', 'Oncodetect'];
    case 'MRD': return ['Signatera', 'Guardant Reveal', 'RaDaR', 'Oncodetect', 'Invitae Personalis', 'FoundationOne Tracker'];
    default: return [];
  }
};

// Arrow button component for lifecycle flow
const LifecycleFlowArrow = ({ direction, isPulsing, color }) => {
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
        w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500
        ${isPulsing 
          ? `${colors.bg} shadow-lg scale-110` 
          : `bg-white shadow-md border ${colors.border}`
        }
        ${rotations[direction]}
      `}>
        <svg 
          className={`w-3.5 h-3.5 transition-colors duration-500 ${isPulsing ? 'text-white' : colors.textLight}`} 
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
const LifecycleScrollingTests = ({ tests, isHighlighted, color }) => {
  const colors = lifecycleColorClasses[color];
  const testString = tests.join('  •  ');
  const scrollContent = `${testString}  •  ${testString}  •  `;
  
  return (
    <div className={`mt-3 pt-2 border-t transition-colors duration-500 overflow-hidden ${
      isHighlighted ? colors.borderActive : colors.border
    }`}>
      <div className="relative">
        <div 
          className={`flex whitespace-nowrap text-xs transition-colors duration-500 ${
            isHighlighted ? 'text-gray-600' : 'text-gray-400'
          }`}
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
const LifecycleStageCard = ({ stage, isHighlighted, onClick, onMouseEnter, testCount }) => {
  const colors = lifecycleColorClasses[stage.color];
  const sampleTests = getSampleTests(stage.id);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        relative p-5 rounded-xl text-left transition-all duration-500 h-full
        ${isHighlighted 
          ? `${colors.bgMedium} border-2 ${colors.borderActive} shadow-lg` 
          : `${colors.bgLight} border ${colors.border}`
        }
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`
          w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-500
          ${isHighlighted 
            ? `${colors.bg} text-white shadow-md` 
            : `${colors.bgMedium} ${colors.text}`
          }
        `}>
          <span className="text-2xl">{stage.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-bold leading-tight transition-colors duration-500 ${
            isHighlighted ? colors.textDark : colors.text
          }`}>
            {stage.phase}: {stage.acronym}
          </h3>
          <p className={`text-sm font-semibold mt-1 transition-colors duration-500 ${
            isHighlighted ? colors.textDark : colors.text
          }`}>
            {stage.name}
          </p>
          <p className={`text-sm font-semibold mt-1 transition-colors duration-500 ${
            isHighlighted ? colors.text : colors.textLight
          }`}>
            {`Click to explore ${testCount} tests →`}
          </p>
        </div>
      </div>
      
      <LifecycleScrollingTests 
        tests={sampleTests} 
        isHighlighted={isHighlighted}
        color={stage.color}
      />
      
      <LifecycleFlowArrow 
        direction={stage.arrowDirection} 
        isPulsing={isHighlighted} 
        color={stage.color}
      />
    </button>
  );
};

// Main lifecycle navigator component
const LifecycleNavigator = ({ onNavigate }) => {
  const [pulseIndex, setPulseIndex] = useState(0);
  const [hoveredStageId, setHoveredStageId] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  
  // Get dynamic test counts
  const testCounts = {
    ECD: typeof ecdTestData !== 'undefined' ? ecdTestData.length : 13,
    CGP: typeof cgpTestData !== 'undefined' ? cgpTestData.length : 10,
    TRM: typeof trmTestData !== 'undefined' ? trmTestData.length : 9,
    MRD: typeof mrdTestData !== 'undefined' ? mrdTestData.length : 15,
  };
  
  const highlightedStageId = isHovering && hoveredStageId ? hoveredStageId : LIFECYCLE_STAGES[pulseIndex].id;
  
  // Pulse animation - 3 seconds per stage
  useEffect(() => {
    if (isHovering) return;
    
    const interval = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % 4);
    }, 2250);
    
    return () => clearInterval(interval);
  }, [isHovering]);
  
  const handleSelect = (stageId) => {
    onNavigate(stageId);
  };
  
  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoveredStageId(null); }}
    >
      <style>{`
        @keyframes lifecycleScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="grid grid-cols-2 gap-6">
        {LIFECYCLE_STAGES_BY_GRID.map((stage) => (
          <LifecycleStageCard
            key={stage.id}
            stage={stage}
            isHighlighted={highlightedStageId === stage.id}
            onClick={() => handleSelect(stage.id)}
            onMouseEnter={() => setHoveredStageId(stage.id)}
            testCount={testCounts[stage.id]}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================
// NewsFeed Component - AI-generated prose digest, vertical scroll
// ============================================
const NewsFeed = ({ onNavigate }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [digest, setDigest] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastGenerated, setLastGenerated] = useState(null);
  const [persona, setPersona] = useState(getStoredPersona() || 'Clinician');
  const scrollRef = useRef(null);

  // Category colors for recently added badges
  const categoryColors = {
    MRD: 'bg-orange-500',
    ECD: 'bg-emerald-500',
    TRM: 'bg-sky-500',
    CGP: 'bg-violet-500'
  };

  // Handle click on recently added test
  const handleTestClick = (test) => {
    if (onNavigate) {
      onNavigate(test.category, test.id);
    }
  };

  // Listen for persona changes from other components
  useEffect(() => {
    const handlePersonaChange = (e) => {
      setPersona(e.detail);
    };
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);

  // Persona-specific fallback digests if API fails
  const fallbackDigests = {
    'Clinician': `**Top 5 Liquid Biopsy News – Week of December 5, 2025**

**1. The MRD Sensitivity Arms Race: Natera's $450M Bet on 0.3 ppm Detection (Dec 5)**
Natera closed its acquisition of Foresight Diagnostics ($275M upfront, $175M earnouts), gaining PhasED-Seq technology with LOD95 of 0.3 ppm. Foresight's CLARITY assay was the first ctDNA-MRD test in NCCN Guidelines for DLBCL. Integration into Signatera expected 2026. Combined portfolio: 15 abstracts at ASH 2025 including 7 orals.
[Read more →](https://www.fiercebiotech.com/medtech/natera-buys-foresight-diagnostics-cancer-mrd-deal-worth-450m)

**2. Can SimpleScreen Dethrone Shield? Freenome's $330M Gamble (Dec 5)**
Freenome's SPAC merger funds SimpleScreen CRC test commercialization ahead of mid-2026 FDA decision. Head-to-head competition with Shield (Guardant) anticipated. The transaction includes $90M from trust plus $240M PIPE led by Perceptive Advisors and RA Capital.
[Read more →](https://www.statnews.com/2025/12/05/freenome-plans-go-public-early-cancer-detection/)

**3. Is ctDNA Enough? cfRNA Emerges as Complementary Signal at SABCS (Dec 9-12)**
SERENA-6 data showing benefit from ESR1 mutation-guided therapy modification sparks debate on ctDNA escalation/de-escalation protocols. Sessions cover cfRNA sequencing and novel ctDNA analyses for breast cancer MRD—suggesting DNA alone may miss key biology.
[Read more →](https://sabcs.org/)

**4. Why 26% of Oncologists Still Don't Know MRD Guidelines Exist (Dec 2)**
Market valued at $4.93B (2024), 12.5% CAGR projected. IASLC survey reveals startling awareness gap: 26% of institutions unaware of biomarker testing guidelines—standardization remains the key barrier to adoption.
[Read more →](https://www.marketsandmarkets.com/Market-Reports/liquid-biopsy-market-13966350.html)

**5. Beyond DNA: Can Exosomes Catch What ctDNA Misses? (Dec 2)**
Exosome liquid biopsy market growing from $91M to $159M by 2030. Multi-omic exosome analysis via AI enables detection of protein, RNA, and lipid cancer signatures beyond ctDNA—potentially filling gaps in ctDNA-low tumors.
[Read more →](https://www.grandviewresearch.com/industry-analysis/liquid-biopsy-market)

*Conferences: ASH 2025 (Dec 6-10), SABCS 2025 (Dec 9-12)*`,

    'Patient': `**Top 5 Liquid Biopsy News – Week of December 5, 2025**

**1. Could Your Blood Test Detect Cancer Traces 10x Smaller? (Dec 5)**
Natera, a leading cancer testing company, acquired Foresight Diagnostics to improve their ability to detect tiny traces of cancer in blood tests. This means more sensitive tests may become available to help doctors catch cancer recurrence earlier. The combined company will be presenting new research at major medical conferences this month.
[Read more →](https://www.fiercebiotech.com/medtech/natera-buys-foresight-diagnostics-cancer-mrd-deal-worth-450m)

**2. A Blood Test Instead of Colonoscopy? New Option Coming in 2026 (Dec 5)**
Freenome is moving forward with their SimpleScreen blood test for colon cancer detection, which could be approved by mid-2026. This would give patients an alternative to colonoscopies for initial screening. The test would compete with Guardant's Shield test, giving patients more choices.
[Read more →](https://www.statnews.com/2025/12/05/freenome-plans-go-public-early-cancer-detection/)

**3. Should You Get More Chemo—or Less? Blood Tests May Soon Help Decide (Dec 9-12)**
The San Antonio Breast Cancer Symposium will feature discussions on how blood tests can help guide treatment decisions. Researchers are exploring whether these tests can help determine if patients need more or less aggressive treatment, potentially sparing some patients from unnecessary chemotherapy.
[Read more →](https://sabcs.org/)

**4. Is Your Doctor Using the Latest Cancer Testing? Many Aren't (Dec 2)**
The market for blood-based cancer tests is expected to double to $10 billion by 2030. But a surprising survey found 26% of cancer centers don't know current testing guidelines exist—ask your oncologist if they're up to date on liquid biopsy options.
[Read more →](https://www.marketsandmarkets.com/Market-Reports/liquid-biopsy-market-13966350.html)

**5. What If DNA Tests Miss Your Cancer? Scientists Have New Ideas (Dec 2)**
Scientists are exploring ways to detect cancer signals beyond just DNA in blood. New approaches analyze tiny particles called exosomes that carry multiple types of cancer markers, potentially catching cancers that current DNA-only tests might miss.
[Read more →](https://www.grandviewresearch.com/industry-analysis/liquid-biopsy-market)

*Major cancer conferences this month may announce new findings that could affect available testing options.*`,

    'Academic/Industry': `**Top 5 Liquid Biopsy News – Week of December 5, 2025**

**1. 0.3 ppm LOD95: Has Natera Just Raised the MRD Sensitivity Bar? (Dec 5)**
Natera's $275M upfront ($175M earnouts) acquisition of Foresight consolidates phased variant IP and lymphoma market position. Foresight's PhasED-Seq (LOD95: 0.3 ppm, detection <0.1 ppm) complements Signatera's tumor-informed approach. Strategic rationale: NCCN DLBCL guideline inclusion, 3 prospective MRD-driven trials, 40+ publications. Integration timeline: research use immediate, clinical launch 2026.
[Read more →](https://www.fiercebiotech.com/medtech/natera-buys-foresight-diagnostics-cancer-mrd-deal-worth-450m)

**2. Pre-FDA SPAC at $330M: Is Freenome Overvalued or Underappreciated? (Dec 5)**
$330M SPAC merger (Perceptive Capital) values Freenome's multiomics platform pre-FDA decision. SimpleScreen pivotal data pending; mid-2026 approval expected. PIPE led by Perceptive Advisors and RA Capital with participation from ADAR1, Bain Capital Life Sciences, and Farallon. Post-transaction equity value approximately $1.1B.
[Read more →](https://www.statnews.com/2025/12/05/freenome-plans-go-public-early-cancer-detection/)

**3. ctDNA's Blind Spots: Why cfRNA Is Getting Serious Attention at SABCS (Dec 9-12)**
SERENA-6 ESR1 mutation data catalyzes debate on MRD-adaptive trial designs. Key questions: optimal assay selection (tumor-informed vs. methylation vs. hybrid), timing of intervention, regulatory pathway for response-guided labeling. cfRNA sequencing emerging as complementary modality for transcriptional dynamics ctDNA can't capture.
[Read more →](https://sabcs.org/)

**4. The Adoption Paradox: $5B Market, 26% Guideline Unawareness (Dec 2)**
ResearchAndMarkets projects liquid biopsy market doubles by 2030. Adoption headwinds: IASLC survey shows 26% guideline unawareness, 46% non-CAP/IASLC/AMP adherence. Multi-cancer screening technology driving growth; standardization critical for payer confidence.
[Read more →](https://www.marketsandmarkets.com/Market-Reports/liquid-biopsy-market-13966350.html)

**5. Orthogonal to ctDNA: Can EV Cargo Fill the Detection Gaps? (Dec 2)**
Extracellular vesicle diagnostics gaining traction as orthogonal signal to ctDNA. AI-enabled multiomics (protein, RNA, lipid cargo) addresses ctDNA-low tumor types. Platform players positioning for MCED integration. Market: $91M→$159M by 2030.
[Read more →](https://www.grandviewresearch.com/industry-analysis/liquid-biopsy-market)

*Key data readouts: ASH 2025 (MRD heme), SABCS 2025 (breast MRD), FDA calendar (Shield MCD indication)*`
  };

  const fallbackDigest = fallbackDigests[persona] || fallbackDigests['Clinician'];

  const getPersonaPrompt = (p) => {
    switch(p) {
      case 'Patient':
        return `Write for patients and caregivers. Use clear, accessible language. Avoid jargon or briefly explain technical terms. Focus on practical implications: what tests are becoming available, insurance/cost news, and what this means for patients. Be warm and informative.`;
      case 'Clinician':
        return `Write for oncologists and healthcare providers. Use medical terminology freely. Focus on clinical performance metrics, FDA/regulatory updates, reimbursement decisions, guideline changes (NCCN, ASCO), and clinical trial results. Be direct and professional.`;
      case 'Academic/Industry':
        return `Write for researchers and industry professionals. Focus on M&A activity, technology platform comparisons, market dynamics, investment news, and competitive landscape. Include technical details about assay performance and methodology advances.`;
      default:
        return 'Write balanced summaries covering clinical, business, and research perspectives.';
    }
  };

  const generateDigest = async (forceRefresh = false) => {
    const cacheKey = `openonco_digest_${persona}_v1`;
    const today = new Date().toDateString();
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { text, date, generatedAt } = JSON.parse(cached);
          if (date === today && text) {
            console.log(`NewsFeed: Using cached digest for ${persona}`);
            setDigest(text);
            setLastGenerated(new Date(generatedAt));
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {}
    }

    console.log(`NewsFeed: Generating new digest for ${persona}`);
    setIsLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Search for the latest liquid biopsy, ctDNA, MRD (minimal residual disease), and early cancer detection news from the past week.

${getPersonaPrompt(persona)}

Write a flowing prose digest titled "Top 5 Liquid Biopsy News" with the current week date. For each story:
- Bold headline with date in parentheses
- 3-4 sentence summary paragraph
- End with "Read more:" followed by a link to the source article

IMPORTANT: Make headlines engaging and thought-provoking, not dry announcements. Use questions, surprising angles, or highlight tensions. Examples:
- Instead of "SABCS 2025: ctDNA-Guided Therapy (Dec 9-12)" write "Is ctDNA Enough? cfRNA Emerges as Complementary Signal (Dec 9)"
- Instead of "Natera Acquires Foresight (Dec 5)" write "The MRD Sensitivity Arms Race: Natera's $450M Bet on 0.3 ppm Detection (Dec 5)"
- Instead of "Market Report Shows Growth (Dec 2)" write "Why 26% of Oncologists Still Don't Know MRD Guidelines Exist (Dec 2)"

End with a brief note about upcoming conferences or key things to watch.

Write in a professional but engaging editorial style, like a weekly newsletter digest. Do not use bullet points or numbered lists within the summaries - write in flowing paragraphs.`
          }]
        })
      });

      const data = await response.json();
      
      let text = '';
      for (const block of data.content || []) {
        if (block.type === 'text') {
          text += block.text;
        }
      }

      if (text && text.length > 200) {
        const now = new Date();
        setDigest(text);
        setLastGenerated(now);
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            text,
            date: today,
            generatedAt: now.toISOString()
          }));
        } catch (e) {}
        
        setIsLoading(false);
        return;
      }
      
      throw new Error('Empty response');
    } catch (e) {
      console.error('Digest generation failed:', e);
      setDigest(fallbackDigest);
    }
    
    setIsLoading(false);
  };

  // Generate on mount
  useEffect(() => {
    generateDigest();
  }, []);

  // Regenerate when persona changes
  useEffect(() => {
    if (persona) {
      generateDigest();
    }
  }, [persona]);

  // Smooth vertical scroll - scroll down, reset at halfway (where duplicate starts) for seamless loop
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused || !digest) return;

    let animationId;
    const speed = 0.3;

    const animate = () => {
      // Content is duplicated, so reset when we reach halfway through total height
      const resetPoint = el.scrollHeight / 2;
      
      if (el.scrollTop >= resetPoint) {
        el.scrollTop = 0; // Jump back to start seamlessly
      } else {
        el.scrollTop += speed;
      }
      
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPaused, digest]);

  const personaLabel = {
    'Patient': '👤 Patient Edition',
    'Clinician': '🩺 Clinician Edition', 
    'Academic/Industry': '🔬 Industry Edition'
  };

  // Simple markdown-like rendering for bold text
  const renderDigest = (text) => {
    return text.split('\n').map((line, i) => {
      // First handle links: [text](url)
      const linkParts = line.split(/(\[[^\]]+\]\([^)]+\))/g);
      const withLinks = linkParts.map((part, j) => {
        const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          return (
            <a 
              key={`link-${j}`} 
              href={linkMatch[2]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#2A63A4] hover:text-[#1E4A7A] hover:underline"
            >
              {linkMatch[1]}
            </a>
          );
        }
        return part;
      });
      
      // Then handle bold and italic within non-link parts
      const rendered = withLinks.map((part, j) => {
        if (typeof part !== 'string') return part; // Already a React element (link)
        
        // Bold: **text**
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((bp, k) => {
          if (bp.startsWith('**') && bp.endsWith('**')) {
            return <strong key={`${j}-${k}`} className="font-semibold text-slate-800">{bp.slice(2, -2)}</strong>;
          }
          // Italic: *text*
          if (bp.startsWith('*') && bp.endsWith('*') && !bp.startsWith('**')) {
            return <em key={`${j}-${k}`} className="italic text-slate-500">{bp.slice(1, -1)}</em>;
          }
          return bp;
        });
      });
      
      return line.trim() ? (
        <p key={i} className="mb-4 text-sm text-slate-600 leading-relaxed">
          {rendered}
        </p>
      ) : <div key={i} className="h-2" />;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">Liquid Biopsy News</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {personaLabel[persona] || 'Weekly Digest'}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${
          isLoading ? 'bg-blue-100 text-blue-700' :
          isPaused ? 'bg-amber-100 text-amber-700' : 
          'bg-emerald-100 text-emerald-700'
        }`}>
          {isLoading ? '🔄 Loading...' : isPaused ? '⏸ Paused' : '▶ Scrolling'}
        </span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-[#2A63A4] rounded-full mx-auto mb-3"></div>
            <p className="text-sm text-slate-500">Generating your personalized digest...</p>
          </div>
        </div>
      ) : (
        <>
          <style>{`
            .news-scroll-container::-webkit-scrollbar { display: none; }
          `}</style>
          <div 
            ref={scrollRef}
            className="news-scroll-container flex-1 min-h-0 overflow-y-scroll"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div>
              {renderDigest(digest)}
              {/* Spacer then repeat for seamless loop */}
              <div className="h-8 border-t border-slate-100 mt-4"></div>
              {renderDigest(digest)}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Hover to pause
        </p>
        <p className="text-xs text-slate-400">
          AI-curated daily • {lastGenerated?.toLocaleDateString() || 'Today'}
        </p>
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
    TRM: 'https://docs.google.com/spreadsheets/d/1ZgvK8AgZzZ4XuZEija_m1FSffnnhvIgmVCkQvP1AIXE/edit'
  }
};
// ============================================
// DATA: MRD Tests (from OpenOncoCurrentRelease sheet)
// ============================================

const mrdTestData = [
  {
    "id": "mrd-1",
    "sampleCategory": "Blood/Plasma",
    "name": "Haystack MRD",
    "vendor": "Quest Diagnostics",
    "approach": "Tumor-informed",
    "method": "Whole-genome–derived personalized panel; ~50 variants tracked; low error suppression",
    "cancerTypes": [
      "Multi-solid"
    ],
    "indicationsNotes": "Tumor-informed MRD assay for multiple common and rare solid tumors; Quest/Resolution MRD platform, FDA Breakthrough Device designation.",
    "sensitivity": 95.0,
    "sensitivityCitations": "https://haystackmrd.com/",
    "sensitivityNotes": "Headline 95% sensitivity is analytical; clinical sensitivity by stage not yet published from large prospective cohorts.",
    "sensitivityStagesReported": "Analytical validation (stages not specified)",
    "stageIISensitivity": null,
    "stageIISensitivityNotes": "FDA Breakthrough Device designation specifically for Stage II CRC (Aug 2025); stage-specific clinical sensitivity data expected from ongoing trials.",
    "stageIIISensitivity": null,
    "stageIIISensitivityNotes": "Stage III-specific data not yet published; NCT07125729 head-to-head vs Signatera includes Stage II–IV CRC.",
    "landmarkSensitivityCitations": "https://haystackmrd.com/faq/",
    "longitudinalSensitivityCitations": "https://haystackmrd.com/",
    "lod": "6 ppm",
    "lod95": "6 ppm (≈0.0006% tumor fraction)",
    "lodCitations": "https://haystackmrd.com/",
    "lodNotes": "LoD95 (95% limit of detection) is ~6 ppm (0.0006% tumor fraction). This represents the ctDNA level at which 95% of replicates are detected as positive in analytical validation studies.",
    "requiresTumorTissue": "Yes",
    "requiresMatchedNormal": "Yes",
    "variantsTracked": "50",
    "variantsTrackedNotes": "Up to ~50 tumor-specific variants selected from tumor and matched-normal whole-exome sequencing; variants filtered to avoid CHIP-associated regions.",
    "initialTat": 30.0,
    "initialTatNotes": "Baseline tumor+normal whole-exome profiling and panel design typically ~4 weeks (~30 days) from sample receipt.",
    "followUpTat": 7.0,
    "followUpTatNotes": "Post-baseline MRD blood draws generally reported within about 5–7 days (Quest/Haystack FAQs; Quest Q&A sometimes quotes 7–10 days).",
    "bloodVolume": 30.0,
    "bloodVolumeNotes": "Quest test directory for Haystack MRD monitoring lists three 10 mL cfDNA tubes (≈30 mL total) as standard collection; minimum acceptable volume ~24 mL.",
    "tat": 30.0,
    "tatNotes": "Overall paradigm: ~4 weeks for initial panel build, ~1 week for subsequent MRD timepoints.",
    "fdaStatus": "CLIA LDT (Quest Diagnostics); FDA Breakthrough Device designation for stage II colorectal cancer (Aug 2025).",
    "reimbursement": "Coverage emerging (~70% of tests reimbursed); Medicare pilot for CRC plus growing commercial coverage.",
    "reimbursementNote": "As of mid-2025, Quest reports ~70% of Haystack MRD tests are reimbursed across payers. Medicare pilot coverage in place for CRC, with active engagement with CMS for broader LCD. Commercial payer coverage growing; patient access programs available.",
    "cptCodes": "0561U",
    "clinicalAvailability": "Clinical LDT – shipping",
    "clinicalTrials": "NCT07125729 (150; resectable stage II–IV CRC; Haystack vs Signatera head-to-head); NCT06979661 (25; MRD-PORT trial; post-op stage II–III NSCLC; Haystack MRD-guided RT); NCT05798663/AFT-57 (158; unresectable stage III NSCLC; atezolizumab ± tiragolumab CRT; Haystack MRD used for correlative MRD analyses)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT07125729 | https://clinicaltrials.gov/study/NCT06979661 | https://clinicaltrials.gov/study/NCT05798663",
    "totalParticipants": 333,
    "numPublications": 17
  },
  {
    "id": "mrd-2",
    "sampleCategory": "Blood/Plasma",
    "name": "NeXT Personal Dx",
    "vendor": "Personalis",
    "approach": "Tumor-informed",
    "method": "Tumor-informed, whole-genome-based MRD assay: WGS of tumor and matched normal identifies up to ~1,800 patient-specific variants, which are tracked at high depth in plasma to detect ctDNA down to ~1–3 parts per million (ppm).",
    "cancerTypes": [
      "Breast",
      "Colorectal",
      "NSCLC"
    ],
    "indicationsNotes": "Personalis NeXT Personal Dx tumor-informed MRD assay. Medicare-covered for early-stage breast cancer recurrence monitoring; clinical data also reported in colorectal cancer and NSCLC.",
    "sensitivity": null,
    "sensitivityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "sensitivityNotes": "Reported as 100% sensitivity in validation cohort (n=493); insufficient data for population-level estimates. Value set to null to avoid misleading comparisons.",
    "sensitivityStagesReported": "Not separately reported (small validation cohort)",
    "stageIISensitivity": null,
    "stageIISensitivityNotes": "Stage-specific sensitivity not reported; validation cohort too small for stage breakdown.",
    "stageIIISensitivity": null,
    "stageIIISensitivityNotes": "Stage-specific sensitivity not reported.",
    "specificity": null,
    "specificityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "specificityNotes": "Reported as 100% specificity in validation cohort (n=493); insufficient data for population-level estimates. Value set to null to avoid misleading comparisons.",
    "longitudinalSensitivity": null,
    "longitudinalSensitivityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "longitudinalSensitivityNotes": "Reported as 100% in validation cohort; value set to null pending larger studies.",
    "longitudinalSpecificity": null,
    "longitudinalSpecificityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "longitudinalSpecificityNotes": "Reported as 100% in validation cohort; value set to null pending larger studies.",
    "lod": "1.67 ppm",
    "lod95": "3.45 ppm",
    "lodCitations": "Northcott et al. Oncotarget 2024; Personalis NeXT Personal Dx analytical validation brochure.",
    "lodNotes": "Detection threshold is 1.67 ppm; LOD95 (95% confidence) is 3.45 ppm. The gap between these values means serial testing can catch lower-level disease.",
    "leadTimeVsImaging": 450.0,
    "leadTimeVsImagingCitations": "Garcia-Murillas et al. Ann Oncol 2025; TRACERx NSCLC data.",
    "leadTimeVsImagingNotes": "450 days (15 months) is the median lead time from the Garcia-Murillas et al. Ann Oncol 2025 early-stage breast cancer cohort (range 0.9-61.5 months). This is the median from this specific study, not a universal NeXT median across all indications. NSCLC TRACERx data showed ~6 months.",
    "vendorRequestedChanges": "2025-12-03: Personalis requested lead time update to 15 months (450 days) based on Ann Oncol 2025 breast cancer paper (Garcia-Murillas et al.). Verified against source and updated.",
    "requiresTumorTissue": "Yes",
    "requiresMatchedNormal": "Yes",
    "variantsTracked": "1800",
    "variantsTrackedNotes": "Personalized panels track on the order of 1,800 tumor-specific variants per patient based on tumor/normal whole-genome sequencing, with additional investigational content in some implementations.",
    "initialTat": 35.0,
    "initialTatNotes": "Personalis materials state that initial tissue profiling and panel design take approximately 4–5 weeks from receipt of tumor and normal samples.",
    "followUpTat": 12.0,
    "followUpTatNotes": "Subsequent MRD blood tests are typically reported within about 10–14 days after sample receipt.",
    "bloodVolume": 20.0,
    "bloodVolumeNotes": "Monitoring commonly uses two 10 mL Streck cfDNA tubes (≈20 mL total); baseline also requires FFPE tumor tissue and matched-normal blood.",
    "tat": 35.0,
    "tatNotes": "Overall paradigm: ~4–5 weeks for initial panel creation, ~2 weeks for follow-up MRD timepoints.",
    "fdaStatus": "CLIA LDT (early access / clinical offering)",
    "reimbursement": "Medicare coverage for stage II-III breast cancer MRD surveillance; additional solid tumor coverage via Tempus xM collaboration expanding.",
    "cptCodes": "MolDX with DEX Z-code",
    "clinicalAvailability": "Clinical LDT – shipping (initial market availability)",
    "exampleTestReport": "https://www.personalis.com/wp-content/uploads/2024/07/NeXT-Personal-Dx-Clinical-Report-Template-DOC-002568B.pdf",
    "clinicalTrials": "NCT06230185 (422); VICTORI study interim cohort (~71)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT06230185",
    "totalParticipants": 493,
    "numPublications": 4,
    "numPublicationsPlus": true
  },
  {
    "id": "mrd-3",
    "sampleCategory": "Blood/Plasma",
    "name": "Oncodetect",
    "vendor": "Exact Sciences",
    "approach": "Tumor-informed",
    "method": "Tumor-informed hybrid-capture ctDNA assay: tumor plus matched-normal sequencing to select up to ~200 somatic variants per patient, followed by targeted hybrid-capture NGS with CHIP-aware filtering.",
    "cancerTypes": [
      "Multi-solid"
    ],
    "indicationsNotes": "Exact Sciences Oncodetect tumor-informed circulating tumor DNA (ctDNA) MRD test, marketed for use across solid tumors; designed for post-surgical and surveillance use cases.",
    "sensitivity": 91.0,
    "sensitivityCitations": "https://investor.exactsciences.com/investor-relations/press-releases/press-release-details/2025/New-Evidence-Validates-Oncodetects-Ability-to-Detect-Molecular-Residual-Disease-and-Predict-Recurrence-in-Colorectal-Cancer-Patients/default.aspx",
    "sensitivityNotes": "In CRC, results from Alpha-CORRECT, a study with one of the longest MRD surveillance monitoring periods to date, showed the Oncodetect test achieved 78% sensitivity at the post-surgical timepoint and 91% sensitivity during the surveillance monitoring period, with specificities of 80% and 94%, respectively.",
    "sensitivityStagesReported": "Stage II–III combined (CRC)",
    "stageIISensitivity": null,
    "stageIISensitivityNotes": "Stage II-specific CRC sensitivity not separately reported in Alpha-CORRECT publications; combined with Stage III. Stage-specific breakdowns would be informative for treatment decisions.",
    "stageIIISensitivity": null,
    "stageIIISensitivityNotes": "Alpha-CORRECT cohort primarily Stage III CRC; stage-specific breakdown not published.",
    "stageDataExpected": true,
    "specificity": 94.0,
    "specificityCitations": "https://investor.exactsciences.com/investor-relations/press-releases/press-release-details/2025/New-Evidence-Validates-Oncodetects-Ability-to-Detect-Molecular-Residual-Disease-and-Predict-Recurrence-in-Colorectal-Cancer-Patients/default.aspx",
    "specificityNotes": "In CRC (Alpha-CORRECT study), Oncodetect demonstrated specificities of 80% at the post-surgical timepoint and 94% during surveillance monitoring.",
    "ppv": 50.0,
    "ppvNotes": "CRC postsurgical 3y PPV 50% (Alpha-/Beta-CORRECT).",
    "npv": 96.0,
    "npvNotes": "CRC postsurgical 3y NPV 96%.",
    "landmarkSensitivity": 78.0,
    "landmarkSensitivityNotes": "CRC postsurgical sensitivity.",
    "landmarkSpecificity": 80.0,
    "longitudinalSensitivity": 91.0,
    "longitudinalSensitivityCitations": "https://investor.exactsciences.com/investor-relations/press-releases/press-release-details/2025/New-Evidence-Validates-Oncodetects-Ability-to-Detect-Molecular-Residual-Disease-and-Predict-Recurrence-in-Colorectal-Cancer-Patients/default.aspx",
    "longitudinalSensitivityNotes": "CRC surveillance sensitivity.",
    "longitudinalSpecificity": 94.0,
    "longitudinalSpecificityCitations": "https://investor.exactsciences.com/investor-relations/press-releases/press-release-details/2025/New-Evidence-Validates-Oncodetects-Ability-to-Detect-Molecular-Residual-Disease-and-Predict-Recurrence-in-Colorectal-Cancer-Patients/default.aspx",
    "longitudinalSpecificityNotes": "CRC surveillance specificity.",
    "lod": null,
    "lod95": "15 ppm",
    "lodNotes": "LoD95 of 15 ppm per Exact Sciences analytical validation whitepaper. Detection threshold not separately disclosed.",
    "lodCitations": "Exact Sciences Oncodetect LoD whitepaper; ASCO data presentations.",
    "leadTimeVsImaging": 317.0,
    "leadTimeVsImagingNotes": "Median lead time ~10.4 months (~317 days) from first MRD-positive Oncodetect result to radiologic recurrence in the α-CORRECT stage III CRC cohort. This is the median from this specific study, not a universal value across all indications.",
    "leadTimeVsImagingCitations": "Exact Sciences α-CORRECT press release; J Surg Oncol/JCO presentations.",
    "requiresTumorTissue": "Yes",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "White paper: WES tumor + matched-normal buffy coat.",
    "variantsTracked": "200",
    "variantsTrackedNotes": "Panel tracks up to 200 tumor-specific variants per patient (median ~170) with roadmap to higher-plex designs.",
    "initialTat": 28.0,
    "initialTatNotes": "Provider-facing materials describe baseline tissue+normal discovery and panel creation in roughly 4 weeks.",
    "followUpTat": 10.0,
    "followUpTatNotes": "Monitoring blood draws typically result within about 10 days after sample receipt.",
    "bloodVolumeNotes": "3 LBgard cfDNA tubes required for blood draw; tissue required at baseline",
    "tat": 28.0,
    "tatNotes": "Approximate baseline TAT ~4 weeks; subsequent MRD timepoints ~10 days.",
    "fdaStatus": "CLIA LDT",
    "reimbursement": "Medicare (CRC only)",
    "reimbursementNote": "Medicare MolDX coverage for colorectal cancer MRD only (announced July 2025). Not covered for other cancer types. Broader payer adoption evolving.",
    "cptCodes": "PLA pending",
    "cptCodesNotes": "Payer policies vary.",
    "clinicalAvailability": "Clinical LDT – shipping",
    "independentValidation": "Yes",
    "independentValidationNotes": "Prospective Alpha-/Beta-CORRECT CRC cohorts.",
    "exampleTestReport": "https://www.exactsciences.com/-/media/project/headless/one-exact-web/documents/products-services/oncodetect/providers/sample-report-stage-iii-escalation.pdf?rev=10365d7a28c8467eb25d253943ce8fe9",
    "clinicalTrials": "NCT06398743 (416); α-CORRECT observational study (124)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT06398743",
    "totalParticipants": 540,
    "numPublications": 1,
    "numPublicationsPlus": true
  },
  {
    "id": "mrd-4",
    "sampleCategory": "Blood/Plasma",
    "name": "Pathlight",
    "vendor": "SAGA Diagnostics",
    "approach": "Tumor-informed",
    "method": "Tumor-informed MRD platform using whole-genome profiling to identify structural variants (SVs) and other truncal events, which are then tracked using sensitive digital PCR and/or NGS in serial plasma samples.",
    "cancerTypes": [
      "Breast",
      "Multi-solid"
    ],
    "indicationsNotes": "SAGA Diagnostics Pathlight tumor-informed MRD assay. Medicare coverage announced for breast cancer across all subtypes (HR+/HER2-, HER2+, and triple-negative); platform positioned as multi-cancer MRD.",
    "sensitivity": null,
    "sensitivityCitations": "https://sagadiagnostics.com/saga-diagnostics-announces-u-s-commercial-launch/",
    "sensitivityNotes": "Reported as 100% sensitivity in small validation cohort (n=100, TRACER study) per Medicare coverage decision. Value set to null pending larger validation studies.",
    "specificity": null,
    "specificityCitations": "https://sagadiagnostics.com/saga-diagnostics-announces-u-s-commercial-launch/",
    "specificityNotes": "Reported as 100% specificity in small validation cohort (n=100, TRACER study) per Medicare coverage decision. Value set to null pending larger validation studies.",
    "landmarkSensitivity": null,
    "landmarkSpecificity": null,
    "longitudinalSensitivity": null,
    "longitudinalSensitivityCitations": "https://sagadiagnostics.com/saga-diagnostics-announces-u-s-commercial-launch/",
    "longitudinalSensitivityNotes": "Reported as 100% in small breast cohort (n=100); value set to null pending larger validation.",
    "longitudinalSpecificity": null,
    "longitudinalSpecificityCitations": "https://sagadiagnostics.com/saga-diagnostics-announces-u-s-commercial-launch/",
    "longitudinalSpecificityNotes": "Reported as 100% in small breast cohort (n=100); value set to null pending larger validation.",
    "lod": null,
    "lod95": "~5 ppm",
    "lodNotes": "SAGA materials describe an LoD95 on the order of 5 ppm in analytical studies of SV-based assays. Detection threshold not separately disclosed.",
    "leadTimeVsImaging": 411.0,
    "leadTimeVsImagingCitations": "https://sagadiagnostics.com/saga-diagnostics-announces-u-s-commercial-launch/",
    "leadTimeVsImagingNotes": "Early-stage breast cancer cohort data highlight median lead time ≈13.7 months (~411 days) between MRD positivity and clinical/radiologic recurrence.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Tumor-informed (WGS of tumor); structural variants tracked by dPCR.",
    "requiresMatchedNormal": "Yes",
    "tat": 28.0,
    "tatNotes": "Initial tumor profiling and personalized assay build typically reported in ~3–4 weeks; subsequent blood tests often return in ~3–5 days in published experience.",
    "fdaStatus": "CLIA LDT (US) with international laboratory service offerings.",
    "reimbursement": "Medicare coverage for early-stage breast cancer; additional coverage emerging.",
    "reimbursementNote": "CMS coverage established for Pathlight MRD in early-stage breast cancer across all subtypes (2025); other indications and payers evolving.",
    "cptCodes": "No dedicated PLA as of 2025; payer-specific coding applies.",
    "cptCodesNotes": "Contact vendor for current billing guidance.",
    "clinicalAvailability": "Clinical LDT – shipping (select geographies)",
    "clinicalTrials": "TRACER study (cTdna evaluation in eaRly breAst canCER); 100 patients with stage I–III breast cancer of all subtypes; Clinical Cancer Research, Jan 2025",
    "totalParticipants": 100,
    "numPublications": 8,
    "numPublicationsPlus": true
  },
  {
    "id": "mrd-5",
    "sampleCategory": "Blood/Plasma",
    "name": "RaDaR ST",
    "vendor": "NeoGenomics",
    "approach": "Tumor-informed",
    "method": "Tumor-informed MRD assay on the InVision/ RaDaR platform: tumor and matched-normal sequencing identify up to 48 variants, which are tracked by deep NGS with error suppression.",
    "cancerTypes": [
      "Breast",
      "Head & Neck",
      "Multi-solid"
    ],
    "indicationsNotes": "NeoGenomics RaDaR ST tumor-informed MRD assay with Medicare coverage for HR+/HER2- breast cancer (including late recurrence >5 years) and HPV-negative head and neck cancer; supportive data across multiple solid tumors.",
    "sensitivity": 95.7,
    "sensitivityCitations": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10870111/",
    "sensitivityNotes": "RaDaR ST demonstrated 97% concordance and maintained equivalent sensitivity with RaDaR 1.0. In breast, 95.7% sensitivity and 91.0% specificity.",
    "specificity": 91.0,
    "specificityCitations": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10870111/",
    "specificityNotes": "RaDaR ST demonstrated 97% concordance with RaDaR 1.0. In breast cancer validation, specificity was 91.0%.",
    "lod": "~10 ppm",
    "lodCitations": "https://ir.neogenomics.com/news-events/press-releases/detail/310/neogenomics-to-present-radar-st-bridging-study-at-islb-2025-demonstrating-reliable-mrd-detection-across-solid-tumors",
    "lodNotes": "Analytical validation for the RaDaR assay supports reliable detection around 10 ppm with ≥70–90% sensitivity at that level in contrived samples.",
    "requiresTumorTissue": "Yes",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Buffy coat matched normal used for germline filtering in studies.",
    "variantsTracked": "48",
    "variantsTrackedNotes": "Tracks up to 48 patient-specific variants.",
    "initialTat": 35.0,
    "initialTatNotes": "NeoGenomics materials typically describe baseline discovery and panel build in ~5 weeks.",
    "followUpTat": 7.0,
    "followUpTatNotes": "Serial MRD monitoring blood draws generally reported within ~7 days after receipt.",
    "tat": 35.0,
    "tatNotes": "Approximate TAT ~5 weeks baseline, ~1 week longitudinally.",
    "fdaStatus": "CLIA LDT",
    "reimbursement": "Medicare coverage for selected indications; MolDX framework applied.",
    "reimbursementNote": "LCDs describe coverage in specific solid tumors (e.g., breast and HPV-negative head & neck cancer) with broader multi-tumor positioning in trials.",
    "commercialPayers": ["Blue Shield of California"],
    "commercialPayersCitations": "https://www.decibio.com/",
    "commercialPayersNotes": "Blue Shield of California covers RaDaR for MRD testing. Coverage continues to expand as clinical evidence builds.",
    "cptCodes": "PLA under consideration.",
    "cptCodesNotes": "Contact vendor for current billing guidance.",
    "clinicalAvailability": "Clinical LDT – shipping",
    "clinicalTrials": "ISLB 2025 bridging study, 'Performance Comparison of RaDaR 1.0 and RaDaR ST Assays for Circulating Tumor DNA Detection Across Solid Tumor Types'; 166 patients across 15 solid tumor types; 97% concordance with RaDaR 1.0",
    "totalParticipants": 166,
    "numPublications": 10,
    "numPublicationsPlus": true
  },
  {
    "id": "mrd-6",
    "sampleCategory": "Blood/Plasma",
    "name": "Reveal",
    "vendor": "Guardant",
    "approach": "Tumor-naïve",
    "method": "Tumor-naïve, blood-only ctDNA MRD test that integrates variant-based and methylation/epigenomic signals to detect residual disease and recurrence without requiring tumor tissue.",
    "cancerTypes": [
      "Colorectal"
    ],
    "indicationsNotes": "Guardant Reveal tumor-naïve ctDNA MRD test with Medicare coverage for colorectal cancer (CRC) post-surgery and surveillance after curative-intent treatment.",
    "sensitivity": 81.0,
    "sensitivityCitations": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11443202/",
    "sensitivityNotes": "COSMOS 2024 longitudinal sensitivity for stage II+ CRC is ~81%. Earlier landmark/Reinert 2021 data showed 55-63% sensitivity. Headline value reflects current COSMOS longitudinal performance.",
    "sensitivityStagesReported": "Stage II–IV combined",
    "stageIISensitivity": null,
    "stageIISensitivityNotes": "Stage II-specific sensitivity not separately reported; combined with stages III–IV in headline figures. Stage-specific data would help clinicians counsel Stage II patients.",
    "stageIIISensitivity": null,
    "stageIIISensitivityNotes": "Stage III-specific sensitivity not separately reported.",
    "stageDataExpected": true,
    "specificity": 98.0,
    "specificityCitations": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11443202/",
    "specificityNotes": "COSMOS 2024 longitudinal specificity is 98% for CRC. Earlier landmark data showed 100% specificity but with serial/longitudinal testing, 91-98% is more representative.",
    "landmarkSensitivity": 63.0,
    "landmarkSensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/33926918/",
    "landmarkSensitivityNotes": "CRC landmark sensitivity (stage II–III).",
    "landmarkSpecificity": 98.0,
    "landmarkSpecificityCitations": "https://pubmed.ncbi.nlm.nih.gov/33926918/",
    "landmarkSpecificityNotes": "CRC landmark specificity (stage II–III); updated from 100% to align with longitudinal data.",
    "longitudinalSensitivity": 81.0,
    "longitudinalSensitivityCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2024/Guardant-Health-COSMOS-Study-Published-in-Clinical-Cancer-Research-Validates-Utility-of-Guardant-Reveal-Liquid-Biopsy-Test-for-Predicting-Recurrence-in-Colorectal-Cancer/default.aspx",
    "longitudinalSpecificity": 98.0,
    "longitudinalSpecificityCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2024/Guardant-Health-COSMOS-Study-Published-in-Clinical-Cancer-Research-Validates-Utility-of-Guardant-Reveal-Liquid-Biopsy-Test-for-Predicting-Recurrence-in-Colorectal-Cancer/default.aspx",
    "lodNotes": "Guardant has not published a single universal LoD value for Reveal; internal data suggest detection of very low VAF ctDNA (well below 0.1%), but performance is study- and context-dependent, so no single number is encoded here.",
    "leadTimeVsImaging": 159.0,
    "leadTimeVsImagingCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2024/Guardant-Health-COSMOS-Study-Published-in-Clinical-Cancer-Research-Validates-Utility-of-Guardant-Reveal-Liquid-Biopsy-Test-for-Predicting-Recurrence-in-Colorectal-Cancer/default.aspx",
    "leadTimeVsImagingNotes": "CRC median 4.77 months from MRD+ to recurrence.",
    "requiresTumorTissue": null,
    "requiresTumorTissueNotes": "Plasma-only (tissue-free) MRD assay; tumor tissue is not required for panel design.",
    "requiresMatchedNormal": null,
    "requiresMatchedNormalNotes": "Does not require a matched-normal blood sample.",
    "initialTat": 7.0,
    "initialTatCitations": "https://www.guardanthealth.com/solutions/guardant-reveal/",
    "initialTatNotes": "Vendor-reported 7-day median TAT.",
    "followUpTat": 7.0,
    "followUpTatCitations": "https://www.guardanthealth.com/solutions/guardant-reveal/",
    "followUpTatNotes": "Vendor-reported 7-day median TAT.",
    "bloodVolume": 20.0,
    "bloodVolumeCitations": "https://www.guardanthealth.com/solutions/guardant-reveal/",
    "bloodVolumeNotes": "Commonly collected as two 10 mL Streck cfDNA tubes (≈20 mL).",
    "tat": 7.0,
    "tatCitations": "https://www.guardanthealth.com/solutions/guardant-reveal/",
    "tatNotes": "Guardant reports a typical ~7-day turnaround from sample receipt for Reveal.",
    "fdaStatus": "CLIA LDT; not FDA cleared/approved as of 2025.",
    "reimbursement": "Medicare (CRC only)",
    "reimbursementNote": "Medicare MolDX coverage for colorectal cancer MRD only - post-surgical and surveillance settings after curative-intent treatment. Not covered for other cancer types. Commercial coverage expanding via select BCBS plans.",
    "commercialPayers": ["BCBS Louisiana", "Geisinger Health Plan"],
    "commercialPayersCitations": "https://www.businesswire.com/news/home/20230720806084/en/Guardant-Health-receives-first-commercial-payor-coverage-for-Guardant-Reveal%E2%84%A2-test-from-Blue-Cross-and-Blue-Shield-of-Louisiana/",
    "commercialPayersNotes": "Blue Cross Blue Shield of Louisiana became first commercial payer to cover Guardant Reveal in July 2023. Geisinger Health Plan added coverage later in 2023. Additional BCBS plans (including BCBS Massachusetts) appear to have medical policies; verify with specific plan.",
    "cptCodes": "0569U (Guardant Reveal PLA code from mid-2025).",
    "cptCodesNotes": "Guardant Reveal PLA (2025).",
    "availableRegions": ["US"],
    "clinicalAvailability": "Clinical LDT – shipping",
    "exampleTestReport": "https://learn.colontown.org/wp-content/uploads/2022/01/Reveal-Sample-Report_postsurgery-positive-2-v2.pdf",
    "clinicalTrials": "NCCTG N0147 adjuvant FOLFOX trial (>2000; Guardant Reveal ctDNA analysis)",
    "totalParticipants": 2000,
    "numPublications": 10,
    "numPublicationsPlus": true
  },
  {
    "id": "mrd-7",
    "sampleCategory": "Blood/Plasma",
    "name": "Signatera",
    "vendor": "Natera",
    "approach": "Tumor-informed",
    "method": "Tumor-informed, multiplex PCR–NGS ctDNA assay: tumor and matched-normal WES identify personal SNVs, and a 16-variant (or higher in newer versions) customized panel is tracked in serial plasma at high depth.",
    "cancerTypes": [
      "Colorectal",
      "Breast",
      "Bladder",
      "NSCLC",
      "Ovarian/Fallopian/Primary peritoneal",
      "Pan-solid ICI"
    ],
    "indicationsNotes": "Natera Signatera tumor-informed MRD assay with Medicare coverage for multiple solid-tumor indications: CRC (stage II–IV & oligometastatic, adjuvant & recurrence), breast cancer (neoadjuvant and stage IIb+ adjuvant & recurrence), bladder cancer (MIBC), NSCLC (stage I–III surveillance), and ovarian/fallopian/primary peritoneal cancer (adjuvant & recurrence), plus pan-solid tumor immune-checkpoint inhibitor (ICI) response monitoring.",
    "sensitivity": 94.0,
    "sensitivityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "sensitivityNotes": "Recurrence Surveillance: CRC: 88-93% sens., 98% spec. Breast: 88-89% sens., 95-99% spec. Lung: 80-99% sens., 96-99% spec. Bladder: 99% sens., 98% spec. Ovarian: 99% sens.",
    "sensitivityStagesReported": "Stage II–IV combined (varies by cancer type)",
    "stageIISensitivity": null,
    "stageIISensitivityNotes": "CRC Stage II landmark ~65-73% in CIRCULATE-Japan; longitudinal higher. Stage II not separately reported for other cancer types. Stage-specific breakdowns would help inform treatment decisions.",
    "stageIIISensitivity": null,
    "stageIIISensitivityNotes": "Stage III typically shows higher sensitivity than Stage II due to higher tumor burden; specific values combined with other stages in most publications.",
    "stageDataExpected": true,
    "specificity": 98.0,
    "specificityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "specificityNotes": "Specificity ranges by cancer type: CRC 98%, Breast 95-99%, Lung 96-99%, Bladder 98%. Headline value of 98% reflects typical performance across indications.",
    "ppv": 98.0,
    "ppvCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "ppvNotes": "Overall PPV >98% (vendor, multi-tumor).",
    "npv": 96.0,
    "npvCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "npvNotes": "NSCLC distant/extracranial single timepoint NPV.",
    "landmarkSensitivity": 75.0,
    "landmarkSensitivityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "landmarkSensitivityNotes": "NSCLC distant/extracranial single timepoint sensitivity.",
    "longitudinalSensitivity": 94.0,
    "longitudinalSensitivityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "longitudinalSensitivityNotes": "NSCLC distant/extracranial longitudinal sensitivity.",
    "longitudinalSpecificity": 98.0,
    "longitudinalSpecificityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "longitudinalSpecificityNotes": "Longitudinal specificity across cancer types ranges 96-99%; 98% represents typical performance.",
    "lod": "~0.01% VAF",
    "lodCitations": "https://www.natera.com/oncology/signatera-mrd-test/",
    "lodNotes": "Natera reports analytical sensitivity to ~0.01% tumor fraction with high specificity using integrated digital error suppression.",
    "leadTimeVsImaging": 300.0,
    "leadTimeVsImagingCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "leadTimeVsImagingNotes": "Ovarian ~10 months; NSCLC >7 months earlier than imaging.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Tumor-informed; needs primary tumor tissue.",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Matched normal blood required.",
    "variantsTracked": "16",
    "variantsTrackedNotes": "Original commercial design tracks 16 somatic variants per patient; some research/“Genome” configurations track more (e.g., 64) but 16 remains the standard clinical panel.",
    "variantsTrackedCitations": "https://www.natera.com/oncology/signatera-mrd-test/",
    "initialTat": 28.0,
    "initialTatNotes": "Baseline tumor/normal sequencing and panel design typically require ~3–4 weeks.",
    "initialTatCitations": "https://www.natera.com/oncology/signatera-mrd-test/",
    "followUpTat": 9.0,
    "followUpTatNotes": "Longitudinal MRD blood draws generally reported within ~7–10 days.",
    "followUpTatCitations": "https://www.natera.com/oncology/signatera-mrd-test/",
    "bloodVolume": 20.0,
    "bloodVolumeNotes": "Commonly two Streck cfDNA tubes (~10 mL each) for monitoring; tissue + matched normal required at baseline",
    "bloodVolumeCitations": "https://www.natera.com/oncology/signatera-mrd-test/",
    "tat": 28.0,
    "tatNotes": "Overall paradigm: ~4 weeks for initial build, ~1–1.5 weeks for follow-up tests.",
    "fdaStatus": "CLIA LDT; not FDA-cleared/approved as of late 2025 (clinical validation via numerous peer-reviewed studies).",
    "reimbursement": "Medicare (CRC, Breast, Bladder, NSCLC, Ovarian, ICI)",
    "reimbursementNote": "Medicare MolDX coverage for: CRC (stage II-IV, oligometastatic), breast cancer (neoadjuvant, stage IIb+ adjuvant/recurrence), bladder (MIBC), NSCLC (stage I-III surveillance), ovarian/fallopian/peritoneal, and pan-solid ICI response monitoring. ADLT pricing. Coverage varies by indication - verify specific cancer type with payer.",
    "commercialPayers": ["UnitedHealthcare", "Cigna", "Anthem BCBS", "BCBS Louisiana", "Blue Shield of California"],
    "commercialPayersCitations": "https://www.natera.com/oncology/billing/",
    "commercialPayersNotes": "Natera is in-network with most major health plans including Cigna, UnitedHealthcare, and Blue Shield of California. BCBS Louisiana provides explicit coverage. Note: Aetna lists Signatera codes as in-network but current policies show non-covered; verify with plan.",
    "cptCodes": "0340U (ADLT)",
    "cptCodesNotes": "Signatera PLA (ADLT pricing).",
    "availableRegions": ["US", "EU", "UK", "International"],
    "clinicalAvailability": "Clinical LDT – shipping",
    "independentValidation": "Yes",
    "independentValidationNotes": "Multiple peer-reviewed and prospective studies across tumors.",
    "exampleTestReport": "https://www.natera.com/resource-library/signatera/signatera-patient-test-sample-report/",
    "clinicalTrials": "BESPOKE CRC (NCT04264702); multicentre prospective observational study of ~2,000 stage I–IV colorectal cancer patients at up to 200 U.S. sites (MRD and surveillance cohorts)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT04264702",
    "totalParticipants": 2000,
    "numPublications": 100,
    "numPublicationsPlus": true
  },
  {
    "id": "mrd-8",
    "sampleCategory": "Blood/Plasma",
    "name": "Tempus xM MRD",
    "vendor": "Tempus",
    "approach": "Tumor-naïve",
    "method": "Tumor-naïve MRD assay that combines variant-based ctDNA detection with methylation/fragmentomics signals in a dual-workflow, blood-only design; current clinical positioning focuses on colorectal cancer.",
    "cancerTypes": [
      "Colorectal"
    ],
    "indicationsNotes": "Tempus xM tumor-naïve MRD assay currently marketed for colorectal cancer, with coverage and data focused on CRC; separate Tempus xM (NeXT Personal Dx) tumor-informed offering for solid tumors, including breast.",
    "landmarkSensitivity": 61.1,
    "landmarkSensitivityNotes": "CRC landmark sensitivity from GALAXY (CIRCULATE-Japan) subset analysis of 80 resected stage II-III colorectal cancer patients.",
    "landmarkSensitivityCitations": "Tempus BusinessWire press release May 2024; GALAXY/CIRCULATE-Japan CRC cohort data.",
    "landmarkSpecificity": 94.0,
    "landmarkSpecificityNotes": "CRC landmark specificity from GALAXY (CIRCULATE-Japan) subset analysis.",
    "landmarkSpecificityCitations": "Tempus BusinessWire press release May 2024; GALAXY/CIRCULATE-Japan CRC cohort data.",
    "longitudinalSensitivity": 83.3,
    "longitudinalSensitivityCitations": "https://www.businesswire.com/news/home/20240531484360/en/Tempus-Announces-the-Clinical-Launch-of-its-MRD-Testing-Portfolio",
    "longitudinalSpecificity": 89.5,
    "longitudinalSpecificityCitations": "https://www.businesswire.com/news/home/20240531484360/en/Tempus-Announces-the-Clinical-Launch-of-its-MRD-Testing-Portfolio",
    "lodNotes": "Tempus has published performance at very low ctDNA levels in colorectal cancer trials (e.g., CIRCULATE-Japan) but does not advertise a single, assay-wide LoD figure; numeric field left blank.",
    "requiresTumorTissue": null,
    "requiresMatchedNormal": null,
    "initialTatNotes": "Tempus positions xM as having a relatively rapid turnaround because tumor tissue is not required; detailed baseline TAT figures are not consistently disclosed, so no single value is encoded.",
    "followUpTatNotes": "Public materials emphasize rapid repeat testing from blood-only workflows; specific day counts vary by context and are not standardized in a single published metric.",
    "bloodVolume": 17.0,
    "bloodVolumeCitations": "https://www.tempus.com/wp-content/uploads/2024/01/Tempus-LS_xM-RUO-Overview.pdf",
    "bloodVolumeNotes": "RUO specimen overview describes two 8.5 mL Streck cfDNA tubes (~17 mL total) per timepoint.",
    "tatNotes": "Overall TAT is marketed as faster than tumor-informed assays due to avoiding tissue sequencing, but a precise canonical value is not available.",
    "fdaStatus": "CLIA LDT (for clinical xM portfolio) with RUO offering for biopharma; not FDA cleared/approved as of 2025.",
    "reimbursement": "Coverage emerging; verify payer-specific policies.",
    "reimbursementNote": "xM MRD is newer than some competitors; commercial and Medicare coverage are evolving and may currently be more limited than for Signatera or Guardant Reveal.",
    "cptCodes": "Contact vendor for current billing guidance.",
    "clinicalAvailability": "Clinical LDT – shipping for colorectal cancer; RUO version also available via Tempus Life Sciences.",
    "clinicalTrials": "GALAXY (CIRCULATE-Japan) subset analysis; 80 resected stage II–III colorectal cancer patients randomly selected and enriched for recurrence; Tempus xM tumor-naïve MRD assay with methylation + variant classifiers",
    "totalParticipants": 80,
    "numPublications": 3,
    "numPublicationsPlus": true
  },
  {
    "id": "mrd-9",
    "sampleCategory": "Blood/Plasma",
    "name": "Labcorp Plasma Detect",
    "vendor": "Labcorp",
    "approach": "Tumor-informed",
    "method": "Tumor-informed whole-genome sequencing (WGS) ctDNA MRD assay: WGS of tumor tissue, buffy coat (germline) and plasma at a landmark time point is used with a proprietary machine-learning pipeline to identify thousands of high-confidence, patient-specific somatic variants (median ~5000 SNVs), which are then tracked longitudinally in cell-free DNA without bespoke panel design.",
    "cancerTypes": [
      "Stage III colon cancer; multi-solid (RUO clinical trials)"
    ],
    "indicationsNotes": "Clinically validated for post-surgery and post-adjuvant MRD assessment in stage III colon cancer (PROVENC3); Labcorp also positions Plasma Detect for broader solid tumor MRD applications in translational research and drug development.",
    "specificity": 99.4,
    "specificityCitations": "https://oncology.labcorp.com/biopharma-partners/plasma-detect",
    "specificityNotes": "Analytical specificity ~99.4% for ctDNA-negative reference specimens in internal validation; clinical specificity for recurrence is still being characterized (PROVENC3 and related studies).",
    "lod": null,
    "lod95": "0.005% ctDNA",
    "lodCitations": "https://oncology.labcorp.com/biopharma-partners/plasma-detect; https://ismrc-symposium.eu/_Resources/Persistent/f0607069e3aaad66b7ef9a95afad4f655696b5d3/PS-01-012_Carmen%20Rubio-Alarcon_PLCRC-PROVENC3%20assessing%20the%20prognostic%20value%20of%20post-sur.pdf",
    "lodNotes": "Analytical LoD95 around 0.005% ctDNA content in contrived reference samples. Detection threshold not separately disclosed.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires FFPE tumor tissue at the landmark time point for WGS to define the tumor-informed MRD signature (Labcorp Plasma Detect workflow).",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Uses buffy coat (PBMC) germline DNA to filter germline and non–tumor-specific variants; germline input is required for assay design.",
    "variantsTracked": "5000",
    "variantsTrackedCitations": "https://oncology.labcorp.com/biopharma-partners/plasma-detect",
    "variantsTrackedNotes": "Median of ~5000 high-confidence tumor-specific single nucleotide variants (SNVs) per patient in the MRD signature, tracked longitudinally.",
    "initialTat": 14.0,
    "initialTatCitations": "https://oncology.labcorp.com/biopharma-partners/plasma-detect",
    "initialTatNotes": "Landmark ctDNA MRD result available in as few as 14 days from sample receipt.",
    "followUpTat": 7.0,
    "followUpTatCitations": "https://oncology.labcorp.com/biopharma-partners/plasma-detect",
    "followUpTatNotes": "Longitudinal surveillance time points reported in as few as 7 days from sample receipt.",
    "bloodVolume": 20.0,
    "bloodVolumeCitations": "https://oncology.labcorp.com/biopharma-partners/plasma-detect",
    "bloodVolumeNotes": "Two 10 mL Streck blood collection tubes (BCT) for plasma and buffy coat at the landmark time point; plasma-only draws (Streck tubes) for longitudinal monitoring.",
    "tat": 14.0,
    "tatNotes": "Landmark (initial) MRD result in as few as 14 days and longitudinal MRD results in as few as 7 days from sample receipt (Plasma Detect assay specifications).",
    "fdaStatus": "CLIA / CAP laboratory-developed test offered via Early Experience Program for stage III colon cancer; also available as a Research Use Only (RUO) service for biopharma trials; not FDA-cleared/approved.",
    "reimbursement": "No established routine coverage; early-access / research-focused offering",
    "reimbursementNote": "Positioned primarily for research, clinical trials, and an Early Experience Program in stage III colon cancer. No public Medicare LCD or dedicated PLA code as of 2025; confirm billing and coverage with Labcorp / payers.",
    "cptCodesNotes": "No public PLA/CPT code specific to Labcorp Plasma Detect as of 2025; contact Labcorp for current billing guidance.",
    "clinicalAvailability": "Early Experience Program for stage III colon cancer in clinical practice; broader use as RUO test for translational research and clinical trials across solid tumors.",
    "independentValidation": "Yes",
    "independentValidationNotes": "Clinically validated in the PROVENC3 stage III colon cancer cohort (AACR 2024) and related ASCO/ESMO presentations assessing post-surgery and post-adjuvant ctDNA status and recurrence risk.",
    "clinicalTrials": "PROVENC3 (PROgnostic Value of Early Notification by ctDNA in Colon Cancer stage III) within the PLCRC cohort; 236 stage III colon cancer patients, observational ctDNA MRD study using Labcorp Plasma Detect",
    "totalParticipants": 236,
    "numPublications": 2
  },
  {
    "id": "mrd-10",
    "sampleCategory": "Blood/Plasma",
    "name": "FoundationOne Tracker (MRD)",
    "vendor": "Foundation Medicine / Natera",
    "approach": "Tumor-informed",
    "method": "Personalized ctDNA assay derived from FoundationOne CDx tumor sequencing; uses 2-16 patient-specific somatic variants to detect and quantify mean tumor molecules per mL (MTM/mL) in serial plasma samples via multiplex PCR workflow.",
    "cancerTypes": [
      "Multi-solid tumors"
    ],
    "indicationsNotes": "Tissue-informed ctDNA MRD assay for early- and late-stage solid tumors. Uses archival or new tumor tissue profiled by FoundationOne CDx to build a patient-specific panel, then quantifies MTM/mL in serial plasma samples for MRD detection and surveillance after curative-intent therapy. Note: The TRM application has separate clinical availability with Medicare coverage; the MRD application remains investigational.",
    "sensitivity": null,
    "sensitivityCitations": "Zollinger DR et al. PLoS One 2024;19:e0302129; IMpower131 trial data (Kasi PM et al. Clin Cancer Res 2023).",
    "sensitivityNotes": "Analytical validation reports >97.3% sensitivity at ≥5 MTM/mL when at least two tumor variants are monitored; clinical MRD sensitivity is indication- and timepoint-specific.",
    "specificity": null,
    "specificityCitations": "Zollinger DR et al. PLoS One 2024;19:e0302129.",
    "specificityNotes": "Sample-level analytical specificity was 99.6% in contrived and clinical samples; not encoded as a single global clinical specificity across all indications.",
    "lod": null,
    "lodCitations": "Zollinger DR et al. PLoS One 2024;19:e0302129.",
    "lodNotes": "Performance is reported in units of MTM/mL rather than a single tumor-fraction percentage; analytical sensitivity ≥5 MTM/mL with ≥2 variants monitored.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires prior or concurrent tumor CGP by FoundationOne CDx to identify 2-16 patient-specific somatic variants for personalized panel design.",
    "requiresMatchedNormal": "No",
    "requiresMatchedNormalNotes": "Germline and CHIP filtering performed computationally without mandatory matched-normal sequencing.",
    "initialTat": null,
    "initialTatNotes": "Analytical-workflow TAT is roughly 7-10 days from sample receipt and variant design to result; initial result requires completed FoundationOne CDx.",
    "followUpTat": null,
    "followUpTatNotes": "Serial MRD timepoints reuse the established patient-specific panel with similar turnaround.",
    "bloodVolume": null,
    "bloodVolumeNotes": "Foundation does not publish a fixed blood volume; typical mPCR ctDNA workflows use two Streck tubes (~20 mL whole blood).",
    "fdaStatus": "FDA Breakthrough Device designation (Feb 2022) for MRD detection in early-stage solid tumors; investigational/early access assay – NOT yet FDA cleared.",
    "fdaStatusCitations": "Foundation Medicine press release, February 3, 2022.",
    "reimbursement": "Not applicable",
    "reimbursementNote": "MRD applications are investigational; not routinely billed to payers. Note: TRM use has separate Medicare coverage (see TRM category).",
    "cptCodesNotes": "None for MRD investigational use.",
    "clinicalAvailability": "Investigational / early access program via Foundation Medicine for MRD applications; biopharma and academic collaborations.",
    "clinicalTrials": "Used in translational and interventional cohorts for MRD (e.g., early bladder cancer post-cystectomy, stage II/III CRC) correlating ctDNA dynamics with outcomes.",
    "totalParticipants": null,
    "numPublications": 3,
    "numPublicationsPlus": true,
    "isRUO": false,
    "isInvestigational": true,
    "isClinicalLDT": true,
    "regulatoryStatusNotes": "Holds FDA Breakthrough Device designation for MRD but is not yet FDA cleared. The underlying assay platform is a clinical LDT (same technology as FoundationOne Tracker TRM which has Medicare coverage), but MRD-specific applications remain investigational."
  },
  {
    "id": "mrd-11",
    "sampleCategory": "Blood/Plasma",
    "name": "Foundation TI-WGS MRD (RUO)",
    "vendor": "Foundation Medicine",
    "approach": "Tumor-informed",
    "method": "Tissue-informed whole-genome sequencing MRD assay; WGS of tumor tissue and longitudinal plasma combined with a proprietary bioinformatics algorithm to detect and quantify ctDNA tumor fraction by monitoring hundreds to thousands of tumor-specific variants.",
    "cancerTypes": [
      "Multi-solid tumors"
    ],
    "indicationsNotes": "Sensitive MRD assay offered for research use in early- and late-stage solid tumors. Available through Foundation's FlexOMx Lab for drug-development studies requiring deep ctDNA detection (e.g., early-stage or low-shedding cancers).",
    "sensitivity": null,
    "sensitivityCitations": "Foundation Medicine press release, September 23, 2025; https://www.foundationmedicine.com/monitoring-portfolio",
    "sensitivityNotes": "Feasibility data indicate high sensitivity at low tumor fractions; cross-indication sensitivity values are study-specific.",
    "specificity": null,
    "specificityCitations": "Foundation Medicine Monitoring Portfolio technical specifications.",
    "specificityNotes": "Described as demonstrating high specificity in feasibility data; values are study- and tumor-specific.",
    "lod": "10 ppm (≈0.001%)",
    "lodCitations": "https://www.foundationmedicine.com/monitoring-portfolio",
    "lodNotes": "Reported to detect ctDNA tumor fraction down to 10 ppm in both early- and late-stage cancer.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires WGS of tumor tissue to build the patient-specific genomic signature; typically uses the same FFPE block as FoundationOne CDx.",
    "requiresMatchedNormal": "No",
    "requiresMatchedNormalNotes": "Product highlights emphasize that matched-normal samples are NOT required for CHIP/germline filtering.",
    "initialTat": null,
    "initialTatNotes": "TAT depends on WGS depth and study design; not publicly specified for this RUO assay.",
    "followUpTat": null,
    "followUpTatNotes": "Follow-up draws reuse the existing tumor-informed signature; timelines negotiated at study level.",
    "bloodVolume": null,
    "bloodVolumeNotes": "Standard ctDNA plasma volumes; explicit whole-blood volume not specified publicly.",
    "fdaStatus": "Research Use Only (RUO) – CLIA-certified, CAP-accredited FlexOMx Lab; NOT FDA cleared.",
    "fdaStatusCitations": "Foundation Medicine press release, September 23, 2025.",
    "reimbursement": "Not applicable",
    "reimbursementNote": "RUO only; costs are sponsor-funded in research/clinical-development collaborations.",
    "cptCodesNotes": "None (RUO research assay).",
    "clinicalAvailability": "Available to biopharma and academic partners as a central-lab RUO MRD solution via Foundation's FlexOMx Lab. Launched September 2025.",
    "clinicalTrials": "Positioned for MRD assessment and ctDNA kinetics in oncology drug-development studies, particularly early-stage or low-shed settings.",
    "totalParticipants": null,
    "numPublications": 0,
    "numPublicationsPlus": false,
    "isRUO": true,
    "isInvestigational": false,
    "isClinicalLDT": false,
    "regulatoryStatusNotes": "Research Use Only assay launched September 2025 through FlexOMx Lab; offered for retrospective clinical trials and research studies, not for diagnostic use."
  },
  {
    "id": "mrd-12",
    "sampleCategory": "Blood/Plasma",
    "name": "Veracyte MRD (C2i Genomics platform)",
    "vendor": "Veracyte (C2i Genomics)",
    "approach": "Tumor-informed",
    "method": "Whole-genome sequencing (WGS) of tumor tissue and germline DNA combined with AI-driven pattern recognition to create patient-specific ctDNA signatures; subsequent blood samples are analyzed via WGS and AI to detect residual cancer.",
    "cancerTypes": [
      "Muscle-invasive bladder cancer (first indication)",
      "Multi-solid (planned expansion)"
    ],
    "indicationsNotes": "WGS-based MRD testing platform acquired by Veracyte from C2i Genomics in February 2024. First clinical test planned for muscle-invasive bladder cancer (MIBC) with launch expected H1 2026.",
    "sensitivity": 91,
    "sensitivityCitations": "European Urology publication (Nordentoft I et al.); EAU25 presentation (Abstract A0162); GenomeWeb May 2025.",
    "sensitivityNotes": "Prior publication showed 91% sensitivity at 92% specificity in urothelial carcinoma. TOMBOLA trial data presented at EAU25 demonstrated higher accuracy than ddPCR.",
    "specificity": 88,
    "specificityCitations": "EAU25 presentation, TOMBOLA trial (Abstract A0162).",
    "specificityNotes": "TOMBOLA trial showed 88% specificity at 6-month milestone vs 62% for ddPCR; detected recurrence 93 days earlier than imaging.",
    "lod": null,
    "lodCitations": "Veracyte investor communications.",
    "lodNotes": "WGS-based approach; specific LoD threshold not publicly disclosed.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires WGS of tumor tissue and germline DNA to establish patient-specific signature.",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "WGS of germline (non-tumor) DNA is part of the workflow to distinguish somatic from germline variants.",
    "initialTat": 14,
    "initialTatNotes": "Sample to result in approximately 2 weeks per acquisition announcement.",
    "followUpTat": 14,
    "followUpTatNotes": "Follow-up samples analyzed via WGS with similar turnaround.",
    "bloodVolume": 4,
    "bloodVolumeCitations": "GEN Edge January 2024; C2i acquisition announcement.",
    "bloodVolumeNotes": "Requires less than one tube of blood (as little as 3-4 mL blood or 1-2 mL plasma).",
    "fdaStatus": "Pre-commercial research platform; NOT FDA cleared. First clinical test (MIBC) expected H1 2026.",
    "fdaStatusCitations": "Veracyte Q1 2025 earnings; GenomeWeb May 2025; EAU25 presentation.",
    "reimbursement": "Not applicable",
    "reimbursementNote": "Pre-commercial; Veracyte plans to leverage established urology channel for MIBC indication.",
    "cptCodesNotes": "None (pre-commercial).",
    "clinicalAvailability": "Pre-commercial research platform. Clinical launch planned H1 2026 for muscle-invasive bladder cancer.",
    "clinicalTrials": "TOMBOLA trial (NCT04138628) – multicenter interventional in MIBC (100 patients); UMBRELLA trial (enrolled Q1 2025) for pancreatic cancer, sarcoma, CRC, NSCLC.",
    "clinicalTrialsCitations": "Veracyte Q1 2025 earnings; EAU25 presentation.",
    "totalParticipants": 100,
    "numPublications": 2,
    "numPublicationsPlus": true,
    "isRUO": true,
    "isInvestigational": true,
    "isClinicalLDT": false,
    "regulatoryStatusNotes": "Pre-commercial investigational WGS-based MRD platform acquired by Veracyte (Feb 2024, $70M + $25M milestones). TOMBOLA trial supports validation. First clinical test for MIBC expected H1 2026."
  },
  {
    "id": "mrd-13",
    "sampleCategory": "Blood/Plasma",
    "name": "Guardant LUNAR (RUO platform)",
    "vendor": "Guardant Health",
    "approach": "Tumor-naïve",
    "method": "Plasma-only ctDNA assay integrating genomic alterations (SNVs, indels) with epigenomic cancer signatures (aberrant DNA methylation) to detect MRD without requiring tumor tissue sequencing. Originally called LUNAR-1.",
    "cancerTypes": [
      "Colorectal cancer (primary validation)",
      "Multi-solid (research)"
    ],
    "indicationsNotes": "Research platform that evolved into the clinical Guardant Reveal LDT. Designed to detect MRD without prior knowledge of patient's tumor mutations by combining genomic and methylation signatures.",
    "sensitivity": 56,
    "sensitivityCitations": "Parikh AR et al. Clin Cancer Res 2021;27:5586-5594.",
    "sensitivityNotes": "In CRC cohort (n=84 evaluable): landmark sensitivity 56% (1 month post-therapy), longitudinal sensitivity 69%. Integrating epigenomic analysis enhanced sensitivity by 25-36%.",
    "specificity": 100,
    "specificityCitations": "Parikh AR et al. Clin Cancer Res 2021;27:5586-5594.",
    "specificityNotes": "Landmark specificity ~100% with 100% PPV (all 15 patients with detectable ctDNA recurred); longitudinal specificity ~91%.",
    "lod": null,
    "lodCitations": "Parikh AR et al. Clin Cancer Res 2021.",
    "lodNotes": "Performance expressed via recurrence sensitivity/specificity; detects genomic alterations down to 0.01% allele frequency.",
    "requiresTumorTissue": "No",
    "requiresTumorTissueNotes": "Explicitly designed as plasma-only assay, not requiring sequencing of tumor tissue – a key differentiator from tissue-informed approaches.",
    "requiresMatchedNormal": "No",
    "requiresMatchedNormalNotes": "Plasma-only assay uses integrated genomic and epigenomic signatures without matched-normal sequencing; filters CHIP variants computationally.",
    "initialTat": null,
    "initialTatNotes": "Research platform TAT was study-specific; clinical derivative (Guardant Reveal) reports ~10-14 day TAT.",
    "followUpTat": null,
    "followUpTatNotes": "Follow-up draws processed via same plasma-only workflow.",
    "bloodVolume": 4,
    "bloodVolumeCitations": "Parikh AR et al. Clin Cancer Res 2021.",
    "bloodVolumeNotes": "CRC MRD study used median 4 mL plasma (range 1-4 mL).",
    "fdaStatus": "Research-use-only MRD platform; clinical implementation transitioned to Guardant Reveal LDT.",
    "fdaStatusCitations": "Parikh AR et al. Clin Cancer Res 2021; Guardant Health website.",
    "reimbursement": "Not applicable",
    "reimbursementNote": "RUO platform; costs study-funded. Clinical product Guardant Reveal has separate reimbursement pathway.",
    "cptCodesNotes": "None (research platform; Guardant Reveal is the clinical LDT).",
    "clinicalAvailability": "Available to academic and biopharma partners as research platform. Guardant Reveal is the clinical LDT derived from this technology.",
    "clinicalTrials": "CRC MRD study at Massachusetts General (Parikh et al. 2021, n=103); COSMOS study; PEGASUS trial; COBRA trial.",
    "clinicalTrialsCitations": "Parikh AR et al. Clin Cancer Res 2021;27:5586-5594.",
    "totalParticipants": 103,
    "numPublications": 5,
    "numPublicationsPlus": true,
    "isRUO": true,
    "isInvestigational": false,
    "isClinicalLDT": false,
    "regulatoryStatusNotes": "Research/development platform (originally LUNAR-1); the patient-facing MRD offering is Guardant Reveal (tracked separately as CLIA LDT). Demonstrated feasibility of tumor-uninformed plasma-only MRD detection."
  },
  {
    "id": "mrd-14",
    "sampleCategory": "Blood/Plasma",
    "name": "NavDx",
    "vendor": "Naveris",
    "approach": "Tumor-naïve",
    "method": "Proprietary quantitative digital droplet PCR assay detecting tumor tissue modified viral (TTMV)-HPV DNA fragments in plasma; detects HPV genotypes 16, 18, 31, 33, and 35; reports TTMV Score (normalized TTMV-HPV DNA fragments/mL plasma).",
    "cancerTypes": [
      "HPV+ oropharyngeal (head & neck) cancer",
      "Anal squamous cell carcinoma (ASCC)",
      "HPV-driven gynecologic cancers (via NavDx+Gyn)"
    ],
    "indicationsNotes": "First and only clinically validated circulating TTMV-HPV DNA blood test. Detects MRD and recurrence in HPV-driven cancers before clinical or radiographic evidence. Used across the care continuum: pre-treatment baseline, treatment response assessment, post-treatment MRD surveillance, and recurrence detection.",
    "leadTimeVsImaging": 120,
    "leadTimeVsImagingCitations": "Chera BS et al. J Clin Oncol 2020;38:1050-1058; NavDx surveillance data.",
    "leadTimeVsImagingNotes": "Median ~4 months (~120 days) lead time vs imaging for recurrence detection in HPV-driven oropharyngeal cancer surveillance cohorts.",
    "sensitivity": 90.4,
    "sensitivityCitations": "Ferrandino RN et al. JAMA Otolaryngol Head Neck Surg 2023; Hanna GJ et al. Clin Cancer Res 2023; Diagnostics 2023;13:725.",
    "sensitivityNotes": "Clinical sensitivity 90.4% for recurrent HPV-associated OPSCC; 91.5% for pre-treatment diagnosis; 79.2-89% for surveillance depending on timepoint. For ASCC, multi-center study showed high accuracy.",
    "specificity": 98.6,
    "specificityCitations": "Ferrandino RN et al. JAMA Otolaryngol Head Neck Surg 2023; Hanna GJ et al. Clin Cancer Res 2023.",
    "specificityNotes": "Clinical specificity 98.6% for OPSCC; 97-100% in surveillance cohorts. Reliably distinguishes TTMV-HPV DNA from non-cancerous HPV DNA sources.",
    "ppv": 98,
    "ppvNotes": "Per-test PPV of 98% for ASCC; 97.9% for OPSCC. ≥95% PPV for cancer recurrence when patients had at least one positive test result.",
    "npv": 95,
    "npvNotes": "Per-test NPV of 95% for ASCC; 95.7-98% for OPSCC surveillance. ≥98% of patients whose TTMV Score remained negative had no recurrence.",
    "lod": null,
    "lodCitations": "Diagnostics 2023;13:725 (analytical validation).",
    "lodNotes": "Analytical LOD: 0.56-1.31 copies/μL for HPV types 16, 18, 31, 33, 35. LOQ: 1.20-4.11 copies/μL. LOB: 0-0.32 copies/μL.",
    "requiresTumorTissue": "No",
    "requiresTumorTissueNotes": "Tumor-naïve approach; does not require prior tumor sequencing. Detects HPV-derived ctDNA directly without need for patient-specific panel design. For patients without pre-treatment NavDx, primary tumor tissue may be tested to confirm HPV genotype.",
    "requiresMatchedNormal": "No",
    "requiresMatchedNormalNotes": "No matched normal required; TTMV-HPV DNA biomarker is tumor-specific by nature.",
    "initialTat": null,
    "initialTatNotes": "Sample stability validated for 7 days post-collection in Streck tubes; specific TAT not publicly disclosed.",
    "followUpTat": null,
    "followUpTatNotes": "Serial monitoring uses same assay with consistent turnaround.",
    "bloodVolume": 10,
    "bloodVolumeCitations": "NavDx physician ordering information.",
    "bloodVolumeNotes": "One 10-mL Streck tube of whole blood required.",
    "fdaStatus": "Clinical LDT – CLIA high-complexity test; CAP and NYSDOH accredited; NOT FDA cleared",
    "fdaStatusCitations": "Naveris website; Diagnostics 2023;13:725.",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare coverage via Palmetto GBA MolDX: HPV+ oropharyngeal cancer (Nov 2023), anal squamous cell carcinoma (Nov 2025). CMS ADLT designation effective April 2024.",
    "commercialPayers": ["Highmark", "Blue Shield of California"],
    "commercialPayersCitations": "Naveris press releases Feb 2024, July 2024.",
    "commercialPayersNotes": "Highmark coverage announced Feb 2024; Blue Shield of California coverage effective July 1, 2024.",
    "cptCodes": "0356U",
    "cptCodesNotes": "CPT 0356U for TTMV-HPV DNA testing; ADLT status effective April 1, 2024.",
    "clinicalAvailability": "Commercially available in US. Integrated into clinical practice by >1,000 healthcare providers at >400 medical sites. ~100,000 patient-physician encounters.",
    "clinicalTrials": "Phase II MRD+ study at Memorial Sloan Kettering (HB-200 intervention for HPV16+ HNSCC with molecular relapse); multiple validation cohorts.",
    "clinicalTrialsCitations": "Naveris press release April 2024; Chera BS et al. J Clin Oncol 2020;38:1050-1058; Berger BM et al. Clin Cancer Res 2022;28:4292-4301.",
    "totalParticipants": null,
    "totalParticipantsNotes": "Validation across multiple published cohorts totaling >1,000 patients; JAMA study included 163 diagnostic + 290 surveillance patients.",
    "numPublications": 35,
    "numPublicationsPlus": true,
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "regulatoryStatusNotes": "First MRD test with Medicare coverage for HPV-driven cancers. Clinical LDT with ADLT designation. Unique tumor-naïve approach detecting viral-derived ctDNA rather than somatic mutations. Proven clinical utility in 35+ peer-reviewed publications."
  },
  {
    "id": "mrd-15",
    "sampleCategory": "Blood/Plasma",
    "name": "Foresight CLARITY Lymphoma",
    "vendor": "Natera",
    "vendorOriginal": "Foresight Diagnostics",
    "approach": "Tumor-informed",
    "method": "PhasED-Seq (Phased variant Enrichment and Detection Sequencing): 150kb fixed capture panel leveraging somatic hypermutation in B-cell malignancies. Off-the-shelf panel (no custom reagent design) interrogates phased variants in stereotypical genomic regions. Requires concordant detection of ≥2 phased non-reference variants on same DNA molecule. Background error rate ~1.95E-08.",
    "cancerTypes": [
      "Diffuse large B-cell lymphoma (DLBCL)",
      "Large B-cell lymphoma (LBCL)",
      "Follicular lymphoma",
      "Classic Hodgkin lymphoma",
      "Multiple myeloma"
    ],
    "indicationsNotes": "Sensitive MRD assay for B-cell malignancies leveraging phased variant technology in somatic hypermutation regions. First ctDNA-MRD test included in NCCN Guidelines for B-Cell Lymphomas (Dec 2024). Acquired by Natera December 2025. Solid tumor version (up to 5,000 variants, 0.3 ppm LOD) in development but not yet clinically available.",
    "sensitivity": 90.62,
    "sensitivityCitations": "Boehm N et al. Oncotarget 2025;16:329-336; JCO 2025 pooled analysis (n=137).",
    "sensitivityNotes": "Positive percent agreement 90.62% (95% CI 74.98-98.02%) in DLBCL analytical validation. End-of-treatment MRD detection identified 90% of patients who later relapsed vs 45% for PET/CT.",
    "specificity": 97.65,
    "specificityCitations": "Boehm N et al. Oncotarget 2025;16:329-336.",
    "specificityNotes": "Negative percent agreement 97.65% (95% CI 87.43-99.94%) in DLBCL validation. False positive rate 0.24%.",
    "lod": "0.7 ppm",
    "lod95": null,
    "lodCitations": "Boehm N et al. Oncotarget 2025;16:329-336.",
    "lodNotes": "LOD 0.7 ppm validated in regulatory study for lymphoma panel. Solid tumor version (in development) achieves 0.3 ppm. LOD95 not separately reported.",
    "leadTimeVsImaging": 200,
    "leadTimeVsImagingCitations": "Foresight CLARITY product page; Roschewski M et al. ASH 2023.",
    "leadTimeVsImagingNotes": "Detects relapse approximately 200 days earlier than PET/CT imaging in DLBCL. PhasED-Seq correctly identified 90% of patients who later relapsed vs 45% identified by PET/CT.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires tumor-derived material but flexible source: pre-treatment PLASMA (when tumor is shedding) OR tumor tissue. No tissue biopsy required if adequate pre-treatment plasma available.",
    "requiresMatchedNormal": "No",
    "requiresMatchedNormalNotes": "Pre-treatment plasma can serve as tumor DNA source for phased variant identification.",
    "variantsTracked": "100s",
    "variantsTrackedNotes": "Fixed 150kb panel interrogates hundreds of phased variants in somatic hypermutation regions. No custom reagent design required (unlike solid tumor WGS approaches).",
    "initialTat": 8,
    "initialTatNotes": "8-10 days for new patient baseline. Off-the-shelf panel eliminates custom reagent design delay.",
    "followUpTat": 8,
    "followUpTatNotes": "8-10 days for MRD monitoring timepoints. Same turnaround as baseline due to fixed panel approach.",
    "bloodVolume": null,
    "bloodVolumeNotes": "Standard blood draw volume; specific volume not publicly disclosed.",
    "fdaStatus": "CLIA LDT – NOT FDA cleared/approved",
    "fdaStatusCitations": "Foresight website; CAP: 9346637, CLIA: 06D2287941",
    "reimbursement": "Not established",
    "reimbursementNote": "Research/trial use primarily. NCCN guideline inclusion may support future reimbursement pathway. Clinical launch expected 2026 post-Natera integration.",
    "cptCodes": null,
    "clinicalAvailability": "Research/trial use; limited clinical ordering. Central CLIA lab (Boulder, CO). Clinical launch expected 2026.",
    "clinicalTrials": "NCT06500273 (ALPHA3 - MRD+ LBCL patients post-remission); NCT06693830 (SHORTEN-ctDNA - ctDNA-guided chemotherapy de-escalation); multiple biopharma and academic partnerships",
    "clinicalTrialsCitations": "Foresight Diagnostics press releases 2025; ClinicalTrials.gov",
    "totalParticipants": null,
    "totalParticipantsNotes": "Used in 3 prospective MRD-driven clinical trials. JCO pooled analysis included 137 DLBCL patients from 5 prospective studies.",
    "numPublications": 40,
    "numPublicationsPlus": true,
    "numPublicationsCitations": "Foresight website; Natera acquisition announcement noted 15 abstracts at ASH 2025.",
    "isRUO": false,
    "isInvestigational": true,
    "isClinicalLDT": true,
    "regulatoryStatusNotes": "CLIA-registered laboratory (CAP: 9346637, CLIA: 06D2287941). First ctDNA-MRD test in NCCN B-Cell Lymphoma guidelines. Acquired by Natera Dec 5, 2025 for $275M upfront + $175M earnouts.",
    "nccnGuidelines": true,
    "nccnGuidelinesNotes": "NCCN B-Cell Lymphomas V.2.2025 (Dec 2024): ctDNA-MRD testing with assay LOD <1ppm recommended to adjudicate PET-positive results at end of frontline DLBCL therapy.",
    "vendorDataSource": "Foresight CBO communication Dec 2025",
    "solidTumorVersionNotes": "Foresight CLARITY for solid tumors is in development (not clinically available). Uses WGS baseline with up to 5,000 phased+low-error variants and achieves 0.3 ppm LOD. Requires custom reagent design like other MRD products.",
    "acquisitionDetails": {
      "acquirer": "Natera",
      "date": "2025-12-05",
      "upfrontValueUSD": 275000000,
      "earnoutPotentialUSD": 175000000
    }
  },
  {
    "id": "mrd-16",
    "sampleCategory": "Blood/Plasma",
    "name": "Invitae PCM",
    "vendor": "Labcorp (Invitae)",
    "approach": "Tumor-informed",
    "method": "Tumor-informed, whole-exome sequencing-based MRD assay: WES of tumor and matched normal identifies 18-50 patient-specific variants, which are tracked at high depth in plasma using Anchored Multiplex PCR (AMP) chemistry with error correction.",
    "cancerTypes": [
      "NSCLC",
      "Breast",
      "Colorectal",
      "Pancreatic",
      "Head and neck",
      "Multi-solid"
    ],
    "indicationsNotes": "Invitae Personalized Cancer Monitoring (PCM) pan-cancer tumor-informed MRD assay, now part of Labcorp following Aug 2024 acquisition. Co-developed with TRACERx consortium. FDA Breakthrough Device designation. Not indicated for hematological malignancies, CNS malignancies, or sarcomas.",
    "sensitivity": 76.9,
    "sensitivityCitations": "Garcia-Murillas I et al. Breast Cancer Res 2025; TRACERx lung cancer studies.",
    "sensitivityNotes": "76.9% clinical sensitivity in breast cancer monitoring phase for patients who relapsed. TRACERx NSCLC showed 93% (13/14) prediction of relapse post-resection.",
    "specificity": 100,
    "specificityCitations": "Garcia-Murillas I et al. Breast Cancer Res 2025.",
    "specificityNotes": "100% specificity in breast cancer monitoring cohort (n=61). No false positives reported.",
    "lod": "80 ppm",
    "lod95": null,
    "lodCitations": "Invitae PCM analytical validation; GenomeWeb Sept 2023.",
    "lodNotes": "LOD of 0.008% VAF (80 ppm) with 60ng cfDNA input and 18-50 variants at baseline threshold. LOD of 0.05% VAF (500 ppm) with 10ng cfDNA and 18 variants at monitoring threshold.",
    "leadTimeVsImaging": 351,
    "leadTimeVsImagingCitations": "Garcia-Murillas I et al. Breast Cancer Res 2025.",
    "leadTimeVsImagingNotes": "Median lead time 11.7 months (351 days) before clinical relapse in breast cancer. TRACERx NSCLC showed median 70 days, up to 136 days in follow-up cohort.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires FFPE tumor tissue plus matched-normal blood for baseline WES panel design.",
    "requiresMatchedNormal": "Yes",
    "variantsTracked": "18-50",
    "variantsTrackedNotes": "Invitae algorithm selects 18-50 tumor-specific variants from WES results. Range allows balance of sensitivity in low vs high mutational burden cancers.",
    "initialTat": 21,
    "initialTatNotes": "Approximately 3 weeks for baseline panel design from tumor/normal WES.",
    "followUpTat": 10,
    "followUpTatNotes": "Monitoring timepoints typically reported within 10 days.",
    "bloodVolume": 20,
    "bloodVolumeNotes": "Standard collection: two 10mL Streck cfDNA tubes (20mL total).",
    "fdaStatus": "CLIA LDT; FDA Breakthrough Device designation",
    "fdaStatusCitations": "Invitae/Labcorp website; FDA BDD program.",
    "reimbursement": "Coverage emerging",
    "reimbursementNote": "Under Novitas MAC jurisdiction (not MolDX/Palmetto). Labcorp pursuing coverage pathways post-acquisition.",
    "cptCodes": null,
    "clinicalAvailability": "Clinical LDT – shipping (Metro Park, NJ laboratory)",
    "clinicalTrials": "TRACERx (NSCLC, ~850 pts); MARIA (pan-tumor); ARTEMIS (pancreatic); multiple breast and GI studies",
    "clinicalTrialsCitations": "Invitae/Labcorp press releases; ClinicalTrials.gov",
    "totalParticipants": 1000,
    "totalParticipantsNotes": "TRACERx alone enrolled ~850 pts; additional studies in breast, pancreatic, colorectal.",
    "numPublications": 15,
    "numPublicationsPlus": true,
    "numPublicationsCitations": "TRACERx consortium publications; Garcia-Murillas et al.",
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "regulatoryStatusNotes": "CAP-accredited, CLIA-certified laboratory (Metro Park, NJ). Acquired by Labcorp Aug 2024 via Invitae bankruptcy sale ($239M)."
  },
  {
    "id": "mrd-17",
    "sampleCategory": "Blood/Plasma",
    "name": "Labcorp Plasma Detect",
    "vendor": "Labcorp",
    "approach": "Tumor-informed",
    "method": "Tumor-informed, whole-genome sequencing-based MRD assay: WGS of tumor and matched-normal (buffy coat) identifies thousands of patient-specific somatic variants. Proprietary machine learning algorithm tracks these variants in plasma cfDNA without need for bespoke panel manufacturing.",
    "cancerTypes": [
      "Colon cancer (Stage III)",
      "Lung cancer (in validation)",
      "Bladder cancer (in validation)",
      "Multi-solid (expanding)"
    ],
    "indicationsNotes": "Labcorp Plasma Detect WGS-based MRD assay. First tumor-informed MRD solution from Labcorp (distinct from Invitae PCM). Clinically validated for stage III colon cancer; clinical use launched April 2025 via Early Experience Program. Expanding to additional solid tumors.",
    "sensitivity": null,
    "sensitivityCitations": "Labcorp press releases; Nature Medicine 2025; Clinical Cancer Research 2025.",
    "sensitivityNotes": "High sensitivity demonstrated in validation studies; specific values pending publication from PROVENC3 and MEDOCC-CrEATE trials.",
    "specificity": null,
    "specificityCitations": "Labcorp press releases.",
    "specificityNotes": "High specificity with WGS-based approach tracking thousands of variants. Specific values pending publication.",
    "lod": "10 ppm",
    "lod95": "10 ppm",
    "lodCitations": "Labcorp Plasma Detect product page.",
    "lodNotes": "LOD95 of 0.001% (10 ppm). WGS approach tracks thousands of tumor-specific variants (vs 18-50 for WES-based approaches), enabling improved sensitivity at low ctDNA levels.",
    "leadTimeVsImaging": null,
    "leadTimeVsImagingCitations": "Labcorp press releases Nov 2025.",
    "leadTimeVsImagingNotes": "Detects disease progression up to 18 months earlier than standard clinical measures (median 2.3 months lead time in chemotherapy monitoring study).",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires tumor tissue for WGS plus buffy coat for germline/CHIP filtering.",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Buffy coat sequencing enables robust CHIP variant filtering.",
    "variantsTracked": "Thousands",
    "variantsTrackedNotes": "WGS identifies thousands of high-confidence, patient-specific somatic variants. No bespoke panel manufacturing required.",
    "initialTat": 14,
    "initialTatNotes": "Landmark timepoint results in as few as 14 days. Standardized WGS workflow eliminates custom reagent delays.",
    "followUpTat": 7,
    "followUpTatNotes": "Longitudinal monitoring timepoints in as few as 7 days.",
    "bloodVolume": null,
    "bloodVolumeNotes": "Standard blood collection; specific volume not publicly disclosed.",
    "fdaStatus": "CLIA LDT",
    "fdaStatusCitations": "Labcorp press release April 2025.",
    "reimbursement": "Coverage emerging",
    "reimbursementNote": "Clinical use launched April 2025 for stage III colon cancer via Early Experience Program. Reimbursement pathways in development.",
    "cptCodes": null,
    "clinicalAvailability": "Clinical LDT – Early Experience Program (stage III colon cancer); Research Use for other indications",
    "clinicalTrials": "PROVENC3 (colon cancer validation with NKI); MEDOCC-CrEATE (stage II colon ACT); 10+ additional clinical studies in US and internationally",
    "clinicalTrialsCitations": "Labcorp press releases; Nature Medicine 2025; Clinical Cancer Research 2025.",
    "totalParticipants": null,
    "totalParticipantsNotes": "Currently evaluated in 10+ clinical studies across multiple cancer types.",
    "numPublications": 2,
    "numPublicationsCitations": "Nature Medicine 2025 (mesothelioma); Clinical Cancer Research 2025 (head and neck).",
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "regulatoryStatusNotes": "Developed under PGDx quality management system and design control. Clinical use for stage III colon cancer; research use for other solid tumors. Expanding indications expected."
  },
  {
    "id": "mrd-18",
    "sampleCategory": "Blood/Plasma",
    "name": "Caris Assure",
    "vendor": "Caris Life Sciences",
    "approach": "Tumor-naïve MRD (WES/WTS cfDNA + cfRNA)",
    "method": "AI-enabled whole exome and whole transcriptome sequencing (WES/WTS) from plasma cfDNA/cfRNA and buffy coat WBC DNA/RNA with machine learning MRD model; CHIP subtraction for accuracy",
    "methodCitations": "https://www.nature.com/articles/s41598-025-08986-0 | https://www.carislifesciences.com/physicians/physician-tests/caris-assure/",
    "cancerTypes": ["All solid tumors"],
    "targetPopulation": "Cancer patients requiring MRD detection and disease monitoring; tumor-naïve approach does not require prior tissue profiling",
    "indicationsNotes": "Multi-functional platform validated for MRD detection across solid tumors. Disease-free survival stratification: HR=33.4 (p<0.005) for MRD-positive vs MRD-negative patients. Also supports therapy selection and treatment response monitoring on same platform.",
    "sensitivity": null,
    "sensitivityNotes": "MRD model trained on 3,439 patients and validated on independent set of 86 MRD patients. Tumor-naïve approach using AI-derived features from plasma.",
    "sensitivityCitations": "https://www.nature.com/articles/s41598-025-08986-0",
    "specificity": 99.6,
    "specificityNotes": "99.6% specificity in MRD/monitoring validation cohorts.",
    "specificityCitations": "https://www.nature.com/articles/s41598-025-08986-0",
    "performanceNotes": "For MRD detection, disease-free survival of patients predicted to have an event (MRD-positive) was significantly shorter than those predicted MRD-negative (HR=33.4, p<0.005). For monitoring, HR=4.39, p=0.008. Uses tumor-naïve approach - no prior tissue profiling required.",
    "performanceCitations": "https://www.nature.com/articles/s41598-025-08986-0",
    "fdaStatus": "CLIA LDT",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Coverage expanding; contact Caris for current payer coverage.",
    "clinicalAvailability": "Commercially available in US since late 2022",
    "availableRegions": ["US"],
    "initialTat": 14,
    "initialTatNotes": "Initial MRD assessment typically 10-14 business days.",
    "followUpTat": 14,
    "sampleType": "Whole blood",
    "bloodVolume": 20,
    "bloodVolumeNotes": "Approximately 20mL whole blood; plasma and buffy coat analyzed separately.",
    "clinicalTrials": "MRD model validated on 86 patients; monitoring validated on 101 patients; 3,439 training samples",
    "totalParticipants": 3626,
    "numPublications": 5,
    "numPublicationsPlus": true,
    "numPublicationsCitations": "https://www.nature.com/articles/s41598-025-08986-0",
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "technologyDifferentiator": "Tumor-naïve MRD approach using AI/ML on WES/WTS data - no prior tissue profiling required. Only liquid biopsy sequencing both plasma and buffy coat for CHIP subtraction, improving accuracy over plasma-only assays."
  }
];

const ecdTestData = [
  {
    "id": "ecd-1",
    "sampleCategory": "Blood/Plasma",
    "name": "Shield",
    "vendor": "Guardant Health",
    "testScope": "Single-cancer (CRC)",
    "approach": "Blood-based cfDNA screening (plasma)",
    "method": "NGS detecting cfDNA methylation patterns + fragmentomics + somatic mutations (~1Mb genome coverage)",
    "cancerTypes": [
      "Colorectal cancer (colon and rectal)"
    ],
    "targetPopulation": "Average-risk adults 45-84 years without prior CRC; adenomas; IBD; or hereditary CRC syndromes",
    "indicationGroup": "CRC",
    "sensitivity": 83.1,
    "sensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477985/ | https://www.accessdata.fda.gov/cdrh_docs/pdf23/P230009B.pdf",
    "advancedAdenomaSensitivity": 13.2,
    "advancedAdenomaSensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477985/",
    "advancedAdenomaSensitivityNotes": "Limited sensitivity for precancerous advanced adenomas (13.2%); blood-based tests generally less effective at detecting polyps than stool-based tests.",
    "stageISensitivity": 54.5,
    "stageIISensitivity": 100.0,
    "stageIIISensitivity": 96.0,
    "stageIVSensitivity": 87.5,
    "specificity": 89.6,
    "specificityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477985/ | https://www.accessdata.fda.gov/cdrh_docs/pdf23/P230009B.pdf",
    "ppv": 3.1,
    "ppvCitations": "https://pubmed.ncbi.nlm.nih.gov/38477985/",
    "ppvDefinition": "PPV for colorectal cancer (CRC) in average-risk ECLIPSE screening population",
    "npv": 99.92,
    "npvCitations": "https://pubmed.ncbi.nlm.nih.gov/38477985/",
    "npvDefinition": "NPV for absence of CRC in average-risk ECLIPSE screening population",
    "performanceCitations": "https://pubmed.ncbi.nlm.nih.gov/38477985/ | https://www.accessdata.fda.gov/cdrh_docs/pdf23/P230009B.pdf",
    "performanceNotes": "In ECLIPSE cfDNA blood test showed 83% sensitivity for CRC with 90% specificity. Stage I sensitivity 55-65%; limited detection of advanced adenomas (13.2%).",
    "leadTimeNotes": "No formal lead-time vs colonoscopy; positioned as guideline-accepted primary screening option every 3 years in average-risk adults",
    "fdaStatus": "FDA-approved PMA (P230009) July 26 2024 - First blood test for primary CRC screening; NCCN-recommended",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare coverage per NCD 210.3; commercial coverage expanding",
    "commercialPayers": [],
    "commercialPayersCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2025/Guardant-Healths-Shield-Blood-Test-Now-Covered-for-VA-Community-Care-Beneficiaries/default.aspx",
    "commercialPayersNotes": "No commercial payer coverage yet. Government programs: VA Community Care Network covers Shield with no copay for average-risk individuals 45+; TRICARE also covers. Commercial insurance coverage pending USPSTF guideline inclusion and ACS recommendations. Once included in guidelines, expected to be covered under ACA preventive services.",
    "availableRegions": ["US"],
    "clinicalAvailability": "Commercially available in US since August 2024",
    "tat": "~14 days",
    "sampleType": "Whole blood in Guardant cfDNA BCT tubes",
    "sampleVolume": "4 tubes (minimum 2 mL plasma)",
    "sampleStability": "7 days at ambient temperature",
    "cptCode": "0537U",
    "listPrice": 895.0,
    "screeningInterval": "Every 3 years",
    "clinicalTrials": "NCT04136002 ECLIPSE CRC screening study (22877); NCT05716477 OSU Guardant Shield CRC Screening Project (300)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT04136002 | https://clinicaltrials.gov/study/NCT05716477",
    "totalParticipants": 23177,
    "numPublications": 5,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-2",
    "sampleCategory": "Blood/Plasma",
    "name": "Galleri",
    "vendor": "GRAIL",
    "testScope": "Multi-cancer (MCED)",
    "approach": "Blood-based cfDNA methylation MCED (plasma)",
    "method": "Tumor-naïve cfDNA methylation profiling with targeted NGS + machine-learning classifier; predicts cancer signal and tissue of origin (CSO)",
    "cancerTypes": [
      "50+ cancer types including colorectal, lung, pancreas, ovary, liver, head & neck, lymphoma, esophagus, stomach, bile duct, etc."
    ],
    "targetPopulation": "Asymptomatic adults ≥50 years as adjunct to standard single-cancer screening",
    "indicationGroup": "MCED",
    "sensitivity": 51.5,
    "sensitivityCitations": "https://www.galleri.com/hcp/galleri-test-performance | https://pmc.ncbi.nlm.nih.gov/articles/PMC11024170/",
    "stageISensitivity": 16.8,
    "stageIISensitivity": 40.4,
    "stageIIISensitivity": 77.0,
    "stageIVSensitivity": 90.1,
    "specificity": 99.5,
    "specificityCitations": "https://www.galleri.com/hcp/galleri-test-performance | https://grail.com/press-releases/final-results-from-pathfinder-study-of-grails-multi-cancer-early-detection-blood-test-published-in-the-lancet/",
    "ppv": 61.6,
    "ppvCitations": "https://www.galleri.com/hcp/galleri-test-performance",
    "ppvDefinition": "PPV for any cancer among participants with Cancer Signal Detected",
    "npv": 99.1,
    "npvCitations": "https://www.galleri.com/hcp/galleri-test-performance",
    "npvDefinition": "NPV for remaining cancer-free after No Cancer Signal Detected (12-month follow-up)",
    "tumorOriginAccuracy": 93,
    "tumorOriginAccuracyNotes": "Cancer Signal Origin (CSO) prediction accuracy: 93% top-1 prediction, 97% top-2 predictions in CCGA validation studies",
    "performanceCitations": "https://www.galleri.com/hcp/galleri-test-performance | https://pmc.ncbi.nlm.nih.gov/articles/PMC11024170/ | https://grail.com/press-releases/final-results-from-pathfinder-study-of-grails-multi-cancer-early-detection-blood-test-published-in-the-lancet/",
    "performanceNotes": "Overall cancer signal sensitivity ~51.5% with stage-specific sensitivity rising from ~17% at stage I to ~90% at stage IV; specificity ~99.5-99.6%.",
    "leadTimeNotes": "PATHFINDER and PATHFINDER 2 show ~7-fold increase in cancers detected when added to USPSTF A/B screening; median diagnostic resolution ~1.5 months",
    "fdaStatus": "LDT performed in CLIA-certified CAP-accredited lab; not FDA-approved; Breakthrough Device designation; PMA submission expected H1 2026",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Generally self-pay; most insurers and Medicare do not cover MCED as of 2025; TRICARE covers for ≥50 with elevated risk",
    "commercialPayers": ["Curative Insurance", "Fountain Health", "Alignment Health Plan"],
    "commercialPayersCitations": "https://grail.com/press-releases/curative-insurance-company-adds-grails-galleri-test-to-member-benefits-for-multi-cancer-early-detection/",
    "commercialPayersNotes": "Limited commercial coverage. Curative Insurance and Fountain Health offer $0 copay coverage. Alignment Health Plan (Medicare Advantage) covers in select CA/NC plans. Government programs: TRICARE covers with prior authorization for eligible beneficiaries ≥50. Most major commercial insurers consider investigational.",
    "availableRegions": ["US", "UK"],
    "clinicalAvailability": "Commercially available in US and some international markets as CLIA test since June 2021",
    "tat": "10-14 business days (up to 4 weeks during high volume)",
    "sampleType": "Whole blood in Streck cfDNA BCT tubes",
    "sampleVolume": "2 tubes",
    "sampleStability": "7 days at ambient temperature (1-40°C); do not refrigerate/freeze",
    "cptCode": "Proprietary",
    "listPrice": 949.0,
    "screeningInterval": "Annual recommended",
    "clinicalTrials": "NCT05611632 NHS-Galleri randomized screening trial (~140000); NCT05155605 PATHFINDER 2 safety/performance study (~35500); NCT03934866 SUMMIT high-risk lung cohort (13035)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT05611632 | https://clinicaltrials.gov/study/NCT05155605 | https://clinicaltrials.gov/study/NCT03934866",
    "totalParticipants": 188535,
    "numPublications": 20,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-3",
    "sampleCategory": "Stool",
    "name": "Cologuard Plus",
    "vendor": "Exact Sciences",
    "testScope": "Single-cancer (CRC)",
    "approach": "Stool-based multitarget DNA test",
    "method": "Multitarget stool DNA assay with 5 novel methylation markers + hemoglobin immunoassay; streamlined from original 11 markers",
    "cancerTypes": [
      "Colorectal cancer; Advanced precancerous lesions (APL); High-grade dysplasia"
    ],
    "targetPopulation": "Average-risk adults 45-75 years for CRC screening at home",
    "indicationGroup": "CRC",
    "sensitivity": 93.9,
    "sensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992 | https://investor.exactsciences.com/investor-relations/press-releases/press-release-details/2024/FDA-Approves-Exact-Sciences-Cologuard-Plus-Test-Setting-a-New-Benchmark-in-Non-Invasive-Colorectal-Cancer-Screening/default.aspx",
    "advancedAdenomaSensitivity": 43.4,
    "advancedAdenomaSensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992/",
    "advancedAdenomaSensitivityNotes": "43% sensitivity for advanced precancerous lesions (APL) including advanced adenomas and sessile serrated lesions ≥1cm; significantly outperforms FIT (23% for APL).",
    "stageISensitivity": 87.0,
    "stageISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992/",
    "stageIISensitivity": 94.0,
    "stageIISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992/",
    "stageIIISensitivity": 97.0,
    "stageIIISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992/",
    "stageIVSensitivity": 100.0,
    "stageIVSensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992/",
    "specificity": 91.0,
    "specificityCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992 | https://investor.exactsciences.com/investor-relations/press-releases/press-release-details/2024/FDA-Approves-Exact-Sciences-Cologuard-Plus-Test-Setting-a-New-Benchmark-in-Non-Invasive-Colorectal-Cancer-Screening/default.aspx",
    "ppv": 3.2,
    "ppvCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992/",
    "ppvDefinition": "PPV for colorectal cancer (CRC) in BLUE-C average-risk screening population",
    "npv": 99.98,
    "npvCitations": "https://pubmed.ncbi.nlm.nih.gov/38477992/",
    "npvDefinition": "NPV for absence of CRC in BLUE-C average-risk screening population",
    "performanceCitations": "BLUE-C pivotal trial NEJM 2024 (n=20000+); DeeP-C studies",
    "performanceNotes": "Pivotal data show 94% sensitivity for CRC and 43% for APL; significantly outperforms FIT (94% vs 67% for CRC; 43% vs 23% for APL).",
    "leadTimeNotes": "Non-invasive alternative to colonoscopy; 30% lower false positive rate vs original Cologuard; significantly improved adherence vs colonoscopy",
    "fdaStatus": "FDA-approved PMA October 4 2024",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare coverage; $0 out-of-pocket for eligible; broad commercial payer coverage",
    "commercialPayers": ["Humana"],
    "commercialPayersCitations": "https://www.cologuard.com/insurance",
    "commercialPayersNotes": "Cologuard Plus confirmed coverage: Medicare Part B and Humana Medicare Advantage. Government programs: TRICARE expected based on legacy Cologuard coverage. Other major commercial payers (UnitedHealthcare, Aetna, Cigna, Anthem BCBS) anticipated to extend legacy Cologuard coverage to Plus but should be validated per plan.",
    "clinicalAvailability": "Commercially launched late March 2025 via ExactNexus (350+ health systems)",
    "tat": "3-5 days from receipt",
    "sampleType": "At-home stool collection with enhanced preservatives",
    "sampleVolume": "Stool sample",
    "sampleStability": "Extended return window vs original",
    "cptCode": "0464U",
    "listPrice": 790.0,
    "screeningInterval": "Every 3 years",
    "clinicalTrials": "NCT04144738 BLUE-C pivotal Cologuard Plus CRC screening trial (26758)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT04144738",
    "totalParticipants": 26758,
    "numPublications": 2,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-4",
    "sampleCategory": "Stool",
    "name": "ColoSense",
    "vendor": "Geneoscopy",
    "testScope": "Single-cancer (CRC)",
    "approach": "Stool-based multitarget RNA test",
    "method": "8 stool-derived eukaryotic RNA (seRNA) transcripts via ddPCR + FIT - first FDA-approved RNA-based cancer screening test",
    "cancerTypes": [
      "Colorectal cancer; Advanced adenomas; Sessile serrated lesions"
    ],
    "targetPopulation": "Average-risk adults 45+ years for CRC screening",
    "indicationGroup": "CRC",
    "sensitivity": 93.0,
    "sensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/37930717 | https://www.accessdata.fda.gov/cdrh_docs/pdf23/P230001B.pdf",
    "stageISensitivity": 100.0,
    "stageISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/37930717/",
    "stageIISensitivity": 71.4,
    "stageIISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/37930717/",
    "stageIIISensitivity": 100.0,
    "stageIIISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/37930717/",
    "specificity": 88.0,
    "specificityCitations": "https://pubmed.ncbi.nlm.nih.gov/37930717 | https://www.accessdata.fda.gov/cdrh_docs/pdf23/P230001B.pdf",
    "ppv": 1.9,
    "ppvCitations": "https://pubmed.ncbi.nlm.nih.gov/37930717/",
    "ppvDefinition": "PPV for colorectal cancer (CRC) in PMA primary effectiveness cohort",
    "npv": 94.4,
    "npvCitations": "https://pubmed.ncbi.nlm.nih.gov/37930717/",
    "npvDefinition": "NPV for no advanced colorectal neoplasia (NAPL or negative colonoscopy)",
    "performanceCitations": "CRC-PREVENT JAMA 2023 (n=14263)",
    "performanceNotes": "CRC sensitivity 93-94% with 100% Stage I detection; advanced adenoma 45-46%; specificity 88%; outperforms FIT (94% vs 78% CRC; 46% vs 29% AA).",
    "leadTimeNotes": "Non-invasive RNA-based alternative; 100% Stage I sensitivity notable",
    "fdaStatus": "FDA-approved PMA May 3 2024; Breakthrough Device Designation January 2020",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Medicare coverage pending - NCD reconsideration requested; NCCN Guidelines included",
    "commercialPayers": [],
    "commercialPayersCitations": "",
    "commercialPayersNotes": "Emerging commercial and Medicaid coverage; no stable payer list yet. Medicare coverage pending NCD reconsideration.",
    "clinicalAvailability": "Launched via Labcorp partnership late 2024/early 2025",
    "tat": "Not publicly specified",
    "sampleType": "At-home stool collection (simplified kit FDA-approved 2025)",
    "sampleVolume": "Stool sample",
    "sampleStability": "Not specified",
    "cptCode": "0421U",
    "listPrice": 508.87,
    "screeningInterval": "Every 3 years (USPSTF)",
    "clinicalTrials": "NCT04739722 CRC-PREVENT pivotal ColoSense stool RNA CRC screening trial (14263)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT04739722",
    "totalParticipants": 8920,
    "numPublications": 3,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-5",
    "sampleCategory": "Blood/Plasma",
    "name": "Cancerguard",
    "vendor": "Exact Sciences",
    "testScope": "Multi-cancer (MCED)",
    "approach": "Blood-based multi-biomarker MCED (plasma)",
    "method": "cfDNA methylation + tumor-associated proteins + DNA mutation reflex testing - first multi-biomarker class MCED",
    "cancerTypes": [
      "50+ cancer types (excludes breast and prostate); 6 deadliest cancers: pancreatic, lung, liver, esophageal, stomach, ovarian"
    ],
    "targetPopulation": "Adults 50-84 years with no cancer diagnosis in past 3 years",
    "indicationGroup": "MCED",
    "sensitivity": 64.0,
    "sensitivityCitations": "https://www.exactsciences.com/cancer-testing/cancerguard-mced-providers/resources",
    "specificity": 97.4,
    "specificityCitations": "https://www.exactsciences.com/cancer-testing/cancerguard-mced-providers/resources",
    "ppv": 19.4,
    "ppvDefinition": "PPV for any cancer in DETECT-A CancerSEEK interventional study",
    "npv": 99.3,
    "npvDefinition": "NPV for absence of any cancer in DETECT-A CancerSEEK interventional study",
    "tumorOriginAccuracy": null,
    "tumorOriginAccuracyNotes": "Does not predict tissue of origin; uses imaging-guided diagnostic resolution pathway instead (up to $6,000 covered imaging workup)",
    "performanceCitations": "DETECT-A (n=10006); ASCEND-2 (n=6354); FALCON Registry (n=25000 ongoing)",
    "performanceNotes": "64% sensitivity for 17 cancer types excluding breast/prostate; 68% for 6 deadliest cancers; >33% early-stage (I-II) detected; 97.4% specificity.",
    "leadTimeNotes": "First-of-its-kind multi-biomarker approach; imaging-guided resolution (no tissue of origin prediction)",
    "fdaStatus": "LDT; not FDA-approved; Breakthrough Device Designation (via CancerSEEK)",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Not covered by Medicare or commercial payers; not billed to insurance; FSA/HSA eligible",
    "clinicalAvailability": "Launched September 2025 via Quest Diagnostics (7000+ sites)",
    "availableRegions": ["US"],
    "tat": "Not publicly specified",
    "sampleType": "Whole blood in LBgard tubes",
    "sampleVolume": "4 tubes × 8.5 mL = 34 mL total",
    "sampleStability": "72 hours at room temperature (15-25°C)",
    "cptCode": "Proprietary",
    "listPrice": 689.0,
    "screeningInterval": "Annual recommended",
    "clinicalTrials": "DETECT-A prospective interventional MCED (10006); ASCEND-2 classifier development (6354); NCT06589310 FALCON Registry (25000 target)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT06589310",
    "totalParticipants": 16360,
    "numPublications": 2,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-6",
    "sampleCategory": "Blood/Plasma",
    "name": "Freenome CRC Blood Test",
    "vendor": "Freenome",
    "testScope": "Single-cancer (CRC)",
    "approach": "Blood-based cfDNA multiomics (plasma)",
    "method": "AI/ML analyzing genomic + epigenomic (single-base methylation) + proteomic biomarkers",
    "cancerTypes": [
      "Colorectal cancer; Advanced adenomas"
    ],
    "targetPopulation": "Average-risk adults for CRC screening",
    "indicationGroup": "CRC",
    "sensitivity": 79.2,
    "sensitivityCitations": "https://www.freenome.com/newsroom/freenome-announces-topline-results-for-preempt-crc-to-validate-the-first-version-of-its-blood-based-test-for-the-early-detection-of-colorectal-cancer | https://ascopubs.org/doi/10.1200/JCO.2025.43.4_suppl.18",
    "stageISensitivity": 57.1,
    "stageISensitivityCitations": "https://www.freenome.com/newsroom/freenome-announces-topline-results-for-preempt-crc-to-validate-the-first-version-of-its-blood-based-test-for-the-early-detection-of-colorectal-cancer/",
    "stageIISensitivity": 100.0,
    "stageIISensitivityCitations": "https://www.freenome.com/newsroom/freenome-announces-topline-results-for-preempt-crc-to-validate-the-first-version-of-its-blood-based-test-for-the-early-detection-of-colorectal-cancer/",
    "stageIIISensitivity": 82.4,
    "stageIIISensitivityCitations": "https://www.freenome.com/newsroom/freenome-announces-topline-results-for-preempt-crc-to-validate-the-first-version-of-its-blood-based-test-for-the-early-detection-of-colorectal-cancer/",
    "stageIVSensitivity": 100.0,
    "stageIVSensitivityCitations": "https://www.freenome.com/newsroom/freenome-announces-topline-results-for-preempt-crc-to-validate-the-first-version-of-its-blood-based-test-for-the-early-detection-of-colorectal-cancer/",
    "specificity": 91.5,
    "specificityCitations": "https://www.freenome.com/newsroom/freenome-announces-topline-results-for-preempt-crc-to-validate-the-first-version-of-its-blood-based-test-for-the-early-detection-of-colorectal-cancer | https://ascopubs.org/doi/10.1200/JCO.2025.43.4_suppl.18",
    "ppvDefinition": "PPV for advanced colorectal neoplasia in PREEMPT CRC (not yet populated)",
    "npvDefinition": "NPV for advanced colorectal neoplasia in PREEMPT CRC (not yet populated)",
    "performanceCitations": "PREEMPT CRC JAMA June 2025 (n=48995 enrolled; 27010 analyzed)",
    "performanceNotes": "79.2% CRC sensitivity with 57.1% Stage I; 12.5% advanced adenoma (29% for high-grade dysplasia); 91.5% specificity.",
    "leadTimeNotes": "Largest blood-based CRC screening study (PREEMPT CRC n=48995); multiomics approach combines multiple biomarker classes",
    "fdaStatus": "PMA application submitted (final module August 2025); Exact Sciences exclusive US licensing agreement announced August 2025",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Not yet established",
    "clinicalAvailability": "Not yet commercially available - pending FDA approval",
    "tat": "Not applicable - not yet available",
    "sampleType": "Blood",
    "sampleVolume": "Not specified",
    "sampleStability": "Not specified",
    "cptCode": "UNKNOWN",
    "screeningInterval": "Expected every 3 years",
    "clinicalTrials": "NCT04369053 PREEMPT CRC registrational Freenome blood-based CRC screening study (48995 enrolled; 27010 analyzed)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT04369053",
    "totalParticipants": 48995,
    "numPublications": 2,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-7",
    "sampleCategory": "Blood/Plasma",
    "name": "FirstLook Lung",
    "vendor": "DELFI Diagnostics",
    "testScope": "Single-cancer (Lung)",
    "approach": "Blood-based cfDNA fragmentomics",
    "method": "Low-pass whole genome sequencing analyzing cfDNA fragment length patterns + ML classifier - detects chaotic DNA packaging from cancer cells",
    "cancerTypes": [
      "Lung cancer (screening enhancement - pre-LDCT risk stratification)"
    ],
    "targetPopulation": "USPSTF-eligible: Adults 50-80 years; ≥20 pack-years smoking history; current smokers or quit within 15 years",
    "indicationGroup": "Lung",
    "sensitivity": 80.0,
    "sensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38829053/",
    "stageISensitivity": 71.0,
    "stageISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38829053/",
    "stageIISensitivity": 89.0,
    "stageIISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38829053/",
    "stageIIISensitivity": 88.0,
    "stageIIISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38829053/",
    "stageIVSensitivity": 98.0,
    "stageIVSensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/38829053/",
    "specificity": 58.0,
    "specificityCitations": "https://pubmed.ncbi.nlm.nih.gov/38829053/",
    "ppvDefinition": "PPV for lung cancer among Elevated results in high-risk USPSTF screening population",
    "npv": 99.7,
    "npvCitations": "https://pubmed.ncbi.nlm.nih.gov/38829053/",
    "npvDefinition": "NPV for being lung-cancer free among Not Elevated results in high-risk USPSTF screening population",
    "performanceCitations": "DELFI-L101 Cancer Discovery 2024 (n=958); CASCADE-LUNG/L201 (NCT05306288); FIRSTLung/L301 (NCT06145750)",
    "performanceNotes": "80% overall sensitivity (71% Stage I; 98% Stage IV); 58% specificity; 99.7% NPV; fragmentomics approach novel mechanism.",
    "leadTimeNotes": "Pre-LDCT risk stratification; 5.5× higher cancer likelihood with Elevated result; designed to increase LDCT uptake (currently only 6% eligible adults screened)",
    "fdaStatus": "LDT; FDA IVD submission planned",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Not established; not covered by Medicare",
    "clinicalAvailability": "Early Experience Program at select health systems (OSF HealthCare; City of Hope; Indigenous Pact)",
    "tat": "10-14 business days",
    "sampleType": "Standard blood draw",
    "sampleVolume": "<1 mL plasma required",
    "sampleStability": "Standard",
    "cptCode": "UNKNOWN",
    "listPrice": 300.0,
    "screeningInterval": "Annual (complement to LDCT)",
    "clinicalTrials": "NCT05306288 CASCADE-LUNG prospective validation (15000 target); NCT04825834 DELFI-L101 case-control development (958); NCT06145750 FIRSTLung cluster RCT (ongoing)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT05306288 | https://clinicaltrials.gov/study/NCT04825834 | https://clinicaltrials.gov/study/NCT06145750",
    "totalParticipants": 15958,
    "numPublications": 3,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-8",
    "sampleCategory": "Blood/Plasma",
    "name": "HelioLiver",
    "vendor": "Helio Genomics",
    "testScope": "Single-cancer (HCC/Liver)",
    "approach": "Blood-based cfDNA methylation + protein biomarkers",
    "method": "AI algorithm analyzing cfDNA methylation patterns + AFP + AFP-L3 + DCP + demographics",
    "cancerTypes": [
      "Hepatocellular carcinoma (HCC)"
    ],
    "targetPopulation": "Adults with cirrhosis; chronic HBV carriers; high-risk for HCC",
    "indicationGroup": "Liver",
    "sensitivity": 85.0,
    "sensitivityCitations": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9234637/",
    "stageISensitivity": 76.0,
    "stageISensitivityCitations": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9234637/",
    "specificity": 91.0,
    "specificityCitations": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9234637/",
    "ppvDefinition": "PPV for hepatocellular carcinoma (HCC) in high-risk surveillance population (cirrhosis / chronic HBV)",
    "npvDefinition": "NPV for absence of HCC in high-risk surveillance population (cirrhosis / chronic HBV)",
    "performanceCitations": "ENCORE Hepatology Communications 2022 (n=247); CLiMB EASL 2024 (n=1968); VICTORY (n=1100)",
    "performanceNotes": "85% overall sensitivity with 76% early-stage; 91% specificity; AUC 0.944 vs AFP 0.851 and GALAD 0.899.",
    "leadTimeNotes": "Significantly outperforms ultrasound for early-stage HCC detection (44.4% vs 11.1% for T1 tumors); designed as surveillance tool",
    "fdaStatus": "PMA submitted Q2 2024 (Class III); currently LDT",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Expected upon FDA approval; CPT code 0333U assigned",
    "clinicalAvailability": "Commercially available as LDT",
    "tat": "Not publicly specified",
    "sampleType": "Blood (serum for proteins; plasma for cfDNA)",
    "sampleVolume": "Standard blood draw",
    "sampleStability": "Standard",
    "cptCode": "0333U",
    "screeningInterval": "Every 6 months (per AASLD)",
    "clinicalTrials": "NCT05059665 ENCORE validation (247); NCT03694600 CLiMB prospective HCC surveillance (1968); VICTORY study (1100)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT05059665 | https://clinicaltrials.gov/study/NCT03694600",
    "totalParticipants": 3315,
    "numPublications": 2,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-9",
    "sampleCategory": "Blood/Plasma",
    "name": "Oncoguard Liver",
    "vendor": "Exact Sciences",
    "testScope": "Single-cancer (HCC/Liver)",
    "approach": "Blood-based methylated DNA markers + protein",
    "method": "3 methylated DNA markers (HOXA1; EMX1; TSPYL5) + AFP + biological sex; LQAS PCR technology; developed with Mayo Clinic",
    "cancerTypes": [
      "Hepatocellular carcinoma (HCC)"
    ],
    "targetPopulation": "Adults with cirrhosis; chronic HBV; high-risk for HCC requiring surveillance",
    "indicationGroup": "Liver",
    "sensitivity": 88.0,
    "sensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/34419598/",
    "stageISensitivity": 82.0,
    "stageISensitivityCitations": "https://pubmed.ncbi.nlm.nih.gov/34419598/",
    "specificity": 87.0,
    "specificityCitations": "https://pubmed.ncbi.nlm.nih.gov/34419598/",
    "ppvDefinition": "PPV for HCC in high-risk surveillance population (ALTUS / validation cohorts)",
    "npvDefinition": "NPV for absence of HCC in high-risk surveillance population (ALTUS / validation cohorts)",
    "performanceCitations": "Phase II validation CGH 2021; ALTUS NCT05064553 (n>3000) November 2025",
    "performanceNotes": "88% overall sensitivity; 82% early-stage (BCLC 0/A); 87% specificity; AUC 0.91 vs AFP 0.84 and GALAD 0.88.",
    "leadTimeNotes": "ALTUS study shows 77% early-stage vs 36% for ultrasound; 64% very early-stage vs 9% for ultrasound (6-7× improvement)",
    "fdaStatus": "LDT; Breakthrough Device Designation October 2019",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "NOT covered by Medicare; financial assistance available (1-844-870-8870)",
    "clinicalAvailability": "Commercially available",
    "tat": "~1 week",
    "sampleType": "Blood (Exact Sciences collection kit)",
    "sampleVolume": "Standard blood draw",
    "sampleStability": "Standard",
    "cptCode": "81599",
    "screeningInterval": "Every 3-6 months",
    "clinicalTrials": "NCT05064553 ALTUS prospective HCC surveillance (3000+); Phase II validation CGH 2021",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT05064553",
    "totalParticipants": 3000,
    "numPublications": 3,
    "numPublicationsPlus": true
  },
  {
    "id": "ecd-10",
    "sampleCategory": "Blood/Plasma",
    "name": "Shield MCD",
    "vendor": "Guardant Health",
    "testScope": "Multi-cancer (MCED)",
    "approach": "Blood-based cfDNA methylation MCED (plasma)",
    "method": "Methylation-based NGS cfDNA platform detecting 10 cancer types; same Shield platform as CRC test with expanded analysis; requires physician opt-in and patient authorization for EMR data release",
    "cancerTypes": [
      "Bladder; Colorectal; Esophageal; Gastric; Liver; Lung; Ovarian; Pancreas; Breast; Prostate (10 tumor types)"
    ],
    "targetPopulation": "Average-risk adults 45+ years; ordered as add-on when physician requests Shield CRC test",
    "indicationGroup": "MCED",
    "tumorOriginAccuracy": null,
    "tumorOriginAccuracyNotes": "Cancer signal of origin prediction included; specific accuracy not yet publicly disclosed; performance data presented at AACR/ASCO 2025",
    "sensitivity": 60.0,
    "sensitivityCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2025/Guardant-Health-Presents-Data-Demonstrating-Strong-Performance-of-Shield-Multi-Cancer-Detection-Test-Across-10-Tumor-Types/default.aspx",
    "sensitivityNotes": "Overall episode-based sensitivity ~60% across all 10 cancer types; ~74% sensitivity for subset of deadliest/aggressive cancers. Data from interim MCED performance presented at AACR/ASCO 2025.",
    "sensitivityType": "episode-based interim",
    "specificity": 98.5,
    "specificityCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2025/Guardant-Health-Presents-Data-Demonstrating-Strong-Performance-of-Shield-Multi-Cancer-Detection-Test-Across-10-Tumor-Types/default.aspx",
    "specificityNotes": "~98.5% specificity from interim Shield MCED data. High specificity critical for screening use to minimize false positives.",
    "ppvDefinition": "PPV for any of 10 target cancers among positive Shield MCD results (not yet reported)",
    "npvDefinition": "NPV for remaining cancer-free among negative Shield MCD results (not yet reported)",
    "performanceCitations": "AACR 2025 oral presentation; ASCO 2025; NCI Vanguard Study (NCT pending; n=24000); Guardant Health Investor Relations 2025",
    "performanceNotes": "Overall sensitivity ~60% across all cancers; ~74% sensitivity for subset of deadliest cancers; ~98.5% specificity. Performance data from interim MCED analysis supported NCI selection for Vanguard Study.",
    "leadTimeNotes": "Available as add-on to Shield CRC screening; physician must opt-in and patient must authorize release of medical records to Guardant in exchange for MCD results",
    "fdaStatus": "LDT; FDA Breakthrough Device Designation (June 2025); selected for NCI Vanguard Study (24000 participants); Shield MCD reviewed by FDA as part of NCI investigational device exemption (IDE)",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Not covered by Medicare or commercial payers; no additional cost when ordered with Shield CRC (data exchange model)",
    "clinicalAvailability": "Launched nationally October 2025; available when ordering Shield CRC test with physician opt-in",
    "availableRegions": ["US"],
    "tat": "~14 days (same blood draw as Shield CRC)",
    "sampleType": "Whole blood in Guardant cfDNA BCT tubes (same sample as Shield CRC)",
    "sampleVolume": "4 tubes (no additional blood draw required)",
    "sampleStability": "7 days at ambient temperature",
    "cptCode": "UNKNOWN",
    "screeningInterval": "Annual recommended (with Shield CRC every 3 years)",
    "clinicalTrials": "NCI Vanguard Study multi-cancer detection feasibility (24000 target); AACR 2025 presentations; ASCO 2025 presentations",
    "totalParticipants": 24000,
    "numPublications": 0
  },
  {
    "id": "ecd-11",
    "sampleCategory": "Blood/Plasma",
    "name": "EPISEEK",
    "vendor": "Precision Epigenomics",
    "testScope": "Multi-cancer (MCED)",
    "approach": "Blood-based cfDNA methylation MCED (plasma)",
    "method": "Methylation-specific PCR detecting hypermethylated cfDNA loci across 60+ cancer types including all 20 most fatal cancers; does not use NGS; analyzes 10 cancer biomarkers",
    "cancerTypes": [
      "60+ cancer types including all 20 most fatal cancers: lung, liver, pancreas, esophageal, bladder, stomach, head & neck SCC, uterine, low-grade glioma, high-grade glioma (brain cancer detection believed unique among blood-based MCED tests)"
    ],
    "targetPopulation": "Adults 45+ years with elevated cancer risk; can be considered from age 21 with risk factors (smoking, family history)",
    "indicationGroup": "MCED",
    "tumorOriginAccuracy": null,
    "tumorOriginAccuracyNotes": "Does not predict tissue of origin (no CSO/TOO); requires standard diagnostic workup to localize cancer source",
    "sensitivity": 54.0,
    "sensitivityCitations": "https://ascopubs.org/doi/10.1200/JCO.2025.43.16_suppl.3144 | https://precision-epigenomics.com/precision-epigenomics-presents-validation-of-episeek-a-multi-cancer-early-detection-test-at-2025-asco-annual-meeting/",
    "sensitivityNotes": "Overall incidence-adjusted sensitivity (IAS) across all stages. IAS is more conservative than observed sensitivity as it weights by cancer incidence.",
    "stageISensitivity": 45.0,
    "stageISensitivityCitations": "https://precision-epigenomics.com/precision-epigenomics-presents-validation-of-episeek-a-multi-cancer-early-detection-test-at-2025-asco-annual-meeting/",
    "stageIISensitivity": 45.0,
    "stageIISensitivityCitations": "https://precision-epigenomics.com/precision-epigenomics-presents-validation-of-episeek-a-multi-cancer-early-detection-test-at-2025-asco-annual-meeting/",
    "stageISensitivityNotes": "Combined Stage I/II IAS = 45%. For aggressive unscreened cancers (bladder, esophagus, liver, H&N, lung, pancreas, stomach, uterine) Stage I/II sensitivity is 57%.",
    "stageIIISensitivity": 73.0,
    "stageIIISensitivityCitations": "https://precision-epigenomics.com/precision-epigenomics-presents-validation-of-episeek-a-multi-cancer-early-detection-test-at-2025-asco-annual-meeting/",
    "stageIVSensitivity": 74.0,
    "stageIVSensitivityCitations": "https://precision-epigenomics.com/precision-epigenomics-presents-validation-of-episeek-a-multi-cancer-early-detection-test-at-2025-asco-annual-meeting/",
    "specificity": 99.5,
    "specificityCitations": "https://ascopubs.org/doi/10.1200/JCO.2025.43.16_suppl.3144 | https://precision-epigenomics.com/precision-epigenomics-presents-validation-of-episeek-a-multi-cancer-early-detection-test-at-2025-asco-annual-meeting/",
    "ppv": 64.9,
    "ppvDefinition": "PPV in validation cohort (n=482). Modeled PPV of 40% in screening population age 50+.",
    "npv": 99.5,
    "npvDefinition": "NPV for absence of cancer in validation cohort",
    "performanceCitations": "Pham TH et al. J Clin Oncol 2025;43(16_suppl):3144. ASCO 2025 Annual Meeting.",
    "performanceNotes": "Validation included 281 cancer-positive plasma samples across all stages and 201 healthy controls age 40+. Analytical LOD <0.1 ng cfDNA for 8/10 biomarkers. Uses incidence-adjusted sensitivity (more conservative than observed sensitivity).",
    "leadTimeNotes": "No lead time vs imaging data reported; designed for asymptomatic screening",
    "fdaStatus": "CLIA LDT – NOT FDA approved",
    "reimbursement": "Self-Pay",
    "reimbursementNote": "No Medicare or commercial insurance coverage. Positioned as affordable/accessible alternative to NGS-based MCED tests.",
    "commercialPayers": [],
    "clinicalAvailability": "Commercially available in US via CLIA-certified lab in Tucson, AZ. Physician-ordered (not direct-to-consumer).",
    "availableRegions": ["US"],
    "tat": "5 days",
    "tatNotes": "Collection to report turnaround time (includes shipping and processing). Lab processing time is 2-3 days.",
    "sampleType": "Two 10-mL Streck cfDNA BCT tubes",
    "sampleVolume": "20 mL whole blood (two 10-mL tubes)",
    "cptCode": "UNKNOWN",
    "listPrice": 699,
    "screeningInterval": "Not specified",
    "clinicalTrials": "ASCO 2025 validation study (n=482); simulated 100,000-patient SEER-based screening cohort modeling",
    "totalParticipants": 482,
    "numPublications": 1,
    "numPublicationsPlus": false,
    "technologyDifferentiator": "PCR-based (not NGS) - enables faster TAT, lower cost, and global scalability vs sequencing-based MCED tests"
  },
  {
    "id": "ecd-12",
    "sampleCategory": "Blood/Plasma",
    "name": "ProVue Lung",
    "vendor": "PrognomiQ",
    "testScope": "Single-cancer (Lung)",
    "approach": "Blood-based proteomics",
    "method": "Proteomics-based analysis using proprietary multi-omics platform to detect unique molecular protein signatures of lung cancer; does not analyze ctDNA or methylation",
    "cancerTypes": [
      "Lung cancer (all types)"
    ],
    "targetPopulation": "High-risk adults aged 50+ with 20+ pack-year smoking history; consistent with USPSTF, ACS, and NCCN lung cancer screening guidelines",
    "indicationGroup": "Lung",
    "tumorOriginAccuracy": null,
    "tumorOriginAccuracyNotes": "Single-cancer test; lung-specific",
    "sensitivity": 85.0,
    "sensitivityCitations": "https://www.globenewswire.com/news-release/2025/11/18/3190424/0/en/UPDATE-PrognomiQ-Launches-ProVue-Lung-a-Proteomics-Based-Laboratory-Developed-Test-to-Aid-in-the-Early-Detection-of-Lung-Cancer.html | https://prognomiq.com/provue/",
    "sensitivityNotes": "Overall sensitivity for all stages of lung cancer",
    "stageISensitivity": 81.0,
    "stageISensitivityCitations": "https://www.globenewswire.com/news-release/2025/11/18/3190424/0/en/UPDATE-PrognomiQ-Launches-ProVue-Lung-a-Proteomics-Based-Laboratory-Developed-Test-to-Aid-in-the-Early-Detection-of-Lung-Cancer.html",
    "stageISensitivityNotes": "Stage I sensitivity when treatment is most effective",
    "specificity": 55.0,
    "specificityCitations": "https://www.globenewswire.com/news-release/2025/11/18/3190424/0/en/UPDATE-PrognomiQ-Launches-ProVue-Lung-a-Proteomics-Based-Laboratory-Developed-Test-to-Aid-in-the-Early-Detection-of-Lung-Cancer.html | https://prognomiq.com/provue/",
    "specificityNotes": "Lower specificity results in higher false positive rate; designed as adjunct to LDCT screening",
    "npv": 99.8,
    "npvNotes": "NPV >99.8% indicates strong rule-out capability",
    "ppvDefinition": "Not publicly reported",
    "npvDefinition": "NPV for absence of lung cancer in high-risk screening population",
    "performanceCitations": "Unpublished data on file; manuscript under preparation. PrognomiQ website and press release Nov 2025.",
    "performanceNotes": "Validated in multiple prospective case-control studies. Binary result (ELEVATED or NOT ELEVATED). 85% sensitivity all-stage, 81% Stage I, 55% specificity, >99.8% NPV.",
    "leadTimeNotes": "Designed as adjunct to low-dose CT (LDCT); aims to improve screening compliance (currently <16% of eligible patients undergo annual LDCT)",
    "fdaStatus": "CLIA LDT – NOT FDA approved",
    "fdaStatusNotes": "Laboratory is CLIA-certified and CAP-accredited. Not cleared or approved by FDA.",
    "reimbursement": "Self-Pay",
    "reimbursementNote": "No Medicare or commercial insurance coverage established. Available through Early Experience Program.",
    "commercialPayers": [],
    "clinicalAvailability": "Limited availability - Early Experience Program at select Pennsylvania health systems (Allegheny Health Network, Penn Highlands Healthcare Lung Innovations Network). Launched November 18, 2025.",
    "clinicalAvailabilityNotes": "Initial commercial launch through Early Experience Program to evaluate clinical workflow integration. Broader availability expected as program expands.",
    "tat": "Not publicly specified",
    "sampleType": "Blood (simple blood draw)",
    "sampleVolume": "Standard blood draw",
    "cptCode": "UNKNOWN",
    "listPrice": null,
    "listPriceNotes": "Pricing not publicly disclosed",
    "screeningInterval": "Not specified; designed to complement annual LDCT screening",
    "clinicalTrials": "Multiple prospective case-control validation studies (unpublished); Early Experience Program at Allegheny Health Network and Penn Highlands Healthcare",
    "totalParticipants": null,
    "totalParticipantsNotes": "Validation study size not publicly disclosed; manuscript under preparation",
    "numPublications": 0,
    "numPublicationsPlus": false,
    "numPublicationsNotes": "Manuscript under preparation; data presented on company website",
    "technologyDifferentiator": "Proteomics-based (not ctDNA/methylation) - first protein-based liquid biopsy for lung cancer detection; measures protein biomarkers rather than genetic or epigenetic signals; simple blood draw with no specialized collection tubes"
  },
  {
    "id": "ecd-13",
    "sampleCategory": "Blood/Plasma",
    "name": "Signal-C",
    "vendor": "Universal DX",
    "testScope": "Single-cancer (Colorectal)",
    "approach": "cfDNA methylation + fragmentation",
    "method": "Next-generation sequencing (NGS) analyzing cell-free DNA methylation patterns and fragmentation characteristics; multi-omics approach combining methylomics, fragmentomics, and machine learning algorithms to detect colorectal cancer and advanced adenomas from a single blood draw",
    "cancerTypes": [
      "Colorectal cancer (CRC)",
      "Advanced adenomas (pre-cancerous)"
    ],
    "targetPopulation": "Average-risk adults aged 45+ eligible for colorectal cancer screening per USPSTF guidelines",
    "indicationGroup": "CRC",
    "tumorOriginAccuracy": null,
    "tumorOriginAccuracyNotes": "Single-cancer test; colorectal-specific",
    "sensitivity": 93,
    "sensitivityCitations": "https://www.businesswire.com/news/home/20230509005536/en | https://newsroom.questdiagnostics.com/2023-11-20-Universal-DX-Announces-Strategic-Collaboration-with-Quest-Diagnostics|https://www.universaldx.com/science",
    "sensitivityNotes": "93% sensitivity for CRC detection in 1,000-patient multi-cohort study presented at DDW 2023. Company website reports 92% sensitivity with 94% specificity in some materials - slight variations across presentations.",
    "stageISensitivity": 85,
    "stageISensitivityNotes": "Estimated from early-stage (I-II) combined sensitivity of 91%; Stage I likely ~85% based on typical stage distribution patterns. Exact Stage I data not separately reported.",
    "stageIISensitivity": 94,
    "stageIISensitivityNotes": "Estimated; early-stage (I-II) combined reported as 91%",
    "stageIIISensitivity": 97,
    "stageIIISensitivityNotes": "Later stages typically show higher sensitivity; estimated based on overall 93% and early-stage 91%",
    "stageIVSensitivity": 97,
    "stageIVSensitivityNotes": "Later stages typically show higher sensitivity; estimated based on overall 93% and early-stage 91%",
    "advancedAdenomaSensitivity": 54,
    "advancedAdenomaSensitivityCitations": "https://www.businesswire.com/news/home/20230509005536/en | https://newsroom.questdiagnostics.com/2023-11-20-Universal-DX-Announces-Strategic-Collaboration-with-Quest-Diagnostics",
    "advancedAdenomaSensitivityNotes": "54% sensitivity for advanced adenomas at 92% specificity. This pre-cancer detection capability is a key differentiator - may help prevent CRC, not just detect it.",
    "specificity": 92,
    "specificityCitations": "https://www.businesswire.com/news/home/20230509005536/en | https://www.universaldx.com/science",
    "specificityNotes": "92% specificity in DDW 2023 study. Some company materials report 94% specificity - may reflect different cohorts or thresholds.",
    "ppv": null,
    "ppvNotes": "Not publicly reported from validation studies",
    "npv": null,
    "npvNotes": "Not publicly reported from validation studies",
    "performanceCitations": "DDW 2023 presentation; ASCO GI 2023 presentation; https://www.universaldx.com/science",
    "performanceNotes": "Large 1,000-patient international multi-cohort case-control study with prospectively collected samples from US and Europe. Performance validated across multiple presentations at ASCO GI 2023 and DDW 2023.",
    "leadTimeNotes": "Blood-based alternative to colonoscopy and stool-based tests; aims to increase screening compliance among the ~40% of eligible adults not up-to-date on CRC screening",
    "fdaStatus": "Investigational – FDA pivotal trial ongoing",
    "fdaStatusCitations": "https://clinicaltrials.gov/study/NCT06059963 | https://www.businesswire.com/news/home/20240807274324/en/Universal-DX-Initiates-Clinical-Trial-for-FDA-Approval-of-Signal-C-Colorectal-Cancer-Screening-Blood-Test",
    "fdaStatusNotes": "FDA premarket approval (PMA) pivotal trial initiated January 2024. Targeting enrollment of 15,000+ patients across 100 investigator sites. Quest Diagnostics oncology center in Lewisville, TX serves as single testing site for trial.",
    "reimbursement": "Not yet established",
    "reimbursementNote": "Pending FDA approval; not currently available for clinical use in US",
    "commercialPayers": [],
    "clinicalAvailability": "Not yet commercially available – FDA pivotal trial in progress",
    "clinicalAvailabilityNotes": "Quest Diagnostics has exclusive US commercialization rights pending FDA approval (collaboration announced November 2023). Commercial launch expected following PMA approval.",
    "tat": "Not specified",
    "tatNotes": "Turnaround time not publicly disclosed; will be determined for commercial launch",
    "sampleType": "Blood (single draw)",
    "sampleVolume": "Not specified",
    "cptCode": "TBD",
    "cptCodesNotes": "CPT code to be established upon FDA approval and commercial launch",
    "listPrice": null,
    "listPriceNotes": "Pricing not yet established; pending FDA approval",
    "screeningInterval": "Not specified; likely aligned with standard CRC screening intervals (every 3 years typical for blood-based tests)",
    "clinicalTrials": "FDA pivotal trial (NCT06059963) - 15,000+ patient enrollment target across 100 sites; prior 1,000-patient validation study",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT06059963",
    "totalParticipants": 1000,
    "totalParticipantsNotes": "1,000 patients in published validation study (DDW 2023); 15,000+ targeted for ongoing FDA pivotal trial",
    "numPublications": 3,
    "numPublicationsPlus": true,
    "numPublicationsNotes": "Multiple conference presentations at DDW 2023, ASCO GI 2023, AACR 2022; peer-reviewed publications in preparation",
    "technologyDifferentiator": "Multi-omics approach combining methylation + fragmentation analysis with machine learning. Company claims to have identified specific cfDNA sequence regions that capture cancer's earliest signals. Spain-based biotech (Universal DX) with US office in Cambridge, MA. Platform technology (Signal-X) being extended to other GI cancers including pancreatic, liver, and gastric."
  }
];


const trmTestData = [
  {
    "id": "trm-1",
    "sampleCategory": "Blood/Plasma",
    "name": "Guardant360 Response",
    "vendor": "Guardant Health",
    "approach": "Tumor-agnostic",
    "method": "Hybrid-capture NGS ctDNA panel (Guardant360) with algorithmic quantitation of variant allele fraction changes over time",
    "cancerTypes": [
      "Advanced solid tumors (NSCLC, bladder, breast, GI, others)"
    ],
    "targetPopulation": "Patients with measurable or evaluable advanced solid tumors starting systemic therapy",
    "responseDefinition": "≥50% decrease in ctDNA level from baseline to first on-treatment time point; increase from baseline defines molecular non-response",
    "leadTimeVsImaging": 56.0,
    "leadTimeVsImagingNotes": "Guardant Response can predict treatment response approximately 8 weeks (~56 days) earlier than standard imaging assessments.",
    "leadTimeVsImagingCitations": "Guardant Health TRM product page; ACE-CRT clinical development brief.",
    "lod": "~0.1–0.2% VAF",
    "lodNotes": "Analytical validation demonstrates detection sensitivity down to ~0.1% MAF (mutant allele fraction) with high accuracy. Detection range 0.1%–0.8% VAF depending on variant type and sample characteristics.",
    "lodCitations": "Lanman RB et al. PLoS One 2015;10(10):e0140712; Guardant360 CDx technical specifications.",
    "fdaStatus": "CLIA LDT; not FDA-approved as a CDx; used alongside FDA-approved Guardant360 CDx",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Billed as laboratory-developed test; payer coverage variable and often indication-specific",
    "clinicalTrials": "SERENA-6 Phase III ESR1-mutant advanced breast cancer (866); clinical validation supported by 40+ studies using Guardant360 platform for ctDNA response assessment",
    "totalParticipants": 866,
    "numPublications": 40,
    "numPublicationsPlus": true
  },
  {
    "id": "trm-2",
    "sampleCategory": "Blood/Plasma",
    "name": "Signatera (IO Monitoring)",
    "vendor": "Natera",
    "approach": "Tumor-informed",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Tumor-informed; needs primary tumor tissue.",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Matched normal blood required.",
    "method": "Personalized amplicon-based NGS panels targeting 16+ patient-specific variants identified from tumor/normal sequencing",
    "cancerTypes": [
      "Any solid tumor on ICI therapy"
    ],
    "targetPopulation": "Patients with advanced or metastatic solid tumors starting ICI monotherapy or ICI-based combinations",
    "responseDefinition": "Change in personalized ctDNA level from baseline to beginning of cycle 3 (~6 weeks); increase vs decrease vs clearance",
    "lod": "~0.01% VAF",
    "lodNotes": "Analytical validation demonstrates LoD ~0.01% VAF (2 mutant haploid genomes among 20,000 normals), with ≥95% sensitivity and ~99–99.7% specificity at this level. Detection rule requires 2 of 16 tracked variants to call positive.",
    "lodCitations": "Natera Signatera FAQ; Signatera analytical validation white papers; Chen et al. 2021 MRD review.",
    "fdaStatus": "LDT in CLIA/CAP lab; covered by Medicare for ICI treatment response monitoring",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare-covered under LCD L38779 for colorectal, breast, bladder, ovarian, and lung cancers, including ovarian cancer in adjuvant/surveillance settings, neoadjuvant and adjuvant breast cancer, and stage I–III NSCLC surveillance, as well as pan-cancer immunotherapy response monitoring. As of June 2025, the genome-based Signatera Genome assay has matching Medicare coverage for these indications.",
    "commercialPayers": ["UnitedHealthcare", "Cigna", "Anthem BCBS", "BCBS Louisiana", "Blue Shield of California"],
    "commercialPayersCitations": "https://www.natera.com/oncology/billing/",
    "commercialPayersNotes": "Natera is in-network with most major health plans including Cigna, UnitedHealthcare, and Blue Shield of California. BCBS Louisiana provides explicit coverage. Note: Aetna lists Signatera codes as in-network but current policies show non-covered; verify with plan.",
    "clinicalTrials": "NCT04660344 IMvigor011 Phase III bladder cancer (760); NCT05987241 MODERN (Alliance A032103) Phase 2/3 bladder cancer (~400 target); BESPOKE IO prospective observational study (multi-center)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT04660344 | https://clinicaltrials.gov/study/NCT05987241",
    "totalParticipants": 1160,
    "numPublications": 125,
    "numPublicationsPlus": true
  },
  {
    "id": "trm-3",
    "sampleCategory": "Blood/Plasma",
    "name": "NeXT Personal",
    "vendor": "Personalis",
    "approach": "Tumor-informed",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires WGS of tumor tissue to design personalized panel.",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Matched normal blood required for germline filtering.",
    "method": "Whole-genome sequencing of tumor and matched normal with design of personalized panels targeting up to ~1,800 variants; deep sequencing of plasma cfDNA",
    "cancerTypes": [
      "Multiple solid tumors (breast, colorectal, NSCLC, melanoma, renal, others)"
    ],
    "targetPopulation": "Patients with solid tumors after curative-intent therapy (MRD) and those on systemic therapy",
    "responseDefinition": "Quantitative change in ctDNA signal (PPM) over time; molecular response often defined as deep decrease or clearance below limit of detection",
    "lod": "~3.45 ppm (≈0.000345% VAF)",
    "lodNotes": "3.45 ppm is the LoD95 (limit of detection at 95% confidence). Detection threshold is ~1.67 ppm. WGS-based tumor-informed tracking with up to 1,800 variants provides high sensitivity for low-burden disease.",
    "lodCitations": "Northcott et al. Oncotarget 2024; Personalis NeXT Personal Dx analytical validation brochure.",
    "fdaStatus": "High-complexity LDT in CLIA/CAP lab; not FDA-approved",
    "reimbursement": "Medicare coverage for select solid tumor indications including stage II-III breast cancer surveillance",
    "reimbursementNote": "Co-commercialized with Tempus AI as xM (NeXT Personal Dx), with Tempus serving as the exclusive commercial diagnostic partner for tumor-informed MRD in breast, lung, colorectal cancers and solid-tumor immunotherapy monitoring. Clinically launched within Tempus’ MRD portfolio and covered by Medicare for select solid tumor indications (for example, stage II–III breast cancer surveillance).",
    "clinicalTrials": "NCT06230185 B-STRONGER I TNBC MRD/monitoring study (422); VICTORI resectable colorectal cancer MRD study (~71, interim cohort)",
    "clinicalTrialsCitations": "https://clinicaltrials.gov/study/NCT06230185",
    "totalParticipants": 493,
    "numPublications": 5,
    "numPublicationsPlus": true
  },
  {
    "id": "trm-4",
    "sampleCategory": "Blood/Plasma",
    "name": "Tempus xM for TRM",
    "vendor": "Tempus",
    "approach": "Tumor-naïve",
    "method": "Algorithmic estimation of ctDNA tumor fraction from Tempus xF/xF+ liquid biopsy data using diverse genomic events and germline-informed modeling",
    "cancerTypes": [
      "Advanced solid tumors on ICI"
    ],
    "targetPopulation": "Patients with advanced cancers receiving ICI-based therapy",
    "responseDefinition": "≥50% reduction in ctDNA tumor fraction from baseline to early on-treatment time point (e.g., post-cycle 1)",
    "lod": "~0.1% VAF",
    "lodNotes": "LoD inferred from Tempus xF/xF+ platform specifications and general hybrid-capture ctDNA literature. Not explicitly validated for the TRM-specific application; most published data are for MRD (GALAXY/CIRCULATE-Japan analyses).",
    "lodCitations": "Tempus xM technical documentation; general ctDNA review literature describing ~0.1% as typical NGS LoD.",
    "fdaStatus": "Research-use-only biomarker and clinical-development tool",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Currently available for research use only, with clinical availability expected later in 2025 per Tempus’ June 2025 xM for TRM announcement; used mainly in research and biopharma collaborations and not yet a standard reimbursed clinical assay.",
    "numPublications": 3,
    "numPublicationsPlus": true
  },
  {
    "id": "trm-5",
    "sampleCategory": "Blood/Plasma",
    "name": "RaDaR",
    "vendor": "NeoGenomics",
    "approach": "Tumor-informed",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Tumor-informed (WES of tumor); personalized panel designed from tumor variants.",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Buffy coat matched normal used for germline filtering.",
    "method": "Personalized amplicon-based NGS panels (up to ~48 variants) designed from WES of tumor and matched normal; deep ctDNA sequencing",
    "cancerTypes": [
      "Multiple solid tumors (breast, melanoma, colorectal, head & neck, lung, others)"
    ],
    "targetPopulation": "High-risk early-stage and advanced solid-tumor patients followed longitudinally after treatment or on systemic therapy",
    "responseDefinition": "Track ctDNA levels over serial time points; response often defined as rapid fall or clearance vs persistent or rising ctDNA",
    "lod": "0.001% VAF",
    "lodNotes": "Analytical LoD ~0.001% VAF (~10 ppm), consistent with RaDaR ST MRD assay specifications. Earlier claims of 10⁻⁵–10⁻⁶ were not supported by peer-reviewed validation data.",
    "lodCitations": "PMC commercial MRD assay review; NeoGenomics RaDaR product specifications.",
    "fdaStatus": "LDT in NeoGenomics CLIA/CAP lab; not FDA-approved",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Used in clinical research and select clinical programs; payer coverage still emerging. NeoGenomics has also introduced a WES-based RaDaR ST assay, currently positioned for biopharma partners and interventional trials.",
    "commercialPayers": ["Blue Shield of California"],
    "commercialPayersCitations": "https://www.decibio.com/",
    "commercialPayersNotes": "Blue Shield of California covers RaDaR. Coverage is still emerging for TRM applications.",
    "clinicalTrials": "ISLB 2025 bridging study (166; 15 solid tumor types; 97% concordance RaDaR ST vs RaDaR 1.0); c-TRAK TN TNBC study (161); TRACER breast cancer MRD study (~100); CHiRP breast cancer study (~100); NABUCCO bladder cancer study (54); LUCID NSCLC study (88); CLEAR-Me melanoma study (66)",
    "totalParticipants": 735,
    "numPublications": 15,
    "numPublicationsPlus": true
  },
  {
    "id": "trm-6",
    "sampleCategory": "Blood/Plasma",
    "name": "FoundationOne Tracker (TRM)",
    "vendor": "Foundation Medicine / Natera",
    "approach": "Tumor-informed",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Requires prior or concurrent tumor CGP by FoundationOne CDx to identify patient-specific somatic variants for personalized panel design.",
    "requiresMatchedNormal": "No",
    "requiresMatchedNormalNotes": "Germline and CHIP filtering performed computationally without mandatory matched-normal sequencing.",
    "method": "Personalized ctDNA assay derived from FoundationOne CDx tumor sequencing; multiplex PCR–based plasma assay quantifies mean tumor molecules per mL (MTM/mL) over time to track treatment response in patients with advanced solid tumors.",
    "cancerTypes": [
      "Advanced solid tumors (all solid tumors)"
    ],
    "targetPopulation": "Patients with advanced solid tumors receiving systemic therapy, particularly immune checkpoint inhibitor (ICI) therapy. Medicare coverage specifically for ICI response monitoring.",
    "responseDefinition": "Continuous change in ctDNA level (MTM/mL) from baseline to early on-treatment timepoints; molecular response (ctDNA decline or clearance) correlates with improved PFS and OS.",
    "leadTimeVsImaging": null,
    "leadTimeVsImagingNotes": "Studies in NSCLC (IMpower131) showed ctDNA clearance preceded imaging response; in OMICO-MoST study, ctDNA clearance preceded scan response with median lead time of 11.5 months in complete responders.",
    "lod": "≥5 mean tumor molecules/mL",
    "fdaStatus": "CLIA clinical LDT for treatment response monitoring – NOT separately FDA cleared/approved",
    "fdaStatusCitations": "Foundation Medicine press release October 2023.",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare coverage via Palmetto GBA MolDX, effective June 17, 2023, for monitoring response to immune checkpoint inhibitor (ICI) therapy in all solid tumors. Also approved through New York CLEP. Commercial payer coverage varies.",
    "reimbursementCitations": "Foundation Medicine/Natera press release October 10, 2023.",
    "cptCodesNotes": "Billing via MolDX program; specific PLA code TBD.",
    "clinicalAvailability": "Broadly available to all U.S. physicians since October 2023 for treatment response monitoring.",
    "clinicalTrials": "IMpower131 (NSCLC, Kasi et al. Clin Cancer Res 2023); OMICO-MoST (pan-cancer immunotherapy); multiple interventional studies.",
    "clinicalTrialsCitations": "Kasi PM et al. Clin Cancer Res 2023; OMICO-MoST (Mol Oncol 2023).",
    "totalParticipants": null,
    "numPublications": 4,
    "numPublicationsPlus": true,
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "regulatoryStatusNotes": "Clinical LDT with Medicare coverage for TRM of ICI therapy. Broad clinical launch October 2023. MolDX coverage effective June 17, 2023. Uses the same personalized ctDNA technology as the MRD application but is commercially available for TRM while MRD remains investigational."
  },
  {
    "id": "trm-7",
    "sampleCategory": "Blood/Plasma",
    "name": "FoundationOne Monitor",
    "vendor": "Foundation Medicine",
    "approach": "Tumor-naïve",
    "method": "324-gene hybrid-capture ctDNA NGS assay built on the FoundationOne Liquid CDx platform; reports ctDNA tumor fraction (%) and percent change over time while detecting SNVs, indels, CNAs, rearrangements, and complex biomarkers (bTMB, MSI).",
    "cancerTypes": [
      "Advanced solid tumors"
    ],
    "targetPopulation": "Patients with advanced or metastatic solid tumors enrolled in clinical trials where longitudinal ctDNA tumor fraction and emerging resistance mutations are monitored.",
    "responseDefinition": "Percentage change in ctDNA tumor fraction between baseline and early on-treatment timepoints; incorporates multi-omic information (aneuploidy, VAFs, CNVs, fragment length) with CHIP filtering.",
    "leadTimeVsImaging": null,
    "leadTimeVsImagingNotes": "In mCRPC study (IMbassador250), ctDNA tumor fraction detected treatment response earlier than radiographic progression.",
    "lod": "≥5 mean tumor molecules/mL (MTM/mL)",
    "lodNotes": "5 MTM/mL is the validated LoD threshold. This is sample-level mean tumor molecules, not VAF. Analytical sensitivity varies by sample input, tumor characteristics, and variant type.",
    "lodCitations": "Woodhouse R et al. PLoS One 2020;15:e0237802; Foundation Medicine Monitoring Portfolio technical documentation.",
    "fdaStatus": "Clinical LDT – built on FDA-approved FoundationOne Liquid CDx platform; not separately FDA approved",
    "fdaStatusCitations": "Foundation Medicine press release June 2023; Foundation Medicine monitoring portfolio.",
    "reimbursement": "No specific coverage",
    "reimbursementNote": "Clinical LDT without dedicated reimbursement pathway; coverage may depend on institution and context.",
    "cptCodesNotes": "No specific CPT codes; may be billed under general CGP codes.",
    "clinicalAvailability": "Available as clinical LDT. Initially launched June 2023 for biopharma partners; now available for clinical use.",
    "clinicalTrials": "IMbassador250 (mCRPC, enzalutamide ± atezolizumab); multiple biopharma-sponsored early-phase and response-adaptive studies.",
    "clinicalTrialsCitations": "Sweeney CJ et al. Clin Cancer Res 2024;30:4115-4122.",
    "totalParticipants": null,
    "numPublications": 3,
    "numPublicationsPlus": true,
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "regulatoryStatusNotes": "Tissue-naïve ctDNA tumor-fraction assay for TRM and resistance detection. Available as clinical LDT built on FDA-approved FoundationOne Liquid CDx platform. No dedicated payer coverage pathway yet. Positioned as option when tumor tissue is not available."
  },
  {
    "id": "trm-8",
    "sampleCategory": "Blood/Plasma",
    "name": "Northstar Response",
    "vendor": "BillionToOne",
    "approach": "Tumor-naïve",
    "method": "Single-molecule NGS (smNGS) with patented Quantitative Counting Templates (QCT) technology; measures >500 cancer-specific methylated genomic loci; provides absolute quantification of methylated ctDNA molecules with WBC noise filtering via buffy coat sequencing.",
    "cancerTypes": [
      "Pan-cancer: all advanced solid tumors (validated in lung, colorectal, pancreatic, GI cancers, and others)"
    ],
    "targetPopulation": "Patients with Stage III-IV solid tumors on any systemic treatment regimen (chemotherapy, immunotherapy, targeted therapy)",
    "responseDefinition": "Tumor Methylation Score (TMS) - total methylated tumor molecules per 1000 assayed genomic equivalents; serial quantification tracks response, progression, or stable disease over time",
    "leadTimeVsImaging": null,
    "leadTimeVsImagingNotes": "In NSCLC study, detected treatment response and progression earlier than CT scans. Can provide actionable signals weeks in advance of imaging.",
    "lod": "0.01% tumor fraction",
    "lodNotes": "Can accurately discriminate tumor fraction changes as small as 0.25%. Single-molecule precision enables detection of subtle shifts in tumor burden.",
    "lodCitations": "Ye PP et al. Sci Rep 2025;15:5869; Hsiao A et al. Clin Lung Cancer 2025;26(1):72-77.",
    "fdaStatus": "CLIA LDT – NOT FDA approved",
    "reimbursement": "Self-Pay",
    "reimbursementNote": "No Medicare or commercial coverage established. Available as CLIA-certified laboratory test.",
    "tat": "10 days",
    "tatNotes": "Turnaround time typically within 10 days from sample receipt to results.",
    "clinicalAvailability": "Commercially available in US via CLIA-certified laboratory in Menlo Park, CA. Physician-ordered.",
    "clinicalTrials": "Prospective observational study at University of Florida (advanced GI cancers, n=73+); UCSD NSCLC collaboration; multiple ongoing clinical validity studies",
    "clinicalTrialsCitations": "Sahin I et al. JCO 2024;42(3_suppl):756; Sahin I et al. JCO 2025;43(4_suppl):839.",
    "totalParticipants": 100,
    "totalParticipantsNotes": "Initial validation cohort of 100 advanced GI cancer patients; additional cohorts in lung and other solid tumors.",
    "numPublications": 5,
    "numPublicationsPlus": true,
    "numPublicationsCitations": "Ye PP et al. Sci Rep 2025;15:5869; Hsiao A et al. Clin Lung Cancer 2025;26(1):72-77; JCO 2024 and 2025 abstracts.",
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "technologyDifferentiator": "Methylation-based (not mutation/VAF-based) - measures epigenetic signal across >500 loci rather than tracking somatic variants. Tissue-free with no tumor biopsy required. QCT technology enables single-molecule counting precision for absolute quantification.",
    "regulatoryStatusNotes": "CLIA-certified laboratory test. Methylation-based approach differentiates from SNV/VAF-based response monitoring assays. Measures 10x more informative loci (average 90 vs 9) compared to SNV-based ctDNA monitoring. Part of BillionToOne's Northstar oncology portfolio alongside Northstar Select (therapy selection)."
  },
  {
    "id": "trm-9",
    "sampleCategory": "Blood/Plasma",
    "name": "MSK-ACCESS powered with SOPHiA DDM",
    "vendor": "SOPHiA GENETICS",
    "approach": "Tumor-informed",
    "method": "Hybridization capture NGS targeting 147 genes (129 SNV/indel + 18 structural variants). Ultra-deep sequencing (~20,000x raw coverage). Matched tumor-normal design: sequences both tumor and germline (buffy coat) to filter CHIP variants and distinguish somatic from germline. Decentralized version of Memorial Sloan Kettering's NY State-approved MSK-ACCESS assay.",
    "cancerTypes": [
      "Pan-cancer: solid tumors (breast, colorectal, NSCLC, prostate, ovarian, pancreatic, and others)"
    ],
    "targetPopulation": "Patients with advanced solid tumors requiring treatment response monitoring, therapy selection guidance, or resistance mutation detection",
    "responseDefinition": "VAF-based monitoring of known driver and resistance mutations across 147 cancer genes; serial testing tracks tumor burden changes and emergence of actionable alterations",
    "sensitivity": null,
    "sensitivityNotes": "Analytical validation demonstrated 92% sensitivity in de-novo mutation calling at 0.5% VAF; 99% sensitivity for a priori mutation profiling (tracking known variants). Clinical sensitivity data pending from real-world studies.",
    "sensitivityCitations": "Klemm F et al. AMP 2024 poster; Brannon AR et al. Nat Commun 2021;12:3770.",
    "specificity": null,
    "specificityNotes": "Matched tumor-normal approach with buffy coat sequencing enables robust CHIP filtering. Decentralized version achieved 99.4% positive percent agreement (PPA) with centralized MSK-ACCESS.",
    "specificityCitations": "Klemm F et al. AMP 2024 poster.",
    "lod": "0.5% VAF",
    "lodNotes": "Analytical validation demonstrated 92% sensitivity in de-novo mutation calling at 0.5% VAF; 99% sensitivity for a priori mutation profiling (tracking known variants). Decentralized version achieved 99.4% positive percent agreement with centralized MSK-ACCESS at ≥0.5% VAF.",
    "lodCitations": "Klemm F et al. AMP 2024 poster; Brannon AR et al. Nat Commun 2021;12:3770.",
    "leadTimeVsImaging": null,
    "leadTimeVsImagingNotes": "Not yet reported for decentralized version. Original MSK-ACCESS studies showed ctDNA changes can precede radiographic progression.",
    "fdaStatus": "RUO (Research Use Only) – NOT for clinical diagnostic use",
    "fdaStatusNotes": "Currently available as Research Use Only. The centralized MSK-ACCESS assay is NY State approved; decentralized SOPHiA version is in process of regulatory pathway.",
    "reimbursement": "Not yet established",
    "reimbursementNote": "RUO status; clinical diagnostic reimbursement not applicable. May be used in research settings.",
    "tat": "5-7 days",
    "tatNotes": "Turnaround time from sample receipt. Decentralized model enables global laboratory access without shipping to single reference lab.",
    "clinicalAvailability": "Research Use Only – available through Quest Diagnostics partnership and global SOPHiA GENETICS laboratory network",
    "clinicalAvailabilityNotes": "Quest Diagnostics collaboration for US distribution; global access through SOPHiA DDM platform. Not yet available as clinical diagnostic.",
    "clinicalTrials": "Original MSK-ACCESS validated in multiple MSK cohorts; decentralized version validation presented at AMP 2024",
    "clinicalTrialsCitations": "Brannon AR et al. Nat Commun 2021;12:3770 (original MSK validation); Klemm F et al. AMP 2024 poster.",
    "totalParticipants": 1200,
    "totalParticipantsNotes": "Original MSK-ACCESS clinical validation included 617 patients; analytical validation included 654 samples. Decentralized validation ongoing.",
    "numPublications": 10,
    "numPublicationsPlus": true,
    "numPublicationsCitations": "Brannon AR et al. Nat Commun 2021;12:3770; Rose Brannon A et al. JCO Precis Oncol 2021; multiple MSK institutional publications.",
    "bloodVolume": 20,
    "bloodVolumeNotes": "Two 10mL Streck tubes required for plasma and buffy coat (germline) analysis.",
    "variantsTracked": "147 genes",
    "variantsTrackedNotes": "129 genes for SNV/indel detection plus 18 genes for structural variant/fusion detection. Includes key actionable targets: EGFR, KRAS, BRAF, PIK3CA, ERBB2, ALK, ROS1, RET, MET, and others.",
    "isRUO": true,
    "isInvestigational": false,
    "isClinicalLDT": false,
    "technologyDifferentiator": "Decentralized version of MSK's clinically-validated liquid biopsy assay. Matched tumor-normal design with buffy coat sequencing distinguishes somatic from germline variants and filters CHIP. Ultra-deep ~20,000x coverage enables 0.5% VAF detection. SOPHiA DDM platform enables global laboratory deployment without centralized reference lab requirement.",
    "regulatoryStatusNotes": "RUO status. The original centralized MSK-ACCESS is NY State approved and CLIA-certified at MSK. Decentralized SOPHiA version enables the same validated workflow to be performed at partner laboratories globally. Quest Diagnostics partnership announced for US market."
  },
  {
    "id": "trm-10",
    "sampleCategory": "Blood/Plasma",
    "name": "Guardant360 Response",
    "vendor": "Guardant Health",
    "approach": "Tumor-agnostic",
    "method": "Tissue-free liquid biopsy tracking changes in ctDNA levels over time to assess treatment response. Uses the same 74-gene Guardant360 platform to measure molecular response by quantifying ctDNA changes from baseline. Molecular response defined as ≥50% decrease in ctDNA levels.",
    "cancerTypes": [
      "Pan-cancer: advanced solid tumors (NSCLC, breast, colorectal, gastric, bladder, and others)"
    ],
    "targetPopulation": "Patients with advanced solid tumors receiving immunotherapy or targeted therapy who need early assessment of treatment response",
    "responseDefinition": "Molecular response = ≥50% decrease in ctDNA levels from baseline. Molecular non-response = <50% decrease or increase in ctDNA. ctDNA changes measured via somatic mutation tracking across 74 genes.",
    "sensitivity": null,
    "sensitivityNotes": "Not applicable - response monitoring test measures relative ctDNA changes, not absolute detection.",
    "specificity": null,
    "specificityNotes": "Not applicable for response monitoring application.",
    "lod": null,
    "lodNotes": "Uses Guardant360 platform with established analytical performance. Response assessment based on relative ctDNA changes rather than absolute detection limits.",
    "leadTimeVsImaging": 56,
    "leadTimeVsImagingCitations": "Raja R et al. Clin Cancer Res 2018; Aggarwal C et al. JCO 2019; multiple immunotherapy and targeted therapy studies.",
    "leadTimeVsImagingNotes": "Predicts treatment response approximately 8 weeks (56 days) earlier than standard RECIST imaging across cancers and therapies. Molecular responders show significantly longer PFS than non-responders.",
    "fdaStatus": "CLIA LDT",
    "fdaStatusCitations": "Guardant Health website; Guardant360 Response product page.",
    "reimbursement": "Coverage emerging",
    "reimbursementNote": "Guardant360 (for initial profiling) has broad Medicare and commercial coverage. Response monitoring reimbursement pathways developing; local coverage determination expected.",
    "listPrice": 5000,
    "listPriceNotes": "Cash pay rate for Guardant360 Response is $5,000. Financial assistance available based on medical and financial need.",
    "listPriceCitations": "Guardant Health website.",
    "tat": "14 days",
    "tatNotes": "Results typically within 2 weeks. Used in conjunction with Guardant360 CDx for baseline profiling.",
    "clinicalAvailability": "Clinical LDT – commercially available",
    "clinicalAvailabilityNotes": "Launched June 2021. Part of Guardant Complete portfolio alongside Guardant360 CDx, Guardant360 Tissue, and Guardant Reveal.",
    "clinicalTrials": "50+ studies demonstrating molecular response predicts PFS across immunotherapy and targeted therapy",
    "clinicalTrialsCitations": "Raja R et al. Clin Cancer Res 2018; Aggarwal C et al. JCO 2019; Kim ST et al. Nat Med 2018; Shaw AT et al. J Thorac Oncol 2021.",
    "totalParticipants": 5000,
    "totalParticipantsNotes": "Combined enrollment across 50+ clinical studies validating ctDNA response monitoring.",
    "numPublications": 50,
    "numPublicationsPlus": true,
    "numPublicationsCitations": "Guardant Health website; multiple peer-reviewed publications.",
    "bloodVolume": 20,
    "bloodVolumeNotes": "Two 10mL Streck cfDNA tubes (same collection as Guardant360).",
    "variantsTracked": "74 genes",
    "variantsTrackedNotes": "Same 74-gene panel as Guardant360. Tracks all detected variants to quantify overall ctDNA burden changes.",
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "technologyDifferentiator": "First tissue-free liquid biopsy specifically for treatment response monitoring. Complements Guardant360 CDx for treatment selection by providing ongoing response assessment. Serial testing enables early detection of molecular progression before radiographic changes.",
    "regulatoryStatusNotes": "CLIA-certified LDT performed at Guardant Health Clinical Laboratory (Redwood City, CA). Not FDA cleared/approved. Part of Guardant's oncology portfolio alongside FDA-approved Guardant360 CDx."
  },
  {
    "id": "trm-11",
    "sampleCategory": "Blood/Plasma",
    "name": "Caris Assure",
    "vendor": "Caris Life Sciences",
    "approach": "Blood-based TRM (cfDNA + cfRNA + WBC)",
    "method": "AI-enabled whole exome and whole transcriptome sequencing (WES/WTS) from plasma cfDNA/cfRNA and buffy coat WBC DNA/RNA; 22,000 genes; circulating Nucleic Acid Sequencing (cNAS) with CHIP subtraction",
    "methodCitations": "https://www.carislifesciences.com/physicians/physician-tests/caris-assure/ | https://www.nature.com/articles/s41598-025-08986-0",
    "indicationsNotes": "Multi-functional liquid biopsy for therapy selection, treatment response monitoring, and MRD detection. Distinguishes somatic tumor variants from clonal hematopoiesis (CH) and germline variants by sequencing both plasma and buffy coat.",
    "sensitivity": 93.8,
    "sensitivityNotes": "93.8% positive percent agreement (PPA) with matched tissue collected within 30 days using ≥5ng input material and CHIP subtraction.",
    "sensitivityCitations": "https://www.nature.com/articles/s41598-025-08986-0 | https://www.carislifesciences.com/physicians/physician-tests/caris-assure/",
    "specificity": 99.99,
    "specificityNotes": ">99.99% specificity for variant detection; 96.8% positive predictive value (PPV) for therapy selection.",
    "specificityCitations": "https://www.nature.com/articles/s41598-025-08986-0",
    "lod": "0.5% VAF",
    "lodNotes": ">95% sensitivity for variant allele frequencies ≥0.5%.",
    "lodCitations": "https://www.prnewswire.com/news-releases/caris-life-sciences-introduces-the-caris-assure-liquid-biopsy-assay-at-asco-2022-301560767.html",
    "performanceNotes": "AI-enabled platform (ABCDai) couples WES/WTS with machine learning. For monitoring, disease-free survival of patients predicted to have an event was significantly shorter (HR=4.39, p=0.008). Detects CH mutations in ~40% of samples, critical for avoiding false positives in therapy selection.",
    "performanceCitations": "https://www.nature.com/articles/s41598-025-08986-0 | https://www.carislifesciences.com/about/news-and-media/caris-life-sciences-showcases-data-demonstrating-the-clinical-value-of-clonal-hematopoiesis-identification-and-subtraction-in-liquid-biopsy-to-improve-the-accuracy-of-treatment-recommendations/",
    "fdaStatus": "CLIA LDT",
    "fdaStatusNotes": "CLIA-certified laboratory developed test. Not FDA cleared/approved.",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Coverage expanding; contact Caris for current payer coverage.",
    "clinicalAvailability": "Commercially available in US since late 2022",
    "availableRegions": ["US"],
    "tat": "10-14 days",
    "tatNotes": "Turnaround time typically 10-14 business days.",
    "sampleType": "Whole blood",
    "sampleTypeNotes": "Blood collection in approved tubes; plasma and buffy coat analyzed separately.",
    "bloodVolume": 20,
    "bloodVolumeNotes": "Approximately 20mL whole blood required for plasma and buffy coat extraction.",
    "numPublications": 5,
    "numPublicationsPlus": true,
    "numPublicationsCitations": "https://www.nature.com/articles/s41598-025-08986-0 | https://www.carislifesciences.com/research/publications/",
    "clinicalTrials": "Validation studies with 1,910 therapy selection samples; 3,439 MRD/monitoring training samples; 86 MRD validation; 101 monitoring validation",
    "totalParticipants": 5536,
    "variantsTracked": "22,000 genes (WES/WTS)",
    "variantsTrackedNotes": "Whole exome (DNA) and whole transcriptome (RNA) sequencing across 22,000 genes. Reports SNVs, indels, CNAs, fusions, MSI, bTMB, and HLA genotype.",
    "isRUO": false,
    "isInvestigational": false,
    "isClinicalLDT": true,
    "technologyDifferentiator": "Only commercially available liquid biopsy that sequences both plasma and buffy coat (WBC) to distinguish somatic tumor variants from clonal hematopoiesis (CH) and germline variants. CHIP subtraction prevents ~40% of samples from receiving potentially incorrect therapy recommendations based on non-tumor mutations."
  }
];

const cgpTestData = [
  {
    "id": "cgp-1",
    "name": "FoundationOne CDx",
    "vendor": "Foundation Medicine",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP",
    "method": "Hybrid-capture NGS of FFPE tumor tissue; detects SNVs, indels, CNAs, and select rearrangements in 324 genes; reports MSI, TMB, and HRD signature.",
    "methodCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "genesAnalyzed": 324,
    "genesAnalyzedCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "geneListUrl": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Rearrangements", "TMB", "MSI", "HRD"],
    "biomarkersReportedCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "targetPopulation": "Patients with advanced solid malignant neoplasms requiring genomic profiling to guide treatment decisions",
    "targetPopulationCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf17/P170019B.pdf",
    "fdaStatus": "FDA-approved PMA (P170019) - First FDA-approved broad companion diagnostic for solid tumors",
    "fdaStatusCitations": "https://www.fda.gov/medical-devices/recently-approved-devices/foundationone-cdx-f1cdx-p170019s048",
    "fdaApprovalDate": "2017-11-30",
    "fdaApprovalDateCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf17/P170019B.pdf",
    "fdaCompanionDxCount": 57,
    "fdaCompanionDxCountNotes": "57 FDA-approved CDx indications in US as of Dec 2025 (100 total CDx indications including Japan). Includes pan-tumor indications for TMB-H, MSI-H, NTRK fusions, RET fusions, and tumor-specific indications across NSCLC, melanoma, breast, colorectal, ovarian, prostate, cholangiocarcinoma, and pediatric brain tumors.",
    "fdaCompanionDxCountCitations": "https://www.businesswire.com/news/home/20251204680697/en/Foundation-Medicine-Achieves-Historic-Milestone-of-100-Approved-and-Active-Companion-Diagnostic-Indications-Solidifying-Leadership-in-Precision-Medicine",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Prostate Cancer", "Ovarian Cancer", "Melanoma", "Gastric Cancer", "Cholangiocarcinoma"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers and 'broad molecular profiling' but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.foundationmedicine.com/test/foundationone-cdx",
    "tat": "8 days",
    "tatNotes": "Typically 8 days or less from receipt of specimen.",
    "tatCitations": "https://www.foundationmedicine.com/info/detail/order-a-test",
    "sampleRequirements": "FFPE tissue; minimum 25% tumor content; 10 unstained slides or tissue block",
    "sampleRequirementsNotes": "Foundation Medicine contacts pathology lab for specimen procurement. Can reflex to FoundationOne Liquid CDx if tissue insufficient.",
    "sampleRequirementsCitations": "https://www.foundationmedicine.com/info/detail/order-a-test",
    "reimbursement": "Medicare",
    "reimbursementNote": "National Medicare coverage for advanced cancer (CAG-00450R). 87% of patients pay $0 out-of-pocket. 80+ commercial health plans cover Foundation Medicine tests.",
    "reimbursementCitations": "https://www.foundationmedicine.com/resource/billing-and-financial-assistance | https://www.foundationmedicine.com/test/foundationone-cdx",
    "listPrice": 3500,
    "listPriceCitations": "https://www.foundationmedicine.com/faq/patient-faqs",
    "cptCodes": "0037U",
    "cptCodesCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "clinicalAvailability": "Commercially available in US since 2017",
    "clinicalAvailabilityCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "numPublications": 1000,
    "numPublicationsPlus": true,
    "numPublicationsSource": "vendor-estimate",
    "numPublicationsNotes": "Foundation Medicine tests cited in >1,000 peer-reviewed publications (vendor estimate).",
    "numPublicationsCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "publicationsExampleCitations": ["https://doi.org/10.1038/nm.4333", "https://doi.org/10.1200/JCO.2017.75.3780"]
  },
  {
    "id": "cgp-2",
    "name": "FoundationOne Liquid CDx",
    "vendor": "Foundation Medicine",
    "sampleCategory": "Blood/Plasma",
    "approach": "Liquid CGP",
    "method": "Hybrid-capture NGS of cfDNA from plasma; analyzes 324 genes; reports short variants in 311 genes, rearrangements in 8 genes, CNAs in 3 genes, plus bTMB and MSI.",
    "methodCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200006B.pdf",
    "genesAnalyzed": 324,
    "genesAnalyzedCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200006B.pdf | https://www.foundationmedicine.com/test/foundationone-liquid-cdx",
    "genesReported": 311,
    "genesReportedCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200006B.pdf",
    "geneListUrl": "https://www.foundationmedicine.com/test/foundationone-liquid-cdx",
    "biomarkersReported": ["SNVs", "Indels", "Select CNAs", "Select Rearrangements", "bTMB", "MSI"],
    "biomarkersReportedCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200006B.pdf | https://www.foundationmedicine.com/test/foundationone-liquid-cdx",
    "cancerTypes": ["Advanced solid tumors"],
    "cancerTypesCitations": "https://www.foundationmedicine.com/test/foundationone-liquid-cdx",
    "targetPopulation": "Patients with advanced solid tumors when tissue biopsy is not feasible or as complement to tissue testing",
    "targetPopulationCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200006B.pdf",
    "fdaStatus": "FDA-approved PMA (P200006) August 2020",
    "fdaStatusCitations": "https://www.cancernetwork.com/view/fda-approves-foundationone-liquid-cdx-as-companion-diagnostic",
    "fdaApprovalDate": "2020-08-26",
    "fdaApprovalDateCitations": "https://www.cancernetwork.com/view/fda-approves-foundationone-liquid-cdx-as-companion-diagnostic",
    "fdaCompanionDxCount": 10,
    "fdaCompanionDxCountNotes": "Multiple CDx indications in NSCLC (osimertinib, sotorasib, capmatinib), breast cancer (PIK3CA), prostate cancer (BRCA1/2, ATM), cholangiocarcinoma (FGFR2), pan-tumor (NTRK).",
    "fdaCompanionDxCountCitations": "https://www.foundationmedicine.com/press-release/fda-approves-foundationonercdx-and-foundationonerliquid-cdx-companion-diagnostics",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Prostate Cancer", "Cholangiocarcinoma"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.foundationmedicine.com/test/foundationone-liquid-cdx",
    "tat": "7-10 days",
    "tatNotes": "Results typically available within 7-10 business days.",
    "tatCitations": "https://www.foundationmedicine.com/info/detail/order-a-test",
    "sampleRequirements": "2 tubes of whole blood in Streck cfDNA BCT tubes; minimum 5 mL per tube",
    "sampleRequirementsNotes": "7-day sample stability at ambient temperature. Can reflex to tissue testing if liquid negative for CDx mutations.",
    "sampleRequirementsCitations": "https://www.foundationmedicine.com/info/detail/order-a-test",
    "reimbursement": "Medicare",
    "reimbursementNote": "National Medicare coverage for advanced cancer. Broad commercial payer coverage.",
    "reimbursementCitations": "https://www.foundationmedicine.com/resource/billing-and-financial-assistance",
    "listPrice": 3500,
    "listPriceCitations": "https://www.foundationmedicine.com/faq/patient-faqs",
    "cptCodes": "0239U",
    "cptCodesCitations": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "clinicalAvailability": "Commercially available in US since 2020",
    "clinicalAvailabilityCitations": "https://www.cancernetwork.com/view/fda-approves-foundationone-liquid-cdx-as-companion-diagnostic"
  },
  {
    "id": "cgp-3",
    "name": "FoundationOne Heme",
    "vendor": "Foundation Medicine",
    "sampleCategory": "Tissue/Blood/Bone Marrow",
    "approach": "Tissue + Liquid CGP",
    "method": "Hybrid-capture DNA sequencing of 406 genes plus RNA sequencing of 265 genes for fusion detection; covers hematologic malignancies and sarcomas.",
    "methodCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "genesAnalyzed": 406,
    "genesAnalyzedCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "rnaGenesAnalyzed": 265,
    "rnaGenesAnalyzedCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "geneListUrl": "https://www.foundationmedicine.com/test/foundationone-heme",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Rearrangements/Fusions", "TMB", "MSI"],
    "biomarkersReportedCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "cancerTypes": ["Hematologic malignancies", "Sarcomas"],
    "cancerTypesNotes": "Leukemias, lymphomas, myeloma, myelodysplastic syndromes, myeloproliferative neoplasms, and sarcomas.",
    "cancerTypesCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "targetPopulation": "Patients with hematologic malignancies or sarcomas requiring comprehensive genomic profiling",
    "targetPopulationCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "fdaStatus": "CLIA LDT - not FDA approved",
    "fdaStatusCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["Acute Myeloid Leukemia", "Chronic Myeloid Leukemia", "B-Cell Lymphomas", "Myelodysplastic Syndromes", "Soft Tissue Sarcoma"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines for hematologic malignancies and sarcomas. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.foundationmedicine.com/test/foundationone-heme",
    "tat": "10-14 days",
    "tatCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "sampleRequirements": "FFPE tissue, bone marrow aspirate, or peripheral blood depending on disease type",
    "sampleRequirementsCitations": "https://www.foundationmedicine.com/test/foundationone-heme",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare coverage for qualifying patients. Commercial coverage varies.",
    "reimbursementCitations": "https://www.foundationmedicine.com/resource/billing-and-financial-assistance",
    "listPrice": 3500,
    "listPriceCitations": "https://www.foundationmedicine.com/faq/patient-faqs",
    "clinicalAvailability": "Commercially available in US",
    "clinicalAvailabilityCitations": "https://www.foundationmedicine.com/test/foundationone-heme"
  },
  {
    "id": "cgp-4",
    "name": "Guardant360 CDx",
    "vendor": "Guardant Health",
    "sampleCategory": "Blood/Plasma",
    "approach": "Liquid CGP",
    "method": "Digital sequencing of cfDNA; targets 74 genes; reports SNVs, indels, CNAs (6 genes), and fusions (4 genes) with high sensitivity at low allele frequencies.",
    "methodCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200010B.pdf",
    "genesAnalyzed": 74,
    "genesAnalyzedCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200010B.pdf",
    "genesReported": 55,
    "genesReportedNotes": "74 genes targeted, 55 genes with reportable short variants.",
    "genesReportedCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200010B.pdf",
    "geneListUrl": "https://www.guardantcomplete.com/hcp/solutions/guardant360-cdx",
    "biomarkersReported": ["SNVs", "Indels", "Select CNAs", "Select Fusions"],
    "biomarkersReportedCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200010B.pdf",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.cancernetwork.com/view/fda-approves-guardant360-cdx-for-comprehensive-genomic-profiling-in-all-solid-cancers",
    "targetPopulation": "Patients with advanced solid tumors; first liquid biopsy with FDA-approved CGP indication for all solid tumors",
    "targetPopulationCitations": "https://www.cancernetwork.com/view/fda-approves-guardant360-cdx-for-comprehensive-genomic-profiling-in-all-solid-cancers",
    "fdaStatus": "FDA-approved PMA (P200010) August 2020 - First FDA-approved liquid biopsy NGS CDx",
    "fdaStatusCitations": "https://www.fda.gov/medical-devices/recently-approved-devices/guardant360-cdx-p200010s008 | https://www.targetedonc.com/view/fda-approves-guardant360-cdx-for-tumor-mutation-profiling-of-all-solid-cancers",
    "fdaApprovalDate": "2020-08-07",
    "fdaApprovalDateCitations": "https://www.fda.gov/medical-devices/recently-approved-devices/guardant360-cdx-p200010s008",
    "fdaCompanionDxCount": 6,
    "fdaCompanionDxCountNotes": "6 CDx indications: NSCLC (osimertinib/EGFR, amivantamab/EGFR exon 20, trastuzumab deruxtecan/ERBB2, sotorasib/KRAS G12C); Breast cancer (elacestrant/ESR1, imlunestrant/ESR1).",
    "fdaCompanionDxCountCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2025/FDA-Approves-Guardant360-CDx-as-Companion-Diagnostic-for-Eli-Lilly-and-Companys-Inluriyo-imlunestrant-for-Treatment-of-ESR1-mutated-Advanced-Breast-Cancer/default.aspx | https://www.onclive.com/view/fda-clears-guardant360-cdx-as-companion-diagnostic-for-imlunestrant-in-esr1-mutated-breast-cancer",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer"],
    "nccnGuidelinesNotes": "Covers all genes recommended by NCCN for NSCLC and relevant biomarkers for breast cancer treatment. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.guardanthealth.com/",
    "tat": "5-7 days",
    "tatNotes": "Actionable results typically within 7 days; as fast as 5 days.",
    "tatCitations": "https://www.onclive.com/view/fda-clears-guardant360-cdx-as-companion-diagnostic-for-imlunestrant-in-esr1-mutated-breast-cancer",
    "sampleRequirements": "2 tubes of whole blood in Streck cfDNA BCT tubes; minimum 5 mL",
    "sampleRequirementsCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200010S008C.pdf",
    "reimbursement": "Medicare",
    "reimbursementNote": "Broadly covered by Medicare and commercial insurers representing >300 million lives.",
    "reimbursementCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2025/FDA-Approves-Guardant360-CDx-as-Companion-Diagnostic-for-Eli-Lilly-and-Companys-Inluriyo-imlunestrant-for-Treatment-of-ESR1-mutated-Advanced-Breast-Cancer/default.aspx",
    "clinicalAvailability": "Commercially available in US since 2020",
    "clinicalAvailabilityCitations": "https://www.cancernetwork.com/view/fda-approves-guardant360-cdx-for-comprehensive-genomic-profiling-in-all-solid-cancers",
    "numPublications": 150,
    "numPublicationsPlus": true,
    "numPublicationsSource": "vendor-estimate",
    "numPublicationsNotes": "Guardant360 cited in >150 peer-reviewed publications (vendor estimate).",
    "numPublicationsCitations": "https://www.cancernetwork.com/view/fda-approves-guardant360-cdx-for-comprehensive-genomic-profiling-in-all-solid-cancers",
    "publicationsExampleCitations": ["https://pubmed.ncbi.nlm.nih.gov/33619370/", "https://pubmed.ncbi.nlm.nih.gov/37256839/"]
  },
  {
    "id": "cgp-5",
    "name": "Tempus xT CDx",
    "vendor": "Tempus AI",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP",
    "method": "Tumor-normal matched NGS of FFPE tissue and matched normal blood/saliva; detects SNVs, MNVs, indels in 648 genes plus MSI status; tumor-normal matching improves somatic variant accuracy.",
    "methodCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf21/P210011C.pdf | https://www.tempus.com/oncology/genomic-profiling/xt-xr/",
    "genesAnalyzed": 648,
    "genesAnalyzedCitations": "https://www.tempus.com/oncology/genomic-profiling/xt-xr/ | https://www.biospace.com/press-releases/tempus-announces-the-national-launch-of-fda-approved-xt-cdx-test",
    "geneListUrl": "https://www.tempus.com/oncology/genomic-profiling/xt-xr/",
    "biomarkersReported": ["SNVs", "MNVs", "Indels", "CNVs", "Rearrangements", "TMB", "MSI"],
    "biomarkersReportedNotes": "HRD and HLA genotyping available as add-ons via professional services report.",
    "biomarkersReportedCitations": "https://www.tempus.com/oncology/genomic-profiling/xt-xr/",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf21/P210011C.pdf",
    "targetPopulation": "Patients with previously diagnosed solid malignant neoplasms",
    "targetPopulationCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf21/P210011C.pdf",
    "fdaStatus": "FDA-approved IVD (P210011) - National launch January 2025",
    "fdaStatusCitations": "https://www.biospace.com/press-releases/tempus-announces-the-national-launch-of-fda-approved-xt-cdx-test | https://investors.tempus.com/news-releases/news-release-details/tempus-announces-national-launch-fda-approved-xt-cdx-test",
    "fdaApprovalDate": "2024-06-01",
    "fdaApprovalDateCitations": "https://www.360dx.com/business-news/tempus-nabs-cms-advanced-diagnostic-laboratory-test-status-tumor-mutation-profiling",
    "fdaCompanionDxCount": 2,
    "fdaCompanionDxCountNotes": "CDx claims for colorectal cancer (KRAS, NRAS, BRAF); positioned as one of the largest FDA-approved gene panels.",
    "fdaCompanionDxCountCitations": "https://www.tempus.com/oncology/genomic-profiling/xt-xr/",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Colorectal Cancer", "Breast Cancer", "Melanoma", "Prostate Cancer", "Ovarian Cancer"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.tempus.com/oncology/genomic-profiling/xt-xr/",
    "tat": "14 days",
    "tatNotes": "Results typically within 14 days.",
    "tatCitations": "https://www.tempus.com/oncology/genomic-profiling/xt-xr/",
    "sampleRequirements": "FFPE tissue plus matched normal (blood or saliva)",
    "sampleRequirementsNotes": "Tumor-normal matched approach differentiates somatic from germline variants.",
    "sampleRequirementsCitations": "https://www.accessdata.fda.gov/cdrh_docs/pdf21/P210011C.pdf",
    "reimbursement": "Medicare",
    "reimbursementNote": "CMS Advanced Diagnostic Laboratory Test (ADLT) designation; Medicare rate $4,500.",
    "reimbursementCitations": "https://www.360dx.com/business-news/tempus-nabs-cms-advanced-diagnostic-laboratory-test-status-tumor-mutation-profiling",
    "listPrice": 4500,
    "listPriceCitations": "https://www.360dx.com/business-news/tempus-nabs-cms-advanced-diagnostic-laboratory-test-status-tumor-mutation-profiling",
    "cptCodes": "0473U",
    "cptCodesCitations": "https://www.discoveriesinhealthpolicy.com/2024/09/cms-releases-preliminary-crosswalk-for.html",
    "clinicalAvailability": "Commercially available nationwide since January 2025",
    "clinicalAvailabilityCitations": "https://www.biospace.com/press-releases/tempus-announces-the-national-launch-of-fda-approved-xt-cdx-test",
    "complementaryTests": "Can add xR RNA sequencing, xF/xF+ liquid biopsy, HER2 IHC, PD-L1 IHC, HRD, Immune Profile Score",
    "complementaryTestsCitations": "https://www.tempus.com/oncology/genomic-profiling/xt-xr/"
  },
  {
    "id": "cgp-6",
    "name": "Tempus xF",
    "vendor": "Tempus AI",
    "sampleCategory": "Blood/Plasma",
    "approach": "Liquid CGP",
    "method": "ctDNA NGS panel targeting 105 genes; detects SNVs, indels, CNGs (6 genes), CNLs (BRCA1/2), and rearrangements (6 genes) plus MSI-H.",
    "methodCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/ | https://www.ncbi.nlm.nih.gov/gtr/tests/569040/",
    "analyticalValidation": "Validated performance metrics from Finkle et al. 2021 analytical validation study.",
    "analyticalValidationCitations": "https://www.tempus.com/wp-content/uploads/2021/09/xF-Validation-Summary.pdf",
    "genesAnalyzed": 105,
    "genesAnalyzedCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "geneListUrl": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "biomarkersReported": ["SNVs", "Indels", "Select CNAs", "Select Rearrangements", "MSI"],
    "biomarkersReportedCitations": "https://www.ncbi.nlm.nih.gov/gtr/tests/569040/",
    "cancerTypes": ["Advanced solid tumors"],
    "cancerTypesCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "targetPopulation": "Patients with advanced solid tumors; not intended for hematologic malignancies, early-stage cancers, or primary CNS malignancies",
    "targetPopulationCitations": "https://www.ncbi.nlm.nih.gov/gtr/tests/569040/",
    "fdaStatus": "CLIA LDT - not FDA approved",
    "fdaStatusCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Prostate Cancer"],
    "nccnGuidelinesNotes": "Covers key biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.tempus.com/oncology/genomic-profiling/xf/",
    "tat": "5-7 days",
    "tatCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "sampleRequirements": "Blood in Streck cfDNA BCT tubes",
    "sampleRequirementsCitations": "https://www.ncbi.nlm.nih.gov/gtr/tests/569040/",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Commercial and Medicare coverage varies by indication.",
    "reimbursementCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "clinicalAvailability": "Commercially available in US",
    "clinicalAvailabilityCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "sensitivity": ">99% for SNVs/CNGs at ≥0.5% VAF; >98% for indels; >97% for rearrangements",
    "sensitivityCitations": "https://www.ncbi.nlm.nih.gov/gtr/tests/569040/",
    "specificity": ">99.9% for SNVs, indels, rearrangements; >96% for CNGs",
    "specificityCitations": "https://www.ncbi.nlm.nih.gov/gtr/tests/569040/"
  },
  {
    "id": "cgp-7",
    "name": "Tempus xF+",
    "vendor": "Tempus AI",
    "sampleCategory": "Blood/Plasma",
    "approach": "Liquid CGP",
    "method": "Expanded ctDNA NGS panel targeting 523 genes; detects SNVs, indels, CNGs, and rearrangements; includes clonal hematopoiesis (CH) variant identification.",
    "methodCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "analyticalValidation": "Validated per Boulos et al. 2025 analytical validation study.",
    "analyticalValidationCitations": "https://pubmed.ncbi.nlm.nih.gov/39820598/",
    "genesAnalyzed": 523,
    "genesAnalyzedCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "geneListUrl": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Rearrangements", "CH variants"],
    "biomarkersReportedCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "cancerTypes": ["Advanced solid tumors"],
    "cancerTypesCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "targetPopulation": "Patients requiring expanded liquid biopsy coverage",
    "targetPopulationCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "fdaStatus": "CLIA LDT - not FDA approved",
    "fdaStatusCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Prostate Cancer", "Ovarian Cancer"],
    "nccnGuidelinesNotes": "Expanded 523-gene panel covers all biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.tempus.com/oncology/genomic-profiling/xf/",
    "tat": "7-10 days",
    "tatCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "sampleRequirements": "Blood in Streck cfDNA BCT tubes",
    "sampleRequirementsCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "reimbursement": "Coverage Varies",
    "reimbursementCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "clinicalAvailability": "Commercially available in US",
    "clinicalAvailabilityCitations": "https://www.tempus.com/oncology/genomic-profiling/xf/"
  },
  {
    "id": "cgp-8",
    "name": "MSK-IMPACT",
    "vendor": "Memorial Sloan Kettering",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP",
    "method": "Hybrid-capture NGS of matched tumor/normal FFPE tissue; targets 468 cancer-associated genes covering ~1.5Mb of the genome; detects SNVs, indels, CNAs, select rearrangements, and MSI.",
    "methodCitations": "https://www.accessdata.fda.gov/cdrh_docs/reviews/den170058.pdf | https://www.mskcc.org/msk-impact",
    "genesAnalyzed": 468,
    "genesAnalyzedNotes": "468 genes in original FDA-authorized configuration (2017); panel has since expanded to ~505 genes per current MSK documentation.",
    "genesAnalyzedCitations": "https://www.accessdata.fda.gov/cdrh_docs/reviews/den170058.pdf | https://ascopost.com/News/58263 | https://www.mskcc.org/msk-impact",
    "geneListUrl": "https://www.mskcc.org/msk-impact",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Select Rearrangements", "MSI"],
    "biomarkersReportedCitations": "https://www.accessdata.fda.gov/cdrh_docs/reviews/den170058.pdf",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.mskcc.org/msk-impact",
    "targetPopulation": "Patients with advanced cancer treated at Memorial Sloan Kettering Cancer Center",
    "targetPopulationCitations": "https://www.mskcc.org/msk-impact",
    "fdaStatus": "FDA authorized (de novo, DEN170058) November 2017 - First tumor-profiling LDT to receive FDA authorization",
    "fdaStatusCitations": "https://ascopost.com/News/58263 | https://www.mskcc.org/news/fda-authorizes-msk-impact-test-analyzing-patient-tumors",
    "fdaAuthorizationDate": "2017-11-15",
    "fdaAuthorizationDateCitations": "https://ascopost.com/News/58263",
    "fdaStatusNotes": "Not FDA-approved as CDx; authorized for tumor mutation profiling. Also approved by NYSDOH.",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Prostate Cancer", "Melanoma", "Ovarian Cancer", "Gastric Cancer"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.mskcc.org/msk-impact",
    "tat": "2-3 weeks",
    "tatCitations": "https://www.mskcc.org/msk-impact",
    "sampleRequirements": "FFPE tumor tissue plus matched normal sample",
    "sampleRequirementsNotes": "Tumor-normal matching allows accurate distinction of somatic vs germline variants.",
    "sampleRequirementsCitations": "https://www.accessdata.fda.gov/cdrh_docs/reviews/den170058.pdf",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Coverage depends on payer; available primarily to MSK patients.",
    "reimbursementCitations": "https://www.mskcc.org/msk-impact",
    "clinicalAvailability": "Available only at Memorial Sloan Kettering Cancer Center",
    "clinicalAvailabilityNotes": "Single-site assay; >20,000 patients sequenced since 2014. Results accessible via cBioPortal and annotated using OncoKB.",
    "clinicalAvailabilityCitations": "https://www.mskcc.org/msk-impact | https://www.mskcc.org/news-releases/msk-impact-first-tumor-profiling-multiplex-panel-authorized-fda-setting-new-pathway-market-future-oncopanels",
    "numPublications": 1000,
    "numPublicationsPlus": true,
    "numPublicationsSource": "vendor-estimate",
    "numPublicationsNotes": ">1,000 peer-reviewed publications featuring MSK-IMPACT data as of end of 2024 (vendor estimate).",
    "numPublicationsCitations": "https://www.mskcc.org/msk-impact",
    "publicationsExampleCitations": ["https://doi.org/10.1038/nm.4333", "https://doi.org/10.1056/NEJMoa1610624"],
    "keyFindings": "37% of profiled patients have at least one actionable mutation; 11% enrolled in matched clinical trials.",
    "keyFindingsCitations": "https://www.mskcc.org/news/fda-authorizes-msk-impact-test-analyzing-patient-tumors | https://www.cancer.gov/news-events/cancer-currents-blog/2017/genomic-profiling-tests-cancer"
  },
  {
    "id": "cgp-9",
    "name": "MI Cancer Seek",
    "vendor": "Caris Life Sciences",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP (WES + WTS)",
    "method": "Combined whole exome sequencing (WES) and whole transcriptome sequencing (WTS) from single FFPE tissue extraction; detects SNVs, indels in 228 genes, MSI, TMB, and ERBB2 amplification.",
    "methodCitations": "https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/ | https://pmc.ncbi.nlm.nih.gov/articles/PMC12581394/",
    "genesAnalyzed": 228,
    "genesAnalyzedNotes": "228 genes with reportable SNVs/indels in CDx subset; WES/WTS technically interrogates ~20,000 genes for research findings and signatures. This prevents confusion between '228 genes' and 'whole-exome' claims.",
    "genesAnalyzedCitations": "https://www.prnewswire.com/news-releases/caris-life-sciences-demonstrates-scientific-rigor-with-clinical-validation-of-fda-approved-mi-cancer-seek-302530610.html",
    "geneListUrl": "https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/",
    "biomarkersReported": ["SNVs", "Indels", "MSI", "TMB", "ERBB2 CNA"],
    "biomarkersReportedCitations": "https://www.prnewswire.com/news-releases/caris-life-sciences-demonstrates-scientific-rigor-with-clinical-validation-of-fda-approved-mi-cancer-seek-302530610.html",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/",
    "targetPopulation": "Adults and pediatric patients (ages 1-22) with previously diagnosed solid malignant neoplasms",
    "targetPopulationNotes": "First and only FDA-approved CGP with CDx indications for both adult and pediatric patients.",
    "targetPopulationCitations": "https://www.biospace.com/press-releases/caris-life-sciences-receives-fda-approval-for-mi-cancer-seek-as-a-companion-diagnostic-cdx-test",
    "fdaStatus": "FDA-approved IVD (P240010) November 2024 - First WES+WTS combined assay with CDx indications",
    "fdaStatusCitations": "https://www.carislifesciences.com/about/news-and-media/caris-life-sciences-receives-fda-approval-for-mi-cancer-seek/ | https://www.biospace.com/press-releases/caris-life-sciences-receives-fda-approval-for-mi-cancer-seek-as-a-companion-diagnostic-cdx-test",
    "fdaApprovalDate": "2024-11-06",
    "fdaApprovalDateCitations": "https://www.biospace.com/press-releases/caris-life-sciences-receives-fda-approval-for-mi-cancer-seek-as-a-companion-diagnostic-cdx-test",
    "fdaCompanionDxCount": 8,
    "fdaCompanionDxCountNotes": "8 CDx claims: 1 pan-cancer indication plus 5 tumor-specific indications (breast, colorectal, melanoma, NSCLC, endometrial). Includes PIK3CA, KRAS, NRAS, BRAF, MSI-H/TMB-H.",
    "fdaCompanionDxCountCitations": "https://www.prnewswire.com/news-releases/caris-life-sciences-demonstrates-scientific-rigor-with-clinical-validation-of-fda-approved-mi-cancer-seek-302530610.html | https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/cdx-indications/",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Melanoma", "Endometrial Cancer"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines including PIK3CA, KRAS, NRAS, BRAF, MSI-H/TMB-H. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/cdx-indications/",
    "tat": "14 days",
    "tatNotes": "Results within 14 days.",
    "tatCitations": "https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/cdx-indications/",
    "sampleRequirements": "FFPE tissue; minimum 20% tumor content",
    "sampleRequirementsNotes": "Simultaneous DNA and RNA extraction from single sample minimizes tissue requirements compared to separate assays.",
    "sampleRequirementsCitations": "https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/ | https://www.mlo-online.com/diagnostics/assays/news/55241478/caris-life-sciences-receives-fda-approval-for-mi-cancer-seek-as-a-companion-diagnostic-cdx-test",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Coverage expanding; contact Caris for current payer coverage.",
    "reimbursementCitations": "https://www.carislifesciences.com/physicians/physician-tests/mi-cancer-seek/",
    "clinicalAvailability": "Commercially available in US since November 2024",
    "clinicalAvailabilityCitations": "https://www.biospace.com/press-releases/caris-life-sciences-receives-fda-approval-for-mi-cancer-seek-as-a-companion-diagnostic-cdx-test",
    "analyticalValidation": "97-100% positive and negative percent agreement compared to other FDA-approved assays",
    "analyticalValidationCitations": "https://www.prnewswire.com/news-releases/caris-life-sciences-demonstrates-scientific-rigor-with-clinical-validation-of-fda-approved-mi-cancer-seek-302530610.html"
  },
  {
    "id": "cgp-11",
    "name": "OncoExTra",
    "vendor": "Exact Sciences",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP (WES + WTS)",
    "method": "Whole exome sequencing (WES) of ~20,000 genes combined with whole transcriptome sequencing (WTS) from FFPE tissue; reports SNVs, indels, CNAs, fusions, MSI, TMB, and HRD status.",
    "methodCitations": "https://www.exactsciences.com/test/oncoextra | https://www.oncotarget.com/article/28285/text/",
    "genesAnalyzed": 20000,
    "genesAnalyzedNotes": "WES/WTS comprehensively interrogates ~20,000 genes; reportable subset varies by biomarker type.",
    "genesAnalyzedCitations": "https://www.exactsciences.com/test/oncoextra",
    "geneListUrl": "https://www.exactsciences.com/test/oncoextra",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Fusions", "TMB", "MSI", "HRD"],
    "biomarkersReportedCitations": "https://www.exactsciences.com/test/oncoextra",
    "cancerTypes": ["Advanced solid tumors"],
    "cancerTypesCitations": "https://www.exactsciences.com/test/oncoextra",
    "targetPopulation": "Patients with advanced solid tumors requiring comprehensive genomic and transcriptomic profiling",
    "targetPopulationCitations": "https://www.exactsciences.com/test/oncoextra",
    "fdaStatus": "CLIA LDT - not FDA approved",
    "fdaStatusCitations": "https://www.exactsciences.com/test/oncoextra",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Prostate Cancer", "Ovarian Cancer", "Melanoma"],
    "nccnGuidelinesNotes": "WES/WTS approach covers all biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.exactsciences.com/test/oncoextra",
    "tat": "10-14 days",
    "tatCitations": "https://www.exactsciences.com/test/oncoextra",
    "sampleRequirements": "FFPE tissue; 10 unstained slides or tissue block",
    "sampleRequirementsCitations": "https://www.exactsciences.com/test/oncoextra",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare coverage; commercial coverage varies by payer.",
    "reimbursementCitations": "https://www.exactsciences.com/test/oncoextra",
    "clinicalAvailability": "Commercially available in US",
    "clinicalAvailabilityCitations": "https://www.exactsciences.com/test/oncoextra",
    "clinicalUtility": "Studies demonstrate increased matched therapy rates compared to single-gene testing.",
    "clinicalUtilityCitations": "https://www.oncotarget.com/article/28285/text/ | https://pubmed.ncbi.nlm.nih.gov/37256839/"
  },
  {
    "id": "cgp-12",
    "name": "OmniSeq INSIGHT",
    "vendor": "Labcorp Oncology (OmniSeq)",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP + Immune Profiling",
    "method": "NGS panel covering full coding regions of 523 genes plus immune profiling including PD-L1 expression and immune signatures; detects SNVs, indels, CNAs, fusions, TMB, and MSI.",
    "methodCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight | https://pmc.ncbi.nlm.nih.gov/articles/PMC8796288/",
    "genesAnalyzed": 523,
    "genesAnalyzedCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "geneListUrl": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Fusions", "TMB", "MSI", "PD-L1", "Immune Signatures"],
    "biomarkersReportedNotes": "Combined genomic and immune profiling in single test.",
    "biomarkersReportedCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "targetPopulation": "Patients with solid tumors requiring comprehensive genomic and immune profiling",
    "targetPopulationCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "fdaStatus": "CLIA LDT - not FDA approved",
    "fdaStatusCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Melanoma", "Prostate Cancer"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines plus immune profiling. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "tat": "10-14 days",
    "tatCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "sampleRequirements": "FFPE tissue",
    "sampleRequirementsCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare and commercial coverage; widely available via Labcorp network.",
    "reimbursementCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight",
    "clinicalAvailability": "Commercially available in US via Labcorp network",
    "clinicalAvailabilityCitations": "https://oncology.labcorp.com/providers/order-a-test/omniseq-insight"
  },
  {
    "id": "cgp-13",
    "name": "StrataNGS",
    "vendor": "Strata Oncology",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP",
    "method": "Multiplex PCR/semiconductor sequencing panel targeting 429 genes; detects SNVs, indels, CNAs, select fusions, TMB, and MSI.",
    "methodCitations": "https://ascopubs.org/doi/10.1200/PO.21.00088 | https://pubmed.ncbi.nlm.nih.gov/34723565/",
    "genesAnalyzed": 429,
    "genesAnalyzedCitations": "https://ascopubs.org/doi/10.1200/PO.21.00088",
    "geneListUrl": "https://www.strataoncology.com/stratangs",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Select Fusions", "TMB", "MSI"],
    "biomarkersReportedCitations": "https://ascopubs.org/doi/10.1200/PO.21.00088",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.strataoncology.com/stratangs",
    "targetPopulation": "Patients with advanced solid tumors requiring genomic profiling",
    "targetPopulationCitations": "https://www.strataoncology.com/stratangs",
    "fdaStatus": "CLIA LDT - not FDA approved",
    "fdaStatusCitations": "https://www.strataoncology.com/stratangs",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Prostate Cancer", "Ovarian Cancer"],
    "nccnGuidelinesNotes": "Covers biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.strataoncology.com/stratangs",
    "tat": "7-10 days",
    "tatCitations": "https://www.strataoncology.com/stratangs",
    "sampleRequirements": "FFPE tissue",
    "sampleRequirementsCitations": "https://www.strataoncology.com/stratangs",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare-covered CGP; specific footprint in health-system networks.",
    "reimbursementCitations": "https://www.strataoncology.com/stratangs",
    "clinicalAvailability": "Commercially available in US",
    "clinicalAvailabilityCitations": "https://www.strataoncology.com/stratangs",
    "clinicalUtility": "Published data on access and outcomes in real-world settings.",
    "clinicalUtilityCitations": "https://ascopubs.org/doi/10.1200/PO.21.00088 | https://pubmed.ncbi.nlm.nih.gov/34723565/"
  },
  {
    "id": "cgp-14",
    "name": "MI Profile",
    "vendor": "Caris Life Sciences",
    "sampleCategory": "Tissue",
    "approach": "Tissue Multi-omic Profiling",
    "method": "Comprehensive multi-omic profiling combining WES, WTS, and protein analysis (IHC/FISH) from FFPE tissue; reports DNA variants, RNA fusions, and protein expression.",
    "methodCitations": "https://www.carislifesciences.com/physicians/profiling/ | https://www.carislifesciences.com/molecular-intelligence-platform/",
    "genesAnalyzed": 22000,
    "genesAnalyzedNotes": "WES/WTS interrogates ~22,000 genes; protein analysis adds expression-level biomarkers.",
    "genesAnalyzedCitations": "https://www.carislifesciences.com/physicians/profiling/",
    "geneListUrl": "https://www.carislifesciences.com/physicians/profiling/",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Fusions", "TMB", "MSI", "Protein Expression"],
    "biomarkersReportedNotes": "Multi-omic approach combines genomic, transcriptomic, and proteomic data.",
    "biomarkersReportedCitations": "https://www.carislifesciences.com/physicians/profiling/",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.carislifesciences.com/physicians/profiling/",
    "targetPopulation": "Patients requiring comprehensive multi-omic tumor profiling",
    "targetPopulationCitations": "https://www.carislifesciences.com/physicians/profiling/",
    "fdaStatus": "CLIA LDT - MI Cancer Seek component FDA approved; full MI Profile is LDT",
    "fdaStatusNotes": "MI Cancer Seek (WES+WTS component) received FDA approval Nov 2024; MI Profile as comprehensive service remains CLIA LDT.",
    "fdaStatusCitations": "https://www.carislifesciences.com/physicians/profiling/ | https://www.carislifesciences.com/about/news-and-media/caris-life-sciences-receives-fda-approval-for-mi-cancer-seek/",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Melanoma", "Prostate Cancer", "Ovarian Cancer", "Gastric Cancer"],
    "nccnGuidelinesNotes": "Multi-omic approach covers biomarkers recommended by NCCN guidelines at DNA, RNA, and protein levels. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1 | https://www.carislifesciences.com/physicians/profiling/",
    "tat": "10-14 days",
    "tatCitations": "https://www.carislifesciences.com/physicians/profiling/",
    "sampleRequirements": "FFPE tissue",
    "sampleRequirementsCitations": "https://www.carislifesciences.com/physicians/profiling/",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Coverage varies by payer and specific tests ordered.",
    "reimbursementCitations": "https://www.carislifesciences.com/physicians/profiling/",
    "clinicalAvailability": "Commercially available in US",
    "clinicalAvailabilityCitations": "https://www.carislifesciences.com/physicians/profiling/"
  },
  {
    "id": "cgp-15",
    "name": "Neo Comprehensive",
    "vendor": "NeoGenomics",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP",
    "method": "Comprehensive genomic profiling using DNA and RNA NGS; detects SNVs, indels, CNVs, fusions, splice variants, MSI, and TMB across 517 genes from FFPE tissue samples.",
    "methodCitations": "https://ir.neogenomics.com/news-events/press-releases/detail/235/neogenomics-expands-ngs-portfolio-with-launch-of-neo | https://www.neogenomics.com/test-menu",
    "genesAnalyzed": 517,
    "genesAnalyzedNotes": "517 genes analyzed via both DNA and RNA NGS methods.",
    "genesAnalyzedCitations": "NeoGenomics press release March 2023; NeoGenomics test menu.",
    "geneListUrl": "https://www.neogenomics.com/test-menu",
    "biomarkersReported": ["SNVs", "Indels", "CNVs", "Fusions", "Splice variants", "TMB", "MSI"],
    "biomarkersReportedNotes": "Comprehensive biomarker detection including both DNA alterations and RNA fusions/splice variants.",
    "biomarkersReportedCitations": "NeoGenomics press release March 2023.",
    "cancerTypes": ["All solid tumors"],
    "cancerTypesCitations": "https://www.neogenomics.com/test-menu",
    "targetPopulation": "Patients with solid tumors requiring comprehensive genomic profiling for diagnosis, therapy selection, prognosis, and clinical trial eligibility",
    "targetPopulationCitations": "NeoGenomics test menu; press releases.",
    "fdaStatus": "CLIA LDT - NOT FDA approved",
    "fdaStatusNotes": "CLIA-certified and CAP-accredited laboratory-developed test. New York State approved (Jan 2024).",
    "fdaStatusCitations": "https://ir.neogenomics.com/news-events/press-releases/detail/276/neogenomics-receives-new-york-state-approval-for-neo",
    "nccnRecommended": true,
    "nccnAlignmentType": "biomarker-coverage",
    "nccnGuidelinesAligned": ["NSCLC", "Breast Cancer", "Colorectal Cancer", "Melanoma", "Prostate Cancer", "Ovarian Cancer"],
    "nccnGuidelinesNotes": "Pan-cancer CGP aligns with NCCN guidelines for solid tumor biomarker testing. NCCN recommends testing specific genes/biomarkers but does not endorse specific commercial assays by name.",
    "nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1",
    "tat": "7-10 days",
    "tatNotes": "Improved turnaround time compared to previous NeoGenomics panels. Streamlined workflow.",
    "tatCitations": "NeoGenomics press release March 2023.",
    "sampleRequirements": "FFPE tissue (decreased specimen requirements vs previous panels)",
    "sampleRequirementsCitations": "NeoGenomics press release March 2023.",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Coverage varies by payer. Medicare coverage for CGP in advanced solid tumors. Commercial coverage varies.",
    "reimbursementCitations": "NeoGenomics website.",
    "clinicalAvailability": "Commercially available in US (including NY State)",
    "clinicalAvailabilityCitations": "https://ir.neogenomics.com/news-events/press-releases/detail/276/neogenomics-receives-new-york-state-approval-for-neo",
    "numPublications": null,
    "numPublicationsNotes": "Platform launched March 2023; publication record building.",
    "regulatoryStatusNotes": "CAP-accredited and CLIA-certified laboratories in Fort Myers and Tampa, FL; Aliso Viejo and San Diego, CA; Research Triangle Park, NC; and Houston, TX. New York State approved January 2024."
  }
];

// Compressed test data for chatbot - keeps all fields but shortens keys and removes nulls/citations
const compressTestForChat = (test) => {
  // Key mapping: long names → short names
  const keyMap = {
    id: 'id', name: 'nm', vendor: 'vn', approach: 'ap', method: 'mt', sampleCategory: 'samp',
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
  CGP: cgpTestData.map(compressTestForChat),
};

// Key legend for chatbot prompt
const chatKeyLegend = `KEY: nm=name, vn=vendor, ap=approach, mt=method, samp=sample type, ca=cancers, sens/spec=sensitivity/specificity%, aSpec=analytical specificity% (lab validation), cSpec=clinical specificity% (real-world, debatable in MRD), s1-s4=stage I-IV sensitivity, ppv/npv=predictive values, lod=detection threshold, lod95=95% confidence limit (gap between lod and lod95 means serial testing helps), tumorReq=requires tumor, vars=variants tracked, bvol=blood volume mL, cfIn=cfDNA input ng (critical for pharma - determines analytical sensitivity ceiling), tat1/tat2=initial/followup TAT days, lead=lead time vs imaging days, fda=FDA status, reimb=reimbursement, privIns=commercial payers, regions=availability (US/EU/UK/International/RUO), avail=clinical availability status, trial=participants, pubs=publications, scope=test scope, pop=target population, origAcc=tumor origin accuracy%, price=list price, respDef=response definition, nccn=NCCN guidelines.`;

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


const filterConfigs = {
  MRD: {
    // Oncologist priority: What cancer? Sample type? Is it covered? Is it FDA approved?
    cancerTypes: [...new Set(mrdTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: ['Blood/Plasma'],
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    reimbursements: ['Medicare', 'Commercial'],
    approaches: ['Tumor-informed', 'Tumor-naïve'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  ECD: {
    // Oncologist priority: Single cancer or multi? Sample type? What's the target population? Covered?
    testScopes: ['Single-cancer (CRC)', 'Multi-cancer (MCED)'],
    sampleCategories: ['Blood/Plasma', 'Stool'],
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT', 'Investigational'],
    reimbursements: ['Medicare', 'Commercial'],
    approaches: ['Blood-based cfDNA screening (plasma)', 'Blood-based cfDNA methylation MCED (plasma)'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  TRM: {
    // Oncologist priority: What cancer? Sample type? Approach? Covered?
    cancerTypes: [...new Set(trmTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: ['Blood/Plasma'],
    approaches: ['Tumor-informed', 'Tumor-naïve', 'Tumor-agnostic'],
    reimbursements: ['Medicare', 'Commercial'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  CGP: {
    // CGP priority: Sample type (tissue vs liquid), cancer types, FDA status, coverage
    cancerTypes: [...new Set(cgpTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(cgpTestData.map(t => t.sampleCategory || 'Unknown'))].sort(),
    approaches: [...new Set(cgpTestData.map(t => t.approach || 'Unknown'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    reimbursements: ['Medicare', 'Commercial'],
  }
};

// ============================================
// Comparison params by category
// ============================================
const comparisonParams = {
  MRD: [
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Cancer Types' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'sensitivityStagesReported', label: 'Stages in Headline' },
    { key: 'stageIISensitivity', label: 'Stage II Sensitivity (%)' },
    { key: 'stageIIISensitivity', label: 'Stage III Sensitivity (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'analyticalSpecificity', label: 'Analytical Specificity (%)' },
    { key: 'clinicalSpecificity', label: 'Clinical Specificity (%)' },
    { key: 'lod', label: 'LOD (detection)' },
    { key: 'lod95', label: 'LOD95 (95% conf)' },
    { key: 'variantsTracked', label: 'Variants Tracked' },
    { key: 'bloodVolume', label: 'Blood Volume (mL)' },
    { key: 'cfdnaInput', label: 'cfDNA Input (ng)' },
    { key: 'initialTat', label: 'Initial TAT (days)' },
    { key: 'followUpTat', label: 'Follow-up TAT (days)' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
  ],
  ECD: [
    { key: 'testScope', label: 'Scope' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'stageISensitivity', label: 'Stage I Sens (%)' },
    { key: 'stageIISensitivity', label: 'Stage II Sens (%)' },
    { key: 'stageIIISensitivity', label: 'Stage III Sens (%)' },
    { key: 'stageIVSensitivity', label: 'Stage IV Sens (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'ppv', label: 'PPV (%)' },
    { key: 'npv', label: 'NPV (%)' },
    { key: 'tumorOriginAccuracy', label: 'Origin Prediction (%)' },
    { key: 'leadTimeNotes', label: 'Lead Time vs Screening' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
    { key: 'clinicalAvailability', label: 'Clinical Availability' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleType', label: 'Sample Details' },
    { key: 'listPrice', label: 'List Price (USD)' },
    { key: 'screeningInterval', label: 'Screening Interval' },
    { key: 'cptCode', label: 'CPT Code' },
    { key: 'performanceCitations', label: 'Citations' },
    { key: 'performanceNotes', label: 'Performance Notes' },
  ],
  TRM: [
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'responseDefinition', label: 'Response Definition' },
    { key: 'leadTimeVsImaging', label: 'Lead Time (days)' },
    { key: 'lod', label: 'LOD (detection)' },
    { key: 'lod95', label: 'LOD95 (95% conf)' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
  ],
  CGP: [
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'genesAnalyzed', label: 'Genes Analyzed' },
    { key: 'biomarkersReportedStr', label: 'Biomarkers Reported' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'fdaCompanionDxCount', label: 'FDA CDx Indications' },
    { key: 'nccnRecommended', label: 'NCCN Recommended' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleRequirements', label: 'Sample Requirements' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'listPrice', label: 'List Price (USD)' },
  ],
};

// ============================================
// Category metadata
// ============================================
const categoryMeta = {
  MRD: {
    title: 'Molecular Residual Disease',
    shortTitle: 'MRD Testing',
    description: 'Molecular Residual Disease (MRD) testing detects tiny amounts of cancer that remain in the body after treatment, often before any symptoms or imaging findings appear. These tests analyze circulating tumor DNA (ctDNA) from a blood sample to identify whether cancer cells persist at the molecular level. MRD results help oncologists make critical decisions about whether additional treatment is needed, assess the effectiveness of therapy, and monitor for early signs of recurrence during surveillance.',
    // Patient-friendly versions
    patientTitle: 'Tests After Treatment',
    patientDescription: 'These blood tests check if any cancer cells remain after surgery or treatment. Finding leftover cancer early can help your doctor decide if you need more treatment.',
    color: 'orange',
    tests: mrdTestData,
    sourceUrl: BUILD_INFO.sources.MRD,
  },
  ECD: {
    title: 'Early Cancer Detection',
    shortTitle: 'Early Detection',
    description: 'Early Cancer Detection (ECD) tests screen for cancer in people who have no symptoms, with the goal of catching the disease at its earliest and most treatable stages. These tests look for cancer signals in blood samples using various biomarkers including ctDNA methylation patterns, tumor-derived proteins, and genetic mutations. Some tests screen for a single cancer type (like colorectal), while multi-cancer early detection (MCED) tests can screen for dozens of cancer types simultaneously.',
    // Patient-friendly versions
    patientTitle: 'Cancer Screening Tests',
    patientDescription: 'These blood tests look for signs of cancer before you have any symptoms. Finding cancer early, when it\'s easiest to treat, can save lives.',
    color: 'green',
    tests: ecdTestData,
    sourceUrl: BUILD_INFO.sources.ECD,
  },
  TRM: {
    title: 'Treatment Response Monitoring',
    shortTitle: 'Response Monitoring',
    description: 'Treatment Response Monitoring (TRM) tests track how well a cancer treatment is working by measuring changes in circulating tumor DNA (ctDNA) levels over time. A decrease in ctDNA often indicates the treatment is effective, while stable or rising levels may signal resistance or progression—sometimes weeks before changes appear on imaging scans. This sensitive molecular monitoring helps oncologists optimize therapy for most favorable outcomes, potentially switching ineffective treatments earlier and sparing patients unnecessary toxicity.',
    // Patient-friendly versions
    patientTitle: 'Is My Treatment Working?',
    patientDescription: 'These blood tests track whether your cancer treatment is working. They can show results weeks before a scan, helping your doctor adjust treatment if needed.',
    color: 'red',
    tests: trmTestData,
    sourceUrl: BUILD_INFO.sources.TRM,
  },
  CGP: {
    title: 'Comprehensive Genomic Profiling',
    shortTitle: 'Genomic Profiling',
    description: 'Comprehensive Genomic Profiling (CGP) tests analyze hundreds of genes simultaneously to identify actionable genomic alterations that can guide targeted therapy selection. Using next-generation sequencing (NGS) on tumor tissue or blood samples (liquid biopsy), these tests detect mutations, copy number alterations, gene fusions, and biomarkers like TMB and MSI. Results help oncologists match patients to FDA-approved targeted therapies, immunotherapies, and clinical trials based on the molecular profile of their cancer.',
    // Patient-friendly versions
    patientTitle: 'Find My Best Treatment',
    patientDescription: 'These tests analyze your tumor\'s genes to find specific treatments that may work best for your cancer. They can identify targeted therapies and clinical trials matched to your tumor.',
    color: 'violet',
    tests: cgpTestData,
    sourceUrl: BUILD_INFO.sources.CGP || '',
  },
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

const Badge = ({ children, variant = 'default' }) => {
  const styles = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-sky-100 text-sky-700 border-sky-300',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
};

// ============================================
// Header
// ============================================
const Header = ({ currentPage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const handleNavigate = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const navItems = ['home', 'submissions', 'how-it-works', 'data-sources', 'faq', 'about'];
  const getLabel = (page) => ({
    'home': 'Home',
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
const Footer = () => (
  <footer className="border-t border-gray-200 py-8 mt-12 bg-white">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <p className="text-sm text-gray-500 leading-relaxed">
        <strong>Disclaimer:</strong> OpenOnco is provided for informational and educational purposes only. The information on this website is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or treatment options. OpenOnco does not recommend or endorse any specific tests, physicians, products, procedures, or opinions. <strong>Nothing on this website constitutes reimbursement or coverage guidance, and should not be used to determine insurance coverage, patient financial responsibility, or billing practices.</strong> Reliance on any information provided by OpenOnco is solely at your own risk. Test performance data, pricing, and availability are subject to change and should be verified directly with test vendors.
      </p>
      <p className="text-xs text-gray-400 mt-4">
        Built: {BUILD_INFO.date}
      </p>
    </div>
  </footer>
);

// ============================================
// Unified Chat Component (All Categories)
// ============================================
const UnifiedChat = ({ isFloating = false, onClose = null }) => {
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length + cgpTestData.length;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const suggestedQuestions = [
    "Patient with breast cancer, stage II, neo-adjuvant, US, age 72. What MRD tests fit this profile and are reimbursable?",
    "Compare Signatera and Reveal MRD"
  ];

  useEffect(() => { 
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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
          model: selectedModel,
          max_tokens: 1000,
          system: systemPrompt,
          messages: recentMessages
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
        <p className="text-[#163A5E] text-sm">Query our database of {totalTests} MRD, ECD, TRM, and CGP tests</p>
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
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
        <div ref={messagesEndRef} />
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
    CGP: 'bg-violet-500'
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
// Test Showcase Component - Rotating parameters for each test
// ============================================
const TestShowcase = ({ onNavigate }) => {
  const [paramIndices, setParamIndices] = useState({});
  const [selectedTest, setSelectedTest] = useState(null);
  const [sortBy, setSortBy] = useState('vendor');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track persona
  const [persona, setPersona] = useState(getStoredPersona() || 'Clinician');
  useEffect(() => {
    const handlePersonaChange = (e) => setPersona(e.detail);
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);
  
  const isPatient = persona === 'Patient';

  // Combine all tests with their category
  const baseTests = [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD', color: 'orange' })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD', color: 'emerald' })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM', color: 'sky' })),
    ...cgpTestData.map(t => ({ ...t, category: 'CGP', color: 'violet' }))
  ];

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

  // Helper to calculate openness score (same as DatabaseSummary)
  const calcOpenness = (test) => {
    const hasValue = (val) => val != null && val !== '' && val !== 'N/A';
    let score = 0;
    if (hasValue(test.listPrice)) score += 30;
    if (hasValue(test.sensitivity)) score += 15;
    if (hasValue(test.specificity)) score += 15;
    if (test.numPublications != null && test.numPublications > 0) score += 15;
    if (hasValue(test.tat) || hasValue(test.initialTat)) score += 10;
    if (hasValue(test.bloodVolume) || hasValue(test.sampleType) || hasValue(test.sampleCategory)) score += 10;
    if (test.totalParticipants != null && test.totalParticipants > 0) score += 5;
    return score;
  };

  // Count tests per vendor
  const vendorTestCounts = useMemo(() => {
    const counts = {};
    baseTests.forEach(t => {
      counts[t.vendor] = (counts[t.vendor] || 0) + 1;
    });
    return counts;
  }, []);

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
  }, []);

  // Get TAT value for sorting
  const getTat = (test) => {
    const tat = test.tat || test.initialTat || test.followUpTat;
    if (tat == null) return 999; // No TAT = sort to end
    const days = typeof tat === 'number' ? tat : parseInt(tat);
    return isNaN(days) ? 999 : days;
  };

  // Sort tests based on selected option
  const allTests = useMemo(() => {
    const sorted = [...baseTests];
    switch (sortBy) {
      case 'category':
        const categoryOrder = { 'MRD': 0, 'ECD': 1, 'TRM': 2, 'CGP': 3 };
        return sorted.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category] || a.vendor.localeCompare(b.vendor));
      case 'tat':
        return sorted.sort((a, b) => getTat(a) - getTat(b));
      case 'reimbursement':
        return sorted.sort((a, b) => countReimbursement(b) - countReimbursement(a) || a.vendor.localeCompare(b.vendor));
      case 'vendorTests':
        return sorted.sort((a, b) => vendorTestCounts[b.vendor] - vendorTestCounts[a.vendor] || a.vendor.localeCompare(b.vendor));
      case 'openness':
        // Sort by vendor openness ranking (same as openness award logic)
        // Vendors with 2+ tests get ranked by average score, single-test vendors go to bottom
        return sorted.sort((a, b) => {
          const scoreA = vendorOpennessScores[a.vendor] ?? -1;
          const scoreB = vendorOpennessScores[b.vendor] ?? -1;
          if (scoreA !== scoreB) return scoreB - scoreA;
          // Within same vendor score, sort by individual test score
          return calcOpenness(b) - calcOpenness(a) || a.vendor.localeCompare(b.vendor);
        });
      case 'vendor':
      default:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [sortBy, vendorTestCounts, vendorOpennessScores]);

  // Filter tests based on search query
  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return allTests;
    const query = searchQuery.toLowerCase().trim();
    return allTests.filter(test => 
      test.name.toLowerCase().includes(query) ||
      test.vendor.toLowerCase().includes(query) ||
      test.category.toLowerCase().includes(query)
    );
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
    
    // Clinical parameters (from patient studies)
    if (test.sensitivity != null) params.push({ label: 'Sensitivity', value: `${test.sensitivity}%`, type: 'clinical' });
    if (test.specificity != null) params.push({ label: 'Specificity', value: `${test.specificity}%`, type: 'clinical' });
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
    
    if (test.listPrice != null) params.push({ label: 'List Price', value: `$${test.listPrice.toLocaleString()}`, type: 'operational' });
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

  // Rotate parameters every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setParamIndices(prev => {
        const next = { ...prev };
        filteredTests.forEach(test => {
          const params = isPatient ? getPatientParams(test) : getParams(test);
          const currentIdx = prev[test.id] || 0;
          next[test.id] = (currentIdx + 1) % params.length;
        });
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isPatient, filteredTests]);
  
  // Reset indices when persona changes
  useEffect(() => {
    setParamIndices({});
  }, [persona]);

  const colorClasses = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500', text: 'text-orange-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-500', text: 'text-emerald-600' },
    red: { bg: 'bg-sky-100', border: 'border-sky-300', badge: 'bg-sky-500', text: 'text-sky-600' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-500', text: 'text-sky-600' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-500', text: 'text-violet-600' }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-slate-800">
          The {allTests.length} Tests We Track
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort Order</span>
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
      
      {/* Search Bar */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tests or vendors..."
          className="w-full px-3 py-2 pl-8 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
        />
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Recently Added Tests */}
      <div className="bg-gradient-to-r from-blue-50 to-slate-50 border border-slate-200 rounded-lg p-2 mb-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Recently Added</p>
        <div className="flex flex-nowrap gap-1.5 overflow-hidden">
          {RECENTLY_ADDED_TESTS.map((test, i) => {
            const categoryColors = {
              MRD: 'bg-orange-100 text-orange-700 border-orange-200',
              ECD: 'bg-emerald-100 text-emerald-700 border-emerald-200',
              TRM: 'bg-sky-100 text-sky-700 border-sky-200',
              CGP: 'bg-violet-100 text-violet-700 border-violet-200'
            };
            return (
              <span 
                key={i}
                className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${categoryColors[test.category] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
              >
                {test.name} <span className="opacity-60">({test.category})</span>
              </span>
            );
          })}
        </div>
      </div>
      
      {/* Search results count */}
      {searchQuery && (
        <p className="text-xs text-slate-500 mb-2">
          {filteredTests.length === 0 ? 'No tests found' : `Showing ${filteredTests.length} of ${allTests.length} tests`}
        </p>
      )}
      {isPatient && (
        <p className="text-xs text-slate-500 text-center mb-3">
          Showing coverage, pricing & wait times
        </p>
      )}
      {!isPatient && !searchQuery && <div className="mb-3" />}
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {filteredTests.map(test => {
          const params = isPatient ? getPatientParams(test) : getParams(test);
          const currentIdx = paramIndices[test.id] || 0;
          const currentParam = params[currentIdx];
          const colors = colorClasses[test.color];
          
          return (
            <div
              key={test.id}
              onClick={() => setSelectedTest(test)}
              className={`${colors.bg} ${colors.border} border rounded-lg p-2 cursor-pointer hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{test.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{test.vendor}<VendorBadge vendor={test.vendor} size="xs" /></p>
                </div>
                <span className={`${colors.badge} text-white text-[9px] px-1 py-0.5 rounded font-medium ml-1 flex-shrink-0`}>
                  {test.category}
                </span>
              </div>
              
              <div className="h-8 flex flex-col justify-center">
                <p className="text-[10px] text-slate-500 truncate">{currentParam.label}</p>
                <p className={`text-sm font-bold ${paramTypeColors[currentParam.type] || 'text-slate-600'} transition-all truncate`}>
                  {currentParam.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-2 border-t border-slate-200 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          <span className="text-slate-500">{isPatient ? 'After Treatment' : 'MRD'}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="text-slate-500">{isPatient ? 'Screening' : 'ECD'}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
          <span className="text-slate-500">{isPatient ? 'During Treatment' : 'TRM'}</span>
        </span>
      </div>

      {/* Test Detail Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedTest(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Use TestDetailModal content structure */}
            {(() => {
              const category = selectedTest.category;
              const colorSchemes = {
                MRD: { headerBg: 'bg-gradient-to-r from-orange-500 to-amber-500' },
                ECD: { headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
                TRM: { headerBg: 'bg-gradient-to-r from-rose-500 to-pink-500' },
                CGP: { headerBg: 'bg-gradient-to-r from-violet-500 to-purple-500' }
              };
              const colors = colorSchemes[category] || colorSchemes.MRD;
              const hasMedicare = selectedTest.reimbursement?.toLowerCase().includes('medicare') && 
                !selectedTest.reimbursement?.toLowerCase().includes('not yet');
              const hasPrivate = selectedTest.commercialPayers && selectedTest.commercialPayers.length > 0;
              
              return (
                <>
                  {/* Header */}
                  <div className={`flex justify-between items-start p-5 ${colors.headerBg}`} style={{ flexShrink: 0 }}>
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
                  
                  {/* Preview Content */}
                  <div className="p-5 overflow-y-auto" style={{ flex: 1 }}>
                    {isPatient ? (
                      <div className="space-y-4">
                        <p className="text-gray-700">
                          {category === 'MRD' && "This test looks for tiny amounts of cancer DNA in your blood after treatment to help your doctor know if treatment worked."}
                          {category === 'ECD' && "This test screens your blood for signs of cancer before you have symptoms."}
                          {category === 'TRM' && "This test tracks whether your cancer treatment is working by measuring cancer DNA in your blood."}
                          {category === 'CGP' && "This test analyzes your tumor's genes to find the best targeted treatments for your specific cancer."}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`flex items-center gap-2 p-2 rounded-lg ${hasMedicare ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${hasMedicare ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                              {hasMedicare ? '✓' : '✗'}
                            </span>
                            <span className="text-sm">Medicare coverage</span>
                          </div>
                          <div className={`flex items-center gap-2 p-2 rounded-lg ${hasPrivate ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${hasPrivate ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                              {hasPrivate ? '✓' : '✗'}
                            </span>
                            <span className="text-sm">Private insurance</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        {selectedTest.sensitivity != null && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className={`font-bold text-emerald-600 ${String(selectedTest.sensitivity).length > 10 ? 'text-sm' : 'text-2xl'}`}>
                              {String(selectedTest.sensitivity).length > 20 
                                ? (String(selectedTest.sensitivity).match(/^[>≥]?\d+\.?\d*%?/) || [selectedTest.sensitivity])[0] + (String(selectedTest.sensitivity).includes('%') ? '' : '%')
                                : selectedTest.sensitivity + (String(selectedTest.sensitivity).includes('%') ? '' : '%')}
                            </p>
                            <p className="text-xs text-gray-500">Sensitivity</p>
                          </div>
                        )}
                        {selectedTest.specificity != null && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className={`font-bold text-emerald-600 ${String(selectedTest.specificity).length > 10 ? 'text-sm' : 'text-2xl'}`}>
                              {String(selectedTest.specificity).length > 20 
                                ? (String(selectedTest.specificity).match(/^[>≥]?\d+\.?\d*%?/) || [selectedTest.specificity])[0] + (String(selectedTest.specificity).includes('%') ? '' : '%')
                                : selectedTest.specificity + (String(selectedTest.specificity).includes('%') ? '' : '%')}
                            </p>
                            <p className="text-xs text-gray-500">Specificity</p>
                          </div>
                        )}
                        {(selectedTest.initialTat || selectedTest.tat) && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-2xl font-bold text-slate-600">{selectedTest.initialTat || selectedTest.tat}</p>
                            <p className="text-xs text-gray-500">TAT</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="border-t border-gray-200 px-5 py-4 flex justify-between items-center bg-gray-50" style={{ flexShrink: 0 }}>
                    <p className="text-sm text-gray-500">View full details in the navigator</p>
                    <button
                      onClick={() => { setSelectedTest(null); onNavigate(selectedTest.category, selectedTest.id); }}
                      className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90"
                      style={{ backgroundColor: '#2A63A4' }}
                    >
                      {isPatient ? 'See All Options' : `Open ${category} Navigator`}
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
    ...cgpTestData.map(t => ({ ...t, category: 'CGP', numIndications: t.cancerTypes?.length || 0 }))
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
    CGP: { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-500', text: 'text-violet-600' }
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

const HomePage = ({ onNavigate }) => {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [persona, setPersona] = useState(() => getStoredPersona() || null);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const chatContainerRef = useRef(null);

  // Save persona to localStorage when changed and notify other components
  const handlePersonaSelect = (selectedPersona) => {
    setPersona(selectedPersona);
    setMessages([]); // Reset chat so user can start fresh with new persona
    localStorage.setItem('openonco-persona', selectedPersona);
    // Dispatch custom event so NewsFeed can refresh
    window.dispatchEvent(new CustomEvent('personaChanged', { detail: selectedPersona }));
  };

  // Auto-scroll to bottom when messages or loading state changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
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
    "Compare Signatera and Guardant Reveal for colorectal cancer MRD monitoring",
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
          model: selectedModel,
          max_tokens: 1000,
          system: systemPrompt,
          messages: recentMessages
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

        {/* Intro Text */}
        <div className="bg-slate-50 rounded-2xl px-6 py-3 sm:px-8 sm:py-4 lg:px-10 lg:py-4 border border-slate-200 mb-4">
          <p className="text-base sm:text-xl lg:text-2xl text-slate-700 leading-relaxed">Cancer care is going molecular. Blood-based tests can now detect cancer early, guide treatment, and detect recurrence - but the options are overwhelming. <strong>OpenOnco</strong> is a non-profit service helping match patients to the right test.</p>
          
          {/* Persona Selector */}
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="text-sm sm:text-base text-slate-600">My interest is</span>
            {['Academic/Industry', 'Patient', 'Clinician'].map((p) => (
              <button
                key={p}
                onClick={() => handlePersonaSelect(p)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-all ${
                  persona === p
                    ? 'bg-[#2A63A4] text-white shadow-md'
                    : 'bg-white border border-slate-300 text-slate-600 hover:border-[#2A63A4] hover:text-[#2A63A4]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Unified Database Access Container */}
        <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 mb-4 overflow-hidden">
          {/* Container Header - different for patients */}
          <div className="px-4 lg:px-6 py-3 bg-slate-100 border-b border-slate-200">
            {persona === 'Patient' ? (
              <h2 className="text-sm lg:text-base font-semibold text-slate-600 uppercase tracking-wide">
                Ask about liquid biopsy tests for cancer treatment
              </h2>
            ) : (
              <div className="flex justify-between items-center">
                <h2 className="text-sm lg:text-base font-semibold text-slate-600 uppercase tracking-wide">
                  The Precision Oncology Diagnostics Cycle
                </h2>
                <span className="text-sm lg:text-base font-semibold text-slate-600 uppercase tracking-wide">
                  Click on the test category you want to explore
                </span>
              </div>
            )}
          </div>
          
          {/* For Patients: Chat first, then Lifecycle Navigator */}
          {persona === 'Patient' ? (
            <>
              {/* Chat Section */}
              <div className="bg-white">
              
              {/* Messages Area */}
              {messages.length > 0 && (
                <div ref={chatContainerRef} className="max-h-64 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div 
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}`}
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
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-2">
                        <p className="text-sm text-slate-500">Thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Input Area */}
              <div className="p-4 lg:p-6 border-t border-slate-200 bg-white">
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-2 lg:gap-3 items-center">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-2 py-2 lg:py-3 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 cursor-pointer"
                    title="Select AI model"
                  >
                    {CHAT_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your liquid biopsy test question here..."
                    className="flex-1 border-2 rounded-lg px-4 py-2 lg:py-3 lg:text-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: '#2A63A4', '--tw-ring-color': '#2A63A4' }}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !chatInput.trim()}
                    className="text-white px-6 lg:px-8 py-2 lg:py-3 rounded-lg font-medium lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #2A63A4, #1E4A7A)' }}
                  >
                    Ask
                  </button>
                </form>
                <p className="text-[10px] text-slate-400 mt-2 text-center">Powered by Claude AI. Responses may be inaccurate and should be independently verified.</p>
              </div>
              
              {/* Example Questions (show below input when no messages) */}
              {messages.length === 0 && (
                <div className="px-4 lg:px-6 py-3 bg-slate-50 border-t border-slate-100">
                  <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto">
                    <span className="text-xs lg:text-sm text-slate-500 flex-shrink-0">Try:</span>
                    {exampleQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(q)}
                        className="text-sm bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-600 hover:bg-[#EAF1F8] hover:border-[#6AA1C8] hover:text-[#1E4A7A] transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
              
              {/* Divider */}
              <div className="mx-4 lg:mx-6 border-t border-slate-200"></div>
              
              {/* Lifecycle Navigator Header */}
              <div className="px-4 lg:px-6 py-3 bg-slate-100 border-b border-slate-200">
                <h3 className="text-sm lg:text-base font-semibold text-slate-600 uppercase tracking-wide">Or browse by category:</h3>
              </div>
              
              {/* Lifecycle Navigator */}
              <div className="p-4 lg:p-6">
                <LifecycleNavigator onNavigate={onNavigate} />
              </div>
            </>
          ) : (
            <>
              {/* Lifecycle Navigator */}
              <div className="p-4 lg:p-6">
                <LifecycleNavigator onNavigate={onNavigate} />
              </div>
              
              {/* Divider */}
              <div className="mx-4 lg:mx-6 border-t border-slate-200"></div>
              
              {/* Chat Section */}
              <div className="bg-white">
                {/* Chat Header */}
                <div className="px-4 lg:px-6 py-3 border-b border-slate-100">
                  <h3 className="text-sm lg:text-base font-semibold text-slate-600 uppercase tracking-wide">Or ask Claude questions about the tests:</h3>
                </div>
              
              {/* Messages Area */}
              {messages.length > 0 && (
                <div ref={chatContainerRef} className="max-h-64 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div 
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}`}
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
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-2">
                        <p className="text-sm text-slate-500">Thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Input Area */}
              <div className="p-4 lg:p-6 border-t border-slate-200 bg-white">
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-2 lg:gap-3 items-center">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-2 py-2 lg:py-3 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 cursor-pointer"
                    title="Select AI model"
                  >
                    {CHAT_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your liquid biopsy test question here..."
                    className="flex-1 border-2 rounded-lg px-4 py-2 lg:py-3 lg:text-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: '#2A63A4', '--tw-ring-color': '#2A63A4' }}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !chatInput.trim()}
                    className="text-white px-6 lg:px-8 py-2 lg:py-3 rounded-lg font-medium lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #2A63A4, #1E4A7A)' }}
                  >
                    Ask
                  </button>
                </form>
                <p className="text-[10px] text-slate-400 mt-2 text-center">Powered by Claude AI. Responses may be inaccurate and should be independently verified.</p>
              </div>
              
              {/* Example Questions (show below input when no messages) */}
              {messages.length === 0 && (
                <div className="px-4 lg:px-6 py-3 bg-slate-50 border-t border-slate-100">
                  <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto">
                    <span className="text-xs lg:text-sm text-slate-500 flex-shrink-0">Try:</span>
                    {exampleQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(q)}
                        className="text-sm bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-600 hover:bg-[#EAF1F8] hover:border-[#6AA1C8] hover:text-[#1E4A7A] transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </>
          )}
        </div>

        {/* Test Showcase */}
        <div className="mb-4">
          <TestShowcase onNavigate={onNavigate} />
        </div>

        {/* Stat of the Day */}
        <div className="mb-4">
          <StatOfTheDay onNavigate={onNavigate} />
        </div>

        {/* Database Summary */}
        <div className="mb-4">
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
  const mrdParams = mrdTestData.length > 0 ? Object.keys(mrdTestData[0]).length : 0;
  const ecdParams = ecdTestData.length > 0 ? Object.keys(ecdTestData[0]).length : 0;
  const trmParams = trmTestData.length > 0 ? Object.keys(trmTestData[0]).length : 0;
  const cgpParams = cgpTestData.length > 0 ? Object.keys(cgpTestData[0]).length : 0;
  
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length + cgpTestData.length;
  const totalDataPoints = (mrdTestData.length * mrdParams) + (ecdTestData.length * ecdParams) + (trmTestData.length * trmParams) + (cgpTestData.length * cgpParams);
  
  const allVendors = new Set([
    ...mrdTestData.map(t => t.vendor),
    ...ecdTestData.map(t => t.vendor),
    ...trmTestData.map(t => t.vendor),
    ...cgpTestData.map(t => t.vendor)
  ]);

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
      
      {/* Category breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">{mrdTestData.length}</div>
          <div>
            <p className="text-xs font-medium text-gray-800">MRD</p>
            <p className="text-[10px] text-gray-500">{mrdParams} fields</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">{ecdTestData.length}</div>
          <div>
            <p className="text-xs font-medium text-gray-800">ECD</p>
            <p className="text-[10px] text-gray-500">{ecdParams} fields</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-sky-50 rounded-lg border border-sky-100">
          <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold">{trmTestData.length}</div>
          <div>
            <p className="text-xs font-medium text-gray-800">TRM</p>
            <p className="text-[10px] text-gray-500">{trmParams} fields</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-100">
          <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">{cgpTestData.length}</div>
          <div>
            <p className="text-xs font-medium text-gray-800">CGP</p>
            <p className="text-[10px] text-gray-500">{cgpParams} fields</p>
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
  const cgpParams = cgpTestData.length > 0 ? Object.keys(cgpTestData[0]).length : 0;
  
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length + cgpTestData.length;
  const totalDataPoints = (mrdTestData.length * mrdParams) + (ecdTestData.length * ecdParams) + (trmTestData.length * trmParams) + (cgpTestData.length * cgpParams);
  
  const allTests = [...mrdTestData, ...ecdTestData, ...trmTestData, ...cgpTestData];
  
  const allVendors = new Set([
    ...mrdTestData.map(t => t.vendor),
    ...ecdTestData.map(t => t.vendor),
    ...trmTestData.map(t => t.vendor),
    ...cgpTestData.map(t => t.vendor)
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

  // Calculate openness score per test (0-100)
  const calcTestScore = (test) => {
    let score = 0;
    if (hasValue(test.listPrice)) score += 30;
    if (hasValue(test.sensitivity)) score += 15;
    if (hasValue(test.specificity)) score += 15;
    if (test.numPublications != null && test.numPublications > 0) score += 15;
    if (hasValue(test.tat) || hasValue(test.initialTat)) score += 10;
    if (hasValue(test.bloodVolume) || hasValue(test.sampleType) || hasValue(test.sampleCategory)) score += 10;
    if (test.totalParticipants != null && test.totalParticipants > 0) score += 5;
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

  // Find most transparent vendor (min 2 tests to qualify)
  let topVendor = null;
  let topScore = 0;
  let topTestCount = 0;
  Object.entries(vendorScores).forEach(([vendor, data]) => {
    if (data.count >= 2) {
      const avgScore = data.total / data.count;
      if (avgScore > topScore) {
        topScore = avgScore;
        topVendor = vendor;
        topTestCount = data.count;
      }
    }
  });

  // Data quality metrics - calculate fill rates for key fields
  const calcFillRate = (tests, checkFn) => {
    if (!tests || tests.length === 0) return 0;
    const filled = tests.filter(checkFn).length;
    return Math.round((filled / tests.length) * 100);
  };

  const dataQualityMetrics = [
    {
      label: 'Price',
      rate: calcFillRate(allTests, t => hasValue(t.listPrice)),
      color: 'rose',
      description: 'List price disclosed'
    },
    {
      label: 'Performance',
      rate: calcFillRate(allTests, t => hasValue(t.sensitivity) || hasValue(t.specificity)),
      color: 'amber',
      description: 'Sensitivity or specificity'
    },
    {
      label: 'Evidence',
      rate: calcFillRate(allTests, t => t.numPublications != null && t.numPublications > 0),
      color: 'emerald',
      description: 'Peer-reviewed publications'
    },
    {
      label: 'Coverage',
      rate: calcFillRate(allTests, t => hasReimbursement(t)),
      color: 'sky',
      description: 'Insurance reimbursement'
    },
    {
      label: 'Turnaround',
      rate: calcFillRate(allTests, t => hasValue(t.tat) || hasValue(t.initialTat)),
      color: 'violet',
      description: 'TAT disclosed'
    }
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

  return (
    <div className="bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl p-6">
      {/* Openness Award Banner */}
      {topVendor && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-2 border-amber-300 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">
              🏆
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-amber-700">OpenOnco Openness Award</p>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-medium rounded-full">2025</span>
              </div>
              <p className="text-xl font-bold text-slate-800">{topVendor}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {topTestCount} tests evaluated
              </p>
            </div>
            {/* Score comparison */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-center px-3 py-2 bg-white/50 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{Math.round(topScore)}</div>
                <div className="text-[10px] text-amber-600 font-medium">Winner</div>
              </div>
              <div className="text-slate-400 text-lg">vs</div>
              <div className="text-center px-3 py-2 bg-white/50 rounded-lg">
                <div className="text-2xl font-bold text-slate-500">{fieldAvgScore}</div>
                <div className="text-[10px] text-slate-500 font-medium">Field Avg</div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between gap-4">
            <p className="text-[11px] text-amber-600 flex-1">
              Score based on disclosure of pricing, performance, evidence & sample info. Field average across {qualifyingVendors.length} vendors with 2+ tests.
            </p>
            <button 
              onClick={() => setShowFAQ(!showFAQ)}
              className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
            >
              {showFAQ ? 'Hide details' : 'How is this calculated?'}
              <svg className={`w-4 h-4 transition-transform ${showFAQ ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {/* FAQ Section */}
          {showFAQ && (
            <div className="mt-4 pt-4 border-t border-amber-200 text-sm text-slate-700 space-y-4">
              <div>
                <h4 className="font-semibold text-amber-800 mb-2">What is the Openness Score?</h4>
                <p className="text-xs text-slate-600">
                  The OpenOnco Openness Score measures how completely vendors disclose key information about their tests. 
                  It rewards vendors who publish pricing, performance data, and clinical evidence—information that helps 
                  patients and clinicians make informed decisions.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-amber-800 mb-2">How is it calculated?</h4>
                <p className="text-xs text-slate-600 mb-2">Each test is scored based on disclosure of key fields (weights sum to 100):</p>
                <div className="bg-white/60 rounded-lg p-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-amber-200">
                        <th className="text-left py-1.5 pr-4 font-semibold text-amber-800">Field</th>
                        <th className="text-center py-1.5 px-2 font-semibold text-amber-800">Weight</th>
                        <th className="text-left py-1.5 pl-4 font-semibold text-amber-800">Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      <tr className="border-b border-amber-100">
                        <td className="py-1.5 pr-4 font-medium">Price</td>
                        <td className="text-center py-1.5 px-2 font-bold text-amber-600">30%</td>
                        <td className="py-1.5 pl-4">Hardest to find, gold standard of openness</td>
                      </tr>
                      <tr className="border-b border-amber-100">
                        <td className="py-1.5 pr-4 font-medium">Sensitivity</td>
                        <td className="text-center py-1.5 px-2 font-bold text-amber-600">15%</td>
                        <td className="py-1.5 pl-4">Core performance metric</td>
                      </tr>
                      <tr className="border-b border-amber-100">
                        <td className="py-1.5 pr-4 font-medium">Specificity</td>
                        <td className="text-center py-1.5 px-2 font-bold text-amber-600">15%</td>
                        <td className="py-1.5 pl-4">Core performance metric</td>
                      </tr>
                      <tr className="border-b border-amber-100">
                        <td className="py-1.5 pr-4 font-medium">Publications</td>
                        <td className="text-center py-1.5 px-2 font-bold text-amber-600">15%</td>
                        <td className="py-1.5 pl-4">Peer-reviewed evidence base</td>
                      </tr>
                      <tr className="border-b border-amber-100">
                        <td className="py-1.5 pr-4 font-medium">Turnaround Time</td>
                        <td className="text-center py-1.5 px-2 font-bold text-amber-600">10%</td>
                        <td className="py-1.5 pl-4">Practical info for clinicians</td>
                      </tr>
                      <tr className="border-b border-amber-100">
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
                      <tr className="border-t border-amber-200">
                        <td className="py-1.5 pr-4 font-bold text-amber-800">Total</td>
                        <td className="text-center py-1.5 px-2 font-bold text-amber-800">100%</td>
                        <td className="py-1.5 pl-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-amber-800 mb-2">Who is eligible?</h4>
                <p className="text-xs text-slate-600">
                  Vendors must have <strong>2 or more tests</strong> in the OpenOnco database to qualify for the award. 
                  The vendor's score is the <strong>average</strong> across all their tests. This prevents a single 
                  well-documented test from winning while encouraging comprehensive disclosure across product portfolios.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-amber-800 mb-2">Why these weights?</h4>
                <p className="text-xs text-slate-600">
                  <strong>Price (30%)</strong> is weighted highest because it's the most commonly withheld information 
                  and critically important for patients and healthcare systems. <strong>Performance metrics (30% combined)</strong> are 
                  essential for clinical decision-making. <strong>Publications (15%)</strong> demonstrate commitment to 
                  independent validation. Practical details like <strong>TAT and sample requirements (20% combined)</strong> help 
                  with care coordination.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-amber-800 mb-2">How can vendors improve their score?</h4>
                <p className="text-xs text-slate-600">
                  Publish your list price, disclose sensitivity and specificity from validation studies, maintain an 
                  active publication record, and provide clear sample requirements. Vendors can submit updated information 
                  through our Submissions page.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header with key stats */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-700">Data Openness Overview</h2>
        <div className="text-xs text-slate-500">Updated {BUILD_INFO.date.split(' ').slice(0, 2).join(' ')}</div>
      </div>
      
      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-800">{totalTests}</p>
          <p className="text-xs text-slate-600">Tests</p>
        </div>
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-800">{allVendors.size}</p>
          <p className="text-xs text-slate-600">Vendors</p>
        </div>
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-800">{reimbursedTests.length}</p>
          <p className="text-xs text-slate-600">Reimbursed</p>
        </div>
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-800">{totalDataPoints.toLocaleString()}</p>
          <p className="text-xs text-slate-600">Data Points</p>
        </div>
      </div>
      
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
      
      {/* Category breakdown */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <div className="bg-orange-100 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-orange-700">{mrdTestData.length}</p>
          <p className="text-[10px] text-orange-600 font-medium">MRD</p>
        </div>
        <div className="bg-emerald-100 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-emerald-700">{ecdTestData.length}</p>
          <p className="text-[10px] text-emerald-600 font-medium">ECD</p>
        </div>
        <div className="bg-sky-100 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-sky-700">{trmTestData.length}</p>
          <p className="text-[10px] text-sky-600 font-medium">TRM</p>
        </div>
        <div className="bg-violet-100 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-violet-700">{cgpTestData.length}</p>
          <p className="text-[10px] text-violet-600 font-medium">CGP</p>
        </div>
      </div>
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

  const faqs = [
    {
      question: "What types of tests does OpenOnco cover?",
      answer: (
        <p>
          OpenOnco focuses on laboratory-developed tests (LDTs) and services that patients and clinicians can access directly. We cover four categories of cancer testing: <strong>Early Cancer Detection (ECD)</strong> for screening, <strong>Comprehensive Genomic Profiling (CGP)</strong> for newly diagnosed patients, <strong>Treatment Response Monitoring (TRM)</strong> for patients on active treatment, and <strong>Minimal Residual Disease (MRD)</strong> for surveillance after treatment. We do not include reagent kits or assay systems that laboratories must purchase and validate themselves—our focus is on orderable services.
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
      question: "What is the OpenOnco Openness Award?",
      answer: (
        <div className="space-y-4">
          <p>
            The OpenOnco Openness Score measures how completely vendors disclose key information about their tests. 
            It rewards vendors who publish pricing, performance data, and clinical evidence—information that helps 
            patients and clinicians make informed decisions.
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
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 font-medium">Sensitivity</td><td className="text-center py-2 px-3 font-bold text-amber-600">15%</td><td className="py-2 px-3">Core performance metric</td></tr>
                <tr className="border-b"><td className="py-2 px-3 font-medium">Specificity</td><td className="text-center py-2 px-3 font-bold text-amber-600">15%</td><td className="py-2 px-3">Core performance metric</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 font-medium">Publications</td><td className="text-center py-2 px-3 font-bold text-amber-600">15%</td><td className="py-2 px-3">Peer-reviewed evidence base</td></tr>
                <tr className="border-b"><td className="py-2 px-3 font-medium">Turnaround Time</td><td className="text-center py-2 px-3 font-bold text-amber-600">10%</td><td className="py-2 px-3">Practical info for clinicians</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 font-medium">Sample Info</td><td className="text-center py-2 px-3 font-bold text-amber-600">10%</td><td className="py-2 px-3">Blood volume, sample type, or category</td></tr>
                <tr><td className="py-2 px-3 font-medium">Trial Participants</td><td className="text-center py-2 px-3 font-bold text-amber-600">5%</td><td className="py-2 px-3">Clinical evidence depth</td></tr>
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-200"><td className="py-2 px-3 font-bold">Total</td><td className="text-center py-2 px-3 font-bold text-amber-700">100%</td><td className="py-2 px-3"></td></tr>
              </tfoot>
            </table>
          </div>
          
          <p className="font-medium text-gray-800 mt-4">Who is eligible?</p>
          <p>
            Vendors must have <strong>2 or more tests</strong> in the OpenOnco database to qualify. The vendor's 
            score is the <strong>average</strong> across all their tests. This prevents a single well-documented 
            test from winning while encouraging comprehensive disclosure across product portfolios.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">Why these weights?</p>
          <p>
            <strong>Price (30%)</strong> is weighted highest because it's the most commonly withheld information 
            and critically important for patients and healthcare systems. <strong>Performance metrics (30% combined)</strong> are 
            essential for clinical decision-making. <strong>Publications (15%)</strong> demonstrate commitment to 
            independent validation. Practical details like <strong>TAT and sample requirements (20% combined)</strong> help 
            with care coordination.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">How can vendors improve their score?</p>
          <p>
            Publish your list price, disclose sensitivity and specificity from validation studies, maintain an 
            active publication record, and provide clear sample requirements. Vendors can submit updated information 
            through our Submissions page.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
      <p className="text-gray-600 mb-8">
        Common questions about OpenOnco, our data, and how to use the platform.
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
    </div>
  );
};

// ============================================
// About Page
// ============================================
const AboutPage = () => (
  <div className="max-w-3xl mx-auto px-6 py-16">
    <h1 className="text-3xl font-bold text-gray-900 mb-8">About</h1>
    <div className="prose prose-lg text-gray-700 space-y-6">
      <p>
        Hi, my name is Alex Dickinson. Like you, my friends and family have been impacted by cancer throughout my life.
      </p>
      <p>
        Professionally I've had the good fortune to stumble into the amazing world of cancer diagnostics people, companies and technologies. Along the way I've become convinced that liquid biopsy tests of various types (LBx) can have an extraordinary positive impact on cancer detection and treatment. A simple blood draw, followed by an extraordinary combination of DNA sequencing and information processing, can give deep insight into either the presence, absence or treatment of a cancer at the molecular level.
      </p>
      <p>
        Unsurprisingly, this is a very complex field and the technology and options can be overwhelming to doctors and patients. This confusion will only increase as LBx options are rapidly expanding due to advances in the technology and increasing regulatory freedom for test vendors.
      </p>
      <p>
        OpenOnco is a group effort to make it easier to navigate the complex world of LBx tests - many thanks to all those who have provided, and continue to provide advice for this project.
      </p>
      <p>
        For any comments or questions about OpenOnco feel free to contact me directly via <a href="https://www.linkedin.com/in/alexgdickinson/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 underline">LinkedIn</a> (please include #openonco in your message).
      </p>
    </div>
  </div>
);

// ============================================
// How It Works Page
// ============================================
const HowItWorksPage = () => (
  <div className="max-w-3xl mx-auto px-6 py-16">
    <h1 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h1>
    <div className="prose prose-lg text-gray-700 space-y-6">

      <h2 className="text-2xl font-bold text-gray-900">OpenOnco is Open</h2>
      
      <p>
        The OpenOnco database is assembled from a wide variety of public sources including vendor databases, peer reviewed publications, and clinical trial registries. Sources are cited to the best of our ability along with context and notes on possible contradictory data and its resolution. Information on the database update process can be found below in the Technical Information section.
      </p>

      <p>
        The current version of the OpenOnco database is available for anyone to download in several formats - go to the <strong>Data Download</strong> tab. Go to the <strong>Submissions</strong> tab to tell us about a new test, request changes to test data, and send us bug reports and feature suggestions.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mt-10">Technical Information</h2>
      
      <p className="mt-4">
        OpenOnco is vibe-coded in React using Opus 4.5. The test database is hardcoded as a JSON structure inside the app. The app (and embedded database) are updated as-needed when new data or tools are added. You can find the build date of the version you are running under the <strong>Data Download</strong> tab. Data for each build is cross-checked by GPT Pro 5.1, Gemini 3, and Opus 4.5. Once the models have beaten each other into submission, the new code is committed to GitHub and deployed on Vercel.
      </p>

    </div>
  </div>
);

// ============================================
// Submissions Page
// ============================================
const SubmissionsPage = () => {
  const [submissionType, setSubmissionType] = useState(''); // 'new', 'correction', 'bug', 'feature'
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
  const [selectedParameter, setSelectedParameter] = useState('');
  const [newValue, setNewValue] = useState('');
  const [citation, setCitation] = useState('');
  
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
    CGP: cgpTestData.map(t => ({ id: t.id, name: t.name, vendor: t.vendor })),
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
    CGP: [
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
  };

  // Get current value of selected parameter for the selected test
  const getCurrentValue = () => {
    if (!existingTest || !selectedParameter || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : category === 'TRM' ? trmTestData : cgpTestData;
    const test = testList.find(t => t.id === existingTest);
    if (!test || selectedParameter === 'other') return '';
    const value = test[selectedParameter];
    return value !== null && value !== undefined ? String(value) : 'Not specified';
  };

  // Get vendor name for selected test (for email validation)
  const getSelectedTestVendor = () => {
    if (!existingTest || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : category === 'TRM' ? trmTestData : cgpTestData;
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
    // Check if vendor name appears in domain
    return domainClean.includes(vendorClean);
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
    
    if (!submitterType || !category) return false;
    
    if (submissionType === 'new') {
      return newTestName && newTestVendor && newTestUrl;
    } else if (submissionType === 'correction') {
      return existingTest && selectedParameter && newValue && citation;
    }
    
    return false;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Submissions</h1>
      <p className="text-gray-600 mb-8">Help us improve OpenOnco with your feedback and data contributions.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Test Data Update */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Test Data Update</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setSubmissionType('new'); setExistingTest(''); setSelectedParameter(''); setFeedbackDescription(''); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'new' ? 'border-[#2A63A4] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-800">Suggest a New Test</div>
              <div className="text-sm text-gray-500">Notify us of a test not in our database</div>
            </button>
            <button
              type="button"
              onClick={() => { setSubmissionType('correction'); setNewTestName(''); setNewTestVendor(''); setNewTestUrl(''); setFeedbackDescription(''); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'correction' ? 'border-[#2A63A4] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-800">File a Correction</div>
              <div className="text-sm text-gray-500">Suggest an update to existing test data</div>
            </button>
          </div>
          
          <label className="block text-sm font-semibold text-gray-700 mt-6 mb-3">Bug Reports & Feature Requests</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setSubmissionType('bug'); setSubmitterType(''); setCategory(''); setNewTestName(''); setNewTestVendor(''); setExistingTest(''); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'bug' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`font-semibold ${submissionType === 'bug' ? 'text-red-700' : 'text-gray-800'}`}>Report a Bug</div>
              <div className="text-sm text-gray-500">Something isn't working correctly</div>
            </button>
            <button
              type="button"
              onClick={() => { setSubmissionType('feature'); setSubmitterType(''); setCategory(''); setNewTestName(''); setNewTestVendor(''); setExistingTest(''); }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${submissionType === 'feature' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`font-semibold ${submissionType === 'feature' ? 'text-purple-700' : 'text-gray-800'}`}>Request a Feature</div>
              <div className="text-sm text-gray-500">Suggest an improvement or new capability</div>
            </button>
          </div>
        </div>

        {/* Submitter Type */}
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
              <p className="text-sm text-gray-500 mt-2">Expert submissions require a company or institutional email</p>
            )}
          </div>
        )}

        {/* Category Selection */}
        {submitterType && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Test Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'MRD', label: 'MRD', desc: 'Minimal Residual Disease', color: 'orange' },
                { key: 'ECD', label: 'ECD', desc: 'Early Cancer Detection', color: 'emerald' },
                { key: 'TRM', label: 'TRM', desc: 'Treatment Response', color: 'sky' },
                { key: 'CGP', label: 'CGP', desc: 'Genomic Profiling', color: 'violet' },
              ].map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { setCategory(cat.key); setExistingTest(''); setSelectedParameter(''); }}
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
        {category && (submissionType === 'new' ? newTestName && newTestVendor : existingTest && selectedParameter) && (
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
            <button
              type="submit"
              disabled={verificationStep !== 'verified' || isSubmitting}
              className="w-full text-white px-8 py-4 rounded-xl font-semibold transition-all text-lg shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(to right, #2A63A4, #1E4A7A)' }}
            >
              {isSubmitting ? 'Submitting...' : verificationStep !== 'verified' ? 'Verify Email to Submit Request' : 'Submit Request'}
            </button>
          </>
        )}
      </form>

      {/* Openness Encouragement Section */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">We Value Openness</h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            The more complete your submission, the better we can serve patients and clinicians. 
            We encourage vendors to share pricing, performance data, and clinical evidence openly.
          </p>
        </div>
        <DatabaseSummary />
      </div>
    </div>
  );
};

const SourceDataPage = () => {
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
        website: 'https://openonco.org'
      },
      categories: {
        MRD: {
          name: 'Molecular Residual Disease',
          description: 'Tests for detecting minimal/molecular residual disease after treatment',
          testCount: mrdTestData.length,
          tests: mrdTestData
        },
        ECD: {
          name: 'Early Cancer Detection',
          description: 'Screening and early detection tests including MCED',
          testCount: ecdTestData.length,
          tests: ecdTestData
        },
        TRM: {
          name: 'Treatment Response Monitoring',
          description: 'Tests for monitoring treatment response during therapy',
          testCount: trmTestData.length,
          tests: trmTestData
        },
        CGP: {
          name: 'Comprehensive Genomic Profiling',
          description: 'Tests for identifying actionable genomic alterations to guide targeted therapy selection',
          testCount: cgpTestData.length,
          tests: cgpTestData
        }
      },
      totalTests: mrdTestData.length + ecdTestData.length + trmTestData.length + cgpTestData.length
    };
    return JSON.stringify(allData, null, 2);
  };

  const downloadJson = () => {
    downloadFile(generateAllTestsJson(), 'OpenOnco_AllTests.json', 'application/json;charset=utf-8;');
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header with Build Date */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Data Download</h1>
        <p className="text-gray-600 mb-4">
          OpenOnco is committed to openness. All data is open and downloadable.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-700">Last Updated: {BUILD_INFO.date}</span>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mb-8">
        <DatabaseStatsSimple />
      </div>

      {/* Download Section */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">Download Complete Dataset</h2>

      {/* Combined JSON Download */}
      <div className="mb-8">
        <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Complete Dataset (All Categories)</h3>
                <p className="text-sm text-gray-500">{mrdTestData.length + ecdTestData.length + trmTestData.length + cgpTestData.length} tests • MRD + ECD + TRM + CGP combined • JSON format</p>
              </div>
            </div>
            <button
              onClick={downloadJson}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium text-white shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download JSON
            </button>
          </div>
        </div>

      </div>

      {/* Data Attribution */}
      <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Data Sources & Attribution</h3>
        <p className="text-sm text-gray-600 mb-4">
          OpenOnco compiles publicly available information from multiple authoritative sources:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 mb-4">
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">•</span>
            <span>Vendor websites, product documentation, and healthcare professional resources</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">•</span>
            <span>FDA approval documents, PMA summaries, and 510(k) clearances</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">•</span>
            <span>Peer-reviewed publications and clinical trial results</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">•</span>
            <span>CMS coverage determinations and reimbursement policies</span>
          </li>
        </ul>
        <p className="text-xs text-gray-500">
          This data is provided for informational purposes only. Always verify with official sources for clinical decision-making.
        </p>
      </div>
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
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  
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
          model: selectedModel,
          max_tokens: 800,
          system: systemPrompt,
          messages: conversationHistory
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
      <div className="h-56 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
        <div ref={messagesEndRef} />
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
        <span className="text-sm font-medium text-gray-900">{displayValue}</span>
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
      <span className="text-sm font-medium text-gray-900 text-right">{displayValue}</span>
    </div>
  );
};

// ============================================
// Test Card
// ============================================
const TestCard = ({ test, isSelected, onSelect, category, onShowDetail }) => {
  const colorVariant = categoryMeta[category]?.color || 'amber';
  
  return (
    <div id={`test-card-${test.id}`} className={`bg-white rounded-xl border-2 p-4 transition-all ${isSelected ? 'border-emerald-500 shadow-md shadow-emerald-100' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* Header - clickable to show detail modal */}
      <div className="cursor-pointer" onClick={() => onShowDetail && onShowDetail(test)}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {test.reimbursement?.toLowerCase().includes('medicare') && test.commercialPayers && test.commercialPayers.length > 0 
                ? <Badge variant="success">Medicare+Private</Badge>
                : test.reimbursement?.toLowerCase().includes('medicare') 
                  ? <Badge variant="success">Medicare</Badge>
                  : test.commercialPayers && test.commercialPayers.length > 0 
                    ? <Badge variant="blue">Private</Badge>
                    : null}
              {category === 'ECD' && test.listPrice && <Badge variant="amber">${test.listPrice}</Badge>}
              {test.totalParticipants && <Badge variant="blue">{test.totalParticipants.toLocaleString()} trial participants</Badge>}
              {test.numPublications && <Badge variant="purple">{test.numPublications}{test.numPublicationsPlus ? '+' : ''} pubs</Badge>}
              {test.approach && <Badge variant={colorVariant}>{test.approach}</Badge>}
              {test.testScope && <Badge variant={colorVariant}>{test.testScope}</Badge>}
            </div>
            <h3 className="font-semibold text-gray-900">{test.name}</h3>
            <p className="text-sm text-gray-500">{test.vendor}<VendorBadge vendor={test.vendor} size="sm" /></p>
          </div>
          {/* Prominent comparison checkbox - click selects for comparison */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(test.id); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all flex-shrink-0 ${
              isSelected 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : 'bg-white border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
            }`}
            title={isSelected ? 'Remove from comparison' : 'Add to comparison'}
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
          {category !== 'CGP' && test.sensitivity != null && <div><p className="text-lg font-bold text-emerald-600">{test.sensitivity}%</p><p className="text-xs text-gray-500">Reported Sens.</p></div>}
          {category !== 'CGP' && test.specificity != null && <div><p className="text-lg font-bold text-emerald-600">{test.specificity}%</p><p className="text-xs text-gray-500">Specificity</p></div>}
          {/* LOD display - show both LOD and LOD95 when available */}
          {category !== 'CGP' && (test.lod != null || test.lod95 != null) && (
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
          {category === 'MRD' && test.initialTat && <div><p className="text-lg font-bold text-slate-600">{test.initialTat}d</p><p className="text-xs text-gray-500">TAT</p></div>}
          {category === 'TRM' && test.leadTimeVsImaging && <div><p className="text-lg font-bold text-emerald-600">{test.leadTimeVsImaging}d</p><p className="text-xs text-gray-500">Lead Time</p></div>}
          {category === 'ECD' && test.stageISensitivity && <div><p className="text-lg font-bold text-emerald-600">{test.stageISensitivity}%</p><p className="text-xs text-gray-500">Stage I</p></div>}
          {category === 'ECD' && test.ppv != null && <div><p className="text-lg font-bold text-emerald-600">{test.ppv}%</p><p className="text-xs text-gray-500">PPV</p></div>}
          {category === 'CGP' && test.genesAnalyzed && <div><p className="text-lg font-bold text-violet-600">{test.genesAnalyzed}</p><p className="text-xs text-gray-500">Genes</p></div>}
          {category === 'CGP' && test.fdaCompanionDxCount && <div><p className="text-lg font-bold text-emerald-600">{test.fdaCompanionDxCount}</p><p className="text-xs text-gray-500">CDx</p></div>}
          {category === 'CGP' && test.tat && <div><p className="text-lg font-bold text-slate-600">{test.tat}</p><p className="text-xs text-gray-500">TAT</p></div>}
        </div>
        
        {/* Cancer types */}
        <div className="flex flex-wrap gap-1 mb-2">
          {test.cancerTypes && test.cancerTypes.slice(0, 3).map((type, i) => <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{type.length > 20 ? type.slice(0, 20) + '...' : type}</span>)}
          {test.cancerTypes && test.cancerTypes.length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{test.cancerTypes.length - 3}</span>}
        </div>
      </div>
      
      {/* Show detail button */}
      <div className="border-t border-gray-100 pt-2 mt-2">
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
  );
};

// ============================================
// Patient Test Card - Simplified view for patients
// ============================================
const PatientTestCard = ({ test, category, onShowDetail }) => {
  // Determine coverage status
  const hasMedicare = test.reimbursement?.toLowerCase().includes('medicare') && 
    !test.reimbursement?.toLowerCase().includes('not yet') &&
    !test.reimbursement?.toLowerCase().includes('no established');
  const hasPrivate = test.commercialPayers && test.commercialPayers.length > 0;
  const requiresTissue = test.approach === 'Tumor-informed' || test.requiresTumorTissue === 'Yes';
  
  // Get wait time and simplify for display
  const rawTat = test.initialTat || test.tat || null;
  
  // Parse TAT into a simple display format
  const getTatDisplay = () => {
    if (!rawTat) return null;
    
    // If it's a number, use it directly
    if (typeof rawTat === 'number') {
      return { value: `~${rawTat}`, suffix: 'days' };
    }
    
    // If it's a string, try to extract the key info
    const tatStr = String(rawTat).toLowerCase();
    
    // Check for "not" patterns (not available, not specified, etc.)
    if (tatStr.includes('not ')) {
      return { value: 'TBD', suffix: 'days', note: 'Not specified' };
    }
    
    // Try to extract a number or range from the string
    const numMatch = String(rawTat).match(/(\d+(?:-\d+)?)/);
    if (numMatch) {
      return { value: `~${numMatch[1]}`, suffix: 'days' };
    }
    
    // Fallback - just show a generic indicator
    return { value: '?', suffix: 'days', note: 'See details' };
  };
  
  const tatDisplay = getTatDisplay();
  
  // Yes/No badge component
  const YesNoBadge = ({ yes, label }) => (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        yes ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
      }`}>
        {yes ? '✓' : '✗'}
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );
  
  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-gray-300 transition-all">
      {/* Header - clickable to show detail modal */}
      <div className="cursor-pointer" onClick={() => onShowDetail && onShowDetail(test)}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{test.name}</h3>
            <p className="text-sm text-gray-500">by {test.vendor}<VendorBadge vendor={test.vendor} size="sm" /></p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
            hasMedicare && hasPrivate ? 'bg-emerald-100 text-emerald-700' :
            hasMedicare || hasPrivate ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {hasMedicare && hasPrivate ? 'Insurance Covered' :
             hasMedicare ? 'Medicare Covered' :
             hasPrivate ? 'Some Insurance' : 'Check Coverage'}
          </div>
        </div>
        
        {/* Key patient questions - always visible */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
          <YesNoBadge yes={hasMedicare} label="Medicare coverage" />
          <YesNoBadge yes={hasPrivate} label="Private insurance" />
          <YesNoBadge yes={!requiresTissue} label="Blood-only (no tissue)" />
          {tatDisplay && (
            <div className="flex items-center gap-2 py-1.5">
              <span className={`min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                tatDisplay.note ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
              }`}>
                {tatDisplay.value}
              </span>
              <span className="text-sm text-gray-700">{tatDisplay.suffix}</span>
            </div>
          )}
        </div>
        
        {/* Cancer types */}
        {test.cancerTypes && (
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-1">Works for:</p>
            <div className="flex flex-wrap gap-1">
              {test.cancerTypes.slice(0, 4).map((type, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  {type.length > 20 ? type.slice(0, 20) + '...' : type}
                </span>
              ))}
              {test.cancerTypes.length > 4 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                  +{test.cancerTypes.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Show detail button */}
        <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 mt-2">
          Learn more
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ============================================
// Test Detail Modal
// ============================================
const TestDetailModal = ({ test, category, onClose, isPatientView = false }) => {
  if (!test) return null;
  
  const meta = categoryMeta[category];
  
  // Print styles for test detail
  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      .test-detail-print-area, .test-detail-print-area * { visibility: visible; }
      .test-detail-print-area { 
        position: absolute; 
        left: 0; 
        top: 0; 
        width: 100%;
        max-height: none !important;
        overflow: visible !important;
      }
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
    CGP: { 
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white" onClick={onClose}>
        <div className="test-detail-print-area bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div className={`flex justify-between items-start p-5 ${colors.headerBg}`} style={{ flexShrink: 0 }}>
            <div className="flex-1 mr-4">
              <div className="flex flex-wrap gap-2 mb-2">
                {hasMedicare && hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Medicare+Private</span>}
                {hasMedicare && !hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Medicare</span>}
                {!hasMedicare && hasPrivate && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Private Insurance</span>}
                {test.fdaStatus && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">{test.fdaStatus.split(' - ')[0]}</span>}
                {test.approach && <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">{test.approach}</span>}
              </div>
              <h2 className="text-2xl font-bold text-white">{test.name}</h2>
              <p className="text-white/80">{test.vendor} • OpenOnco.org</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); window.print(); }} 
                className="p-2 hover:bg-white/20 rounded-xl transition-colors print:hidden"
                title="Print or save as PDF"
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
          {isPatientView ? (
            <>
              {/* Quick Facts for Patients */}
              <Section title="Quick Facts">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <YesNo yes={hasMedicare} label="Medicare coverage (age 65+)" />
                    <YesNo yes={hasPrivate} label="Private insurance options" />
                    <YesNo yes={!requiresTissue} label="Blood draw only (no surgery needed)" />
                    {category === 'CGP' && test.fdaCompanionDxCount && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">✓</span>
                        <span className="text-sm text-gray-700">FDA-approved for {test.fdaCompanionDxCount} drug matches</span>
                      </div>
                    )}
                  </div>
                  <div>
                    {category !== 'CGP' && (test.initialTat || test.tat) && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {test.initialTat || test.tat}
                        </span>
                        <span className="text-sm text-gray-700">days for results</span>
                      </div>
                    )}
                    {category === 'CGP' && test.tat && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">⏱</span>
                        <span className="text-sm text-gray-700">Results in {test.tat}</span>
                      </div>
                    )}
                    {category === 'CGP' && test.genesAnalyzed && (
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
                  {category === 'CGP' && "This test analyzes hundreds of genes in your tumor to find specific mutations that can be targeted with specialized treatments. It helps your doctor match you with the most effective therapies and clinical trials for your cancer."}
                </p>
              </Section>
              
              {/* How It Works */}
              <Section title="How It Works">
                <p className="text-gray-700">
                  {category === 'CGP' 
                    ? (test.sampleCategory === 'Tissue' 
                        ? "Your doctor will send a sample of your tumor (from surgery or biopsy) to the lab. The test analyzes hundreds of genes to find specific mutations that can be matched to targeted treatments."
                        : "A simple blood draw is used to capture tumor DNA circulating in your bloodstream. The test analyzes this DNA to identify mutations that can guide treatment decisions.")
                    : (requiresTissue 
                        ? "Your doctor will need a sample of your tumor (from surgery or biopsy) plus a blood draw. The test creates a personalized profile based on your specific cancer's DNA mutations."
                        : "Just a simple blood draw at your doctor's office or lab - no tumor sample needed. The test looks for general cancer signals in your blood.")}
                </p>
                {test.bloodVolume && <p className="text-sm text-gray-500 mt-2">Blood sample: {test.bloodVolume} mL (about {Math.round(test.bloodVolume / 5)} teaspoons)</p>}
                {category === 'CGP' && test.tat && <p className="text-sm text-gray-500 mt-2">Results typically available in: {test.tat}</p>}
              </Section>
              
              {/* Insurance & Cost */}
              <Section title="Insurance & Cost">
                <div className="space-y-2">
                  {test.reimbursement && <p className="text-sm"><span className="font-medium">Medicare:</span> {test.reimbursement}</p>}
                  {hasPrivate && (
                    <p className="text-sm"><span className="font-medium">Private insurers:</span> {test.commercialPayers.join(', ')}</p>
                  )}
                  {test.commercialPayersNotes && <p className="text-xs text-gray-500 mt-1">{test.commercialPayersNotes}</p>}
                  {(category === 'ECD' || category === 'CGP') && test.listPrice && <p className="text-sm mt-2"><span className="font-medium">List price (without insurance):</span> ${test.listPrice.toLocaleString()}</p>}
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
                  {category === 'CGP' && <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Are there targeted therapies or clinical trials that match my results?</li>}
                </ul>
              </Section>
            </>
          ) : (
            /* Clinician/Academic View */
            <>
              {/* CGP-specific content */}
              {category === 'CGP' && (
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
                    <Section title="FDA Companion Diagnostics">
                      <div className="space-y-1">
                        {test.fdaCompanionDxCount && (
                          <div className="py-1.5 flex justify-between items-center">
                            <span className="text-xs text-gray-500">FDA CDx Indications</span>
                            <span className="text-lg font-bold text-emerald-600">{test.fdaCompanionDxCount}</span>
                          </div>
                        )}
                        {test.fdaCompanionDxCountNotes && <p className="text-xs text-gray-500 mt-1">{test.fdaCompanionDxCountNotes}</p>}
                        <DataRow label="FDA Status" value={test.fdaStatus} citations={test.fdaStatusCitations} />
                        {test.fdaApprovalDate && <DataRow label="FDA Approval Date" value={test.fdaApprovalDate} citations={test.fdaApprovalDateCitations} />}
                      </div>
                    </Section>
                    
                    <Section title="Guidelines & Coverage">
                      <div className="space-y-1">
                        <DataRow label="NCCN Recommended" value={test.nccnRecommended ? 'Yes' : 'No'} />
                        {test.nccnGuidelinesAligned && <DataRow label="NCCN Guidelines" value={test.nccnGuidelinesAligned.join(', ')} notes={test.nccnGuidelinesNotes} citations={test.nccnGuidelinesCitations} />}
                        <DataRow label="Medicare" value={test.reimbursement} notes={test.reimbursementNote} citations={test.reimbursementCitations} />
                        {test.listPrice && <DataRow label="List Price" value={`$${test.listPrice.toLocaleString()}`} citations={test.listPriceCitations} />}
                        <DataRow label="CPT Codes" value={test.cptCodes} citations={test.cptCodesCitations} />
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

              {/* Non-CGP content (MRD, ECD, TRM) */}
              {category !== 'CGP' && (
                <>
              {/* Two-column layout for key metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Performance Metrics */}
                <Section title="Test Performance" expertTopic="sensitivity">
                  <div className="space-y-1">
                    <DataRow label="Reported Sensitivity" value={test.sensitivity} unit="%" citations={test.sensitivityCitations} notes={test.sensitivityNotes} />
                    {test.advancedAdenomaSensitivity && <DataRow label="Advanced Adenoma Sensitivity" value={test.advancedAdenomaSensitivity} unit="%" citations={test.advancedAdenomaSensitivityCitations} notes={test.advancedAdenomaSensitivityNotes} />}
                    <DataRow label="Reported Specificity" value={test.specificity} unit="%" citations={test.specificityCitations} notes={test.specificityNotes} />
                    {test.analyticalSpecificity && <DataRow label="Analytical Specificity" value={test.analyticalSpecificity} unit="%" />}
                    {test.clinicalSpecificity && <DataRow label="Clinical Specificity" value={test.clinicalSpecificity} unit="%" />}
                    <DataRow label="PPV" value={test.ppv} unit="%" citations={test.ppvCitations} notes={test.ppvNotes} />
                    <DataRow label="NPV" value={test.npv} unit="%" citations={test.npvCitations} notes={test.npvNotes} />
                    <DataRow label="LOD" value={formatLOD(test.lod)} citations={test.lodCitations} notes={test.lodNotes} expertTopic="lod" />
                    {test.lod95 && <DataRow label="LOD95" value={test.lod95} expertTopic="lodVsLod95" />}
                  </div>
                </Section>
                
                {/* Sample & TAT */}
                <Section title="Sample & Turnaround">
                  <div className="space-y-1">
                    <DataRow label="Sample Type" value={test.sampleCategory} />
                    <DataRow label="Blood Volume" value={test.bloodVolume} unit=" mL" />
                    {test.cfdnaInput && <DataRow label="cfDNA Input" value={test.cfdnaInput} unit=" ng" />}
                    {category === 'MRD' && (
                      <>
                        <DataRow label="Initial TAT" value={test.initialTat} unit=" days" />
                        <DataRow label="Follow-up TAT" value={test.followUpTat} unit=" days" />
                      </>
                    )}
                    {category !== 'MRD' && <DataRow label="TAT" value={test.tat} />}
                    {test.leadTimeVsImaging && <DataRow label="Lead Time vs Imaging" value={test.leadTimeVsImaging} unit=" days" />}
                    {test.variantsTracked && <DataRow label="Variants Tracked" value={test.variantsTracked} />}
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
                      {test.landmarkSensitivity && <DataRow label="Landmark Sensitivity" value={test.landmarkSensitivity} unit="%" />}
                      {test.landmarkSpecificity && <DataRow label="Landmark Specificity" value={test.landmarkSpecificity} unit="%" />}
                      {test.longitudinalSensitivity && <DataRow label="Longitudinal Sensitivity" value={test.longitudinalSensitivity} unit="%" />}
                      {test.longitudinalSpecificity && <DataRow label="Longitudinal Specificity" value={test.longitudinalSpecificity} unit="%" />}
                    </div>
                  )}
                </Section>
              )}
              
              {/* Two-column layout for regulatory/evidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Regulatory & Coverage */}
                <Section title="Regulatory & Coverage">
                  <div className="space-y-1">
                    <DataRow label="FDA Status" value={test.fdaStatus} />
                    <DataRow label="Medicare" value={test.reimbursement} notes={test.reimbursementNote} />
                    {hasPrivate && <DataRow label="Private Insurance" value={test.commercialPayers.join(', ')} notes={test.commercialPayersNotes} />}
                    <DataRow label="CPT Codes" value={test.cptCodes || test.cptCode} />
                    <DataRow label="Clinical Availability" value={test.clinicalAvailability} />
                    {test.availableRegions && test.availableRegions.length > 0 && (
                      <DataRow label="Available Regions" value={test.availableRegions.join(', ')} />
                    )}
                    {category === 'ECD' && test.listPrice && <DataRow label="List Price" value={`$${test.listPrice}`} />}
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
                    <DataRow label="Independent Validation" value={test.independentValidation} notes={test.independentValidationNotes} />
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
                    <DataRow label="Approach" value={test.approach} expertTopic="tumorInformed" />
                    <DataRow label="Requires Tumor Tissue" value={requiresTissue ? 'Yes' : 'No'} notes={test.requiresTumorTissueNotes} />
                    <DataRow label="Requires Matched Normal" value={test.requiresMatchedNormal} />
                  </div>
                  <div className="space-y-1">
                    {test.method && <DataRow label="Method" value={test.method} />}
                    {test.targetPopulation && <DataRow label="Target Population" value={test.targetPopulation} />}
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
                </>
              )}
              
              {/* Example Report Link */}
              {test.exampleTestReport && (
                <div className="text-center pt-2">
                  <a href={test.exampleTestReport} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline" style={{ color: '#2A63A4' }}>
                    View Example Test Report →
                  </a>
                </div>
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
  
  // Print styles
  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      .comparison-print-area, .comparison-print-area * { visibility: visible; }
      .comparison-print-area { 
        position: absolute; 
        left: 0; 
        top: 0; 
        width: 100%;
        max-height: none !important;
        overflow: visible !important;
      }
      .print\\:hidden { display: none !important; }
      .comparison-print-area table { font-size: 10px; }
      .comparison-print-area th, .comparison-print-area td { padding: 4px 6px; }
      @page { margin: 0.5in; size: landscape; }
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
    CGP: { 
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:backdrop-blur-none" onClick={onClose}>
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
                      {category !== 'CGP' && (param.key === 'sensitivity' || param.key === 'specificity') && <ExpertInsight topic={param.key} />}
                      {category !== 'CGP' && param.key === 'lod' && <ExpertInsight topic="lod" />}
                      {category !== 'CGP' && param.key === 'lod95' && <ExpertInsight topic="lodVsLod95" />}
                      {category !== 'CGP' && (param.key === 'sensitivityStagesReported' || param.key === 'stageIISensitivity' || param.key === 'stageIIISensitivity') && <ExpertInsight topic="stageSpecific" />}
                    </span>
                  </td>
                  {tests.map(test => {
                    let value = param.key === 'cancerTypesStr' ? test.cancerTypes?.join(', ') 
                      : param.key === 'commercialPayersStr' ? test.commercialPayers?.join(', ')
                      : param.key === 'availableRegionsStr' ? (test.availableRegions?.join(', ') || 'US')
                      : param.key === 'biomarkersReportedStr' ? test.biomarkersReported?.join(', ')
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
const CategoryPage = ({ category, initialSelectedTestId, onClearInitialTest }) => {
  const meta = categoryMeta[category];
  const config = filterConfigs[category];
  const tests = meta.tests;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApproaches, setSelectedApproaches] = useState([]);
  const [selectedCancerTypes, setSelectedCancerTypes] = useState([]);
  const [selectedReimbursement, setSelectedReimbursement] = useState([]);
  const [selectedTestScopes, setSelectedTestScopes] = useState([]);
  const [selectedSampleCategories, setSelectedSampleCategories] = useState([]);
  const [selectedFdaStatus, setSelectedFdaStatus] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [minParticipants, setMinParticipants] = useState(0);
  const [minPublications, setMinPublications] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [selectedTests, setSelectedTests] = useState(initialSelectedTestId ? [initialSelectedTestId] : []);
  const [showComparison, setShowComparison] = useState(false);
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
  
  const isPatient = persona === 'Patient';
  
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

  // Handle initial selected test
  useEffect(() => {
    if (initialSelectedTestId) {
      setSelectedTests([initialSelectedTestId]);
      onClearInitialTest?.();
      // Scroll to the test card after a short delay to allow rendering
      setTimeout(() => {
        const element = document.getElementById(`test-card-${initialSelectedTestId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [initialSelectedTestId]);

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
        const q = searchQuery.toLowerCase();
        if (!test.name.toLowerCase().includes(q) && !test.vendor.toLowerCase().includes(q)) return false;
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
      if (selectedTestScopes.length > 0 && !selectedTestScopes.includes(test.testScope)) return false;
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
      return true;
    });
  }, [tests, searchQuery, selectedApproaches, selectedCancerTypes, selectedReimbursement, selectedTestScopes, selectedSampleCategories, selectedFdaStatus, selectedRegions, minParticipants, minPublications, maxPrice, category]);

  const testsToCompare = useMemo(() => tests.filter(t => selectedTests.includes(t.id)), [tests, selectedTests]);
  const suggestedTests = useMemo(() => getSuggestedTests(selectedTests, tests), [selectedTests, tests]);
  const toggle = (setter) => (val) => setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const clearFilters = () => { setSearchQuery(''); setSelectedApproaches([]); setSelectedCancerTypes([]); setSelectedReimbursement([]); setSelectedTestScopes([]); setSelectedSampleCategories([]); setSelectedFdaStatus([]); setSelectedRegions([]); setMinParticipants(0); setMinPublications(0); setMaxPrice(1000); };
  const hasFilters = searchQuery || selectedApproaches.length || selectedCancerTypes.length || selectedReimbursement.length || selectedTestScopes.length || selectedSampleCategories.length || selectedFdaStatus.length || selectedRegions.length || minParticipants > 0 || minPublications > 0 || maxPrice < 1000;

  const colorClasses = { orange: 'from-orange-500 to-orange-600', green: 'from-emerald-500 to-emerald-600', red: 'from-sky-500 to-sky-600', violet: 'from-violet-500 to-violet-600' };

  return (
    <>
      <style>{`
        * { overflow-anchor: none !important; }
      `}</style>
      <div className="max-w-7xl mx-auto px-6 py-8" style={{ overflowAnchor: 'none' }}>
      <div className="mb-8">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${colorClasses[meta.color]} text-white text-sm font-medium mb-3`}>
          {isPatient ? meta.patientTitle : meta.shortTitle}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {isPatient ? meta.patientTitle : meta.title}
        </h1>
        <p className="text-gray-600">{isPatient ? meta.patientDescription : meta.description}</p>
        
        {/* Parameter type legend - hide for patients */}
        {!isPatient && (
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
        
        {/* Patient-friendly intro */}
        {isPatient && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Use the filters to find tests that match your situation. 
              Each test card shows whether it's covered by insurance and what's involved.
              Always discuss testing options with your doctor.
            </p>
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

              {category === 'MRD' && (
                <>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'My Cancer Type' : 'Cancer Type'}
                    </label>
                    <div className="max-h-36 overflow-y-auto">{config.cancerTypes.map(t => <Checkbox key={t} label={t.length > 28 ? t.slice(0,28)+'...' : t} checked={selectedCancerTypes.includes(t)} onChange={() => toggle(setSelectedCancerTypes)(t)} />)}</div>
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'My Insurance' : 'Coverage'}
                    </label>
                    {config.reimbursements.map(r => <Checkbox key={r} label={r === 'Medicare' ? (isPatient ? 'Medicare (age 65+)' : 'Medicare') : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
                  </div>
                  {!isPatient && (
                    <>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Approach</label>
                        {config.approaches.map(a => <Checkbox key={a} label={a} checked={selectedApproaches.includes(a)} onChange={() => toggle(setSelectedApproaches)(a)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Sample Type</label>
                        {config.sampleCategories.map(o => <Checkbox key={o} label={o} checked={selectedSampleCategories.includes(o)} onChange={() => toggle(setSelectedSampleCategories)(o)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Availability</label>
                        {config.regions.map(r => <Checkbox key={r} label={r === 'RUO' ? 'Research Use Only' : r === 'International' ? 'International/Global' : r} checked={selectedRegions.includes(r)} onChange={() => toggle(setSelectedRegions)(r)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Min Trial Participants: {minParticipants === 0 ? 'Any' : minParticipants >= 1000 ? '1,000+' : minParticipants.toLocaleString()}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1000"
                          step="100"
                          value={minParticipants}
                          
                          
                          onChange={updateSlider(setMinParticipants)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span>500</span>
                          <span>1,000+</span>
                        </div>
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Min Publications: {minPublications === 0 ? 'Any' : minPublications >= 100 ? '100+' : minPublications}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={minPublications}
                          
                          
                          onChange={updateSlider(setMinPublications)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span>50</span>
                          <span>100+</span>
                        </div>
                      </div>
                    </>
                  )}
                  {isPatient && (
                    <div className="mb-5">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        Test Type
                      </label>
                      <Checkbox label="Blood test only (no tissue needed)" checked={selectedApproaches.includes('Tumor-naïve')} onChange={() => toggle(setSelectedApproaches)('Tumor-naïve')} />
                    </div>
                  )}
                </>
              )}

              {category === 'ECD' && (
                <>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'Type of Screening' : 'Test Scope'}
                    </label>
                    {config.testScopes.map(s => <Checkbox key={s} label={isPatient ? (s.includes('Single') ? 'Single cancer type' : 'Multiple cancer types') : s} checked={selectedTestScopes.includes(s)} onChange={() => toggle(setSelectedTestScopes)(s)} />)}
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'My Insurance' : 'Coverage'}
                    </label>
                    {config.reimbursements.map(r => <Checkbox key={r} label={r === 'Medicare' ? (isPatient ? 'Medicare (age 65+)' : 'Medicare') : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
                  </div>
                  {!isPatient && (
                    <>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Sample Type</label>
                        {config.sampleCategories.map(o => <Checkbox key={o} label={o} checked={selectedSampleCategories.includes(o)} onChange={() => toggle(setSelectedSampleCategories)(o)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Availability</label>
                        {config.regions.map(r => <Checkbox key={r} label={r === 'RUO' ? 'Research Use Only' : r === 'International' ? 'International/Global' : r} checked={selectedRegions.includes(r)} onChange={() => toggle(setSelectedRegions)(r)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Min Trial Participants: {minParticipants === 0 ? 'Any' : minParticipants >= 100000 ? '100,000+' : minParticipants.toLocaleString()}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100000"
                          step="10000"
                          value={minParticipants}
                          
                          
                          onChange={updateSlider(setMinParticipants)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span>50k</span>
                          <span>100k+</span>
                        </div>
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Min Publications: {minPublications === 0 ? 'Any' : minPublications >= 20 ? '20+' : minPublications}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="2"
                          value={minPublications}
                          
                          
                          onChange={updateSlider(setMinPublications)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span>10</span>
                          <span>20+</span>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'Budget' : 'Max List Price'}: {maxPrice >= 1000 ? 'Any' : `$${maxPrice}`}
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
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>$0</span>
                      <span>$500</span>
                      <span>$1000+</span>
                    </div>
                  </div>
                </>
              )}

              {category === 'TRM' && (
                <>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'My Cancer Type' : 'Cancer Type'}
                    </label>
                    <div className="max-h-36 overflow-y-auto">{config.cancerTypes.map(t => <Checkbox key={t} label={t.length > 28 ? t.slice(0,28)+'...' : t} checked={selectedCancerTypes.includes(t)} onChange={() => toggle(setSelectedCancerTypes)(t)} />)}</div>
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'My Insurance' : 'Coverage'}
                    </label>
                    {config.reimbursements.map(r => <Checkbox key={r} label={r === 'Medicare' ? (isPatient ? 'Medicare (age 65+)' : 'Medicare') : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
                  </div>
                  {!isPatient && (
                    <>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Approach</label>
                        {config.approaches.map(a => <Checkbox key={a} label={a} checked={selectedApproaches.includes(a)} onChange={() => toggle(setSelectedApproaches)(a)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Sample Type</label>
                        {config.sampleCategories.map(o => <Checkbox key={o} label={o} checked={selectedSampleCategories.includes(o)} onChange={() => toggle(setSelectedSampleCategories)(o)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Availability</label>
                        {config.regions.map(r => <Checkbox key={r} label={r === 'RUO' ? 'Research Use Only' : r === 'International' ? 'International/Global' : r} checked={selectedRegions.includes(r)} onChange={() => toggle(setSelectedRegions)(r)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Min Trial Participants: {minParticipants === 0 ? 'Any' : minParticipants >= 1000 ? '1,000+' : minParticipants.toLocaleString()}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1000"
                          step="100"
                          value={minParticipants}
                          
                          
                          onChange={updateSlider(setMinParticipants)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span>500</span>
                          <span>1,000+</span>
                        </div>
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Min Publications: {minPublications === 0 ? 'Any' : minPublications >= 100 ? '100+' : minPublications}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={minPublications}
                          
                          
                          onChange={updateSlider(setMinPublications)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span>50</span>
                          <span>100+</span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {category === 'CGP' && (
                <>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'Sample Type' : 'Sample Category'}
                    </label>
                    {config.sampleCategories.map(s => <Checkbox key={s} label={s} checked={selectedSampleCategories.includes(s)} onChange={() => toggle(setSelectedSampleCategories)(s)} />)}
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'My Cancer Type' : 'Cancer Type'}
                    </label>
                    <div className="max-h-36 overflow-y-auto">{config.cancerTypes.map(t => <Checkbox key={t} label={t.length > 28 ? t.slice(0,28)+'...' : t} checked={selectedCancerTypes.includes(t)} onChange={() => toggle(setSelectedCancerTypes)(t)} />)}</div>
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      {isPatient ? 'My Insurance' : 'Coverage'}
                    </label>
                    {config.reimbursements.map(r => <Checkbox key={r} label={r === 'Medicare' ? (isPatient ? 'Medicare (age 65+)' : 'Medicare') : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
                  </div>
                  {!isPatient && (
                    <>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Approach</label>
                        {config.approaches.map(a => <Checkbox key={a} label={a} checked={selectedApproaches.includes(a)} onChange={() => toggle(setSelectedApproaches)(a)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">FDA Status</label>
                        {config.fdaStatuses.map(f => <Checkbox key={f} label={f} checked={selectedFdaStatus.includes(f)} onChange={() => toggle(setSelectedFdaStatus)(f)} />)}
                      </div>
                      <div className="mb-5">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Min Publications: {minPublications === 0 ? 'Any' : minPublications >= 1000 ? '1,000+' : minPublications}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1000"
                          step="50"
                          value={minPublications}
                          onChange={updateSlider(setMinPublications)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span>
                          <span>500</span>
                          <span>1,000+</span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
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
              {!isPatient && selectedTests.length === 0 && (
                <p className="text-sm text-gray-400 italic">💡 Select tests to compare them side-by-side</p>
              )}
              {!isPatient && selectedTests.length === 1 && (
                <p className="text-sm text-orange-600">Select at least one more test to compare</p>
              )}
              {!isPatient && selectedTests.length >= 2 && (
                <button onClick={() => setShowComparison(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Compare ({selectedTests.length})
                </button>
              )}
            </div>
            
            {/* Smart Comparison Suggestions */}
            {!isPatient && selectedTests.length >= 1 && suggestedTests.length > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
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
                isPatient ? (
                  <PatientTestCard key={test.id} test={test} category={category} onShowDetail={setDetailTest} />
                ) : (
                  <TestCard key={test.id} test={test} category={category} isSelected={selectedTests.includes(test.id)} onSelect={(id) => toggle(setSelectedTests)(id)} onShowDetail={setDetailTest} />
                )
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

      {!isPatient && showComparison && testsToCompare.length >= 2 && (
        <ComparisonModal tests={testsToCompare} category={category} onClose={() => setShowComparison(false)} onRemoveTest={(id) => { setSelectedTests(prev => prev.filter(i => i !== id)); if (selectedTests.length <= 2) setShowComparison(false); }} />
      )}
      
      {detailTest && (
        <TestDetailModal test={detailTest} category={category} onClose={() => setDetailTest(null)} isPatientView={isPatient} />
      )}
    </div>
    </>
  );
};

// ============================================
// Main App
// ============================================
export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [initialSelectedTestId, setInitialSelectedTestId] = useState(null);
  const [persona, setPersona] = useState(() => getStoredPersona() || 'Clinician');
  
  // Listen for persona changes to force re-render
  useEffect(() => {
    const handlePersonaChange = (e) => setPersona(e.detail);
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);

  const handleNavigate = (page, testId = null) => {
    setCurrentPage(page);
    setInitialSelectedTestId(testId);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage onNavigate={handleNavigate} />;
      case 'MRD': case 'ECD': case 'TRM': case 'CGP': return <CategoryPage key={`${currentPage}-${persona}`} category={currentPage} initialSelectedTestId={initialSelectedTestId} onClearInitialTest={() => setInitialSelectedTestId(null)} />;
      case 'data-sources': return <SourceDataPage />;
      case 'how-it-works': return <HowItWorksPage />;
      case 'submissions': return <SubmissionsPage />;
      case 'faq': return <FAQPage />;
      case 'about': return <AboutPage />;
      default: return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header currentPage={currentPage} onNavigate={handleNavigate} />
      {currentPage !== 'home' && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <button
              onClick={() => handleNavigate('home')}
              className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors group"
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-xl font-medium">Back to Home</span>
            </button>
          </div>
        </div>
      )}
      <main className="flex-1" key={`main-${persona}`}>{renderPage()}</main>
      <Footer />
      <Analytics />
    </div>
  );
}
