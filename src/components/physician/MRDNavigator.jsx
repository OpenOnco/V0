/**
 * MRD Evidence Navigator — Physician persona home page
 * Traditional OpenOnco design: pastel Tailwind, rounded cards, shadows
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import TestShowcase from '../test/TestShowcase';
import { useInsuranceProviders, useAllTests } from '../../dal';

// ─── Constants ──────────────────────────────────────────────────────────────

const CANCERS = ['Colorectal', 'Breast', 'Lung (NSCLC)', 'Bladder', 'Pancreatic', 'Melanoma', 'Ovarian', 'Prostate', 'Gastric', 'Cholangiocarcinoma'];
const STAGES = ['I', 'II', 'IIA', 'IIB', 'III', 'IIIA', 'IIIB', 'IIIC', 'IV'];
const TX_PHASES = ['Pre-treatment', 'Neoadjuvant', 'Post-surgical', 'Adjuvant (active)', 'Surveillance', 'Recurrence workup', 'Metastatic'];
const MODELS = {
  fast: 'claude-haiku-4-5-20251001',
  deep: 'claude-sonnet-4-5-20250929',
};

const MAX_MESSAGES = 10;

const CATEGORIES = [
  { code: 'HCT', label: 'Hereditary Cancer Testing', route: 'HCT',
    card: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500', text: 'text-rose-700' },
  { code: 'ECD', label: 'Early Cancer Detection', route: 'ECD',
    card: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  { code: 'MRD', label: 'Molecular Residual Disease', route: 'MRD',
    card: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', text: 'text-orange-700' },
  { code: 'CGP', label: 'Treatment Decision Support', route: 'CGP',
    card: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500', text: 'text-violet-700' },
];

// Map insurance provider labels → privatePayers keys used in coverageCrossReference
const PAYER_KEY_MAP = {
  'aetna': 'aetna',
  'cigna': 'cigna',
  'unitedhealthcare': 'united',
  'united healthcare': 'united',
  'kaiser permanente': 'kaiser',
  'kaiser': 'kaiser',
  'blue shield of california': 'blueshieldca',
  'bcbs louisiana': 'bcbsLouisiana',
  'geisinger health plan': 'geisinger',
  'geisinger': 'geisinger',
  'anthem bcbs': 'anthem',
  'humana': 'humana',
  'highmark': 'highmark',
  'carelon': 'carelon',
};

const STATUS_STYLES = {
  COVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Covered' },
  PARTIAL: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Partial' },
  LIMITED_EVIDENCE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Limited Evidence' },
  EXPERIMENTAL: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', label: 'Experimental' },
  INVESTIGATIONAL: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', label: 'Investigational' },
  NOT_COVERED: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', label: 'Not Covered' },
};

// ─── Evidence badge colors ──────────────────────────────────────────────────

const BC = {
  RCT: '#B45309',
  Prospective: '#1D4ED8',
  Retrospective: '#9A3412',
  Consensus: '#6B7280',
  Conference: '#7C3AED',
};

// ─── Suggestion Engine ──────────────────────────────────────────────────────

function getQuestions(ctx, hasMsgs) {
  const { cancer, txPhase } = ctx;
  const c = cancer || '';
  if (hasMsgs) return [
    'What trials are actively enrolling?',
    cancer ? `When should I escalate therapy in ${c}?` : 'When should I escalate based on ctDNA?',
    cancer ? `Surveillance strategy for ${c}?` : 'Optimal surveillance intervals?',
  ];
  if (txPhase === 'Post-surgical' && cancer)
    return [`Should I escalate after ctDNA+ in ${c}?`, `When to draw first ctDNA post-resection in ${c}?`, `Adjuvant therapy options if ctDNA persists?`];
  if (txPhase === 'Post-surgical')
    return ['Should I escalate after ctDNA detection?', 'When to draw first ctDNA post-resection?', 'Adjuvant therapy if ctDNA persists?'];
  if (txPhase === 'Neoadjuvant')
    return [cancer ? `Neoadjuvant response monitoring in ${c}?` : 'Neoadjuvant response monitoring with ctDNA?', 'Can ctDNA guide surgical timing?', 'Switch therapy if ctDNA doesn\'t clear?'];
  if (txPhase === 'Surveillance' && cancer)
    return [`Surveillance intervals for ${c}?`, `Can I de-escalate if ctDNA stays negative in ${c}?`, `ctDNA vs imaging for recurrence in ${c}?`];
  if (txPhase === 'Surveillance')
    return ['How often should I retest ctDNA?', 'Can I de-escalate if ctDNA stays negative?', 'ctDNA vs imaging for recurrence detection?'];
  if (txPhase === 'Adjuvant (active)')
    return [cancer ? `Should I stop adjuvant if ctDNA clears in ${c}?` : 'Stop adjuvant if ctDNA clears?', 'Duration of therapy guided by ctDNA?', 'Escalation after ctDNA persistence?'];
  if (cancer)
    return [`ctDNA positive in ${c} — what are my options?`, `ctDNA negative in ${c} — can I de-escalate?`, `NCCN on ctDNA-guided therapy in ${c}?`];
  return [
    'My patient is ctDNA positive — what are my options?',
    'My patient is ctDNA negative — can I safely de-escalate?',
    'NCCN on ctDNA-guided treatment decisions',
  ];
}

// ─── Coverage lookup helper ─────────────────────────────────────────────────

function getCoverageForPayer(test, payerLabel) {
  const results = [];
  const lc = payerLabel.toLowerCase();
  const payerKey = PAYER_KEY_MAP[lc];

  // Check coverageCrossReference.privatePayers
  const pp = test.coverageCrossReference?.privatePayers;
  if (pp && payerKey && pp[payerKey]) {
    const entry = pp[payerKey];
    results.push({
      source: 'policy',
      status: entry.status,
      policy: entry.policy,
      policyUrl: entry.policyUrl,
      coveredIndications: entry.coveredIndications || [],
      notes: entry.notes,
      lastReviewed: entry.lastReviewed,
    });
  }

  // Check Medicare
  if (lc === 'medicare' && test.coverageCrossReference?.medicare) {
    const mc = test.coverageCrossReference.medicare;
    results.push({
      source: 'medicare',
      status: mc.status,
      policies: mc.policies,
      indications: mc.indications || [],
      notes: mc.notes,
      rate: mc.rate,
    });
  }

  // Check commercialPayers array
  if (Array.isArray(test.commercialPayers)) {
    const match = test.commercialPayers.find(p => p.toLowerCase() === lc);
    if (match && results.length === 0) {
      results.push({ source: 'listed', status: 'COVERED', notes: test.commercialPayersNotes });
    }
  }

  // Check non-coverage
  if (Array.isArray(test.commercialPayersNonCoverage)) {
    const nonMatch = test.commercialPayersNonCoverage.find(p => p.toLowerCase() === lc);
    if (nonMatch) {
      // Override or add non-coverage info
      if (results.length === 0) {
        results.push({ source: 'non-coverage', status: 'NOT_COVERED', notes: test.commercialPayersNonCoverageNotes });
      }
    }
  }

  return results;
}

// ─── Prose Renderer ─────────────────────────────────────────────────────────

function CiteRef({ nums, sources }) {
  const [show, setShow] = useState(false);
  const hideTimer = useRef(null);
  const refs = nums.map(n => {
    const s = (sources || []).find(s => s.index === n);
    return { n, title: s?.title, url: s?.url, type: s?.sourceType };
  });
  const enter = () => { clearTimeout(hideTimer.current); setShow(true); };
  const leave = () => { hideTimer.current = setTimeout(() => setShow(false), 150); };
  return (
    <span className="relative inline-block" onMouseEnter={enter} onMouseLeave={leave}>
      <sup className="text-[10px] font-medium text-orange-500 ml-0.5 cursor-pointer border-b border-dotted border-orange-300">
        [{nums.join(',')}]
      </sup>
      {show && (
        <span className="fixed z-[9999] w-80 bg-slate-800 text-white text-[11px] leading-snug rounded-lg shadow-xl p-2.5"
          onMouseEnter={enter} onMouseLeave={leave}
          ref={el => {
            if (!el) return;
            const sup = el.parentElement?.querySelector('sup');
            if (!sup) return;
            const r = sup.getBoundingClientRect();
            el.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - 160, window.innerWidth - 328))}px`;
            el.style.top = `${r.top - el.offsetHeight - 6}px`;
          }}>
          {refs.map(r => (
            <span key={r.n} className="block mb-1 last:mb-0">
              <span className="text-orange-400 font-medium">[{r.n}]</span>{' '}
              {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-orange-200">{r.title || 'Source'}</a> : (r.title || 'Source')}
              {r.type && <span className="text-slate-400 ml-1">· {r.type}</span>}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function Prose({ text, sources }) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    let parts = [], rest = line, k = 0;
    while (rest.length > 0) {
      let best = rest.length, type = null, m = null;
      for (const b of Object.keys(BC)) {
        const idx = rest.indexOf(`[${b}]`);
        if (idx !== -1 && idx < best) { best = idx; type = 'badge'; m = b; }
      }
      const bm = rest.match(/\*\*(.+?)\*\*/);
      if (bm && bm.index < best) { best = bm.index; type = 'bold'; m = bm; }
      const cm = rest.match(/\[(\d{1,2}(?:,\s*\d{1,2})*)\]/);
      if (cm && cm.index < best) { best = cm.index; type = 'cite'; m = cm; }
      if (best === rest.length) { parts.push(<span key={k++}>{rest}</span>); break; }
      if (best > 0) parts.push(<span key={k++}>{rest.slice(0, best)}</span>);
      if (type === 'badge') {
        parts.push(<span key={k++} className="text-[10px] font-semibold ml-1 opacity-75" style={{ color: BC[m] }}>{m}</span>);
        rest = rest.slice(best + m.length + 2);
      } else if (type === 'cite') {
        const nums = m[1].split(',').map(s => parseInt(s.trim(), 10));
        parts.push(<CiteRef key={k++} nums={nums} sources={sources} />);
        rest = rest.slice(best + m[0].length);
      } else {
        parts.push(<strong key={k++} className="font-semibold text-slate-800">{m[1]}</strong>);
        rest = rest.slice(best + m[0].length);
      }
    }
    const hdr = line.match(/^(CLINICAL SCENARIO|DECISION|OPTION [A-Z]|WHAT THE EVIDENCE|TEST-SPECIFIC NOTE|COMPARISON|COVERAGE SUMMARY|GUIDELINE|CLINICAL CONSIDERATIONS|LIMITATIONS):/);
    if (hdr) {
      // Re-parse only the body after the colon so citations get superscript treatment
      const colonIdx = line.indexOf(':');
      const body = line.slice(colonIdx + 1);
      let bodyParts = [], bodyRest = body, bk = 0;
      while (bodyRest.length > 0) {
        let best = bodyRest.length, type = null, m = null;
        const bm = bodyRest.match(/\*\*(.+?)\*\*/);
        if (bm && bm.index < best) { best = bm.index; type = 'bold'; m = bm; }
        const cm = bodyRest.match(/\[(\d{1,2}(?:,\s*\d{1,2})*)\]/);
        if (cm && cm.index < best) { best = cm.index; type = 'cite'; m = cm; }
        if (best === bodyRest.length) { bodyParts.push(<span key={`hb${bk++}`}>{bodyRest}</span>); break; }
        if (best > 0) bodyParts.push(<span key={`hb${bk++}`}>{bodyRest.slice(0, best)}</span>);
        if (type === 'cite') {
          const nums = m[1].split(',').map(s => parseInt(s.trim(), 10));
          bodyParts.push(<CiteRef key={`hb${bk++}`} nums={nums} sources={sources} />);
          bodyRest = bodyRest.slice(best + m[0].length);
        } else {
          bodyParts.push(<strong key={`hb${bk++}`} className="font-semibold text-slate-800">{m[1]}</strong>);
          bodyRest = bodyRest.slice(best + m[0].length);
        }
      }
      return <p key={i} className="my-1.5 text-[15px] leading-relaxed text-slate-700"><strong className="font-semibold text-slate-800">{line.slice(0, colonIdx + 1)}</strong>{bodyParts}</p>;
    }
    if (line.match(/^- /))
      return <p key={i} className="my-0.5 text-[14px] leading-relaxed text-slate-600 pl-3">{parts}</p>;
    if (line.match(/^[A-Z][a-z]+ et al/))
      return <p key={i} className="mt-4 pt-2.5 border-t border-slate-200 text-xs text-slate-400">{line}</p>;
    return <p key={i} className="my-1 text-[15px] leading-relaxed text-slate-700">{parts}</p>;
  });
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MRDNavigator({ testData = {}, onNavigate }) {
  const [cancer, setCancer] = useState('');
  const [stage, setStage] = useState('');
  const [txPhase, setTxPhase] = useState('');
  const indication = ''; // kept for suggestion engine compatibility
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const [model] = useState('deep');
  const [showCtx, setShowCtx] = useState(false);
  const [navExpanded, setNavExpanded] = useState(true);
  const [browserExpanded, setBrowserExpanded] = useState(false);
  const [covExpanded, setCovExpanded] = useState(false);
  const [covTestQuery, setCovTestQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState(null);
  const [covQuery, setCovQuery] = useState('');
  const [selectedPayer, setSelectedPayer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const endRef = useRef(null);
  const ctxRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  // DAL hooks for coverage check
  const { providers: insuranceProviders } = useInsuranceProviders();
  const { tests: allTests } = useAllTests();

  const mrdTests = useMemo(() =>
    (allTests || []).filter(t => t.category === 'MRD'),
    [allTests]
  );

  const [evidenceSourceStats, setEvidenceSourceStats] = useState(null);
  const [coverageSourceStats, setCoverageSourceStats] = useState(null);
  useEffect(() => {
    fetch('/api/evidence-stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setEvidenceSourceStats(d.sources))
      .catch(() => {});
    fetch('/api/coverage-stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCoverageSourceStats(d.sources))
      .catch(() => {});
  }, []);

  const ctx = { cancer, stage, txPhase, indication };
  const questions = useMemo(() => getQuestions(ctx, msgs.length > 0), [cancer, stage, txPhase, indication, msgs.length]);
  const displayQs = followUps.length > 0 && msgs.length > 0 ? followUps : questions;
  const ctxSet = [cancer, stage, txPhase].some(Boolean);
  const ctxLabel = [cancer, stage && `Stage ${stage}`, txPhase].filter(Boolean).join(' · ');
  const empty = msgs.length === 0 && !loading;

  // Filtered payer list for autocomplete
  const filteredPayers = useMemo(() => {
    if (!covQuery.trim()) return insuranceProviders || [];
    const q = covQuery.toLowerCase();
    return (insuranceProviders || []).filter(p =>
      p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [insuranceProviders, covQuery]);

  // Filtered tests for autocomplete
  const filteredTests = useMemo(() => {
    if (!covTestQuery.trim()) return [];
    const q = covTestQuery.toLowerCase();
    return mrdTests.filter(t =>
      t.name.toLowerCase().includes(q) || t.vendor.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [mrdTests, covTestQuery]);

  // Coverage result for selected test + payer
  const coverageResult = useMemo(() => {
    if (!selectedTest || !selectedPayer) return null;
    const coverage = getCoverageForPayer(selectedTest, selectedPayer.label);
    return coverage.length > 0 ? { test: selectedTest, coverage } : null;
  }, [selectedTest, selectedPayer]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);
  useEffect(() => {
    const handler = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setShowCtx(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

  const contextPrefix = useMemo(() => {
    const parts = [cancer, stage && `Stage ${stage}`, txPhase, indication].filter(Boolean);
    return parts.length > 0 ? `[Patient context: ${parts.join(', ')}]\n\n` : '';
  }, [cancer, stage, txPhase, indication]);

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
              content: 'Based on this conversation, suggest 3 brief follow-up questions a physician would ask next about MRD testing evidence. Frame them as evidence-seeking questions. Return ONLY a JSON array of strings.',
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
          if (Array.isArray(parsed)) setFollowUps(parsed.filter(s => typeof s === 'string').slice(0, 3));
        }
      }
    } catch { /* silent */ }
  }, [testData]);

  const send = useCallback(async (text) => {
    const question = (text || '').trim();
    if (!question || loading) return;
    setInput('');
    setFollowUps([]);
    setShowCtx(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const fullMessage = contextPrefix + question;
    const userMsg = { role: 'user', text: question, content: fullMessage };
    const updated = [...msgs, userMsg];
    setMsgs(updated);
    setLoading(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/mrd-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: fullMessage,
          filters: {
            ...(cancer && { cancerType: cancer.toLowerCase().replace(/\s*\(.*\)/, '') }),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.answer) {
        const aiMsg = { role: 'ai', text: data.answer, content: data.answer, sources: data.sources || [] };
        const withResponse = [...updated, aiMsg];
        setMsgs(withResponse);
        fetchFollowups(withResponse.map(m => ({
          role: m.role === 'ai' ? 'assistant' : m.role,
          content: m.content || m.text,
        })));
      } else {
        throw new Error(data.error || 'No response received');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMsgs(prev => [...prev, { role: 'ai', text: `I encountered an error: ${err.message}. Please try again.` }]);
    } finally {
      setLoading(false);
    }
  }, [loading, msgs, contextPrefix, cancer, fetchFollowups]);

  // ─── Patient Context Popover ────────────────────────────────────────────

  const CtxPopover = () => (
    <div ref={ctxRef} className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg p-4 w-80 z-50">
      <div className="text-sm font-semibold text-slate-800 mb-1">Case Details</div>
      <div className="mb-2" />
      {[
        ['Cancer type', cancer, setCancer, CANCERS],
        ['Stage', stage, setStage, STAGES],
        ['Treatment phase', txPhase, setTxPhase, TX_PHASES],
      ].map(([label, val, setter, opts]) => (
        <div key={label} className="mb-2">
          <div className="text-xs text-slate-400 mb-1 font-medium">{label}</div>
          <select value={val} onChange={e => setter(e.target.value)}
            className={`w-full text-sm px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer ${
              val ? 'border-orange-300 bg-orange-50 text-slate-800' : 'border-slate-200 bg-white text-slate-400'
            }`}>
            <option value="">—</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ))}
      {ctxSet && (
        <button onClick={() => { setCancer(''); setStage(''); setTxPhase(''); }}
          className="text-xs text-slate-400 hover:text-slate-600 mt-1">
          Clear all
        </button>
      )}
    </div>
  );

  // ─── Input Box ──────────────────────────────────────────────────────────

  const InputBox = ({ centered }) => (
    <div className={`w-full max-w-2xl ${centered ? 'mx-auto' : ''} relative`}>
      {showCtx && <CtxPopover />}
      <div className={`border border-slate-200 rounded-2xl bg-white px-4 pt-3 pb-2 ${centered ? 'shadow-sm' : ''}`}>
        <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="What evidence are you looking for?"
          disabled={loading}
          rows={1}
          className="w-full border-none outline-none resize-none text-[15px] text-slate-800 bg-transparent leading-relaxed min-h-[28px] max-h-[120px]"
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
        />
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-2">
            {ctxSet && (
            <button onClick={() => setShowCtx(!showCtx)}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                showCtx
                  ? 'border-slate-300 bg-slate-50 text-slate-700'
                  : 'border-orange-300 bg-orange-50 text-orange-700'
              }`}>
              {[cancer, stage].filter(Boolean).join(' · ')}
            </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              className={`w-[30px] h-[30px] rounded-[10px] border-none flex items-center justify-center text-base transition-all ${
                input.trim() && !loading
                  ? 'bg-slate-800 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-default'
              }`}>&#8593;</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Category Cards ─────────────────────────────────────────────────────

  const testCount = (allTests || []).length;

  const CategoryRow = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Browse and compare {testCount} molecular cancer tests</h3>
      <div className="flex gap-4">
        {CATEGORIES.map(({ code, label, card, dot, text, route }) => (
          <button key={code} onClick={() => onNavigate && onNavigate(route)}
            className={`flex-1 ${card} border rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 text-left`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
              <span className={`text-sm font-semibold ${text}`}>{code}</span>
            </div>
            <div className="text-xs text-slate-500">{label}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* MRD Evidence Navigator Chat Card */}
      <div className={`rounded-2xl border shadow-sm overflow-visible transition-shadow ${navExpanded ? 'bg-white border-rose-200' : 'bg-rose-50 border-rose-200 hover:shadow-md'}`}>
        <button onClick={() => setNavExpanded(!navExpanded)}
          className="w-full flex items-center gap-3 px-6 py-4 text-left group">
          <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${navExpanded ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span className="text-sm text-slate-800">
            <span className="font-semibold">MRD Evidence Navigator</span>
            {!navExpanded && <span className="text-slate-400 font-normal">: Navigate MRD evidence across NCCN, PubMed, and ASCO</span>}
          </span>
        </button>

        {/* Empty state */}
        {navExpanded && empty && (
          <div className="px-6 pb-8">
            <div className="flex gap-6 max-w-4xl mx-auto">

              {/* Left: Patient Context — compact */}
              <div className="w-44 shrink-0 hidden sm:block">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Patient Context</div>
                <div className="text-[10px] text-slate-400 mb-3">Optional — refines suggestions</div>
                {[
                  ['Indication', cancer, setCancer, CANCERS],
                  ['Stage', stage, setStage, STAGES],
                ].map(([label, val, setter, opts]) => (
                  <div key={label} className="mb-2.5">
                    <select value={val} onChange={e => setter(e.target.value)}
                      className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer transition-colors ${
                        val ? 'border-orange-300 bg-orange-50 text-slate-800' : 'border-slate-200 bg-white text-slate-400'
                      }`}>
                      <option value="">{label}</option>
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                {ctxSet && (
                  <button onClick={() => { setCancer(''); setStage(''); setTxPhase(''); }}
                    className="text-[10px] text-slate-400 hover:text-slate-600">
                    Clear
                  </button>
                )}
              </div>

              {/* Right: Clinical pathways + input */}
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  {displayQs.map((q, i) => {
                    const icons = [
                      <svg key="pos" className="w-5 h-5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v4m0 4h.01M5.07 19h13.86c1.41 0 2.3-1.53 1.59-2.75L13.59 4.5a1.83 1.83 0 0 0-3.18 0L3.48 16.25C2.77 17.47 3.66 19 5.07 19z" /></svg>,
                      <svg key="neg" className="w-5 h-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" /></svg>,
                      <svg key="nccn" className="w-5 h-5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.25v13m0-13C10.9 5.08 9.28 4.25 7.5 4.25c-2.49 0-4.5 1.79-4.5 4s2.01 4 4.5 4c1.78 0 3.4-.83 4.5-2.08m0-4C13.1 5.08 14.72 4.25 16.5 4.25c2.49 0 4.5 1.79 4.5 4s-2.01 4-4.5 4c-1.78 0-3.4-.83-4.5-2.08" /></svg>,
                    ];
                    return (
                      <button key={i} onClick={() => send(q)}
                        className="flex items-start gap-3 text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm transition-all group">
                        <div className="mt-0.5">{icons[i]}</div>
                        <span className="text-sm text-slate-700 leading-snug group-hover:text-slate-900">{q}</span>
                      </button>
                    );
                  })}
                </div>

                <InputBox centered />
                <p className="text-[10px] text-slate-400 text-center mt-3">Clinical decision support · Not a substitute for clinical judgment</p>
              </div>

            </div>

            {/* Evidence source dashboard — bottom cards */}
            {evidenceSourceStats && (
              <div className="max-w-4xl mx-auto mt-6 pt-5 border-t border-slate-100">
                <div className="flex gap-3 overflow-x-auto">
                  {Object.values(evidenceSourceStats).map(s => {
                    const colors = {
                      blue: 'text-blue-600 bg-blue-50 border-blue-100',
                      emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                      violet: 'text-violet-600 bg-violet-50 border-violet-100',
                      amber: 'text-amber-600 bg-amber-50 border-amber-100',
                      sky: 'text-sky-600 bg-sky-50 border-sky-100',
                    };
                    const c = colors[s.color] || colors.blue;
                    return (
                      <div key={s.label} className={`flex-1 min-w-[120px] rounded-lg border px-3 py-2.5 ${c}`}>
                        <div className="text-lg font-bold tabular-nums leading-tight">{s.count.toLocaleString()}</div>
                        <div className="text-[10px] font-medium opacity-75 leading-tight mt-0.5">{s.unit}</div>
                        <div className="text-[9px] font-semibold uppercase tracking-wider opacity-50 mt-1">{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        {navExpanded && !empty && (
          <div className="px-6 pb-6 pt-0">
            <div className="flex items-center justify-end mb-4">
              <button onClick={() => { setMsgs([]); setFollowUps([]); setInput(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                New search
              </button>
            </div>

            <div className="max-w-2xl mx-auto space-y-4 max-h-[60vh] overflow-y-auto mb-4 pr-2">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'user' ? (
                    <div className="max-w-[72%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-slate-100 text-slate-800 text-[15px] leading-relaxed">
                      {m.text}
                    </div>
                  ) : (
                    <div className="max-w-full">
                      {ctxSet && (
                        <div className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          Evidence for: {ctxLabel}
                        </div>
                      )}
                      <Prose text={m.text} sources={m.sources} />
                      {m.sources?.length > 0 && (
                        <details className="mt-2 group">
                          <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                            {m.sources.length} source{m.sources.length !== 1 ? 's' : ''} cited
                          </summary>
                          <div className="mt-1.5 space-y-1 pl-1">
                            {m.sources.map(s => (
                              <div key={s.index} className="text-[11px] text-slate-500 leading-snug">
                                <span className="text-orange-500 font-medium">[{s.index}]</span>{' '}
                                {s.url ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-slate-700">{s.title}</a>
                                ) : s.title}
                                {s.sourceType && <span className="ml-1 text-slate-300">· {s.sourceType}</span>}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-3 py-2">
                  <svg className="w-5 h-5 mt-0.5 text-emerald-500 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div>
                    <span className="text-sm font-medium text-slate-600 block">Searching clinical evidence database</span>
                    <span className="text-xs text-slate-400 block mt-0.5">Retrieving trials, publications, and guidelines…</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Follow-up suggestions */}
            {!loading && displayQs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 justify-center max-w-2xl mx-auto">
                {displayQs.slice(0, 3).map((q, i) => (
                  <button key={i} onClick={() => send(q)}
                    className="text-xs text-slate-600 bg-white border border-slate-200 rounded-full px-3.5 py-1.5 cursor-pointer transition-all hover:border-orange-300">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="max-w-2xl mx-auto">
              <InputBox />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">Clinical decision support · Not a substitute for clinical judgment</p>
          </div>
        )}
      </div>

      {/* Check Patient Coverage */}
      <div className={`rounded-2xl border shadow-sm transition-shadow ${covExpanded ? 'bg-white border-orange-200' : 'bg-orange-50 border-orange-200 hover:shadow-md'}`}>
        <button onClick={() => setCovExpanded(!covExpanded)}
          className="w-full flex items-center gap-3 px-6 py-4 text-left group">
          <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${covExpanded ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span className="text-sm text-slate-800">
            <span className="font-semibold">Check Patient Coverage</span>
            {!covExpanded && <span className="text-slate-400 font-normal">: Check MRD coverage by test, cancer type, and payer</span>}
          </span>
        </button>
        {covExpanded && (
          <div className="px-6 pb-5 pt-0 space-y-4">
            {/* Row 1: Two autocomplete fields side by side */}
            <div className="flex gap-3">
              {/* Test autocomplete */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={selectedTest ? selectedTest.name : covTestQuery}
                  onChange={e => { setCovTestQuery(e.target.value); setSelectedTest(null); }}
                  placeholder="Test name..."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-orange-300 bg-white text-slate-800 placeholder:text-slate-400"
                />
                {covTestQuery && !selectedTest && filteredTests.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto z-50 shadow-lg">
                    {filteredTests.map(t => (
                      <button key={t.id} onClick={() => { setSelectedTest(t); setCovTestQuery(''); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between">
                        <span>{t.name}</span>
                        <span className="text-[10px] text-slate-400">{t.vendor}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedTest && (
                  <button onClick={() => { setSelectedTest(null); setCovTestQuery(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
              {/* Insurer autocomplete */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={selectedPayer ? selectedPayer.label : covQuery}
                  onChange={e => { setCovQuery(e.target.value); setSelectedPayer(null); }}
                  placeholder="Insurance provider..."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-300 bg-white text-slate-800 placeholder:text-slate-400"
                />
                {covQuery && !selectedPayer && filteredPayers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto z-50 shadow-lg">
                    {filteredPayers.map(p => (
                      <button key={p.id} onClick={() => { setSelectedPayer(p); setCovQuery(''); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between">
                        <span>{p.label}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{p.category}</span>
                      </button>
                    ))}
                  </div>
                )}
                {covQuery && !selectedPayer && filteredPayers.length === 0 && (
                  <p className="absolute top-full left-0 mt-1 text-xs text-slate-400">No matching insurers found</p>
                )}
                {selectedPayer && (
                  <button onClick={() => { setSelectedPayer(null); setCovQuery(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
            </div>
            {/* Coverage result card */}
            {coverageResult ? (() => {
              const primary = coverageResult.coverage[0];
              const s = STATUS_STYLES[primary.status] || STATUS_STYLES.NOT_COVERED;
              return (
                <div className={`${s.bg} border ${s.border} rounded-lg p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800">{coverageResult.test.name}</span>
                    <span className={`text-[10px] font-medium ${s.text} px-1.5 py-0.5 rounded-full ${s.bg} border ${s.border}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-1">{coverageResult.test.vendor}</div>
                  {primary.coveredIndications?.length > 0 && (
                    <div className="text-[11px] text-slate-600 mt-1">
                      <span className="font-medium">Indications: </span>
                      {primary.coveredIndications.join('; ')}
                    </div>
                  )}
                  {primary.indications?.length > 0 && (
                    <div className="text-[11px] text-slate-600 mt-1">
                      <span className="font-medium">Indications: </span>
                      {primary.indications.join('; ')}
                    </div>
                  )}
                  {primary.notes && (
                    <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{primary.notes}</div>
                  )}
                  {primary.policy && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      Policy: {primary.policyUrl
                        ? <a href={primary.policyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{primary.policy}</a>
                        : primary.policy
                      }
                    </div>
                  )}
                  {primary.lastReviewed && (
                    <div className="text-[10px] text-slate-400">Reviewed: {primary.lastReviewed}</div>
                  )}
                </div>
              );
            })() : selectedTest && selectedPayer ? (
              <p className="text-xs text-slate-400 py-2">No coverage data for {selectedTest.name} with {selectedPayer.label}</p>
            ) : null}

            {/* Coverage source dashboard */}
            {coverageSourceStats && (
              <div className="pt-4 mt-2 border-t border-slate-100">
                <div className="flex gap-3 overflow-x-auto">
                  {Object.values(coverageSourceStats).map(s => {
                    const colors = {
                      blue: 'text-blue-600 bg-blue-50 border-blue-100',
                      emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                      violet: 'text-violet-600 bg-violet-50 border-violet-100',
                      amber: 'text-amber-600 bg-amber-50 border-amber-100',
                    };
                    const c = colors[s.color] || colors.blue;
                    return (
                      <div key={s.label} className={`flex-1 min-w-[120px] rounded-lg border px-3 py-2.5 ${c}`}>
                        <div className="text-lg font-bold tabular-nums leading-tight">{s.count.toLocaleString()}</div>
                        <div className="text-[10px] font-medium opacity-75 leading-tight mt-0.5">{s.unit}</div>
                        <div className="text-[9px] font-semibold uppercase tracking-wider opacity-50 mt-1">{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Browser (collapsed by default) */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden transition-shadow ${browserExpanded ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 hover:shadow-md'}`}>
        <button onClick={() => setBrowserExpanded(!browserExpanded)}
          className="w-full flex items-center gap-3 px-6 py-4 text-left group">
          <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${browserExpanded ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span className="text-sm text-slate-800">
            <span className="font-semibold">Browse All Tests</span>
            {!browserExpanded && <span className="text-slate-400 font-normal">: Browse and compare {testCount} molecular cancer tests</span>}
          </span>
        </button>

        {browserExpanded && (
          <div className="px-6 pb-6 space-y-6">
            {/* Category Row */}
            <CategoryRow />

            {/* Quick Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tests by name, vendor, cancer type..."
                className="w-full px-4 py-3 pl-11 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 outline-none transition-colors focus:border-orange-300 shadow-sm"
              />
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Test Map */}
            <TestShowcase
              onNavigate={onNavigate}
              hideNavigator={true}
              showQuickSearch={false}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>
        )}
      </div>
    </div>
  );
}
