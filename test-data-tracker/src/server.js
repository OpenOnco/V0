/**
 * HTTP Server for Test Data Tracker
 * Provides health endpoint and basic API for daemon status
 *
 * NOTE: MRD Chat API is NOT here - it lives in physician-system/src/chat/server.js
 */

import { createServer } from 'http';
import { createLogger } from './utils/logger.js';
import { getHealthSummary } from './health.js';
import { getQueueStatus } from './queue/index.js';
import { getSchedulerStatus } from './scheduler.js';

const logger = createLogger('server');

const PORT = process.env.PORT || 3001;

let server = null;

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

/**
 * Request handler
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    // Health endpoint
    if (path === '/health' && method === 'GET') {
      const [health, queue, scheduler] = await Promise.all([
        getHealthSummary(),
        getQueueStatus(),
        Promise.resolve(getSchedulerStatus()),
      ]);

      sendJson(res, {
        status: 'ok',
        service: 'test-data-tracker',
        uptime: health.uptime,
        queue: {
          pending: queue.pendingCount,
          total: queue.totalItems,
        },
        scheduler: {
          active: scheduler.activeJobs,
          jobs: scheduler.jobs?.length || 0,
        },
        crawlers: health.crawlers,
        recentErrors: health.recentErrors?.length || 0,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Queue status endpoint
    if (path === '/api/queue' && method === 'GET') {
      const queue = await getQueueStatus();
      sendJson(res, queue);
      return;
    }

    // Scheduler status endpoint
    if (path === '/api/scheduler' && method === 'GET') {
      const scheduler = getSchedulerStatus();
      sendJson(res, scheduler);
      return;
    }

    // 404 for everything else
    sendJson(res, {
      error: 'Not found',
      message: 'This is the test-data-tracker service. MRD Chat API is at physician-system.',
      availableEndpoints: ['/health', '/api/queue', '/api/scheduler'],
    }, 404);

  } catch (error) {
    logger.error('Request error', { path, error: error.message });
    sendJson(res, { error: 'Internal server error', message: error.message }, 500);
  }
}

/**
 * Start the HTTP server
 */
export function startServer() {
  server = createServer(handleRequest);

  server.listen(PORT, () => {
    logger.info(`Test Data Tracker server listening on port ${PORT}`);
    logger.info('Endpoints:');
    logger.info('  GET /health      - Health check');
    logger.info('  GET /api/queue   - Queue status');
    logger.info('  GET /api/scheduler - Scheduler status');
  });

  server.on('error', (error) => {
    logger.error('Server error', { error: error.message });
  });
}

/**
 * Stop the HTTP server
 */
export async function stopServer() {
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        logger.info('Server stopped');
        resolve();
      });
    });
  }
}

export default { startServer, stopServer };
