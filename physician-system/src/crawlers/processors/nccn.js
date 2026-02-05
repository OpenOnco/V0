/**
 * NCCN Guidelines Processor for MRD Guidance Monitor
 *
 * Extracts ctDNA/MRD-relevant sections from NCCN PDF guidelines
 * and imports them into the database with artifact tracking and quotes.
 *
 * Enhanced in Phase 2 to support:
 * - Artifact storage with SHA256 versioning
 * - Quote anchors with page numbers
 * - Decision context extraction
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/client.js';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('nccn-processor');

// Current extraction version - increment when algorithm changes significantly
const EXTRACTION_VERSION = 2;

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
 * Compute SHA256 hash of a file
 */
function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract text from PDF with page information
 */
async function extractPdfText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);

  return {
    text: data.text,
    pageCount: data.numpages,
    info: data.info,
  };
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

      // Estimate page number (rough approximation)
      const charsPerPage = text.length / 50; // Assume ~50 pages average
      const estimatedPage = Math.ceil(index / charsPerPage);

      // Check if this section overlaps with existing ones
      const isOverlapping = sections.some(s =>
        Math.abs(s.charOffset - index) < windowSize / 2
      );

      if (!isOverlapping) {
        sections.push({
          keyword,
          charOffset: index,
          estimatedPage,
          text: section.trim(),
          contextBefore: text.slice(Math.max(0, index - 100), index).trim(),
          contextAfter: text.slice(index, Math.min(text.length, index + 100)).trim(),
        });
      }

      startIndex = index + keyword.length;
    }
  }

  // Sort by position in document
  sections.sort((a, b) => a.charOffset - b.charOffset);

  return sections;
}

/**
 * Detect cancer type from filename or content
 */
function detectCancerType(filename, text) {
  const lowerFilename = filename.toLowerCase();
  const lowerText = text.toLowerCase().slice(0, 5000);

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
  // Try different version patterns
  const patterns = [
    /Version\s*:?\s*(\d+\.\d{4})/i,
    /NCCN Guidelines[^\n]*Version\s*(\d+\.\d{4})/i,
    /Version\s*(\d+)\s*\.\s*(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || `${match[1]}.${match[2]}`;
    }
  }

  return null;
}

/**
 * Extract effective date from text
 */
function extractEffectiveDate(text) {
  const patterns = [
    /effective[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /updated[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.slice(0, 2000).match(pattern);
    if (match) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }

  return null;
}

/**
 * Use Claude to extract structured recommendations with decision context
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
- recommendation: The specific clinical recommendation (factual, not prescriptive)
- evidence_category: NCCN category number ONLY (1, 2A, 2B, or 3). Look for annotations like "Category 2A", "(2A)", superscript references, or statements like "based on high-level evidence (1)" or "uniform consensus (2A)". IMPORTANT: If the text is from NCCN guidelines but no explicit category is stated, default to "2A" since that is the standard NCCN recommendation category for consensus-based guidelines.
- clinical_setting: When this applies (e.g., "post-surgical surveillance", "metastatic disease", "adjuvant therapy decision")
- test_timing: When testing should occur if specified
- key_quote: A VERBATIM quote from the text supporting this (max 100 words, must be exact text)
- decision_context: Object with:
  - decision_point: The clinical decision being addressed
  - population: Who this applies to (stage, setting)
  - options_discussed: Array of options/actions mentioned (neutral list)
  - limitations_noted: Array of caveats or limitations mentioned
  - strength_of_evidence: Evidence category as stated, or "2A (assumed default)" if not explicitly stated

Return JSON array. Only include recommendations about ctDNA, liquid biopsy, or MRD testing.
If no clear recommendations found, return empty array [].
IMPORTANT: key_quote must be EXACT text from the source - do not paraphrase.
IMPORTANT: Always return an evidence_category value - use "2A" as default if not explicitly stated.`,
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
 * Store artifact in database
 */
async function storeArtifact(filePath, text, metadata) {
  const hash = computeFileHash(filePath);
  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath);

  // Check if artifact already exists
  const existing = await query(
    'SELECT id FROM mrd_artifacts WHERE sha256 = $1',
    [hash]
  );

  if (existing.rows.length > 0) {
    logger.info('Artifact already exists', { hash: hash.substring(0, 12), id: existing.rows[0].id });
    return { id: existing.rows[0].id, isNew: false };
  }

  // Insert new artifact
  const result = await query(
    `INSERT INTO mrd_artifacts (
      source_type, source_identifier, sha256, file_size, content_type,
      original_filename, extracted_text, page_count, metadata,
      effective_date, version_string, processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    RETURNING id`,
    [
      'nccn',
      filename,
      hash,
      stats.size,
      'application/pdf',
      filename,
      text,
      metadata.pageCount,
      JSON.stringify(metadata),
      metadata.effectiveDate,
      metadata.version,
    ]
  );

  logger.info('Stored artifact', { id: result.rows[0].id, filename });
  return { id: result.rows[0].id, isNew: true };
}

/**
 * Store quote anchor in database
 */
async function storeQuoteAnchor(guidanceId, artifactId, quote, section) {
  try {
    await query(
      `INSERT INTO mrd_quote_anchors (
        guidance_id, artifact_id, quote_text, quote_type,
        page_number, section_heading, context_before, context_after,
        char_offset, is_verbatim
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        guidanceId,
        artifactId,
        quote,
        'recommendation',
        section?.estimatedPage,
        section?.keyword,
        section?.contextBefore?.substring(0, 200),
        section?.contextAfter?.substring(0, 200),
        section?.charOffset,
        true,
      ]
    );
    return true;
  } catch (error) {
    logger.warn('Failed to store quote anchor', { error: error.message });
    return false;
  }
}

/**
 * Save recommendations to database with artifact links and quotes
 */
async function saveRecommendations(recommendations, cancerType, version, filename, artifactId, sections) {
  const results = { saved: 0, skipped: 0, quotes: 0 };

  for (const rec of recommendations) {
    try {
      // Check for duplicates by content similarity
      const existing = await query(
        `SELECT id FROM mrd_guidance_items
         WHERE source_type = 'nccn'
         AND title ILIKE $1
         AND (summary ILIKE $2 OR evidence_level = $3)`,
        [
          `%${cancerType}%${(rec.clinical_setting || '').substring(0, 50)}%`,
          `%${(rec.recommendation || '').substring(0, 100)}%`,
          rec.evidence_category ? `NCCN Category ${rec.evidence_category}` : null,
        ]
      );

      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      // Create title
      const settingPart = rec.clinical_setting || 'ctDNA Recommendation';
      const title = `NCCN ${cancerType.charAt(0).toUpperCase() + cancerType.slice(1).replace('_', ' ')} Cancer: ${settingPart}`;

      // Determine evidence level - default to 2A if not specified (standard NCCN consensus)
      const evidenceCategory = rec.evidence_category || '2A';
      const evidenceLevel = `NCCN Category ${evidenceCategory}`;

      // Build decision context
      const decisionContext = rec.decision_context || {
        decision_point: rec.clinical_setting,
        population: { cancer_type: cancerType },
        options_discussed: [],
        limitations_noted: [],
        strength_of_evidence: evidenceLevel,
      };

      // Build direct quotes array
      const directQuotes = rec.key_quote ? [{
        text: rec.key_quote,
        type: 'recommendation',
        section: rec.clinical_setting,
      }] : [];

      // Insert guidance item
      const insertResult = await query(
        `INSERT INTO mrd_guidance_items (
          source_type, source_id, source_url,
          title, summary, evidence_type, evidence_level,
          key_findings, publication_date,
          artifact_id, decision_context, direct_quotes,
          extraction_version, source_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          'nccn',
          `nccn-${cancerType}-${version || 'unknown'}-${Date.now()}`,
          'https://www.nccn.org/guidelines/category_1',
          title,
          rec.recommendation,
          'guideline',
          evidenceLevel,
          JSON.stringify([{
            finding: rec.recommendation,
            timing: rec.test_timing,
            quote: rec.key_quote,
          }]),
          new Date(),
          artifactId,
          JSON.stringify(decisionContext),
          JSON.stringify(directQuotes),
          EXTRACTION_VERSION,
          version,
        ]
      );

      const guidanceId = insertResult.rows[0].id;
      results.saved++;

      // Store quote anchor if we have a quote
      if (rec.key_quote) {
        // Find the section that contains this quote
        const matchingSection = sections.find(s =>
          s.text.toLowerCase().includes(rec.key_quote.toLowerCase().substring(0, 50))
        );

        const stored = await storeQuoteAnchor(guidanceId, artifactId, rec.key_quote, matchingSection);
        if (stored) results.quotes++;
      }

      logger.info('Saved recommendation', { id: guidanceId, title, category: rec.evidence_category });

    } catch (error) {
      logger.warn('Failed to save recommendation', { error: error.message });
    }
  }

  return results;
}

