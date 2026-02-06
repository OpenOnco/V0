/**
 * Trial Results Watcher — monitors 13 priority MRD clinical trials
 * for result publications via ClinicalTrials.gov API + PubMed cross-reference.
 *
 * Detects:
 * - Trial status changes (e.g., "Active, not recruiting" -> "Completed")
 * - New results posted on ClinicalTrials.gov
 * - New PubMed publications linked to trial NCT numbers or acronyms
 *
 * When new publications are found, they are:
 * 1. Inserted into mrd_guidance_items with junction table entries
 * 2. Queued for embedding generation
 * 3. Reported via email alert
 *
 * API rate limits:
 * - ClinicalTrials.gov: 10 req/sec (we use 200ms delay)
 * - PubMed with NCBI_API_KEY: 10 req/sec (we use 150ms delay)
 * - PubMed without key: 3 req/sec (we use 400ms delay)
 */

import { createHttpClient } from '../utils/http.js';
import { createLogger } from '../utils/logger.js';
import { query } from '../db/client.js';
import { config } from '../config.js';
import { embedGuidanceItem } from '../embeddings/mrd-embedder.js';
import { sendEmail } from '../email/index.js';

const logger = createLogger('trial-results');

const CT_BASE_URL = 'https://clinicaltrials.gov/api/v2';
const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// Rate-limited HTTP clients
const ctHttp = createHttpClient('trial-results-ct', { rateLimitMs: 200 });
const pubmedHttp = createHttpClient('trial-results-pubmed', {
  rateLimitMs: config.ncbiApiKey ? 150 : 400,
});

/**
 * The 13 priority MRD clinical trials to monitor.
 * Each entry includes the NCT number, common trial name, cancer type, and phase.
 */
const PRIORITY_TRIALS = [
  { nct: 'NCT04120701', name: 'CIRCULATE-Japan', cancer: 'colorectal', phase: 'III' },
  { nct: 'NCT04089631', name: 'DYNAMIC-III', cancer: 'colorectal', phase: 'III' },
  { nct: 'NCT04513885', name: 'DYNAMIC-Rectal', cancer: 'colorectal', phase: 'II/III' },
  { nct: 'NCT04776655', name: 'GALAXY/VEGA', cancer: 'colorectal', phase: 'III' },
  { nct: 'NCT04958083', name: 'MEDOCC-CrEATE', cancer: 'colorectal', phase: 'III' },
  { nct: 'NCT04068103', name: 'COBRA', cancer: 'colorectal', phase: 'II/III' },
  { nct: 'NCT05054400', name: 'ACT3', cancer: 'colorectal', phase: 'III' },
  { nct: 'NCT04050345', name: 'TRACC', cancer: 'lung_nsclc', phase: 'II' },
  { nct: 'NCT03145961', name: 'c-TRAK TN', cancer: 'breast', phase: 'II' },
  { nct: 'NCT04660344', name: 'IMvigor011', cancer: 'bladder', phase: 'III' },
  { nct: 'NCT04385368', name: 'MERMAID-1', cancer: 'lung_nsclc', phase: 'III' },
  { nct: 'NCT04264702', name: 'BESPOKE', cancer: 'breast', phase: 'II' },
  { nct: 'NCT05062226', name: 'NRG-GI005', cancer: 'colorectal', phase: 'II/III' },
];

// Map from ClinicalTrials.gov API status to our internal enum
const STATUS_MAP = {
  'NOT_YET_RECRUITING': 'not_yet_recruiting',
  'RECRUITING': 'recruiting',
  'ENROLLING_BY_INVITATION': 'enrolling_by_invitation',
  'ACTIVE_NOT_RECRUITING': 'active_not_recruiting',
  'SUSPENDED': 'suspended',
  'TERMINATED': 'terminated',
  'COMPLETED': 'completed',
  'WITHDRAWN': 'withdrawn',
  'UNKNOWN': 'unknown',
};

