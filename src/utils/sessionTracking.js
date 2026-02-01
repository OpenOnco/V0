/**
 * Session tracking for feedback context
 * Tracks pages visited to provide context when users submit feedback
 */

const SESSION_KEY = 'openonco_session';

// Initialize or get existing session
const getSession = () => {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Session storage not available');
  }
  
  const newSession = {
    startTime: new Date().toISOString(),
    pagesVisited: [],
    testsViewed: [],
    persona: null
  };
  
  saveSession(newSession);
  return newSession;
};

const saveSession = (session) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Could not save session');
  }
};

// Track a page visit
export const trackPageVisit = (pageName) => {
  const session = getSession();
  const timestamp = new Date().toISOString();
  
  // Avoid duplicate consecutive entries
  const lastVisit = session.pagesVisited[session.pagesVisited.length - 1];
  if (lastVisit?.page !== pageName) {
    session.pagesVisited.push({ page: pageName, time: timestamp });
    // Keep last 20 pages to avoid bloat
    if (session.pagesVisited.length > 20) {
      session.pagesVisited = session.pagesVisited.slice(-20);
    }
    saveSession(session);
  }
};

// Track a test detail view
export const trackTestView = (testId, testName) => {
  const session = getSession();
  const timestamp = new Date().toISOString();
  
  // Avoid duplicate consecutive entries
  const lastView = session.testsViewed[session.testsViewed.length - 1];
  if (lastView?.id !== testId) {
    session.testsViewed.push({ id: testId, name: testName, time: timestamp });
    // Keep last 10 tests
    if (session.testsViewed.length > 10) {
      session.testsViewed = session.testsViewed.slice(-10);
    }
    saveSession(session);
  }
};

// Track persona selection
export const trackPersona = (persona) => {
  const session = getSession();
  session.persona = persona;
  saveSession(session);
};

// Generate feedback URL with session context
export const getFeedbackUrl = (baseUrl, additionalParams = {}) => {
  const session = getSession();
  
  // Summarize session for URL
  const pagesSummary = session.pagesVisited
    .map(p => p.page)
    .join(' → ');
  
  const testsSummary = session.testsViewed
    .map(t => t.name || t.id)
    .join(', ');
  
  const sessionDuration = session.startTime 
    ? Math.round((Date.now() - new Date(session.startTime).getTime()) / 60000)
    : 0;
  
  // Build URL params
  const params = new URLSearchParams({
    // Pre-fill fields (Google Form uses 'entry.XXXXX' format)
    ...additionalParams,
  });
  
  // Add session context as a single field (truncate if too long)
  const context = [
    `Persona: ${session.persona || 'not set'}`,
    `Duration: ${sessionDuration} min`,
    `Pages: ${pagesSummary || 'none'}`,
    `Tests viewed: ${testsSummary || 'none'}`
  ].join('\n');
  
  // Store context that can be retrieved by the feedback form component
  try {
    sessionStorage.setItem('openonco_feedback_context', context);
  } catch (e) {}
  
  return `${baseUrl}?${params.toString()}`;
};

// Get session context as a string (for copying or displaying)
export const getSessionContext = () => {
  const session = getSession();
  
  const pagesSummary = session.pagesVisited
    .map(p => p.page)
    .join(' → ');
  
  const testsSummary = session.testsViewed
    .map(t => t.name || t.id)
    .join(', ');
  
  const sessionDuration = session.startTime 
    ? Math.round((Date.now() - new Date(session.startTime).getTime()) / 60000)
    : 0;
  
  return {
    persona: session.persona || 'not set',
    duration: `${sessionDuration} min`,
    pages: pagesSummary || 'none',
    testsViewed: testsSummary || 'none',
    raw: session
  };
};

export default {
  trackPageVisit,
  trackTestView,
  trackPersona,
  getFeedbackUrl,
  getSessionContext,
};
