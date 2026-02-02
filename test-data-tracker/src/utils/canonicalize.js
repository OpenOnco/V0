/**
 * Content canonicalization utilities
 * Used to normalize page content before hashing to reduce false positives
 */

/**
 * Canonicalize content before hashing to reduce false positives
 * Removes dynamic content that changes without policy changes
 * @param {string} text - Raw page content
 * @returns {string} Canonicalized content for hashing
 */
export function canonicalizeContent(text) {
  if (!text) return '';
  
  let canonical = text;
  
  // 1. Remove common date patterns that aren't policy-relevant
  // "Last updated: Jan 28, 2026" or "Last reviewed: 01/28/2026"
  canonical = canonical.replace(/last (updated|reviewed|modified|revised)[\s:]+[\w\s,/\-]+\d{4}/gi, '');
  
  // "Page generated at..." or "Retrieved on..."
  canonical = canonical.replace(/(page generated|retrieved|accessed|printed)[\s:]+[\w\s,]+\d{4}/gi, '');
  
  // Copyright years: "© 2026" or "Copyright 2024-2026"
  canonical = canonical.replace(/©?\s*(copyright\s*)?\d{4}(-\d{4})?/gi, '');
  
  // 2. Remove common boilerplate
  const boilerplate = [
    /skip to (main )?content/gi,
    /print this page/gi,
    /cookie (policy|consent|preferences)/gi,
    /accept all cookies/gi,
    /we use cookies/gi,
    /privacy policy/gi,
    /terms (of use|and conditions)/gi,
    /all rights reserved/gi,
    /breadcrumb/gi,
    /back to top/gi,
  ];
  for (const pattern of boilerplate) {
    canonical = canonical.replace(pattern, '');
  }
  
  // 3. Normalize whitespace
  canonical = canonical.replace(/\s+/g, ' ').trim();
  
  // 4. Lowercase for consistent comparison
  canonical = canonical.toLowerCase();
  
  return canonical;
}

export default { canonicalizeContent };
