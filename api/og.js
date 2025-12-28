/**
 * OG Meta Tag API for Link Previews
 * 
 * Returns HTML with dynamic OG tags for test/category URLs.
 * Called by Vercel rewrites when crawler user-agents are detected.
 */

// Test data mapping for OG previews
const TEST_INFO = {
  // MRD Tests
  'signatera': { name: 'Signatera', vendor: 'Natera', category: 'MRD', desc: 'Tumor-informed MRD test for solid tumors. Tracks 16 patient-specific variants for recurrence monitoring.' },
  'guardant-reveal': { name: 'Guardant Reveal', vendor: 'Guardant Health', category: 'MRD', desc: 'Tumor-naive MRD test using methylation and mutation analysis for solid tumor monitoring.' },
  'clonoSEQ': { name: 'clonoSEQ', vendor: 'Adaptive Biotechnologies', category: 'MRD', desc: 'FDA-approved MRD test for B-cell malignancies including ALL, MM, and CLL.' },
  'clonoSeq': { name: 'clonoSEQ', vendor: 'Adaptive Biotechnologies', category: 'MRD', desc: 'FDA-approved MRD test for B-cell malignancies including ALL, MM, and CLL.' },
  'clonoseq': { name: 'clonoSEQ', vendor: 'Adaptive Biotechnologies', category: 'MRD', desc: 'FDA-approved MRD test for B-cell malignancies including ALL, MM, and CLL.' },
  'oncodetect': { name: 'Oncodetect', vendor: 'Haystack Oncology', category: 'MRD', desc: 'Ultra-sensitive tumor-informed MRD test for solid tumors with enhanced detection.' },
  'next-personal': { name: 'NeXT Personal', vendor: 'Personalis', category: 'MRD', desc: 'Whole-genome MRD test tracking thousands of tumor-specific variants.' },
  'next-personal-dx': { name: 'NeXT Personal Dx', vendor: 'Personalis', category: 'MRD', desc: 'Clinical whole-genome MRD assay for personalized cancer monitoring.' },
  'radar': { name: 'RaDaR', vendor: 'NeoGenomics', category: 'MRD', desc: 'Tumor-informed MRD assay for solid tumor recurrence monitoring.' },
  'phasedseq': { name: 'PhasED-Seq', vendor: 'Foresight Diagnostics', category: 'MRD', desc: 'Phased variant MRD detection with enhanced sensitivity for solid tumors.' },
  'mrd-clarity': { name: 'MRD-CLARITY', vendor: 'Foresight Diagnostics', category: 'MRD', desc: 'Solid tumor MRD monitoring with phased variant technology.' },
  'foresight-clarity': { name: 'Foresight CLARITY', vendor: 'Foresight Diagnostics', category: 'MRD', desc: 'MRD test using phased variant detection technology.' },
  'signatera-genome': { name: 'Signatera Genome', vendor: 'Natera', category: 'MRD', desc: 'Whole-genome MRD test tracking expanded variant panel.' },
  'haystack-mrd': { name: 'Haystack MRD', vendor: 'Haystack Oncology', category: 'MRD', desc: 'Ultra-sensitive MRD detection for solid tumors.' },
  'invitae-mrd': { name: 'Invitae Personalized Cancer Monitoring', vendor: 'Invitae', category: 'MRD', desc: 'Tumor-informed MRD monitoring for solid tumors.' },
  'neogenomics-radar': { name: 'RaDaR', vendor: 'NeoGenomics', category: 'MRD', desc: 'Residual disease monitoring for solid tumors.' },
  'bespoke-tumor': { name: 'Bespoke Tumor Panel', vendor: 'Natera', category: 'MRD', desc: 'Custom tumor-informed MRD panel.' },
  
  // ECD Tests
  'shield': { name: 'Shield', vendor: 'Guardant Health', category: 'ECD', desc: 'Blood-based colorectal cancer screening test. FDA-approved alternative to colonoscopy.' },
  'galleri': { name: 'Galleri', vendor: 'GRAIL', category: 'ECD', desc: 'Multi-cancer early detection test capable of detecting signals from 50+ cancer types.' },
  'cologuard-plus': { name: 'Cologuard Plus', vendor: 'Exact Sciences', category: 'ECD', desc: 'Next-generation stool DNA test for colorectal cancer screening.' },
  'cologuard': { name: 'Cologuard', vendor: 'Exact Sciences', category: 'ECD', desc: 'FDA-approved stool DNA test for colorectal cancer screening.' },
  'cancerseek': { name: 'CancerSEEK', vendor: 'Exact Sciences', category: 'ECD', desc: 'Multi-cancer blood test detecting multiple cancer types.' },
  'firstlook-lung': { name: 'FirstLook Lung', vendor: 'Delfi Diagnostics', category: 'ECD', desc: 'Fragmentomics-based lung cancer early detection test.' },
  'oncoguard-liver': { name: 'Oncoguard Liver', vendor: 'Exact Sciences', category: 'ECD', desc: 'Blood test for hepatocellular carcinoma detection.' },
  'cancerguard': { name: 'CancerGuard', vendor: 'Guardant Health', category: 'ECD', desc: 'Multi-cancer early detection screening test.' },
  
  // TRM Tests
  'guardant360-response': { name: 'Guardant360 Response', vendor: 'Guardant Health', category: 'TRM', desc: 'Liquid biopsy for monitoring treatment response in solid tumors.' },
  'guardant-response': { name: 'Guardant Response', vendor: 'Guardant Health', category: 'TRM', desc: 'ctDNA-based treatment response monitoring.' },
  'signatera-response': { name: 'Signatera Response', vendor: 'Natera', category: 'TRM', desc: 'ctDNA-based treatment response monitoring.' },
  
  // TDS/CGP Tests
  'foundationone-cdx': { name: 'FoundationOne CDx', vendor: 'Foundation Medicine', category: 'TDS', desc: 'Comprehensive genomic profiling with 300+ genes. FDA-approved companion diagnostic.' },
  'foundationone-liquid-cdx': { name: 'FoundationOne Liquid CDx', vendor: 'Foundation Medicine', category: 'TDS', desc: 'Blood-based comprehensive genomic profiling for solid tumors.' },
  'foundationone-liquid': { name: 'FoundationOne Liquid', vendor: 'Foundation Medicine', category: 'TDS', desc: 'Liquid biopsy comprehensive genomic profiling.' },
  'guardant360-cdx': { name: 'Guardant360 CDx', vendor: 'Guardant Health', category: 'TDS', desc: 'FDA-approved liquid biopsy CGP panel for solid tumors.' },
  'guardant360': { name: 'Guardant360', vendor: 'Guardant Health', category: 'TDS', desc: 'Liquid biopsy comprehensive genomic profiling panel.' },
  'tempus-xt': { name: 'Tempus xT', vendor: 'Tempus', category: 'TDS', desc: '648-gene DNA sequencing panel with RNA fusion detection.' },
  'tempus-xf': { name: 'Tempus xF', vendor: 'Tempus', category: 'TDS', desc: 'Liquid biopsy genomic profiling panel.' },
  'tempus-xr': { name: 'Tempus xR', vendor: 'Tempus', category: 'TDS', desc: 'RNA sequencing panel for fusion and expression analysis.' },
  'msk-impact': { name: 'MSK-IMPACT', vendor: 'Memorial Sloan Kettering', category: 'TDS', desc: 'FDA-authorized 500+ gene tumor profiling panel.' },
  'oncotype-dx': { name: 'Oncotype DX', vendor: 'Exact Sciences', category: 'TDS', desc: 'Breast cancer recurrence score test for treatment decisions.' },
  'oncotype-dx-breast': { name: 'Oncotype DX Breast', vendor: 'Exact Sciences', category: 'TDS', desc: '21-gene breast cancer recurrence score.' },
  'oncotype-dx-colon': { name: 'Oncotype DX Colon', vendor: 'Exact Sciences', category: 'TDS', desc: '12-gene colon cancer recurrence score.' },
  'prosigna': { name: 'Prosigna', vendor: 'Veracyte', category: 'TDS', desc: 'PAM50-based breast cancer recurrence risk assessment.' },
  'mammaprint': { name: 'MammaPrint', vendor: 'Agendia', category: 'TDS', desc: '70-gene breast cancer prognosis test.' },
  'blueprint': { name: 'BluePrint', vendor: 'Agendia', category: 'TDS', desc: 'Breast cancer molecular subtyping test.' },
  'decipher-prostate': { name: 'Decipher Prostate', vendor: 'Veracyte', category: 'TDS', desc: 'Genomic classifier for prostate cancer prognosis.' },
  'altera': { name: 'Altera', vendor: 'Resolution Bioscience', category: 'TDS', desc: 'Liquid biopsy CGP panel for solid tumors.' },
  'inivata-invision': { name: 'InVision', vendor: 'Inivata', category: 'TDS', desc: 'Liquid biopsy genomic profiling panel.' },
  'resolution-ctdx': { name: 'Resolution ctDx', vendor: 'Resolution Bioscience', category: 'TDS', desc: 'Liquid biopsy comprehensive genomic panel.' },
};

