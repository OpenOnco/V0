/**
 * SEO-optimized comparison landing pages
 * Routes: /compare/signatera-vs-guardant-reveal, /compare/mrd-tests-2025, etc.
 */

import React, { useMemo } from 'react';
import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../data';

// Comparison page definitions - add new comparisons here
export const COMPARISON_PAGES = {
  'signatera-vs-guardant-reveal': {
    title: 'Signatera vs Guardant Reveal: MRD Test Comparison 2025',
    description: 'Compare Signatera and Guardant Reveal MRD tests side-by-side. Sensitivity, specificity, turnaround time, Medicare coverage, and clinical validation data.',
    h1: 'Signatera vs Guardant Reveal',
    subtitle: 'Tumor-informed vs Tumor-naive MRD Testing',
    testIds: ['mrd-1', 'mrd-4'], // Signatera, Reveal MRD
    category: 'MRD',
    keyTakeaways: [
      'Signatera is tumor-informed (requires tissue), Guardant Reveal is tumor-naive (blood only)',
      'Signatera is NCCN-named for colorectal cancer surveillance',
      'Guardant Reveal has faster initial turnaround (no custom assay design)',
      'Both have Medicare coverage through MolDX',
    ],
    faq: [
      {
        q: 'Which test is more sensitive?',
        a: 'Signatera claims higher analytical sensitivity (0.01% VAF) due to its tumor-informed approach tracking 16 patient-specific variants. Guardant Reveal uses methylation + genomic markers for broader detection without tissue.'
      },
      {
        q: 'Do I need tumor tissue for these tests?',
        a: 'Signatera requires tumor tissue to design the personalized assay. Guardant Reveal only needs a blood draw, making it suitable when tissue is unavailable.'
      },
      {
        q: 'Which cancers are covered?',
        a: 'Both cover colorectal, breast, and lung cancer. Signatera has broader cancer type coverage across solid tumors.'
      }
    ]
  },
  'galleri-vs-shield-mcd': {
    title: 'Galleri vs Shield MCD: Multi-Cancer Early Detection 2025',
    description: 'Compare GRAIL Galleri and Guardant Shield MCD multi-cancer screening tests. Sensitivity by stage, cancer types detected, and screening recommendations.',
    h1: 'Galleri vs Shield MCD',
    subtitle: 'Multi-Cancer Early Detection Blood Tests',
    testIds: ['ecd-2', 'ecd-10'], // Galleri, Shield MCD
    category: 'ECD',
    keyTakeaways: [
      'Galleri detects 50+ cancer types, Shield MCD covers multiple high-mortality cancers',
      'Both use methylation-based detection approaches',
      'Neither replaces standard screening (colonoscopy, mammography)',
      'Galleri has the largest clinical trial program (188,000+ participants)',
    ],
    faq: [
      {
        q: 'Can these tests replace colonoscopy?',
        a: 'No. Both tests complement, not replace, guideline-recommended screening. A negative result does not mean cancer is absent.'
      },
      {
        q: 'What is the sensitivity for early-stage cancer?',
        a: 'Multi-cancer detection sensitivity is lower for early stages (~20-40% for Stage I) compared to late stages (~90%+ for Stage IV). This is a key limitation of all MCED tests.'
      },
      {
        q: 'Are these FDA approved?',
        a: 'Shield received FDA approval for colorectal cancer screening. Galleri is available as a lab-developed test (LDT) while pursuing FDA approval.'
      }
    ]
  },
  'foundationone-vs-guardant360': {
    title: 'FoundationOne CDx vs Guardant360: CGP Test Comparison 2025',
    description: 'Compare FoundationOne CDx (tissue) and Guardant360 (liquid biopsy) for comprehensive genomic profiling. FDA companion diagnostics, genes covered, turnaround time.',
    h1: 'FoundationOne CDx vs Guardant360',
    subtitle: 'Tissue vs Liquid Biopsy CGP',
    testIds: ['tds-1', 'tds-3'], // FoundationOne CDx, Guardant360 CDx
    category: 'TDS',
    keyTakeaways: [
      'FoundationOne CDx: 324 genes, 57 FDA companion diagnostics (tissue-based)',
      'Guardant360: 74-739 genes (expanded version), liquid biopsy convenience',
      'Tissue provides more complete profiling; liquid enables serial monitoring',
      'Both have broad Medicare and commercial coverage',
    ],
    faq: [
      {
        q: 'Which test should I choose?',
        a: 'If adequate tissue is available and you want comprehensive profiling, FoundationOne CDx offers more FDA companion diagnostics. If tissue is limited or you need faster results, Guardant360 liquid biopsy is a strong alternative.'
      },
      {
        q: 'Can liquid biopsy miss mutations?',
        a: 'Yes. Low tumor shedding or early-stage disease may result in false negatives on liquid biopsy. Tissue testing remains the gold standard for initial therapy selection when available.'
      },
      {
        q: 'What is the turnaround time?',
        a: 'Guardant360 typically returns results in 7-10 days. FoundationOne CDx takes 10-14 days from tissue receipt.'
      }
    ]
  },
  'mrd-tests-2025': {
    title: 'Best MRD Tests 2025: Complete Comparison Guide',
    description: 'Compare all MRD tests for cancer recurrence monitoring: Signatera, Guardant Reveal, clonoSEQ, Oncodetect, and more. Sensitivity, coverage, pricing.',
    h1: 'MRD Test Comparison 2025',
    subtitle: 'Molecular Residual Disease Testing Options',
    testIds: ['mrd-1', 'mrd-4', 'mrd-2', 'mrd-5', 'mrd-6'], // Top MRD tests
    category: 'MRD',
    keyTakeaways: [
      'Tumor-informed tests (Signatera, Oncodetect) offer higher sensitivity but require tissue',
      'Tumor-naive tests (Guardant Reveal) work without tissue but may be less sensitive',
      'clonoSEQ is the only FDA-approved MRD test (for blood cancers)',
      'Medicare covers most MRD tests through MolDX LCD',
    ],
    faq: [
      {
        q: 'What is MRD testing?',
        a: 'MRD (Molecular Residual Disease) testing detects tiny amounts of cancer DNA in blood after treatment, identifying recurrence risk months before imaging can detect tumors.'
      },
      {
        q: 'How often should MRD testing be done?',
        a: 'Surveillance frequency varies by cancer type and risk. Many protocols test every 3-6 months for 2-3 years, then annually. Your oncologist will determine the appropriate schedule.'
      },
      {
        q: 'Does insurance cover MRD testing?',
        a: 'Medicare covers most MRD tests through MolDX. Commercial coverage varies by payer and indication. Many vendors offer financial assistance programs.'
      }
    ]
  },
  'tumor-informed-vs-tumor-naive': {
    title: 'Tumor-Informed vs Tumor-Naive MRD Tests: Which is Better?',
    description: 'Compare tumor-informed (personalized) and tumor-naive (fixed panel) approaches to ctDNA MRD testing. Sensitivity, tissue requirements, turnaround time.',
    h1: 'Tumor-Informed vs Tumor-Naive MRD',
    subtitle: 'Understanding MRD Test Methodologies',
    testIds: ['mrd-1', 'mrd-4'], // Signatera (informed) vs Reveal (naive)
    category: 'MRD',
    keyTakeaways: [
      'Tumor-informed: Higher sensitivity, requires tissue, longer initial setup (2-4 weeks)',
      'Tumor-naive: No tissue needed, faster results, may have lower sensitivity',
      'Both approaches have clinical utility; choice depends on patient situation',
      'Tumor-informed tracks YOUR specific mutations; tumor-naive uses common cancer markers',
    ],
    faq: [
      {
        q: 'What if I don\'t have tumor tissue?',
        a: 'Tumor-naive tests like Guardant Reveal only require blood. If tissue was not preserved from surgery, tumor-naive testing is your option.'
      },
      {
        q: 'Is tumor-informed always better?',
        a: 'Not necessarily. While tumor-informed tests may have higher analytical sensitivity, tumor-naive tests can detect new mutations that weren\'t in your original tumor. The clinical significance depends on your specific situation.'
      },
      {
        q: 'Can I switch between test types?',
        a: 'Yes. Some patients use tumor-naive testing initially for speed, then switch to tumor-informed for long-term surveillance once the personalized assay is ready.'
      }
    ]
  }
};

