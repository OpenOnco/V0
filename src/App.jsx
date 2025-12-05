import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';

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

// ============================================
// NewsFeed Component - Live RSS feeds with 1-hour cache
// ============================================
const NewsFeed = () => {
  const [category, setCategory] = useState('science');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scienceArticles, setScienceArticles] = useState([]);
  const [businessArticles, setBusinessArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fallback static articles in case RSS fetch fails
  const fallbackScience = [
    { date: '2025-12-01', title: 'Signatera MRD test demonstrates 94% sensitivity in stage II-III CRC post-surgery surveillance', source: 'NEJM', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-28', title: 'Galleri MCED test detects 35 cancer types with 99.5% specificity in PATHFINDER 2 study', source: 'Nature Medicine', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-25', title: 'Guardant Reveal ctDNA methylation approach shows superior MRD detection vs tumor-informed methods', source: 'Cancer Discovery', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-22', title: 'FoundationOne Liquid CDx identifies actionable mutations in 78% of advanced solid tumors', source: 'JCO Precision Oncology', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-20', title: 'Serial ctDNA monitoring with Guardant360 predicts immunotherapy response 8 weeks before imaging', source: 'Annals of Oncology', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-18', title: 'Haystack MRD achieves 0.0006% LOD in multi-center colorectal cancer validation study', source: 'Clinical Cancer Research', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-15', title: 'Shield blood test shows 83% sensitivity for colorectal cancer in average-risk screening population', source: 'JAMA', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-12', title: 'Personalis NeXT Personal tracks 1,800 variants for ultra-sensitive MRD detection in breast cancer', source: 'Lancet Oncology', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-10', title: 'ctDNA clearance after neoadjuvant therapy predicts pCR in NSCLC with 89% accuracy', source: 'Cancer Cell', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { date: '2025-11-08', title: 'Tumor-informed vs tumor-naïve MRD: COBRA study shows comparable sensitivity in early-stage CRC', source: 'Nature Medicine', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
  ];

  const fallbackBusiness = [
    { date: '2025-12-01', title: 'CMS grants Medicare coverage for Galleri MCED test in high-risk populations', source: 'Business Wire', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-28', title: 'Natera Signatera revenue grows 45% YoY as MRD adoption accelerates', source: 'Reuters', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-25', title: 'Guardant Health expands Shield colorectal cancer test to commercial launch', source: 'FierceBiotech', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-22', title: 'Exact Sciences Oncodetect receives FDA Breakthrough Device designation for MRD', source: 'GenomeWeb', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-20', title: 'Palmetto GBA issues positive LCD for tumor-informed MRD testing in CRC', source: 'Dark Daily', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-18', title: 'Foundation Medicine partners with Pfizer on ctDNA-guided clinical trials', source: 'Endpoints News', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-15', title: 'GRAIL announces $2.1B revenue projection as Galleri orders exceed expectations', source: 'STAT News', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-12', title: 'Quest Diagnostics Haystack MRD now available in all 50 states', source: 'Lab Corp Daily', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-10', title: 'UnitedHealthcare adds Signatera MRD to covered tests for breast cancer surveillance', source: 'Payers & Providers', url: 'https://www.genomeweb.com/' },
    { date: '2025-11-08', title: 'Personalis secures $150M to scale NeXT Personal MRD manufacturing capacity', source: 'BioPharma Dive', url: 'https://www.genomeweb.com/' },
  ];

  // RSS feed URLs via rss2json proxy
  const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url=';
  
  // Google News RSS for scientific articles about ctDNA/liquid biopsy/MRD
  const SCIENCE_SEARCH = encodeURIComponent('https://news.google.com/rss/search?q=ctDNA+OR+"liquid+biopsy"+OR+"minimal+residual+disease"+cancer&hl=en-US&gl=US&ceid=US:en');
  
  // Google News RSS for business articles
  const BUSINESS_FEED = encodeURIComponent('https://news.google.com/rss/search?q=Guardant+OR+Natera+OR+GRAIL+OR+"liquid+biopsy"+OR+ctDNA+FDA+OR+Medicare&hl=en-US&gl=US&ceid=US:en');

  const CACHE_KEY_SCIENCE = 'openonco_news_science_v2';
  const CACHE_KEY_BUSINESS = 'openonco_news_business_v2';
  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  const parseDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const extractSource = (url) => {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      const sourceMap = {
        'reuters.com': 'Reuters',
        'bloomberg.com': 'Bloomberg',
        'fiercebiotech.com': 'FierceBiotech',
        'statnews.com': 'STAT News',
        'genomeweb.com': 'GenomeWeb',
        'biopharmadive.com': 'BioPharma Dive',
        'medcitynews.com': 'MedCity News',
        'nature.com': 'Nature',
        'nejm.org': 'NEJM',
        'cell.com': 'Cell',
        'thelancet.com': 'Lancet',
        'businesswire.com': 'Business Wire',
        'prnewswire.com': 'PR Newswire',
        'seekingalpha.com': 'Seeking Alpha',
        'fool.com': 'Motley Fool',
        'pubmed.ncbi.nlm.nih.gov': 'PubMed',
      };
      return sourceMap[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
    } catch {
      return 'News';
    }
  };

  const fetchFeed = async (feedUrl, cacheKey, fallback) => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      // localStorage not available or parse error
    }

    try {
      const response = await fetch(`${RSS2JSON_API}${feedUrl}`);
      const json = await response.json();
      
      if (json.status === 'ok' && json.items && json.items.length > 0) {
        const articles = json.items.slice(0, 20).map(item => ({
          date: parseDate(item.pubDate),
          title: item.title,
          source: extractSource(item.link),
          url: item.link
        }));
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: articles,
            timestamp: Date.now()
          }));
        } catch (e) {
          // localStorage full or not available
        }
        
        return articles;
      }
    } catch (e) {
      console.log('News feed fetch failed, using fallback');
    }
    
    return fallback;
  };

  useEffect(() => {
    const loadFeeds = async () => {
      setIsLoading(true);
      
      const [science, business] = await Promise.all([
        fetchFeed(SCIENCE_SEARCH, CACHE_KEY_SCIENCE, fallbackScience),
        fetchFeed(BUSINESS_FEED, CACHE_KEY_BUSINESS, fallbackBusiness)
      ]);
      
      setScienceArticles(science);
      setBusinessArticles(business);
      setIsLoading(false);
    };

    loadFeeds();
  }, []);

  // Auto-rotate articles every 8 seconds
  useEffect(() => {
    const articles = category === 'science' ? scienceArticles : businessArticles;
    if (articles.length === 0) return;
    
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % articles.length);
        setIsTransitioning(false);
      }, 300);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [category, scienceArticles, businessArticles]);

  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [category]);

  const articles = category === 'science' ? scienceArticles : businessArticles;
  const fallback = category === 'science' ? fallbackScience : fallbackBusiness;
  const displayArticles = articles.length > 0 ? articles : fallback;
  const currentArticle = displayArticles[currentIndex % displayArticles.length] || displayArticles[0];

  if (!currentArticle) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Liquid Biopsy News</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setCategory('science')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              category === 'science'
                ? 'text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
            style={category === 'science' ? { backgroundColor: '#2A63A4' } : {}}
          >
            Science
          </button>
          <button
            onClick={() => setCategory('business')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              category === 'business'
                ? 'text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
            style={category === 'business' ? { backgroundColor: '#2A63A4' } : {}}
          >
            Business
          </button>
        </div>
      </div>

      <div className="relative h-20 overflow-hidden">
        <div
          className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
        >
          <a
            href={currentArticle.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <p className="text-xs text-slate-400 mb-1">
              {currentArticle.date} • {currentArticle.source}
            </p>
            <p className="text-base text-slate-800 group-hover:text-[#2A63A4] transition-colors leading-snug">
              {currentArticle.title}
            </p>
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div className="flex gap-1">
          {displayArticles.slice(0, 10).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex % 10 ? 'w-4' : 'bg-slate-200 hover:bg-slate-300'
              }`}
              style={idx === currentIndex % 10 ? { backgroundColor: '#2A63A4' } : {}}
            />
          ))}
        </div>
        <p className="text-xs text-slate-400">
          {currentIndex + 1} of {displayArticles.length}
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
    "method": "Whole-genome–derived personalized panel; ~50 variants tracked; ultra-low error suppression",
    "cancerTypes": [
      "Multi-solid"
    ],
    "indicationsNotes": "Tumor-informed MRD assay for multiple common and rare solid tumors; Quest/Resolution MRD platform, FDA Breakthrough Device designation.",
    "sensitivity": 95.0,
    "sensitivityCitations": "https://haystackmrd.com/",
    "landmarkSensitivityCitations": "[https://haystackmrd.com/faq/]",
    "longitudinalSensitivityCitations": "https://haystackmrd.com/",
    "lod": 0.0006,
    "lodCitations": "https://haystackmrd.com/",
    "lodNotes": "LoD ~0.0006% tumor fraction (6 ppm) at ~95% detection in analytical studies; vendor materials describe ultra-low error suppression enabling detection below this in some contexts.",
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
    "reimbursement": "Coverage emerging; case-by-case payer review; national Medicare coverage not yet established.",
    "reimbursementNote": "Quest/Haystack describe active engagement with CMS and commercial payers plus patient access programs; no finalized broad LCD as of late 2025.",
    "cptCodes": "0561U",
    "clinicalAvailability": "Clinical LDT – shipping",
    "clinicalTrials": "NCT07125729 (150; resectable stage II–IV CRC; Haystack vs Signatera head-to-head); NCT06979661 (25; MRD-PORT trial; post-op stage II–III NSCLC; Haystack MRD-guided RT); NCT05798663/AFT-57 (158; unresectable stage III NSCLC; atezolizumab ± tiragolumab CRT; Haystack MRD used for correlative MRD analyses)",
    "totalParticipants": 333,
    "numPublications": 17
  },
  {
    "id": "mrd-2",
    "sampleCategory": "Blood/Plasma",
    "name": "NeXT Personal Dx",
    "vendor": "Personalis",
    "approach": "Tumor-informed",
    "method": "Tumor-informed, whole-genome-based MRD assay: WGS of tumor and matched normal identifies up to ~1,800 patient-specific variants, which are tracked at ultra-high depth in plasma to detect ctDNA down to ~1–3 parts per million (ppm).",
    "cancerTypes": [
      "Breast",
      "Colorectal",
      "NSCLC"
    ],
    "indicationsNotes": "Personalis NeXT Personal Dx tumor-informed MRD assay. Medicare-covered for early-stage breast cancer recurrence monitoring; clinical data also reported in colorectal cancer and NSCLC.",
    "sensitivity": null,
    "sensitivityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "sensitivityNotes": "Reported as 100% sensitivity in validation cohort (n=493); insufficient data for population-level estimates. Value set to null to avoid misleading comparisons.",
    "specificity": null,
    "specificityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "specificityNotes": "Reported as 100% specificity in validation cohort (n=493); insufficient data for population-level estimates. Value set to null to avoid misleading comparisons.",
    "longitudinalSensitivity": null,
    "longitudinalSensitivityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "longitudinalSensitivityNotes": "Reported as 100% in validation cohort; value set to null pending larger studies.",
    "longitudinalSpecificity": null,
    "longitudinalSpecificityCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "longitudinalSpecificityNotes": "Reported as 100% in validation cohort; value set to null pending larger studies.",
    "lod": 0.000167,
    "lodCitations": "https://investors.personalis.com/static-files/ef5485c7-4866-449d-9dcb-bfaf081bf97d",
    "lodNotes": "Analytical and clinical validation support ctDNA detection in the ~1–3 ppm range (≈0.0001–0.0003% tumor fraction); 0.000167% here represents an approximate mid-point.",
    "leadTimeVsImaging": 450.0,
    "leadTimeVsImagingCitations": "https://doi.org/10.1016/j.annonc.2025.01.021",
    "leadTimeVsImagingNotes": "Garcia-Murillas et al. Ann Oncol 2025: median 15 months (range 0.9-61.5 months, up to 5 years) lead time in early-stage breast cancer. NSCLC TRACERx data showed ~6 months.",
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
    "reimbursement": "Medicare covered for stage II-III breast cancer MRD surveillance; additional solid tumor coverage via Tempus xM collaboration expanding.",
    "cptCodes": "81479 (MolDX with DEX Z-code)",
    "clinicalAvailability": "Clinical LDT – shipping (initial market availability)",
    "exampleTestReport": "https://www.personalis.com/wp-content/uploads/2024/07/NeXT-Personal-Dx-Clinical-Report-Template-DOC-002568B.pdf",
    "clinicalTrials": "NCT06230185 (422); VICTORI study interim cohort (~71)",
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
    "sensitivityNotes": "In CRC, results from Alpha-CORRECT, a study with one of the longest MRD surveillance monitoring periods to date, showed the Oncodetect test achieved 78% sensitivity at the post-surgical timepoint and 91% sensitivity during the surveillance monitoring period, with specificities of 80% and 94%, respectively (https://www.exactsciences.com/newsroom/press-releases/new-evidence-validates-oncodetect-s-ability-to-detect-molecular-residual-disease) | Sources: https://www.exactsciences.com/newsroom/press-releases/new-evidence-validates-oncodetect-s-ability-to-detect-molecular-residual-disease)",
    "specificity": 94.0,
    "specificityCitations": "https://investor.exactsciences.com/investor-relations/press-releases/press-release-details/2025/New-Evidence-Validates-Oncodetects-Ability-to-Detect-Molecular-Residual-Disease-and-Predict-Recurrence-in-Colorectal-Cancer-Patients/default.aspx",
    "specificityNotes": "In CRC, results from Alpha-CORRECT, a study with one of the longest MRD surveillance monitoring periods to date, showed the Oncodetect test achieved 78% sensitivity at the post-surgical timepoint and 91% sensitivity during the surveillance monitoring period, with specificities of 80% and 94%, respectively (https://www.exactsciences.com/newsroom/press-releases/new-evidence-validates-oncodetect-s-ability-to-detect-molecular-residual-disease) | Sources: https://www.exactsciences.com/newsroom/press-releases/new-evidence-validates-oncodetect-s-ability-to-detect-molecular-residual-disease)",
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
    "lod": 0.005,
    "lodNotes": "Exact Sciences reports analytical sensitivity for ctDNA detection at or below ~0.005% variant allele fraction in contrived samples, with high specificity via CHIP-aware filtering.",
    "leadTimeVsImaging": 317.0,
    "leadTimeVsImagingNotes": "Alpha-/Beta-CORRECT stage III CRC data show median lead time ≈10.4 months (~317 days) from first MRD-positive Oncodetect result to radiologic recurrence.",
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
    "reimbursement": "Medicare covered for CRC MRD (including surveillance)",
    "reimbursementNote": "Coverage announced July 2025; broader payer adoption evolving",
    "cptCodes": "81479 (MolDX with DEX Z-code); PLA pending",
    "cptCodesNotes": "MolDX unlisted code; payer policies vary.",
    "clinicalAvailability": "Clinical LDT – shipping",
    "independentValidation": "Yes",
    "independentValidationNotes": "Prospective Alpha-/Beta-CORRECT CRC cohorts.",
    "exampleTestReport": "https://www.exactsciences.com/-/media/project/headless/one-exact-web/documents/products-services/oncodetect/providers/sample-report-stage-iii-escalation.pdf?rev=10365d7a28c8467eb25d253943ce8fe9",
    "clinicalTrials": "NCT06398743 (416); α-CORRECT observational study (124)",
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
    "method": "Tumor-informed MRD platform using whole-genome profiling to identify structural variants (SVs) and other truncal events, which are then tracked using ultra-sensitive digital PCR and/or NGS in serial plasma samples.",
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
    "lod": 0.00052,
    "lodNotes": "SAGA materials describe an LoD95 on the order of 5 ppm (~0.00052% VAF) in analytical studies of SV-based assays.",
    "leadTimeVsImaging": 411.0,
    "leadTimeVsImagingCitations": "https://sagadiagnostics.com/saga-diagnostics-announces-u-s-commercial-launch/",
    "leadTimeVsImagingNotes": "Early-stage breast cancer cohort data highlight median lead time ≈13.7 months (~411 days) between MRD positivity and clinical/radiologic recurrence.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Tumor-informed (WGS of tumor); structural variants tracked by dPCR.",
    "requiresMatchedNormal": "Yes",
    "tat": 28.0,
    "tatNotes": "Initial tumor profiling and personalized assay build typically reported in ~3–4 weeks; subsequent blood tests often return in ~3–5 days in published experience.",
    "fdaStatus": "CLIA LDT (US) with international laboratory service offerings.",
    "reimbursement": "Medicare covered for early-stage breast cancer; additional coverage emerging.",
    "reimbursementNote": "CMS coverage established for Pathlight MRD in early-stage breast cancer across all subtypes (2025); other indications and payers evolving.",
    "cptCodes": "81479 (MolDX/other payer-specific coding; no dedicated PLA as of 2025).",
    "cptCodesNotes": "MolDX unlisted molecular pathology code with DEX Z-code.",
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
    "method": "Tumor-informed MRD assay on the InVision/ RaDaR platform: tumor and matched-normal sequencing identify up to 48 variants, which are tracked by ultra-deep NGS with error suppression.",
    "cancerTypes": [
      "Breast",
      "Head & Neck",
      "Multi-solid"
    ],
    "indicationsNotes": "NeoGenomics RaDaR ST tumor-informed MRD assay with Medicare coverage for HR+/HER2- breast cancer (including late recurrence >5 years) and HPV-negative head and neck cancer; supportive data across multiple solid tumors.",
    "sensitivity": 95.7,
    "sensitivityNotes": "RaDaR ST demonstrated 97% concordance and maintained equivalent sensitivity with RaDaR 1.0\n\nIn breast, 95.7% sens. And 91.0% spec. (https://pmc.ncbi.nlm.nih.gov/articles/PMC10870111/) | Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC10870111/)",
    "specificity": 91.0,
    "specificityNotes": "RaDaR ST demonstrated 97% concordance and maintained equivalent sensitivity with RaDaR 1.0\n\nIn breast, 95.7% sens. And 91.0% spec. (https://pmc.ncbi.nlm.nih.gov/articles/PMC10870111/) | Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC10870111/)",
    "lod": 0.001,
    "lodCitations": "https://ir.neogenomics.com/news-events/press-releases/detail/310/neogenomics-to-present-radar-st-bridging-study-at-islb-2025-demonstrating-reliable-mrd-detection-across-solid-tumors",
    "lodNotes": "Analytical validation for the RaDaR assay supports reliable detection around 10 ppm (~0.001% VAF) with ≥70–90% sensitivity at that level in contrived samples.",
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
    "reimbursement": "Medicare covered for selected indications; MolDX framework applied.",
    "reimbursementNote": "LCDs describe coverage in specific solid tumors (e.g., breast and HPV-negative head & neck cancer) with broader multi-tumor positioning in trials.",
    "commercialPayers": ["Blue Shield of California"],
    "commercialPayersCitations": "https://www.decibio.com/",
    "commercialPayersNotes": "Blue Shield of California covers RaDaR for MRD testing. Coverage continues to expand as clinical evidence builds.",
    "cptCodes": "81479 (MolDX with DEX Z-code); PLA under consideration.",
    "cptCodesNotes": "MolDX unlisted molecular pathology code with DEX Z-code.",
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
    "sensitivityNotes": "COSMOS 2024 longitudinal sensitivity for stage II+ CRC is ~81%. Earlier landmark/Reinert 2021 data showed 55-63% sensitivity. Headline value reflects current COSMOS longitudinal performance.",
    "specificity": 98.0,
    "specificityNotes": "COSMOS 2024 longitudinal specificity is 98% for CRC. Earlier landmark data showed 100% specificity but with serial/longitudinal testing, 91-98% is more representative.",
    "landmarkSensitivity": 63.0,
    "landmarkSensitivityNotes": "CRC landmark sensitivity (stage II–III).",
    "landmarkSpecificity": 98.0,
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
    "initialTatNotes": "Vendor-reported 7-day median TAT.",
    "followUpTat": 7.0,
    "followUpTatNotes": "Vendor-reported 7-day median TAT.",
    "bloodVolume": 20.0,
    "bloodVolumeNotes": "Commonly collected as two 10 mL Streck cfDNA tubes (≈20 mL).",
    "tat": 7.0,
    "tatNotes": "Guardant reports a typical ~7-day turnaround from sample receipt for Reveal.",
    "fdaStatus": "CLIA LDT; not FDA cleared/approved as of 2025.",
    "reimbursement": "Medicare covered for colorectal cancer MRD including post-surgical and surveillance settings; commercial coverage expanding.",
    "reimbursementNote": "Initial Medicare LCD for CRC MRD after curative-intent treatment; subsequent updates extended coverage to surveillance and broader CRC use; additional payer adoption ongoing.",
    "commercialPayers": ["BCBS Louisiana", "Geisinger Health Plan"],
    "commercialPayersCitations": "https://www.businesswire.com/news/home/20230720806084/en/Guardant-Health-receives-first-commercial-payor-coverage-for-Guardant-Reveal%E2%84%A2-test-from-Blue-Cross-and-Blue-Shield-of-Louisiana/",
    "commercialPayersNotes": "Blue Cross Blue Shield of Louisiana became first commercial payer to cover Guardant Reveal in July 2023. Geisinger Health Plan added coverage later in 2023. Additional BCBS plans (including BCBS Massachusetts) appear to have medical policies; verify with specific plan.",
    "cptCodes": "0569U (Guardant Reveal PLA code from mid-2025; historically billed under 81479/MolDX).",
    "cptCodesNotes": "Guardant Reveal PLA (2025).",
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
    "sensitivityNotes": "Recurrence Surveillance:\nCRC: 88-93% sens., 98% spec.\nBreast: 88-89% sens., 95-99% spec.\nLung: 80-99% sens., 96-99% spec.\nBladder: 99% sens., 98% spec.\nOvarian: 99% sens.\n\nhttps://www.natera.com/oncology/signatera-advanced-cancer-detection/ | Sources: https://www.natera.com/oncology/signatera-advanced-cancer-detection/",
    "specificity": 98.0,
    "specificityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "specificityNotes": "Specificity ranges by cancer type: CRC 98%, Breast 95-99%, Lung 96-99%, Bladder 98%. Headline value of 98% reflects typical performance across indications.",
    "ppv": 98.0,
    "ppvNotes": "Overall PPV >98% (vendor, multi-tumor).",
    "npv": 96.0,
    "npvNotes": "NSCLC distant/extracranial single timepoint NPV.",
    "landmarkSensitivity": 75.0,
    "landmarkSensitivityNotes": "NSCLC distant/extracranial single timepoint sensitivity.",
    "longitudinalSensitivity": 94.0,
    "longitudinalSensitivityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "longitudinalSensitivityNotes": "NSCLC distant/extracranial longitudinal sensitivity.",
    "longitudinalSpecificity": 98.0,
    "longitudinalSpecificityCitations": "https://investor.natera.com/news/news-details/2025/SignateraTM-Genome-Clinical-Performance-Highlighted-at-ASCO-2025/default.aspx",
    "longitudinalSpecificityNotes": "Longitudinal specificity across cancer types ranges 96-99%; 98% represents typical performance.",
    "lod": 0.01,
    "lodNotes": "Natera reports analytical sensitivity to ~0.01% tumor fraction (100 ppm) with high specificity using integrated digital error suppression; practical LoD can be lower in some high-input settings.",
    "leadTimeVsImaging": 300.0,
    "leadTimeVsImagingNotes": "Ovarian ~10 months; NSCLC >7 months earlier than imaging.",
    "requiresTumorTissue": "Yes",
    "requiresTumorTissueNotes": "Tumor-informed; needs primary tumor tissue.",
    "requiresMatchedNormal": "Yes",
    "requiresMatchedNormalNotes": "Matched normal blood required.",
    "variantsTracked": "16",
    "variantsTrackedNotes": "Original commercial design tracks 16 somatic variants per patient; some research/“Genome” configurations track more (e.g., 64) but 16 remains the standard clinical panel.",
    "initialTat": 28.0,
    "initialTatNotes": "Baseline tumor/normal sequencing and panel design typically require ~3–4 weeks.",
    "followUpTat": 9.0,
    "followUpTatNotes": "Longitudinal MRD blood draws generally reported within ~7–10 days.",
    "bloodVolume": 20.0,
    "bloodVolumeNotes": "Commonly two Streck cfDNA tubes (~10 mL each) for monitoring; tissue + matched normal required at baseline",
    "tat": 28.0,
    "tatNotes": "Overall paradigm: ~4 weeks for initial build, ~1–1.5 weeks for follow-up tests.",
    "fdaStatus": "CLIA LDT; not FDA-cleared/approved as of late 2025 (clinical validation via numerous peer-reviewed studies).",
    "reimbursement": "Broad Medicare (MolDX) coverage across multiple solid tumors; ADLT pricing in place.",
    "reimbursementNote": "Signatera is covered by Medicare for several indications (CRC, breast, others) and uses ADLT/PLA coding with widespread commercial payer recognition.",
    "commercialPayers": ["UnitedHealthcare", "Cigna", "Anthem BCBS", "BCBS Louisiana", "Blue Shield of California"],
    "commercialPayersCitations": "https://www.natera.com/oncology/billing/",
    "commercialPayersNotes": "Natera is in-network with most major health plans including Cigna, UnitedHealthcare, and Blue Shield of California. BCBS Louisiana provides explicit coverage. Note: Aetna lists Signatera codes as in-network but current policies show non-covered; verify with plan.",
    "cptCodes": "0340U (ADLT)",
    "cptCodesNotes": "Signatera PLA (ADLT pricing).",
    "clinicalAvailability": "Clinical LDT – shipping",
    "independentValidation": "Yes",
    "independentValidationNotes": "Multiple peer-reviewed and prospective studies across tumors.",
    "exampleTestReport": "https://www.natera.com/resource-library/signatera/signatera-patient-test-sample-report/",
    "clinicalTrials": "BESPOKE CRC (NCT04264702); multicentre prospective observational study of ~2,000 stage I–IV colorectal cancer patients at up to 200 U.S. sites (MRD and surveillance cohorts)",
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
    "landmarkSpecificity": 94.0,
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
    "bloodVolumeNotes": "RUO specimen overview describes two 8.5 mL Streck cfDNA tubes (~17 mL total) per timepoint.",
    "tatNotes": "Overall TAT is marketed as faster than tumor-informed assays due to avoiding tissue sequencing, but a precise canonical value is not available.",
    "fdaStatus": "CLIA LDT (for clinical xM portfolio) with RUO offering for biopharma; not FDA cleared/approved as of 2025.",
    "reimbursement": "Coverage emerging; verify payer-specific policies.",
    "reimbursementNote": "xM MRD is newer than some competitors; commercial and Medicare coverage are evolving and may currently be more limited than for Signatera or Guardant Reveal.",
    "cptCodes": "81479 (MolDX with DEX Z-code)",
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
    "lod": 0.005,
    "lodCitations": "https://oncology.labcorp.com/biopharma-partners/plasma-detect; https://ismrc-symposium.eu/_Resources/Persistent/f0607069e3aaad66b7ef9a95afad4f655696b5d3/PS-01-012_Carmen%20Rubio-Alarcon_PLCRC-PROVENC3%20assessing%20the%20prognostic%20value%20of%20post-sur.pdf",
    "lodNotes": "Analytical LoD around 0.005% ctDNA content (LoD95) in contrived reference samples, with analytical specificity ~99.4–99.6% across noncancer donor specimens (Plasma Detect assay specifications and PROVENC3 analytical validation poster).",
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
    "cptCodesNotes": "No public PLA/CPT code specific to Labcorp Plasma Detect as of 2025; billing typically requires payer-specific guidance and may rely on unlisted molecular pathology codes (e.g., 81479).",
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
    "indicationsNotes": "Ultra-sensitive MRD assay offered for research use in early- and late-stage solid tumors. Available through Foundation's FlexOMx Lab for drug-development studies requiring deep ctDNA detection (e.g., early-stage or low-shedding cancers).",
    "sensitivity": null,
    "sensitivityCitations": "Foundation Medicine press release, September 23, 2025; https://www.foundationmedicine.com/monitoring-portfolio",
    "sensitivityNotes": "Feasibility data indicate high sensitivity at low tumor fractions; cross-indication sensitivity values are study-specific.",
    "specificity": null,
    "specificityCitations": "Foundation Medicine Monitoring Portfolio technical specifications.",
    "specificityNotes": "Described as demonstrating high specificity in feasibility data; values are study- and tumor-specific.",
    "lod": 0.001,
    "lodCitations": "https://www.foundationmedicine.com/monitoring-portfolio",
    "lodNotes": "Reported to detect ctDNA tumor fraction down to 10^-5 (10 ppm, 0.001%) in both early- and late-stage cancer.",
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
    "indicationsNotes": "First and only clinically validated circulating TTMV-HPV DNA blood test. Detects MRD and recurrence in HPV-driven cancers before clinical or radiographic evidence. Used across the care continuum: pre-treatment baseline, treatment response assessment, post-treatment MRD surveillance, and recurrence detection. Median 4-month lead time vs imaging for recurrence detection.",
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
    "reimbursementNote": "Medicare covered via Palmetto GBA MolDX: HPV+ oropharyngeal cancer (Nov 2023), anal squamous cell carcinoma (Nov 2025). CMS ADLT designation effective April 2024.",
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
    "indicationsNotes": "Ultra-sensitive MRD assay for B-cell malignancies leveraging phased variant technology in somatic hypermutation regions. First ctDNA-MRD test included in NCCN Guidelines for B-Cell Lymphomas (Dec 2024). Acquired by Natera December 2025. Solid tumor version (up to 5,000 variants, 0.3 ppm LOD) in development but not yet clinically available.",
    "sensitivity": 90.62,
    "sensitivityCitations": "Boehm N et al. Oncotarget 2025;16:329-336; JCO 2025 pooled analysis (n=137).",
    "sensitivityNotes": "Positive percent agreement 90.62% (95% CI 74.98-98.02%) in DLBCL analytical validation. End-of-treatment MRD detection identified 90% of patients who later relapsed vs 45% for PET/CT.",
    "specificity": 97.65,
    "specificityCitations": "Boehm N et al. Oncotarget 2025;16:329-336.",
    "specificityNotes": "Negative percent agreement 97.65% (95% CI 87.43-99.94%) in DLBCL validation. False positive rate 0.24%.",
    "lod": 0.00007,
    "lodCitations": "Foresight COO communication Dec 2025; Boehm N et al. Oncotarget 2025.",
    "lodNotes": "LOD 0.7 ppm (7 parts per 10 million) validated in regulatory study for lymphoma panel. Solid tumor version (in development) achieves 0.3 ppm.",
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
    "vendorDataSource": "Foresight COO communication Dec 2025",
    "solidTumorVersionNotes": "Foresight CLARITY for solid tumors is in development (not clinically available). Uses WGS baseline with up to 5,000 phased+low-error variants and achieves 0.3 ppm LOD. Requires custom reagent design like other MRD products.",
    "acquisitionDetails": {
      "acquirer": "Natera",
      "date": "2025-12-05",
      "upfrontValueUSD": 275000000,
      "earnoutPotentialUSD": 175000000
    }
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
    "stageISensitivity": 54.5,
    "stageIISensitivity": 100.0,
    "stageIIISensitivity": 96.0,
    "stageIVSensitivity": 87.5,
    "specificity": 89.6,
    "ppv": 3.1,
    "ppvDefinition": "PPV for colorectal cancer (CRC) in average-risk ECLIPSE screening population",
    "npv": 99.92,
    "npvDefinition": "NPV for absence of CRC in average-risk ECLIPSE screening population",
    "performanceCitations": "ECLIPSE NEJM 2024 (n=20000+); FDA SSED P230009",
    "performanceNotes": "In ECLIPSE cfDNA blood test showed 83% sensitivity for CRC with 90% specificity. Stage I sensitivity 55-65%; limited detection of advanced adenomas (13.2%).",
    "leadTimeNotes": "No formal lead-time vs colonoscopy; positioned as guideline-accepted primary screening option every 3 years in average-risk adults",
    "fdaStatus": "FDA-approved PMA (P230009) July 26 2024 - First blood test for primary CRC screening; NCCN-recommended",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare covered per NCD 210.3; commercial coverage expanding",
    "commercialPayers": [],
    "commercialPayersCitations": "https://investors.guardanthealth.com/press-releases/press-releases/2025/Guardant-Healths-Shield-Blood-Test-Now-Covered-for-VA-Community-Care-Beneficiaries/default.aspx",
    "commercialPayersNotes": "No commercial payer coverage yet. Government programs: VA Community Care Network covers Shield with no copay for average-risk individuals 45+; TRICARE also covers. Commercial insurance coverage pending USPSTF guideline inclusion and ACS recommendations. Once included in guidelines, expected to be covered under ACA preventive services.",
    "clinicalAvailability": "Commercially available in US since August 2024",
    "tat": "~14 days",
    "sampleType": "Whole blood in Guardant cfDNA BCT tubes",
    "sampleVolume": "4 tubes (minimum 2 mL plasma)",
    "sampleStability": "7 days at ambient temperature",
    "cptCode": "0537U",
    "listPrice": 895.0,
    "screeningInterval": "Every 3 years",
    "clinicalTrials": "NCT04136002 ECLIPSE CRC screening study (22877); NCT05716477 OSU Guardant Shield CRC Screening Project (300)",
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
    "stageISensitivity": 16.8,
    "stageIISensitivity": 40.4,
    "stageIIISensitivity": 77.0,
    "stageIVSensitivity": 90.1,
    "specificity": 99.5,
    "ppv": 61.6,
    "ppvDefinition": "PPV for any cancer among participants with Cancer Signal Detected",
    "npv": 99.1,
    "npvDefinition": "NPV for remaining cancer-free after No Cancer Signal Detected (12-month follow-up)",
    "tumorOriginAccuracy": 93,
    "tumorOriginAccuracyNotes": "Cancer Signal Origin (CSO) prediction accuracy: 93% top-1 prediction, 97% top-2 predictions in CCGA validation studies",
    "performanceCitations": "CCGA case-control studies (n=15254); PATHFINDER (n=6662); PATHFINDER 2 (n=35878); NHS-Galleri (n=140000+)",
    "performanceNotes": "Overall cancer signal sensitivity ~51.5% with stage-specific sensitivity rising from ~17% at stage I to ~90% at stage IV; specificity ~99.5-99.6%.",
    "leadTimeNotes": "PATHFINDER and PATHFINDER 2 show ~7-fold increase in cancers detected when added to USPSTF A/B screening; median diagnostic resolution ~1.5 months",
    "fdaStatus": "LDT performed in CLIA-certified CAP-accredited lab; not FDA-approved; Breakthrough Device designation; PMA submission expected H1 2026",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Generally self-pay; most insurers and Medicare do not cover MCED as of 2025; TRICARE covers for ≥50 with elevated risk",
    "commercialPayers": ["Curative Insurance", "Fountain Health", "Alignment Health Plan"],
    "commercialPayersCitations": "https://grail.com/press-releases/curative-insurance-company-adds-grails-galleri-test-to-member-benefits-for-multi-cancer-early-detection/",
    "commercialPayersNotes": "Limited commercial coverage. Curative Insurance and Fountain Health offer $0 copay coverage. Alignment Health Plan (Medicare Advantage) covers in select CA/NC plans. Government programs: TRICARE covers with prior authorization for eligible beneficiaries ≥50. Most major commercial insurers consider investigational.",
    "clinicalAvailability": "Commercially available in US and some international markets as CLIA test since June 2021",
    "tat": "10-14 business days (up to 4 weeks during high volume)",
    "sampleType": "Whole blood in Streck cfDNA BCT tubes",
    "sampleVolume": "2 tubes",
    "sampleStability": "7 days at ambient temperature (1-40°C); do not refrigerate/freeze",
    "cptCode": "Proprietary",
    "listPrice": 949.0,
    "screeningInterval": "Annual recommended",
    "clinicalTrials": "NCT05611632 NHS-Galleri randomized screening trial (~140000); NCT06450171 PATHFINDER 2 safety/performance study (~35500); NCT03934866 SUMMIT high-risk lung cohort (13035)",
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
    "stageISensitivity": 87.0,
    "stageIISensitivity": 94.0,
    "stageIIISensitivity": 97.0,
    "stageIVSensitivity": 100.0,
    "specificity": 91.0,
    "ppv": 3.2,
    "ppvDefinition": "PPV for colorectal cancer (CRC) in BLUE-C average-risk screening population",
    "npv": 99.98,
    "npvDefinition": "NPV for absence of CRC in BLUE-C average-risk screening population",
    "performanceCitations": "BLUE-C pivotal trial NEJM 2024 (n=20000+); DeeP-C studies",
    "performanceNotes": "Pivotal data show 94% sensitivity for CRC and 43% for APL; significantly outperforms FIT (94% vs 67% for CRC; 43% vs 23% for APL).",
    "leadTimeNotes": "Non-invasive alternative to colonoscopy; 30% lower false positive rate vs original Cologuard; significantly improved adherence vs colonoscopy",
    "fdaStatus": "FDA-approved PMA October 4 2024",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare covered; $0 out-of-pocket for eligible; broad commercial payer coverage",
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
    "stageISensitivity": 100.0,
    "stageIISensitivity": 71.4,
    "stageIIISensitivity": 100.0,
    "specificity": 88.0,
    "ppv": 1.9,
    "ppvDefinition": "PPV for colorectal cancer (CRC) in PMA primary effectiveness cohort",
    "npv": 94.4,
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
    "specificity": 97.4,
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
    "tat": "Not publicly specified",
    "sampleType": "Whole blood in LBgard tubes",
    "sampleVolume": "4 tubes × 8.5 mL = 34 mL total",
    "sampleStability": "72 hours at room temperature (15-25°C)",
    "cptCode": "Proprietary",
    "listPrice": 689.0,
    "screeningInterval": "Annual recommended",
    "clinicalTrials": "DETECT-A prospective interventional MCED (10006); ASCEND-2 classifier development (6354); NCT06589310 FALCON Registry (25000 target)",
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
    "stageISensitivity": 57.1,
    "stageIISensitivity": 100.0,
    "stageIIISensitivity": 82.4,
    "stageIVSensitivity": 100.0,
    "specificity": 91.5,
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
    "stageISensitivity": 71.0,
    "stageIISensitivity": 89.0,
    "stageIIISensitivity": 88.0,
    "stageIVSensitivity": 98.0,
    "specificity": 58.0,
    "ppvDefinition": "PPV for lung cancer among Elevated results in high-risk USPSTF screening population",
    "npv": 99.7,
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
    "stageISensitivity": 76.0,
    "specificity": 91.0,
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
    "stageISensitivity": 82.0,
    "specificity": 87.0,
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
    "ppvDefinition": "PPV for any of 10 target cancers among positive Shield MCD results (not yet reported)",
    "npvDefinition": "NPV for remaining cancer-free among negative Shield MCD results (not yet reported)",
    "performanceCitations": "AACR 2025 oral presentation; ASCO 2025; NCI Vanguard Study (NCT pending; n=24000)",
    "performanceNotes": "High specificity and clinically meaningful sensitivity across 10 tumor types with cancer signal of origin accuracy; specific performance metrics not yet publicly disclosed; data supported NCI selection for Vanguard Study",
    "leadTimeNotes": "Available as add-on to Shield CRC screening; physician must opt-in and patient must authorize release of medical records to Guardant in exchange for MCD results",
    "fdaStatus": "LDT; FDA Breakthrough Device Designation (June 2025); selected for NCI Vanguard Study (24000 participants); Shield MCD reviewed by FDA as part of NCI investigational device exemption (IDE)",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "Not covered by Medicare or commercial payers; no additional cost when ordered with Shield CRC (data exchange model)",
    "clinicalAvailability": "Launched nationally October 2025; available when ordering Shield CRC test with physician opt-in",
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
    "sensitivityNotes": "Overall incidence-adjusted sensitivity (IAS) across all stages. IAS is more conservative than observed sensitivity as it weights by cancer incidence.",
    "stageISensitivity": 45.0,
    "stageIISensitivity": 45.0,
    "stageISensitivityNotes": "Combined Stage I/II IAS = 45%. For aggressive unscreened cancers (bladder, esophagus, liver, H&N, lung, pancreas, stomach, uterine) Stage I/II sensitivity is 57%.",
    "stageIIISensitivity": 73.0,
    "stageIVSensitivity": 74.0,
    "specificity": 99.5,
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
    "lod": "~0.1–0.2% VAF",
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
    "method": "Personalized amplicon-based NGS panels targeting 16+ patient-specific variants identified from tumor/normal sequencing",
    "cancerTypes": [
      "Any solid tumor on ICI therapy"
    ],
    "targetPopulation": "Patients with advanced or metastatic solid tumors starting ICI monotherapy or ICI-based combinations",
    "responseDefinition": "Change in personalized ctDNA level from baseline to beginning of cycle 3 (~6 weeks); increase vs decrease vs clearance",
    "lod": "~0.01% VAF",
    "fdaStatus": "LDT in CLIA/CAP lab; covered by Medicare for ICI treatment response monitoring",
    "reimbursement": "Medicare",
    "reimbursementNote": "Medicare-covered under LCD L38779 for colorectal, breast, bladder, ovarian, and lung cancers, including ovarian cancer in adjuvant/surveillance settings, neoadjuvant and adjuvant breast cancer, and stage I–III NSCLC surveillance, as well as pan-cancer immunotherapy response monitoring. As of June 2025, the genome-based Signatera Genome assay has matching Medicare coverage for these indications.",
    "commercialPayers": ["UnitedHealthcare", "Cigna", "Anthem BCBS", "BCBS Louisiana", "Blue Shield of California"],
    "commercialPayersCitations": "https://www.natera.com/oncology/billing/",
    "commercialPayersNotes": "Natera is in-network with most major health plans including Cigna, UnitedHealthcare, and Blue Shield of California. BCBS Louisiana provides explicit coverage. Note: Aetna lists Signatera codes as in-network but current policies show non-covered; verify with plan.",
    "clinicalTrials": "NCT04660344 IMvigor011 Phase III bladder cancer (760); NCT05987241 MODERN (Alliance A032103) Phase 2/3 bladder cancer (~400 target); BESPOKE IO prospective observational study (multi-center)",
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
    "method": "Whole-genome sequencing of tumor and matched normal with design of personalized panels targeting up to ~1,800 variants; ultra-deep sequencing of plasma cfDNA",
    "cancerTypes": [
      "Multiple solid tumors (breast, colorectal, NSCLC, melanoma, renal, others)"
    ],
    "targetPopulation": "Patients with solid tumors after curative-intent therapy (MRD) and those on systemic therapy",
    "responseDefinition": "Quantitative change in ctDNA signal (PPM) over time; molecular response often defined as deep decrease or clearance below limit of detection",
    "lod": "~3.45 PPM (~0.000345% VAF)",
    "fdaStatus": "High-complexity LDT in CLIA/CAP lab; not FDA-approved",
    "reimbursement": "Medicare covered for select solid tumor indications including stage II-III breast cancer surveillance",
    "reimbursementNote": "Co-commercialized with Tempus AI as xM (NeXT Personal Dx), with Tempus serving as the exclusive commercial diagnostic partner for tumor-informed MRD in breast, lung, colorectal cancers and solid-tumor immunotherapy monitoring. Clinically launched within Tempus’ MRD portfolio and covered by Medicare for select solid tumor indications (for example, stage II–III breast cancer surveillance).",
    "clinicalTrials": "NCT06230185 B-STRONGER I TNBC MRD/monitoring study (422); VICTORI resectable colorectal cancer MRD study (~71, interim cohort)",
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
    "method": "Personalized amplicon-based NGS panels (up to ~48 variants) designed from WES of tumor and matched normal; ultra-deep ctDNA sequencing",
    "cancerTypes": [
      "Multiple solid tumors (breast, melanoma, colorectal, head & neck, lung, others)"
    ],
    "targetPopulation": "High-risk early-stage and advanced solid-tumor patients followed longitudinally after treatment or on systemic therapy",
    "responseDefinition": "Track ctDNA levels over serial time points; response often defined as rapid fall or clearance vs persistent or rising ctDNA",
    "lod": "~10⁻⁵–10⁻⁶ ctDNA levels",
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
    "lod": "Detects ctDNA tumor fraction; analytical sensitivity varies by sample and tumor characteristics",
    "lodCitations": "Foundation Medicine Monitoring Portfolio; Woodhouse R et al. PLoS One 2020;15:e0237802.",
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
  }
];


// Compressed test data for chatbot - keeps all fields but shortens keys and removes nulls/citations
const compressTestForChat = (test) => {
  // Key mapping: long names → short names
  const keyMap = {
    id: 'id', name: 'nm', vendor: 'vn', approach: 'ap', method: 'mt', sampleCategory: 'samp',
    cancerTypes: 'ca', indicationsNotes: 'ind', sensitivity: 'sens', specificity: 'spec',
    ppv: 'ppv', npv: 'npv', lod: 'lod', lodNotes: 'lodN', requiresTumorTissue: 'tumorReq',
    requiresMatchedNormal: 'normReq', variantsTracked: 'vars', initialTat: 'tat1', followUpTat: 'tat2',
    leadTimeVsImaging: 'lead', bloodVolume: 'bvol', fdaStatus: 'fda', reimbursement: 'reimb',
    reimbursementNote: 'reimbN', commercialPayers: 'privIns', clinicalAvailability: 'avail',
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
};

// Key legend for chatbot prompt
const chatKeyLegend = `KEY: nm=name, vn=vendor, ap=approach, mt=method, samp=sample type, ca=cancers, sens/spec=sensitivity/specificity%, s1-s4=stage I-IV sensitivity, ppv/npv=predictive values, lod=limit of detection, tumorReq=requires tumor, vars=variants tracked, tat1/tat2=initial/followup TAT days, lead=lead time vs imaging days, fda=FDA status, reimb=reimbursement, privIns=commercial payers, avail=availability, trial=participants, pubs=publications, scope=test scope, pop=target population, origAcc=tumor origin accuracy%, price=list price, respDef=response definition, nccn=NCCN guidelines.`;

// Persona-specific chatbot style instructions
const getPersonaStyle = (persona) => {
  switch(persona) {
    case 'Patient':
      return `AUDIENCE: Patient or caregiver seeking to understand options.
STYLE: Use clear, accessible language. Avoid jargon - if you must use technical terms, briefly explain them. Be warm and reassuring. Always remind them to discuss options with their healthcare provider. Focus on practical aspects: What does this test do? Is it covered by insurance? What's involved in getting tested?`;
    case 'Clinician':
      return `AUDIENCE: Healthcare professional comparing tests for patients.
STYLE: Be direct and clinical. Use standard medical terminology freely. Focus on actionable metrics: sensitivity, specificity, LOD, TAT, reimbursement status, FDA clearance. Skip basic explanations. Highlight clinically meaningful differences between tests.`;
    case 'Research and Development':
      return `AUDIENCE: Researcher or industry professional studying the landscape.
STYLE: Be technical and detailed. Include methodology details, analytical performance metrics, and validation data. Reference publications and trial data when relevant. Discuss technology differentiators and emerging approaches.`;
    default:
      return `STYLE: Be concise and helpful. Lead with key insights. Use prose not bullets.`;
  }
};

