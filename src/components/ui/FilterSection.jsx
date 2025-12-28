import { useState } from 'react';

// Collapsible filter section component
const FilterSection = ({ title, defaultOpen = false, activeCount = 0, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors -mx-2 px-2 rounded"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
          {activeCount > 0 && (
            <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
};

export default FilterSection;