// Clinical setting heuristics based on trial name / cancer type
const CLINICAL_SETTING_MAP = {
  colorectal: ['adjuvant', 'surveillance'],
  lung_nsclc: ['adjuvant', 'surveillance'],
  breast: ['adjuvant', 'surveillance'],
  bladder: ['adjuvant', 'neoadjuvant'],
};

// ============================================
// ClinicalTrials.gov — fetch and compare
// ============================================

/**
 * Fetch a single trial from the ClinicalTrials.gov v2 API.
 * @param {string} nctNumber - The NCT identifier (e.g., "NCT04120701")
 * @returns {Promise<Object>} Raw study JSON from the API
 */
async function fetchTrialFromCTGov(nctNumber) {
  const url = `${CT_BASE_URL}/studies/${nctNumber}?format=json`;
  return ctHttp.getJson(url);
}

/**
 * Extract relevant fields from a ClinicalTrials.gov study response.
 * @param {Object} study - Raw API response
 * @returns {Object} Parsed fields for comparison
 */
function parseTrialStatus(study) {
  const protocol = study.protocolSection || {};
  const statusModule = protocol.statusModule || {};
  const identification = protocol.identificationModule || {};

  const hasResults = statusModule.resultsFirstSubmitDate != null;
  const resultsFirstPosted = statusModule.resultsFirstPostDateStruct?.date || null;
  const overallStatus = STATUS_MAP[statusModule.overallStatus] || 'unknown';
  const lastUpdateDate = statusModule.lastUpdateSubmitDate || null;
  const primaryCompletionDate = statusModule.primaryCompletionDateStruct?.date || null;
  const studyCompletionDate = statusModule.completionDateStruct?.date || null;

  return {
    nctNumber: identification.nctId,
    title: identification.briefTitle,
    officialTitle: identification.officialTitle,
    acronym: identification.acronym,
    overallStatus,
    hasResults,
    resultsFirstPosted,
    lastUpdateDate,
    primaryCompletionDate,
    studyCompletionDate,
    hasResultsSection: study.resultsSection != null,
  };
}

/**
 * Load the previously stored state for a trial from the database.
 * @param {string} nctNumber - NCT identifier
 * @returns {Promise<Object|null>} Previous trial record or null
 */
