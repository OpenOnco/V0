#!/usr/bin/env node
/**
 * Export test data from data.js as JSON for Python eval scripts
 * 
 * Usage: node export_data.js > test_data.json
 */

import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../src/data.js';

const output = {
  MRD: mrdTestData,
  ECD: ecdTestData,
  TRM: trmTestData,
  TDS: tdsTestData
};

console.log(JSON.stringify(output, null, 2));