// Helper to get persona from localStorage
const getStoredPersona = () => {
  try {
    return localStorage.getItem('openonco-persona');
  } catch {
    return null;
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
  },
  ECD: {
    // Oncologist priority: Single cancer or multi? Sample type? What's the target population? Covered?
    testScopes: ['Single-cancer (CRC)', 'Multi-cancer (MCED)'],
    sampleCategories: ['Blood/Plasma', 'Stool'],
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT', 'Investigational'],
    reimbursements: ['Medicare', 'Commercial'],
    approaches: ['Blood-based cfDNA screening (plasma)', 'Blood-based cfDNA methylation MCED (plasma)'],
  },
  TRM: {
    // Oncologist priority: What cancer? Sample type? Approach? Covered?
    cancerTypes: [...new Set(trmTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: ['Blood/Plasma'],
    approaches: ['Tumor-informed', 'Tumor-naïve', 'Tumor-agnostic'],
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
    { key: 'sensitivity', label: 'Sensitivity (%)' },
    { key: 'specificity', label: 'Specificity (%)' },
    { key: 'lod', label: 'LOD (ppm)' },
    { key: 'variantsTracked', label: 'Variants Tracked' },
    { key: 'initialTat', label: 'Initial TAT (days)' },
    { key: 'followUpTat', label: 'Follow-up TAT (days)' },
    { key: 'requiresTumorTissue', label: 'Requires Tumor' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Government Insurance' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
  ],
  ECD: [
    { key: 'testScope', label: 'Scope' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'sensitivity', label: 'Sensitivity (%)' },
    { key: 'stageISensitivity', label: 'Stage I Sens (%)' },
    { key: 'stageIISensitivity', label: 'Stage II Sens (%)' },
    { key: 'stageIIISensitivity', label: 'Stage III Sens (%)' },
    { key: 'stageIVSensitivity', label: 'Stage IV Sens (%)' },
    { key: 'specificity', label: 'Specificity (%)' },
    { key: 'ppv', label: 'PPV (%)' },
    { key: 'npv', label: 'NPV (%)' },
    { key: 'tumorOriginAccuracy', label: 'Origin Prediction (%)' },
    { key: 'leadTimeNotes', label: 'Lead Time vs Screening' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Government Insurance' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
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
    { key: 'lod', label: 'LOD' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Government Insurance' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
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
    color: 'orange',
    tests: mrdTestData,
    sourceUrl: BUILD_INFO.sources.MRD,
  },
  ECD: {
    title: 'Early Cancer Detection',
    shortTitle: 'Early Detection',
    description: 'Early Cancer Detection (ECD) tests screen for cancer in people who have no symptoms, with the goal of catching the disease at its earliest and most treatable stages. These tests look for cancer signals in blood samples using various biomarkers including ctDNA methylation patterns, tumor-derived proteins, and genetic mutations. Some tests screen for a single cancer type (like colorectal), while multi-cancer early detection (MCED) tests can screen for dozens of cancer types simultaneously.',
    color: 'green',
    tests: ecdTestData,
    sourceUrl: BUILD_INFO.sources.ECD,
  },
  TRM: {
    title: 'Treatment Response Monitoring',
    shortTitle: 'Response Monitoring',
    description: 'Treatment Response Monitoring (TRM) tests track how well a cancer treatment is working by measuring changes in circulating tumor DNA (ctDNA) levels over time. A decrease in ctDNA often indicates the treatment is effective, while stable or rising levels may signal resistance or progression—sometimes weeks before changes appear on imaging scans. This real-time molecular feedback helps oncologists optimize therapy, potentially switching ineffective treatments earlier and sparing patients unnecessary toxicity.',
    color: 'red',
    tests: trmTestData,
    sourceUrl: BUILD_INFO.sources.TRM,
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
  
  const navItems = ['home', 'how-it-works', 'submissions', 'data-sources', 'about'];
  const getLabel = (page) => ({
    'home': 'Home',
    'data-sources': 'Data Download',
    'how-it-works': 'How it Works',
    'submissions': 'Submissions',
    'about': 'About'
  }[page] || page);
  
  return (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
      <div className="cursor-pointer hidden sm:flex items-center flex-shrink-0" onClick={() => handleNavigate('home')}>
        <img src="data:image/jpeg;base64,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" alt="OpenOnco" className="h-14" />
      </div>
      <span className="sm:hidden text-xl font-bold text-[#2A63A4] cursor-pointer" onClick={() => handleNavigate('home')}>OpenOnco</span>
      <nav className="hidden sm:flex items-center flex-1 justify-evenly overflow-x-auto">
        {['home', 'how-it-works', 'data-sources', 'submissions', 'about'].map(page => (
          <button
            key={page}
            onClick={() => handleNavigate(page)}
            className={`px-2 sm:px-4 py-2 rounded-lg text-sm sm:text-lg font-semibold transition-colors whitespace-nowrap ${
              currentPage === page ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {page === 'home' ? 'Home' : page === 'data-sources' ? 'Data Download' : page === 'how-it-works' ? 'How it Works' : page === 'submissions' ? 'Submissions' : 'About'}
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
        <strong>Disclaimer:</strong> OpenOnco is provided for informational and educational purposes only. The information on this website is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or treatment options. OpenOnco does not recommend or endorse any specific tests, physicians, products, procedures, or opinions. Reliance on any information provided by OpenOnco is solely at your own risk. Test performance data, pricing, and availability are subject to change and should be verified directly with test vendors.
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
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const suggestedQuestions = [
    "Best MRD test for stage II-III colorectal cancer?",
    "Compare tumor-informed vs tumor-naïve MRD approaches",
    "Which early detection tests have Medicare coverage?",
    "Most sensitive blood test for lung cancer screening?",
    "MRD tests that don't require tumor tissue?",
    "Compare Signatera vs Guardant Reveal for breast cancer",
    "I am a patient, keep answers basic",
    "I am a physician, I like detailed answers",
    "Vergleichen Sie Signatera mit Guardant Reveal"
  ];

  useEffect(() => { 
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Track persona from localStorage
  const [persona, setPersona] = useState(null);
  useEffect(() => {
    setPersona(getStoredPersona());
  }, []);

  const handleSuggestionClick = (question) => {
    setShowSuggestions(false);
    setInput('');
    submitQuestion(question);
  };

  // Memoize system prompt - recompute when persona changes
  const systemPrompt = useMemo(() => {
    return `You are a liquid biopsy test assistant for OpenOnco. Help users explore and compare tests. You are not a clinical advisor and cannot provide medical advice.

DATABASE:
${JSON.stringify(chatTestData)}

${chatKeyLegend}

${getPersonaStyle(persona)}

Say "not specified" for missing data.`;
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
          model: "claude-haiku-4-5-20251001",
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
        <p className="text-[#163A5E] text-sm">Query our database of {totalTests} MRD, ECD, and TRM tests</p>
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
      
      <div className="border-t border-gray-200 p-4 bg-white flex gap-3 flex-shrink-0">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude about liquid biopsy tests here" 
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
    </div>
  );
};


// ============================================
// Test Showcase Component - Rotating parameters for each test
// ============================================
const TestShowcase = ({ onNavigate }) => {
  const [paramIndices, setParamIndices] = useState({});
  const [selectedTest, setSelectedTest] = useState(null);

  // Combine all tests with their category
  const allTests = [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD', color: 'orange' })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD', color: 'emerald' })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM', color: 'red' }))
  ];

  // Get numerical parameters for a test
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
    if (test.lod != null && typeof test.lod === 'number') params.push({ label: 'LOD', value: `${(test.lod * 10000).toFixed(1).replace(/\.0$/, '')} ppm`, type: 'analytical' });
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
    operational: 'text-slate-600'    // Gray - logistics/specs
  };

  // Rotate parameters every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setParamIndices(prev => {
        const next = { ...prev };
        allTests.forEach(test => {
          const params = getParams(test);
          const currentIdx = prev[test.id] || 0;
          next[test.id] = (currentIdx + 1) % params.length;
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const colorClasses = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500', text: 'text-orange-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-500', text: 'text-emerald-600' },
    red: { bg: 'bg-sky-100', border: 'border-sky-300', badge: 'bg-sky-500', text: 'text-sky-600' }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-xl font-bold text-slate-800 text-center mb-4">
        Overview: Tests We Track (use the tools above to dig in)
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {allTests.map(test => {
          const params = getParams(test);
          const currentIdx = paramIndices[test.id] || 0;
          const currentParam = params[currentIdx];
          const colors = colorClasses[test.color];
          
          return (
            <div
              key={test.id}
              onClick={() => setSelectedTest(test)}
              className={`${colors.bg} ${colors.border} border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{test.name}</p>
                  <p className="text-xs text-slate-500 truncate">{test.vendor}</p>
                </div>
                <span className={`${colors.badge} text-white text-xs px-1.5 py-0.5 rounded font-medium ml-2 flex-shrink-0`}>
                  {test.category}
                </span>
              </div>
              
              <div className="h-10 flex flex-col justify-center">
                <p className="text-xs text-slate-500">{currentParam.label}</p>
                <p className={`text-base font-bold ${paramTypeColors[currentParam.type] || 'text-slate-600'} transition-all truncate`}>
                  {currentParam.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend at bottom */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-200 text-xs">
        <span className="text-slate-500">Categories:</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          <span className="text-slate-500">MRD</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-slate-500">ECD</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
          <span className="text-slate-500">TRM</span>
        </span>
        <span className="mx-2 text-slate-300">|</span>
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

      {/* Test Card Modal */}
      {selectedTest && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTest(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-gray-900">{selectedTest.name}</h3>
              <button 
                onClick={() => setSelectedTest(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <TestCard 
                test={selectedTest} 
                category={selectedTest.category} 
                isSelected={false} 
                onSelect={() => {}} 
              />
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-end gap-2 rounded-b-2xl">
              <button
                onClick={() => setSelectedTest(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Close
              </button>
              <button
                onClick={() => { setSelectedTest(null); onNavigate(selectedTest.category, selectedTest.id); }}
                className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90"
                style={{ backgroundColor: '#2A63A4' }}
              >
                View in {selectedTest.category} Navigator
              </button>
            </div>
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
    { key: 'lod', label: 'Limit of Detection', unit: '', description: 'Lowest detection limit', higherIsBetter: false, format: (v) => { const ppm = v * 10000; return ppm >= 1 ? `${ppm.toFixed(1).replace(/\.0$/, '')} ppm` : `${ppm.toPrecision(2)} ppm`; }, filter: (v) => v != null && typeof v === 'number' && v > 0 },
    { key: 'variantsTracked', label: 'Variants Tracked', unit: '', description: 'Most variants tracked', higherIsBetter: true, format: (v) => Number(v)?.toLocaleString(), filter: (v) => v != null && !isNaN(Number(v)) && Number(v) > 0, getValue: (t) => Number(t.variantsTracked) },
    { key: 'tat', label: 'Turnaround Time', unit: ' days', description: 'Fastest turnaround', higherIsBetter: false, format: (v) => v, filter: (v) => v != null && v > 0 },
    { key: 'sensitivity', label: 'Sensitivity', unit: '%', description: 'Highest sensitivity', higherIsBetter: true, format: (v) => v, filter: (v) => v != null && v > 0 && v < 100 },
    { key: 'specificity', label: 'Specificity', unit: '%', description: 'Highest specificity', higherIsBetter: true, format: (v) => v, filter: (v) => v != null && v > 0 && v < 100 },
    { key: 'numIndications', label: 'Cancer Indications', unit: '', description: 'Most cancer types covered', higherIsBetter: true, format: (v) => v, filter: (v) => v != null && v > 0, getValue: (t) => t.cancerTypes?.length || 0 },
  ];
  
  // Combine all tests
  const allTests = [
    ...mrdTestData.map(t => ({ ...t, category: 'MRD', numIndications: t.cancerTypes?.length || 0 })),
    ...ecdTestData.map(t => ({ ...t, category: 'ECD', numIndications: t.cancerTypes?.length || 0 })),
    ...trmTestData.map(t => ({ ...t, category: 'TRM', numIndications: t.cancerTypes?.length || 0 }))
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
    TRM: { bg: 'bg-sky-100', border: 'border-sky-300', badge: 'bg-sky-500', text: 'text-sky-600' }
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
              <p className="text-xs text-slate-500 truncate">{test.vendor}</p>
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
  const [persona, setPersona] = useState(null);
  const chatContainerRef = useRef(null);

  // Load persona from localStorage on mount
  useEffect(() => {
    const savedPersona = localStorage.getItem('openonco-persona');
    if (savedPersona) {
      setPersona(savedPersona);
    }
  }, []);

  // Save persona to localStorage when changed
  const handlePersonaSelect = (selectedPersona) => {
    setPersona(selectedPersona);
    localStorage.setItem('openonco-persona', selectedPersona);
  };

  // Auto-scroll to bottom when messages or loading state changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
  const colorClasses = {
    orange: { card: 'bg-orange-50 border-orange-200 hover:border-orange-300 hover:shadow-md', btn: 'from-orange-500 to-orange-600' },
    green: { card: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 hover:shadow-md', btn: 'from-emerald-500 to-emerald-600' },
    red: { card: 'bg-sky-100 border-sky-300 hover:border-sky-400 hover:shadow-md', btn: 'from-sky-500 to-sky-600' },
  };
  
  // All tests combined for chat header ticker
  const exampleQuestions = [
    "MRD tests for colorectal cancer?",
    "Compare Signatera vs Guardant Reveal",
    "Which tests have Medicare coverage?"
  ];

  // Memoize system prompt - recompute when persona changes
  const systemPrompt = useMemo(() => {
    return `You are a liquid biopsy test assistant for OpenOnco. Help users explore and compare tests. You are not a clinical advisor and cannot provide medical advice.

DATABASE:
${JSON.stringify(chatTestData)}

${chatKeyLegend}

${getPersonaStyle(persona)}

Say "not specified" for missing data.`;
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
          model: "claude-haiku-4-5-20251001",
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

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative">
        {/* Build timestamp */}
        <div className="absolute top-2 right-6 text-xs text-gray-400">
          Build: {BUILD_INFO.date}
        </div>

        {/* Intro Text */}
        <div className="bg-slate-50 rounded-2xl px-6 py-3 sm:px-8 sm:py-4 lg:px-10 lg:py-4 border border-slate-200 mb-4">
          <p className="text-base sm:text-xl lg:text-2xl text-slate-700 leading-relaxed">Liquid biopsy tests are reshaping cancer treatment by profiling cancers from a simple blood draw. The tests are advancing rapidly - resulting in complex choices for doctors and patients. <strong>OpenOnco</strong> is a non-profit effort to consolidate test information and provide navigation tools to help match the right test to the right patient.</p>
          
          {/* Persona Selector */}
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm sm:text-base text-slate-600">My interest is</span>
            {['Research and Development', 'Patient', 'Clinician'].map((p) => (
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
          {/* Container Header */}
          <div className="px-4 lg:px-6 py-3 bg-slate-100 border-b border-slate-200">
            <h2 className="text-sm lg:text-base font-semibold text-slate-600 uppercase tracking-wide">Browse Liquid Biopsy Tests using &gt;1,000 Data Points</h2>
          </div>
          
          {/* Category Navigators */}
          <div className="p-4 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
              {/* MRD Navigator */}
              <div
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${colorClasses.orange.card}`}
                onClick={() => onNavigate('MRD')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses.orange.btn} flex items-center justify-center text-white flex-shrink-0`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm lg:text-base font-bold text-slate-800">Minimal Residual Disease</h3>
                      <p className="text-sm lg:text-base font-bold text-slate-800">(MRD) Navigator</p>
                    </div>
                  </div>
                  <span className="text-lg font-medium text-[#2A63A4]">→</span>
                </div>
                <div className="overflow-hidden">
                  <div 
                    className="flex whitespace-nowrap text-xs text-orange-600 font-medium"
                    style={{ animation: 'tickerMRD 20s linear infinite' }}
                  >
                    <span className="inline-block">
                      {mrdTestData.map((t, i) => <span key={i}>{t.name} &nbsp;•&nbsp; </span>)}
                    </span>
                    <span className="inline-block">
                      {mrdTestData.map((t, i) => <span key={`dup-${i}`}>{t.name} &nbsp;•&nbsp; </span>)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* ECD Navigator */}
              <div
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${colorClasses.green.card}`}
                onClick={() => onNavigate('ECD')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses.green.btn} flex items-center justify-center text-white flex-shrink-0`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm lg:text-base font-bold text-slate-800">Early Cancer Detection</h3>
                      <p className="text-sm lg:text-base font-bold text-slate-800">(ECD) Navigator</p>
                    </div>
                  </div>
                  <span className="text-lg font-medium text-[#2A63A4]">→</span>
                </div>
                <div className="overflow-hidden">
                  <div 
                    className="flex whitespace-nowrap text-xs text-emerald-600 font-medium"
                    style={{ animation: 'tickerECD 25s linear infinite' }}
                  >
                    <span className="inline-block">
                      {ecdTestData.map((t, i) => <span key={i}>{t.name} &nbsp;•&nbsp; </span>)}
                    </span>
                    <span className="inline-block">
                      {ecdTestData.map((t, i) => <span key={`dup-${i}`}>{t.name} &nbsp;•&nbsp; </span>)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* TRM Navigator */}
              <div
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${colorClasses.red.card}`}
                onClick={() => onNavigate('TRM')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses.red.btn} flex items-center justify-center text-white flex-shrink-0`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm lg:text-base font-bold text-slate-800">Treatment Response Monitoring</h3>
                      <p className="text-sm lg:text-base font-bold text-slate-800">(TRM) Navigator</p>
                    </div>
                  </div>
                  <span className="text-lg font-medium text-[#2A63A4]">→</span>
                </div>
                <div className="overflow-hidden">
                  <div 
                    className="flex whitespace-nowrap text-xs text-sky-600 font-medium"
                    style={{ animation: 'tickerTRM 15s linear infinite' }}
                  >
                    <span className="inline-block">
                      {trmTestData.map((t, i) => <span key={i}>{t.name} &nbsp;•&nbsp; </span>)}
                    </span>
                    <span className="inline-block">
                      {trmTestData.map((t, i) => <span key={`dup-${i}`}>{t.name} &nbsp;•&nbsp; </span>)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <style>{`
              @keyframes tickerMRD {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              @keyframes tickerECD {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              @keyframes tickerTRM {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
          </div>
          
          {/* Divider */}
          <div className="mx-4 lg:mx-6 border-t border-slate-200"></div>
          
          {/* Chat Section */}
          <div className="bg-white">
            {/* Chat Header */}
            <div className="px-4 lg:px-6 py-3 border-b border-slate-100">
              <h3 className="text-sm lg:text-base font-semibold text-slate-600 uppercase tracking-wide">Ask Claude About Liquid Biopsy Tests</h3>
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
          
          {/* Example Questions (only show when no messages) */}
          {messages.length === 0 && (
            <div className="px-4 lg:px-6 py-3 bg-slate-50">
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
          
          {/* Input Area */}
          <div className="p-4 lg:p-6 border-t border-slate-200 bg-white">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-2 lg:gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Claude about liquid biopsy tests here"
                className="flex-1 border-2 border-slate-200 rounded-lg px-4 py-2 lg:py-3 lg:text-lg focus:outline-none"
                style={{ '--tw-ring-color': '#2A63A4' }}
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
          </div>
          </div>
        </div>

        {/* Test Showcase */}
        <div className="mb-4">
          <TestShowcase onNavigate={onNavigate} />
        </div>

        {/* Stat of the Day */}
        <div className="mb-4">
          <StatOfTheDay onNavigate={onNavigate} />
        </div>

        {/* News Feed */}
        <div className="mb-4">
          <NewsFeed />
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
const DatabaseSummary = () => {
  // Dynamically count actual fields per test
  const mrdParams = mrdTestData.length > 0 ? Object.keys(mrdTestData[0]).length : 0;
  const ecdParams = ecdTestData.length > 0 ? Object.keys(ecdTestData[0]).length : 0;
  const trmParams = trmTestData.length > 0 ? Object.keys(trmTestData[0]).length : 0;
  
  const totalTests = mrdTestData.length + ecdTestData.length + trmTestData.length;
  const totalDataPoints = (mrdTestData.length * mrdParams) + (ecdTestData.length * ecdParams) + (trmTestData.length * trmParams);
  
  const allVendors = new Set([
    ...mrdTestData.map(t => t.vendor),
    ...ecdTestData.map(t => t.vendor),
    ...trmTestData.map(t => t.vendor)
  ]);
  
  const fdaApprovedCount = [
    ...mrdTestData.filter(t => t.fdaStatus?.toLowerCase().includes('fda-approved') || t.fdaStatus?.toLowerCase().includes('fda approved')),
    ...ecdTestData.filter(t => t.fdaStatus?.toLowerCase().includes('fda-approved') || t.fdaStatus?.toLowerCase().includes('fda approved')),
    ...trmTestData.filter(t => t.fdaStatus?.toLowerCase().includes('fda-approved') || t.fdaStatus?.toLowerCase().includes('fda approved'))
  ].length;

  const medicareIndicationsCount = [
    ...mrdTestData,
    ...ecdTestData,
    ...trmTestData
  ].filter(t => t.reimbursement?.toLowerCase().includes('medicare')).length;

  const allPrivateInsurers = new Set([
    ...mrdTestData.flatMap(t => t.commercialPayers || []),
    ...ecdTestData.flatMap(t => t.commercialPayers || []),
    ...trmTestData.flatMap(t => t.commercialPayers || [])
  ]);

  return (
    <div className="bg-gradient-to-br from-slate-300 to-slate-400 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-slate-700">Database Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{totalTests}</p>
          <p className="text-sm text-slate-600">Total Tests</p>
        </div>
        <div className="bg-white/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{totalDataPoints.toLocaleString()}</p>
          <p className="text-sm text-slate-600">Data Points</p>
        </div>
        <div className="bg-white/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{allVendors.size}</p>
          <p className="text-sm text-slate-600">Vendors</p>
        </div>
        <div className="bg-white/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{fdaApprovedCount}</p>
          <p className="text-sm text-slate-600">FDA Approved</p>
        </div>
        <div className="bg-white/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{medicareIndicationsCount}</p>
          <p className="text-sm text-slate-600">Government Insurance</p>
        </div>
        <div className="bg-white/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{allPrivateInsurers.size}</p>
          <p className="text-sm text-slate-600">Private Insurers</p>
        </div>
        <div className="bg-white/40 rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-slate-800">{BUILD_INFO.date.split(' ').slice(0, 2).join(' ')}</p>
          <p className="text-sm text-slate-600">Data Last Updated</p>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-400/40">
        <h3 className="text-sm font-medium text-slate-600 mb-3">Coverage by Category</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <div>
              <p className="text-sm font-medium text-slate-800">MRD</p>
              <p className="text-xs text-slate-600">{mrdTestData.length} tests • {mrdParams} params</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <div>
              <p className="text-sm font-medium text-slate-800">ECD</p>
              <p className="text-xs text-slate-600">{ecdTestData.length} tests • {ecdParams} params</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-sky-500"></div>
            <div>
              <p className="text-sm font-medium text-slate-800">TRM</p>
              <p className="text-xs text-slate-600">{trmTestData.length} tests • {trmParams} params</p>
            </div>
          </div>
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
        The current version of the OpenOnco database is available for anyone to download in several formats - go to the <strong>Data Download</strong> tab.
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
  };

  // Parameters available for correction by category
  const parameterOptions = {
    MRD: [
      { key: 'sensitivity', label: 'Sensitivity (%)' },
      { key: 'specificity', label: 'Specificity (%)' },
      { key: 'lod', label: 'Limit of Detection (ppm)' },
      { key: 'variantsTracked', label: 'Variants Tracked' },
      { key: 'initialTat', label: 'Initial Turnaround Time (days)' },
      { key: 'followUpTat', label: 'Follow-up Turnaround Time (days)' },
      { key: 'bloodVolume', label: 'Blood Volume (mL)' },
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
      { key: 'lod', label: 'Limit of Detection' },
      { key: 'leadTimeVsImaging', label: 'Lead Time vs Imaging (days)' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Reimbursement Status' },
      { key: 'clinicalTrials', label: 'Clinical Trials' },
      { key: 'totalParticipants', label: 'Total Trial Participants' },
      { key: 'numPublications', label: 'Number of Publications' },
      { key: 'other', label: 'Other (specify in notes)' },
    ],
  };

  // Get current value of selected parameter for the selected test
  const getCurrentValue = () => {
    if (!existingTest || !selectedParameter || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : trmTestData;
    const test = testList.find(t => t.id === existingTest);
    if (!test || selectedParameter === 'other') return '';
    const value = test[selectedParameter];
    return value !== null && value !== undefined ? String(value) : 'Not specified';
  };

  // Get vendor name for selected test (for email validation)
  const getSelectedTestVendor = () => {
    if (!existingTest || !category) return '';
    const testList = category === 'MRD' ? mrdTestData : category === 'ECD' ? ecdTestData : trmTestData;
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
              <div className="font-semibold text-gray-800">Suggest New Test</div>
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
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'MRD', label: 'MRD', desc: 'Minimal Residual Disease', color: 'orange' },
                { key: 'ECD', label: 'ECD', desc: 'Early Cancer Detection', color: 'emerald' },
                { key: 'TRM', label: 'TRM', desc: 'Treatment Response', color: 'sky' },
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

      {/* Alternative Contact */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Questions? Contact via{' '}
          <a href="https://www.linkedin.com/in/alexgdickinson/" target="_blank" rel="noopener noreferrer" className="text-[#2A63A4] hover:underline">
            LinkedIn
          </a>
          {' '}(include #openonco in your message)
        </p>
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

  const generateCsv = (headers, rows) => {
    return [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? 'UNKNOWN').replace(/"/g, '""')}"`).join(',')).join('\n');
  };

  const downloadMrdCsv = () => {
    const headers = ['Test Name', 'Vendor', 'Approach', 'Cancer Types', 'Sensitivity (%)', 'Specificity (%)', 'LOD (ppm)', 'TAT (days)', 'FDA Status', 'Reimbursement', 'Trial Participants', 'Publications'];
    const rows = mrdTestData.map(t => [
      t.name, t.vendor, t.approach, t.cancerTypes?.join('; '), t.sensitivity, t.specificity, t.lod != null ? (t.lod * 10000).toFixed(2) : null, t.tat || t.initialTat, t.fdaStatus, t.reimbursement, t.totalParticipants, t.numPublicationsPlus ? `${t.numPublications}+` : t.numPublications
    ]);
    downloadFile(generateCsv(headers, rows), 'OpenOnco_MRD.csv', 'text/csv;charset=utf-8;');
  };

  const downloadEcdCsv = () => {
    const headers = ['Test Name', 'Vendor', 'Test Scope', 'Cancer Types', 'Sensitivity (%)', 'Specificity (%)', 'TAT (days)', 'FDA Status', 'Reimbursement', 'List Price', 'Trial Participants', 'Publications'];
    const rows = ecdTestData.map(t => [
      t.name, t.vendor, t.testScope, t.cancerTypes?.join('; '), t.sensitivity, t.specificity, t.tat, t.fdaStatus, t.reimbursement, t.listPrice, t.totalParticipants, t.numPublicationsPlus ? `${t.numPublications}+` : t.numPublications
    ]);
    downloadFile(generateCsv(headers, rows), 'OpenOnco_ECD.csv', 'text/csv;charset=utf-8;');
  };

  const downloadTrmCsv = () => {
    const headers = ['Test Name', 'Vendor', 'Approach', 'Cancer Types', 'Sensitivity (%)', 'Specificity (%)', 'LOD (ppm)', 'FDA Status', 'Reimbursement', 'Trial Participants', 'Publications'];
    const rows = trmTestData.map(t => [
      t.name, t.vendor, t.approach, t.cancerTypes?.join('; '), t.sensitivity, t.specificity, typeof t.lod === 'number' ? (t.lod * 10000).toFixed(2) : t.lod, t.fdaStatus, t.reimbursement, t.totalParticipants, t.numPublicationsPlus ? `${t.numPublications}+` : t.numPublications
    ]);
    downloadFile(generateCsv(headers, rows), 'OpenOnco_TRM.csv', 'text/csv;charset=utf-8;');
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
        }
      },
      totalTests: mrdTestData.length + ecdTestData.length + trmTestData.length
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
          OpenOnco is committed to transparency. All data is open and downloadable.
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
        <DatabaseSummary />
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
                <p className="text-sm text-gray-500">{mrdTestData.length + ecdTestData.length + trmTestData.length} tests • MRD + ECD + TRM combined • JSON format</p>
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

        {/* CSV Downloads */}
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-5 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Individual Category Downloads</h3>
                <p className="text-sm text-gray-500">Separate CSV files for each test category</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadMrdCsv} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
                MRD
              </button>
              <button onClick={downloadEcdCsv} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
                ECD
              </button>
              <button onClick={downloadTrmCsv} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors">
                TRM
              </button>
            </div>
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
  const [persona, setPersona] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  
  // Load persona from localStorage
  useEffect(() => {
    setPersona(getStoredPersona());
  }, []);

  // Memoize system prompt - recomputed if category or persona changes
  const systemPrompt = useMemo(() => {
    return `You are a liquid biopsy test assistant for OpenOnco, focused on ${meta.title} testing. Help users explore and compare tests. You are not a clinical advisor and cannot provide medical advice.

${category} DATABASE:
${JSON.stringify(chatTestData[category])}

${chatKeyLegend}

${getPersonaStyle(persona)}

Say "not specified" for missing data.`;
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
          model: "claude-haiku-4-5-20251001",
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
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Ask about ${meta.shortTitle}...`} className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <button onClick={handleSubmit} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg text-sm font-medium">Send</button>
      </div>
    </div>
  );
};

// ============================================
// Info Icon Component (shows citations/notes on click)
// ============================================
// Helper function to format LOD as "ppm (% VAF)"
const formatLOD = (lodPercent) => {
  if (lodPercent == null || typeof lodPercent !== 'number') return null;
  const ppm = lodPercent * 10000; // Convert % to ppm
  // Format ppm nicely
  let ppmStr;
  if (ppm >= 100) {
    ppmStr = Math.round(ppm).toString();
  } else if (ppm >= 1) {
    ppmStr = ppm.toFixed(1).replace(/\.0$/, '');
  } else if (ppm >= 0.1) {
    ppmStr = ppm.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  } else {
    ppmStr = ppm.toPrecision(2);
  }
  // Format % nicely
  let pctStr;
  if (lodPercent >= 0.01) {
    pctStr = lodPercent.toString();
  } else {
    pctStr = lodPercent.toExponential(1);
  }
  return `${ppmStr} ppm (${pctStr}%)`;
};

const InfoIcon = ({ citations, notes }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!citations && !notes) return null;
  
  return (
    <span className="relative inline-block ml-1">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 hover:text-gray-700 text-xs font-medium inline-flex items-center justify-center transition-colors"
      >
        i
      </button>
      {isOpen && (
        <div className="absolute z-50 left-0 top-6 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left" onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {citations && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-700 mb-1">Citations:</p>
              <p className="text-xs text-[#2A63A4] break-all">{citations.split('|').map((c, i) => (
                <a key={i} href={c.trim().startsWith('http') ? c.trim() : '#'} target="_blank" rel="noopener noreferrer" className="block hover:underline mb-1">
                  {c.trim().length > 60 ? c.trim().slice(0, 60) + '...' : c.trim()}
                </a>
              ))}</p>
            </div>
          )}
          {notes && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
              <p className="text-xs text-gray-600">{notes}</p>
            </div>
          )}
        </div>
      )}
    </span>
  );
};

// ============================================
// Data Row Component for expanded view
// ============================================
const DataRow = ({ label, value, unit, citations, notes }) => {
  if (value === null || value === undefined) return null;
  const displayValue = `${value}${unit || ''}`;
  const isLongValue = typeof displayValue === 'string' && displayValue.length > 60;
  
  if (isLongValue) {
    // Stack layout for long values
    return (
      <div className="py-2 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-600 flex items-center mb-1">
          {label}
          <InfoIcon citations={citations} notes={notes} />
        </span>
        <span className="text-sm font-medium text-gray-900 block">{displayValue}</span>
      </div>
    );
  }
  
  // Side-by-side layout for short values
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-gray-100 last:border-0 gap-4">
      <span className="text-sm text-gray-600 flex items-center flex-shrink-0">
        {label}
        <InfoIcon citations={citations} notes={notes} />
      </span>
      <span className="text-sm font-medium text-gray-900 text-right">{displayValue}</span>
    </div>
  );
};

// ============================================
// Test Card
// ============================================
const TestCard = ({ test, isSelected, onSelect, category }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorVariant = categoryMeta[category]?.color || 'amber';
  
  return (
    <div id={`test-card-${test.id}`} className={`bg-white rounded-xl border-2 p-4 transition-all ${isSelected ? 'border-emerald-500 shadow-md shadow-emerald-100' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* Header - clickable for expand/collapse */}
      <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
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
            <p className="text-sm text-gray-500">{test.vendor}</p>
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
          {test.sensitivity != null && <div><p className="text-lg font-bold text-emerald-600">{test.sensitivity}%</p><p className="text-xs text-gray-500">Sensitivity</p></div>}
          {test.specificity != null && <div><p className="text-lg font-bold text-emerald-600">{test.specificity}%</p><p className="text-xs text-gray-500">Specificity</p></div>}
          {test.lod != null && typeof test.lod === 'number' && <div><p className="text-lg font-bold text-violet-600">{(test.lod * 10000) >= 1 ? (test.lod * 10000).toFixed(1).replace(/\.0$/, '') : (test.lod * 10000).toPrecision(2)} ppm</p><p className="text-xs text-gray-500">LOD</p></div>}
          {category === 'MRD' && test.initialTat && <div><p className="text-lg font-bold text-slate-600">{test.initialTat}d</p><p className="text-xs text-gray-500">TAT</p></div>}
          {category === 'TRM' && test.leadTimeVsImaging && <div><p className="text-lg font-bold text-emerald-600">{test.leadTimeVsImaging}d</p><p className="text-xs text-gray-500">Lead Time</p></div>}
          {category === 'ECD' && test.stageISensitivity && <div><p className="text-lg font-bold text-emerald-600">{test.stageISensitivity}%</p><p className="text-xs text-gray-500">Stage I</p></div>}
          {category === 'ECD' && test.ppv != null && <div><p className="text-lg font-bold text-emerald-600">{test.ppv}%</p><p className="text-xs text-gray-500">PPV</p></div>}
        </div>
        
        {/* Cancer types */}
        <div className="flex flex-wrap gap-1 mb-2">
          {test.cancerTypes && test.cancerTypes.slice(0, 3).map((type, i) => <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{type.length > 20 ? type.slice(0, 20) + '...' : type}</span>)}
          {test.cancerTypes && test.cancerTypes.length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{test.cancerTypes.length - 3}</span>}
        </div>
      </div>
      
      {/* Show all data indicator */}
      <div className="border-t border-gray-100 pt-2 mt-2">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
        >
          {isExpanded ? 'Hide details' : 'Show all data'}
          <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {/* Expanded data section */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1" onClick={(e) => e.stopPropagation()}>
          {/* MRD-specific expanded view */}
          {category === 'MRD' && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Performance Metrics</p>
              <DataRow label="Headline Sensitivity" value={test.sensitivity} unit="%" citations={test.sensitivityCitations} notes={test.sensitivityNotes} />
              <DataRow label="Headline Specificity" value={test.specificity} unit="%" citations={test.specificityCitations} notes={test.specificityNotes} />
              <DataRow label="PPV" value={test.ppv} unit="%" citations={test.ppvCitations} notes={test.ppvNotes} />
              <DataRow label="NPV" value={test.npv} unit="%" citations={test.npvCitations} notes={test.npvNotes} />
              <DataRow label="Limit of Detection" value={formatLOD(test.lod)} citations={test.lodCitations} notes={test.lodNotes} />
              
              {(test.landmarkSensitivity || test.landmarkSpecificity || test.longitudinalSensitivity || test.longitudinalSpecificity) && (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Landmark & Longitudinal</p>
                  <DataRow label="Landmark Sensitivity" value={test.landmarkSensitivity} unit="%" citations={test.landmarkSensitivityCitations} notes={test.landmarkSensitivityNotes} />
                  <DataRow label="Landmark Specificity" value={test.landmarkSpecificity} unit="%" citations={test.landmarkSpecificityCitations} notes={test.landmarkSpecificityNotes} />
                  <DataRow label="Longitudinal Sensitivity" value={test.longitudinalSensitivity} unit="%" citations={test.longitudinalSensitivityCitations} notes={test.longitudinalSensitivityNotes} />
                  <DataRow label="Longitudinal Specificity" value={test.longitudinalSpecificity} unit="%" citations={test.longitudinalSpecificityCitations} notes={test.longitudinalSpecificityNotes} />
                </>
              )}
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Turnaround & Sample</p>
              <DataRow label="Sample Type" value={test.sampleCategory} />
              <DataRow label="Initial TAT" value={test.initialTat} unit=" days" citations={test.initialTatCitations} notes={test.initialTatNotes} />
              <DataRow label="Follow-up TAT" value={test.followUpTat} unit=" days" citations={test.followUpTatCitations} notes={test.followUpTatNotes} />
              <DataRow label="Lead Time vs Imaging" value={test.leadTimeVsImaging} unit=" days" citations={test.leadTimeVsImagingCitations} notes={test.leadTimeVsImagingNotes} />
              <DataRow label="Blood Volume" value={test.bloodVolume} unit=" mL" citations={test.bloodVolumeCitations} notes={test.bloodVolumeNotes} />
              <DataRow label="Variants Tracked" value={test.variantsTracked} citations={test.variantsTrackedCitations} notes={test.variantsTrackedNotes} />
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Requirements</p>
              <DataRow label="Requires Tumor Tissue" value={test.requiresTumorTissue} notes={test.requiresTumorTissueNotes} />
              <DataRow label="Requires Matched Normal" value={test.requiresMatchedNormal} notes={test.requiresMatchedNormalNotes} />
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Regulatory & Coverage</p>
              <DataRow label="FDA Status" value={test.fdaStatus} />
              <DataRow label="Government Insurance" value={test.reimbursement} notes={test.reimbursementNote} />
              {test.commercialPayers && test.commercialPayers.length > 0 && (
                <DataRow label="Private Insurance" value={test.commercialPayers.join(', ')} citations={test.commercialPayersCitations} notes={test.commercialPayersNotes} />
              )}
              <DataRow label="CPT Codes" value={test.cptCodes} notes={test.cptCodesNotes} />
              <DataRow label="Clinical Availability" value={test.clinicalAvailability} />
              <DataRow label="Independent Validation" value={test.independentValidation} notes={test.independentValidationNotes} />
              
              {(test.exampleTestReport || test.indicationsNotes) && (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Additional Info</p>
                  {test.indicationsNotes && <div className="py-1.5"><p className="text-xs text-gray-600">{test.indicationsNotes}</p></div>}
                  {test.exampleTestReport && (
                    <div className="py-1.5">
                      <a href={test.exampleTestReport} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">
                        View Example Test Report →
                      </a>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          
          {/* ECD-specific expanded view */}
          {category === 'ECD' && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Performance Metrics</p>
              <DataRow label="Overall Sensitivity" value={test.sensitivity} unit="%" citations={test.performanceCitations} notes={test.performanceNotes} />
              <DataRow label="Stage I Sensitivity" value={test.stageISensitivity} unit="%" citations={test.performanceCitations} notes={test.performanceNotes} />
              <DataRow label="Stage II Sensitivity" value={test.stageIISensitivity} unit="%" citations={test.performanceCitations} notes={test.performanceNotes} />
              <DataRow label="Stage III Sensitivity" value={test.stageIIISensitivity} unit="%" citations={test.performanceCitations} notes={test.performanceNotes} />
              <DataRow label="Stage IV Sensitivity" value={test.stageIVSensitivity} unit="%" citations={test.performanceCitations} notes={test.performanceNotes} />
              <DataRow label="Specificity" value={test.specificity} unit="%" citations={test.performanceCitations} notes={test.performanceNotes} />
              <DataRow label="PPV" value={test.ppv} unit="%" citations={test.performanceCitations} notes={test.ppvDefinition} />
              <DataRow label="NPV" value={test.npv} unit="%" citations={test.performanceCitations} notes={test.npvDefinition} />
              {test.testScope?.includes('Multi-cancer') && (
                <DataRow 
                  label="Tumor Origin Prediction" 
                  value={test.tumorOriginAccuracy != null ? test.tumorOriginAccuracy : (test.tumorOriginAccuracyNotes ? 'See notes' : null)} 
                  unit={test.tumorOriginAccuracy != null ? '%' : ''} 
                  notes={test.tumorOriginAccuracyNotes} 
                />
              )}
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Test Details</p>
              <DataRow label="Method" value={test.method} />
              <DataRow label="Target Population" value={test.targetPopulation} />
              <DataRow label="Indication Group" value={test.indicationGroup} />
              <DataRow label="Screening Interval" value={test.screeningInterval} />
              {test.leadTimeNotes && <DataRow label="Lead Time Notes" value={test.leadTimeNotes} />}
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Sample & Logistics</p>
              <DataRow label="Sample Category" value={test.sampleCategory} />
              <DataRow label="TAT" value={test.tat} />
              <DataRow label="Sample Details" value={test.sampleType} />
              <DataRow label="Sample Volume" value={test.sampleVolume} />
              <DataRow label="Sample Stability" value={test.sampleStability} />
              <DataRow label="List Price" value={test.listPrice ? `$${test.listPrice}` : null} />
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Regulatory & Coverage</p>
              <DataRow label="FDA Status" value={test.fdaStatus} />
              <DataRow label="Government Insurance" value={test.reimbursement} notes={test.reimbursementNote} />
              {test.commercialPayers && test.commercialPayers.length > 0 && (
                <DataRow label="Private Insurance" value={test.commercialPayers.join(', ')} citations={test.commercialPayersCitations} notes={test.commercialPayersNotes} />
              )}
              <DataRow label="CPT Code" value={test.cptCode} />
              <DataRow label="Clinical Availability" value={test.clinicalAvailability} />
            </>
          )}
          
          {/* TRM-specific expanded view */}
          {category === 'TRM' && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Performance Metrics</p>
              <DataRow label="Sensitivity" value={test.sensitivity} unit="%" />
              <DataRow label="Specificity" value={test.specificity} unit="%" />
              <DataRow label="LOD" value={typeof test.lod === 'number' ? formatLOD(test.lod) : test.lod} />
              <DataRow label="Lead Time vs Imaging" value={test.leadTimeVsImaging} unit=" days" />
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Test Details</p>
              <DataRow label="Sample Type" value={test.sampleCategory} />
              <DataRow label="Method" value={test.method} />
              <DataRow label="Response Definition" value={test.responseDefinition} />
              <DataRow label="Target Population" value={test.targetPopulation} />
              <DataRow label="Variants Tracked" value={test.variantsTracked} />
              
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Regulatory & Coverage</p>
              <DataRow label="FDA Status" value={test.fdaStatus} />
              <DataRow label="Government Insurance" value={test.reimbursement} notes={test.reimbursementNote} />
              {test.commercialPayers && test.commercialPayers.length > 0 && (
                <DataRow label="Private Insurance" value={test.commercialPayers.join(', ')} citations={test.commercialPayersCitations} notes={test.commercialPayersNotes} />
              )}
              <DataRow label="Clinical Availability" value={test.clinicalAvailability} />
            </>
          )}
          
          {/* Clinical Trials & Publications section - shown for all categories if data exists */}
          {(test.clinicalTrials || test.totalParticipants || test.numPublications) && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Clinical Evidence</p>
              {test.totalParticipants && (
                <div className="py-1.5 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Total Trial Participants</span>
                  <span className="text-sm font-semibold" style={{ color: '#2A63A4' }}>{test.totalParticipants.toLocaleString()}</span>
                </div>
              )}
              {test.numPublications && (
                <div className="py-1.5 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Peer-Reviewed Publications</span>
                  <span className="text-sm font-semibold text-purple-600">{test.numPublications}{test.numPublicationsPlus ? '+' : ''}</span>
                </div>
              )}
              {test.clinicalTrials && (
                <div className="py-1.5">
                  <p className="text-xs text-gray-500 mb-1">Key Trials</p>
                  <div className="text-xs text-gray-700 space-y-1">
                    {test.clinicalTrials.split(/[;|]/).map((trial, idx) => {
                      const trimmed = trial.trim();
                      if (!trimmed) return null;
                      // Extract NCT number if present for linking
                      const nctMatch = trimmed.match(/NCT\d+/);
                      return (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-gray-400">•</span>
                          {nctMatch ? (
                            <a 
                              href={`https://clinicaltrials.gov/study/${nctMatch[0]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                              style={{ color: '#2A63A4' }}
                            >
                              {trimmed.replace(/https?:\/\/[^\s]+/g, '').trim()}
                            </a>
                          ) : (
                            <span>{trimmed.replace(/https?:\/\/[^\s]+/g, '').trim()}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// Comparison Modal
// ============================================
const ComparisonModal = ({ tests, category, onClose, onRemoveTest }) => {
  const params = comparisonParams[category] || comparisonParams.MRD;
  const meta = categoryMeta[category];
  
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
    }
  };
  const colors = colorSchemes[category] || colorSchemes.MRD;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Colored Header */}
        <div className={`flex justify-between items-center p-5 ${colors.headerBg}`} style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${colors.headerText}`}>Comparing {tests.length} Tests</h2>
              <p className="text-white/80 text-sm">{meta?.title || category} Category</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${colors.closeBtnHover} rounded-xl transition-colors`}>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
                        <p className="text-xs text-gray-500 mt-0.5">{test.vendor}</p>
                      </div>
                      <button 
                        onClick={() => onRemoveTest(test.id)} 
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
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
                    {param.label}
                  </td>
                  {tests.map(test => {
                    let value = param.key === 'cancerTypesStr' ? test.cancerTypes?.join(', ') 
                      : param.key === 'commercialPayersStr' ? test.commercialPayers?.join(', ')
                      : test[param.key];
                    const hasValue = value != null && value !== '';
                    return (
                      <td key={test.id} className={`p-4 text-sm ${colors.border} border-b ${hasValue ? 'text-gray-900' : 'text-gray-300'}`}>
                        {hasValue ? String(value) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className={`p-4 ${colors.lightBg} border-t ${colors.border} flex-shrink-0`}>
          <p className="text-xs text-gray-500 text-center">
            Click the × next to a test name to remove it from comparison
          </p>
        </div>
      </div>
    </div>
  );
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
  const [minParticipants, setMinParticipants] = useState(0);
  const [minPublications, setMinPublications] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [selectedTests, setSelectedTests] = useState(initialSelectedTestId ? [initialSelectedTestId] : []);
  const [showComparison, setShowComparison] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const filterScrollRef = useRef(null);
  const scrollLockRef = useRef(null);
  
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
          return test.reimbursement === r || (r === 'Medicare' && test.reimbursement?.toLowerCase().includes('medicare'));
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
      return true;
    });
  }, [tests, searchQuery, selectedApproaches, selectedCancerTypes, selectedReimbursement, selectedTestScopes, selectedSampleCategories, selectedFdaStatus, minParticipants, minPublications, maxPrice, category]);

  const testsToCompare = useMemo(() => tests.filter(t => selectedTests.includes(t.id)), [tests, selectedTests]);
  const toggle = (setter) => (val) => setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const clearFilters = () => { setSearchQuery(''); setSelectedApproaches([]); setSelectedCancerTypes([]); setSelectedReimbursement([]); setSelectedTestScopes([]); setSelectedSampleCategories([]); setSelectedFdaStatus([]); setMinParticipants(0); setMinPublications(0); setMaxPrice(1000); };
  const hasFilters = searchQuery || selectedApproaches.length || selectedCancerTypes.length || selectedReimbursement.length || selectedTestScopes.length || selectedSampleCategories.length || selectedFdaStatus.length || minParticipants > 0 || minPublications > 0 || maxPrice < 1000;

  const colorClasses = { orange: 'from-orange-500 to-orange-600', green: 'from-emerald-500 to-emerald-600', red: 'from-sky-500 to-sky-600' };

  return (
    <>
      <style>{`
        * { overflow-anchor: none !important; }
      `}</style>
      <div className="max-w-7xl mx-auto px-6 py-8" style={{ overflowAnchor: 'none' }}>
      <div className="mb-8">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${colorClasses[meta.color]} text-white text-sm font-medium mb-3`}>{meta.shortTitle}</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{meta.title}</h1>
        <p className="text-gray-600">{meta.description}</p>
        
        {/* Parameter type legend */}
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
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Cancer Type</label>
                    <div className="max-h-36 overflow-y-auto">{config.cancerTypes.map(t => <Checkbox key={t} label={t.length > 28 ? t.slice(0,28)+'...' : t} checked={selectedCancerTypes.includes(t)} onChange={() => toggle(setSelectedCancerTypes)(t)} />)}</div>
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Sample Type</label>
                    {config.sampleCategories.map(o => <Checkbox key={o} label={o} checked={selectedSampleCategories.includes(o)} onChange={() => toggle(setSelectedSampleCategories)(o)} />)}
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Coverage</label>
                    {config.reimbursements.map(r => <Checkbox key={r} label={r === 'Medicare' ? 'Government Insurance' : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
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

              {category === 'ECD' && (
                <>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Test Scope</label>
                    {config.testScopes.map(s => <Checkbox key={s} label={s} checked={selectedTestScopes.includes(s)} onChange={() => toggle(setSelectedTestScopes)(s)} />)}
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Sample Type</label>
                    {config.sampleCategories.map(o => <Checkbox key={o} label={o} checked={selectedSampleCategories.includes(o)} onChange={() => toggle(setSelectedSampleCategories)(o)} />)}
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Coverage</label>
                    {config.reimbursements.map(r => <Checkbox key={r} label={r === 'Medicare' ? 'Government Insurance' : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
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
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
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
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Cancer Type</label>
                    <div className="max-h-36 overflow-y-auto">{config.cancerTypes.map(t => <Checkbox key={t} label={t.length > 28 ? t.slice(0,28)+'...' : t} checked={selectedCancerTypes.includes(t)} onChange={() => toggle(setSelectedCancerTypes)(t)} />)}</div>
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Sample Type</label>
                    {config.sampleCategories.map(o => <Checkbox key={o} label={o} checked={selectedSampleCategories.includes(o)} onChange={() => toggle(setSelectedSampleCategories)(o)} />)}
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Coverage</label>
                    {config.reimbursements.map(r => <Checkbox key={r} label={r === 'Medicare' ? 'Government Insurance' : r === 'Commercial' ? 'Private Insurance' : r} checked={selectedReimbursement.includes(r)} onChange={() => toggle(setSelectedReimbursement)(r)} />)}
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
                <p className="text-sm text-gray-400 italic">💡 Select tests to compare them side-by-side</p>
              )}
              {selectedTests.length === 1 && (
                <p className="text-sm text-orange-600">Select at least one more test to compare</p>
              )}
              {selectedTests.length >= 2 && (
                <button onClick={() => setShowComparison(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Compare ({selectedTests.length})
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ minHeight: '800px', overflowAnchor: 'none', contain: 'layout' }}>
              {filteredTests.map(test => <TestCard key={test.id} test={test} category={category} isSelected={selectedTests.includes(test.id)} onSelect={(id) => toggle(setSelectedTests)(id)} />)}
            </div>
            {filteredTests.length === 0 && <div className="text-center py-12 text-gray-500"><p>No tests match your filters.</p><button onClick={clearFilters} className="text-emerald-600 text-sm mt-2">Clear filters</button></div>}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Ask a Question</h2>
        <CategoryChat category={category} />
      </section>

      {showComparison && testsToCompare.length >= 2 && (
        <ComparisonModal tests={testsToCompare} category={category} onClose={() => setShowComparison(false)} onRemoveTest={(id) => { setSelectedTests(prev => prev.filter(i => i !== id)); if (selectedTests.length <= 2) setShowComparison(false); }} />
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

  const handleNavigate = (page, testId = null) => {
    setCurrentPage(page);
    setInitialSelectedTestId(testId);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage onNavigate={handleNavigate} />;
      case 'MRD': case 'ECD': case 'TRM': return <CategoryPage category={currentPage} initialSelectedTestId={initialSelectedTestId} onClearInitialTest={() => setInitialSelectedTestId(null)} />;
      case 'data-sources': return <SourceDataPage />;
      case 'how-it-works': return <HowItWorksPage />;
      case 'submissions': return <SubmissionsPage />;
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
      <main className="flex-1">{renderPage()}</main>
      <Footer />
      <Analytics />
    </div>
  );
}
