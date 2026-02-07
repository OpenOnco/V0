/**
 * NIH RePORTER Crawler
 * Monitors NIH-funded MRD/ctDNA research grants via the RePORTER API
 *
 * API: https://api.reporter.nih.gov/v2/projects/search
 * - No auth required
 * - Rate limit: 1 request/second
 * - Max 500 results per page, use offset for pagination
 * - POST with Content-Type: application/json
 *
 * Phase 2 (future): PMID cross-reference via /v2/publications/search
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GRANTS_STORE_PATH = join(__dirname, '../../data/nih-grants.json');

const API_BASE = 'https://api.reporter.nih.gov/v2';

// Fields to request from the API
const INCLUDE_FIELDS = [
  'ProjectTitle', 'AbstractText', 'FiscalYear', 'AwardAmount',
  'Organization', 'PrincipalInvestigators', 'ProjectStartDate',
  'ProjectEndDate', 'AgencyIcAdmin', 'ActivityCode', 'ApplId',
  'ClinicalTrials', 'ProjectNum', 'AwardNoticeDate',
];

// Query group A - Narrow MRD/ctDNA (high relevance)
const QUERIES_HIGH = [
  { text: 'minimal residual disease ctDNA', operator: 'and' },
  { text: 'circulating tumor DNA MRD', operator: 'and' },
  { text: 'ctDNA guided therapy', operator: 'and' },
];

// Query group B - Broader liquid biopsy (medium relevance)
const QUERIES_MEDIUM = [
  { text: 'liquid biopsy cancer detection', operator: 'and' },
  { text: 'cell-free DNA cancer', operator: 'and' },
];

export class NIHReporterCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.nih?.name || 'NIH RePORTER',
      source: SOURCES.NIH,
      description: config.crawlers.nih?.description || 'NIH-funded MRD/ctDNA research grants',
      rateLimit: config.crawlers.nih?.rateLimit || 1, // 1 req/sec
      enabled: config.crawlers.nih?.enabled ?? true,
    });

  }

  /**
   * Main crawl implementation
   * Runs query groups A (high relevance) and B (medium relevance)
   */
  async crawl() {
    this.log('info', 'Starting NIH RePORTER crawl');

    // Per-run dedup set — prevents the same grant from being processed
    // twice when it matches multiple query strings within this crawl
    const seenApplIds = new Set();

    const previousStore = loadGrantStore();
    const previousGrants = previousStore.grants || {};
    const discoveries = [];
    const allFetchedGrants = {};

    // Run high-relevance queries
    for (const q of QUERIES_HIGH) {
      try {
        const grants = await this.searchProjects(q.text, q.operator);
        this.log('info', `Query "${q.text}" returned ${grants.length} results`);

        for (const grant of grants) {
          if (seenApplIds.has(grant.appl_id)) continue;
          seenApplIds.add(grant.appl_id);

          allFetchedGrants[grant.appl_id] = { ...grant, relevance_group: 'A' };

          const disc = this.detectChanges(grant, previousGrants[grant.appl_id], 'A');
          if (disc) discoveries.push(disc);
        }
      } catch (error) {
        this.log('warn', `Query "${q.text}" failed`, { error: error.message });
      }
    }

    // Run medium-relevance queries
    for (const q of QUERIES_MEDIUM) {
      try {
        const grants = await this.searchProjects(q.text, q.operator);
        this.log('info', `Query "${q.text}" returned ${grants.length} results`);

        for (const grant of grants) {
          if (seenApplIds.has(grant.appl_id)) continue;
          seenApplIds.add(grant.appl_id);

          allFetchedGrants[grant.appl_id] = { ...grant, relevance_group: 'B' };

          const disc = this.detectChanges(grant, previousGrants[grant.appl_id], 'B');
          if (disc) discoveries.push(disc);
        }
      } catch (error) {
        this.log('warn', `Query "${q.text}" failed`, { error: error.message });
      }
    }

    // Save updated grant store
    const mergedGrants = { ...previousGrants, ...this.mergeGrants(allFetchedGrants, previousGrants) };
    const totalFunding = Object.values(mergedGrants)
      .reduce((sum, g) => sum + (g.award_amount || 0), 0);

    saveGrantStore({
      grants: mergedGrants,
      meta: {
        last_run: new Date().toISOString(),
        total_grants_tracked: Object.keys(mergedGrants).length,
        total_funding: totalFunding,
        queries_run: QUERIES_HIGH.length + QUERIES_MEDIUM.length,
      },
    });

    this.log('info', 'NIH RePORTER crawl complete', {
      totalFetched: Object.keys(allFetchedGrants).length,
      discoveries: discoveries.length,
      totalTracked: Object.keys({ ...previousGrants, ...allFetchedGrants }).length,
    });

    return discoveries;
  }

  /**
   * Search NIH RePORTER projects API
   * Handles pagination (max 500 per page)
   *
   * @param {string} searchText - Search terms
   * @param {string} operator - 'and' or 'or'
   * @returns {Promise<Array>} - Normalized grant objects
   */
  async searchProjects(searchText, operator = 'and') {
    const allGrants = [];
    let offset = 0;
    const limit = 500;

    while (true) {
      const body = {
        criteria: {
          advanced_text_search: {
            operator,
            search_field: 'projecttitle,terms,abstracttext',
            search_text: searchText,
          },
          include_active_projects: true,
          agencies: ['NIH'],
        },
        offset,
        limit,
        include_fields: INCLUDE_FIELDS,
      };

      this.log('debug', `Searching RePORTER: "${searchText}" offset=${offset}`);

      const response = await this.http.postJson(`${API_BASE}/projects/search`, body);

      const results = response?.results || [];
      if (results.length === 0) break;

      for (const raw of results) {
        allGrants.push(normalizeGrant(raw));
      }

      // If we got fewer than limit, we've reached the end
      if (results.length < limit) break;
      offset += limit;

      // Safety cap — don't paginate beyond 5000 results per query
      if (offset >= 5000) {
        this.log('warn', `Hit pagination cap for "${searchText}" at offset ${offset}`);
        break;
      }
    }

    return allGrants;
  }

  /**
   * Detect changes between current and previous grant data
   * Returns a discovery object if the grant is new or changed
   *
   * @param {Object} grant - Current grant data
   * @param {Object|undefined} previous - Previous grant data (undefined = new)
   * @param {string} relevanceGroup - 'A' (high) or 'B' (medium)
   * @returns {Object|null} - Discovery object or null
   */
  detectChanges(grant, previous, relevanceGroup) {
    const currentHash = hashGrant(grant);

    if (!previous) {
      // New grant
      return {
        source: SOURCES.NIH,
        type: DISCOVERY_TYPES.NIH_NEW_GRANT,
        title: `New NIH Grant: ${grant.project_title}`,
        summary: formatGrantSummary(grant),
        url: `https://reporter.nih.gov/project-details/${grant.appl_id}`,
        relevance: relevanceGroup === 'A' ? 'high' : 'medium',
        metadata: {
          appl_id: grant.appl_id,
          project_num: grant.project_num,
          activity_code: grant.activity_code,
          agency: grant.agency,
          award_amount: grant.award_amount,
          fiscal_year: grant.fiscal_year,
          pi_names: grant.pi_names,
          organization: grant.organization_name,
          clinical_trial_ncts: grant.clinical_trial_ncts,
          relevance_group: relevanceGroup,
          change_type: 'new',
        },
      };
    }

    const previousHash = previous.hash;
    if (currentHash === previousHash) {
      return null; // No changes
    }

    // Determine what changed
    const changes = [];
    if (grant.award_amount !== previous.award_amount) {
      changes.push(`funding ${previous.award_amount ? `$${(previous.award_amount / 1000).toFixed(0)}K` : 'N/A'} → $${(grant.award_amount / 1000).toFixed(0)}K`);
    }
    if (grant.fiscal_year !== previous.fiscal_year) {
      changes.push(`FY${previous.fiscal_year} → FY${grant.fiscal_year}`);
    }

    if (changes.length === 0) {
      return null; // Hash changed but no meaningful field changes we track
    }

    return {
      source: SOURCES.NIH,
      type: DISCOVERY_TYPES.NIH_GRANT_UPDATE,
      title: `NIH Grant Updated: ${grant.project_title}`,
      summary: `${formatGrantSummary(grant)} | Changes: ${changes.join(', ')}`,
      url: `https://reporter.nih.gov/project-details/${grant.appl_id}`,
      relevance: relevanceGroup === 'A' ? 'medium' : 'low',
      metadata: {
        appl_id: grant.appl_id,
        project_num: grant.project_num,
        activity_code: grant.activity_code,
        agency: grant.agency,
        award_amount: grant.award_amount,
        previous_amount: previous.award_amount,
        fiscal_year: grant.fiscal_year,
        previous_fiscal_year: previous.fiscal_year,
        pi_names: grant.pi_names,
        organization: grant.organization_name,
        changes,
        relevance_group: relevanceGroup,
        change_type: 'updated',
      },
    };
  }

  /**
   * Merge newly fetched grants with previous store, preserving first_seen dates
   */
  mergeGrants(fetched, previous) {
    const merged = {};
    for (const [applId, grant] of Object.entries(fetched)) {
      merged[applId] = {
        ...grant,
        first_seen: previous[applId]?.first_seen || new Date().toISOString(),
        last_updated: new Date().toISOString(),
        hash: hashGrant(grant),
      };
    }
    return merged;
  }
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Normalize raw NIH RePORTER API result to flat grant object
 */
