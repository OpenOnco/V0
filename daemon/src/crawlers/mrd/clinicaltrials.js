/**
 * ClinicalTrials.gov Crawler for MRD Guidance Monitor
 * Uses the ClinicalTrials.gov v2 API (beta)
 *
 * API Documentation: https://clinicaltrials.gov/data-api/api
 *
 * Rate limits: 10 requests/second with API key
 */

import { createHttpClient } from '../../utils/http.js';
import { createLogger } from '../../utils/logger.js';
import { query, transaction } from '../../db/mrd-client.js';

const logger = createLogger('mrd-clinicaltrials');
const BASE_URL = 'https://clinicaltrials.gov/api/v2';

const http = createHttpClient('clinicaltrials', { requestsPerMinute: 300 });

// MRD-related search conditions
const MRD_CONDITIONS = [
  'minimal residual disease',
  'molecular residual disease',
  'circulating tumor DNA',
  'ctDNA',
  'liquid biopsy',
];

// Cancer types to include (solid tumors)
const SOLID_TUMOR_TERMS = [
  'colorectal cancer',
  'breast cancer',
  'lung cancer',
  'NSCLC',
  'bladder cancer',
  'urothelial cancer',
  'pancreatic cancer',
  'melanoma',
  'ovarian cancer',
  'gastric cancer',
  'esophageal cancer',
];

// Status mapping from API to our enum
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

// Priority trial NCT numbers (landmark MRD trials)
const PRIORITY_TRIALS = [
  'NCT04264702', // CIRCULATE-US
  'NCT04089631', // CIRCULATE-Japan
  'NCT04120701', // DYNAMIC (colorectal)
  'NCT04302025', // DYNAMIC-III
  'NCT05078866', // BESPOKE CRC
  'NCT05827614', // COBRA (colon)
  'NCT03748680', // IMvigor 011
  'NCT05084339', // MERMAID-1 (bladder)
  'NCT04385368', // MERMAID-2 (bladder)
  'NCT03832569', // GALAXY
  'NCT04585477', // c-TRAK TN (breast)
  'NCT05581134', // DARE (breast)
  'NCT05102045', // BR.36 (lung)
];

/**
 * Filter for solid tumor interventional trials
 * @param {Object} study - Study object from API
 * @returns {boolean} - True if study should be included
 */
function isRelevantTrial(study) {
  const protocol = study.protocolSection || {};
  const conditions = protocol.conditionsModule?.conditions || [];
  const conditionText = conditions.join(' ').toLowerCase();
  const title = (protocol.identificationModule?.briefTitle || '').toLowerCase();
  const fullText = conditionText + ' ' + title;
  const studyType = protocol.designModule?.studyType;

  // Only include interventional studies
  if (studyType && studyType !== 'INTERVENTIONAL') {
    return false;
  }

  // Exclude hematologic malignancies
  const hemeTerms = ['leukemia', 'lymphoma', 'myeloma', 'myeloid', 'myelodysplastic'];
  for (const term of hemeTerms) {
    if (fullText.includes(term)) {
      return false;
    }
  }

  return true;
}

/**
 * Search ClinicalTrials.gov for MRD trials
 * @param {Object} options - Search options
 * @returns {Promise<Object[]>}
 */
export async function searchTrials(options = {}) {
  const {
    pageSize = 100,
    maxResults = 500,
  } = options;

  // Use simpler search - ctDNA + cancer
  // The ClinicalTrials.gov v2 API has limited filter support
  const searchQuery = 'ctDNA cancer';

  const params = new URLSearchParams({
    format: 'json',
    'query.cond': searchQuery,
    pageSize: pageSize.toString(),
    countTotal: 'true',
  });

  logger.info('Searching ClinicalTrials.gov', { query: searchQuery });

  const url = `${BASE_URL}/studies?${params}`;
  let response;

  try {
    response = await http.getJson(url);
  } catch (error) {
    logger.error('ClinicalTrials.gov search failed', { error: error.message });
    throw error;
  }

  const totalCount = response.totalCount || 0;
  let studies = response.studies || [];

  logger.info('Search results', { total: totalCount, firstPage: studies.length });

  // Fetch additional pages if needed
  let nextPageToken = response.nextPageToken;
  while (nextPageToken && studies.length < maxResults) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('pageToken', nextPageToken);

    const nextResponse = await http.getJson(`${BASE_URL}/studies?${nextParams}`);
    studies = studies.concat(nextResponse.studies || []);
    nextPageToken = nextResponse.nextPageToken;

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Post-filter to exclude non-interventional and hematologic malignancies
  const relevantStudies = studies.filter(isRelevantTrial);
  logger.info('Filtered results', {
    total: studies.length,
    relevant: relevantStudies.length,
    excluded: studies.length - relevantStudies.length,
  });

  return relevantStudies.slice(0, maxResults);
}

