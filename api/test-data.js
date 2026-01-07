/**
 * Test endpoint for data import
 */
import { mrdTestData } from '../src/data.js';

export default function handler(req, res) {
  res.status(200).json({ 
    success: true, 
    testCount: mrdTestData?.length || 0,
    firstTest: mrdTestData?.[0]?.name || 'none'
  });
}
