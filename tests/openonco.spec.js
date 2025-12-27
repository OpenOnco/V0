// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../src/data.js';

/**
 * OpenOnco Regression Test Suite
 * Updated: Dec 24, 2025
 */

// ===========================================
// GLOBAL SETUP - Set default persona for all tests
// ===========================================

// Set R&D persona by default so tests don't get blocked by PersonaGate modal
test.beforeEach(async ({ page }) => {
  // Go to page and set localStorage before actual test navigation
  await page.goto('/');
  await page.evaluate(() => {
    if (!localStorage.getItem('openonco-persona')) {
      localStorage.setItem('openonco-persona', 'rnd');
    }
  });
});

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
    
    // Check if we're on Vercel login page instead of the app
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Login') && pageContent?.includes('Vercel')) {
      throw new Error('Preview URL is showing Vercel login page instead of OpenOnco app. The deployment may be private or not fully propagated.');
    }
    
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
    // Chat should be visible in all personas now
    await page.goto('/');
    await page.waitForTimeout(500);
    
    const chatInput = page.locator('input[placeholder*="Ask"], input[placeholder*="ask"], input[placeholder*="Type"]');
    await expect(chatInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('sample prompts are clickable', async ({ page }) => {
    // Sample prompts should be visible in all personas
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Check for sample prompts across all personas
    // R&D prompts (new)
    const cfDnaPrompt = page.locator('button').filter({ hasText: /cfDNA input/i });
    const fdaBreakthroughPrompt = page.locator('button').filter({ hasText: /FDA breakthrough/i });
    const signatera = page.locator('button').filter({ hasText: /Signatera/i });
    // Medical prompts (new)
    const landmarkSensitivity = page.locator('button').filter({ hasText: /landmark sensitivity/i });
    const interventionalTrial = page.locator('button').filter({ hasText: /interventional trial/i });
    const nccnReferenced = page.locator('button').filter({ hasText: /NCCN-referenced/i });
    // Patient prompts (new)
    const tumorInformedNaive = page.locator('button').filter({ hasText: /tumor-informed.*tumor-naive/i });
    const medicarePrompt = page.locator('button').filter({ hasText: /Medicare coverage/i });
    const colonCancerPrompt = page.locator('button').filter({ hasText: /colon cancer/i });
    
    const cfDnaVisible = await cfDnaPrompt.isVisible().catch(() => false);
    const fdaBreakthroughVisible = await fdaBreakthroughPrompt.isVisible().catch(() => false);
    const signateraVisible = await signatera.isVisible().catch(() => false);
    const landmarkVisible = await landmarkSensitivity.isVisible().catch(() => false);
    const interventionalVisible = await interventionalTrial.isVisible().catch(() => false);
    const nccnVisible = await nccnReferenced.isVisible().catch(() => false);
    const tumorInformedNaiveVisible = await tumorInformedNaive.isVisible().catch(() => false);
    const medicareVisible = await medicarePrompt.isVisible().catch(() => false);
    const colonVisible = await colonCancerPrompt.isVisible().catch(() => false);
    
    // At least one sample prompt should be visible (any persona)
    expect(cfDnaVisible || fdaBreakthroughVisible || signateraVisible || landmarkVisible || interventionalVisible || nccnVisible || tumorInformedNaiveVisible || medicareVisible || colonVisible).toBeTruthy();
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
// FILTER FUNCTIONALITY TESTS
// ===========================================

test.describe('Filter Functionality', () => {
  test('cancer type filter reduces visible tests', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(2000);
    
    // Count initial cards
    const initialCards = page.locator('[data-testid="test-card"]');
    const initialCount = await initialCards.count();
    
    // Find and click a cancer type filter button (e.g., "Colorectal" or "CRC")
    const filterButton = page.locator('button').filter({ hasText: /Colorectal|CRC/i }).first();
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(1000);
      
      // Count cards after filter
      const filteredCards = page.locator('[data-testid="test-card"]');
      const filteredCount = await filteredCards.count();
      
      // Filtered count should be less than or equal to initial (filter applied)
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
      expect(filteredCount).toBeGreaterThan(0);
    } else {
      // If no filter button visible, skip gracefully
      test.skip();
    }
  });

  test('search filter works', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(2000);
    
    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    
    if (await searchInput.isVisible()) {
      // Search for a known test name
      await searchInput.fill('Signatera');
      await page.waitForTimeout(1000);
      
      // Should still have at least one result
      const cards = page.locator('[data-testid="test-card"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      
      // The visible card should contain "Signatera"
      const cardText = await cards.first().textContent();
      expect(cardText?.toLowerCase()).toContain('signatera');
    } else {
      test.skip();
    }
  });
});

// ===========================================
// SEO URL TESTS
// ===========================================

test.describe('SEO URLs', () => {
  test('SEO-friendly test URL opens modal', async ({ page }) => {
    // Navigate to a specific test via SEO URL
    await page.goto('/mrd/signatera');
    await page.waitForTimeout(2000);
    
    // Modal should be open with the test details
    const modal = page.locator('[data-testid="test-detail-modal"], .test-detail-print-area');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    
    // Modal should contain "Signatera"
    const modalText = await modal.first().textContent();
    expect(modalText?.toLowerCase()).toContain('signatera');
  });

  test('SEO URL works for ECD category', async ({ page }) => {
    // Test another category to ensure routing works across categories
    await page.goto('/ecd/galleri');
    await page.waitForTimeout(2000);
    
    // Modal should be open
    const modal = page.locator('[data-testid="test-detail-modal"], .test-detail-print-area');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    
    // Modal should contain "Galleri"
    const modalText = await modal.first().textContent();
    expect(modalText?.toLowerCase()).toContain('galleri');
  });

  test('invalid SEO URL falls back gracefully', async ({ page }) => {
    await page.goto('/mrd/nonexistent-test-xyz');
    await page.waitForTimeout(2000);
    
    // Should still be on the MRD page (not crash)
    const content = await page.textContent('body');
    expect(content?.toUpperCase()).toContain('MRD');
  });
});

// ===========================================
// VENDOR INVITE URL TESTS
// ===========================================

test.describe('Vendor Invite URLs', () => {
  test('vendor invite URL pre-fills email and shows verification status', async ({ page }) => {
    await page.goto('/submissions?invite=vendor&email=test.user@example.com&name=Test%20User');
    await page.waitForTimeout(2000);
    
    // Check if we're on the actual app
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Login') && pageContent?.includes('Vercel')) {
      test.skip();
      return;
    }
    
    // Email should be shown as pre-verified
    await expect(page.getByText('test.user@example.com')).toBeVisible({ timeout: 5000 });
    
    // Should show pre-verified status message
    await expect(page.getByText(/pre-verified|Email Pre-Verified/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('vendor invite URL sets submitter type to vendor', async ({ page }) => {
    await page.goto('/submissions?invite=vendor&email=rep@testvendor.com&name=Vendor%20Rep');
    await page.waitForTimeout(2000);
    
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Login') && pageContent?.includes('Vercel')) {
      test.skip();
      return;
    }
    
    // The submitter type select should be set to "vendor"
    const submitterSelect = page.locator('select').filter({ 
      has: page.locator('option', { hasText: /Test Vendor Representative/i })
    }).first();
    
    if (await submitterSelect.isVisible()) {
      const selectedValue = await submitterSelect.inputValue();
      expect(selectedValue).toBe('vendor');
    }
  });
});

// ===========================================
// SUBMISSIONS PAGE TESTS
// ===========================================

test.describe('Submissions Page - Vendor Domain Validation', () => {
  test('shows warning when selecting Independent Expert', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Check if we're on the actual app (not Vercel login page)
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Login') && pageContent?.includes('Vercel')) {
      test.skip();
      return;
    }
    
    // Select "File a Correction" button - find it by text
    const correctionButton = page.getByText('File a Correction', { exact: false });
    await expect(correctionButton).toBeVisible({ timeout: 5000 });
    await correctionButton.click();
    
    // Wait for button to show selected state (blue background) - confirms click worked
    await page.waitForTimeout(1000);
    
    // Wait for submitter type section to appear - it should show after clicking correction
    // Look for the label text first to confirm the section is visible
    await expect(page.getByText(/I am submitting as/i).first()).toBeVisible({ timeout: 10000 });
    
    // Now find the select - it should have "Independent Expert" option
    const submitterSelect = page.locator('select').filter({ 
      has: page.locator('option', { hasText: /Independent Expert/i })
    });
    
    await expect(submitterSelect.first()).toBeVisible({ timeout: 5000 });
    await submitterSelect.first().selectOption('expert');
    await page.waitForTimeout(500);
    
    // Verify warning message appears
    await expect(page.getByText('Vendor employees should select')).toBeVisible({ timeout: 3000 });
  });

  test('blocks vendor domain email when claiming Independent Expert', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Check if we're on the actual app (not Vercel login page)
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Login') && pageContent?.includes('Vercel')) {
      test.skip();
      return;
    }
    
    // Step 1: Select "File a Correction" - try multiple selectors
    const correctionButton = page.getByText('File a Correction').or(
      page.locator('button').filter({ hasText: /file.*correction/i })
    );
    await expect(correctionButton.first()).toBeVisible({ timeout: 5000 });
    await correctionButton.first().click();
    await page.waitForTimeout(500);
    
    // Step 2: Select "Independent Expert" - find the submitter type select
    const submitterSelect = page.locator('select').filter({ 
      has: page.locator('option', { hasText: /Independent Expert|Test Vendor Representative/i })
    }).or(
      page.locator('label:has-text("I am submitting as") + * select')
    ).or(
      page.locator('select').first()
    );
    await expect(submitterSelect).toBeVisible({ timeout: 5000 });
    await submitterSelect.selectOption('expert');
    await page.waitForTimeout(500);
    
    // Step 3: Select MRD category (button contains "MRD" and description)
    await page.locator('button:has-text("MRD")').first().click();
    await page.waitForTimeout(500);
    
    // Step 4: Select first test (second select on page)
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.waitForTimeout(300);
    
    // Step 5: Select first parameter (third select on page)
    await page.locator('select').nth(2).selectOption({ index: 1 });
    await page.waitForTimeout(500);
    
    // Step 6: Wait for form to fully render
    await expect(page.getByText('Your Information')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Step 7: Fill correction fields - New Value and Citation URL (both required)
    await page.locator('input[placeholder="Enter the correct value"]').fill('Test correction value').catch(() => {});
    await page.locator('input[placeholder="https://..."]').fill('https://example.com/source').catch(() => {});
    await page.waitForTimeout(300);
    
    // Step 8: Fill name fields - find the inputs in the Your Information section
    const allTextInputs = page.locator('input:not([type="email"]):not([type="hidden"])');
    const textInputCount = await allTextInputs.count();
    
    // First Name and Last Name are the last two text inputs
    if (textInputCount >= 2) {
      await allTextInputs.nth(textInputCount - 2).fill('Samyuktha');
      await allTextInputs.nth(textInputCount - 1).fill('Test');
    }
    await page.waitForTimeout(300);
    
    // Step 9: Fill email
    await page.locator('input[type="email"]').fill('samyuktha@illumina.com');
    await page.waitForTimeout(300);
    
    // Step 10: Click Send Code button
    await page.getByRole('button', { name: /Send Code/i }).click();
    await page.waitForTimeout(500);
    
    // Verify error message about vendor domain appears
    // Look for the actual error message text, not the dropdown option
    await expect(page.getByText(/Your email domain.*illumina\.com.*appears to be from/i)).toBeVisible({ timeout: 3000 });
  });

  test('allows vendor domain email when Vendor Representative selected', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Check if we're on the actual app (not Vercel login page)
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Login') && pageContent?.includes('Vercel')) {
      test.skip();
      return;
    }
    
    // Select "File a Correction" - try multiple selectors
    const correctionButton = page.getByText('File a Correction').or(
      page.locator('button').filter({ hasText: /file.*correction/i })
    );
    await expect(correctionButton.first()).toBeVisible({ timeout: 5000 });
    await correctionButton.first().click();
    await page.waitForTimeout(500);
    
    // Select "Test Vendor Representative"
    // Find submitter type select
    const submitterSelect = page.locator('select').filter({ 
      has: page.locator('option', { hasText: /Independent Expert|Test Vendor Representative/i })
    }).or(
      page.locator('label:has-text("I am submitting as") + * select')
    ).or(
      page.locator('select').first()
    );
    await expect(submitterSelect).toBeVisible({ timeout: 5000 });
    await submitterSelect.selectOption('vendor');
    await page.waitForTimeout(300);
    
    // Verify vendor verification warning appears
    await expect(page.getByText('verify that your email comes from')).toBeVisible({ timeout: 3000 });
  });

  test('allows non-vendor institutional email for Independent Expert', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Complete form flow
    await page.getByText('File a Correction').click();
    await page.waitForTimeout(500);
    
    // Find submitter type select
    const submitterSelect = page.locator('select').filter({ 
      has: page.locator('option', { hasText: /Independent Expert|Test Vendor Representative/i })
    }).or(
      page.locator('label:has-text("I am submitting as") + * select')
    ).or(
      page.locator('select').first()
    );
    await expect(submitterSelect).toBeVisible({ timeout: 5000 });
    await submitterSelect.selectOption('expert');
    await page.waitForTimeout(500);
    
    await page.locator('button:has-text("MRD")').first().click();
    await page.waitForTimeout(500);
    
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.waitForTimeout(300);
    
    await page.locator('select').nth(2).selectOption({ index: 1 });
    await page.waitForTimeout(500);
    
    // Wait for form
    await expect(page.getByText('Your Information')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Fill correction fields
    await page.locator('input[placeholder="Enter the correct value"]').fill('Test correction value').catch(() => {});
    await page.locator('input[placeholder="https://..."]').fill('https://example.com/source').catch(() => {});
    await page.waitForTimeout(300);
    
    // Fill name fields
    const allTextInputs = page.locator('input:not([type="email"]):not([type="hidden"])');
    const textInputCount = await allTextInputs.count();
    
    if (textInputCount >= 2) {
      await allTextInputs.nth(textInputCount - 2).fill('Test');
      await allTextInputs.nth(textInputCount - 1).fill('Researcher');
    }
    await page.waitForTimeout(300);
    
    // Fill email
    await page.locator('input[type="email"]').fill('researcher@stanford.edu');
    await page.waitForTimeout(300);
    
    // Click Send Code
    await page.getByRole('button', { name: /Send Code/i }).click();
    await page.waitForTimeout(500);
    
    // Should NOT see the vendor domain error
    await expect(page.getByText('appears to be from a diagnostic test vendor')).not.toBeVisible({ timeout: 1000 });
  });

  test('blocks free email providers', async ({ page }) => {
    await page.goto('/submissions');
    await page.waitForTimeout(1000);
    
    // Complete form flow
    await page.getByText('File a Correction').click();
    await page.waitForTimeout(500);
    
    // Find submitter type select
    const submitterSelect = page.locator('select').filter({ 
      has: page.locator('option', { hasText: /Independent Expert|Test Vendor Representative/i })
    }).or(
      page.locator('label:has-text("I am submitting as") + * select')
    ).or(
      page.locator('select').first()
    );
    await expect(submitterSelect).toBeVisible({ timeout: 5000 });
    await submitterSelect.selectOption('expert');
    await page.waitForTimeout(500);
    
    await page.locator('button:has-text("MRD")').first().click();
    await page.waitForTimeout(500);
    
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.waitForTimeout(300);
    
    await page.locator('select').nth(2).selectOption({ index: 1 });
    await page.waitForTimeout(500);
    
    // Wait for form
    await expect(page.getByText('Your Information')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Fill correction fields
    await page.locator('input[placeholder="Enter the correct value"]').fill('Test correction value').catch(() => {});
    await page.locator('input[placeholder="https://..."]').fill('https://example.com/source').catch(() => {});
    await page.waitForTimeout(300);
    
    // Fill name fields
    const allTextInputs = page.locator('input:not([type="email"]):not([type="hidden"])');
    const textInputCount = await allTextInputs.count();
    
    if (textInputCount >= 2) {
      await allTextInputs.nth(textInputCount - 2).fill('Test');
      await allTextInputs.nth(textInputCount - 1).fill('User');
    }
    await page.waitForTimeout(300);
    
    // Fill email
    await page.locator('input[type="email"]').fill('testuser@gmail.com');
    await page.waitForTimeout(300);
    
    // Click Send Code
    await page.getByRole('button', { name: /Send Code/i }).click();
    await page.waitForTimeout(500);
    
    // Verify error about free email providers
    await expect(page.getByText('company/institutional email')).toBeVisible({ timeout: 3000 });
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

// ===========================================
// PERSONA SYSTEM TESTS
// ===========================================

test.describe('Persona System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to reset persona state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('persona gate appears on first visit', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Should see the persona selection modal
    await expect(page.getByText('Welcome to OpenOnco')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Patient / Caregiver')).toBeVisible();
    await expect(page.getByText('Medical Professional')).toBeVisible();
  });

  test('selecting patient persona saves to localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Click Patient option button
    await page.getByRole('button', { name: /Patient \/ Caregiver/i }).click();
    await page.waitForTimeout(300);
    
    // Click Continue button
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(500);
    
    // Verify localStorage was set
    const persona = await page.evaluate(() => localStorage.getItem('openonco-persona'));
    expect(persona).toBe('patient');
  });

  test('patient homepage shows patient-specific elements', async ({ page }) => {
    // Set patient persona via localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('openonco-persona', 'patient'));
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Should see patient hero
    await expect(page.getByText('Learn How the New Generation of Cancer Blood Tests Can Help You')).toBeVisible({ timeout: 5000 });
    
    // Should see three info buttons
    await expect(page.getByText('Tests that will help find the right therapy')).toBeVisible();
    await expect(page.getByText('Tests that will track how well therapy is working')).toBeVisible();
    await expect(page.getByText('Tests that will keep watch after treatment')).toBeVisible();
    
    // Should see patient chat section
    await expect(page.getByText('Chat with us to Learn More About These Tests')).toBeVisible();
  });

  test('patient homepage hides R&D elements', async ({ page }) => {
    // Set patient persona
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('openonco-persona', 'patient'));
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Should NOT see the R&D test count banner (with "Collected, Curated, Explained")
    await expect(page.getByText('Collected, Curated, Explained')).not.toBeVisible();
    
    // Should NOT see model selector (Claude, GPT, etc.)
    const modelSelector = page.locator('select').filter({ hasText: /Claude|GPT|Gemini/i });
    await expect(modelSelector).not.toBeVisible();
  });

  test('patient info modal opens and closes', async ({ page }) => {
    // Set patient persona
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('openonco-persona', 'patient'));
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Click "Tests that help find the right therapy" button
    await page.getByText('Tests that help find the right therapy for you').click();
    await page.waitForTimeout(500);
    
    // Modal should open with educational content
    await expect(page.getByText('What is genomic testing?')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Questions to ask your doctor')).toBeVisible();
    
    // Close modal by clicking backdrop
    await page.locator('.fixed.inset-0').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    
    // Modal content should be hidden
    await expect(page.getByText('What is genomic testing?')).not.toBeVisible();
  });

  test('persona switcher in header works', async ({ page }) => {
    // Start as R&D
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('openonco-persona', 'rnd'));
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Should see R&D banner
    await expect(page.getByText('Collected, Curated, Explained')).toBeVisible({ timeout: 5000 });
    
    // Find and click persona dropdown in header
    const personaDropdown = page.locator('select').filter({ hasText: /R&D|Patient|Clinician/i }).first();
    if (await personaDropdown.isVisible()) {
      await personaDropdown.selectOption('patient');
      await page.waitForTimeout(1000);
      
      // Should now see patient homepage
      await expect(page.getByText('Understand How the New Generation of Cancer Tests Can Help You')).toBeVisible({ timeout: 5000 });
    }
  });

  test('patient can navigate to Learn page', async ({ page }) => {
    // Set patient persona
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('openonco-persona', 'patient'));
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Click Learn in navigation (it's a button, not a link) - use exact match
    await page.getByRole('button', { name: 'Learn', exact: true }).click();
    await page.waitForTimeout(1000);
    
    // Should see patient-friendly Learn content
    await expect(page.getByText('Understanding Cancer Blood Tests')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Types of Cancer Blood Tests')).toBeVisible();
  });

  test('R&D persona shows full technical interface', async ({ page }) => {
    // Set R&D persona
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('openonco-persona', 'rnd'));
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Should see R&D banner with test count
    await expect(page.getByText('Collected, Curated, Explained')).toBeVisible({ timeout: 5000 });
    
    // Should see technical elements
    const testCount = String(EXPECTED.testCounts.total);
    const pageText = await page.textContent('body');
    expect(pageText).toContain(testCount);
  });
});
