// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Wizard Cancer Type Filtering', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/patient/watching');
    await page.waitForLoadState('networkidle');
  });

  // Helper to navigate through wizard to results
  async function navigateToResults(page, { cancerType, insuranceProvider = 'Medicare' }) {
    // Step 1: Welcome
    await page.getByRole('button', { name: /get started/i }).click();
    await page.waitForTimeout(500);
    
    // Step 2: Treatment - completed treatment
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    // Step 3: Location
    await page.locator('select').first().selectOption('United States');
    await page.waitForTimeout(300);
    await page.locator('select').nth(1).selectOption('CA');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    // Step 4: Cancer type
    await page.getByRole('button', { name: cancerType }).click();
    await page.waitForTimeout(500);
    
    // Step 5: Tumor tissue - Yes
    await page.getByRole('button', { name: 'Yes' }).first().click();
    await page.waitForTimeout(500);
    
    // Step 6: Insurance - Yes + provider
    await page.getByRole('button', { name: 'Yes' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('select').selectOption(insuranceProvider);
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(1500);
  }

  test('breast cancer should NOT show blood cancer tests', async ({ page }) => {
    await navigateToResults(page, { cancerType: 'Breast', insuranceProvider: 'Medicare' });
    
    const pageContent = await page.textContent('body');
    
    // Blood cancer tests should NOT appear
    expect(pageContent).not.toContain('clonoSEQ');
    expect(pageContent).not.toContain('LymphoVista');
    expect(pageContent).not.toContain('LymphoTrack');
    
    // Breast-relevant tests SHOULD appear
    const hasBreastTest = pageContent.includes('Signatera') || 
                          pageContent.includes('Guardant') || 
                          pageContent.includes('Foundation');
    expect(hasBreastTest).toBe(true);
  });

  test('multiple myeloma SHOULD show clonoSEQ', async ({ page }) => {
    await navigateToResults(page, { cancerType: 'Multiple myeloma', insuranceProvider: 'Medicare' });
    
    const pageContent = await page.textContent('body');
    
    // clonoSEQ SHOULD appear for myeloma
    expect(pageContent).toContain('clonoSEQ');
    
    // Breast-specific tests should NOT appear
    expect(pageContent).not.toContain('Oncotype DX Breast');
  });

  test('colorectal shows CRC tests, excludes blood cancer', async ({ page }) => {
    await navigateToResults(page, { cancerType: 'Colorectal', insuranceProvider: 'Medicare' });
    
    const pageContent = await page.textContent('body');
    
    // CRC tests should appear
    expect(pageContent).toContain('Signatera');
    
    // Blood cancer tests should NOT appear
    expect(pageContent).not.toContain('clonoSEQ');
  });

  test('no insurance shows cost question', async ({ page }) => {
    await page.getByRole('button', { name: /get started/i }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    await page.locator('select').first().selectOption('United States');
    await page.waitForTimeout(300);
    await page.locator('select').nth(1).selectOption('CA');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Breast' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Yes' }).first().click();
    await page.waitForTimeout(500);
    
    // No insurance
    await page.getByRole('button', { name: 'No' }).click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.textContent('body');
    expect(pageContent.toLowerCase()).toContain('cost');
  });

  test('Other insurance shows coverage warning', async ({ page }) => {
    await page.getByRole('button', { name: /get started/i }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    await page.locator('select').first().selectOption('United States');
    await page.waitForTimeout(300);
    await page.locator('select').nth(1).selectOption('CA');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Breast' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Yes' }).first().click();
    await page.waitForTimeout(500);
    
    // Yes insurance
    await page.getByRole('button', { name: 'Yes' }).first().click();
    await page.waitForTimeout(300);
    
    // Other insurance
    await page.locator('select').selectOption('other');
    await page.waitForTimeout(500);
    
    const pageContent = await page.textContent('body');
    expect(pageContent.toLowerCase()).toContain('coverage');
  });
});
