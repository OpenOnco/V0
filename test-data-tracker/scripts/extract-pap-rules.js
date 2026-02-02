/**
 * Extract detailed PAP eligibility rules from application PDFs
 * Uses Claude to parse PDF content and extract structured rules
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(__dirname, '../data/pap-rules-extracted.json');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// PDFs to fetch and parse
const PDF_SOURCES = [
  {
    vendor: 'Foundation Medicine',
    url: 'https://www.foundationmedicine.com/sites/default/files/media/documents/2023-10/Patient_Financial_Assistance_Application_072020.pdf',
    name: 'Foundation Medicine FAP Application'
  },
  {
    vendor: 'Exact Sciences',
    url: 'https://www.exactsciences.com/-/media/project/precisiononcology/precisiononcology/files/pdf/exact-sciences_financial-assistance-application.pdf',
    name: 'Exact Sciences FAP Application'
  },
  {
    vendor: 'Tempus',
    url: 'https://www.tempus.com/wp-content/uploads/2025/04/Tempus-Onco_Financial-Assistance-Form.pdf',
    name: 'Tempus Financial Assistance Form'
  },
  {
    vendor: 'Caris Life Sciences',
    url: 'https://www.carislifesciences.com/wp-content/uploads/2022/06/TN0235-v6_Tumor-Financial-Assistance-Application_eForm.pdf',
    name: 'Caris Financial Assistance Application'
  },
  {
    vendor: 'Adaptive Biotechnologies',
    url: 'https://www.clonoseq.com/wp-content/uploads/2022/02/Adaptive_Assist_PSP_Application_Form-1.pdf',
    name: 'Adaptive Assist Application'
  },
  {
    vendor: 'NeoGenomics',
    url: 'https://asc-neoweb-drupal-prod.azurewebsites.net/sites/default/files/2025-11/FAA_Form_English_1125-2.pdf',
    name: 'NeoGenomics FAA Form'
  }
];

async function fetchPdfAsBase64(url) {
  console.log(`  Fetching: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch (error) {
    console.error(`  Failed to fetch: ${error.message}`);
    return null;
  }
}

async function extractRulesFromPdf(vendor, pdfBase64, pdfName) {
  console.log(`  Extracting rules for ${vendor}...`);
  
  const prompt = `Analyze this patient financial assistance application PDF and extract ALL specific eligibility rules and criteria.

I need ACTIONABLE details that help patients know if they qualify. Extract:

1. **Income Thresholds**: Any specific FPL (Federal Poverty Level) percentages mentioned (e.g., 200% FPL, 400% FPL)
2. **Discount Tiers**: If there's a sliding scale, what are the tiers and corresponding discounts?
3. **Maximum Out-of-Pocket**: What's the max a patient would pay if approved?
4. **Required Documentation**: What proof do they need? (tax returns, pay stubs, W-2, bank statements, etc.)
5. **Household Size**: Is household size considered? Any chart or table?
6. **Insurance Status Rules**: Are uninsured treated differently? What about Medicare/Medicaid?
7. **Medical Debt/Hardship**: Can medical expenses be considered?
8. **Application Timeline**: How long to process? Can you apply retroactively?
9. **Restrictions/Exclusions**: Who is NOT eligible?
10. **Payment Plans**: Terms if they don't qualify for full assistance?

Return a JSON object with these fields (use null if not found, be specific when data exists):

{
  "vendor": "${vendor}",
  "pdfName": "${pdfName}",
  "fplThresholds": [
    { "maxFPL": 200, "discount": "100%", "maxOOP": "$0", "notes": "Free testing" }
  ],
  "incomeBasedTiers": true/false,
  "maxOutOfPocket": "$100" or null,
  "requiredDocumentation": ["Tax return", "2 recent pay stubs", etc.],
  "householdSizeConsidered": true/false,
  "householdSizeChart": "description or null",
  "uninsuredEligible": true/false,
  "medicareEligible": true/false/null,
  "medicaidEligible": true/false/null,
  "medicalDebtConsidered": true/false,
  "processingTime": "2-4 weeks" or null,
  "retroactiveAllowed": true/false/null,
  "restrictions": ["list of who cannot apply"],
  "paymentPlanTerms": "description or null",
  "additionalNotes": "any other important details",
  "extractionConfidence": "high/medium/low"
}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error(`  Error extracting ${vendor}:`, error.message);
    return { vendor, error: error.message };
  }
}

async function main() {
  console.log('=== PAP Rules Extraction from PDFs ===\n');
  
  const results = [];
  
  for (const source of PDF_SOURCES) {
    console.log(`\nProcessing: ${source.vendor}`);
    
    const pdfBase64 = await fetchPdfAsBase64(source.url);
    if (!pdfBase64) {
      results.push({ vendor: source.vendor, error: 'Failed to fetch PDF' });
      continue;
    }
    
    const rules = await extractRulesFromPdf(source.vendor, pdfBase64, source.name);
    rules.sourceUrl = source.url;
    results.push(rules);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Save results
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n=== Extraction Complete ===`);
  console.log(`Results saved to: ${OUTPUT_FILE}`);
  
  // Summary
  console.log('\n=== Summary ===');
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.vendor}: ${r.error}`);
    } else {
      const hasFPL = r.fplThresholds?.length > 0;
      const hasDocs = r.requiredDocumentation?.length > 0;
      const hasMax = r.maxOutOfPocket;
      console.log(`✅ ${r.vendor}: FPL tiers=${hasFPL ? 'Yes' : 'No'}, Docs=${hasDocs ? 'Yes' : 'No'}, MaxOOP=${hasMax || 'N/A'} [${r.extractionConfidence}]`);
    }
  }
}

main().catch(console.error);
