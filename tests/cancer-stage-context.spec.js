// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Tests that cancer type & stage selections persist across all three patient wizards
 * via sessionStorage and the CancerStagePicker component.
 */

test.describe('Cancer/Stage Context Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Clear sessionStorage before each test
    await page.goto('/patient');
    await page.evaluate(() => sessionStorage.clear());
  });

  test('Coverage wizard: picker values flow into coverage results', async ({ page }) => {
    await page.goto('/patient/lookup');
    await page.waitForLoadState('networkidle');

    // Use the inline picker to select cancer type and stage
    const cancerSelect = page.locator('select').filter({ has: page.locator('option:text("Colorectal")') }).first();
    const stageSelect = page.locator('select').filter({ has: page.locator('option:text("Stage II")') }).first();
    await expect(cancerSelect).toBeVisible({ timeout: 5000 });
    await cancerSelect.selectOption('colorectal');
    await page.waitForTimeout(200);
    await stageSelect.selectOption('stage-2');
    await page.waitForTimeout(200);

    // Verify sessionStorage was updated
    const ctx = await page.evaluate(() => JSON.parse(sessionStorage.getItem('openonco-patient-context') || '{}'));
    expect(ctx.cancerType).toBe('colorectal');
    expect(ctx.stage).toBe('stage-2');

    // Search for and select a test (Signatera)
    await page.locator('input[placeholder*="Signatera"]').fill('Signatera');
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: 'Signatera' }).first().click();
    await page.waitForTimeout(1000);

    // Verify sessionStorage still has values after view switch
    const ctx2 = await page.evaluate(() => JSON.parse(sessionStorage.getItem('openonco-patient-context') || '{}'));
    expect(ctx2.cancerType).toBe('colorectal');
    expect(ctx2.stage).toBe('stage-2');

    // Picker on the detail view should still show the selected values
    const cancerSelect2 = page.locator('select').filter({ has: page.locator('option:text("Colorectal")') }).first();
    const stageSelect2 = page.locator('select').filter({ has: page.locator('option:text("Stage II")') }).first();
    await expect(cancerSelect2).toHaveValue('colorectal', { timeout: 5000 });
    await expect(stageSelect2).toHaveValue('stage-2', { timeout: 5000 });

    // Select Medicare
    await page.getByRole('button', { name: /^Medicare$/i }).click();
    await page.waitForTimeout(1000);

    // Should show coverage results (not the "select above" prompt) since cancer type and stage are set
    await expect(page.getByText(/select your cancer type and stage above/i)).not.toBeVisible({ timeout: 3000 });

    // Should see coverage info
    const pageText = await page.textContent('body');
    expect(pageText.toLowerCase()).toMatch(/coverage|covered|indication|policy/i);
  });

  test('Test Search wizard: picker is visible and values persist', async ({ page }) => {
    await page.goto('/patient/watching');
    await page.waitForLoadState('networkidle');

    // Cancer/stage picker should be visible (on non-landing steps)
    // First click through the treatment gate
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);

    // Picker should now be visible
    const cancerSelect = page.locator('select').filter({ has: page.locator('option:text("Breast")') }).first();
    const stageSelect = page.locator('select').filter({ has: page.locator('option:text("Stage III")') }).first();
    await expect(cancerSelect).toBeVisible({ timeout: 5000 });
    await expect(stageSelect).toBeVisible({ timeout: 5000 });

    // Select values
    await cancerSelect.selectOption('breast');
    await stageSelect.selectOption('stage-3');

    // Verify sessionStorage
    const ctx = await page.evaluate(() => JSON.parse(sessionStorage.getItem('openonco-patient-context') || '{}'));
    expect(ctx.cancerType).toBe('breast');
    expect(ctx.stage).toBe('stage-3');
  });

  test('Doctor FAQs: picker is visible and values personalize answers', async ({ page }) => {
    await page.goto('/patient/doctor-faq');
    await page.waitForLoadState('networkidle');

    // Cancer/stage picker should be visible
    const cancerSelect = page.locator('select').filter({ has: page.locator('option:text("Colorectal")') }).first();
    const stageSelect = page.locator('select').filter({ has: page.locator('option:text("Stage II")') }).first();
    await expect(cancerSelect).toBeVisible({ timeout: 5000 });
    await expect(stageSelect).toBeVisible({ timeout: 5000 });

    // Select values
    await cancerSelect.selectOption('colorectal');
    await stageSelect.selectOption('stage-2');

    // Verify sessionStorage
    const ctx = await page.evaluate(() => JSON.parse(sessionStorage.getItem('openonco-patient-context') || '{}'));
    expect(ctx.cancerType).toBe('colorectal');
    expect(ctx.stage).toBe('stage-2');

    // FAQ answers should be visible (click first accordion)
    const firstAccordion = page.locator('button').filter({ hasText: /no evidence/i }).first();
    if (await firstAccordion.isVisible()) {
      await firstAccordion.click();
      await page.waitForTimeout(500);
      // Personalized answer should mention the cancer type
      const expandedText = await page.textContent('body');
      expect(expandedText.toLowerCase()).toContain('colorectal');
    }
  });

  test('Context persists from Coverage wizard to Test Search wizard', async ({ page }) => {
    // Set context via sessionStorage (simulating Coverage wizard)
    await page.goto('/patient');
    await page.evaluate(() => {
      sessionStorage.setItem('openonco-patient-context', JSON.stringify({ cancerType: 'lung', stage: 'stage-4' }));
    });

    // Navigate to Test Search wizard
    await page.goto('/patient/watching');
    await page.waitForLoadState('networkidle');

    // Click through treatment gate to see picker
    const treatmentButton = page.getByRole('button', { name: /completed treatment/i });
    if (await treatmentButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await treatmentButton.click();
      await page.waitForTimeout(700);
    }

    // Picker should show the values from Coverage wizard
    const cancerSelect = page.locator('select').filter({ has: page.locator('option:text("Lung")') }).first();
    const stageSelect = page.locator('select').filter({ has: page.locator('option:text("Stage IV")') }).first();
    await expect(cancerSelect).toHaveValue('lung', { timeout: 5000 });
    await expect(stageSelect).toHaveValue('stage-4', { timeout: 5000 });
  });

  test('Context persists from Test Search wizard to Doctor FAQs', async ({ page }) => {
    // Set context via sessionStorage directly (simulating previous wizard)
    await page.goto('/patient');
    await page.evaluate(() => {
      sessionStorage.setItem('openonco-patient-context', JSON.stringify({ cancerType: 'breast', stage: 'stage-2' }));
    });

    // Navigate to Doctor FAQs
    await page.goto('/patient/doctor-faq');
    await page.waitForLoadState('networkidle');

    // Picker should show pre-filled values
    const cancerSelect = page.locator('select').filter({ has: page.locator('option:text("Breast")') }).first();
    const stageSelect = page.locator('select').filter({ has: page.locator('option:text("Stage II")') }).first();
    await expect(cancerSelect).toHaveValue('breast');
    await expect(stageSelect).toHaveValue('stage-2');
  });
});
