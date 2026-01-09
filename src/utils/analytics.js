/**
 * OpenOnco Analytics Module
 * 
 * Uses PostHog for product analytics to understand user behavior
 * and identify monetization opportunities.
 * 
 * Key events tracked:
 * - Page views with persona context
 * - Test views and comparisons
 * - Chat interactions
 * - User journey through the site
 * - Engagement signals (scroll, time on page)
 */

import posthog from 'posthog-js';

// PostHog configuration
// Key is hardcoded as fallback because it's a public frontend key (not secret)
// and Vercel env var injection during build can be unreliable
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_i3Hw8Ph3vwoICch2CcX0WgYkC0lYOCQrmhWVKF7B0Aw';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

/**
 * Initialize PostHog
 * Call this once in main.jsx
 */
export const initAnalytics = () => {
  if (initialized || !POSTHOG_KEY) {
    if (!POSTHOG_KEY) {
      console.log('[Analytics] PostHog key not configured - analytics disabled');
    }
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Respect user privacy
    respect_dnt: true,
    // Capture page views automatically
    capture_pageview: false, // We'll do this manually for more control
    capture_pageleave: true,
    // Session recording (optional - can be disabled)
    disable_session_recording: false,
    // Autocapture clicks on buttons/links
    autocapture: {
      dom_event_allowlist: ['click'],
      element_allowlist: ['button', 'a', 'input[type="submit"]'],
    },
    // Don't track sensitive data
    sanitize_properties: (properties) => {
      // Remove any potential PII from properties
      const sanitized = { ...properties };
      delete sanitized.email;
      delete sanitized.phone;
      return sanitized;
    },
  });

  initialized = true;
  console.log('[Analytics] PostHog initialized');
};

/**
 * Identify user persona (anonymous but with context)
 */
export const identifyPersona = (persona) => {
  if (!initialized) return;
  
  posthog.capture('persona_selected', { persona });
  
  // Set persona as a user property for segmentation
  posthog.people.set({
    persona,
    last_seen: new Date().toISOString(),
  });
};

// ============================================================================
// PAGE & NAVIGATION EVENTS
// ============================================================================

/**
 * Track page view with context
 */
export const trackPageView = (pageName, properties = {}) => {
  if (!initialized) return;
  
  posthog.capture('$pageview', {
    page: pageName,
    url: window.location.href,
    path: window.location.pathname,
    referrer: document.referrer,
    ...properties,
  });
};

/**
 * Track category page view
 */
export const trackCategoryView = (category, testCount) => {
  if (!initialized) return;
  
  posthog.capture('category_viewed', {
    category,
    test_count: testCount,
  });
};

// ============================================================================
// TEST INTERACTION EVENTS
// ============================================================================

/**
 * Track when a user views a test detail
 */
export const trackTestView = (test, source = 'unknown') => {
  if (!initialized) return;
  
  posthog.capture('test_viewed', {
    test_id: test.id,
    test_name: test.name || test.testName,
    vendor: test.vendor,
    category: test.category,
    source, // Where they came from: 'search', 'category', 'comparison', 'chat'
    has_vendor_badge: !!test.vendorVerified,
    fda_status: test.fdaStatus,
  });
};

/**
 * Track test comparison
 */
export const trackTestComparison = (tests, source = 'unknown') => {
  if (!initialized) return;
  
  posthog.capture('tests_compared', {
    test_ids: tests.map(t => t.id),
    test_names: tests.map(t => t.name || t.testName),
    vendors: tests.map(t => t.vendor),
    comparison_count: tests.length,
    source,
  });
};

/**
 * Track when user clicks external link (vendor site, citation, etc)
 */
export const trackExternalClick = (testId, linkType, url) => {
  if (!initialized) return;
  
  posthog.capture('external_link_clicked', {
    test_id: testId,
    link_type: linkType, // 'vendor', 'citation', 'trial', 'publication'
    url,
  });
};

/**
 * Track search behavior
 */
export const trackSearch = (query, resultsCount, category = null) => {
  if (!initialized) return;
  
  posthog.capture('search_performed', {
    query,
    results_count: resultsCount,
    category,
    query_length: query.length,
  });
};

/**
 * Track filter usage
 */
