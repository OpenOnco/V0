/**
 * Society Guideline Processor for MRD Guidance Monitor
 *
 * Extracts ctDNA/MRD recommendations from professional society guidelines:
 * - ASCO: American Society of Clinical Oncology
 * - ESMO: European Society for Medical Oncology
 * - SITC: Society for Immunotherapy of Cancer
 * - CAP/AMP: College of American Pathologists / Association for Molecular Pathology
 *
 * These sources publish consensus statements, guidelines, and position papers
 * that influence clinical practice decisions.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/client.js';
import Anthropic from '@anthropic-ai/sdk';
import { embedAfterInsert } from '../../embeddings/mrd-embedder.js';

const logger = createLogger('society-processor');

// Current extraction version - increment when algorithm changes
const EXTRACTION_VERSION = 1;

// Society-specific configurations
const SOCIETY_CONFIG = {
  asco: {
    name: 'American Society of Clinical Oncology',
    abbreviation: 'ASCO',
    documentTypes: ['guideline', 'provisional_clinical_opinion', 'focused_update'],
    evidenceScale: {
      'high': 'High quality',
      'intermediate': 'Intermediate quality',
      'low': 'Low quality',
      'insufficient': 'Insufficient evidence',
      'expert_consensus': 'Expert consensus',
    },
    keyTerms: ['ASCO', 'Provisional Clinical Opinion', 'Focused Update', 'Clinical Practice Guideline'],
  },
  esmo: {
    name: 'European Society for Medical Oncology',
    abbreviation: 'ESMO',
    documentTypes: ['clinical_practice_guideline', 'consensus_statement', 'position_paper'],
    evidenceScale: {
      'I': 'Level I - Meta-analysis or multiple RCTs',
      'II': 'Level II - Single RCT or large non-randomized',
      'III': 'Level III - Prospective cohort',
      'IV': 'Level IV - Retrospective cohort or case-control',
      'V': 'Level V - Expert opinion',
    },
    recommendationGrades: {
      'A': 'Strong evidence for efficacy',
      'B': 'Moderate evidence for efficacy',
      'C': 'Insufficient evidence',
      'D': 'Moderate evidence against',
      'E': 'Strong evidence against',
    },
    keyTerms: ['ESMO', 'ESMO Guidelines', 'ESMO Consensus', 'Magnitude of Clinical Benefit'],
  },
  sitc: {
    name: 'Society for Immunotherapy of Cancer',
    abbreviation: 'SITC',
    documentTypes: ['consensus_statement', 'clinical_guidelines', 'position_paper'],
    evidenceScale: {
      'strong': 'Strong recommendation',
      'moderate': 'Moderate recommendation',
      'weak': 'Weak recommendation',
      'expert_opinion': 'Expert opinion',
    },
    keyTerms: ['SITC', 'consensus statement', 'immunotherapy'],
  },
  'cap-amp': {
    name: 'College of American Pathologists / Association for Molecular Pathology',
    abbreviation: 'CAP/AMP',
    documentTypes: ['guideline', 'technical_standard', 'recommendation'],
    evidenceScale: {
      'strong': 'Strong recommendation',
      'recommendation': 'Recommendation',
      'expert_consensus': 'Expert consensus opinion',
      'no_recommendation': 'No recommendation',
    },
    keyTerms: ['CAP', 'AMP', 'College of American Pathologists', 'molecular pathology'],
  },
};

// MRD/ctDNA keywords for relevance detection
const MRD_KEYWORDS = [
  'ctDNA',
  'circulating tumor DNA',
  'cell-free DNA',
  'cfDNA',
  'liquid biopsy',
  'minimal residual disease',
  'molecular residual disease',
  'MRD',
  'tumor-informed',
  'tumor-naïve',
  'surveillance',
  'monitoring',
];

// Cancer type patterns
const CANCER_TYPE_MAP = {
  'colorectal': ['colorectal', 'colon', 'rectal', 'CRC'],
  'breast': ['breast', 'HR+', 'HER2', 'triple-negative', 'TNBC'],
  'lung_nsclc': ['lung', 'NSCLC', 'non-small cell', 'adenocarcinoma'],
  'lung_sclc': ['small cell lung', 'SCLC'],
  'melanoma': ['melanoma', 'cutaneous'],
  'bladder': ['bladder', 'urothelial'],
  'pancreatic': ['pancreatic', 'pancreas', 'PDAC'],
  'gastric': ['gastric', 'stomach', 'gastroesophageal'],
  'esophageal': ['esophageal', 'esophagus'],
  'ovarian': ['ovarian', 'ovary', 'fallopian'],
  'prostate': ['prostate', 'castration-resistant', 'CRPC'],
  'head_neck': ['head and neck', 'HNSCC', 'oropharyngeal'],
};

/**
 * Compute SHA256 hash of a file
 */
