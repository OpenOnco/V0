import React, { useMemo, useState, useCallback } from 'react';

/**
 * Renders text with clickable test names and vendor names.
 * - Test names open the test detail popup
 * - Vendor names open a vendor summary popup
 *
 * Props:
 *   text: string to scan for matches
 *   tests: array of test objects (from DAL) with {id, name, vendor, ...}
 *   onTestClick: (test) => void — called when a test name is clicked
 *   onVendorClick: (vendorName) => void — called when a vendor name is clicked
 *   className: optional wrapper class
 */
export default function LinkedArticleText({ text, tests, onTestClick, onVendorClick, className }) {
  if (!text || !tests || tests.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const { segments } = useMemo(() => {
    // Build lookup: name → {type, data}
    const entries = [];
    const seen = new Set();

    // Add test names (longer first to avoid partial matches)
    for (const test of tests) {
      const name = test.name;
      if (name && name.length >= 3 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        entries.push({ pattern: name, type: 'test', data: test });
      }
    }

    // Add vendor names
    const vendors = [...new Set(tests.map(t => t.vendor).filter(Boolean))];
    for (const vendor of vendors) {
      if (vendor.length >= 3 && !seen.has(vendor.toLowerCase())) {
        seen.add(vendor.toLowerCase());
        entries.push({ pattern: vendor, type: 'vendor', data: vendor });
      }
    }

    // Sort by pattern length desc (match longer names first)
    entries.sort((a, b) => b.pattern.length - a.pattern.length);

    if (entries.length === 0) {
      return { segments: [{ text, type: 'plain' }] };
    }

    // Build regex from all patterns (word-boundary aware)
    const escaped = entries.map(e => e.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

    // Split text into segments
    const parts = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    regex.lastIndex = 0;
    const str = text;

    // Use matchAll for cleaner iteration
    for (const m of str.matchAll(new RegExp(regex.source, 'gi'))) {
      if (m.index > lastIndex) {
        parts.push({ text: str.slice(lastIndex, m.index), type: 'plain' });
      }
      const matched = m[0];
      const entry = entries.find(e => e.pattern.toLowerCase() === matched.toLowerCase());
      parts.push({
        text: matched,
        type: entry?.type || 'plain',
        data: entry?.data,
      });
      lastIndex = m.index + matched.length;
    }
    if (lastIndex < str.length) {
      parts.push({ text: str.slice(lastIndex), type: 'plain' });
    }

    return { segments: parts };
  }, [text, tests]);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'test') {
          return (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTestClick?.(seg.data); }}
              className="text-brand-600 hover:text-brand-800 underline decoration-dotted underline-offset-2 cursor-pointer bg-transparent border-none p-0 font-inherit text-inherit"
              title={`View test: ${seg.data.name}`}
            >
              {seg.text}
            </button>
          );
        }
        if (seg.type === 'vendor') {
          return (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onVendorClick?.(seg.data); }}
              className="text-slate-700 hover:text-slate-900 underline decoration-dotted underline-offset-2 cursor-pointer bg-transparent border-none p-0 font-inherit text-inherit"
              title={`View vendor: ${seg.data}`}
            >
              {seg.text}
            </button>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </span>
  );
}