export const trackFilter = (filterType, filterValue, category) => {
  if (!initialized) return;
  
  posthog.capture('filter_applied', {
    filter_type: filterType,
    filter_value: filterValue,
    category,
  });
};

// ============================================================================
// CHAT EVENTS
// ============================================================================

/**
 * Track chat initiation
 */
export const trackChatStart = (persona, mode = null) => {
  if (!initialized) return;
  
  posthog.capture('chat_started', {
    persona,
    mode, // 'learn' or 'find' for patient persona
  });
};

/**
 * Track chat message sent
 */
export const trackChatMessage = (persona, messageLength, isFirstMessage = false) => {
  if (!initialized) return;
  
  posthog.capture('chat_message_sent', {
    persona,
    message_length: messageLength,
    is_first_message: isFirstMessage,
  });
};

/**
 * Track chat topic (detected from message content)
 */
export const trackChatTopic = (persona, topic) => {
  if (!initialized) return;
  
  posthog.capture('chat_topic_detected', {
    persona,
    topic, // e.g., 'mrd_comparison', 'test_recommendation', 'general_question'
  });
};

// ============================================================================
// ENGAGEMENT EVENTS
// ============================================================================

/**
 * Track scroll depth on a page
 */
export const trackScrollDepth = (pageName, maxDepth) => {
  if (!initialized) return;
  
  // Only track significant milestones
  const milestones = [25, 50, 75, 100];
  const milestone = milestones.find(m => maxDepth >= m && maxDepth < m + 25) || 100;
  
  posthog.capture('scroll_depth_reached', {
    page: pageName,
    depth_percent: milestone,
  });
};

/**
 * Track time on page (call on page leave)
 */
export const trackTimeOnPage = (pageName, durationSeconds) => {
  if (!initialized) return;
  
  posthog.capture('time_on_page', {
    page: pageName,
    duration_seconds: durationSeconds,
    duration_bucket: getDurationBucket(durationSeconds),
  });
};

const getDurationBucket = (seconds) => {
  if (seconds < 10) return '<10s';
  if (seconds < 30) return '10-30s';
  if (seconds < 60) return '30-60s';
  if (seconds < 180) return '1-3min';
  if (seconds < 300) return '3-5min';
  return '>5min';
};

// ============================================================================
// CONVERSION EVENTS (for monetization tracking)
// ============================================================================

/**
 * Track API usage (from embed or external)
 */
export const trackAPIUsage = (endpoint, referrer) => {
  if (!initialized) return;
  
  posthog.capture('api_used', {
    endpoint,
    referrer,
  });
};

/**
 * Track vendor badge interaction (potential lead interest)
 */
export const trackVendorInterest = (testId, vendor, interactionType) => {
  if (!initialized) return;
  
  posthog.capture('vendor_interest', {
    test_id: testId,
    vendor,
    interaction_type: interactionType, // 'badge_click', 'info_request', 'website_click'
  });
};

/**
 * Track high-value user signals
 */
export const trackHighValueSignal = (signalType, properties = {}) => {
  if (!initialized) return;
  
  posthog.capture('high_value_signal', {
    signal_type: signalType, // 'multi_test_compare', 'deep_research', 'return_visit'
    ...properties,
  });
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if analytics is enabled
 */
export const isAnalyticsEnabled = () => initialized;

/**
 * Get PostHog instance for advanced usage
 */
export const getPostHog = () => (initialized ? posthog : null);

/**
 * Opt user out of tracking
 */
export const optOut = () => {
  if (initialized) {
    posthog.opt_out_capturing();
  }
};

/**
 * Opt user back in
 */
export const optIn = () => {
  if (initialized) {
    posthog.opt_in_capturing();
  }
};

export default {
  initAnalytics,
  identifyPersona,
  trackPageView,
  trackCategoryView,
  trackTestView,
  trackTestComparison,
  trackExternalClick,
  trackSearch,
  trackFilter,
  trackChatStart,
  trackChatMessage,
  trackChatTopic,
  trackScrollDepth,
  trackTimeOnPage,
  trackAPIUsage,
  trackVendorInterest,
  trackHighValueSignal,
  isAnalyticsEnabled,
  getPostHog,
  optOut,
  optIn,
};
