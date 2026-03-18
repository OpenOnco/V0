import React, { useState } from 'react';
import { Heart, ArrowLeft, ArrowRight } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col items-center px-6 pt-10 pb-8 md:justify-center md:py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8 animate-fade-in-up">
        <Heart className="w-7 h-7 text-brand-700 fill-brand-700" />
        <span className="font-serif text-2xl md:text-3xl text-brand-900 tracking-tight">
          OpenOnco
        </span>
      </div>

      {/* Hero text */}
      <p
        className="max-w-3xl text-center font-serif text-2xl md:text-3xl text-slate-700 leading-relaxed mb-12 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '0.15s' }}
      >
        The only independent, nonprofit resource that collects, curates, and explains molecular cancer tests
        — so patients and professionals can make informed decisions.
      </p>

      {/* Cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-10 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '0.3s' }}
      >
        {/* Patient card */}
        <button
          onClick={() => onNavigate('patient-landing')}
          onMouseEnter={() => setHoveredCard('patient')}
          onMouseLeave={() => setHoveredCard(null)}
          className="group relative rounded-2xl overflow-hidden h-72 md:h-80 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          <img
            src="/images/landing-patient.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background: hoveredCard === 'patient'
                ? 'linear-gradient(135deg, rgba(30,75,184,0.88) 0%, rgba(15,45,107,0.92) 100%)'
                : 'linear-gradient(135deg, rgba(30,75,184,0.78) 0%, rgba(15,45,107,0.82) 100%)',
            }}
          />
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-7">
            <h2 className="font-serif text-3xl md:text-4xl text-white mb-2">
              I'm a Patient
            </h2>
            <p className="text-blue-100 text-sm md:text-base mb-5 whitespace-nowrap">
              Find tests &middot; Check coverage &middot; Doctor FAQs
            </p>
            <ArrowLeft
              className="w-8 h-8 text-white transition-transform duration-300 group-hover:-translate-x-2"
              strokeWidth={2.5}
            />
          </div>
        </button>

        {/* Industry/R&D card */}
        <button
          onClick={() => onNavigate('home-rnd')}
          onMouseEnter={() => setHoveredCard('rnd')}
          onMouseLeave={() => setHoveredCard(null)}
          className="group relative rounded-2xl overflow-hidden h-72 md:h-80 text-right cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          <img
            src="/images/landing-research.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background: hoveredCard === 'rnd'
                ? 'linear-gradient(135deg, rgba(109,40,217,0.88) 0%, rgba(91,33,182,0.92) 100%)'
                : 'linear-gradient(135deg, rgba(109,40,217,0.78) 0%, rgba(91,33,182,0.82) 100%)',
            }}
          />
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-7 text-right">
            <h2 className="font-serif text-3xl md:text-4xl text-white mb-2">
              Industry/R&D
            </h2>
            <p className="text-violet-100 text-sm md:text-base mb-5">
              Full database &middot; Comparisons &middot; Open data
            </p>
            <div className="flex justify-end">
              <ArrowRight
                className="w-8 h-8 text-white transition-transform duration-300 group-hover:translate-x-2"
                strokeWidth={2.5}
              />
            </div>
          </div>
        </button>
      </div>

      {/* Stats line */}
      <p
        className="text-lg md:text-xl text-slate-600 tracking-wide text-center opacity-0 animate-fade-in-up"
        style={{ animationDelay: '0.45s' }}
      >
        160+ tests &middot; 75+ vendors &middot; Updated weekly &middot; All data open and downloadable
      </p>
    </div>
  );
}
