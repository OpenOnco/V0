/**
 * MRD Compendium — Premium physician chat interface
 * Evidence-based MRD clinical decision support tool
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────

const CHAT_MODELS = [
  { id: 'claude-haiku-4-5-20251001', name: 'More speed' },
  { id: 'claude-sonnet-4-5-20250929', name: 'More thinking' },
];

const CANCER_TYPES = [
  { value: '', label: 'Select cancer type' },
  { value: 'Colorectal', label: 'Colorectal' },
  { value: 'Breast', label: 'Breast' },
  { value: 'Lung NSCLC', label: 'Lung (NSCLC)' },
  { value: 'Bladder', label: 'Bladder' },
  { value: 'Pancreatic', label: 'Pancreatic' },
  { value: 'Melanoma', label: 'Melanoma' },
  { value: 'Ovarian', label: 'Ovarian' },
  { value: 'Prostate', label: 'Prostate' },
  { value: 'Other', label: 'Other' },
];

const STAGES = [
  { value: '', label: 'Select stage' },
  { value: 'I', label: 'Stage I' },
  { value: 'II', label: 'Stage II' },
  { value: 'III', label: 'Stage III' },
  { value: 'IV', label: 'Stage IV' },
];

const CLINICAL_SETTINGS = [
  { value: '', label: 'Select setting' },
  { value: 'Post-surgery', label: 'Post-surgery' },
  { value: 'Surveillance', label: 'Surveillance' },
  { value: 'During adjuvant', label: 'During adjuvant therapy' },
  { value: 'Post-adjuvant', label: 'Post-adjuvant' },
  { value: 'Recurrence', label: 'Recurrence' },
  { value: 'Metastatic', label: 'Metastatic' },
];

const MRD_RESULTS = [
  { value: '', label: 'Select MRD result' },
  { value: 'Not yet tested', label: 'Not yet tested' },
  { value: 'Positive', label: 'Positive' },
  { value: 'Negative', label: 'Negative' },
  { value: 'Indeterminate', label: 'Indeterminate' },
];

const MRD_TESTS = [
  { value: '', label: 'Select test used' },
  { value: 'Signatera', label: 'Signatera (Natera)' },
  { value: 'Guardant Reveal', label: 'Guardant Reveal' },
  { value: 'Oncodetect', label: 'Oncodetect (Exact Sciences)' },
  { value: 'clonoSEQ', label: 'clonoSEQ (Adaptive)' },
  { value: 'RaDaR', label: 'RaDaR (NeoGenomics)' },
  { value: 'Other', label: 'Other' },
  { value: 'Not sure', label: 'Not sure' },
];

const MAX_INPUT_LENGTH = 2000;
const MAX_MESSAGES = 10;

// ─── Evidence Badge Definitions ─────────────────────────────────────────────

const EVIDENCE_TAG_PATTERNS = [
  { pattern: /\[RCT\]/gi, label: 'RCT', color: 'bg-green-100 text-green-800 border-green-200' },
  { pattern: /\[Prospective\]/gi, label: 'Prospective', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { pattern: /\[Retrospective\]/gi, label: 'Retrospective', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { pattern: /\[Consensus\]/gi, label: 'Consensus', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { pattern: /\[Conference\]/gi, label: 'Conference Abstract', color: 'bg-purple-100 text-purple-800 border-purple-200' },
];

const EVIDENCE_INLINE_PATTERNS = [
  { pattern: /\brandomized\s+(?:controlled\s+)?trial\b/gi, label: 'RCT', color: 'bg-green-100 text-green-800 border-green-200' },
  { pattern: /\bprospective\s+(?:cohort\s+)?(?:trial|study)\b/gi, label: 'Prospective', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { pattern: /\bretrospective\s+(?:cohort\s+)?(?:study|analysis|review)\b/gi, label: 'Retrospective', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { pattern: /\b(?:expert\s+)?consensus\b/gi, label: 'Consensus', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { pattern: /\bguidelines?\b/gi, label: 'Consensus', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { pattern: /\bconference\s+abstract\b/gi, label: 'Conference Abstract', color: 'bg-purple-100 text-purple-800 border-purple-200' },
];

// ─── Suggestion Engine ──────────────────────────────────────────────────────

function getSuggestions({ cancerType, stage, clinicalSetting, mrdResult }) {
  // Level 0: No context at all
  if (!mrdResult && !cancerType) {
    return [
      'My patient has a positive MRD result — what are the next steps?',
      'My patient has a negative MRD result — can I de-escalate therapy?',
      'Help me choose an MRD test for my patient',
      'What is the current evidence for ctDNA-guided treatment decisions?',
    ];
  }

  // MRD positive, no cancer type
  if (mrdResult === 'Positive' && !cancerType) {
    return [
      'What treatment escalation options exist for MRD-positive patients?',
      'When should I retest after a positive MRD result?',
      'What does evidence say about intervention at molecular relapse?',
      'How does MRD positivity management vary by cancer type?',
    ];
  }

  // MRD negative, no cancer type
  if (mrdResult === 'Negative' && !cancerType) {
    return [
      'Can I safely de-escalate adjuvant therapy with negative MRD?',
      'What is the negative predictive value across assays?',
      'How often should I retest if MRD remains negative?',
      'What does CIRCULATE-Japan tell us about ctDNA-negative patients?',
    ];
  }

  // Cancer type set — disease-specific suggestions
  const suggestions = [];
  if (cancerType === 'Colorectal') {
    suggestions.push(
      `What does DYNAMIC-III show for stage ${stage || 'II/III'} CRC?`,
      'Compare ctDNA-guided vs standard adjuvant in CRC',
      'What is the optimal ctDNA testing schedule for CRC surveillance?',
    );
  } else if (cancerType === 'Breast') {
    suggestions.push(
      'What is the evidence for ctDNA in early-stage breast cancer?',
      'How does molecular subtype affect ctDNA detection in breast cancer?',
      'Compare Signatera vs Guardant Reveal in breast cancer MRD',
    );
  } else if (cancerType === 'Lung NSCLC') {
    suggestions.push(
      'What role does ctDNA play in stage III NSCLC after chemoradiation?',
      'How does ctDNA clearance correlate with immunotherapy response?',
      'What is the lead time of ctDNA positivity before radiographic recurrence?',
    );
  } else if (cancerType) {
    suggestions.push(
      `What MRD evidence exists specifically for ${cancerType.toLowerCase()} cancer?`,
      `Which assays have the strongest validation in ${cancerType.toLowerCase()}?`,
      `What clinical trials are investigating ctDNA-guided therapy in ${cancerType.toLowerCase()}?`,
    );
  }

  if (clinicalSetting === 'Post-surgery') {
    suggestions.push('What is the optimal timing for post-operative ctDNA testing?');
  } else if (clinicalSetting === 'During adjuvant') {
    suggestions.push('How should I interpret ctDNA dynamics during adjuvant therapy?');
  } else if (clinicalSetting === 'Surveillance') {
    suggestions.push('What surveillance interval is recommended for ctDNA monitoring?');
  }

  return suggestions.slice(0, 4);
}

// ─── Inline Markdown Renderer with Evidence Badges & Citations ──────────────

function CompendiumMarkdown({ text, onTestClick }) {
  const rendered = useMemo(() => {
    if (!text) return null;
    return renderMarkdown(text, onTestClick);
  }, [text, onTestClick]);

  return <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed">{rendered}</div>;
}

function renderMarkdown(text, onTestClick) {
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;
  let tableRows = [];
  let inTable = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    const cls = listType === 'ol' ? 'list-decimal' : 'list-disc';
    elements.push(
      <Tag key={`list-${elements.length}`} className={`${cls} list-inside my-2 space-y-1`}>
        {listItems.map((item, i) => <li key={i} className="text-sm">{renderInline(item, onTestClick)}</li>)}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const headers = tableRows[0];
    const dataRows = tableRows.slice(1).filter(r => !r.every(c => /^[-|:\s]+$/.test(c)));
    elements.push(
      <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">
                  {renderInline(h.trim(), onTestClick)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-600 border-b border-slate-100">
                    {renderInline(cell.trim(), onTestClick)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) { flushList(); inTable = true; }
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      tableRows.push(cells);
      continue;
    }
    if (inTable) flushTable();

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={`h4-${i}`} className="text-sm font-semibold text-slate-900 mt-4 mb-1">{renderInline(line.slice(4), onTestClick)}</h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={`h3-${i}`} className="text-base font-semibold text-slate-900 mt-4 mb-2">{renderInline(line.slice(3), onTestClick)}</h3>);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={`h2-${i}`} className="text-lg font-bold text-slate-900 mt-4 mb-2">{renderInline(line.slice(2), onTestClick)}</h2>);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[\s]*[-*]\s+(.*)/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^[\s]*\d+\.\s+(.*)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();
    if (line.trim() === '') continue;

    // Paragraph
    elements.push(<p key={`p-${i}`} className="my-2 text-sm">{renderInline(line, onTestClick)}</p>);
  }

  flushList();
  flushTable();
  return elements;
}

function renderInline(text, onTestClick) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let earliest = null;
    let earliestIdx = Infinity;
    let earliestType = null;

    // Evidence tag badges: [RCT], [Prospective], etc.
    for (const ep of EVIDENCE_TAG_PATTERNS) {
      ep.pattern.lastIndex = 0;
      const m = ep.pattern.exec(remaining);
      if (m && m.index < earliestIdx) {
        earliest = m; earliestIdx = m.index;
        earliestType = { kind: 'badge', label: ep.label, color: ep.color };
      }
    }

    // Bold **text**
    const boldMatch = /\*\*(.+?)\*\*/.exec(remaining);
    if (boldMatch && boldMatch.index < earliestIdx) {
      earliest = boldMatch; earliestIdx = boldMatch.index;
      earliestType = { kind: 'bold' };
    }

    // Markdown links [text](url)
    const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(remaining);
    if (linkMatch && linkMatch.index < earliestIdx) {
      earliest = linkMatch; earliestIdx = linkMatch.index;
      earliestType = { kind: 'link' };
    }

    // Test ID links [[test-id]]
    const testMatch = /\[\[([a-z]+-\d+)\]\]/.exec(remaining);
    if (testMatch && testMatch.index < earliestIdx) {
      earliest = testMatch; earliestIdx = testMatch.index;
      earliestType = { kind: 'testlink' };
    }

    if (!earliest) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (earliestIdx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, earliestIdx)}</span>);
    }

    if (earliestType.kind === 'badge') {
      parts.push(
        <span key={key++} className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 text-xs font-medium rounded border ${earliestType.color}`}>
          {earliestType.label}
        </span>
      );
    } else if (earliestType.kind === 'bold') {
      parts.push(<strong key={key++} className="font-semibold text-slate-900">{earliest[1]}</strong>);
    } else if (earliestType.kind === 'link') {
      parts.push(<CitationLink key={key++} text={earliest[1]} url={earliest[2]} />);
    } else if (earliestType.kind === 'testlink') {
      if (onTestClick) {
        parts.push(
          <button key={key++} onClick={() => onTestClick([earliest[1]])} className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 underline decoration-amber-300 font-medium" title="View test details">
            {earliest[1]}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>
        );
      } else {
        parts.push(<span key={key++} className="font-medium text-amber-700">{earliest[1]}</span>);
      }
    }

    remaining = remaining.slice(earliestIdx + earliest[0].length);
  }

  return parts;
}

// ─── Citation Card ──────────────────────────────────────────────────────────

function CitationLink({ text, url }) {
  const [expanded, setExpanded] = useState(false);

  const authorYearMatch = text.match(/^(.+?)\s+(\d{4})$/);
  const author = authorYearMatch ? authorYearMatch[1] : text;
  const year = authorYearMatch ? authorYearMatch[2] : null;

  const journal = useMemo(() => {
    if (!url) return null;
    if (url.includes('nejm.org')) return 'NEJM';
    if (url.includes('thelancet.com') || url.includes('lancet')) return 'Lancet';
    if (url.includes('jama')) return 'JAMA';
    if (url.includes('jco.ascopubs.org') || url.includes('ascopubs')) return 'JCO';
    if (url.includes('nature.com')) return 'Nature';
    if (url.includes('aacrjournals.org')) return 'AACR';
    if (url.includes('annalsofoncology')) return 'Ann Oncol';
    if (url.includes('pubmed') || url.includes('ncbi.nlm.nih.gov')) return 'PubMed';
    if (url.includes('doi.org')) return 'DOI';
    return null;
  }, [url]);

  return (
    <span className="inline-block relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 underline decoration-blue-200 hover:decoration-blue-400 transition-colors"
      >
        {text}
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <span className="block mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm text-xs not-italic">
          <span className="flex items-start justify-between gap-2">
            <span>
              <span className="font-semibold text-slate-900 block">{author}</span>
              {year && <span className="text-slate-500">{year}</span>}
              {journal && (
                <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">
                  {journal}
                </span>
              )}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              title="Open source"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </span>
        </span>
      )}
    </span>
  );
}

// ─── Typing Indicator (shimmer bar) ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start mt-3">
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 max-w-[280px] w-full">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 rounded-full animate-shimmer" />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">Analyzing...</span>
        </div>
      </div>
    </div>
  );
}

// ─── Evidence Summary Footer ────────────────────────────────────────────────

const EVIDENCE_COLOR_MAP = {
  'RCT': 'bg-green-100 text-green-800 border-green-200',
  'Prospective': 'bg-blue-100 text-blue-800 border-blue-200',
  'Retrospective': 'bg-amber-100 text-amber-800 border-amber-200',
  'Consensus': 'bg-slate-100 text-slate-700 border-slate-200',
  'Conference Abstract': 'bg-purple-100 text-purple-800 border-purple-200',
};

function EvidenceSummary({ text }) {
  const badges = useMemo(() => {
    const found = new Set();
    for (const ep of EVIDENCE_TAG_PATTERNS) {
      ep.pattern.lastIndex = 0;
      if (ep.pattern.test(text)) found.add(ep.label);
    }
    for (const ep of EVIDENCE_INLINE_PATTERNS) {
      ep.pattern.lastIndex = 0;
      if (ep.pattern.test(text)) found.add(ep.label);
    }
    return [...found];
  }, [text]);

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100">
      <span className="text-xs text-slate-400 mr-1">Evidence:</span>
      {badges.map(b => (
        <span key={b} className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded border ${EVIDENCE_COLOR_MAP[b] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {b}
        </span>
      ))}
    </div>
  );
}

// ─── Context Field ──────────────────────────────────────────────────────────

function ContextField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-shadow ${
          value ? 'border-amber-300 bg-amber-50/30 text-slate-800' : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MRDCompendium({ testData = {}, className = '', onViewTests = null }) {
  // ── Chat state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);

  // ── Patient context ───────────────────────────────────────────────────
  const [cancerType, setCancerType] = useState('');
  const [stage, setStage] = useState('');
  const [clinicalSetting, setClinicalSetting] = useState('');
  const [mrdResult, setMrdResult] = useState('');
  const [testUsed, setTestUsed] = useState('');
  const [contextOpen, setContextOpen] = useState(true);

  // ── LLM-generated follow-up suggestions ───────────────────────────────
  const [llmSuggestions, setLlmSuggestions] = useState([]);

  // ── Refs ───────────────────────────────────────────────────────────────
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const userHasScrolledUp = useRef(false);

  // ── Derived values ────────────────────────────────────────────────────

  const context = useMemo(
    () => ({ cancerType, stage, clinicalSetting, mrdResult, testUsed }),
    [cancerType, stage, clinicalSetting, mrdResult, testUsed]
  );

  const hasContext = cancerType || stage || clinicalSetting || mrdResult || testUsed;

  const contextPrefix = useMemo(() => {
    const parts = [];
    if (cancerType) parts.push(cancerType);
    if (stage) parts.push(`Stage ${stage}`);
    if (clinicalSetting) parts.push(clinicalSetting);
    if (mrdResult) parts.push(`MRD ${mrdResult}`);
    if (testUsed) parts.push(testUsed);
    return parts.length > 0 ? `[Context: ${parts.join(', ')}] ` : '';
  }, [cancerType, stage, clinicalSetting, mrdResult, testUsed]);

  const staticSuggestions = useMemo(() => getSuggestions(context), [context]);

  const allSuggestions = useMemo(() => {
    const combined = [...staticSuggestions];
    for (const s of llmSuggestions) {
      if (!combined.some(c => c.toLowerCase() === s.toLowerCase())) {
        combined.push(s);
      }
    }
    return combined.slice(0, 6);
  }, [staticSuggestions, llmSuggestions]);

  const contextChips = useMemo(() => {
    return [
      cancerType,
      stage && `Stage ${stage}`,
      clinicalSetting,
      mrdResult && `MRD: ${mrdResult}`,
      testUsed,
    ].filter(Boolean);
  }, [cancerType, stage, clinicalSetting, mrdResult, testUsed]);

  // ── Auto-scroll ───────────────────────────────────────────────────────

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      userHasScrolledUp.current = scrollHeight - scrollTop - clientHeight > 80;
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!userHasScrolledUp.current && chatContainerRef.current) {
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isLoading]);

  // ── Fetch follow-up suggestions (background, fire-and-forget) ─────────

  const fetchFollowups = useCallback(async (conversationMessages) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'MRD',
          persona: 'medical',
          testData: typeof testData === 'string' ? testData : JSON.stringify(testData),
          model: 'claude-haiku-4-5-20251001',
          messages: [
            ...conversationMessages.slice(-4),
            {
              role: 'user',
              content: 'Based on this conversation, suggest 3 brief follow-up questions a physician would ask next about MRD testing. Return ONLY a JSON array of strings, nothing else.',
            },
          ],
        }),
      });
      const data = await response.json();
      const text = data?.content?.[0]?.text;
      if (text) {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            setLlmSuggestions(parsed.filter(s => typeof s === 'string').slice(0, 3));
          }
        }
      }
    } catch {
      // Suggestions are supplementary — silent failure is acceptable
    }
  }, [testData]);

  // ── Submit handler ────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (questionOverride) => {
    const question = (questionOverride || input).trim();
    if (!question || isLoading) return;

    if (!questionOverride) setInput('');

    const fullMessage = contextPrefix + question;
    const userMessage = { role: 'user', content: fullMessage, displayContent: question };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
    setLlmSuggestions([]);

    const apiMessages = updatedMessages.slice(-MAX_MESSAGES).map(m => ({
      role: m.role,
      content: m.content,
    }));

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          category: 'MRD',
          persona: 'medical',
          testData: typeof testData === 'string' ? testData : JSON.stringify(testData),
          messages: apiMessages,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const assistantText = data?.content?.[0]?.text;

      if (assistantText) {
        const assistantMessage = { role: 'assistant', content: assistantText };
        const withResponse = [...updatedMessages, assistantMessage];
        setMessages(withResponse);
        fetchFollowups(withResponse.map(m => ({ role: m.role, content: m.content })));
      } else {
        throw new Error('No response received');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `I apologize, but I encountered an error: ${err.message}. Please try again.` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, contextPrefix, testData, selectedModel, fetchFollowups]);

  // ── Keyboard handling ─────────────────────────────────────────────────

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setMessages([]);
    setInput('');
    setLlmSuggestions([]);
    setIsLoading(false);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  // ── Print / Export ────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const contextSummary = [cancerType, stage && `Stage ${stage}`, clinicalSetting, mrdResult && `MRD ${mrdResult}`, testUsed]
      .filter(Boolean).join(' | ');

    const messagesHtml = messages.map(m => {
      const label = m.role === 'user' ? 'Physician' : 'MRD Compendium';
      const bgColor = m.role === 'user' ? '#f8f5f0' : '#ffffff';
      const content = (m.displayContent || m.content).replace(/\n/g, '<br/>');
      return `<div style="margin-bottom:16px;padding:12px 16px;background:${bgColor};border-radius:8px;border:1px solid #e2e8f0;">
        <div style="font-weight:600;font-size:12px;color:#64748b;margin-bottom:6px;">${label}</div>
        <div style="font-size:14px;line-height:1.6;color:#1e293b;">${content}</div>
      </div>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>MRD Compendium</title>
      <style>body{font-family:-apple-system,system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1e293b;}
      .header{border-bottom:2px solid #d97706;padding-bottom:16px;margin-bottom:24px;}
      .disclaimer{margin-top:24px;padding:12px;background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;font-size:12px;color:#92400e;}
      @media print{body{margin:20px;}}</style></head>
      <body>
        <div class="header">
          <h1 style="font-size:20px;margin:0;">MRD Compendium</h1>
          ${contextSummary ? `<p style="font-size:13px;color:#64748b;margin:4px 0 0;">${contextSummary}</p>` : ''}
          <p style="font-size:12px;color:#94a3b8;margin:4px 0 0;">${new Date().toLocaleDateString()}</p>
        </div>
        ${messagesHtml}
        <div class="disclaimer">Reference compendium only. Clinical decisions remain with the treating physician. All findings should be independently verified.</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.print();
  }, [messages, cancerType, stage, clinicalSetting, mrdResult, testUsed]);

  // ── Cleanup on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inject serif font + animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap');
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-shimmer { animation: shimmer 1.8s ease-in-out infinite; width: 50%; }
        .compendium-msg-enter { animation: compendiumMsgIn 0.3s ease-out forwards; }
        @keyframes compendiumMsgIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className={`flex flex-col bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden ${className}`}>

        {/* ════════════════ Header ════════════════ */}
        <div className="bg-slate-900 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            {/* Left: branding */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.466.89 6.064 2.346m0-14.304a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.346m0-14.304v14.304" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                  MRD Compendium
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Evidence-based MRD clinical reference</p>
              </div>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              >
                {CHAT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>

              <button
                onClick={() => setContextOpen(!contextOpen)}
                className="lg:hidden text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-2 py-1.5 hover:bg-slate-700 transition-colors"
              >
                Context {contextOpen ? '\u25BE' : '\u25B8'}
              </button>

              {messages.length > 0 && (
                <>
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-2 py-1.5 hover:bg-slate-800 transition-colors"
                    title="New consultation"
                  >
                    New
                  </button>
                  <button
                    onClick={handlePrint}
                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Print consultation"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Amber accent line */}
          <div className="h-px bg-gradient-to-r from-amber-600 via-amber-500 to-transparent mt-4" />

          {/* Mobile context chips (shown when panel is collapsed) */}
          {!contextOpen && contextChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 lg:hidden">
              {contextChips.map((chip, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full border border-slate-700">{chip}</span>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════ Main Body ════════════════ */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* ──────── Chat Column ──────── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Message area */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-1"
              style={{ minHeight: '400px', maxHeight: '600px' }}
            >
              {/* Welcome state */}
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">MRD Clinical Reference</h3>
                  <p className="text-sm text-slate-500 max-w-md mb-6">
                    Ask evidence-based questions about molecular residual disease testing, interpretation, and clinical decision-making.
                  </p>

                  {!hasContext && (
                    <p className="text-xs text-slate-400 mb-4">
                      Set patient context in the sidebar for more targeted guidance.
                    </p>
                  )}

                  <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                    {allSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(s)}
                        className="text-xs px-3 py-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-900 transition-colors text-left leading-snug"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  data-message-role={msg.role}
                  className={`compendium-msg-enter ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'} mt-3`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] sm:max-w-[75%]">
                      <div className="text-xs text-slate-400 text-right mb-1 mr-1">You</div>
                      <div className="bg-slate-800 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                        {msg.displayContent || msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[90%] sm:max-w-[85%]">
                      <div className="text-xs text-slate-400 mb-1 ml-1 flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.466.89 6.064 2.346m0-14.304a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.346m0-14.304v14.304" />
                        </svg>
                        Compendium
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                        <CompendiumMarkdown text={msg.content} onTestClick={onViewTests} />
                        <EvidenceSummary text={msg.content} />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && <TypingIndicator />}

              {/* Post-response inline suggestions */}
              {messages.length > 0 && !isLoading && allSuggestions.length > 0 && (
                <div className="pt-3 pb-1">
                  <div className="flex flex-wrap gap-1.5">
                    {allSuggestions.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(s)}
                        className="text-xs px-2.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 transition-colors text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ──────── Input Area ──────── */}
            <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-6">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a clinical question about MRD testing..."
                    rows={1}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-shadow"
                    disabled={isLoading}
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                  />
                  {input.length > 0 && (
                    <span className="absolute right-3 bottom-2 text-xs text-slate-300">
                      {input.length}/{MAX_INPUT_LENGTH}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shrink-0"
                >
                  Send
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-400">
                  <span className="hidden sm:inline">Enter to send · Shift+Enter for new line</span>
                  <span className="sm:hidden">Enter to send</span>
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
                  </svg>
                  Reference only · Not clinical advice · Always verify
                </p>
              </div>
            </div>
          </div>

          {/* ──────── Context Sidebar ──────── */}
          <div className={`${contextOpen ? 'block' : 'hidden'} lg:block w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/70 flex-shrink-0 overflow-y-auto`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient Context</h3>
                {hasContext && (
                  <button
                    onClick={() => { setCancerType(''); setStage(''); setClinicalSetting(''); setMrdResult(''); setTestUsed(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <ContextField label="Cancer Type" value={cancerType} onChange={setCancerType} options={CANCER_TYPES} />
                <ContextField label="Stage" value={stage} onChange={setStage} options={STAGES} />
                <ContextField label="Clinical Setting" value={clinicalSetting} onChange={setClinicalSetting} options={CLINICAL_SETTINGS} />
                <ContextField label="MRD Result" value={mrdResult} onChange={setMrdResult} options={MRD_RESULTS} />
                <ContextField label="Test Used" value={testUsed} onChange={setTestUsed} options={MRD_TESTS} />
              </div>

              {hasContext && (
                <div className="mt-4 p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                  <p className="text-xs text-amber-700">Context will be included with your next question for more targeted guidance.</p>
                </div>
              )}

              {/* "Physicians also explore" */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Physicians also explore</h4>
                <div className="space-y-1.5">
                  {allSuggestions.slice(0, 4).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(s)}
                      disabled={isLoading}
                      className="w-full text-left text-xs px-3 py-2 text-slate-600 rounded-lg hover:bg-white hover:shadow-sm hover:text-slate-900 transition-all border border-transparent hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom disclaimer */}
            <div className="p-4 border-t border-slate-200">
              <p className="text-xs text-slate-400 leading-relaxed">
                Reference compendium only. Clinical decisions remain with the treating physician. All findings should be independently verified.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
