/**
 * OpenOnco API Root - Redirects to v1 documentation
 */

import { withVercelLogging } from '../shared/logger/index.js';

export default withVercelLogging((req, res) => {
  req.logger.info('API root accessed, redirecting to v1');
  res.setHeader('Location', '/api/v1');
  res.status(302).end();
}, { moduleName: 'api:health' });
