/**
 * Journey Configuration
 *
 * This file decouples display labels from infrastructure.
 * To change labels, edit this file only.
 *
 * Technical IDs (stable): screening, tds, trm, mrd
 * Display labels (configurable): Screening, Choosing Treatment, Measuring Response, Watching
 */

export const JOURNEY_CONFIG = {
  screening: {
    id: 'screening',
    label: 'Screening',
    question: 'Am I at risk? Do I have cancer?',
    description: 'Proactive testing for early detection',
    categories: ['ECD', 'HCT'],
    path: '/patient/screening',
    colors: {
      bg: 'bg-sky-50',
      hover: 'hover:bg-sky-100',
      border: 'border-sky-200',
      accent: 'bg-sky-500',
      text: 'text-sky-700',
    },
    gridPosition: 'upper-left',
  },
  tds: {
    id: 'tds',
    label: 'Choosing Treatment',
    question: 'What treatment is right for me?',
    description: 'Find the best path forward after diagnosis',
    categories: ['TDS', 'CGP'],
    path: '/patient/choosing',
    colors: {
      bg: 'bg-violet-50',
      hover: 'hover:bg-violet-100',
      border: 'border-violet-200',
      accent: 'bg-violet-500',
      text: 'text-violet-700',
    },
    gridPosition: 'upper-right',
  },
  trm: {
    id: 'trm',
    label: 'Measuring Response',
    question: 'Is my treatment working?',
    description: 'Track your response to therapy',
    categories: ['TRM'],
    path: '/patient/measuring',
    colors: {
      bg: 'bg-amber-50',
      hover: 'hover:bg-amber-100',
      border: 'border-amber-200',
      accent: 'bg-amber-500',
      text: 'text-amber-700',
    },
    gridPosition: 'lower-right',
  },
  mrd: {
    id: 'mrd',
    label: 'Watching',
    question: "Confirming I'm cancer-free",
    description: 'Monitoring after treatment ends',
    categories: ['MRD'],
    path: '/patient/watching',
    colors: {
      bg: 'bg-emerald-50',
      hover: 'hover:bg-emerald-100',
      border: 'border-emerald-200',
      accent: 'bg-emerald-500',
      text: 'text-emerald-700',
    },
    gridPosition: 'lower-left',
  },
};

/**
 * Get journeys in clockwise order for the 2x2 grid display
 * Order: upper-left → upper-right → lower-right → lower-left
 */
export const getJourneysClockwise = () => [
  JOURNEY_CONFIG.screening,  // upper-left (start)
  JOURNEY_CONFIG.tds,        // upper-right
  JOURNEY_CONFIG.trm,        // lower-right
  JOURNEY_CONFIG.mrd,        // lower-left
];

/**
 * Helper cards for insurance and financial assistance
 */
export const HELPER_CARDS = [
  {
    id: 'insurance-appeal',
    title: 'My insurance denied my claim',
    description: 'Get help appealing coverage decisions',
    path: '/patient/insurance-denied',
    icon: '📋',
  },
  {
    id: 'financial-help',
    title: 'I need financial assistance',
    description: 'Find programs to help with costs',
    path: '/patient/financial-assistance',
    icon: '💰',
  },
];

export default JOURNEY_CONFIG;
