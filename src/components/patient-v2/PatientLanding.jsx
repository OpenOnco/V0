import React from 'react';
import { getJourneysClockwise, HELPER_CARDS } from './journeyConfig';

/**
 * PatientLanding - Main landing page for the patient experience
 *
 * A warm, welcoming interface that guides patients through their cancer testing journey.
 * Features a 2x2 journey navigator showing the clockwise patient journey:
 * Screening → Choosing → Measuring → Watching
 *
 * Display labels, colors, and content are loaded from journeyConfig.js
 * To change display labels, edit the config file only.
 *
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback when user clicks a journey or helper link (receives path string)
 * @param {Function} props.onOpenChat - Callback when chat bubble is clicked
 */

// Get journey and helper configuration from config file
const journeySteps = getJourneysClockwise();
const helperCards = HELPER_CARDS;

// Landing page content
const LANDING_PAGE_CONTENT = {
  header: {
    title: 'Navigating Cancer Testing',
    leadParagraph: 'Liquid biopsy technology is transforming how we detect, treat, and monitor cancer—reading molecular signals in your blood to give you and your care team unprecedented visibility at every stage.',
    supportingParagraph: 'OpenOnco helps you understand these tests in plain language, find options relevant to your situation, and guide your journey through each stage of care.',
  },
  footer: {
    journeyDescription: 'Your journey may start at any point — choose what fits your situation',
  },
  helperSection: {
    heading: 'Need Help with Insurance or Costs?',
  },
  chatBubble: {
    icon: '💬',
    text: 'Need help?',
  },
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Arrow component for showing clockwise flow between journey boxes
 */
function FlowArrow({ direction, className = '' }) {
  const arrowStyles = {
    right: 'rotate-0',
    down: 'rotate-90',
    left: 'rotate-180',
    up: '-rotate-90',
  };

  return (
    <div className={`text-slate-300 ${className}`}>
      <svg
        className={`w-6 h-6 ${arrowStyles[direction]}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14 5l7 7m0 0l-7 7m7-7H3"
        />
      </svg>
    </div>
  );
}

/**
 * Individual journey box component
 */
function JourneyBox({ journey, onNavigate }) {
  const { label, question, description, categories, colors, path } = journey;

  return (
    <button
      onClick={() => onNavigate(path)}
      className={`
        ${colors.bg} ${colors.hover} ${colors.border}
        border-2 rounded-2xl p-6
        transition-all duration-200 ease-in-out
        hover:shadow-lg hover:scale-[1.02]
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400
        text-left w-full h-full
        flex flex-col min-h-[180px]
      `}
    >
      {/* Category badge */}
      <div className={`${colors.accent} text-white text-xs font-semibold px-3 py-1 rounded-full w-fit mb-3`}>
        {label.toUpperCase()}
      </div>

      {/* Main question */}
      <h3 className={`${colors.text} text-lg font-semibold mb-2`}>
        {question}
      </h3>

      {/* Description */}
      <p className="text-slate-600 text-sm flex-grow">
        {description}
      </p>

      {/* Category tags and learn more */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-1">
          {categories.map((cat) => (
            <span
              key={cat}
              className={`${colors.bg} ${colors.text} text-xs font-medium px-2 py-0.5 rounded border ${colors.border}`}
            >
              {cat}
            </span>
          ))}
        </div>
        <div className={`${colors.text} text-sm font-medium flex items-center gap-1`}>
          Learn more
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

/**
 * Helper card component for insurance/financial assistance
 */
function HelperCard({ card, onNavigate }) {
  const { title, description, path, icon } = card;

  return (
    <button
      onClick={() => onNavigate(path)}
      className="
        bg-white border-2 border-slate-200 rounded-2xl p-6
        transition-all duration-200 ease-in-out
        hover:border-slate-300 hover:shadow-lg hover:scale-[1.02]
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400
        text-left w-full
        flex items-start gap-4
      "
    >
      {/* Icon */}
      <div className="text-3xl flex-shrink-0">{icon}</div>

      {/* Content */}
      <div className="flex-grow">
        <h4 className="text-slate-800 font-semibold mb-1">{title}</h4>
        <p className="text-slate-600 text-sm">{description}</p>
      </div>

      {/* Arrow */}
      <div className="text-slate-400 flex-shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

/**
 * Floating chat bubble component
 */
function ChatBubble({ onOpenChat }) {
  return (
    <button
      onClick={onOpenChat}
      className="
        fixed bottom-6 right-6 z-50
        bg-slate-800 text-white
        px-5 py-3 rounded-full
        shadow-lg hover:shadow-xl
        transition-all duration-200 ease-in-out
        hover:bg-slate-700 hover:scale-105
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400
        flex items-center gap-2
      "
      aria-label="Open chat for help"
    >
      <span className="text-lg">{LANDING_PAGE_CONTENT.chatBubble.icon}</span>
      <span className="font-medium text-sm">{LANDING_PAGE_CONTENT.chatBubble.text}</span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Main PatientLanding component
 */
export default function PatientLanding({ onNavigate, onOpenChat }) {
  // Default handlers if not provided
  const handleNavigate = onNavigate || ((path) => console.log('Navigate to:', path));
  const handleOpenChat = onOpenChat || (() => console.log('Open chat'));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Main content container */}
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* ===== Header Section ===== */}
        <header className="mb-10">
          <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50 rounded-2xl shadow-sm border border-slate-100 px-6 py-8 sm:px-10 sm:py-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3 text-center">
              {LANDING_PAGE_CONTENT.header.title}
            </h1>
            <p className="text-base sm:text-lg text-slate-700 max-w-2xl mx-auto mb-2 leading-relaxed text-center">
              {LANDING_PAGE_CONTENT.header.leadParagraph}
            </p>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed text-center">
              {LANDING_PAGE_CONTENT.header.supportingParagraph}
            </p>
          </div>
        </header>

        {/* ===== 2x2 Journey Navigator ===== */}
        <section className="mb-16" aria-label="Patient journey navigator">
          <div className="relative">
            {/* Journey grid - 2x2 on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Upper Left - Screening */}
              <JourneyBox journey={journeySteps[0]} onNavigate={handleNavigate} />

              {/* Upper Right - Choosing */}
              <JourneyBox journey={journeySteps[1]} onNavigate={handleNavigate} />

              {/* Lower Left - Watching (visual order swapped for clockwise flow) */}
              <div className="order-4 sm:order-3">
                <JourneyBox journey={journeySteps[3]} onNavigate={handleNavigate} />
              </div>

              {/* Lower Right - Measuring */}
              <div className="order-3 sm:order-4">
                <JourneyBox journey={journeySteps[2]} onNavigate={handleNavigate} />
              </div>
            </div>

            {/* Clockwise flow arrows - hidden on mobile */}
            <div className="hidden sm:block pointer-events-none">
              {/* Top arrow (Screening → Choosing) */}
              <div className="absolute top-[90px] left-1/2 -translate-x-1/2">
                <FlowArrow direction="right" />
              </div>

              {/* Right arrow (Choosing → Measuring) */}
              <div className="absolute top-1/2 right-[-12px] -translate-y-1/2">
                <FlowArrow direction="down" />
              </div>

              {/* Bottom arrow (Measuring → Watching) */}
              <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2">
                <FlowArrow direction="left" />
              </div>

              {/* Left arrow (Watching → Screening) */}
              <div className="absolute top-1/2 left-[-12px] -translate-y-1/2">
                <FlowArrow direction="up" />
              </div>
            </div>
          </div>

          {/* Journey flow description */}
          <p className="text-center text-sm text-slate-500 mt-6">
            {LANDING_PAGE_CONTENT.footer.journeyDescription}
          </p>
        </section>

        {/* ===== Insurance & Financial Help Section ===== */}
        <section aria-label="Insurance and financial assistance">
          <h2 className="text-2xl font-semibold text-slate-800 text-center mb-6">
            {LANDING_PAGE_CONTENT.helperSection.heading}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {helperCards.map((card) => (
              <HelperCard key={card.id} card={card} onNavigate={handleNavigate} />
            ))}
          </div>
        </section>
      </div>

      {/* ===== Floating Chat Bubble ===== */}
      <ChatBubble onOpenChat={handleOpenChat} />
    </div>
  );
}
