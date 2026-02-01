/**
 * Proposals Module
 *
 * Exports the proposal queue system for managing suggested changes
 * to test data that require human review.
 */

export * from './schema.js';
export * from './queue.js';

import queue from './queue.js';
import schema from './schema.js';

export default {
  ...queue,
  ...schema,
};
