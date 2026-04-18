import React, { useState } from 'react';

// Homepage gadget: small search + category chiclets for the test database.
// Full test experience lives at /testdata — this is just a quick-jump.
const CATEGORIES = [
  { slug: 'MRD', label: 'MRD', path: '/mrd' },
  { slug: 'ECD', label: 'Early detection', path: '/ecd' },
  { slug: 'CGP', label: 'Treatment selection', path: '/cgp' },
  { slug: 'HCT', label: 'Hereditary', path: '/hct' },
];

export default function CompactTestSearch({ onNavigate }) {
  const [query, setQuery] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      onNavigate?.('home');  // the test-directory homepage
      return;
    }
    // Route to /testdata with ?q=... — the existing homepage reads this.
    if (typeof window !== 'undefined') {
      window.location.href = `/testdata?q=${encodeURIComponent(q)}`;
    }
  };

  return (
    <aside className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide font-medium text-slate-500 mb-2">
        Browse the test database
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tests, vendors..."
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          Go
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <a
            key={cat.slug}
            href={cat.path}
            className="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-brand-100 hover:text-brand-700 transition"
          >
            {cat.label}
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        <a href="/testdata" className="text-brand-600 hover:underline">Full directory &rarr;</a>
      </p>
    </aside>
  );
}
