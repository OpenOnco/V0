import React from 'react';

/**
 * Lightweight vendor summary popup.
 * Shows vendor name, their tests in our database, and key stats.
 */
export default function VendorPopup({ vendorName, tests, onClose }) {
  if (!vendorName) return null;

  const vendorTests = (tests || []).filter(
    t => t.vendor && t.vendor.toLowerCase().includes(vendorName.toLowerCase())
  );

  const categories = [...new Set(vendorTests.map(t => t.category).filter(Boolean))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl leading-none"
        >
          &times;
        </button>

        <h2 className="text-xl font-semibold text-slate-900 mb-1">{vendorName}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {vendorTests.length} test{vendorTests.length !== 1 ? 's' : ''} in openonco database
          {categories.length > 0 && ` · ${categories.join(', ')}`}
        </p>

        {vendorTests.length > 0 ? (
          <ul className="space-y-3">
            {vendorTests.map(test => (
              <li key={test.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900 text-sm">{test.name}</span>
                  {test.category && (
                    <span className="text-[10px] uppercase tracking-wide font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                      {test.category}
                    </span>
                  )}
                </div>
                {test.approach && (
                  <p className="text-xs text-slate-500 mt-1">Approach: {test.approach}</p>
                )}
                {test.method && (
                  <p className="text-xs text-slate-500">Method: {test.method}</p>
                )}
                {test.cancerTypes && test.cancerTypes.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {Array.isArray(test.cancerTypes) ? test.cancerTypes.join(', ') : test.cancerTypes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No tests found in the database for this vendor.</p>
        )}
      </div>
    </div>
  );
}