/**
 * Fetch a single trial by NCT number
 * @param {string} nctNumber - NCT number
 * @returns {Promise<Object>}
 */
export async function fetchTrial(nctNumber) {
  const url = `${BASE_URL}/studies/${nctNumber}?format=json`;
  return http.getJson(url);
}

/**
 * Parse trial data into our schema
 * @param {Object} study - Raw study from API
 * @returns {Object}
 */
function parseTrialData(study) {
  const protocol = study.protocolSection || {};
  const identification = protocol.identificationModule || {};
  const status = protocol.statusModule || {};
  const design = protocol.designModule || {};
  const eligibility = protocol.eligibilityModule || {};
  const contacts = protocol.contactsLocationsModule || {};
  const sponsor = protocol.sponsorCollaboratorsModule || {};
  const outcomes = protocol.outcomesModule || {};

  // Extract cancer types from conditions
  const conditions = protocol.conditionsModule?.conditions || [];
  const cancerTypes = extractCancerTypes(conditions);

  // Parse dates
  const startDate = status.startDateStruct?.date;
  const primaryCompletionDate = status.primaryCompletionDateStruct?.date;
  const studyCompletionDate = status.completionDateStruct?.date;
  const lastUpdateDate = status.lastUpdateSubmitDate;

  return {
    nct_number: identification.nctId,
    brief_title: identification.briefTitle,
    official_title: identification.officialTitle,
    acronym: identification.acronym,
    cancer_types: JSON.stringify(cancerTypes),
    phase: design.phases?.join(', '),
    status: STATUS_MAP[status.overallStatus] || 'unknown',
    study_type: design.studyType,
    intervention_summary: summarizeInterventions(protocol.armsInterventionsModule),
    primary_endpoints: JSON.stringify(outcomes.primaryOutcomes || []),
    secondary_endpoints: JSON.stringify(outcomes.secondaryOutcomes || []),
    arms: JSON.stringify(protocol.armsInterventionsModule?.armGroups || []),
    masking: design.maskingInfo?.masking,
    allocation: design.designInfo?.allocation,
    enrollment_target: design.enrollmentInfo?.count,
    start_date: startDate ? parseDate(startDate) : null,
    primary_completion_date: primaryCompletionDate ? parseDate(primaryCompletionDate) : null,
    primary_completion_type: status.primaryCompletionDateStruct?.type,
    study_completion_date: studyCompletionDate ? parseDate(studyCompletionDate) : null,
    last_update_date: lastUpdateDate ? parseDate(lastUpdateDate) : new Date(),
    has_results: status.resultsFirstSubmitDate != null,
    results_first_posted: status.resultsFirstPostDate ? parseDate(status.resultsFirstPostDate.date) : null,
    lead_sponsor: sponsor.leadSponsor?.name,
    lead_sponsor_type: sponsor.leadSponsor?.class,
    collaborators: JSON.stringify(sponsor.collaborators?.map((c) => c.name) || []),
    overall_contact: JSON.stringify(contacts.overallOfficials?.[0] || null),
    locations_count: contacts.locations?.length || 0,
    is_priority_trial: PRIORITY_TRIALS.includes(identification.nctId),
  };
}

function extractCancerTypes(conditions) {
  const types = new Set();
  const conditionText = conditions.join(' ').toLowerCase();

  if (conditionText.includes('colorectal') || conditionText.includes('colon') || conditionText.includes('rectal')) {
    types.add('colorectal');
  }
  if (conditionText.includes('breast')) {
    types.add('breast');
  }
  if (conditionText.includes('lung') || conditionText.includes('nsclc')) {
    types.add('lung_nsclc');
  }
  if (conditionText.includes('bladder') || conditionText.includes('urothelial')) {
    types.add('bladder');
  }
  if (conditionText.includes('pancrea')) {
    types.add('pancreatic');
  }
  if (conditionText.includes('melanoma')) {
    types.add('melanoma');
  }
  if (conditionText.includes('ovarian')) {
    types.add('ovarian');
  }
  if (conditionText.includes('gastric') || conditionText.includes('stomach')) {
    types.add('gastric');
  }
  if (conditionText.includes('esophag')) {
    types.add('esophageal');
  }

  return Array.from(types);
}

function summarizeInterventions(armsModule) {
  if (!armsModule?.interventions) return null;

  return armsModule.interventions
    .map((i) => `${i.type}: ${i.name}`)
    .join('; ');
}

