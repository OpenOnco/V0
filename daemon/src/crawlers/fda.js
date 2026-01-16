/**
 * FDA Crawler
 * Monitors for device clearances, drug approvals, and regulatory updates
 *
 * IMPLEMENTATION STATUS: STUB - Not yet implemented
 *
 * What this crawler should do when implemented:
 * ---------------------------------------------
 * 1. Check 510(k) Database for new device clearances:
 *    - Search for in-vitro diagnostic devices
 *    - Filter for liquid biopsy, molecular diagnostics, ctDNA
 *    - URL: https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm
 *    - openFDA API: https://api.fda.gov/device/510k.json
 *
 * 2. Check PMA (Premarket Approval) Database:
 *    - Higher-risk diagnostic devices require PMA
 *    - URL: https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMA/pma.cfm
 *    - openFDA API: https://api.fda.gov/device/pma.json
 *
 * 3. Monitor Breakthrough Device Designations:
 *    - Expedited pathway for innovative diagnostics
 *    - URL: https://www.fda.gov/medical-devices/how-study-and-market-your-device/breakthrough-devices-program
 *
 * 4. Check Drug Approvals with Companion Diagnostics:
 *    - New drug approvals that require/recommend specific tests
 *    - openFDA API: https://api.fda.gov/drug/drugsfda.json
 *
 * 5. Monitor FDA Guidance Documents:
 *    - New guidance affecting liquid biopsy regulation
 *    - URL: https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/guidance-documents-medical-devices-and-radiation-emitting-products
 */

import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES } from '../config.js';

// Test/device manufacturers to monitor
const MONITORED_MANUFACTURERS = [
  'Natera',
  'Guardant Health',
  'Foundation Medicine',
  'Tempus',
  'Caris Life Sciences',
  'Exact Sciences',
  'GRAIL',
  'Freenome',
  'Adaptive Biotechnologies',
  'Personalis',
];

// Product codes relevant to liquid biopsy/molecular diagnostics
const RELEVANT_PRODUCT_CODES = [
  'MYZ', // Nucleic acid amplification test
  'PHI', // Genetic test for disease
  'PIE', // Tumor markers
  'PSZ', // Next generation sequencing
  'QJY', // Companion diagnostic
];

// Keywords for searching
const SEARCH_KEYWORDS = [
  'liquid biopsy',
  'circulating tumor DNA',
  'ctDNA',
  'minimal residual disease',
  'molecular residual disease',
  'next generation sequencing',
  'companion diagnostic',
  'pan-tumor',
];

