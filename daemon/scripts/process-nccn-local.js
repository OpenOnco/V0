#!/usr/bin/env node
/**
 * Process NCCN PDFs locally and output JSON for database import
 *
 * Usage:
 *   node scripts/process-nccn-local.js ../NCCN/
 *   node scripts/process-nccn-local.js ../NCCN/ --upload
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

// Create test directory for pdf-parse bug workaround
const testDir = './test/data';
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(testDir, '05-versions-space.pdf'), '');
}

const MRD_KEYWORDS = [
  'ctDNA', 'circulating tumor DNA', 'cell-free DNA', 'cfDNA',
  'liquid biopsy', 'minimal residual disease', 'molecular residual disease',
  'MRD', 'Signatera', 'Guardant', 'tumor-informed',
];

const CANCER_TYPE_MAP = {
  'colon': 'colorectal', 'rectal': 'colorectal', 'colorectal': 'colorectal',
  'breast': 'breast', 'lung': 'lung_nsclc', 'nsclc': 'lung_nsclc', 'nscl': 'lung_nsclc',
  'bladder': 'bladder', 'melanoma': 'melanoma', 'pancrea': 'pancreatic',
  'gastric': 'gastric', 'esophag': 'esophageal', 'ovarian': 'ovarian',
  'head': 'head_neck', 'neck': 'head_neck',
};

function detectCancerType(filename) {
  const lower = filename.toLowerCase();
  for (const [pattern, type] of Object.entries(CANCER_TYPE_MAP)) {
    if (lower.includes(pattern)) return type;
  }
  return 'unknown';
}

function findRelevantSections(text, windowSize = 2000) {
  const sections = [];
  const lowerText = text.toLowerCase();

  for (const keyword of MRD_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    let startIndex = 0;

    while (true) {
      const index = lowerText.indexOf(lowerKeyword, startIndex);
      if (index === -1) break;

      const windowStart = Math.max(0, index - windowSize / 2);
      const windowEnd = Math.min(text.length, index + windowSize / 2);
      const section = text.slice(windowStart, windowEnd);

      const isOverlapping = sections.some(s => Math.abs(s.index - index) < windowSize / 2);
      if (!isOverlapping) {
        sections.push({ keyword, index, text: section.trim() });
      }
      startIndex = index + keyword.length;
    }
  }

  return sections.sort((a, b) => a.index - b.index);
}

async function extractRecommendations(sections, cancerType) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required');
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const combinedText = sections.map(s => s.text).join('\n\n---\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are extracting ctDNA/MRD recommendations from NCCN guidelines.

For each distinct recommendation, provide:
- recommendation: The specific clinical recommendation (1-2 sentences)
- evidence_category: NCCN category if stated (1, 2A, 2B, or 3)
- clinical_setting: When this applies (e.g., "adjuvant therapy", "surveillance", "metastatic")
- key_quote: Brief supporting quote (max 30 words)

Return ONLY a JSON array. Include all unique ctDNA/liquid biopsy/MRD recommendations.
If no recommendations found, return [].`,
    messages: [{
      role: 'user',
      content: `Extract ctDNA/MRD recommendations from this ${cancerType} cancer NCCN guideline:\n\n${combinedText.slice(0, 15000)}`,
    }],
  });

  const text = response.content[0]?.text || '[]';
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

async function processAllPdfs(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf'));
  console.log(`Processing ${files.length} NCCN PDFs...\n`);

  const allRecommendations = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const cancerType = detectCancerType(file);

    console.log(`\n📄 ${file} (${cancerType})`);

    try {
      const data = fs.readFileSync(filePath);
      const result = await pdf(data);
      console.log(`   Pages: ${result.numpages}, Text: ${result.text.length} chars`);

      const sections = findRelevantSections(result.text);
      console.log(`   Found ${sections.length} MRD-relevant sections`);

      if (sections.length === 0) {
        console.log('   ⚠️  No MRD content found');
        continue;
      }

      const recs = await extractRecommendations(sections, cancerType);
      console.log(`   Extracted ${recs.length} recommendations`);

      for (const rec of recs) {
        allRecommendations.push({
          source_type: 'nccn',
          cancer_type: cancerType,
          filename: file,
          ...rec,
          extracted_at: new Date().toISOString(),
        });
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  return allRecommendations;
}

async function uploadToDatabase(recommendations, daemonUrl) {
  console.log(`\nUploading ${recommendations.length} recommendations to database...`);

  const response = await fetch(`${daemonUrl}/api/import-nccn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crawl-Secret': process.env.CRAWL_SECRET || 'mrd-crawl-2024',
    },
    body: JSON.stringify({ recommendations }),
  });

  const result = await response.json();
  console.log('Upload result:', result);
  return result;
}

// Main
const args = process.argv.slice(2);
const dirPath = args.find(a => !a.startsWith('-')) || '../NCCN';
const shouldUpload = args.includes('--upload');
const daemonUrl = process.env.DAEMON_URL || 'https://daemon-production-5ed1.up.railway.app';

(async () => {
  try {
    const recommendations = await processAllPdfs(dirPath);

    // Save to JSON
    const outputPath = './data/nccn-recommendations.json';
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(recommendations, null, 2));
    console.log(`\n✅ Saved ${recommendations.length} recommendations to ${outputPath}`);

    // Summary by cancer type
    console.log('\n=== Summary by Cancer Type ===');
    const byCancer = {};
    for (const rec of recommendations) {
      byCancer[rec.cancer_type] = (byCancer[rec.cancer_type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(byCancer)) {
      console.log(`  ${type}: ${count} recommendations`);
    }

    if (shouldUpload) {
      await uploadToDatabase(recommendations, daemonUrl);
    } else {
      console.log('\nTo upload to database, run with --upload flag');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