// Get all tests from all categories
const getAllTests = () => [...mrdTestData, ...ecdTestData, ...trmTestData, ...tdsTestData];

const ComparePage = ({ comparisonSlug, onNavigate }) => {
  const comparison = COMPARISON_PAGES[comparisonSlug];
  
  const tests = useMemo(() => {
    if (!comparison) return [];
    const allTests = getAllTests();
    return comparison.testIds
      .map(id => allTests.find(t => t.id === id))
      .filter(Boolean);
  }, [comparison]);

  if (!comparison) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Comparison Not Found</h1>
          <button 
            onClick={() => onNavigate('HOME')}
            className="text-emerald-600 hover:text-emerald-700"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* SEO Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="text-sm mb-4">
            <button onClick={() => onNavigate('HOME')} className="text-slate-400 hover:text-white">Home</button>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-slate-300">Compare</span>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-white">{comparison.h1}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{comparison.h1}</h1>
          <p className="text-xl text-slate-300">{comparison.subtitle}</p>
          <p className="mt-4 text-slate-400 max-w-2xl">{comparison.description}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Key Takeaways */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Key Takeaways</h2>
          <ul className="space-y-3">
            {comparison.keyTakeaways.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <span className="text-slate-700">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 overflow-x-auto">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Quick Comparison</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 text-slate-600 font-medium">Metric</th>
                {tests.map(test => (
                  <th key={test.id} className="text-left py-3 px-2 text-slate-800 font-semibold">
                    {test.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-2 text-slate-600">Vendor</td>
                {tests.map(test => (
                  <td key={test.id} className="py-3 px-2 text-slate-800">{test.vendor}</td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-2 text-slate-600">Approach</td>
                {tests.map(test => (
                  <td key={test.id} className="py-3 px-2 text-slate-800">{test.approach || test.method || '-'}</td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-2 text-slate-600">Sensitivity</td>
                {tests.map(test => (
                  <td key={test.id} className="py-3 px-2 text-slate-800">
                    {test.sensitivity ? `${test.sensitivity}%` : '-'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-2 text-slate-600">Specificity</td>
                {tests.map(test => (
                  <td key={test.id} className="py-3 px-2 text-slate-800">
                    {test.specificity ? `${test.specificity}%${test.specificityPlus ? '+' : ''}` : '-'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-2 text-slate-600">Turnaround Time</td>
                {tests.map(test => (
                  <td key={test.id} className="py-3 px-2 text-slate-800">
                    {test.tat ? `${test.tat} days` : '-'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-2 text-slate-600">FDA Status</td>
                {tests.map(test => (
                  <td key={test.id} className="py-3 px-2 text-slate-800">{test.fdaStatus || '-'}</td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-2 text-slate-600">Medicare Coverage</td>
                {tests.map(test => (
                  <td key={test.id} className="py-3 px-2 text-slate-800">{test.reimbursement || '-'}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs text-slate-500">
            Data from OpenOnco database. Performance metrics from vendor publications and regulatory submissions.
          </p>
        </section>

        {/* Detailed Test Cards */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Test Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {tests.map(test => (
              <button 
                key={test.id}
                onClick={() => onNavigate(comparison.category, test.id)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-left hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{test.name}</h3>
                    <p className="text-sm text-slate-500">{test.vendor}</p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    {test.fdaStatus || 'LDT'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-3">
                  {test.technologyDifferentiator || test.method || 'Click to view full details'}
                </p>
                <p className="mt-3 text-sm text-emerald-600 font-medium">
                  View full details →
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {comparison.faq.map((item, i) => (
              <div key={i}>
                <h3 className="font-semibold text-slate-800 mb-2">{item.q}</h3>
                <p className="text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-6 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Need Help Deciding?</h2>
          <p className="text-slate-600 mb-4">
            Use our interactive comparison tool to compare any tests side-by-side with detailed metrics.
          </p>
          <button
            onClick={() => onNavigate(comparison.category)}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Explore All {comparison.category} Tests
            <span>→</span>
          </button>
        </section>

        {/* Schema.org structured data (rendered as JSON-LD) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": comparison.title,
            "description": comparison.description,
            "author": {
              "@type": "Organization",
              "name": "OpenOnco"
            },
            "publisher": {
              "@type": "Organization",
              "name": "OpenOnco",
              "url": "https://www.openonco.org"
            }
          })
        }} />
      </div>
    </div>
  );
};

export { ComparePage };
export default ComparePage;
