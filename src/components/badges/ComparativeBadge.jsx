import React from 'react';

/**
 * Badge showing where a test excels compared to others in the result set
 * Styled with amber/gold theme to stand out from other badges
 */
export default function ComparativeBadge({ label }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
      <span className="text-amber-500">&#9733;</span>
      {label}
    </span>
  );
}

/**
 * Row of comparative badges for a test card
 */
export function ComparativeBadgeRow({ badges }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {badges.map((badge, i) => (
        <ComparativeBadge key={i} label={badge} />
      ))}
    </div>
  );
}
