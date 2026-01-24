import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useGlossaryTerm } from '../dal';

const GlossaryTooltip = ({ termKey, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const { term } = useGlossaryTerm(termKey);

  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 288; // w-72 = 18rem = 288px
      const popupHeight = 120; // approximate height

      // Horizontal positioning - prefer centered, but constrain to viewport
      let left = rect.left + (rect.width / 2) - (popupWidth / 2);
      if (left + popupWidth > window.innerWidth - 16) {
        left = window.innerWidth - popupWidth - 16;
      }
      if (left < 16) left = 16;

      // Vertical positioning - prefer above, fall back to below
      let top;
      const spaceAbove = rect.top - 16;
      if (spaceAbove >= popupHeight) {
        top = rect.top - popupHeight - 8;
      } else {
        top = rect.bottom + 8;
      }

      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);

  if (!term) return children || null;

  return (
    <span className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center gap-1 text-inherit border-b border-dotted border-current cursor-help hover:text-emerald-600 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children || term.term}
      </button>
      {isOpen && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] w-72 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl"
          style={popupStyle}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="font-semibold mb-1">{term.term}</div>
          <div className="text-gray-300 text-xs mb-2">{term.definition}</div>
          <a
            href={term.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            onClick={(e) => e.stopPropagation()}
          >
            Source: {term.source}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>,
        document.body
      )}
    </span>
  );
};

export default GlossaryTooltip;
