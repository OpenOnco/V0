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
  const { cancer, txPhase, indication } = ctx;
  const c = cancer || '';
  if (hasMsgs) return [
    'What trials are actively enrolling?',
    'How does the evidence compare across assays?',
    cancer ? `Coverage evidence for ${c}?` : 'Payer coverage landscape?',
  ];
  if (indication === 'Post-positive ctDNA' && txPhase === 'Post-surgical' && cancer)
    return [`Escalation evidence after ctDNA+ in ${c}?`, `Retesting intervals in ${c}?`, `Trials enrolling ctDNA+ ${c}?`];
  if (indication === 'Post-positive ctDNA')
    return ['Escalation evidence after ctDNA detection?', 'Prognostic data on post-resection ctDNA+?', 'ctDNA-guided therapy trials?'];
  if (indication === 'Post-negative ctDNA')
    return ['De-escalation evidence after ctDNA clearance?', 'Negative predictive value across assays?', 'Surveillance intervals after negative ctDNA?'];
  if (indication === 'Test selection')
    return cancer
      ? [`Assays validated for ${c}?`, `Tumor-informed vs naïve for ${c}?`, `NCCN-referenced assays for ${c}?`]
      : ['Tumor-informed vs tumor-naïve?', 'Strongest validation data?', 'NCCN-referenced MRD assays?'];
  if (txPhase === 'Post-surgical')
    return ['Timing for first ctDNA draw post-resection?', 'ctDNA clearance kinetics?', 'Post-surgical validation data?'];
  if (txPhase === 'Surveillance')
    return ['Serial monitoring intervals?', 'ctDNA vs imaging lead time?', 'De-escalation after ctDNA clearance?'];
  if (cancer)
    return [`MRD evidence landscape for ${c}?`, `Key ctDNA trials in ${c}?`, `NCCN on ctDNA in ${c}?`];
  return [
    'Next steps after ctDNA+?',
    'Compare MRD assays head-to-head',
    'What does CIRCULATE show?',
    'NCCN-referenced ctDNA assays',
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

function Prose({ text }) {
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
      if (best === rest.length) { parts.push(<span key={k++}>{rest}</span>); break; }
      if (best > 0) parts.push(<span key={k++}>{rest.slice(0, best)}</span>);
      if (type === 'badge') {
        parts.push(<span key={k++} className="text-[10px] font-semibold ml-1 opacity-75" style={{ color: BC[m] }}>{m}</span>);
        rest = rest.slice(best + m.length + 2);
      } else {
        parts.push(<strong key={k++} className="font-semibold text-slate-800">{m[1]}</strong>);
        rest = rest.slice(best + m[0].length);
      }
    }
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
  const [showCoverage, setShowCoverage] = useState(false);
  const [covQuery, setCovQuery] = useState('');
  const [selectedPayer, setSelectedPayer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const endRef = useRef(null);
  const ctxRef = useRef(null);
  const covRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  // DAL hooks for coverage check
  const { providers: insuranceProviders } = useInsuranceProviders();
  const { tests: allTests } = useAllTests();

  const mrdTests = useMemo(() =>
    (allTests || []).filter(t => t.category === 'MRD'),
    [allTests]
  );

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

  // Coverage results for selected payer
  const coverageResults = useMemo(() => {
    if (!selectedPayer || !mrdTests.length) return [];
    return mrdTests
      .map(test => {
        const coverage = getCoverageForPayer(test, selectedPayer.label);
        if (coverage.length === 0) return null;
        return { test, coverage };
      })
      .filter(Boolean);
  }, [selectedPayer, mrdTests]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);
  useEffect(() => {
    const handler = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setShowCtx(false);
      if (covRef.current && !covRef.current.contains(e.target)) setShowCoverage(false);
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
    setShowCoverage(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const fullMessage = contextPrefix + question;
    const userMsg = { role: 'user', text: question, content: fullMessage };
    const updated = [...msgs, userMsg];
    setMsgs(updated);
    setLoading(true);

    const apiMessages = updated.slice(-MAX_MESSAGES).map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content || m.text,
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
          model: MODELS[model],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const assistantText = data?.content?.[0]?.text;

      if (assistantText) {
        const aiMsg = { role: 'ai', text: assistantText, content: assistantText };
        const withResponse = [...updated, aiMsg];
        setMsgs(withResponse);
        fetchFollowups(withResponse.map(m => ({
          role: m.role === 'ai' ? 'assistant' : m.role,
          content: m.content || m.text,
        })));
      } else {
        throw new Error('No response received');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMsgs(prev => [...prev, { role: 'ai', text: `I encountered an error: ${err.message}. Please try again.` }]);
    } finally {
      setLoading(false);
    }
  }, [loading, msgs, contextPrefix, testData, model, fetchFollowups]);

  // ─── Patient Context Popover ────────────────────────────────────────────

  const CtxPopover = () => (
    <div ref={ctxRef} className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg p-4 w-80 z-50">
      <div className="text-sm font-semibold text-slate-800 mb-3">Case Details</div>
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

  // ─── Coverage Check Popover ─────────────────────────────────────────────

  const CoveragePopover = () => (
    <div ref={covRef} className="absolute top-full right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg w-96 z-50 max-h-[420px] flex flex-col">
      <div className="p-4 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-800 mb-2">Coverage Check</div>
        <div className="relative">
          <input
            type="text"
            value={covQuery}
            onChange={e => { setCovQuery(e.target.value); setSelectedPayer(null); }}
            placeholder="Type insurance name..."
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-300 bg-white text-slate-800 placeholder:text-slate-400"
            autoFocus
          />
          {covQuery && !selectedPayer && (
            <button onClick={() => { setCovQuery(''); setSelectedPayer(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        {/* Autocomplete dropdown */}
        {covQuery && !selectedPayer && filteredPayers.length > 0 && (
          <div className="mt-1 border border-slate-200 rounded-lg bg-white max-h-40 overflow-y-auto">
            {filteredPayers.map(p => (
              <button key={p.id} onClick={() => { setSelectedPayer(p); setCovQuery(p.label); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between">
                <span>{p.label}</span>
                <span className="text-[10px] text-slate-400 capitalize">{p.category}</span>
              </button>
            ))}
          </div>
        )}
        {covQuery && !selectedPayer && filteredPayers.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">No matching insurers found</p>
        )}
      </div>

      {/* Coverage results */}
      {selectedPayer && (
        <div className="flex-1 overflow-y-auto p-4 pt-2">
          <div className="text-xs text-slate-500 mb-2">
            MRD test coverage for <span className="font-medium text-slate-700">{selectedPayer.label}</span>
          </div>
          {coverageResults.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No coverage data available for this payer across MRD tests.</p>
          ) : (
            <div className="space-y-2">
              {coverageResults.map(({ test, coverage }) => {
                const primary = coverage[0];
                const s = STATUS_STYLES[primary.status] || STATUS_STYLES.NOT_COVERED;
                return (
                  <div key={test.id} className={`${s.bg} border ${s.border} rounded-lg p-2.5`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-800">{test.name}</span>
                      <span className={`text-[10px] font-medium ${s.text} px-1.5 py-0.5 rounded-full ${s.bg} border ${s.border}`}>
                        {s.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mb-0.5">{test.vendor}</div>
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
              })}
            </div>
          )}
          <button onClick={() => { setSelectedPayer(null); setCovQuery(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 mt-3">
            Check another payer
          </button>
        </div>
      )}
    </div>
  );

  // ─── Input Box ──────────────────────────────────────────────────────────

  const InputBox = ({ centered }) => (
    <div className={`w-full max-w-2xl ${centered ? 'mx-auto' : ''} relative`}>
      {showCtx && <CtxPopover />}
      {showCoverage && <CoveragePopover />}
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
            <button onClick={() => { setShowCtx(!showCtx); setShowCoverage(false); }}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                ctxSet
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : showCtx
                    ? 'border-slate-300 bg-slate-50 text-slate-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}>
              Case Details{ctxSet ? ` · ${[cancer, stage].filter(Boolean).join(' ')}` : ''}
            </button>
            <button onClick={() => {
                if (!ctxSet) { setShowCtx(true); setShowCoverage(false); return; }
                setShowCoverage(!showCoverage); setShowCtx(false);
              }}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                showCoverage
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}>
              Coverage Check
            </button>
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

  const CategoryRow = () => (
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
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* MRD Evidence Navigator Chat Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">

        {/* Empty state */}
        {empty && (
          <div className="flex flex-col items-center py-10 px-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800 flex items-center justify-center gap-2">
                <span className="text-orange-500 text-xl">&#10022;</span>
                MRD Evidence Navigator
              </h2>
              <p className="text-sm text-slate-500 mt-1">MRD treatment guidelines are sparse — we're curating the clinical evidence to help bridge that gap</p>
            </div>
            <InputBox centered />
            <div className="flex flex-wrap gap-2 mt-4 justify-center max-w-2xl">
              {displayQs.map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  className="text-xs text-slate-600 bg-white border border-slate-200 rounded-full px-3.5 py-1.5 cursor-pointer transition-all hover:border-orange-300 hover:bg-orange-50">
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3">Evidence synthesis only · Not clinical guidance</p>
          </div>
        )}

        {/* Conversation */}
        {!empty && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="text-orange-500">&#10022;</span>
                MRD Evidence Navigator
              </h3>
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
                      <Prose text={m.text} />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div>
                  <span className="text-xs text-slate-400 block mb-2">
                    {model === 'deep' ? 'Searching deeply\u2026' : 'Searching evidence\u2026'}
                  </span>
                  {[100, 70, 45].map((w, j) => (
                    <div key={j} className="h-2 rounded mb-2 animate-pulse bg-slate-100" style={{ width: `${w}%` }} />
                  ))}
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
            <p className="text-[11px] text-slate-400 mt-2 text-center">Evidence synthesis only · Not clinical guidance</p>
          </div>
        )}
      </div>

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
  );
}
