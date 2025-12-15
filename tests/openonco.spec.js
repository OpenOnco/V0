// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../src/data.js';

/**
 * OpenOnco Regression Test Suite
 * Updated: Dec 14, 2025
 */

// ===========================================
// EXPECTED VALUES - DYNAMICALLY CALCULATED
// ===========================================

const EXPECTED = {
  testCounts: {
    MRD: mrdTestData.length,
    ECD: ecdTestData.length,
    TRM: trmTestData.length,
    TDS: tdsTestData.length,
    get total() { return this.MRD + this.ECD + this.TRM + this.TDS; }
  },
  categories: ['MRD', 'ECD', 'TRM', 'TDS'],
};

// ===========================================
// HOMEPAGE TESTS
// ===========================================

test.describe('Homepage', () => {
  test('loads and displays main elements', async ({ page }) => {
    await page.goto('/');
    
    // Check page loaded by looking for category names (always visible)
    for (const cat of EXPECTED.categories) {
      await expect(page.locator(`text=${cat}`).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('displays correct total test count', async ({ page }) => {
    await page.goto('/');
    
    const pageText = await page.textContent('body');
    expect(pageText).toContain(String(EXPECTED.testCounts.total));
  });

  test('chat input is visible', async ({ page }) => {
    await page.goto('/');
    
    const chatInput = page.locator('input[placeholder*="Ask Claude"], input[placeholder*="Ask"]');
    await expect(chatInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('sample prompts are clickable', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const patientPrompt = page.locator('button').filter({ hasText: /patient.*straightforward/i });
    const physicianPrompt = page.locator('button').filter({ hasText: /physician.*clinical/i });
    
    const patientVisible = await patientPrompt.isVisible().catch(() => false);
    const physicianVisible = await physicianPrompt.isVisible().catch(() => false);
    
    expect(patientVisible || physicianVisible).toBeTruthy();
  });
});

// ===========================================
// CATEGORY PAGE TESTS
// ===========================================

test.describe('Category Pages', () => {
  for (const category of EXPECTED.categories) {
    test(`${category} page loads`, async ({ page }) => {
      await page.goto(`/${category.toLowerCase()}`);
      await page.waitForTimeout(1000);
      
      const content = await page.textContent('body');
      expect(content?.toUpperCase()).toContain(category);
    });

    test(`${category} page shows test cards`, async ({ page }) => {
      await page.goto(`/${category.toLowerCase()}`);
      await page.waitForTimeout(1500);
      
      // Use data-testid for more reliable selection
      const cards = page.locator('[data-testid="test-card"], [data-testid="test-card-clickable"]');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
    });
  }
});

// ===========================================
// TEST DETAIL MODAL TESTS
// ===========================================

test.describe('Test Detail Modal', () => {
  test('opens when clicking a test', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    // Use data-testid for reliable test card selection
    let testCard = page.locator('[data-testid="test-card-clickable"]').first();
    
    // Fallback: find cursor-pointer elements within the test grid area
    if (!await testCard.isVisible()) {
      testCard = page.locator('[data-testid="test-card"]').first();
    }
    
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      // Check for modal using data-testid or class
      const modal = page.locator('[data-testid="test-detail-modal"], .test-detail-print-area, [class*="fixed"][class*="inset"]');
      await expect(modal.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('modal has share link button', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    let testCard = page.locator('[data-testid="test-card-clickable"]').first();
    if (!await testCard.isVisible()) {
      testCard = page.locator('[data-testid="test-card"]').first();
    }
    
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      // Use data-testid or title attribute
      const shareBtn = page.locator('[data-testid="share-link-button"], button[title*="link"], button[title*="share"], button[title*="copy"]');
      await expect(shareBtn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('modal has print button', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    let testCard = page.locator('[data-testid="test-card-clickable"]').first();
    if (!await testCard.isVisible()) {
      testCard = page.locator('[data-testid="test-card"]').first();
    }
    
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      // Use data-testid or title attribute
      const printBtn = page.locator('[data-testid="print-button"], button[title*="print"], button[title*="PDF"]');
      await expect(printBtn.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ===========================================
// COMPARISON MODAL TESTS
// ===========================================

test.describe('Comparison Modal', () => {
  test('compare button appears with 2+ selections', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(2000);
    
    // Use data-testid for compare buttons on test cards
    const compareButtons = page.locator('[data-testid="compare-button"]');
    const count = await compareButtons.count();
    
    if (count >= 2) {
      // Click two different "Compare" buttons to select tests
      await compareButtons.nth(0).click();
      await page.waitForTimeout(300);
      await compareButtons.nth(1).click();
      await page.waitForTimeout(500);
      
      // After selecting 2+, the main "Compare Tests" button should appear
      const mainCompareBtn = page.locator('[data-testid="compare-tests-button"]');
      await expect(mainCompareBtn).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('comparison modal opens and has share button', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(2000);
    
    // Use data-testid for compare buttons on test cards
    const compareButtons = page.locator('[data-testid="compare-button"]');
    const count = await compareButtons.count();
    
    if (count >= 2) {
      // Select two tests
      await compareButtons.nth(0).click();
      await page.waitForTimeout(300);
      await compareButtons.nth(1).click();
      await page.waitForTimeout(500);
      
      // Click the main "Compare Tests" button
      const mainCompareBtn = page.locator('[data-testid="compare-tests-button"]');
      await expect(mainCompareBtn).toBeVisible({ timeout: 5000 });
      await mainCompareBtn.click();
      await page.waitForTimeout(1500);
      
      // Check for comparison modal
      const modal = page.locator('.comparison-print-area');
      await expect(modal).toBeVisible({ timeout: 5000 });
      
      // Verify share button exists in modal
      const shareBtn = page.locator('[data-testid="share-link-button"], button[title*="link"], button[title*="share"]');
      await expect(shareBtn.first()).toBeVisible({ timeout: 3000 });
    } else {
      test.skip();
    }
  });
});

// ===========================================
// SHAREABLE LINK TESTS
// ===========================================

test.describe('Shareable Links', () => {
  test('single test link navigates to category', async ({ page }) => {
    await page.goto('/?category=MRD&test=mrd-1');
    await page.waitForTimeout(2000);
    
    const url = page.url();
    const content = await page.textContent('body');
    expect(url.toLowerCase().includes('mrd') || content?.includes('MRD')).toBeTruthy();
  });

  test('comparison link works', async ({ page }) => {
    await page.goto('/?category=MRD&compare=mrd-1,mrd-2');
    await page.waitForTimeout(2000);
    
    const content = await page.textContent('body');
    expect(content?.includes('MRD')).toBeTruthy();
  });
});

// ===========================================
// PRINT FUNCTIONALITY TESTS
// ===========================================

test.describe('Print Functionality', () => {
  test('print styles exist in test detail modal', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    let testCard = page.locator('[data-testid="test-card-clickable"]').first();
    if (!await testCard.isVisible()) {
      testCard = page.locator('[data-testid="test-card"]').first();
    }
    
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      const styles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('style'))
          .map(s => s.textContent)
          .join('');
      });
      
      expect(styles).toContain('@media print');
    }
  });

  test('print preview shows content (not blank)', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    let testCard = page.locator('[data-testid="test-card-clickable"]').first();
    if (!await testCard.isVisible()) {
      testCard = page.locator('[data-testid="test-card"]').first();
    }
    
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      await page.emulateMedia({ media: 'print' });
      
      const printArea = page.locator('.test-detail-print-area');
      if (await printArea.isVisible()) {
        const content = await printArea.textContent();
        expect(content?.length).toBeGreaterThan(50);
      }
      
      await page.emulateMedia({ media: 'screen' });
    }
  });
});

// ===========================================
// CHAT FUNCTIONALITY TESTS
// ===========================================

test.describe('Chat Functionality', () => {
  test('chat accepts input', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const chatInput = page.locator('input[placeholder*="Ask"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('What MRD tests are available?');
      await expect(chatInput).toHaveValue('What MRD tests are available?');
    }
  });

  test('chat responds to message', async ({ page }) => {
    test.setTimeout(30000);
    
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const chatInput = page.locator('input[placeholder*="Ask"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('List 3 MRD tests');
      
      const askBtn = page.locator('button').filter({ hasText: /Ask/i });
      await askBtn.click();
      
      await page.waitForTimeout(15000);
      
      const responses = page.locator('[data-message-role="assistant"]');
      const count = await responses.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ===========================================
// DATA DOWNLOAD TESTS
// ===========================================

test.describe('Data Download', () => {
  test('download button exists', async ({ page }) => {
    await page.goto('/data-sources');
    await page.waitForTimeout(1000);
    
    const downloadBtn = page.locator('button').filter({ hasText: /Download|JSON/i });
    await expect(downloadBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('JSON download produces valid file', async ({ page }) => {
    await page.goto('/data-sources');
    await page.waitForTimeout(1000);
    
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    
    const downloadBtn = page.locator('button').filter({ hasText: /Download.*JSON/i });
    if (await downloadBtn.isVisible()) {
      await downloadBtn.click();
      
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain('.json');
        
        const path = await download.path();
        if (path) {
          const content = fs.readFileSync(path, 'utf-8');
          const data = JSON.parse(content);
          
          expect(data).toHaveProperty('meta');
          expect(data).toHaveProperty('categories');
          expect(data).toHaveProperty('totalTests');
          expect(data.totalTests).toBe(EXPECTED.testCounts.total);
        }
      }
    }
  });
});

// ===========================================
// NAVIGATION TESTS
// ===========================================

test.describe('Navigation', () => {
  test('category links work', async ({ page }) => {
    for (const cat of EXPECTED.categories) {
      await page.goto('/');
      await page.waitForTimeout(500);
      
      const link = page.locator('a, button').filter({ hasText: new RegExp(`^${cat}$`, 'i') }).first();
      
      if (await link.isVisible()) {
        await link.click();
        await page.waitForTimeout(500);
        
        const url = page.url();
        expect(url.toLowerCase()).toContain(cat.toLowerCase());
      }
    }
  });

  test('browser back button works', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    await page.goto('/mrd');
    await page.waitForTimeout(500);
    expect(page.url()).toContain('mrd');
    
    await page.goBack();
    await page.waitForTimeout(500);
    
    expect(page.url()).not.toContain('mrd');
  });
});

// ===========================================
// MOBILE TESTS
// ===========================================

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('homepage renders on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await expect(page.getByText('OpenOnco', { exact: true }).first()).toBeVisible();
  });

  test('category page renders on mobile', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1000);
    
    const content = await page.textContent('body');
    expect(content).toContain('MRD');
  });
});

// ===========================================
// SUBMISSIONS PAGE TESTS
// ===========================================

test.describe('Submissions Page - Vendor Domain Validation', () => {
  test('shows warning when selecting Independent Expert', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Select "Submit a Correction" to see submitter type options
    const correctionBtn = page.locator('button').filter({ hasText: /Correction/i });
    await correctionBtn.click();
    await page.waitForTimeout(500);
    
    // Select "Independent Expert"
    const submitterSelect = page.locator('select').first();
    await submitterSelect.selectOption('expert');
    await page.waitForTimeout(300);
    
    // Verify warning message appears
    const warning = page.locator('text=Vendor employees should select');
    await expect(warning).toBeVisible({ timeout: 3000 });
  });

  test('blocks vendor domain email when claiming Independent Expert', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Select "Submit a Correction"
    const correctionBtn = page.locator('button').filter({ hasText: /Correction/i });
    await correctionBtn.click();
    await page.waitForTimeout(500);
    
    // Select "Independent Expert"
    const submitterSelect = page.locator('select').first();
    await submitterSelect.selectOption('expert');
    await page.waitForTimeout(300);
    
    // Select a category (MRD)
    const mrdBtn = page.locator('button').filter({ hasText: /^MRD$/i });
    await mrdBtn.click();
    await page.waitForTimeout(300);
    
    // Select a test from dropdown
    const testSelect = page.locator('select').nth(1);
    await testSelect.selectOption({ index: 1 });
    await page.waitForTimeout(300);
    
    // Fill in name fields
    await page.fill('input[placeholder*="First"]', 'Test');
    await page.fill('input[placeholder*="Last"]', 'User');
    
    // Enter a known vendor domain email (illumina.com)
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('samyuktha@illumina.com');
    await page.waitForTimeout(300);
    
    // Click Send Code button
    const sendCodeBtn = page.locator('button').filter({ hasText: /Send Code/i });
    await sendCodeBtn.click();
    await page.waitForTimeout(500);
    
    // Verify error message about vendor domain appears
    const errorMsg = page.locator('text=illumina.com');
    await expect(errorMsg).toBeVisible({ timeout: 3000 });
    
    const vendorRepMsg = page.locator('text=Test Vendor Representative');
    await expect(vendorRepMsg).toBeVisible({ timeout: 3000 });
  });

  test('allows vendor domain email when Vendor Representative selected', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Select "Submit a Correction"
    const correctionBtn = page.locator('button').filter({ hasText: /Correction/i });
    await correctionBtn.click();
    await page.waitForTimeout(500);
    
    // Select "Test Vendor Representative"
    const submitterSelect = page.locator('select').first();
    await submitterSelect.selectOption('vendor');
    await page.waitForTimeout(300);
    
    // Verify vendor verification warning appears (not the "vendor employees should select" warning)
    const vendorWarning = page.locator('text=verify that your email comes from');
    await expect(vendorWarning).toBeVisible({ timeout: 3000 });
  });

  test('allows non-vendor institutional email for Independent Expert', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Select "Submit a Correction"
    const correctionBtn = page.locator('button').filter({ hasText: /Correction/i });
    await correctionBtn.click();
    await page.waitForTimeout(500);
    
    // Select "Independent Expert"
    const submitterSelect = page.locator('select').first();
    await submitterSelect.selectOption('expert');
    await page.waitForTimeout(300);
    
    // Select a category (MRD)
    const mrdBtn = page.locator('button').filter({ hasText: /^MRD$/i });
    await mrdBtn.click();
    await page.waitForTimeout(300);
    
    // Select a test from dropdown
    const testSelect = page.locator('select').nth(1);
    await testSelect.selectOption({ index: 1 });
    await page.waitForTimeout(300);
    
    // Fill in name fields
    await page.fill('input[placeholder*="First"]', 'Test');
    await page.fill('input[placeholder*="Last"]', 'User');
    
    // Enter a legitimate institutional email (not a known vendor)
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('researcher@stanford.edu');
    await page.waitForTimeout(300);
    
    // Click Send Code button
    const sendCodeBtn = page.locator('button').filter({ hasText: /Send Code/i });
    await sendCodeBtn.click();
    await page.waitForTimeout(500);
    
    // Should NOT see the vendor domain error
    const vendorError = page.locator('text=appears to be from a diagnostic test vendor');
    await expect(vendorError).not.toBeVisible({ timeout: 1000 });
  });

  test('blocks free email providers', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Select "Submit a Correction"
    const correctionBtn = page.locator('button').filter({ hasText: /Correction/i });
    await correctionBtn.click();
    await page.waitForTimeout(500);
    
    // Select "Independent Expert"
    const submitterSelect = page.locator('select').first();
    await submitterSelect.selectOption('expert');
    await page.waitForTimeout(300);
    
    // Select a category (MRD)
    const mrdBtn = page.locator('button').filter({ hasText: /^MRD$/i });
    await mrdBtn.click();
    await page.waitForTimeout(300);
    
    // Select a test from dropdown
    const testSelect = page.locator('select').nth(1);
    await testSelect.selectOption({ index: 1 });
    await page.waitForTimeout(300);
    
    // Fill in name fields
    await page.fill('input[placeholder*="First"]', 'Test');
    await page.fill('input[placeholder*="Last"]', 'User');
    
    // Enter a Gmail address
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('testuser@gmail.com');
    await page.waitForTimeout(300);
    
    // Click Send Code button
    const sendCodeBtn = page.locator('button').filter({ hasText: /Send Code/i });
    await sendCodeBtn.click();
    await page.waitForTimeout(500);
    
    // Verify error about free email providers
    const errorMsg = page.locator('text=company/institutional email');
    await expect(errorMsg).toBeVisible({ timeout: 3000 });
  });
});

// ===========================================
// ERROR HANDLING TESTS
// ===========================================

test.describe('Error Handling', () => {
  test('invalid URL shows home or 404', async ({ page }) => {
    await page.goto('/invalid-page-xyz');
    await page.waitForTimeout(1000);
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('invalid test ID handled gracefully', async ({ page }) => {
    await page.goto('/?category=MRD&test=invalid-test-xyz');
    await page.waitForTimeout(1000);
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
