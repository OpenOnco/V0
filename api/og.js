/**
 * Prerender API for SEO / Link Previews
 * 
 * Returns full HTML with content + OG tags for crawlers.
 * Called by Vercel rewrites when crawler user-agents are detected.
 */

// Test data mapping
const TEST_INFO = {
  // MRD Tests
  'signatera': { id: 'mrd-1', name: 'Signatera', vendor: 'Natera', category: 'MRD', approach: 'Tumor-informed', sensitivity: 99.4, specificity: 99.9, tat: 14, fdaStatus: 'LDT', reimbursement: 'Medicare (MolDX)', desc: 'Tumor-informed MRD test for solid tumors. Tracks 16 patient-specific variants for recurrence monitoring.' },
  'guardant-reveal': { id: 'mrd-4', name: 'Guardant Reveal', vendor: 'Guardant Health', category: 'MRD', approach: 'Tumor-naive', sensitivity: 91, specificity: 100, tat: 7, fdaStatus: 'LDT', reimbursement: 'Medicare (MolDX)', desc: 'Tumor-naive MRD test using methylation and mutation analysis for solid tumor monitoring.' },
  'clonoseq': { id: 'mrd-2', name: 'clonoSEQ', vendor: 'Adaptive Biotechnologies', category: 'MRD', approach: 'Tumor-informed', sensitivity: 95, specificity: 99.9, tat: 7, fdaStatus: 'FDA Approved', reimbursement: 'Medicare', desc: 'FDA-approved MRD test for B-cell malignancies including ALL, MM, and CLL.' },
  'oncodetect': { id: 'mrd-5', name: 'Oncodetect', vendor: 'Haystack Oncology', category: 'MRD', approach: 'Tumor-informed', sensitivity: 99, specificity: 99.5, tat: 14, fdaStatus: 'LDT', reimbursement: 'Medicare (MolDX)', desc: 'Ultra-sensitive tumor-informed MRD test for solid tumors with enhanced detection.' },
  'next-personal-dx': { id: 'mrd-6', name: 'NeXT Personal Dx', vendor: 'Personalis', category: 'MRD', approach: 'Tumor-informed (WGS)', sensitivity: 98, specificity: 99.8, tat: 21, fdaStatus: 'LDT', reimbursement: 'Medicare', desc: 'Clinical whole-genome MRD assay for personalized cancer monitoring.' },
  'radar': { id: 'mrd-7', name: 'RaDaR', vendor: 'NeoGenomics', category: 'MRD', approach: 'Tumor-informed', sensitivity: 97, specificity: 99.5, tat: 14, fdaStatus: 'LDT', reimbursement: 'Medicare (MolDX)', desc: 'Tumor-informed MRD assay for solid tumor recurrence monitoring.' },
  'phasedseq': { id: 'mrd-8', name: 'PhasED-Seq', vendor: 'Foresight Diagnostics', category: 'MRD', approach: 'Tumor-informed', sensitivity: 99, specificity: 99.9, tat: 14, fdaStatus: 'LDT', reimbursement: 'Medicare', desc: 'Phased variant MRD detection with enhanced sensitivity for solid tumors.' },
  'foresight-clarity': { id: 'mrd-9', name: 'Foresight CLARITY', vendor: 'Foresight Diagnostics', category: 'MRD', approach: 'Tumor-informed', sensitivity: 99, specificity: 99.9, tat: 14, fdaStatus: 'LDT', reimbursement: 'Medicare', desc: 'MRD test using phased variant detection technology.' },
  
  // ECD Tests
  'galleri': { id: 'ecd-2', name: 'Galleri', vendor: 'GRAIL', category: 'ECD', approach: 'Methylation', sensitivity: 51.5, specificity: 99.5, tat: 14, fdaStatus: 'LDT', reimbursement: 'Limited', desc: 'Multi-cancer early detection test capable of detecting signals from 50+ cancer types.' },
  'shield': { id: 'ecd-1', name: 'Shield', vendor: 'Guardant Health', category: 'ECD', approach: 'Methylation + Mutation', sensitivity: 83.1, specificity: 89.6, tat: 10, fdaStatus: 'FDA Approved', reimbursement: 'Medicare', desc: 'Blood-based colorectal cancer screening test. FDA-approved alternative to colonoscopy.' },
  'shield-mcd': { id: 'ecd-10', name: 'Shield MCD', vendor: 'Guardant Health', category: 'ECD', approach: 'Multi-cancer methylation', sensitivity: 60, specificity: 98.5, tat: 14, fdaStatus: 'Investigational', reimbursement: 'None', desc: 'Multi-cancer early detection screening test from Guardant Health.' },
  'cologuard-plus': { id: 'ecd-3', name: 'Cologuard Plus', vendor: 'Exact Sciences', category: 'ECD', approach: 'Stool DNA', sensitivity: 93.9, specificity: 91, tat: 5, fdaStatus: 'FDA Approved', reimbursement: 'Medicare', desc: 'Next-generation stool DNA test for colorectal cancer screening.' },
  'oncoguard-liver': { id: 'ecd-4', name: 'Oncoguard Liver', vendor: 'Exact Sciences', category: 'ECD', approach: 'Blood-based', sensitivity: 88, specificity: 87, tat: 14, fdaStatus: 'LDT', reimbursement: 'Medicare', desc: 'Blood test for hepatocellular carcinoma detection.' },
  'cancerguard': { id: 'ecd-11', name: 'CancerGuard', vendor: 'Exact Sciences', category: 'ECD', approach: 'Multi-cancer methylation', sensitivity: 64, specificity: 97.4, tat: 14, fdaStatus: 'LDT', reimbursement: 'Limited', desc: 'Multi-cancer early detection test from Exact Sciences.' },
  
  // TDS/CGP Tests
  'foundationone-cdx': { id: 'tds-1', name: 'FoundationOne CDx', vendor: 'Foundation Medicine', category: 'TDS', approach: 'Tissue CGP (324 genes)', sensitivity: null, specificity: null, tat: 14, fdaStatus: 'FDA Approved (57 CDx)', reimbursement: 'Medicare + Commercial', desc: 'Comprehensive genomic profiling with 300+ genes. FDA-approved companion diagnostic.' },
  'foundationone-liquid-cdx': { id: 'tds-2', name: 'FoundationOne Liquid CDx', vendor: 'Foundation Medicine', category: 'TDS', approach: 'Liquid biopsy CGP', sensitivity: null, specificity: null, tat: 10, fdaStatus: 'FDA Approved', reimbursement: 'Medicare + Commercial', desc: 'Blood-based comprehensive genomic profiling for solid tumors.' },
  'guardant360-cdx': { id: 'tds-3', name: 'Guardant360 CDx', vendor: 'Guardant Health', category: 'TDS', approach: 'Liquid biopsy (74 genes)', sensitivity: null, specificity: null, tat: 7, fdaStatus: 'FDA Approved', reimbursement: 'Medicare + Commercial', desc: 'FDA-approved liquid biopsy CGP panel for solid tumors.' },
  'guardant360': { id: 'tds-4', name: 'Guardant360', vendor: 'Guardant Health', category: 'TDS', approach: 'Liquid biopsy CGP', sensitivity: null, specificity: null, tat: 7, fdaStatus: 'LDT', reimbursement: 'Medicare + Commercial', desc: 'Liquid biopsy comprehensive genomic profiling panel.' },
  'tempus-xt': { id: 'tds-5', name: 'Tempus xT', vendor: 'Tempus', category: 'TDS', approach: 'Tissue CGP (648 genes)', sensitivity: null, specificity: null, tat: 10, fdaStatus: 'FDA Approved', reimbursement: 'Medicare + Commercial', desc: '648-gene DNA sequencing panel with RNA fusion detection.' },
  'msk-impact': { id: 'tds-6', name: 'MSK-IMPACT', vendor: 'Memorial Sloan Kettering', category: 'TDS', approach: 'Tissue CGP (500+ genes)', sensitivity: null, specificity: null, tat: 21, fdaStatus: 'FDA Authorized', reimbursement: 'Medicare', desc: 'FDA-authorized 500+ gene tumor profiling panel.' },
};

