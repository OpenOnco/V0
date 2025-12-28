/**
 * Vercel Edge Middleware for Dynamic OG Tags
 * 
 * Detects link preview crawlers (iMessage, Facebook, Twitter, LinkedIn, Slack)
 * and returns dynamic OG meta tags for test-specific URLs.
 * 
 * Regular users get the normal SPA.
 */

// Crawler user-agent patterns
const CRAWLER_PATTERNS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'WhatsApp',
  'TelegramBot',
  'Discordbot',
  'iMessagePreviews',
  'Applebot',
  'Pinterest',
  'vkShare',
  'W3C_Validator',
];

// Test data mapping - subset of key tests for OG previews
const TEST_INFO = {
  // MRD Tests
  'signatera': { name: 'Signatera', vendor: 'Natera', category: 'MRD', desc: 'Tumor-informed MRD test for solid tumors. Tracks 16 patient-specific variants for recurrence monitoring.' },
  'guardant-reveal': { name: 'Guardant Reveal', vendor: 'Guardant Health', category: 'MRD', desc: 'Tumor-naive MRD test using methylation and mutation analysis for solid tumor monitoring.' },
  'clonoSEQ': { name: 'clonoSEQ', vendor: 'Adaptive Biotechnologies', category: 'MRD', desc: 'FDA-approved MRD test for B-cell malignancies including ALL, MM, and CLL.' },
  'clonoSeq': { name: 'clonoSEQ', vendor: 'Adaptive Biotechnologies', category: 'MRD', desc: 'FDA-approved MRD test for B-cell malignancies including ALL, MM, and CLL.' },
  'oncodetect': { name: 'Oncodetect', vendor: 'Haystack Oncology', category: 'MRD', desc: 'Ultra-sensitive tumor-informed MRD test for solid tumors with enhanced detection.' },
  'next-personal': { name: 'NeXT Personal', vendor: 'Personalis', category: 'MRD', desc: 'Whole-genome MRD test tracking thousands of tumor-specific variants.' },
  'next-personal-dx': { name: 'NeXT Personal Dx', vendor: 'Personalis', category: 'MRD', desc: 'Clinical whole-genome MRD assay for personalized cancer monitoring.' },
  'radar': { name: 'RaDaR', vendor: 'NeoGenomics', category: 'MRD', desc: 'Tumor-informed MRD assay for solid tumor recurrence monitoring.' },
  'phasedsens': { name: 'PhasED-Seq', vendor: 'Foresight Diagnostics', category: 'MRD', desc: 'Phased variant MRD detection with enhanced sensitivity for solid tumors.' },
  'mrd-clarity': { name: 'MRD-CLARITY', vendor: 'Foresight Diagnostics', category: 'MRD', desc: 'Solid tumor MRD monitoring with phased variant technology.' },
  'signatera-genome': { name: 'Signatera Genome', vendor: 'Natera', category: 'MRD', desc: 'Whole-genome MRD test tracking expanded variant panel.' },
  'haystack-mrd': { name: 'Haystack MRD', vendor: 'Haystack Oncology', category: 'MRD', desc: 'Ultra-sensitive MRD detection for solid tumors.' },
  
  // ECD Tests
  'shield': { name: 'Shield', vendor: 'Guardant Health', category: 'ECD', desc: 'Blood-based colorectal cancer screening test. FDA-approved alternative to colonoscopy.' },
  'galleri': { name: 'Galleri', vendor: 'GRAIL', category: 'ECD', desc: 'Multi-cancer early detection test capable of detecting signals from 50+ cancer types.' },
  'cologuard-plus': { name: 'Cologuard Plus', vendor: 'Exact Sciences', category: 'ECD', desc: 'Next-generation stool DNA test for colorectal cancer screening.' },
  'cancerseek': { name: 'CancerSEEK', vendor: 'Exact Sciences', category: 'ECD', desc: 'Multi-cancer blood test detecting multiple cancer types.' },
  'firstlook-lung': { name: 'FirstLook Lung', vendor: 'Delfi Diagnostics', category: 'ECD', desc: 'Fragmentomics-based lung cancer early detection test.' },
  
  // TRM Tests
  'guardant360-response': { name: 'Guardant360 Response', vendor: 'Guardant Health', category: 'TRM', desc: 'Liquid biopsy for monitoring treatment response in solid tumors.' },
  'signatera-response': { name: 'Signatera Response', vendor: 'Natera', category: 'TRM', desc: 'ctDNA-based treatment response monitoring.' },
  
  // TDS/CGP Tests
  'foundationone-cdx': { name: 'FoundationOne CDx', vendor: 'Foundation Medicine', category: 'TDS', desc: 'Comprehensive genomic profiling with 300+ genes. FDA-approved companion diagnostic.' },
  'foundationone-liquid-cdx': { name: 'FoundationOne Liquid CDx', vendor: 'Foundation Medicine', category: 'TDS', desc: 'Blood-based comprehensive genomic profiling for solid tumors.' },
  'guardant360-cdx': { name: 'Guardant360 CDx', vendor: 'Guardant Health', category: 'TDS', desc: 'FDA-approved liquid biopsy CGP panel for solid tumors.' },
  'guardant360': { name: 'Guardant360', vendor: 'Guardant Health', category: 'TDS', desc: 'Liquid biopsy comprehensive genomic profiling panel.' },
  'tempus-xt': { name: 'Tempus xT', vendor: 'Tempus', category: 'TDS', desc: '648-gene DNA sequencing panel with RNA fusion detection.' },
  'tempus-xf': { name: 'Tempus xF', vendor: 'Tempus', category: 'TDS', desc: 'Liquid biopsy genomic profiling panel.' },
  'msk-impact': { name: 'MSK-IMPACT', vendor: 'Memorial Sloan Kettering', category: 'TDS', desc: 'FDA-authorized 500+ gene tumor profiling panel.' },
  'oncotype-dx': { name: 'Oncotype DX', vendor: 'Exact Sciences', category: 'TDS', desc: 'Breast cancer recurrence score test for treatment decisions.' },
  'oncotype-dx-breast': { name: 'Oncotype DX Breast', vendor: 'Exact Sciences', category: 'TDS', desc: '21-gene breast cancer recurrence score.' },
  'prosigna': { name: 'Prosigna', vendor: 'Veracyte', category: 'TDS', desc: 'PAM50-based breast cancer recurrence risk assessment.' },
};