async function getPreviousTrialState(nctNumber) {
  const result = await query(
    `SELECT status, has_results, results_first_posted, primary_completion_date, study_completion_date
     FROM mrd_clinical_trials
     WHERE nct_number = $1`,
    [nctNumber]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Compare current API state to stored DB state and detect changes.
 * @param {Object} current - Parsed current state from API
 * @param {Object|null} previous - Previous state from DB (null if first run)
 * @returns {Object[]} Array of detected changes
 */
function detectChanges(current, previous) {
  const changes = [];

  if (!previous) {
    // First time seeing this trial — not a "change"
    return changes;
  }

  // Status change
  if (previous.status && current.overallStatus !== previous.status) {
    changes.push({
      type: 'status_change',
      field: 'status',
      from: previous.status,
      to: current.overallStatus,
    });
  }

  // Results newly posted
  if (!previous.has_results && current.hasResults) {
    changes.push({
      type: 'results_posted',
      field: 'has_results',
      from: false,
      to: true,
      resultsDate: current.resultsFirstPosted,
    });
  }

  // Primary completion date changed
  const prevCompletion = previous.primary_completion_date
    ? new Date(previous.primary_completion_date).toISOString().split('T')[0]
    : null;
  if (current.primaryCompletionDate && current.primaryCompletionDate !== prevCompletion) {
    changes.push({
      type: 'completion_date_change',
      field: 'primary_completion_date',
      from: prevCompletion,
      to: current.primaryCompletionDate,
    });
  }

  return changes;
}

/**
 * Update the trial record in mrd_clinical_trials with latest API data.
 * @param {string} nctNumber - NCT identifier
 * @param {Object} current - Parsed current state
 */
async function updateTrialInDB(nctNumber, current) {
  await query(
    `UPDATE mrd_clinical_trials SET
       status = $2,
       has_results = $3,
       results_first_posted = $4,
       last_update_date = COALESCE($5::date, last_update_date),
       primary_completion_date = COALESCE($6::date, primary_completion_date),
       study_completion_date = COALESCE($7::date, study_completion_date),
       updated_at = NOW()
     WHERE nct_number = $1`,
    [
      nctNumber,
      current.overallStatus,
      current.hasResults,
      current.resultsFirstPosted ? parseDate(current.resultsFirstPosted) : null,
      current.lastUpdateDate ? parseDate(current.lastUpdateDate) : null,
      current.primaryCompletionDate ? parseDate(current.primaryCompletionDate) : null,
      current.studyCompletionDate ? parseDate(current.studyCompletionDate) : null,
    ]
  );
}

// ============================================
// PubMed — cross-reference for publications
// ============================================

/**
 * Build PubMed API URL parameters, optionally including the NCBI API key.
 * @param {Object} baseParams - Base query parameters
 * @returns {URLSearchParams}
 */
function buildPubMedParams(baseParams) {
  const params = new URLSearchParams(baseParams);
  if (config.ncbiApiKey) {
    params.append('api_key', config.ncbiApiKey);
  }
  return params;
}

/**
 * Search PubMed for publications related to a trial.
 * Uses two complementary search strategies:
 *   1. NCT number as a secondary identifier: {NCT}[si]
 *   2. Trial acronym + MRD/ctDNA keywords in title/abstract
 *
 * @param {Object} trial - Priority trial entry
 * @returns {Promise<string[]>} Array of PMIDs found
 */
async function searchPubMedForTrial(trial) {
  const allPmids = new Set();

  // Strategy 1: NCT number as secondary identifier
  try {
    const nctQuery = `${trial.nct}[si]`;
    const params = buildPubMedParams({
      db: 'pubmed',
      term: nctQuery,
      retmax: '50',
      retmode: 'json',
    });

    const url = `${PUBMED_BASE_URL}/esearch.fcgi?${params}`;
    const response = await pubmedHttp.getJson(url);
    const ids = response.esearchresult?.idlist || [];
    for (const id of ids) {
      allPmids.add(id);
    }
    logger.debug('PubMed NCT search', { nct: trial.nct, found: ids.length });
  } catch (error) {
    logger.warn('PubMed NCT search failed', { nct: trial.nct, error: error.message });
  }

  // Strategy 2: Acronym + MRD/ctDNA keywords
  // Only search if the trial has a meaningful acronym (skip generic names)
  const acronym = trial.name.split('/')[0].trim(); // Use first part for GALAXY/VEGA
  if (acronym && acronym.length >= 3) {
    try {
      const acronymQuery = `"${acronym}"[tiab] AND ("MRD" OR "ctDNA" OR "circulating tumor DNA")[tiab]`;
      const params = buildPubMedParams({
        db: 'pubmed',
        term: acronymQuery,
        retmax: '50',
        retmode: 'json',
      });

      const url = `${PUBMED_BASE_URL}/esearch.fcgi?${params}`;
      const response = await pubmedHttp.getJson(url);
      const ids = response.esearchresult?.idlist || [];
      for (const id of ids) {
        allPmids.add(id);
      }
      logger.debug('PubMed acronym search', { acronym, found: ids.length });
    } catch (error) {
      logger.warn('PubMed acronym search failed', { acronym, error: error.message });
    }
  }

  return Array.from(allPmids);
}

/**
 * Check which PMIDs are already tracked as guidance items.
 * @param {string[]} pmids - Array of PubMed IDs to check
 * @returns {Promise<Set<string>>} Set of PMIDs that already exist
 */
async function getExistingPmids(pmids) {
  if (pmids.length === 0) return new Set();

  // Build parameterized query for all PMIDs
  const placeholders = pmids.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(
    `SELECT source_id FROM mrd_guidance_items
     WHERE source_type = 'pubmed' AND source_id IN (${placeholders})`,
    pmids
  );

  return new Set(result.rows.map((r) => r.source_id));
}

/**
 * Fetch article details from PubMed efetch API.
 * Returns parsed metadata for each PMID.
 *
 * @param {string[]} pmids - Array of PubMed IDs
 * @returns {Promise<Object[]>} Array of article objects
 */
async function fetchPubMedArticles(pmids) {
  if (pmids.length === 0) return [];

  const params = buildPubMedParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  });

  const url = `${PUBMED_BASE_URL}/efetch.fcgi?${params}`;
  const xml = await pubmedHttp.getText(url);

  return parseArticlesXML(xml);
}

