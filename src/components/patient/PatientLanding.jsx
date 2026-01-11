import React from 'react';

/**
 * PatientLanding - Simple, clean landing page for patient experience
 *
 * Two pathways:
 * - Screening (sky blue): "Early Detection" - For healthy people wanting early cancer detection
 * - Watching (emerald): "After Treatment" - For post-treatment patients monitoring for recurrence
 */
export default function PatientLanding({ onNavigate }) {
  const handleNavigate = (path) => {
    if (onNavigate) {
      // Convert path to page name for App.jsx handleNavigate
      const pageMap = {
        '/patient/screening': 'patient-screening',
        '/patient/watching': 'patient-watching',
      };
      onNavigate(pageMap[path] || 'patient-landing');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        {/* Warm Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Find the Right Blood Test
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            OpenOnco helps you understand cancer blood tests in plain language.
          </p>
        </div>

        {/* Two-Card Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 mb-12">
          {/* Card 1 - SCREENING (sky blue theme) */}
          <button
            onClick={() => handleNavigate('/patient/screening')}
            className="group relative bg-white rounded-2xl border-2 border-sky-200 p-6 sm:p-8
                       hover:border-sky-400 hover:shadow-xl hover:shadow-sky-100/50
                       transition-all duration-300 text-left
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
          >
            {/* Icon */}
            <div className="w-16 h-16 mb-5 bg-sky-100 rounded-2xl flex items-center justify-center
                            group-hover:bg-sky-500 group-hover:scale-110 transition-all duration-300">
              <svg
                className="w-8 h-8 text-sky-600 group-hover:text-white transition-colors duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-sky-700 transition-colors">
              Early Detection
            </h2>

            {/* Subtitle */}
            <p className="text-sky-700 font-medium mb-3">
              I'm healthy and want to screen for cancer
            </p>

            {/* Description */}
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Learn about blood tests that can detect cancer early, before symptoms appear.
            </p>

            {/* Button */}
            <div className="flex items-center text-sky-600 font-semibold">
              <span className="mr-2">Explore screening tests</span>
              <svg
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>

            {/* Hover accent bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500 rounded-b-2xl
                            transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
          </button>

          {/* Card 2 - WATCHING (emerald theme) */}
          <button
            onClick={() => handleNavigate('/patient/watching')}
            className="group relative bg-white rounded-2xl border-2 border-emerald-200 p-6 sm:p-8
                       hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-100/50
                       transition-all duration-300 text-left
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {/* Icon - Shield/checkmark for protection/monitoring */}
            <div className="w-16 h-16 mb-5 bg-emerald-100 rounded-2xl flex items-center justify-center
                            group-hover:bg-emerald-500 group-hover:scale-110 transition-all duration-300">
              <svg
                className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors">
              After Treatment
            </h2>

            {/* Subtitle */}
            <p className="text-emerald-700 font-medium mb-3">
              I finished treatment and want to monitor
            </p>

            {/* Description */}
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Find tests that detect cancer recurrence months before imaging can.
            </p>

            {/* Button */}
            <div className="flex items-center text-emerald-600 font-semibold">
              <span className="mr-2">Explore monitoring tests</span>
              <svg
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>

            {/* Hover accent bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-b-2xl
                            transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
          </button>
        </div>

        {/* Chat Help Link */}
        <div className="text-center">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900
                       bg-slate-100 hover:bg-slate-200 rounded-full transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            onClick={() => {
              // Could open a chat modal or navigate to help
              console.log('Open chat guide');
            }}
          >
            <span className="text-lg">💬</span>
            <span className="font-medium">Not sure which? Chat with our guide</span>
          </button>
        </div>
      </main>

      {/* Disclaimer */}
      <footer className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <p className="text-center text-xs text-slate-400">
          This information is for educational purposes only and does not constitute medical advice.
          Always consult with your healthcare provider about your specific situation.
        </p>
      </footer>
    </div>
  );
}