export class FDACrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.fda.name,
      source: SOURCES.FDA,
      description: config.crawlers.fda.description,
      rateLimit: config.crawlers.fda.rateLimit,
      enabled: config.crawlers.fda.enabled,
    });

    this.openFdaUrl = 'https://api.fda.gov';
  }

  /**
   * Main crawl implementation
   * STUB: Logs message and returns empty array
   *
   * When implemented, this should:
   * 1. Query 510(k) database for recent clearances
   * 2. Query PMA database for recent approvals
   * 3. Check breakthrough device announcements
   * 4. Search for relevant companion diagnostics
   */
  async crawl() {
    this.log('info', 'FDA crawler not yet implemented');
    this.log('info', `Would check 510(k), PMA, and breakthrough devices for ${MONITORED_MANUFACTURERS.length} manufacturers`);

    // STUB: Return empty discoveries
    // Implementation would:
    //
    // 1. Query 510(k) clearances from last 30 days:
    //    const url = `${this.openFdaUrl}/device/510k.json?search=decision_date:[${dateFrom}+TO+${dateTo}]&limit=100`;
    //    - Filter by product_code in RELEVANT_PRODUCT_CODES
    //    - Filter by applicant in MONITORED_MANUFACTURERS
    //    - Create fda_approval discoveries for matches
    //
    // 2. Query PMA approvals:
    //    const url = `${this.openFdaUrl}/device/pma.json?search=decision_date:[${dateFrom}+TO+${dateTo}]&limit=100`;
    //    - Filter for relevant advisory committees (clinical chemistry, radiology, pathology)
    //    - Create fda_approval discoveries for oncology-related devices
    //
    // 3. Check breakthrough device designations:
    //    - Scrape FDA breakthrough devices page
    //    - Look for new designations in oncology/diagnostics
    //    - Create fda_approval discoveries with "breakthrough" metadata
    //
    // 4. Check companion diagnostic approvals:
    //    - Query drug approvals with companion diagnostic requirements
    //    - Cross-reference with our monitored tests
    //    - Create fda_approval discoveries

    const discoveries = [];

    this.log('info', 'FDA crawl complete (stub mode)', {
      manufacturers: MONITORED_MANUFACTURERS.length,
      productCodes: RELEVANT_PRODUCT_CODES.length,
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Check if an FDA item is relevant to OpenOnco
   */
  isRelevant(item) {
    const text = JSON.stringify(item).toLowerCase();

    // Check manufacturers
    for (const manufacturer of MONITORED_MANUFACTURERS) {
      if (text.includes(manufacturer.toLowerCase())) {
        return true;
      }
    }

    // Check keywords
    for (const keyword of SEARCH_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create discovery from 510(k) clearance
   */
  create510kDiscovery(device) {
    return {
      source: SOURCES.FDA,
      type: DISCOVERY_TYPES.FDA_APPROVAL,
      title: `FDA 510(k) Cleared: ${device.device_name || device.openfda?.device_name}`,
      summary: `${device.applicant} - ${device.statement_or_summary || '510(k) clearance'}`,
      url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${device.k_number}`,
      relevance: this.calculateRelevance(device),
      metadata: {
        kNumber: device.k_number,
        deviceName: device.device_name,
        applicant: device.applicant,
        decisionDate: device.decision_date,
        productCode: device.product_code,
        clearanceType: '510k',
      },
    };
  }

  /**
   * Create discovery from PMA approval
   */
  createPMADiscovery(device) {
    return {
      source: SOURCES.FDA,
      type: DISCOVERY_TYPES.FDA_APPROVAL,
      title: `FDA PMA Approved: ${device.trade_name || device.generic_name}`,
      summary: `${device.applicant} - ${device.ao_statement || 'PMA approval'}`,
      url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=${device.pma_number}`,
      relevance: this.calculateRelevance(device),
      metadata: {
        pmaNumber: device.pma_number,
        tradeName: device.trade_name,
        genericName: device.generic_name,
        applicant: device.applicant,
        decisionDate: device.decision_date,
        advisoryCommittee: device.advisory_committee,
        clearanceType: 'pma',
      },
    };
  }

  /**
   * Create discovery from breakthrough device designation
   */
  createBreakthroughDiscovery(device) {
    return {
      source: SOURCES.FDA,
      type: DISCOVERY_TYPES.FDA_APPROVAL,
      title: `FDA Breakthrough Device: ${device.name}`,
      summary: `${device.sponsor} - Breakthrough device designation granted`,
      url: device.url || 'https://www.fda.gov/medical-devices/how-study-and-market-your-device/breakthrough-devices-program',
      relevance: 'high',
      metadata: {
        deviceName: device.name,
        sponsor: device.sponsor,
        designationDate: device.date,
        indication: device.indication,
        clearanceType: 'breakthrough',
      },
    };
  }

  /**
   * Calculate relevance based on device/drug details
   */
  calculateRelevance(item) {
    const text = JSON.stringify(item).toLowerCase();

    // High relevance for specific manufacturers or test types
    const highRelevanceTerms = [
      'natera',
      'guardant',
      'foundation medicine',
      'signatera',
      'guardant360',
      'ctdna',
      'liquid biopsy',
      'mrd',
      'minimal residual',
      'companion diagnostic',
    ];

    if (highRelevanceTerms.some((term) => text.includes(term))) {
      return 'high';
    }

    // Medium relevance for oncology/cancer
    if (text.includes('oncology') || text.includes('cancer') || text.includes('tumor') || text.includes('neoplasm')) {
      return 'medium';
    }

    return 'low';
  }
}

export default FDACrawler;