/**
 * Parse PubMed efetch XML response into article objects.
 * Uses regex-based parsing consistent with the existing pubmed.js crawler.
 *
 * @param {string} xml - Raw XML from efetch
 * @returns {Object[]} Parsed article metadata
 */
function parseArticlesXML(xml) {
  const articles = [];
  const articleMatches = xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);

  for (const match of articleMatches) {
    const articleXml = match[1];
    try {
      const article = {
        pmid: extractTag(articleXml, 'PMID'),
        title: extractTag(articleXml, 'ArticleTitle'),
        abstract: extractAbstract(articleXml),
        journal: extractTag(articleXml, 'Title'),
        journalAbbrev: extractTag(articleXml, 'ISOAbbreviation'),
        publicationDate: extractPublicationDate(articleXml),
        doi: extractDOI(articleXml),
        authors: extractAuthors(articleXml),
      };

      if (article.pmid && article.title) {
        articles.push(article);
      }
    } catch (error) {
      logger.warn('Failed to parse PubMed article XML', { error: error.message });
    }
  }

  return articles;
}

// ============================================
// XML parsing helpers (mirrors pubmed.js)
// ============================================

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 's'));
  return match ? cleanText(match[1]) : null;
}

function extractAbstract(xml) {
  const abstractTexts = [];
  const matches = xml.matchAll(/<AbstractText[^>]*>([^<]*)<\/AbstractText>/gs);
  for (const match of matches) {
    abstractTexts.push(cleanText(match[1]));
  }
  return abstractTexts.join(' ').trim() || null;
}

function extractPublicationDate(xml) {
  const pubDateMatch = xml.match(/<PubDate>([\s\S]*?)<\/PubDate>/);
  if (pubDateMatch) {
    const dateXml = pubDateMatch[1];
    const year = extractTag(dateXml, 'Year');
    const month = extractTag(dateXml, 'Month');
    const day = extractTag(dateXml, 'Day');

    if (year) {
      const monthNum = monthToNumber(month) || '01';
      const dayNum = day ? day.padStart(2, '0') : '01';
      return `${year}-${monthNum}-${dayNum}`;
    }
  }

  const medlineDateMatch = xml.match(/<MedlineDate>(\d{4})/);
  if (medlineDateMatch) {
    return `${medlineDateMatch[1]}-01-01`;
  }

  return null;
}

function monthToNumber(month) {
  if (!month) return null;
  const map = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  };
  return map[month.toLowerCase().substring(0, 3)] || null;
}

function extractDOI(xml) {
  const match = xml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
  return match ? match[1] : null;
}

function extractAuthors(xml) {
  const authors = [];
  const authorMatches = xml.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/g);

  for (const match of authorMatches) {
    const authorXml = match[1];
    const lastName = extractTag(authorXml, 'LastName');
    const foreName = extractTag(authorXml, 'ForeName');
    const initials = extractTag(authorXml, 'Initials');

    if (lastName) {
      authors.push({
        name: foreName ? `${lastName} ${initials || foreName.charAt(0)}` : lastName,
      });
    }
  }

  return authors;
}

function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// Guidance item creation
// ============================================

