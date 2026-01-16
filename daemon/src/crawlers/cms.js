/**
 * CMS/Medicare Crawler
 * Monitors for Local Coverage Determination (LCD) updates and policy changes
 *
 * IMPLEMENTATION STATUS: STUB - Not yet implemented
 *
 * What this crawler should do when implemented:
 * ---------------------------------------------
 * 1. Monitor Local Coverage Determinations (LCDs) for molecular diagnostics:
 *    - Check MolDX LCDs across different MACs (Palmetto, Novitas, CGS, etc.)
 *    - Detect version updates, effective date changes
 *    - Track new LCDs for ctDNA/MRD tests
 *
 * 2. Monitor National Coverage Determinations (NCDs):
 *    - Check for NCDs affecting liquid biopsy tests
 *    - Track proposed decision memos
 *
 * 3. Key URLs to monitor:
 *    - LCD Index: https://www.cms.gov/medicare-coverage-database/indexes/lcd-alphabetical-index.aspx
 *    - NCD Index: https://www.cms.gov/medicare-coverage-database/indexes/ncd-alphabetical-index.aspx
 *    - MolDX: https://www.palmettogba.com/palmetto/MolDX.nsf
 *
 * 4. Technical approach:
 *    - Fetch LCD detail pages and parse for version/effective date
 *    - Store previous versions in queue metadata for comparison
 *    - Search CMS database for new coverage determinations matching keywords
 *    - Parse RSS/Atom feeds if available
 */

import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES } from '../config.js';

// LCD/NCD IDs to monitor for updates
const MONITORED_LCDS = [
  // MolDX LCDs by MAC
  { id: 'L38043', mac: 'Novitas', description: 'MolDX: Molecular Biomarkers for Cancer' },
  { id: 'L38337', mac: 'Palmetto', description: 'MolDX: Minimal Residual Disease Testing' },
  { id: 'L37171', mac: 'CGS', description: 'Molecular Pathology Procedures' },
  { id: 'L38335', mac: 'Palmetto', description: 'MolDX: ctDNA Testing' },
];

// Keywords to search in CMS updates
const SEARCH_KEYWORDS = [
  'ctDNA',
  'circulating tumor DNA',
  'minimal residual disease',
  'liquid biopsy',
  'molecular diagnostic',
  'Signatera',
  'Guardant',
  'Foundation Medicine',
  'colorectal cancer',
  'MolDX',
];

export class CMSCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.cms.name,
      source: SOURCES.CMS,
      description: config.crawlers.cms.description,
      rateLimit: config.crawlers.cms.rateLimit,
      enabled: config.crawlers.cms.enabled,
    });

    this.baseUrl = 'https://www.cms.gov/medicare-coverage-database';
  }

  /**
   * Main crawl implementation
   * STUB: Logs message and returns empty array
   *
   * When implemented, this should:
   * 1. Check each monitored LCD for version changes
   * 2. Search for new proposed decision memos
   * 3. Check for new LCDs matching our keywords
   * 4. Monitor MolDX announcements
   */
  async crawl() {
    this.log('info', 'CMS crawler not yet implemented');
    this.log('info', `Would check ${MONITORED_LCDS.length} LCDs and search ${SEARCH_KEYWORDS.length} keywords`);

    // STUB: Return empty discoveries
    // Implementation would:
    // 1. For each LCD in MONITORED_LCDS:
    //    - Fetch LCD detail page: ${this.baseUrl}/details/lcd-details/${lcd.id}
    //    - Parse HTML for version number, effective date, revision history
    //    - Compare with stored version (from previous crawl)
    //    - If changed, create coverage_change discovery
    //
    // 2. Search CMS database for new coverage determinations:
    //    - Search URL: ${this.baseUrl}/search?keyword=...
    //    - Filter for results from last 7-30 days
    //    - Create policy_update discoveries for new items
    //
    // 3. Check MolDX-specific sources:
    //    - Palmetto GBA MolDX portal
    //    - Noridian MolDX updates

    const discoveries = [];

    this.log('info', 'CMS crawl complete (stub mode)', {
      lcdsMonitored: MONITORED_LCDS.length,
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Determine discovery type based on content
   */
  determineDiscoveryType(item) {
    if (item.type === 'ncd' || item.type === 'lcd') {
      return DISCOVERY_TYPES.COVERAGE_CHANGE;
    }
    if (item.type === 'proposed') {
      return DISCOVERY_TYPES.POLICY_UPDATE;
    }
    return DISCOVERY_TYPES.POLICY_UPDATE;
  }

  /**
   * Create a discovery object from a CMS item
   */
  createDiscoveryFromCMSItem(item) {
    return {
      source: SOURCES.CMS,
      type: this.determineDiscoveryType(item),
      title: item.title,
      summary: item.summary || `${item.type.toUpperCase()} update: ${item.id}`,
      url: item.url,
      relevance: this.calculateRelevance(item),
      metadata: {
        lcdId: item.id,
        mac: item.mac,
        effectiveDate: item.effectiveDate,
        versionNumber: item.version,
        documentType: item.type,
      },
    };
  }

  /**
   * Calculate relevance based on content match
   */
  calculateRelevance(item) {
    const text = `${item.title} ${item.summary || ''}`.toLowerCase();

    // High relevance: directly mentions our key tests or MRD
    if (
      text.includes('signatera') ||
      text.includes('guardant') ||
      text.includes('minimal residual disease') ||
      text.includes('mrd')
    ) {
      return 'high';
    }

    // Medium relevance: mentions ctDNA or liquid biopsy
    if (text.includes('ctdna') || text.includes('liquid biopsy') || text.includes('circulating tumor')) {
      return 'medium';
    }

    return 'low';
  }
}

export default CMSCrawler;
