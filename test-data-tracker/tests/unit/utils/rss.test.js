/**
 * Tests for shared RSS parsing utilities
 */
import { describe, it, expect } from 'vitest';
import { parseRSSItems, extractRSSTag, cleanHtml, extractDOI } from '../../../src/utils/rss.js';

describe('parseRSSItems', () => {
  it('parses basic RSS items', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>ctDNA-guided therapy in colorectal cancer</title>
          <link>https://example.com/article/1</link>
          <description>A study of ctDNA in CRC patients.</description>
          <pubDate>Mon, 15 Jan 2026 00:00:00 GMT</pubDate>
          <guid>article-1</guid>
        </item>
        <item>
          <title>Second article</title>
          <link>https://example.com/article/2</link>
          <description>Another study.</description>
          <pubDate>Tue, 16 Jan 2026 00:00:00 GMT</pubDate>
          <guid>article-2</guid>
        </item>
      </channel></rss>
    `;

    const items = parseRSSItems(xml);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('ctDNA-guided therapy in colorectal cancer');
    expect(items[0].link).toBe('https://example.com/article/1');
    expect(items[0].description).toBe('A study of ctDNA in CRC patients.');
    expect(items[0].pubDate).toBeInstanceOf(Date);
    expect(items[0].guid).toBe('article-1');
    expect(items[1].title).toBe('Second article');
  });

  it('handles CDATA sections in titles and descriptions', () => {
    const xml = `
      <rss><channel>
        <item>
          <title><![CDATA[MRD detection with <i>Signatera</i> assay]]></title>
          <link>https://example.com/1</link>
          <description><![CDATA[Study of &amp; liquid biopsy]]></description>
          <guid>cdata-item</guid>
        </item>
      </channel></rss>
    `;

    const items = parseRSSItems(xml);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('MRD detection with Signatera assay');
  });

  it('returns empty array for invalid XML', () => {
    const items = parseRSSItems('not xml at all');
    expect(items).toHaveLength(0);
  });

  it('returns empty array for XML with no items', () => {
    const xml = '<rss><channel><title>Empty Feed</title></channel></rss>';
    const items = parseRSSItems(xml);
    expect(items).toHaveLength(0);
  });

  it('skips items without titles', () => {
    const xml = `
      <rss><channel>
        <item>
          <link>https://example.com/no-title</link>
          <description>No title here</description>
        </item>
        <item>
          <title>Has a title</title>
          <link>https://example.com/has-title</link>
        </item>
      </channel></rss>
    `;

    const items = parseRSSItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Has a title');
  });

  it('uses link as guid fallback when guid is missing', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>No GUID article</title>
          <link>https://example.com/article/999</link>
        </item>
      </channel></rss>
    `;

    const items = parseRSSItems(xml);
    expect(items[0].guid).toBe('https://example.com/article/999');
  });

  it('handles items with missing optional fields', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Minimal item</title>
        </item>
      </channel></rss>
    `;

    const items = parseRSSItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Minimal item');
    expect(items[0].link).toBeNull();
    expect(items[0].description).toBeNull();
    expect(items[0].pubDate).toBeNull();
  });
});

describe('extractRSSTag', () => {
  it('extracts simple tag content', () => {
    expect(extractRSSTag('<title>Hello</title>', 'title')).toBe('Hello');
  });

  it('extracts CDATA content', () => {
    expect(extractRSSTag('<title><![CDATA[Hello World]]></title>', 'title')).toBe('Hello World');
  });

  it('handles tag with attributes', () => {
    expect(extractRSSTag('<link rel="alternate">https://example.com</link>', 'link')).toBe('https://example.com');
  });

  it('returns null for missing tags', () => {
    expect(extractRSSTag('<title>Hello</title>', 'description')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(extractRSSTag('<Title>Hello</Title>', 'title')).toBe('Hello');
  });

  it('trims whitespace', () => {
    expect(extractRSSTag('<title>  spaced  </title>', 'title')).toBe('spaced');
  });
});

describe('cleanHtml', () => {
  it('strips HTML tags', () => {
    expect(cleanHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('decodes HTML entities', () => {
    expect(cleanHtml('AT&amp;T &lt;test&gt;')).toBe('AT&T <test>');
    expect(cleanHtml('He said &quot;hello&quot;')).toBe('He said "hello"');
    expect(cleanHtml("It&#39;s fine")).toBe("It's fine");
  });

  it('collapses whitespace', () => {
    expect(cleanHtml('too   much   space')).toBe('too much space');
    expect(cleanHtml('line\n\nbreaks')).toBe('line breaks');
  });

  it('returns null for null/undefined input', () => {
    expect(cleanHtml(null)).toBeNull();
    expect(cleanHtml(undefined)).toBeNull();
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanHtml('  hello  ')).toBe('hello');
  });
});

describe('extractDOI', () => {
  it('extracts DOI from link field', () => {
    const item = { link: 'https://doi.org/10.1200/JCO.2024.12345' };
    expect(extractDOI(item)).toBe('10.1200/JCO.2024.12345');
  });

  it('extracts DOI from doi.org URL in link', () => {
    const item = { link: 'https://doi.org/10.1016/j.annonc.2024.01.002' };
    expect(extractDOI(item)).toBe('10.1016/j.annonc.2024.01.002');
  });

  it('extracts DOI from guid field', () => {
    const item = { link: 'https://example.com', guid: '10.1056/NEJMoa2312345' };
    expect(extractDOI(item)).toBe('10.1056/NEJMoa2312345');
  });

  it('extracts DOI from description text', () => {
    const item = {
      link: 'https://example.com',
      description: 'Published article DOI: 10.1001/jamaoncol.2024.5678 available online.',
    };
    expect(extractDOI(item)).toBe('10.1001/jamaoncol.2024.5678');
  });

  it('returns null when no DOI is present', () => {
    const item = {
      link: 'https://example.com/article/123',
      guid: 'article-123',
      description: 'An article without a DOI.',
    };
    expect(extractDOI(item)).toBeNull();
  });

  it('handles empty item', () => {
    expect(extractDOI({})).toBeNull();
  });

  it('prefers link DOI over guid DOI', () => {
    const item = {
      link: 'https://doi.org/10.1200/JCO.link',
      guid: '10.1200/JCO.guid',
    };
    expect(extractDOI(item)).toBe('10.1200/JCO.link');
  });

  it('handles DOIs with complex suffixes', () => {
    const item = { link: 'https://doi.org/10.1158/1078-0432.CCR-24-1234' };
    expect(extractDOI(item)).toBe('10.1158/1078-0432.CCR-24-1234');
  });
});
