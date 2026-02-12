/**
 * MRD Evidence Navigator — WIREFRAME / VISUAL REFERENCE
 * This file is the design spec. Use its layout, colors, and structure
 * but replace the mock send() with real /api/chat calls.
 * See: cc-instructions-mrd-navigator.md for full implementation details.
 */
import { useState, useRef, useEffect, useMemo } from "react";

const CANCERS = ['Colorectal', 'Breast', 'Lung (NSCLC)', 'Bladder', 'Pancreatic', 'Melanoma', 'Ovarian', 'Prostate', 'Gastric', 'Cholangiocarcinoma'];
const STAGES = ['I', 'II', 'IIA', 'IIB', 'III', 'IIIA', 'IIIB', 'IIIC', 'IV'];
const TX_PHASES = ['Pre-treatment', 'Neoadjuvant', 'Post-surgical', 'Adjuvant (active)', 'Surveillance', 'Recurrence workup', 'Metastatic'];
const INDICATIONS = ['Post-positive ctDNA', 'Post-negative ctDNA', 'Response assessment', 'Recurrence monitoring', 'Test selection'];

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