/**
 * Determine the evidence type for a trial publication.
 * Primary results from phase III RCTs are tagged as 'rct_results';
 * sub-analyses and smaller trials as 'observational'.
 *
 * @param {Object} trial - Priority trial entry
 * @param {boolean} isPrimaryResult - Whether this appears to be the primary outcome publication
 * @returns {string} Evidence type value
 */
function classifyEvidenceType(trial, isPrimaryResult) {
  if (isPrimaryResult && trial.phase.includes('III')) {
    return 'rct_results';
  }
  if (isPrimaryResult) {
    return 'rct_results';
  }
  return 'observational';
}

/**
 * Create a guidance item for a new trial publication.
 * Inserts into mrd_guidance_items with junction entries for cancer types
 * and clinical settings, then triggers embedding generation.
 *
 * @param {Object} article - Parsed PubMed article
 * @param {Object} trial - Priority trial entry
 * @param {boolean} isPrimaryResult - Whether this is the primary results publication
 * @returns {Promise<number|null>} Guidance item ID or null if already exists
 */
async function createGuidanceItem(article, trial, isPrimaryResult) {
  const evidenceType = classifyEvidenceType(trial, isPrimaryResult);

  const decisionContext = {
    trial_nct: trial.nct,
    trial_name: trial.name,
    is_primary_result: isPrimaryResult,
    cancer_type: trial.cancer,
    import_source: 'trial-results-watcher',
  };

  const sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
  const authorStr = JSON.stringify(article.authors || []);

  const insertResult = await query(
    `INSERT INTO mrd_guidance_items (
       source_type, source_id, source_url, title, authors,
       publication_date, journal, doi, pmid,
       evidence_type, relevance_score, summary,
       key_findings, decision_context
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (source_type, source_id) DO NOTHING
     RETURNING id`,
    [
      'pubmed',
      article.pmid,
      sourceUrl,
      article.title,
      authorStr,
      article.publicationDate ? new Date(article.publicationDate) : new Date(),
      article.journal,
      article.doi,
      article.pmid,
      evidenceType,
      9, // Priority trial results are highly relevant
      article.abstract || article.title,
      JSON.stringify([`Results from ${trial.name} (${trial.nct}), a phase ${trial.phase} trial in ${trial.cancer}`]),
      JSON.stringify(decisionContext),
    ]
  );

  if (insertResult.rows.length === 0) {
    logger.debug('Guidance item already exists', { pmid: article.pmid });
    return null;
  }

  const guidanceId = insertResult.rows[0].id;
  logger.info('Created guidance item', { guidanceId, pmid: article.pmid, trial: trial.name });

  // Populate cancer_types junction
  await query(
    `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [guidanceId, trial.cancer]
  );

  // Populate clinical_settings junction
  const settings = CLINICAL_SETTING_MAP[trial.cancer] || ['adjuvant'];
  for (const setting of settings) {
    await query(
      `INSERT INTO mrd_guidance_clinical_settings (guidance_id, clinical_setting)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [guidanceId, setting]
    );
  }

  // Trigger embedding generation (best-effort, don't fail the overall process)
  try {
    await embedGuidanceItem(guidanceId);
    logger.debug('Embedding generated', { guidanceId });
  } catch (error) {
    logger.warn('Embedding generation failed (will be caught by embedAllMissing)', {
      guidanceId,
      error: error.message,
    });
  }

  return guidanceId;
}

// ============================================
// Email alerts
// ============================================

/**
 * Send an email alert when new trial results are detected.
 *
 * @param {Object} trial - Priority trial entry
 * @param {Object} article - Parsed PubMed article
 * @param {Object[]} changes - Status changes detected for this trial
 * @returns {Promise<boolean>} Whether the email was sent
 */
