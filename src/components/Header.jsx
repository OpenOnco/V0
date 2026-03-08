import { useState } from 'react';
import { getNavItems } from '../personaContent';
import { getSiteConfig } from '../data';
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
      <button
        type="button"
        className="cursor-pointer hidden sm:flex items-center flex-shrink-0 gap-2 bg-transparent border-none p-0"
        onClick={() => handleNavigate('home')}
        aria-label="Go to home page"
      >
        <img src="/OO_logo_2.png" alt="OpenOnco" className="h-14" />
        {(persona === 'patient' || persona === 'medical') && showPreviewBanner && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-300">
            Preview
          </span>
        )}
      </button>
      <div className="sm:hidden flex items-center gap-2">
        <button
          type="button"
          className="text-xl font-bold text-[#2A63A4] cursor-pointer bg-transparent border-none p-0"
          onClick={() => handleNavigate('home')}
          aria-label="Go to home page"
        >OpenOnco</button>
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
        </div>
      </div>
    )}
  </header>
  {/* Trust Banner for Patient Persona */}
  {showTrustBanner && <TrustBanner />}
  {/* Preview Banner - shown for patient and medical personas */}
  {(persona === 'patient' || persona === 'medical') && showPreviewBanner && <PreviewBanner />}
  </>
  );
};
export default Header;