function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract text from PDF
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
 * Detect society from filename or content
 */
function detectSociety(filename, text) {
  const lowerFilename = filename.toLowerCase();
  const lowerText = text.toLowerCase().slice(0, 10000);

  // Check filename first (most reliable)
  for (const [societyId, config] of Object.entries(SOCIETY_CONFIG)) {
    if (lowerFilename.includes(societyId.replace('-', ''))) {
      return { societyId, config };
    }
  }

  // Check content for society identifiers
  for (const [societyId, config] of Object.entries(SOCIETY_CONFIG)) {
    for (const term of config.keyTerms) {
      if (lowerText.includes(term.toLowerCase())) {
        return { societyId, config };
      }
    }
  }

  return { societyId: 'unknown', config: null };
}

/**
 * Detect cancer type from text
 */
function detectCancerType(text) {
  const lowerText = text.toLowerCase();

  for (const [cancerType, patterns] of Object.entries(CANCER_TYPE_MAP)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return cancerType;
      }
    }
  }

  return 'multiple_or_unknown';
}

/**
 * Find MRD-relevant sections in text
 */
function findRelevantSections(text, windowSize = 2500) {
  const sections = [];
  const lowerText = text.toLowerCase();

  for (const keyword of MRD_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    let startIndex = 0;

    while (true) {
      const index = lowerText.indexOf(lowerKeyword, startIndex);
      if (index === -1) break;

      const windowStart = Math.max(0, index - windowSize / 2);
      const windowEnd = Math.min(text.length, index + windowSize / 2);
      const section = text.slice(windowStart, windowEnd);

      // Estimate page number
      const charsPerPage = text.length / Math.max(1, Math.ceil(text.length / 3000));
      const estimatedPage = Math.ceil(index / charsPerPage);

      // Check for overlap with existing sections
      const isOverlapping = sections.some(s =>
        Math.abs(s.charOffset - index) < windowSize / 2
      );

      if (!isOverlapping) {
        sections.push({
          keyword,
          charOffset: index,
          estimatedPage,
          text: section.trim(),
          contextBefore: text.slice(Math.max(0, index - 150), index).trim(),
          contextAfter: text.slice(index, Math.min(text.length, index + 150)).trim(),
        });
      }

      startIndex = index + keyword.length;
    }
  }

  sections.sort((a, b) => a.charOffset - b.charOffset);
  return sections;
}

/**
 * Extract document metadata
 */
