/**
 * NCCN Guidelines Processor for MRD Guidance Monitor
 *
 * Extracts ctDNA/MRD-relevant sections from NCCN PDF guidelines
 * and imports them into the database.
 *
 * Usage:
 *   node src/crawlers/mrd/nccn-processor.js /path/to/guideline.pdf
 *   node src/crawlers/mrd/nccn-processor.js --dir /path/to/nccn-pdfs/
 */

import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/mrd-client.js';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('nccn-processor');

// Keywords to find MRD/ctDNA relevant sections
const MRD_KEYWORDS = [
  'ctDNA',
  'circulating tumor DNA',
  'cell-free DNA',
  'cfDNA',
  'liquid biopsy',
  'minimal residual disease',
  'molecular residual disease',
  'MRD',
  'Signatera',
  'Guardant',
  'FoundationOne',
  'tumor-informed',
  'tumor-naïve',
];

// Cancer type mapping from filename
const CANCER_TYPE_MAP = {
  'colon': 'colorectal',
  'rectal': 'colorectal',
  'colorectal': 'colorectal',
  'breast': 'breast',
  'lung': 'lung_nsclc',
  'nsclc': 'lung_nsclc',
  'non-small': 'lung_nsclc',
  'bladder': 'bladder',
  'urothelial': 'bladder',
  'melanoma': 'melanoma',
  'pancrea': 'pancreatic',
  'gastric': 'gastric',
  'stomach': 'gastric',
  'esophag': 'esophageal',
  'ovarian': 'ovarian',
  'head': 'head_neck',
  'neck': 'head_neck',
};

/**
 * Extract text from PDF
 */
async function extractPdfText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

/**
 * Find sections containing MRD/ctDNA keywords
 */
function findRelevantSections(text, windowSize = 2000) {
  const sections = [];
  const lowerText = text.toLowerCase();

  for (const keyword of MRD_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    let startIndex = 0;

    while (true) {
      const index = lowerText.indexOf(lowerKeyword, startIndex);
      if (index === -1) break;

      // Extract window around the keyword
      const windowStart = Math.max(0, index - windowSize / 2);
      const windowEnd = Math.min(text.length, index + windowSize / 2);
      const section = text.slice(windowStart, windowEnd);

      // Check if this section overlaps with existing ones
      const isOverlapping = sections.some(s =>
        Math.abs(s.index - index) < windowSize / 2
      );

      if (!isOverlapping) {
        sections.push({
          keyword,
          index,
          text: section.trim(),
        });
      }

      startIndex = index + keyword.length;
    }
  }

  // Sort by position in document
  sections.sort((a, b) => a.index - b.index);

  return sections;
}

/**
 * Detect cancer type from filename or content
 */
function detectCancerType(filename, text) {
  const lowerFilename = filename.toLowerCase();
  const lowerText = text.toLowerCase().slice(0, 5000); // Check first part

  for (const [pattern, cancerType] of Object.entries(CANCER_TYPE_MAP)) {
    if (lowerFilename.includes(pattern) || lowerText.includes(pattern)) {
      return cancerType;
    }
  }

  return 'unknown';
}

/**
 * Extract version info from text
 */
function extractVersion(text) {
  const versionMatch = text.match(/Version\s*:?\s*(\d+\.\d{4})/i);
  return versionMatch ? versionMatch[1] : null;
}

/**
 * Use Claude to extract structured recommendations from sections
 */