function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle YYYY-MM-DD and YYYY-MM and YYYY formats
  const parts = dateStr.split('-');
  if (parts.length === 1) {
    return `${parts[0]}-01-01`;
  }
  if (parts.length === 2) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-01`;
  }
  return dateStr;
}

/**
 * Upsert a trial into the database
 * @param {Object} trialData - Parsed trial data
 * @returns {Promise<{id: number, isNew: boolean}>}
 */
export async function upsertTrial(trialData) {
  const result = await query(
    `INSERT INTO mrd_clinical_trials (
       nct_number, brief_title, official_title, acronym,
       cancer_types, phase, status, study_type,
       intervention_summary, primary_endpoints, secondary_endpoints, arms,
       masking, allocation, enrollment_target,
       start_date, primary_completion_date, primary_completion_type,
       study_completion_date, last_update_date,
       has_results, results_first_posted,
       lead_sponsor, lead_sponsor_type, collaborators,
       overall_contact, locations_count, is_priority_trial
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
       $23, $24, $25, $26, $27, $28
     )
     ON CONFLICT (nct_number) DO UPDATE SET
       brief_title = EXCLUDED.brief_title,
       official_title = EXCLUDED.official_title,
       status = EXCLUDED.status,
       enrollment_target = EXCLUDED.enrollment_target,
       primary_completion_date = EXCLUDED.primary_completion_date,
       study_completion_date = EXCLUDED.study_completion_date,
       last_update_date = EXCLUDED.last_update_date,
       has_results = EXCLUDED.has_results,
       results_first_posted = EXCLUDED.results_first_posted,
       locations_count = EXCLUDED.locations_count,
       updated_at = NOW()
     RETURNING id, (xmax = 0) as is_new`,
    [
      trialData.nct_number,
      trialData.brief_title,
      trialData.official_title,
      trialData.acronym,
      trialData.cancer_types,
      trialData.phase,
      trialData.status,
      trialData.study_type,
      trialData.intervention_summary,
      trialData.primary_endpoints,
      trialData.secondary_endpoints,
      trialData.arms,
      trialData.masking,
      trialData.allocation,
      trialData.enrollment_target,
      trialData.start_date,
      trialData.primary_completion_date,
      trialData.primary_completion_type,
      trialData.study_completion_date,
      trialData.last_update_date,
      trialData.has_results,
      trialData.results_first_posted,
      trialData.lead_sponsor,
      trialData.lead_sponsor_type,
      trialData.collaborators,
      trialData.overall_contact,
      trialData.locations_count,
      trialData.is_priority_trial,
    ]
  );

  return {
    id: result.rows[0].id,
    isNew: result.rows[0].is_new,
  };
}

/**
 * Run ClinicalTrials.gov crawler
 * @param {Object} options - Crawl options
 * @returns {Promise<Object>}
 */
export async function crawlClinicalTrials(options = {}) {
  const { maxResults = 500, dryRun = false } = options;

  logger.info('Starting ClinicalTrials.gov crawl', { maxResults, dryRun });

  const stats = {
    found: 0,
    new: 0,
    updated: 0,
    failed: 0,
  };

  try {
    // Search for trials
    const studies = await searchTrials({ maxResults });
    stats.found = studies.length;

    if (dryRun) {
      logger.info('Dry run complete', { found: stats.found });
      return { success: true, stats, trials: studies.slice(0, 5) };
    }

    // Process each trial
    for (const study of studies) {
      try {
        const trialData = parseTrialData(study);
        const { id, isNew } = await upsertTrial(trialData);

        if (isNew) {
          stats.new++;
        } else {
          stats.updated++;
        }
      } catch (error) {
        logger.warn('Failed to process trial', {
          nct: study.protocolSection?.identificationModule?.nctId,
          error: error.message,
        });
        stats.failed++;
      }
    }

    logger.info('ClinicalTrials.gov crawl complete', { stats });
    return { success: true, stats };

  } catch (error) {
    logger.error('ClinicalTrials.gov crawl failed', { error: error.message });
    return { success: false, error: error.message, stats };
  }
}

/**
 * Seed priority trials
 * @returns {Promise<Object>}
 */
export async function seedPriorityTrials() {
  logger.info('Seeding priority MRD trials', { count: PRIORITY_TRIALS.length });

  const stats = { success: 0, failed: 0 };

  for (const nctNumber of PRIORITY_TRIALS) {
    try {
      const study = await fetchTrial(nctNumber);
      const trialData = parseTrialData(study);
      await upsertTrial(trialData);
      stats.success++;

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      logger.warn('Failed to seed trial', { nct: nctNumber, error: error.message });
      stats.failed++;
    }
  }

  logger.info('Priority trials seeded', { stats });
  return stats;
}

export default {
  searchTrials,
  fetchTrial,
  parseTrialData,
  upsertTrial,
  crawlClinicalTrials,
  seedPriorityTrials,
  PRIORITY_TRIALS,
};
