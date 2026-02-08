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
import {
  createSubscriber,
  confirmSubscriber,
  unsubscribeByToken,
  getPreferences,
  updatePreferences,
} from './digest/subscribers.js';
import { sendConfirmationEmail } from './email/digest-confirmation.js';
import { listPending } from './proposals/queue.js';

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

    // Proposal stats endpoint (used by physician-system daily report)
    if (path === '/api/proposals/stats' && method === 'GET') {
      try {
        const pending = await listPending();
        const counts = { total: 0, coverage: 0, 'new-tests': 0, updates: 0, 'delegation-changes': 0 };
        for (const p of pending) {
          counts.total++;
          const typeKey = p.type === 'coverage' ? 'coverage'
            : p.type === 'new-test' ? 'new-tests'
            : p.type === 'update' ? 'updates'
            : p.type === 'delegation-change' ? 'delegation-changes'
            : null;
          if (typeKey) counts[typeKey]++;
        }
        sendJson(res, counts);
      } catch (e) {
        logger.error('Failed to get proposal stats', { error: e.message });
        sendJson(res, { total: 0, coverage: 0, 'new-tests': 0, updates: 0, 'delegation-changes': 0 });
      }
      return;
    }

    // --- Digest subscriber API routes ---

    // POST /api/digest/subscribe
    if (path === '/api/digest/subscribe' && method === 'POST') {
      const body = await parseBody(req);
      const { email, cancerTypes, contentTypes, name, institution, digestType } = body;

      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(res, { success: false, error: 'Valid email is required' }, 400);
        return;
      }

      try {
        const subscriber = await createSubscriber({ email: email.toLowerCase().trim(), cancerTypes, contentTypes, name, institution, digestType });
        // Send confirmation email (don't block response on email delivery)
        sendConfirmationEmail({ email: subscriber.email, confirmationToken: subscriber.confirmation_token, name })
          .catch(err => logger.error('Failed to send confirmation email', { error: err.message }));
        sendJson(res, { success: true, message: 'Check your email to confirm your subscription.' });
      } catch (error) {
        logger.error('Subscribe error', { error: error.message });
        sendJson(res, { success: false, error: 'Failed to subscribe' }, 500);
      }
      return;
    }

    // POST /api/digest/confirm
    if (path === '/api/digest/confirm' && method === 'POST') {
      const body = await parseBody(req);
      const { token } = body;

      if (!token) {
        sendJson(res, { success: false, error: 'Token is required' }, 400);
        return;
      }

      try {
        const result = await confirmSubscriber(token);
        if (!result) {
          sendJson(res, { success: false, error: 'Invalid or expired token' }, 404);
          return;
        }
        sendJson(res, { success: true, email: result.email });
      } catch (error) {
        logger.error('Confirm error', { error: error.message });
        sendJson(res, { success: false, error: 'Failed to confirm' }, 500);
      }
      return;
    }

    // GET /api/digest/unsubscribe?token=
    if (path === '/api/digest/unsubscribe' && method === 'GET') {
      const token = url.searchParams.get('token');

      if (!token) {
        sendJson(res, { success: false, error: 'Token is required' }, 400);
        return;
      }

      try {
        const result = await unsubscribeByToken(token);
        sendJson(res, {
          success: true,
          message: result ? 'You have been unsubscribed.' : 'Already unsubscribed or invalid token.',
        });
      } catch (error) {
        logger.error('Unsubscribe error', { error: error.message });
        sendJson(res, { success: false, error: 'Failed to unsubscribe' }, 500);
      }
      return;
    }

    // GET /api/digest/preferences?token=
    if (path === '/api/digest/preferences' && method === 'GET') {
      const token = url.searchParams.get('token');

      if (!token) {
        sendJson(res, { success: false, error: 'Token is required' }, 400);
        return;
      }

      try {
        const prefs = await getPreferences(token);
        if (!prefs) {
          sendJson(res, { success: false, error: 'Subscriber not found' }, 404);
          return;
        }
        sendJson(res, { success: true, preferences: prefs });
      } catch (error) {
        logger.error('Get preferences error', { error: error.message });
        sendJson(res, { success: false, error: 'Failed to get preferences' }, 500);
      }
      return;
    }

    // POST /api/digest/preferences
    if (path === '/api/digest/preferences' && method === 'POST') {
      const body = await parseBody(req);
      const { token, cancerTypes, contentTypes, frequency, name, institution } = body;

      if (!token) {
        sendJson(res, { success: false, error: 'Token is required' }, 400);
        return;
      }

      try {
        const result = await updatePreferences(token, { cancerTypes, contentTypes, frequency, name, institution });
        if (!result) {
          sendJson(res, { success: false, error: 'Subscriber not found or inactive' }, 404);
          return;
        }
        sendJson(res, { success: true, preferences: result });
      } catch (error) {
        logger.error('Update preferences error', { error: error.message });
        sendJson(res, { success: false, error: 'Failed to update preferences' }, 500);
      }
      return;
    }

    // 404 for everything else
    sendJson(res, {
      error: 'Not found',
      message: 'This is the test-data-tracker service. MRD Chat API is at physician-system.',
      availableEndpoints: ['/health', '/api/queue', '/api/scheduler', '/api/proposals/stats', '/api/digest/subscribe', '/api/digest/confirm', '/api/digest/unsubscribe', '/api/digest/preferences'],
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
    logger.info('  GET  /health                  - Health check');
    logger.info('  GET  /api/queue               - Queue status');
    logger.info('  GET  /api/scheduler            - Scheduler status');
    logger.info('  POST /api/digest/subscribe     - Subscribe to digest');
    logger.info('  POST /api/digest/confirm       - Confirm subscription');
    logger.info('  GET  /api/digest/unsubscribe   - Unsubscribe');
    logger.info('  GET  /api/digest/preferences   - Get preferences');
    logger.info('  POST /api/digest/preferences   - Update preferences');
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
