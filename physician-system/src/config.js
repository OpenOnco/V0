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
    pubmed: process.env.PUBMED_SCHEDULE || '0 6 * * *',         // Daily 6 AM
    fda: process.env.FDA_SCHEDULE || '0 7 * * *',               // Daily 7 AM
    clinicaltrials: process.env.TRIALS_SCHEDULE || '0 8 * * *', // Daily 8 AM (was weekly)
    cms: process.env.CMS_SCHEDULE || '0 5 * * 0',               // Weekly Sunday
    embed: process.env.EMBED_SCHEDULE || '0 10 * * *',          // Daily 10 AM
    link: process.env.LINK_SCHEDULE || '0 12 * * 0',            // Weekly Sunday
    monitor: process.env.MONITOR_SCHEDULE || '0 9 * * *',       // Daily 9 AM
    digest: process.env.DIGEST_SCHEDULE || '0 9 * * 1',         // Weekly Monday 9 AM
    dailyReport: process.env.DAILY_REPORT_SCHEDULE || '0 18 * * *', // Daily 6 PM UTC (10 AM PST)
    versionWatch: process.env.VERSION_WATCH_SCHEDULE || '0 12 * * *', // Daily noon
    guidelineScan: process.env.GUIDELINE_SCAN_SCHEDULE || '0 */4 * * *', // Every 4 hours
  },

  // Thresholds
  thresholds: {
    triageMinScore: parseInt(process.env.TRIAGE_MIN_SCORE || '5', 10),
    prefilterMinScore: parseInt(process.env.PREFILTER_MIN_SCORE || '2', 10),
    embeddingSimilarity: parseFloat(process.env.EMBED_SIMILARITY || '0.80'),
  },
};

export default config;