async function sendTrialResultsAlert(trial, article, changes) {
  const changesSummary = changes.length > 0
    ? changes.map((c) => `${c.field}: ${c.from} &rarr; ${c.to}`).join('<br/>')
    : 'No status changes (new publication found via PubMed)';

  const authorList = (article.authors || []).map((a) => a.name).join(', ');
  const abstractPreview = article.abstract
    ? article.abstract.substring(0, 500) + (article.abstract.length > 500 ? '...' : '')
    : 'No abstract available.';

  const subject = `[Trial Results] ${trial.name} (${trial.nct}) \u2014 Publication Found`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1e293b; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
        Trial Results Alert
      </h1>

      <h2 style="color: #334155; margin-top: 20px;">
        ${trial.name} (${trial.nct})
      </h2>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f1f5f9; font-weight: 600; width: 140px;">Cancer Type</td>
          <td style="padding: 8px 12px; background: #f1f5f9;">${trial.cancer}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: 600;">Phase</td>
          <td style="padding: 8px 12px;">${trial.phase}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f1f5f9; font-weight: 600;">Status Changes</td>
          <td style="padding: 8px 12px; background: #f1f5f9;">${changesSummary}</td>
        </tr>
      </table>

      <h3 style="color: #334155; margin-top: 24px;">Publication</h3>

      <p style="font-size: 16px; font-weight: 600; color: #0f172a;">${article.title}</p>
      <p style="color: #64748b; margin: 4px 0;">${authorList}</p>
      <p style="color: #64748b; margin: 4px 0;">
        ${article.journal || 'Unknown journal'}
        ${article.publicationDate ? ` &middot; ${article.publicationDate}` : ''}
      </p>

      <p style="margin-top: 12px;">
        <strong>PMID:</strong>
        <a href="https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/" style="color: #2563eb;">${article.pmid}</a>
        ${article.doi ? ` &middot; <strong>DOI:</strong> <a href="https://doi.org/${article.doi}" style="color: #2563eb;">${article.doi}</a>` : ''}
      </p>

      <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin-top: 16px;">
        <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.6;">${abstractPreview}</p>
      </div>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Detected by OpenOnco MRD Trial Results Watcher &middot; ${new Date().toISOString()}
      </p>
    </div>
  `;

  try {
    await sendEmail({ subject, html });
    logger.info('Trial results alert sent', { trial: trial.name, pmid: article.pmid });
    return true;
  } catch (error) {
    logger.error('Failed to send trial results alert', {
      trial: trial.name,
      pmid: article.pmid,
      error: error.message,
    });
    return false;
  }
}

/**
 * Send a summary alert for status-only changes (no new publications).
 *
 * @param {Object} trial - Priority trial entry
 * @param {Object[]} changes - Detected status changes
 * @returns {Promise<boolean>} Whether the email was sent
 */
async function sendStatusChangeAlert(trial, changes) {
  const changeRows = changes.map((c) =>
    `<tr>
       <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${c.field}</td>
       <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${c.from || 'N/A'}</td>
       <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${c.to}</td>
     </tr>`
  ).join('');

  const subject = `[Trial Update] ${trial.name} (${trial.nct}) \u2014 Status Changed`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1e293b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">
        Trial Status Change
      </h1>

      <h2 style="color: #334155;">${trial.name} (${trial.nct})</h2>
      <p style="color: #64748b;">${trial.cancer} &middot; Phase ${trial.phase}</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 8px 12px; text-align: left;">Field</th>
            <th style="padding: 8px 12px; text-align: left;">Previous</th>
            <th style="padding: 8px 12px; text-align: left;">Current</th>
          </tr>
        </thead>
        <tbody>
          ${changeRows}
        </tbody>
      </table>

      <p style="margin-top: 16px;">
        <a href="https://clinicaltrials.gov/study/${trial.nct}" style="color: #2563eb;">
          View on ClinicalTrials.gov
        </a>
      </p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Detected by OpenOnco MRD Trial Results Watcher &middot; ${new Date().toISOString()}
      </p>
    </div>
  `;

  try {
    await sendEmail({ subject, html });
    logger.info('Status change alert sent', { trial: trial.name });
    return true;
  } catch (error) {
    logger.error('Failed to send status change alert', {
      trial: trial.name,
      error: error.message,
    });
    return false;
  }
}

// ============================================
// Crawler run tracking
// ============================================

