import { useState } from 'react';
import { PERSONAS } from '../personaConfig';
import { getNavItems } from '../personaContent';
import { getSiteConfig } from '../data';
import PersonaSelector from './PersonaSelector';

const Header = ({ currentPage, onNavigate, persona, onPersonaChange }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const siteConfig = getSiteConfig();

  const handleNavigate = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = getNavItems(persona);
  const getLabel = (page) => ({
    'home': 'Home',
    'learn': 'Learn',
    'data-sources': 'Data Download',
    'how-it-works': 'How it Works',
    'submissions': 'Submissions',
    'faq': 'FAQ',
    'about': 'About'
  }[page] || page);
  
  return (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
      <div className="cursor-pointer hidden sm:flex items-center flex-shrink-0" onClick={() => handleNavigate('home')}>
        <img src="data:image/jpeg;base64,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" alt="OpenOnco" className="h-14" />
      </div>
      <span className="sm:hidden text-xl font-bold text-[#2A63A4] cursor-pointer" onClick={() => handleNavigate('home')}>OpenOnco</span>
      <nav className="hidden sm:flex items-center flex-1 justify-evenly overflow-x-auto">
        {navItems.map(page => (
          <button
            key={page}
            onClick={() => handleNavigate(page)}
            className={`px-2 sm:px-4 py-2 rounded-lg text-sm sm:text-lg font-semibold transition-colors whitespace-nowrap ${
              currentPage === page ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {getLabel(page)}
          </button>
        ))}
      </nav>
      
      {/* Persona Selector - Right side with "Me:" label */}
      {persona && onPersonaChange && (
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span className="text-sm sm:text-lg font-semibold text-gray-600">Me:</span>
          <PersonaSelector currentPersona={persona} onSelect={onPersonaChange} />
        </div>
      )}
      
      {/* Mobile hamburger button */}
      <button 
        className="sm:hidden p-2 rounded-lg hover:bg-gray-100"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {mobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
    
    {/* Mobile menu dropdown */}
    {mobileMenuOpen && (
      <div className="sm:hidden border-t border-gray-200 bg-white">
        <div className="flex flex-col py-2">
          {navItems.map(page => (
            <button
              key={page}
              onClick={() => handleNavigate(page)}
              className={`px-4 py-3 text-left font-medium ${
                currentPage === page ? 'bg-gray-100 text-gray-900' : 'text-gray-600'
              }`}
            >
              {getLabel(page)}
            </button>
          ))}
          {/* Mobile Persona Selector */}
          {persona && onPersonaChange && (
            <div className="border-t border-gray-100 mt-2 pt-2 px-4">
              <p className="text-xs text-gray-400 mb-2">Viewing as:</p>
              {Object.entries(PERSONAS).map(([key, p]) => {
                const isSelected = persona === key;
                return (
                  <button
                    key={key}
                    onClick={() => { onPersonaChange(key); setMobileMenuOpen(false); }}
                    className={`w-full p-2 mb-1 flex items-center gap-3 rounded-lg transition-all text-left ${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    {p.iconImage ? (
                      <img src={p.iconImage} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <span className="text-lg">{p.icon}</span>
                    )}
                    <span className={`text-sm ${isSelected ? 'font-medium' : ''}`} style={isSelected ? { color: p.color } : {}}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}
  </header>
  );
};
export default Header;
