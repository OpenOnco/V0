/**
 * Configuration for OpenOnco Physician System
 */

export const config = {
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || './logs',

  // Database
  databaseUrl: process.env.MRD_DATABASE_URL || process.env.DATABASE_URL,

  // API Keys
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  ncbiApiKey: process.env.NCBI_API_KEY,

  // Server
  port: parseInt(process.env.PORT || '3000', 10),

  // Guidelines directory
  guidelinesDir: process.env.GUIDELINES_DIR || './data/guidelines',

  // Processing
  embedding: {
    model: 'text-embedding-ada-002',
    chunkSize: 1000,
    chunkOverlap: 200,
  },

  // AI Models
  models: {
    triage: 'claude-3-5-haiku-20241022',
    classify: 'claude-sonnet-4-20250514',
    chat: 'claude-sonnet-4-20250514',
  },

  // Email (Resend)
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'OpenOnco MRD <mrd@openonco.org>',
    to: process.env.EMAIL_TO || 'alexgdickinson@gmail.com',
  },

  // Schedules (cron format)
  schedules: {
    // Monthly crawlers (1st of month)
    pubmed: process.env.PUBMED_SCHEDULE || '0 6 1 * *',             // 1st of month, 6 AM
    fda: process.env.FDA_SCHEDULE || '0 7 1 * *',                   // 1st of month, 7 AM
    clinicaltrials: process.env.TRIALS_SCHEDULE || '0 8 1 * *',     // 1st of month, 8 AM
    cms: process.env.CMS_SCHEDULE || '0 5 1 * *',                   // 1st of month, 5 AM
    // Monthly processing (1st of month, after crawlers)
    embed: process.env.EMBED_SCHEDULE || '0 12 1 * *',              // 1st of month, noon
    link: process.env.LINK_SCHEDULE || '0 13 1 * *',                // 1st of month, 1 PM
    monitor: process.env.MONITOR_SCHEDULE || '0 9 1 * *',           // 1st of month, 9 AM
    // Monthly FAQ refresh (2nd of month, after all evidence is embedded)
    faqRefresh: process.env.FAQ_REFRESH_SCHEDULE || '0 10 2 * *',   // 2nd of month, 10 AM
    // Deprecated — newsletters removed
    // digest: process.env.DIGEST_SCHEDULE || '0 9 * * 1',
    // dailyReport: process.env.DAILY_REPORT_SCHEDULE || '0 18 * * *',
    // Guideline monitoring (keep more frequent — guidelines change rarely but matter a lot)
    versionWatch: process.env.VERSION_WATCH_SCHEDULE || '0 12 * * 1', // Weekly Monday noon
    guidelineScan: process.env.GUIDELINE_SCAN_SCHEDULE || '0 12 1 * *', // 1st of month, noon
  },

  // Thresholds
  thresholds: {
    triageMinScore: parseInt(process.env.TRIAGE_MIN_SCORE || '5', 10),
    prefilterMinScore: parseInt(process.env.PREFILTER_MIN_SCORE || '2', 10),
    embeddingSimilarity: parseFloat(process.env.EMBED_SIMILARITY || '0.80'),
  },
};

export default config;
