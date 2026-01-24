import React, { useState, useEffect, useRef, useContext, useMemo, createContext } from 'react';
import ReactDOM from 'react-dom';
import { useTestContribution } from '../../dal';
import { PARAMETER_DEFINITIONS, PARAMETER_CHANGELOG } from '../../config/testFields';
import { EXPERT_INSIGHTS } from '../../config/expertInsights';

// Context for passing test data to tooltip components
export const TestContext = createContext(null);

// ============================================
// Parameter Label Component
// Shows: Definition + Changelog only
// Notes and citations now shown via separate inline tooltips
// ============================================
export const ParameterLabel = ({ label, expertTopic, useGroupHover = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  // Get test info from context (if available)
  const test = useContext(TestContext);
  const { contribution } = useTestContribution(test?.id);

  const definition = PARAMETER_DEFINITIONS[label];
  const paramChangelog = PARAMETER_CHANGELOG[label] || [];

  // Build combined changelog: vendor contribution + parameter-specific changes
  const changelog = useMemo(() => {
    const entries = [...paramChangelog];
    // Add baseline entry from vendor contribution
    if (contribution) {
      entries.push({
        date: contribution.date,
        change: `Data contributed by ${contribution.name} (${contribution.company})`
      });
    }
    // Sort by date descending (most recent first)
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [paramChangelog, contribution]);

  const expertInsight = expertTopic ? EXPERT_INSIGHTS[expertTopic] : null;

  // Only show as clickable if there's definition, changelog, or expert insight
  const hasContent = definition || changelog.length > 0 || expertInsight;

  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 380;
      const popupHeight = 300; // Reduced for better fit

      // Horizontal positioning
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 20) {
        left = Math.max(20, window.innerWidth - popupWidth - 20);
      }
      if (left < 20) left = 20;

      // Vertical positioning - prefer below, fall back to above, then constrain
      let top;
      const spaceBelow = window.innerHeight - rect.bottom - 20;
      const spaceAbove = rect.top - 20;

      if (spaceBelow >= popupHeight) {
        // Enough space below
        top = rect.bottom + 8;
      } else if (spaceAbove >= popupHeight) {
        // Enough space above
        top = rect.top - popupHeight - 8;
      } else {
        // Not enough space either way - position below and constrain height via CSS
        top = Math.min(rect.bottom + 8, window.innerHeight - popupHeight - 20);
        top = Math.max(20, top);
      }

      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on scroll outside popup
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  if (!hasContent) {
    return <span className="text-sm text-gray-600">{label}</span>;
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`text-sm text-gray-600 underline-offset-2 cursor-pointer text-left leading-normal decoration-dotted ${
          useGroupHover
            ? 'group-hover:text-[#2A63A4] group-hover:underline'
            : 'hover:text-[#2A63A4] hover:underline'
        }`}
      >
        {label}
      </button>
      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] w-96 max-h-[80vh] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h4 className="font-semibold text-white text-sm">{label}</h4>
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1">
            {/* Definition */}
            {definition && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Definition</p>
                <p className="text-sm text-slate-700">{definition}</p>
              </div>
            )}

            {/* Expert Insight */}
            {expertInsight && (
              <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center">E</div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Expert Insight</p>
                </div>
                <p className="text-xs text-slate-600 whitespace-pre-line">{expertInsight.content}</p>
                <p className="text-[10px] text-slate-400 mt-2">Expert{expertInsight.experts?.includes(',') ? 's' : ''}: {expertInsight.experts || 'Advisory Panel'}</p>
              </div>
            )}

            {/* Changelog */}
            {changelog.length > 0 ? (
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Change Log</p>
                <div className="space-y-2">
                  {changelog.map((entry, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-slate-400 font-mono">{entry.date}</span>
                      <p className="text-slate-600">{entry.change}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Change Log</p>
                <p className="text-xs text-slate-400 italic">No changes recorded for this parameter.</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// Legacy InfoIcon - kept for backward compatibility but no longer used in DataRow
export const InfoIcon = ({ citations, notes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 288; // w-72 = 18rem = 288px
      const popupHeight = 200; // approximate

      // Calculate left position
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 20) {
        left = rect.right - popupWidth;
      }
      if (left < 20) left = 20;

      // Calculate top position
      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = rect.top - popupHeight - 8;
      }

      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on scroll outside popup
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      // Don't close if scrolling inside the popup
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  if (!citations && !notes) return null;

  return (
    <span className="inline-block ml-1">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 hover:text-gray-700 text-xs font-medium inline-flex items-center justify-center transition-colors cursor-pointer"
      >
        i
      </button>
      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {notes && (
            <div className={citations ? "mb-2" : ""}>
              <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
              <p className="text-xs text-gray-600">{notes}</p>
            </div>
          )}
          {citations && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Sources:</p>
              <p className="text-xs text-[#2A63A4] break-all">{citations.split('|').map((c, i) => (
                <a key={i} href={c.trim().startsWith('http') ? c.trim() : '#'} target="_blank" rel="noopener noreferrer" className="block hover:underline mb-1">
                  {c.trim().length > 60 ? c.trim().slice(0, 60) + '...' : c.trim()}
                </a>
              ))}</p>
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// Citation Tooltip - Shows source icon after parameter values
// ============================================
export const CitationTooltip = ({ citations }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 320;
      const popupHeight = 150;

      let left = rect.left - popupWidth / 2 + rect.width / 2;
      if (left + popupWidth > window.innerWidth - 20) {
        left = window.innerWidth - popupWidth - 20;
      }
      if (left < 20) left = 20;

      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = rect.top - popupHeight - 8;
      }

      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  if (!citations) return null;

  return (
    <span className="inline-flex items-center ml-1.5">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 text-[10px] font-medium inline-flex items-center justify-center transition-colors cursor-pointer"
        title="View source"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>
      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] w-80 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-100 px-3 py-2 flex items-center justify-between border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Source</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-3 max-h-40 overflow-y-auto">
            <div className="space-y-1.5">
              {citations.split('|').map((c, i) => {
                const url = c.trim();
                const isUrl = url.startsWith('http');
                return (
                  <a
                    key={i}
                    href={isUrl ? url : '#'}
                    target={isUrl ? "_blank" : undefined}
                    rel={isUrl ? "noopener noreferrer" : undefined}
                    className={`block text-xs ${isUrl ? 'text-[#2A63A4] hover:underline' : 'text-slate-600'} break-words`}
                  >
                    {isUrl ? (
                      <span className="flex items-start gap-1">
                        <svg className="w-3 h-3 flex-shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>{url.length > 60 ? url.slice(0, 60) + '...' : url}</span>
                      </span>
                    ) : (
                      <span className="flex items-start gap-1">
                        <svg className="w-3 h-3 flex-shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{url}</span>
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// Note Tooltip - Shows test-specific notes (amber icon)
// Appears after citation link when notes exist
// ============================================
export const NoteTooltip = ({ notes, value }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Check if note is redundant (just restates the value without adding info)
  const isRedundantNote = (note, val) => {
    if (!note || !val) return false;
    const noteStr = String(note).toLowerCase().trim();
    const valStr = String(val);
    // Short notes that just restate value + "per vendor" or similar are redundant
    // e.g., "12.3% PPV per vendor." or "99.9% NPV per vendor."
    if (noteStr.length < 50 &&
        noteStr.includes(valStr) &&
        /per vendor|as reported|as stated|vendor data/i.test(noteStr)) {
      return true;
    }
    return false;
  };

  // Don't show tooltip if notes are empty or redundant
  if (!notes || isRedundantNote(notes, value)) return null;
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 320;
      const popupHeight = 150;

      let left = rect.left - popupWidth / 2 + rect.width / 2;
      if (left + popupWidth > window.innerWidth - 20) {
        left = window.innerWidth - popupWidth - 20;
      }
      if (left < 20) left = 20;

      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = rect.top - popupHeight - 8;
      }

      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  return (
    <span className="inline-flex items-center ml-1.5">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-5 h-5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-600 hover:text-amber-700 text-[10px] font-bold inline-flex items-center justify-center transition-colors cursor-pointer"
        title="View note"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </button>
      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] w-80 bg-white border border-amber-200 rounded-lg shadow-xl overflow-hidden"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-amber-50 px-3 py-2 flex items-center justify-between border-b border-amber-200">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Note for This Test</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="text-amber-400 hover:text-amber-600 p-0.5 rounded hover:bg-amber-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-3 max-h-40 overflow-y-auto">
            <p className="text-sm text-slate-700 leading-relaxed">{notes}</p>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// Expert Insight Component
// ============================================
export const ExpertInsight = ({ topic }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);
  const insight = EXPERT_INSIGHTS[topic];

  // Calculate popup position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = 320;
      const popupHeight = 300; // approximate max height

      // Calculate left position - prefer left-aligned, but flip if too close to right edge
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 20) {
        left = rect.right - popupWidth;
      }
      // Ensure not off left edge
      if (left < 20) left = 20;

      // Calculate top position - prefer below, but flip if too close to bottom
      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - 20) {
        top = rect.top - popupHeight - 8;
      }

      setPopupStyle({ left: `${left}px`, top: `${top}px` });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on scroll outside popup
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      // Don't close if scrolling inside the popup
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  if (!insight) return null;

  // Format expert names
  const formatExperts = (experts) => {
    if (!experts) return "Expert Advisors";
    const names = experts.split(', ').map(e => {
      if (e === 'MR') return 'MR';
      if (e === 'SW') return 'SW';
      return e;
    });
    return `Expert${names.length > 1 ? 's' : ''}: ${names.join(', ')}`;
  };

  return (
    <span className="inline-flex items-center ml-1 align-middle">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[10px] font-bold inline-flex items-center justify-center hover:bg-amber-200 hover:border-amber-400 transition-colors cursor-pointer"
        title="Expert insight available - click to view"
      >
        E
      </button>
      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center">E</div>
                <h4 className="font-semibold text-slate-800 text-sm">{insight.title}</h4>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-4 py-3 text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
            {insight.content}
          </div>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-500">
              <span className="font-medium text-slate-600">{formatExperts(insight.experts)}</span>
            </p>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// Data Row Component for expanded view
// Layout: Label | Value + Citation + Note
// ============================================
export const DataRow = ({ label, value, unit, citations, notes, expertTopic }) => {
  if (value === null || value === undefined) return null;
  const displayValue = `${value}${unit || ''}`;
  const isLongValue = typeof displayValue === 'string' && displayValue.length > 60;

  if (isLongValue) {
    // Stack layout for long values
    return (
      <div className="py-2 border-b border-gray-100 last:border-0 group cursor-pointer">
        <div className="mb-1 flex items-center gap-1">
          <ParameterLabel label={label} expertTopic={expertTopic} useGroupHover={true} />
          {expertTopic && <ExpertInsight topic={expertTopic} />}
        </div>
        <span className="text-sm font-medium text-gray-900 inline-flex items-center flex-wrap">
          {displayValue}
          <CitationTooltip citations={citations} />
          <NoteTooltip notes={notes} value={value} />
        </span>
      </div>
    );
  }

  // Side-by-side layout for short values
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 gap-4 group cursor-pointer">
      <span className="flex-shrink-0 flex items-center gap-1">
        <ParameterLabel label={label} expertTopic={expertTopic} useGroupHover={true} />
        {expertTopic && <ExpertInsight topic={expertTopic} />}
      </span>
      <span className="text-sm font-medium text-gray-900 text-right inline-flex items-center">
        {displayValue}
        <CitationTooltip citations={citations} />
        <NoteTooltip notes={notes} value={value} />
      </span>
    </div>
  );
};