async function extractRecommendations(sections, cancerType, version) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required');
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Combine sections for context
  const combinedText = sections.map(s => s.text).join('\n\n---\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a medical information extractor. Extract ctDNA/MRD recommendations from NCCN guideline text.

For each distinct recommendation, provide:
- recommendation: The specific clinical recommendation
- evidence_category: NCCN category (1, 2A, 2B, or 3) if stated
- clinical_setting: When this applies (e.g., "post-surgical surveillance", "metastatic", "adjuvant therapy decision")
- test_timing: When testing should occur if specified
- key_quote: A brief direct quote supporting this (max 50 words)

Return JSON array. Only include recommendations about ctDNA, liquid biopsy, or MRD testing.
If no clear recommendations found, return empty array [].`,
    messages: [
      {
        role: 'user',
        content: `Extract ctDNA/MRD recommendations from this ${cancerType} cancer NCCN guideline text (Version ${version || 'unknown'}):\n\n${combinedText.slice(0, 15000)}`,
      },
    ],
  });

  const responseText = response.content[0]?.text || '[]';

  // Parse JSON from response
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    logger.warn('Failed to parse recommendations JSON', { error: e.message });
  }

  return [];
}

/**
 * Save recommendations to database
 */
async function saveRecommendations(recommendations, cancerType, version, filename) {
  const results = { saved: 0, skipped: 0 };

  for (const rec of recommendations) {
    try {
      // Check for duplicates
      const existing = await query(
        `SELECT id FROM mrd_guidance_items
         WHERE source_type = 'nccn'
         AND title ILIKE $1
         AND evidence_level = $2`,
        [`%${cancerType}%${rec.clinical_setting || ''}%`.slice(0, 100), rec.evidence_category]
      );

      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      // Create title
      const title = `NCCN ${cancerType.charAt(0).toUpperCase() + cancerType.slice(1)} Cancer: ${rec.clinical_setting || 'ctDNA Recommendation'}`;

      // Build summary
      const summary = rec.recommendation;

      await query(
        `INSERT INTO mrd_guidance_items (
          source_type, source_id, source_url,
          title, summary, evidence_type, evidence_level,
          key_findings, publication_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'nccn',
          `nccn-${cancerType}-${version || 'unknown'}-${Date.now()}`,
          'https://www.nccn.org/guidelines/category_1',
          title,
          summary,
          'guideline',
          rec.evidence_category ? `NCCN Category ${rec.evidence_category}` : null,
          JSON.stringify([{
            finding: rec.recommendation,
            timing: rec.test_timing,
            quote: rec.key_quote,
          }]),
          new Date(), // Use current date as we're processing current guidelines
        ]
      );

      results.saved++;
      logger.info('Saved recommendation', { title, category: rec.evidence_category });

    } catch (error) {
      logger.warn('Failed to save recommendation', { error: error.message });
    }
  }

  return results;
}

/**
 * Process a single NCCN PDF
 */
export async function processNccnPdf(filePath) {
  const filename = path.basename(filePath);
  logger.info('Processing NCCN PDF', { filename });

  // Extract text
  const text = await extractPdfText(filePath);
  logger.info('Extracted PDF text', { length: text.length });

  // Detect cancer type and version
  const cancerType = detectCancerType(filename, text);
  const version = extractVersion(text);
  logger.info('Detected metadata', { cancerType, version });

  // Find MRD-relevant sections
  const sections = findRelevantSections(text);
  logger.info('Found relevant sections', { count: sections.length });

  if (sections.length === 0) {
    logger.warn('No MRD/ctDNA content found in PDF');
    return { success: false, reason: 'No MRD content found' };
  }

  // Extract structured recommendations
  const recommendations = await extractRecommendations(sections, cancerType, version);
  logger.info('Extracted recommendations', { count: recommendations.length });

  if (recommendations.length === 0) {
    logger.warn('No structured recommendations extracted');
    return { success: false, reason: 'No recommendations extracted' };
  }

  // Save to database
  const results = await saveRecommendations(recommendations, cancerType, version, filename);
  logger.info('Saved to database', results);

  return {
    success: true,
    filename,
    cancerType,
    version,
    sectionsFound: sections.length,
    recommendationsExtracted: recommendations.length,
    ...results,
  };
}

/**
 * Process all PDFs in a directory
 */
export async function processNccnDirectory(dirPath) {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'));

  logger.info('Processing NCCN directory', { files: files.length });

  const results = [];
  for (const file of files) {
    try {
      const result = await processNccnPdf(path.join(dirPath, file));
      results.push(result);
    } catch (error) {
      logger.error('Failed to process PDF', { file, error: error.message });
      results.push({ success: false, filename: file, error: error.message });
    }
  }

  return results;
}

// CLI execution - only run when this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1]?.endsWith('nccn-processor.js');
if (isMainModule && process.argv.slice(2).length > 0) {
  const args = process.argv.slice(2);
  const isDir = args[0] === '--dir';
  const targetPath = isDir ? args[1] : args[0];

  if (!targetPath) {
    console.log('Usage:');
    console.log('  node nccn-processor.js /path/to/guideline.pdf');
    console.log('  node nccn-processor.js --dir /path/to/nccn-pdfs/');
    process.exit(1);
  }

  (async () => {
    try {
      let results;
      if (isDir) {
        results = await processNccnDirectory(targetPath);
      } else {
        results = await processNccnPdf(targetPath);
      }

      console.log('\n=== NCCN Processing Results ===');
      console.log(JSON.stringify(results, null, 2));

      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}

export default {
  processNccnPdf,
  processNccnDirectory,
  findRelevantSections,
  extractRecommendations,
};