/**
 * Process a single NCCN PDF
 */
export async function processNccnPdf(filePath, options = {}) {
  const filename = path.basename(filePath);
  logger.info('Processing NCCN PDF', { filename });

  // Extract text with page info
  const { text, pageCount, info } = await extractPdfText(filePath);
  logger.info('Extracted PDF text', { length: text.length, pages: pageCount });

  // Detect cancer type and version
  const cancerType = detectCancerType(filename, text);
  const version = extractVersion(text);
  const effectiveDate = extractEffectiveDate(text);
  logger.info('Detected metadata', { cancerType, version, effectiveDate });

  // Store artifact first
  const artifact = await storeArtifact(filePath, text, {
    cancerType,
    version,
    effectiveDate,
    pageCount,
    pdfInfo: info,
  });

  // Find MRD-relevant sections
  const sections = findRelevantSections(text);
  logger.info('Found relevant sections', { count: sections.length });

  if (sections.length === 0) {
    logger.warn('No MRD/ctDNA content found in PDF');

    // Update artifact with result
    await query(
      'UPDATE mrd_artifacts SET items_extracted = 0 WHERE id = $1',
      [artifact.id]
    );

    return {
      success: false,
      reason: 'No MRD content found',
      artifactId: artifact.id,
      filename,
    };
  }

  // Extract structured recommendations
  const recommendations = await extractRecommendations(sections, cancerType, version);
  logger.info('Extracted recommendations', { count: recommendations.length });

  if (recommendations.length === 0) {
    logger.warn('No structured recommendations extracted');

    await query(
      'UPDATE mrd_artifacts SET items_extracted = 0 WHERE id = $1',
      [artifact.id]
    );

    return {
      success: false,
      reason: 'No recommendations extracted',
      artifactId: artifact.id,
      filename,
      sectionsFound: sections.length,
    };
  }

  // Save to database with artifact links
  const results = await saveRecommendations(
    recommendations, cancerType, version, filename, artifact.id, sections
  );
  logger.info('Saved to database', results);

  // Update artifact with extraction count
  await query(
    'UPDATE mrd_artifacts SET items_extracted = $1 WHERE id = $2',
    [results.saved, artifact.id]
  );

  return {
    success: true,
    filename,
    cancerType,
    version,
    effectiveDate,
    artifactId: artifact.id,
    artifactIsNew: artifact.isNew,
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
  EXTRACTION_VERSION,
};