/**
 * Create a crawler run record in mrd_crawler_runs.
 * @returns {Promise<number>} The run ID
 */
async function createCrawlerRun() {
  const result = await query(
    `INSERT INTO mrd_crawler_runs (crawler_name, mode, started_at, status)
     VALUES ('trial-results', 'watch', NOW(), 'running')
     RETURNING id`
  );
  return result.rows[0].id;
}

/**
 * Finalize the crawler run record with results.
 *
 * @param {number} runId - The run ID
 * @param {Object} params - Result parameters
 * @param {string} params.status - 'completed' or 'failed'
 * @param {number} params.itemsFound - Total trials checked
 * @param {number} params.itemsNew - New publications found
 * @param {number} params.itemsDuplicate - Already-known publications
 * @param {Object} params.highWaterMark - JSON high water mark
 * @param {string} [params.errorMessage] - Error message if failed
 */
async function finalizeCrawlerRun(runId, params) {
  const {
    status = 'completed',
    itemsFound = 0,
    itemsNew = 0,
    itemsDuplicate = 0,
    highWaterMark = null,
    errorMessage = null,
  } = params;

  await query(
    `UPDATE mrd_crawler_runs SET
       completed_at = NOW(),
       status = $2,
       items_found = $3,
       items_new = $4,
       items_duplicate = $5,
       high_water_mark = $6,
       error_message = $7,
       duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
     WHERE id = $1`,
    [
      runId,
      status,
      itemsFound,
      itemsNew,
      itemsDuplicate,
      highWaterMark ? JSON.stringify(highWaterMark) : null,
      errorMessage,
    ]
  );
}

// ============================================
// Date helper
// ============================================

/**
 * Normalize partial date strings from ClinicalTrials.gov into YYYY-MM-DD format.
 * Handles YYYY, YYYY-MM, and YYYY-MM-DD inputs.
 *
 * @param {string} dateStr - Partial or full date string
 * @returns {string|null} Normalized date or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 1) return `${parts[0]}-01-01`;
  if (parts.length === 2) return `${parts[0]}-${parts[1].padStart(2, '0')}-01`;
  return dateStr;
}

// ============================================
// Main orchestrator
// ============================================

/**
 * Run the trial results watcher.
 *
 * For each of the 13 priority MRD trials:
 * 1. Fetches current state from ClinicalTrials.gov v2 API
 * 2. Compares against stored DB state for status/results changes
 * 3. Searches PubMed for publications linked by NCT number or trial acronym
 * 4. Filters out already-tracked publications
 * 5. Creates guidance items for new publications
 * 6. Sends email alerts for significant findings
 * 7. Records the crawler run
 *
 * Errors on individual trials are caught and logged without stopping
 * the overall run.
 *
 * @returns {Promise<Object>} Summary of the run
 */
