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
   * Queries openFDA API for 510(k) clearances and PMA approvals
   */
  async crawl() {
    this.log('info', `Starting FDA crawl for ${MONITORED_MANUFACTURERS.length} manufacturers`);

    const discoveries = [];
    const seenIds = new Set();

    // Calculate date range (last 90 days)
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);
    const dateFromStr = dateFrom.toISOString().split('T')[0].replace(/-/g, '');
    const dateToStr = dateTo.toISOString().split('T')[0].replace(/-/g, '');

    // Query 510(k) clearances for each manufacturer
    for (const manufacturer of MONITORED_MANUFACTURERS) {
      try {
        const searchQuery = `applicant:"${manufacturer}"+AND+decision_date:[${dateFromStr}+TO+${dateToStr}]`;
        const url = `${this.openFdaUrl}/device/510k.json?search=${encodeURIComponent(searchQuery)}&limit=100`;

        this.log('debug', `Querying 510(k) for ${manufacturer}`);
        const response = await this.http.getJson(url);

        if (response?.results) {
          for (const device of response.results) {
            // Deduplicate by k_number
            if (device.k_number && seenIds.has(device.k_number)) {
              continue;
            }
            if (device.k_number) {
              seenIds.add(device.k_number);
            }

            // Check relevance
            if (this.isRelevant(device)) {
              const discovery = this.create510kDiscovery(device);
              discoveries.push(discovery);
            }
          }
        }
      } catch (error) {
        this.log('warn', `Failed to fetch 510(k) for ${manufacturer}`, {
          error: error.message,
        });
        // Continue with next manufacturer
      }
    }

    // Query PMA approvals for each manufacturer
    for (const manufacturer of MONITORED_MANUFACTURERS) {
      try {
        const searchQuery = `applicant:"${manufacturer}"+AND+decision_date:[${dateFromStr}+TO+${dateToStr}]`;
        const url = `${this.openFdaUrl}/device/pma.json?search=${encodeURIComponent(searchQuery)}&limit=100`;

        this.log('debug', `Querying PMA for ${manufacturer}`);
        const response = await this.http.getJson(url);

        if (response?.results) {
          for (const device of response.results) {
            // Deduplicate by pma_number
            if (device.pma_number && seenIds.has(device.pma_number)) {
              continue;
            }
            if (device.pma_number) {
              seenIds.add(device.pma_number);
            }

            // Check relevance
            if (this.isRelevant(device)) {
              const discovery = this.createPMADiscovery(device);
              discoveries.push(discovery);
            }
          }
        }
      } catch (error) {
        this.log('warn', `Failed to fetch PMA for ${manufacturer}`, {
          error: error.message,
        });
        // Continue with next manufacturer
      }
    }

    this.log('info', 'FDA crawl complete', {
      manufacturers: MONITORED_MANUFACTURERS.length,
      discoveries: discoveries.length,
      uniqueIds: seenIds.size,
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
