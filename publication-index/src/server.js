#!/usr/bin/env node

/**
 * Publication Index Server
 *
 * Entry point for Railway deployment. Starts the scheduler and keeps running.
 * Also provides a health check endpoint.
 */

import 'dotenv/config';
import http from 'http';
import { startScheduler, stopScheduler, getSchedulerStatus, runWithNotification } from './scheduler.js';
import { getPublicationSourceStatus } from './index.js';
import { createLogger } from '../../test-data-tracker/src/utils/logger.js';

const logger = createLogger('pubindex-server');

const PORT = process.env.PORT || 3002;

/**
 * Health check HTTP server
 */
const server = http.createServer(async (req, res) => {
  if (req.url === '/health' || req.url === '/') {
    try {
      const schedulerStatus = getSchedulerStatus();
      const sourceStatus = await getPublicationSourceStatus();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'publication-index',
        scheduler: schedulerStatus,
        sources: {
          total: sourceStatus.total,
          needsCheck: sourceStatus.needsCheck,
        },
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      }));
    }
  } else if (req.url === '/trigger' && req.method === 'POST') {
    // Manual trigger endpoint
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Crawl triggered' }));

    // Run in background
    runWithNotification().catch(err => {
      logger.error('Triggered crawl failed', { error: err.message });
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

/**
 * Graceful shutdown
 */
function shutdown() {
  logger.info('Shutting down...');
  stopScheduler();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/**
 * Start server
 */
async function main() {
  logger.info('Starting Publication Index service');

  // Start scheduler
  startScheduler();

  // Start health check server
  server.listen(PORT, () => {
    logger.info(`Health check server listening on port ${PORT}`);
  });

  logger.info('Publication Index service started', {
    port: PORT,
    schedule: process.env.PUBINDEX_SCHEDULE || '0 21 * * 0',
  });
}

main().catch(error => {
  logger.error('Failed to start service', { error: error.message });
  process.exit(1);
});
