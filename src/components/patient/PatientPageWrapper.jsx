import React from 'react';
import { Heart, ArrowLeft } from 'lucide-react';

export default function PatientPageWrapper({ children, onNavigate, backLabel = 'Back', backTo = 'patient-landing' }) {
  return (
    <div className="min-h-screen font-sans bg-warm-50 flex flex-col">
      <nav className="sticky top-0 z-50 bg-warm-50/80 backdrop-blur-md border-b border-warm-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => onNavigate(backTo)}
            className="flex items-center gap-2 text-stone-600 hover:text-brand-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-brand-700" />
            <span className="font-serif text-xl font-medium text-brand-900">OpenOnco</span>
          </div>
          <div className="w-[72px]" /> {/* spacer to balance the back button */}
        </div>
      </nav>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-stone-900 text-stone-400 py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 text-sm flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-2 md:mb-0">
            <Heart className="w-4 h-4 text-brand-500" />
            <span className="text-white font-medium">OpenOnco</span>
          </div>
          <p>This information is for educational purposes and does not replace professional medical advice.</p>
        </div>
      </footer>
    </div>
  );
}
