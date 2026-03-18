import React, { useState, useRef, useCallback } from 'react';

const CANCER_TYPES = [
  { id: 'colorectal', label: 'Colorectal' },
  { id: 'breast', label: 'Breast' },
  { id: 'lung', label: 'Lung' },
  { id: 'bladder', label: 'Bladder' },
  { id: 'ovarian', label: 'Ovarian' },
  { id: 'prostate', label: 'Prostate' },
  { id: 'pancreatic', label: 'Pancreatic' },
  { id: 'melanoma', label: 'Melanoma' },
  { id: 'other-solid', label: 'Other' },
];

const CANCER_STAGES = [
  { id: 'stage-1', label: 'Stage I' },
  { id: 'stage-2', label: 'Stage II' },
  { id: 'stage-3', label: 'Stage III' },
  { id: 'stage-4', label: 'Stage IV' },
  { id: 'not-sure', label: 'Not sure' },
];

/**
 * Inline cancer type + stage picker that syncs with sessionStorage.
 * Place this just above the wizard's main input in each wizard.
 */
export default function CancerStagePicker({ cancerType, setCancerType, stage, setStage }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      <span className="text-sm text-stone-500">Your situation:</span>
      <select
        value={cancerType || ''}
        onChange={(e) => setCancerType(e.target.value || null)}
        className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      >
        <option value="">Cancer type</option>
        {CANCER_TYPES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <select
        value={stage || ''}
        onChange={(e) => setStage(e.target.value || null)}
        className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      >
        <option value="">Stage</option>
        {CANCER_STAGES.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Hook to manage cancer type + stage state with sessionStorage persistence.
 */
export function useCancerStageContext() {
  // Initialize from sessionStorage synchronously
  const initial = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('openonco-patient-context') || '{}');
    } catch { return {}; }
  })();

  const [cancerType, setCancerTypeRaw] = useState(initial.cancerType || null);
  const [stage, setStageRaw] = useState(initial.stage || null);

  // Refs for stale-closure-safe persistence
  const cancerTypeRef = useRef(cancerType);
  const stageRef = useRef(stage);
  cancerTypeRef.current = cancerType;
  stageRef.current = stage;

  const setCancerType = useCallback((val) => {
    setCancerTypeRaw(val);
    cancerTypeRef.current = val;
    const ctx = { cancerType: val || null, stage: stageRef.current || null };
    sessionStorage.setItem('openonco-patient-context', JSON.stringify(ctx));
  }, []);

  const setStage = useCallback((val) => {
    setStageRaw(val);
    stageRef.current = val;
    const ctx = { cancerType: cancerTypeRef.current || null, stage: val || null };
    sessionStorage.setItem('openonco-patient-context', JSON.stringify(ctx));
  }, []);

  return { cancerType, setCancerType, stage, setStage };
}
