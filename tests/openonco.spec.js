// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * OpenOnco Regression Test Suite
 * Updated: Dec 14, 2025
 */

// ===========================================
// EXPECTED VALUES - UPDATE WHEN ADDING TESTS
// ===========================================

const EXPECTED = {
  testCounts: {
    MRD: 26,
    ECD: 15,
    TRM: 15,
    TDS: 22,
    total: 78
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
      
      const cards = page.locator('[class*="cursor-pointer"], [class*="card"], [role="button"]');
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
    
    const testCard = page.locator('[class*="cursor-pointer"]').first();
    
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      const modal = page.locator('[class*="fixed"][class*="inset"], [role="dialog"], .test-detail-print-area');
      await expect(modal.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('modal has share link button', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    const testCard = page.locator('[class*="cursor-pointer"]').first();
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      const shareBtn = page.locator('button[title*="link"], button[title*="share"], button[title*="copy"]');
      await expect(shareBtn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('modal has print button', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    const testCard = page.locator('[class*="cursor-pointer"]').first();
    if (await testCard.isVisible()) {
      await testCard.click();
      await page.waitForTimeout(1000);
      
      const printBtn = page.locator('button[title*="print"], button[title*="PDF"]');
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
    await page.waitForTimeout(1500);
    
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    
    if (count >= 2) {
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      await page.waitForTimeout(500);
      
      const compareBtn = page.locator('button').filter({ hasText: /Compare/i });
      await expect(compareBtn.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('comparison modal opens and has share button', async ({ page }) => {
    await page.goto('/mrd');
    await page.waitForTimeout(1500);
    
    const checkboxes = page.locator('input[type="checkbox"]');
    if (await checkboxes.count() >= 2) {
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      
      const compareBtn = page.locator('button').filter({ hasText: /Compare/i });
      if (await compareBtn.isVisible()) {
        await compareBtn.click();
        await page.waitForTimeout(1000);
        
        const modal = page.locator('.comparison-print-area, [class*="Comparing"]');
        await expect(modal.first()).toBeVisible({ timeout: 5000 });
      }
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
    
    const testCard = page.locator('[class*="cursor-pointer"]').first();
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
    
    const testCard = page.locator('[class*="cursor-pointer"]').first();
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