// Category info
const CATEGORY_INFO = {
  'mrd': { name: 'MRD Monitoring Tests', desc: 'Compare Minimal Residual Disease tests for cancer recurrence monitoring. Includes Signatera, Guardant Reveal, clonoSEQ and more.' },
  'ecd': { name: 'Early Detection Tests', desc: 'Compare early cancer detection and screening tests including Galleri, Shield, and multi-cancer detection assays.' },
  'trm': { name: 'Treatment Response Tests', desc: 'Compare treatment response monitoring tests to track if cancer therapy is working.' },
  'tds': { name: 'Genomic Profiling Tests', desc: 'Compare comprehensive genomic profiling panels including FoundationOne, Guardant360, and Tempus for treatment decisions.' },
  'cgp': { name: 'Genomic Profiling Tests', desc: 'Compare comprehensive genomic profiling panels for identifying targetable mutations and treatment options.' },
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateOGHtml({ title, description, image, url }) {
  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook / LinkedIn / iMessage -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:site_name" content="OpenOnco">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@openonco">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${escapeHtml(url)}">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(url)}">View on OpenOnco</a></p>
</body>
</html>`;
}

export default function handler(req, res) {
  // Get the original path from query parameter
  const { path: requestPath } = req.query;
  
  if (!requestPath) {
    return res.status(400).json({ error: 'Path required' });
  }
  
  // Normalize path - handle both '/mrd/signatera' and 'mrd/signatera' formats
  let path = Array.isArray(requestPath) ? requestPath.join('/') : requestPath;
  // Ensure single leading slash
  path = '/' + path.replace(/^\/+/, '');
  
  let ogData = null;
  
  // Pattern: /test/[slug]
  const testMatch = path.match(/^\/test\/([^\/]+)\/?$/i);
  if (testMatch) {
    const slug = testMatch[1].toLowerCase();
    const test = TEST_INFO[slug];
    if (test) {
      ogData = {
        title: `${test.name} by ${test.vendor} | OpenOnco`,
        description: test.desc,
        image: 'https://www.openonco.org/og-image.png',
        url: `https://www.openonco.org${path}`,
      };
    }
  }
  
  // Pattern: /[category]/[slug]
  const categoryTestMatch = path.match(/^\/(mrd|ecd|trm|tds|cgp)\/([^\/]+)\/?$/i);
  if (categoryTestMatch && !ogData) {
    const slug = categoryTestMatch[2].toLowerCase();
    const test = TEST_INFO[slug];
    if (test) {
      ogData = {
        title: `${test.name} by ${test.vendor} | OpenOnco`,
        description: test.desc,
        image: 'https://www.openonco.org/og-image.png',
        url: `https://www.openonco.org${path}`,
      };
    }
  }
  
  // Pattern: /[category] (category page)
  const categoryMatch = path.match(/^\/(mrd|ecd|trm|tds|cgp)\/?$/i);
  if (categoryMatch && !ogData) {
    const cat = categoryMatch[1].toLowerCase();
    const catInfo = CATEGORY_INFO[cat];
    if (catInfo) {
      ogData = {
        title: `${catInfo.name} | OpenOnco`,
        description: catInfo.desc,
        image: 'https://www.openonco.org/og-image.png',
        url: `https://www.openonco.org${path}`,
      };
    }
  }
  
  // Default fallback
  if (!ogData) {
    ogData = {
      title: 'OpenOnco: Cancer Tests—Collected, Curated, Explained',
      description: 'Compare 60+ liquid biopsy cancer tests across MRD, early detection, treatment response monitoring, and comprehensive genomic profiling.',
      image: 'https://www.openonco.org/og-image.png',
      url: `https://www.openonco.org${path}`,
    };
  }
  
  // Return HTML with OG tags
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(generateOGHtml(ogData));
}
