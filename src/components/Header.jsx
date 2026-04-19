import { getSiteConfig } from '../data';
import { useAllTests } from '../dal/hooks/useTests';

const Header = ({ currentPage, onNavigate }) => {
  const { tests: allTests } = useAllTests();
  const testCount = allTests?.length || 213;

  return (
    <header className="bg-white border-b-2 border-brand-600 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          type="button"
          className="cursor-pointer flex items-center bg-transparent border-none p-0 flex-shrink-0"
          onClick={() => onNavigate('home')}
          aria-label="Go to home page"
        >
          <img src="/OO_logo_2.png" alt="OpenOnco" className="h-10 sm:h-11" />
        </button>

        {/* Wide CTA button to test database */}
        <button
          onClick={() => onNavigate('home-classic')}
          className="flex items-center gap-2 px-4 py-3 text-sm sm:text-[15px] font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition shadow-sm cursor-pointer border-none"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden sm:inline">Search here for the details on all {testCount} advanced tests we cover</span>
          <span className="sm:hidden">Search all {testCount} tests we cover</span>
        </button>
      </div>
    </header>
  );
};
export default Header;