// Category info
const CATEGORY_INFO = {
  'mrd': { 
    name: 'MRD Monitoring Tests', 
    fullName: 'Minimal Residual Disease',
    desc: 'Compare Minimal Residual Disease tests for cancer recurrence monitoring. Includes Signatera, Guardant Reveal, clonoSEQ and more.',
    longDesc: 'MRD (Minimal Residual Disease) tests detect tiny amounts of cancer DNA circulating in the blood after treatment. These liquid biopsy tests can identify cancer recurrence months before imaging studies, enabling earlier intervention.',
    testCount: 18
  },
  'ecd': { 
    name: 'Early Detection Tests', 
    fullName: 'Early Cancer Detection',
    desc: 'Compare early cancer detection and screening tests including Galleri, Shield, and multi-cancer detection assays.',
    longDesc: 'Early cancer detection tests screen for cancer in asymptomatic individuals. Multi-cancer early detection (MCED) tests can detect signals from 50+ cancer types, while single-cancer tests focus on specific cancers like colorectal or liver.',
    testCount: 13
  },
  'trm': { 
    name: 'Treatment Response Tests', 
    fullName: 'Treatment Response Monitoring',
    desc: 'Compare treatment response monitoring tests to track if cancer therapy is working.',
    longDesc: 'Treatment response monitoring tests track ctDNA levels during therapy to assess whether treatment is working. Rising ctDNA may indicate resistance before imaging shows progression.',
    testCount: 10
  },
  'tds': { 
    name: 'Genomic Profiling Tests', 
    fullName: 'Treatment Decision Support / CGP',
    desc: 'Compare comprehensive genomic profiling panels including FoundationOne, Guardant360, and Tempus for treatment decisions.',
    longDesc: 'Comprehensive genomic profiling (CGP) panels analyze hundreds of cancer-related genes to identify targetable mutations, guide therapy selection, and match patients to clinical trials. Available as tissue-based or liquid biopsy tests.',
    testCount: 15
  },
  'cgp': { 
    name: 'Genomic Profiling Tests', 
    fullName: 'Comprehensive Genomic Profiling',
    desc: 'Compare comprehensive genomic profiling panels for identifying targetable mutations and treatment options.',
    longDesc: 'Comprehensive genomic profiling identifies mutations, fusions, and biomarkers across hundreds of genes to guide targeted therapy and immunotherapy decisions.',
    testCount: 15
  },
};

