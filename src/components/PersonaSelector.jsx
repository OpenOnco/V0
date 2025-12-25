import { useState, useEffect, useRef } from 'react';
import { track } from '@vercel/analytics';
import { PERSONAS, getPersonaConfig } from '../personaConfig';

// Header persona selector dropdown
const PersonaSelector = ({ currentPersona, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const config = getPersonaConfig(currentPersona);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (personaId) => {
    onSelect(personaId);
    setIsOpen(false);
    track('persona_changed', { new_persona: personaId });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all hover:bg-gray-50"
        style={{ borderColor: config.color, backgroundColor: isOpen ? config.bgColor : 'white' }}
      >
        {config.iconImage ? (
          <img src={config.iconImage} alt="" className="w-5 h-5 object-contain" />
        ) : (
          <span className="text-lg">{config.icon}</span>
        )}
        <span className="text-sm font-medium hidden lg:inline" style={{ color: config.color }}>{config.shortLabel}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: config.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 font-medium">Viewing as:</p>
          </div>
          {Object.entries(PERSONAS).map(([key, p]) => {
            const isSelected = currentPersona === key;
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`w-full p-3 flex items-center gap-3 transition-all text-left hover:bg-gray-50
                  ${isSelected ? 'bg-gray-50' : ''}`}
              >
                <div 
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0`}
                  style={{ borderColor: isSelected ? p.color : '#d1d5db' }}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  )}
                </div>
                {p.iconImage ? (
                  <img src={p.iconImage} alt="" className="w-6 h-6 object-contain" />
                ) : (
                  <span className="text-xl">{p.icon}</span>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium" style={isSelected ? { color: p.color } : { color: '#374151' }}>
                    {p.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PersonaSelector;