function normalizeGrant(raw) {
  const pis = (raw.principal_investigators || []).map(pi => ({
    name: [pi.first_name, pi.last_name].filter(Boolean).join(' '),
    profile_id: pi.profile_id,
  }));

  const org = raw.organization || {};
  const trials = (raw.clinical_trials || []).map(t => t.nct_id).filter(Boolean);

  return {
    appl_id: raw.appl_id,
    project_num: raw.project_num || null,
    project_title: raw.project_title || '',
    abstract_text: raw.abstract_text || '',
    award_amount: raw.award_amount || 0,
    fiscal_year: raw.fiscal_year || null,
    activity_code: raw.activity_code || null,
    agency: raw.agency_ic_admin?.abbreviation || raw.agency_ic_admin || null,
    pi_names: pis.map(p => p.name).join(', '),
    pi_details: pis,
    organization_name: org.org_name || null,
    organization_city: org.org_city || null,
    organization_state: org.org_state || null,
    project_start_date: raw.project_start_date || null,
    project_end_date: raw.project_end_date || null,
    award_notice_date: raw.award_notice_date || null,
    clinical_trial_ncts: trials,
  };
}

/**
 * Create a hash of grant fields used for change detection
 */
function hashGrant(grant) {
  const key = `${grant.appl_id}|${grant.award_amount}|${grant.fiscal_year}`;
  return createHash('md5').update(key).digest('hex');
}

/**
 * Format a one-line summary for a grant
 */
function formatGrantSummary(grant) {
  const parts = [];
  if (grant.activity_code) parts.push(grant.activity_code);
  if (grant.award_amount) parts.push(`$${(grant.award_amount / 1000).toFixed(0)}K`);
  if (grant.agency) parts.push(grant.agency);
  if (grant.organization_name) parts.push(grant.organization_name);
  if (grant.pi_names) parts.push(`PI: ${grant.pi_names}`);
  return parts.join(' | ');
}

// =============================================================================
// Grant store (JSON file)
// =============================================================================

/**
 * Load grant store from disk
 */
function loadGrantStore() {
  try {
    if (existsSync(GRANTS_STORE_PATH)) {
      const data = readFileSync(GRANTS_STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Corrupted file, start fresh
  }
  return { grants: {}, meta: {} };
}

/**
 * Save grant store to disk (atomic write)
 */
function saveGrantStore(store) {
  const dir = dirname(GRANTS_STORE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpPath = GRANTS_STORE_PATH + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(store, null, 2));

  // Atomic rename
  renameSync(tmpPath, GRANTS_STORE_PATH);
}

export default NIHReporterCrawler;
