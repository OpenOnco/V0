/**
 * Shared data exports for API endpoints
 * Re-exports data from src/data.js for use by serverless functions
 */

// Note: trmTestData is empty (merged into mrdTestData), tdsTestData is alias for cgpTestData
export { mrdTestData, ecdTestData, cgpTestData, hctTestData, trmTestData, tdsTestData } from '../src/data.js';
