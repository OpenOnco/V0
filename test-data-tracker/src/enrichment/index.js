/**
 * Publication Enrichment Module
 *
 * Fetches full text from open access sources (PMC, Unpaywall, Europe PMC)
 * and extracts structured clinical content for better semantic search.
 */

export { enrichPublications, getEnrichmentStatus } from './enrich-publications.js';
export { fetchFullText, fetchPubMedAbstract, fetchPubMedMetadata } from './fulltext-fetcher.js';
export { extractStructuredContent, extractFromAbstract, buildEnrichedContent } from './content-extractor.js';
export { extractCancerTypes, normalizeCancerType, extractClinicalSettings } from './cancer-type-extractor.js';

export default {
  enrichPublications,
  getEnrichmentStatus,
  fetchFullText,
  fetchPubMedAbstract,
  fetchPubMedMetadata,
  extractStructuredContent,
  extractFromAbstract,
  buildEnrichedContent,
  extractCancerTypes,
  normalizeCancerType,
  extractClinicalSettings,
};
