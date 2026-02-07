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
import { initializeTestDictionary } from './data/test-dictionary.js';
import { initializeCLFS } from './utils/medicare-rates.js';
import { startServer, stopServer } from './server.js';

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

    await stopServer();
    logger.info('HTTP server stopped');

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
    // Initialize test dictionary (fetch from API)
    logger.info('Initializing test dictionary...');
    try {
      await initializeTestDictionary();
      logger.info('Test dictionary initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize test dictionary', { error: error.message });
      logger.warn('Daemon will continue with degraded functionality (no test matching)');
    }

    // Initialize CLFS Medicare rates
    logger.info('Initializing CLFS Medicare rates...');
    try {
      await initializeCLFS();
      logger.info('CLFS Medicare rates initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CLFS rates', { error: error.message });
      logger.warn('Daemon will continue with degraded functionality (no rate lookups)');
    }

    // Start the scheduler
    startScheduler();

    // Start the HTTP server for health checks
    startServer();

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
      cms: 'Sunday 11:00 PM',
      vendor: 'Sunday 11:00 PM',
      payers: 'Sunday 11:30 PM',
      digest: 'Monday 1:00 AM',
      cleanup: 'Daily midnight',
    });

  } catch (error) {
    logger.error('Failed to start daemon', { error });
    process.exit(1);
  }
}

// CLI command handling (e.g., node src/index.js digest:preview)
const cliCommand = process.argv[2];
if (cliCommand?.startsWith('digest:')) {
  import('./digest/send-weekly.js').then(async (mod) => {
    try {
      if (cliCommand === 'digest:preview') {
        const result = await mod.generateDraft();
        console.log('Draft result:', JSON.stringify(result, null, 2));
      } else if (cliCommand === 'digest:send') {
        const digestId = process.argv[3] ? parseInt(process.argv[3], 10) : null;
        const result = await mod.sendApprovedDigest(digestId);
        console.log('Send result:', JSON.stringify(result, null, 2));
      } else {
        console.error(`Unknown digest command: ${cliCommand}`);
        console.log('Available: digest:preview, digest:send [digestId]');
      }
    } catch (error) {
      console.error('Command failed:', error.message);
    }
    process.exit(0);
  });
} else {
  // Start the daemon
  main().catch((error) => {
    logger.error('Fatal error', { error });
    process.exit(1);
  });
}
