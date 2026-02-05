/**
 * Shared RSS Parsing Utilities
 *
 * Generic RSS/Atom feed parsing functions extracted for reuse across
 * FDA, journal, and other RSS-based crawlers.
 */

/**
 * Parse RSS XML into structured items
 * @param {string} xml - RSS XML content
 * @returns {Object[]} Parsed items with title, link, description, pubDate, guid, category
 */
export function parseRSSItems(xml) {
  const items = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const itemXml = match[1];

    const title = extractRSSTag(itemXml, 'title');
    const link = extractRSSTag(itemXml, 'link');
    const description = extractRSSTag(itemXml, 'description');
    const pubDate = extractRSSTag(itemXml, 'pubDate');
    const category = extractRSSTag(itemXml, 'category');
    const guid = extractRSSTag(itemXml, 'guid');

    if (title) {
      items.push({
        title: cleanHtml(title),
        link,
        description: cleanHtml(description),
        pubDate: pubDate ? new Date(pubDate) : null,
        category: cleanHtml(category),
        guid: guid || link,
      });
    }
  }

  return items;
}

/**
 * Extract a single tag's content from XML
 * Handles CDATA sections and optional attributes
 * @param {string} xml - XML fragment
 * @param {string} tagName - Tag name to extract
 * @returns {string|null} Tag content or null
 */
export function extractRSSTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tagName}>`, 'i'));
  return match ? match[1].trim() : null;
}

/**
 * Strip HTML tags and decode common entities
 * @param {string} text - Text that may contain HTML
 * @returns {string|null} Cleaned text or null
 */
export function cleanHtml(text) {
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract DOI from an RSS item
 * Checks link, guid, dc:identifier, and description text
 * @param {Object} item - Parsed RSS item
 * @returns {string|null} DOI string (e.g., "10.1200/JCO.2024.1234") or null
 */
export function extractDOI(item) {
  const doiRegex = /\b(10\.\d{4,}\/[^\s"'<>]+)/i;

  // Check link first (many journal RSS feeds use DOI as link)
  if (item.link) {
    const linkMatch = item.link.match(doiRegex);
    if (linkMatch) return linkMatch[1];

    // Also check doi.org redirect URLs
    const doiOrgMatch = item.link.match(/doi\.org\/(10\.\d{4,}\/[^\s"'<>]+)/i);
    if (doiOrgMatch) return doiOrgMatch[1];
  }

  // Check guid
  if (item.guid) {
    const guidMatch = item.guid.match(doiRegex);
    if (guidMatch) return guidMatch[1];
  }

  // Check dc:identifier if present in raw XML
  if (item._rawXml) {
    const dcId = extractRSSTag(item._rawXml, 'dc:identifier');
    if (dcId) {
      const dcMatch = dcId.match(doiRegex);
      if (dcMatch) return dcMatch[1];
    }
  }

  // Check description text as last resort
  if (item.description) {
    const descMatch = item.description.match(doiRegex);
    if (descMatch) return descMatch[1];
  }

  return null;
}

export default {
  parseRSSItems,
  extractRSSTag,
  cleanHtml,
  extractDOI,
};