// Category info for category pages
const CATEGORY_INFO = {
  'mrd': { name: 'MRD Monitoring Tests', desc: 'Compare Minimal Residual Disease tests for cancer recurrence monitoring. Includes Signatera, Guardant Reveal, clonoSEQ and more.' },
  'ecd': { name: 'Early Detection Tests', desc: 'Compare early cancer detection and screening tests including Galleri, Shield, and multi-cancer detection assays.' },
  'trm': { name: 'Treatment Response Tests', desc: 'Compare treatment response monitoring tests to track if cancer therapy is working.' },
  'tds': { name: 'Genomic Profiling Tests', desc: 'Compare comprehensive genomic profiling panels including FoundationOne, Guardant360, and Tempus for treatment decisions.' },
  'cgp': { name: 'Genomic Profiling Tests', desc: 'Compare comprehensive genomic profiling panels for identifying targetable mutations and treatment options.' },
};

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(pattern => ua.includes(pattern.toLowerCase()));
}

function generateOGHtml({ title, description, image, url }) {
  // Escape HTML entities
  const escape = (str) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escape(url)}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${escape(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="OpenOnco">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${escape(image)}">
</head>
<body></body>
</html>`;
}

export default function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Only intercept for crawlers
  if (!isCrawler(userAgent)) {
    return; // Pass through to normal handling
  }
  
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
  
  // Pattern: /[category]/[slug] (e.g., /mrd/signatera)
  const categoryTestMatch = path.match(/^\/(mrd|ecd|trm|tds|cgp)\/([^\/]+)\/?$/i);
  if (categoryTestMatch) {
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
  
  // Pattern: /[category] (category landing page)
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
  
  // If we have OG data, return custom HTML
  if (ogData) {
    return new Response(generateOGHtml(ogData), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  }
  
  // Otherwise pass through
  return;
}

// Vercel Edge Middleware config
export const config = {
  matcher: [
    '/test/:path*',
    '/mrd/:path*',
    '/ecd/:path*',
    '/trm/:path*',
    '/tds/:path*',
    '/cgp/:path*',
  ],
};