export async function runTrialResultsWatcher() {
  logger.info('Starting trial results watcher', { trials: PRIORITY_TRIALS.length });

  let runId = null;
  try {
    runId = await createCrawlerRun();
  } catch (error) {
    logger.warn('Failed to create crawler run record', { error: error.message });
  }

  const results = {
    success: true,
    trialsChecked: 0,
    statusChanges: [],
    newPublications: [],
    guidanceItemsCreated: 0,
    emailsSent: 0,
  };

  const trialStatuses = {};

  for (const trial of PRIORITY_TRIALS) {
    try {
      logger.info('Checking trial', { nct: trial.nct, name: trial.name });

      // ---- Step 1: Fetch current state from ClinicalTrials.gov ----
      let currentState;
      try {
        const study = await fetchTrialFromCTGov(trial.nct);
        currentState = parseTrialStatus(study);
      } catch (error) {
        logger.error('Failed to fetch trial from ClinicalTrials.gov', {
          nct: trial.nct,
          error: error.message,
        });
        // Continue to PubMed search even if CT.gov fails
        currentState = null;
      }

      // ---- Step 2: Detect status changes ----
      let changes = [];
      if (currentState) {
        const previousState = await getPreviousTrialState(trial.nct);
        changes = detectChanges(currentState, previousState);

        if (changes.length > 0) {
          logger.info('Status changes detected', {
            nct: trial.nct,
            name: trial.name,
            changes,
          });
          results.statusChanges.push({
            nct: trial.nct,
            name: trial.name,
            changes,
          });
        }

        // Update DB with latest state
        try {
          await updateTrialInDB(trial.nct, currentState);
        } catch (error) {
          logger.warn('Failed to update trial in DB', { nct: trial.nct, error: error.message });
        }

        trialStatuses[trial.nct] = currentState.overallStatus;
      }

      // ---- Step 3: Search PubMed for publications ----
      const pmids = await searchPubMedForTrial(trial);
      logger.debug('PubMed results for trial', { nct: trial.nct, pmids: pmids.length });

      if (pmids.length === 0) {
        results.trialsChecked++;
        // Send status-change-only alert if there were changes but no publications
        if (changes.length > 0) {
          const sent = await sendStatusChangeAlert(trial, changes);
          if (sent) results.emailsSent++;
        }
        continue;
      }

      // ---- Step 4: Filter out already-known publications ----
      const existingPmids = await getExistingPmids(pmids);
      const newPmids = pmids.filter((id) => !existingPmids.has(id));

      logger.debug('New PMIDs for trial', {
        nct: trial.nct,
        total: pmids.length,
        existing: existingPmids.size,
        new: newPmids.length,
      });

      if (newPmids.length === 0) {
        results.trialsChecked++;
        // Still send status-change alert even if no new publications
        if (changes.length > 0) {
          const sent = await sendStatusChangeAlert(trial, changes);
          if (sent) results.emailsSent++;
        }
        continue;
      }

      // ---- Step 5: Fetch article details and create guidance items ----
      const articles = await fetchPubMedArticles(newPmids);

      for (const article of articles) {
        // Heuristic: first publication for a completed/results-posted trial is likely primary
        const isPrimaryResult =
          currentState?.hasResults ||
          currentState?.overallStatus === 'completed' ||
          changes.some((c) => c.type === 'results_posted');

        try {
          const guidanceId = await createGuidanceItem(article, trial, isPrimaryResult);
          if (guidanceId) {
            results.guidanceItemsCreated++;
            results.newPublications.push({
              nct: trial.nct,
              trialName: trial.name,
              pmid: article.pmid,
              title: article.title,
              journal: article.journal,
              guidanceId,
            });

            // Send email alert for each new publication
            const sent = await sendTrialResultsAlert(trial, article, changes);
            if (sent) results.emailsSent++;
          }
        } catch (error) {
          logger.error('Failed to create guidance item', {
            nct: trial.nct,
            pmid: article.pmid,
            error: error.message,
          });
        }
      }

      results.trialsChecked++;
    } catch (error) {
      // Per-trial error handling: log and continue
      logger.error('Error processing trial', {
        nct: trial.nct,
        name: trial.name,
        error: error.message,
      });
      results.trialsChecked++;
    }
  }

  // ---- Step 6: Finalize crawler run ----
  const highWaterMark = {
    lastRun: new Date().toISOString(),
    trialStatuses,
  };

  if (runId) {
    try {
      await finalizeCrawlerRun(runId, {
        status: 'completed',
        itemsFound: results.trialsChecked,
        itemsNew: results.guidanceItemsCreated,
        itemsDuplicate: 0,
        highWaterMark,
      });
    } catch (error) {
      logger.warn('Failed to finalize crawler run', { error: error.message });
    }
  }

  logger.info('Trial results watcher complete', {
    trialsChecked: results.trialsChecked,
    statusChanges: results.statusChanges.length,
    newPublications: results.newPublications.length,
    guidanceItemsCreated: results.guidanceItemsCreated,
    emailsSent: results.emailsSent,
  });

  return results;
}

export { PRIORITY_TRIALS };
