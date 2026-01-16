/**
 * OpenOnco Intelligence Daemon
 * Main entry point
 *
 * This daemon runs background tasks for intelligence gathering:
 * - Crawls PubMed for relevant publications (daily)
 * - Monitors CMS for coverage updates (weekly)
 * - Tracks FDA approvals and guidance (weekly)
 * - Watches vendor websites for updates (weekly)
 * - Sends daily digest emails with discoveries and health status
 *
 * All discoveries go to a queue for human review - nothing is auto-updated.
 */

import { createLogger } from './utils/logger.js';
import { startScheduler, stopScheduler, getSchedulerStatus } from './scheduler.js';
import { getQueueStatus } from './queue/index.js';
import { getHealthSummary } from './health.js';

const logger = createLogger('main');

// Track daemon start time
const startTime = new Date();

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);

  try {
    stopScheduler();
    logger.info('Scheduler stopped');

    // Give time for any in-flight operations
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info('Daemon shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Log daemon status periodically
 */
function logStatus() {
  const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const status = getSchedulerStatus();

  logger.info('Daemon status', {
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    activeJobs: status.activeJobs,
    memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  });
}

/**
 * Main entry point
 */
async function main() {
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('  OpenOnco Intelligence Daemon');
  logger.info('  Starting up...');
  logger.info('═══════════════════════════════════════════════════════════');

  // Log configuration
  logger.info('Configuration loaded', {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    emailConfigured: !!process.env.RESEND_API_KEY,
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
    // Start the scheduler
    startScheduler();

    // Log initial status
    const queueStatus = await getQueueStatus();
    logger.info('Queue status', {
      pendingItems: queueStatus.pendingCount,
      totalItems: queueStatus.totalItems,
    });

    // Log status every hour
    setInterval(logStatus, 60 * 60 * 1000);

    logger.info('Daemon started successfully');
    logger.info('Schedules:', {
      pubmed: 'Daily at 6:00 AM',
      cms: 'Weekly on Sunday at 7:00 AM',
      fda: 'Weekly on Sunday at 8:00 AM',
      vendor: 'Weekly on Sunday at 9:00 AM',
      digest: 'Daily at 10:00 AM',
    });

  } catch (error) {
    logger.error('Failed to start daemon', { error });
    process.exit(1);
  }
}

// Start the daemon
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
