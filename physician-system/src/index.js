/**
 * OpenOnco Physician System
 * Clinical decision support for MRD testing in solid tumors
 *
 * This service provides:
 * - Clinical evidence aggregation (PubMed, ClinicalTrials.gov, FDA)
 * - Guideline monitoring (NCCN, ASCO, ESMO, SITC)
 * - Payer coverage tracking (Medicare MolDX, commercial payers)
 * - RAG-based chat interface for physician queries
 *
 * Separate from Test Data Tracker - this is a dedicated service for
 * MRD clinical decision support.
 */

import 'dotenv/config';
import { createLogger } from './utils/logger.js';
import { startServer, stopServer } from './chat/server.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import { close as closeDb } from './db/client.js';

const logger = createLogger('physician-system');

// Track service start time
const startTime = new Date();

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);

  try {
    stopScheduler();
    logger.info('Scheduler stopped');

    await stopServer();
    logger.info('HTTP server stopped');

    await closeDb();
    logger.info('Database connection closed');

    // Give time for any in-flight operations
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info('Physician System shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Log service status periodically
 */
function logStatus() {
  const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
  logger.info('Service status', {
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  });
}

/**
 * Main entry point
 */
async function main() {
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('  OpenOnco Physician System');
  logger.info('  Clinical Decision Support for MRD Testing');
  logger.info('═══════════════════════════════════════════════════════════');

  // Log configuration
  logger.info('Configuration loaded', {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    hasDatabase: !!process.env.MRD_DATABASE_URL,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
  });

  // Set up signal handlers for graceful shutdown
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
  });

  try {
    // Start the HTTP server for MRD Chat API
    await startServer();

    // Start the scheduler for automated crawling
    const enableScheduler = process.env.ENABLE_SCHEDULER !== 'false';
    if (enableScheduler) {
      startScheduler();
      logger.info('Scheduler started with cron jobs');
    } else {
      logger.info('Scheduler disabled (ENABLE_SCHEDULER=false)');
    }

    // Log status every hour
    setInterval(logStatus, 60 * 60 * 1000);

    logger.info('Physician System started successfully');
    logger.info('Services running:');
    logger.info('  - MRD Chat API: POST /api/mrd-chat');
    logger.info('  - Health Check: GET /health');
    if (enableScheduler) {
      logger.info('  - Scheduler: Automated crawling enabled');
    }
    logger.info('');
    logger.info('Manual CLI commands:');
    logger.info('  node src/cli.js pubmed        # PubMed literature');
    logger.info('  node src/cli.js clinicaltrials # Clinical trials');
    logger.info('  node src/cli.js embed         # Generate embeddings');

  } catch (error) {
    logger.error('Failed to start Physician System', { error });
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
