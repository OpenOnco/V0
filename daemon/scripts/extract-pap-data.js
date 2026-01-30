/**
 * One-time PAP data extraction from captured vendor billing pages
 * Uses Claude API to extract structured financial assistance data
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const OUTPUT_FILE = join(__dirname, '../data/pap-extraction-results.json');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Vendor ID to test mapping (which tests each vendor makes)
const VENDOR_TEST_MAP = {
  'natera': ['mrd-5', 'tds-6', 'hct-12'], // Signatera, Altera, Empower
  'guardant': ['mrd-7', 'mrd-8', 'tds-2', 'tds-3', 'ecd-10'], // Reveal, Reveal+, 360 CDx, 360 TissueNext, Shield
  'foundation': ['tds-1', 'tds-4', 'tds-5'], // F1CDx, F1 Liquid CDx, F1Heme
  'grail': ['ecd-1'], // Galleri
  'exact-sciences': ['mrd-3', 'ecd-5', 'ecd-6', 'tds-11', 'tds-12'], // Oncodetect, Cancerguard, Oncoguard Liver, Oncotype DX
  'myriad': ['hct-1', 'hct-2', 'hct-3'], // myRisk, BRACAnalysis, MyChoice
  'tempus': ['tds-7', 'tds-8', 'tds-9'], // xT, xF, xR
  'adaptive': ['mrd-10'], // clonoSEQ
  'neogenomics': ['tds-15', 'mrd-15'], // NeoTYPE, RaDaR
  'caris': ['tds-10'], // MI Profile
  'invitae': ['hct-5', 'hct-6'], // Multi-Cancer Panel, Breast Cancer Panel
};

// PAP page URLs to vendor ID mapping
const URL_TO_VENDOR = {
  'natera.com': 'natera',
  'guardanthealth.com': 'guardant',
  'foundationmedicine.com': 'foundation',
  'galleri.com': 'grail',
  'exactsciences.com': 'exact-sciences',
  'myriad.com': 'myriad',
  'tempus.com': 'tempus',
  'adaptivebiotech': 'adaptive',
  'neogenomics.com': 'neogenomics',
  'carislifesciences.com': 'caris',
  'invitae.com': 'invitae',
};

function getVendorFromUrl(url) {
  for (const [domain, vendorId] of Object.entries(URL_TO_VENDOR)) {
    if (url.includes(domain)) return vendorId;
  }
  return null;
}

async function extractPAPData(vendorId, url, content) {
  console.log(`  Extracting PAP data for ${vendorId}...`);
  
  const prompt = `Extract financial assistance and patient access program information from this vendor billing page.

VENDOR: ${vendorId}
URL: ${url}

PAGE CONTENT:
${content.slice(0, 15000)}

Extract and return a JSON object with these fields (use null if not found):

{
  "vendorId": "${vendorId}",
  "programName": "Name of the financial assistance program",
  "maxOutOfPocket": "Maximum patient pays (e.g., '$100', '$0 for Medicaid')",
  "eligibilityCriteria": "Who qualifies (income-based, insurance status, etc.)",
  "medicaidCoverage": "Specific Medicaid terms if mentioned",
  "medicareCoverage": "Specific Medicare coverage details if mentioned",
  "applicationProcess": "How to apply (online form, phone, etc.)",
  "contactPhone": "Phone number for billing/assistance",
  "contactEmail": "Email for billing/assistance", 
  "contactFax": "Fax number if available",
  "paymentPlans": "Payment plan availability and terms",
  "priorAuthHelp": "Whether they help with prior authorizations",
  "appealsSupport": "Whether they help with insurance appeals",
  "selfPayPrice": "Cash/self-pay price if mentioned",
  "summaryForPatients": "2-3 sentence summary a patient would find helpful"
}

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    // Try to parse JSON, handling potential markdown wrapping
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error(`  Error extracting ${vendorId}:`, error.message);
    return { vendorId, error: error.message };
  }
}

async function main() {
  console.log('=== PAP Data Extraction ===\n');
  
  // Load captured PAP content
  const hashesPath = join(DATA_DIR, 'vendor-hashes.json');
  const hashes = JSON.parse(readFileSync(hashesPath, 'utf-8'));
  
  // Filter to PAP/billing pages only
  const papUrls = Object.keys(hashes).filter(url => 
    url.includes('billing') || 
    url.includes('patient') || 
    url.includes('financial') ||
    url.includes('coverage-cost') ||
    url.includes('assistance')
  );
  
  console.log(`Found ${papUrls.length} PAP pages to process\n`);
  
  const results = [];
  
  for (const url of papUrls) {
    const vendorId = getVendorFromUrl(url);
    if (!vendorId) {
      console.log(`Skipping unknown vendor: ${url}`);
      continue;
    }
    
    const content = hashes[url]?.content;
    if (!content || content.length < 100) {
      console.log(`Skipping ${vendorId}: insufficient content`);
      continue;
    }
    
    console.log(`Processing: ${vendorId} (${url})`);
    const extracted = await extractPAPData(vendorId, url, content);
    extracted.sourceUrl = url;
    extracted.affectedTests = VENDOR_TEST_MAP[vendorId] || [];
    results.push(extracted);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Save results
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n=== Extraction Complete ===`);
  console.log(`Results saved to: ${OUTPUT_FILE}`);
  console.log(`Processed ${results.length} vendors`);
  
  // Print summary
  console.log('\n=== Summary ===');
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.vendorId}: ${r.error}`);
    } else {
      console.log(`✅ ${r.vendorId}: ${r.programName || 'Program found'} - Max OOP: ${r.maxOutOfPocket || 'N/A'}`);
    }
  }
}

main().catch(console.error);