// Comparison page content
const COMPARISON_PAGES = {
  'signatera-vs-guardant-reveal': {
    title: 'Signatera vs Guardant Reveal: MRD Test Comparison 2025',
    description: 'Compare Signatera and Guardant Reveal MRD tests side-by-side. Sensitivity, specificity, turnaround time, Medicare coverage, and clinical validation data.',
    h1: 'Signatera vs Guardant Reveal',
    subtitle: 'Tumor-informed vs Tumor-naive MRD Testing',
    testSlugs: ['signatera', 'guardant-reveal'],
    category: 'MRD',
    keyTakeaways: [
      'Signatera is tumor-informed (requires tissue), Guardant Reveal is tumor-naive (blood only)',
      'Signatera is NCCN-named for colorectal cancer surveillance',
      'Guardant Reveal has faster initial turnaround (no custom assay design)',
      'Both have Medicare coverage through MolDX',
    ],
    faq: [
      { q: 'Which test is more sensitive?', a: 'Signatera claims higher analytical sensitivity (0.01% VAF) due to its tumor-informed approach tracking 16 patient-specific variants. Guardant Reveal uses methylation + genomic markers for broader detection without tissue.' },
      { q: 'Do I need tumor tissue for these tests?', a: 'Signatera requires tumor tissue to design the personalized assay. Guardant Reveal only needs a blood draw, making it suitable when tissue is unavailable.' },
      { q: 'Which cancers are covered?', a: 'Both cover colorectal, breast, and lung cancer. Signatera has broader cancer type coverage across solid tumors.' }
    ]
  },
  'galleri-vs-shield-mcd': {
    title: 'Galleri vs Shield MCD: Multi-Cancer Early Detection 2025',
    description: 'Compare GRAIL Galleri and Guardant Shield MCD multi-cancer screening tests. Sensitivity by stage, cancer types detected, and screening recommendations.',
    h1: 'Galleri vs Shield MCD',
    subtitle: 'Multi-Cancer Early Detection Blood Tests',
    testSlugs: ['galleri', 'shield-mcd'],
    category: 'ECD',
    keyTakeaways: [
      'Galleri detects 50+ cancer types, Shield MCD covers multiple high-mortality cancers',
      'Both use methylation-based detection approaches',
      'Neither replaces standard screening (colonoscopy, mammography)',
      'Galleri has the largest clinical trial program (188,000+ participants)',
    ],
    faq: [
      { q: 'Can these tests replace colonoscopy?', a: 'No. Both tests complement, not replace, guideline-recommended screening. A negative result does not mean cancer is absent.' },
      { q: 'What is the sensitivity for early-stage cancer?', a: 'Multi-cancer detection sensitivity is lower for early stages (~20-40% for Stage I) compared to late stages (~90%+ for Stage IV). This is a key limitation of all MCED tests.' },
      { q: 'Are these FDA approved?', a: 'Shield received FDA approval for colorectal cancer screening. Galleri is available as a lab-developed test (LDT) while pursuing FDA approval.' }
    ]
  },
  'foundationone-vs-guardant360': {
    title: 'FoundationOne CDx vs Guardant360: CGP Test Comparison 2025',
    description: 'Compare FoundationOne CDx (tissue) and Guardant360 (liquid biopsy) for comprehensive genomic profiling. FDA companion diagnostics, genes covered, turnaround time.',
    h1: 'FoundationOne CDx vs Guardant360',
    subtitle: 'Tissue vs Liquid Biopsy CGP',
    testSlugs: ['foundationone-cdx', 'guardant360-cdx'],
    category: 'TDS',
    keyTakeaways: [
      'FoundationOne CDx: 324 genes, 57 FDA companion diagnostics (tissue-based)',
      'Guardant360: 74 genes in CDx version, liquid biopsy convenience',
      'Tissue provides more complete profiling; liquid enables serial monitoring',
      'Both have broad Medicare and commercial coverage',
    ],
    faq: [
      { q: 'Which test should I choose?', a: 'If adequate tissue is available and you want comprehensive profiling, FoundationOne CDx offers more FDA companion diagnostics. If tissue is limited or you need faster results, Guardant360 liquid biopsy is a strong alternative.' },
      { q: 'Can liquid biopsy miss mutations?', a: 'Yes. Low tumor shedding or early-stage disease may result in false negatives on liquid biopsy. Tissue testing remains the gold standard for initial therapy selection when available.' },
      { q: 'What is the turnaround time?', a: 'Guardant360 typically returns results in 7-10 days. FoundationOne CDx takes 10-14 days from tissue receipt.' }
    ]
  },
  'mrd-tests-2025': {
    title: 'Best MRD Tests 2025: Complete Comparison Guide',
    description: 'Compare all MRD tests for cancer recurrence monitoring: Signatera, Guardant Reveal, clonoSEQ, Oncodetect, and more. Sensitivity, coverage, pricing.',
    h1: 'MRD Test Comparison 2025',
    subtitle: 'Molecular Residual Disease Testing Options',
    testSlugs: ['signatera', 'guardant-reveal', 'clonoseq', 'oncodetect', 'next-personal-dx'],
    category: 'MRD',
    keyTakeaways: [
      'Tumor-informed tests (Signatera, Oncodetect) offer higher sensitivity but require tissue',
      'Tumor-naive tests (Guardant Reveal) work without tissue but may be less sensitive',
      'clonoSEQ is the only FDA-approved MRD test (for blood cancers)',
      'Medicare covers most MRD tests through MolDX LCD',
    ],
    faq: [
      { q: 'What is MRD testing?', a: 'MRD (Molecular Residual Disease) testing detects tiny amounts of cancer DNA in blood after treatment, identifying recurrence risk months before imaging can detect tumors.' },
      { q: 'How often should MRD testing be done?', a: 'Surveillance frequency varies by cancer type and risk. Many protocols test every 3-6 months for 2-3 years, then annually. Your oncologist will determine the appropriate schedule.' },
      { q: 'Does insurance cover MRD testing?', a: 'Medicare covers most MRD tests through MolDX. Commercial coverage varies by payer and indication. Many vendors offer financial assistance programs.' }
    ]
  },
  'tumor-informed-vs-tumor-naive': {
    title: 'Tumor-Informed vs Tumor-Naive MRD Tests: Which is Better?',
    description: 'Compare tumor-informed (personalized) and tumor-naive (fixed panel) approaches to ctDNA MRD testing. Sensitivity, tissue requirements, turnaround time.',
    h1: 'Tumor-Informed vs Tumor-Naive MRD',
    subtitle: 'Understanding MRD Test Methodologies',
    testSlugs: ['signatera', 'guardant-reveal'],
    category: 'MRD',
    keyTakeaways: [
      'Tumor-informed: Higher sensitivity, requires tissue, longer initial setup (2-4 weeks)',
      'Tumor-naive: No tissue needed, faster results, may have lower sensitivity',
      'Both approaches have clinical utility; choice depends on patient situation',
      'Tumor-informed tracks YOUR specific mutations; tumor-naive uses common cancer markers',
    ],
    faq: [
      { q: 'What if I don\'t have tumor tissue?', a: 'Tumor-naive tests like Guardant Reveal only require blood. If tissue was not preserved from surgery, tumor-naive testing is your option.' },
      { q: 'Is tumor-informed always better?', a: 'Not necessarily. While tumor-informed tests may have higher analytical sensitivity, tumor-naive tests can detect new mutations that weren\'t in your original tumor.' },
      { q: 'Can I switch between test types?', a: 'Yes. Some patients use tumor-naive testing initially for speed, then switch to tumor-informed for long-term surveillance once the personalized assay is ready.' }
    ]
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateTestPageHtml({ test, category, url }) {
  const title = `${test.name} by ${test.vendor} | OpenOnco`;
  const image = `https://www.openonco.org/api/og-image?type=test&test=${encodeURIComponent(test.name)}&vendor=${encodeURIComponent(test.vendor)}&category=${category}`;
  
  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "MedicalTest",
    "name": test.name,
    "description": test.desc,
    "manufacturer": { "@type": "Organization", "name": test.vendor },
    "usesDevice": { "@type": "MedicalDevice", "name": test.name },
    "relevantSpecialty": { "@type": "MedicalSpecialty", "name": "Oncology" }
  };

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(test.desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(test.desc)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="OpenOnco">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(test.desc)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>
</head>
<body>
  <header>
    <nav><a href="https://www.openonco.org">OpenOnco</a> / <a href="https://www.openonco.org/${category.toLowerCase()}">${category}</a> / ${escapeHtml(test.name)}</nav>
  </header>
  <main>
    <article>
      <h1>${escapeHtml(test.name)}</h1>
      <p><strong>Vendor:</strong> ${escapeHtml(test.vendor)}</p>
      <p><strong>Category:</strong> ${escapeHtml(category)} (${escapeHtml(CATEGORY_INFO[category.toLowerCase()]?.fullName || category)})</p>
      <p>${escapeHtml(test.desc)}</p>
      
      <h2>Test Specifications</h2>
      <table>
        <tr><th>Approach</th><td>${escapeHtml(test.approach || 'Not specified')}</td></tr>
        ${test.sensitivity ? `<tr><th>Sensitivity</th><td>${test.sensitivity}%</td></tr>` : ''}
        ${test.specificity ? `<tr><th>Specificity</th><td>${test.specificity}%</td></tr>` : ''}
        <tr><th>Turnaround Time</th><td>${test.tat ? test.tat + ' days' : 'Not specified'}</td></tr>
        <tr><th>FDA Status</th><td>${escapeHtml(test.fdaStatus || 'Not specified')}</td></tr>
        <tr><th>Reimbursement</th><td>${escapeHtml(test.reimbursement || 'Varies')}</td></tr>
      </table>
      
      <p><a href="${escapeHtml(url)}">View full details on OpenOnco →</a></p>
    </article>
  </main>
  <footer>
    <p>© OpenOnco. Compare cancer diagnostic tests at <a href="https://www.openonco.org">openonco.org</a></p>
  </footer>
</body>
</html>`;
}

function generateCategoryPageHtml({ category, catInfo, url }) {
  const title = `${catInfo.name} | OpenOnco`;
  const image = `https://www.openonco.org/api/og-image?type=category&category=${category}`;
  
  const testsInCategory = Object.entries(TEST_INFO)
    .filter(([_, t]) => t.category.toLowerCase() === category)
    .map(([slug, t]) => t);

  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": catInfo.name,
    "description": catInfo.desc,
    "publisher": { "@type": "Organization", "name": "OpenOnco" }
  };

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(catInfo.desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(catInfo.desc)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="OpenOnco">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(catInfo.desc)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>
</head>
<body>
  <header>
    <nav><a href="https://www.openonco.org">OpenOnco</a> / ${escapeHtml(catInfo.name)}</nav>
  </header>
  <main>
    <h1>${escapeHtml(catInfo.name)}</h1>
    <p><strong>${escapeHtml(catInfo.fullName)}</strong></p>
    <p>${escapeHtml(catInfo.longDesc)}</p>
    
    <h2>Available Tests (${catInfo.testCount})</h2>
    <p>${escapeHtml(catInfo.desc)}</p>
    
    <ul>
      ${testsInCategory.map(t => `<li><strong>${escapeHtml(t.name)}</strong> by ${escapeHtml(t.vendor)} - ${escapeHtml(t.desc)}</li>`).join('\n      ')}
    </ul>
    
    <p><a href="${escapeHtml(url)}">View all ${category.toUpperCase()} tests and compare them on OpenOnco →</a></p>
  </main>
  <footer>
    <p>© OpenOnco. Compare cancer diagnostic tests at <a href="https://www.openonco.org">openonco.org</a></p>
  </footer>
</body>
</html>`;
}

function generateComparisonPageHtml({ comparison, slug, url }) {
  const tests = comparison.testSlugs.map(s => TEST_INFO[s]).filter(Boolean);
  const image = `https://www.openonco.org/api/og-image?type=compare&tests=${encodeURIComponent(comparison.testSlugs.join(','))}`;
  
  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": comparison.title,
    "description": comparison.description,
    "author": { "@type": "Organization", "name": "OpenOnco" },
    "publisher": { "@type": "Organization", "name": "OpenOnco", "url": "https://www.openonco.org" }
  };
  
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": comparison.faq.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  };

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(comparison.title)}</title>
  <meta name="description" content="${escapeHtml(comparison.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(comparison.title)}">
  <meta property="og:description" content="${escapeHtml(comparison.description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="OpenOnco">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(comparison.title)}">
  <meta name="twitter:description" content="${escapeHtml(comparison.description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
</head>
<body>
  <header>
    <nav><a href="https://www.openonco.org">OpenOnco</a> / <a href="https://www.openonco.org/${comparison.category.toLowerCase()}">${comparison.category}</a> / Compare</nav>
  </header>
  <main>
    <article>
      <h1>${escapeHtml(comparison.h1)}</h1>
      <p><em>${escapeHtml(comparison.subtitle)}</em></p>
      <p>${escapeHtml(comparison.description)}</p>
      
      <h2>Key Takeaways</h2>
      <ul>
        ${comparison.keyTakeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('\n        ')}
      </ul>
      
      <h2>Comparison Table</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            ${tests.map(t => `<th>${escapeHtml(t.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr><th>Vendor</th>${tests.map(t => `<td>${escapeHtml(t.vendor)}</td>`).join('')}</tr>
          <tr><th>Approach</th>${tests.map(t => `<td>${escapeHtml(t.approach || '-')}</td>`).join('')}</tr>
          <tr><th>Sensitivity</th>${tests.map(t => `<td>${t.sensitivity ? t.sensitivity + '%' : '-'}</td>`).join('')}</tr>
          <tr><th>Specificity</th>${tests.map(t => `<td>${t.specificity ? t.specificity + '%' : '-'}</td>`).join('')}</tr>
          <tr><th>Turnaround Time</th>${tests.map(t => `<td>${t.tat ? t.tat + ' days' : '-'}</td>`).join('')}</tr>
          <tr><th>FDA Status</th>${tests.map(t => `<td>${escapeHtml(t.fdaStatus || '-')}</td>`).join('')}</tr>
          <tr><th>Medicare Coverage</th>${tests.map(t => `<td>${escapeHtml(t.reimbursement || '-')}</td>`).join('')}</tr>
        </tbody>
      </table>
      
      <h2>Frequently Asked Questions</h2>
      ${comparison.faq.map(f => `
      <h3>${escapeHtml(f.q)}</h3>
      <p>${escapeHtml(f.a)}</p>
      `).join('')}
      
      <p><a href="${escapeHtml(url)}">View interactive comparison on OpenOnco →</a></p>
    </article>
  </main>
  <footer>
    <p>© OpenOnco. Compare cancer diagnostic tests at <a href="https://www.openonco.org">openonco.org</a></p>
  </footer>
</body>
</html>`;
}

function generateHomePageHtml({ url }) {
  const title = 'OpenOnco: Cancer Tests—Collected, Curated, Explained';
  const description = 'Compare 100+ liquid biopsy cancer tests across MRD, early detection, treatment response monitoring, and comprehensive genomic profiling. Non-profit, vendor-neutral resource.';
  const image = 'https://www.openonco.org/api/og-image?type=home';
  
  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "OpenOnco",
    "url": "https://www.openonco.org",
    "description": description,
    "publisher": { "@type": "Organization", "name": "OpenOnco" }
  };

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="OpenOnco">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>
</head>
<body>
  <header>
    <h1>OpenOnco</h1>
    <p>Cancer Tests—Collected, Curated, Explained</p>
  </header>
  <main>
    <p>${escapeHtml(description)}</p>
    
    <h2>Test Categories</h2>
    <ul>
      <li><a href="https://www.openonco.org/mrd"><strong>MRD - Minimal Residual Disease</strong></a>: ${CATEGORY_INFO.mrd.testCount} tests for cancer recurrence monitoring</li>
      <li><a href="https://www.openonco.org/ecd"><strong>ECD - Early Cancer Detection</strong></a>: ${CATEGORY_INFO.ecd.testCount} screening and early detection tests</li>
      <li><a href="https://www.openonco.org/trm"><strong>TRM - Treatment Response Monitoring</strong></a>: ${CATEGORY_INFO.trm.testCount} tests to track therapy effectiveness</li>
      <li><a href="https://www.openonco.org/tds"><strong>TDS - Treatment Decision Support</strong></a>: ${CATEGORY_INFO.tds.testCount} comprehensive genomic profiling panels</li>
    </ul>
    
    <h2>Popular Comparisons</h2>
    <ul>
      <li><a href="https://www.openonco.org/compare/signatera-vs-guardant-reveal">Signatera vs Guardant Reveal</a> - MRD test comparison</li>
      <li><a href="https://www.openonco.org/compare/galleri-vs-shield-mcd">Galleri vs Shield MCD</a> - Multi-cancer early detection</li>
      <li><a href="https://www.openonco.org/compare/foundationone-vs-guardant360">FoundationOne CDx vs Guardant360</a> - CGP comparison</li>
      <li><a href="https://www.openonco.org/compare/mrd-tests-2025">All MRD Tests 2025</a> - Complete MRD comparison guide</li>
    </ul>
    
    <h2>About OpenOnco</h2>
    <p>OpenOnco is a non-profit, vendor-neutral database of cancer diagnostic tests. We help patients, clinicians, and researchers compare liquid biopsy and molecular diagnostic tests with transparent data on sensitivity, specificity, turnaround time, coverage, and regulatory status.</p>
  </main>
  <footer>
    <p>© OpenOnco. <a href="https://www.openonco.org/about">About</a> | <a href="https://www.openonco.org/faq">FAQ</a></p>
  </footer>
</body>
</html>`;
}

export default function handler(req, res) {
  const { path: requestPath } = req.query;
  
  if (!requestPath) {
    return res.status(400).json({ error: 'Path required' });
  }
  
  // Normalize path
  let path = Array.isArray(requestPath) ? requestPath.join('/') : requestPath;
  path = '/' + path.replace(/^\\/+/, '');
  
  let html = null;
  const baseUrl = 'https://www.openonco.org';
  const url = `${baseUrl}${path}`;
  
  // Pattern: /compare/[slug]
  const compareMatch = path.match(/^\\/compare\\/([^\\/]+)\\/?$/i);
  if (compareMatch) {
    const slug = compareMatch[1].toLowerCase();
    const comparison = COMPARISON_PAGES[slug];
    if (comparison) {
      html = generateComparisonPageHtml({ comparison, slug, url });
    }
  }
  
  // Pattern: /test/[slug]
  const testMatch = path.match(/^\\/test\\/([^\\/]+)\\/?$/i);
  if (!html && testMatch) {
    const slug = testMatch[1].toLowerCase();
    const test = TEST_INFO[slug];
    if (test) {
      html = generateTestPageHtml({ test, category: test.category, url });
    }
  }
  
  // Pattern: /[category]/[slug] - supports both new and legacy URLs
  const categoryTestMatch = path.match(/^\\/(mrd|ecd|trm|tds|cgp|monitor|screen|treat|risk)\\/([^\\/]+)\\/?$/i);
  if (!html && categoryTestMatch) {
    const categoryPath = categoryTestMatch[1].toLowerCase();
    const slug = categoryTestMatch[2].toLowerCase();
    // Map new paths to old category codes for lookup
    const pathToCategory = { monitor: 'mrd', screen: 'ecd', treat: 'tds', risk: 'hct' };
    const category = pathToCategory[categoryPath] || categoryPath;
    const test = TEST_INFO[slug];
    if (test) {
      html = generateTestPageHtml({ test, category: test.category, url });
    }
  }
  
  // Pattern: /[category] (category page) - supports both new and legacy URLs
  const categoryMatch = path.match(/^\\/(mrd|ecd|trm|tds|cgp|monitor|screen|treat|risk)\\/?$/i);
  if (!html && categoryMatch) {
    const categoryPath = categoryMatch[1].toLowerCase();
    // Map new paths to old category codes for lookup
    const pathToCategory = { monitor: 'mrd', screen: 'ecd', treat: 'tds', risk: 'hct' };
    const category = pathToCategory[categoryPath] || categoryPath;
    const catInfo = CATEGORY_INFO[category];
    if (catInfo) {
      html = generateCategoryPageHtml({ category, catInfo, url });
    }
  }
  
  // Default: homepage or unknown
  if (!html) {
    html = generateHomePageHtml({ url });
  }
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