function extractMetadata(text, filename) {
  const metadata = {
    title: null,
    publicationDate: null,
    version: null,
    documentType: null,
    authors: null,
  };

  // Try to extract title (usually in first 500 chars)
  const titleMatch = text.slice(0, 1000).match(/^([A-Z][^.!?\n]{20,150})/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract date patterns
  const datePatterns = [
    /published[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /date[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{4})[;\s]+\d+[:\s]+\d+/,  // Journal format: 2024;123:456
    /(\w+\s+\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.slice(0, 3000).match(pattern);
    if (match) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2015) {
          metadata.publicationDate = date.toISOString().split('T')[0];
          break;
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }

  // Extract version if present
  const versionMatch = text.match(/version[:\s]+(\d+\.?\d*)/i);
  if (versionMatch) {
    metadata.version = versionMatch[1];
  }

  return metadata;
}

/**
 * Use Claude to extract structured recommendations
 */
async function extractRecommendations(sections, societyConfig, cancerType, metadata) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required');
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const combinedText = sections.map(s => s.text).join('\n\n---\n\n');

  const societyContext = societyConfig
    ? `This is from ${societyConfig.name} (${societyConfig.abbreviation}). Their evidence levels are: ${JSON.stringify(societyConfig.evidenceScale)}`
    : 'Society source unknown.';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a medical information extractor specializing in oncology guidelines.
Extract ctDNA/MRD recommendations from professional society documents.

${societyContext}

For each distinct recommendation, provide:
- recommendation: The factual clinical statement (not prescriptive)
- evidence_level: As stated in source (use society's scale if apparent)
- recommendation_strength: Strong/Moderate/Weak/Expert opinion if stated
- clinical_setting: When this applies (surveillance, treatment decision, etc.)
- population: Who this applies to (cancer type, stage, setting)
- key_quote: VERBATIM quote supporting this (max 100 words, MUST be exact text)
- decision_context: Object with:
  - decision_point: The clinical question being addressed
  - options_discussed: Array of options mentioned (neutral list)
  - limitations_noted: Array of caveats or limitations
  - gaps_identified: Research gaps or uncertainties noted
- source_section: Which part of document (e.g., "Recommendations", "Discussion")

Return JSON array. Only include ctDNA, liquid biopsy, or MRD-related recommendations.
IMPORTANT: key_quote must be EXACT verbatim text. Return [] if no clear recommendations.`,
    messages: [
      {
        role: 'user',
        content: `Extract ctDNA/MRD recommendations from this ${societyConfig?.abbreviation || 'society'} document about ${cancerType} cancer:\n\n${combinedText.slice(0, 15000)}`,
      },
    ],
  });

  const responseText = response.content[0]?.text || '[]';

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
async function storeArtifact(filePath, text, metadata, societyId) {
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
      societyId,
      filename,
      hash,
      stats.size,
      'application/pdf',
      filename,
      text,
      metadata.pageCount,
      JSON.stringify(metadata),
      metadata.publicationDate,
      metadata.version,
    ]
  );

  logger.info('Stored artifact', { id: result.rows[0].id, filename, society: societyId });
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
        section?.sourceSection || section?.keyword,
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
 * Save recommendations to database
 */
async function saveRecommendations(recommendations, societyId, societyConfig, cancerType, metadata, artifactId, sections) {
  const results = { saved: 0, skipped: 0, quotes: 0 };

  for (const rec of recommendations) {
    try {
      // Check for duplicates
      const existing = await query(
        `SELECT id FROM mrd_guidance_items
         WHERE source_type = $1
         AND (summary ILIKE $2 OR title ILIKE $3)`,
        [
          societyId,
          `%${(rec.recommendation || '').substring(0, 100)}%`,
          `%${(rec.clinical_setting || '').substring(0, 50)}%`,
        ]
      );

      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      // Build title
      const abbreviation = societyConfig?.abbreviation || societyId.toUpperCase();
      const setting = rec.clinical_setting || 'ctDNA Guidance';
      const cancerLabel = cancerType.replace('_', ' ');
      const title = `${abbreviation} ${cancerLabel}: ${setting}`;

      // Build decision context
      const decisionContext = rec.decision_context || {
        decision_point: rec.clinical_setting,
        population: { cancer_type: cancerType, setting: rec.population },
        options_discussed: [],
        limitations_noted: [],
        gaps_identified: [],
      };

      // Build direct quotes array
      const directQuotes = rec.key_quote ? [{
        text: rec.key_quote,
        type: 'recommendation',
        section: rec.source_section || rec.clinical_setting,
      }] : [];

      // Determine evidence type
      const evidenceType = societyConfig?.documentTypes?.[0] || 'guideline';

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
          societyId,
          `${societyId}-${cancerType}-${Date.now()}`,
          null, // URL would be added if known
          title,
          rec.recommendation,
          evidenceType,
          rec.evidence_level || rec.recommendation_strength,
          JSON.stringify([{
            finding: rec.recommendation,
            population: rec.population,
            quote: rec.key_quote,
          }]),
          metadata.publicationDate ? new Date(metadata.publicationDate) : new Date(),
          artifactId,
          JSON.stringify(decisionContext),
          JSON.stringify(directQuotes),
          EXTRACTION_VERSION,
          metadata.version,
        ]
      );

      const guidanceId = insertResult.rows[0].id;
      await embedAfterInsert(guidanceId, 'society');
      results.saved++;

      // Store quote anchor
      if (rec.key_quote) {
        const matchingSection = sections.find(s =>
          s.text.toLowerCase().includes(rec.key_quote.toLowerCase().substring(0, 50))
        );
        const stored = await storeQuoteAnchor(guidanceId, artifactId, rec.key_quote, matchingSection);
        if (stored) results.quotes++;
      }

      logger.info('Saved recommendation', {
        id: guidanceId,
        title,
        society: societyId,
        evidence: rec.evidence_level,
      });

    } catch (error) {
      logger.warn('Failed to save recommendation', { error: error.message });
    }
  }

  return results;
}

/**
 * Process a society guideline PDF
 */
export async function processSocietyGuideline(filePath, options = {}) {
  const filename = path.basename(filePath);
  logger.info('Processing society guideline', { filename });

  // Extract text
  const { text, pageCount, info } = await extractPdfText(filePath);
  logger.info('Extracted PDF text', { length: text.length, pages: pageCount });

  // Detect society and cancer type
  const { societyId, config: societyConfig } = detectSociety(filename, text);
  const cancerType = detectCancerType(text);
  const metadata = extractMetadata(text, filename);
  metadata.pageCount = pageCount;
  metadata.pdfInfo = info;

  logger.info('Detected document info', {
    society: societyId,
    cancer: cancerType,
    title: metadata.title?.substring(0, 50),
  });

  // Store artifact
  const artifact = await storeArtifact(filePath, text, metadata, societyId);

  // Find relevant sections
  const sections = findRelevantSections(text);
  logger.info('Found relevant sections', { count: sections.length });

  if (sections.length === 0) {
    logger.warn('No MRD/ctDNA content found in PDF');
    await query(
      'UPDATE mrd_artifacts SET items_extracted = 0 WHERE id = $1',
      [artifact.id]
    );
    return {
      success: false,
      reason: 'No MRD content found',
      artifactId: artifact.id,
      filename,
      society: societyId,
    };
  }

  // Extract recommendations using AI
  const recommendations = await extractRecommendations(sections, societyConfig, cancerType, metadata);
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
      society: societyId,
      sectionsFound: sections.length,
    };
  }

  // Save to database
  const results = await saveRecommendations(
    recommendations, societyId, societyConfig, cancerType, metadata, artifact.id, sections
  );
  logger.info('Saved to database', results);

  // Update artifact
  await query(
    'UPDATE mrd_artifacts SET items_extracted = $1 WHERE id = $2',
    [results.saved, artifact.id]
  );

  return {
    success: true,
    filename,
    society: societyId,
    societyName: societyConfig?.name,
    cancerType,
    title: metadata.title,
    publicationDate: metadata.publicationDate,
    artifactId: artifact.id,
    artifactIsNew: artifact.isNew,
    sectionsFound: sections.length,
    recommendationsExtracted: recommendations.length,
    ...results,
  };
}

/**
 * Process all PDFs in a society directory
 */
export async function processSocietyDirectory(dirPath, societyFilter = null) {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'));

  logger.info('Processing society directory', { files: files.length, filter: societyFilter });

  const results = [];
  for (const file of files) {
    try {
      const result = await processSocietyGuideline(path.join(dirPath, file));

      // Skip if filtering by society and doesn't match
      if (societyFilter && result.society !== societyFilter) {
        continue;
      }

      results.push(result);
    } catch (error) {
      logger.error('Failed to process PDF', { file, error: error.message });
      results.push({ success: false, filename: file, error: error.message });
    }
  }

  return results;
}

export default {
  processSocietyGuideline,
  processSocietyDirectory,
  detectSociety,
  SOCIETY_CONFIG,
  EXTRACTION_VERSION,
};
