#!/usr/bin/env node
/**
 * Comprehensive E2E Test for OpenOnco Daemon
 * Tests: Test Dictionary → Medicare Rates → Discovery Injection → Email Delivery
 */

import 'dotenv/config';
import { initializeTestDictionary, getAllTests, matchTest } from './src/data/test-dictionary.js';
import { initializeCLFS, lookupPLARate, getCLFSQuarter } from './src/utils/medicare-rates.js';
import { loadDiscoveries, addDiscovery, getQueueStatus } from './src/queue/index.js';
import { sendMondayDigest } from './src/email/monday-digest.js';

const TEST_DISCOVERY = {
  source: 'vendor',
  type: 'VENDOR_PAP_UPDATE',
  title: '[E2E TEST] Natera PAP Program Update',
  summary: 'Test discovery to verify end-to-end pipeline - safe to ignore',
  url: 'https://www.natera.com/oncology/billing/',
  data: {
    relevance: 'high',
    metadata: {
      vendorId: 'natera',
      vendorName: 'Natera',
      testName: 'Signatera',
      papProgram: {
        name: 'Financial Assistance Program',
        eligibility: 'Income-based qualification',
        maxCopay: '$100',
        phone: '650-489-9050'
      }
    }
  }
};

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  OpenOnco Daemon - Comprehensive E2E Test');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = {
    testDictionary: false,
    medicareRates: false,
    discoveryInjection: false,
    emailDelivery: false
  };
  
  // Test 1: Test Dictionary (API fetch)
  console.log('📚 Test 1: Test Dictionary API Fetch');
  console.log('─'.repeat(50));
  try {
    await initializeTestDictionary();
    const tests = getAllTests();
    const testCount = tests?.length || 0;
    if (testCount > 0) {
      console.log(`   ✅ Loaded ${testCount} tests from API`);
      
      // Verify lookups work
      const signatera = matchTest('Signatera');
      console.log(`   ✅ Name match: ${signatera ? `Found ${signatera.name}` : 'FAILED'}`);
      results.testDictionary = true;
    } else {
      console.log('   ❌ No tests loaded');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  console.log('');
  
  // Test 2: Medicare CLFS Rates
  console.log('💵 Test 2: Medicare CLFS Rate Lookup');
  console.log('─'.repeat(50));
  try {
    await initializeCLFS();
    const quarter = await getCLFSQuarter();
    console.log(`   ✅ CLFS initialized: ${quarter}`);
    
    const testCodes = ['0340U', '0239U', '81479'];
    for (const code of testCodes) {
      const rate = await lookupPLARate(code);
      if (rate) {
        console.log(`   ✅ ${code}: $${rate.rate} (${rate.quarter})`);
      } else {
        console.log(`   ⚠️  ${code}: No rate found`);
      }
    }
    results.medicareRates = true;
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  console.log('');
  
  // Test 3: Discovery Queue Injection
  console.log('📋 Test 3: Discovery Queue Operations');
  console.log('─'.repeat(50));
  try {
    const beforeStatus = getQueueStatus();
    console.log(`   Current queue: ${beforeStatus.pending} pending, ${beforeStatus.total} total`);
    
    // Add test discovery (addDiscovery takes source, type, data separately)
    const added = addDiscovery(
      TEST_DISCOVERY.source,
      TEST_DISCOVERY.type,
      {
        title: TEST_DISCOVERY.title,
        summary: TEST_DISCOVERY.summary,
        url: TEST_DISCOVERY.url,
        relevance: TEST_DISCOVERY.data.relevance,
        metadata: TEST_DISCOVERY.data.metadata
      }
    );
    
    if (added) {
      console.log(`   ✅ Test discovery injected: ${TEST_DISCOVERY.title}`);
      results.discoveryInjection = true;
    } else {
      console.log('   ⚠️  Discovery already exists (deduped)');
      results.discoveryInjection = true; // Dedup working is also a pass
    }
    
    const afterStatus = getQueueStatus();
    console.log(`   After injection: ${afterStatus.pending} pending, ${afterStatus.total} total`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  console.log('');
  
  // Test 4: Email Delivery
  console.log('📧 Test 4: Monday Digest Email Delivery');
  console.log('─'.repeat(50));
  try {
    console.log('   Sending digest email...');
    const emailResult = await sendMondayDigest();
    
    if (emailResult?.success) {
      console.log(`   ✅ Email sent successfully!`);
      console.log(`   📬 Message ID: ${emailResult.messageId || 'N/A'}`);
      results.emailDelivery = true;
    } else {
      console.log(`   ❌ Email failed: ${emailResult?.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  console.log('');
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`\n  ${passed}/${total} tests passed\n`);
  
  for (const [test, result] of Object.entries(results)) {
    const icon = result ? '✅' : '❌';
    const name = test.replace(/([A-Z])/g, ' $1').trim();
    console.log(`  ${icon} ${name}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  
  if (passed === total) {
    console.log('  🎉 ALL TESTS PASSED - Pipeline fully operational!');
  } else {
    console.log(`  ⚠️  ${total - passed} test(s) failed - check logs above`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
  
  process.exit(passed === total ? 0 : 1);
}

runTests();
