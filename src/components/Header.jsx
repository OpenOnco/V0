import { useState } from 'react';
import { PERSONAS } from '../personaConfig';
import { getNavItems } from '../personaContent';
import { getSiteConfig } from '../data';
import PersonaSelector from './PersonaSelector';
import TrustBanner from './patient/TrustBanner';
import PreviewBanner from './patient/PreviewBanner';

const Header = ({ currentPage, onNavigate, persona, onPersonaChange, showPreviewBanner = true }) => {
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
  
  const showTrustBanner = persona === 'patient';
  
  return (
  <>
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
      <div className="cursor-pointer hidden sm:flex items-center flex-shrink-0 gap-2" onClick={() => handleNavigate('home')}>
        <img src="/OO_logo_2.png" alt="OpenOnco" className="h-14" />
        {persona === 'patient' && showPreviewBanner && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-300">
            Preview
          </span>
        )}
      </div>
      <div className="sm:hidden flex items-center gap-2">
        <span className="text-xl font-bold text-[#2A63A4] cursor-pointer" onClick={() => handleNavigate('home')}>OpenOnco</span>
        {persona === 'patient' && showPreviewBanner && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full border border-amber-300">
            Preview
          </span>
        )}
      </div>
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
      
      {/* Persona Selector - Right side */}
      {persona && onPersonaChange && (
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
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
  {/* Trust Banner for Patient Persona */}
  {showTrustBanner && <TrustBanner />}
  {/* Preview Banner for Patient Persona - shown below Trust Banner */}
  {persona === 'patient' && showPreviewBanner && <PreviewBanner />}
  </>
  );
};
export default Header;
