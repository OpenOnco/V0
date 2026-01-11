// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Wizard Cancer Type Filtering', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/patient/watching');
    await page.waitForLoadState('networkidle');
  });

  // Helper to navigate through wizard to results
  async function navigateToResults(page, { cancerType, insuranceProvider = 'Medicare' }) {
    // Step 1: Landing page - click CTA
    await page.getByRole('button', { name: /explore mrd testing/i }).click();
    await page.waitForTimeout(500);
    
    // Step 2: Treatment - completed treatment
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    // Step 3: Location - just country, no state
    await page.locator('select').first().selectOption('United States');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    // Step 4: Cancer type
    await page.getByRole('button', { name: cancerType }).click();
    await page.waitForTimeout(500);
    
    // Step 5: Tumor tissue - Yes
    await page.getByRole('button', { name: /Yes, tissue was saved/i }).click();
    await page.waitForTimeout(500);
    
    // Step 6: Insurance - Yes + provider
    await page.getByRole('button', { name: /^Yes$/i }).first().click();
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
    await page.getByRole('button', { name: /find tests to discuss/i }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    await page.locator('select').first().selectOption('United States');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Breast' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /Yes, tissue was saved/i }).click();
    await page.waitForTimeout(500);
    
    // No insurance
    await page.getByRole('button', { name: /^No$/i }).click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.textContent('body');
    expect(pageContent.toLowerCase()).toContain('cost');
  });

  test('Other insurance shows coverage warning', async ({ page }) => {
    await page.getByRole('button', { name: /find tests to discuss/i }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    await page.locator('select').first().selectOption('United States');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Breast' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /Yes, tissue was saved/i }).click();
    await page.waitForTimeout(500);
    
    // Yes insurance
    await page.getByRole('button', { name: /^Yes$/i }).first().click();
    await page.waitForTimeout(300);
    
    // Other insurance
    await page.locator('select').selectOption('other');
    await page.waitForTimeout(500);
    
    const pageContent = await page.textContent('body');
    expect(pageContent.toLowerCase()).toContain('coverage');
  });

  test('no tumor tissue excludes tumor-informed tests, shows tumor-naive', async ({ page }) => {
    await page.getByRole('button', { name: /find tests to discuss/i }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    await page.locator('select').first().selectOption('United States');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Colorectal' }).click();
    await page.waitForTimeout(500);
    
    // No tumor tissue - click the button containing "No / I don't think so"
    await page.getByRole('button', { name: /No \/ I don't think so/i }).click();
    await page.waitForTimeout(500);
    
    // Yes insurance + Medicare
    await page.getByRole('button', { name: /^Yes$/i }).first().click();
    await page.waitForTimeout(300);
    await page.locator('select').selectOption('Medicare');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(1500);
    
    const pageContent = await page.textContent('body');
    
    // Tumor-naive tests SHOULD appear
    expect(pageContent).toContain('Reveal');
    
    // Tumor-informed only tests should NOT appear
    expect(pageContent).not.toContain('Signatera');
  });

  test('has tumor tissue excludes tumor-naive tests, shows tumor-informed', async ({ page }) => {
    await page.getByRole('button', { name: /find tests to discuss/i }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /completed treatment/i }).click();
    await page.waitForTimeout(700);
    
    await page.locator('select').first().selectOption('United States');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Colorectal' }).click();
    await page.waitForTimeout(500);
    
    // Has tumor tissue - click the button containing "Yes, tissue was saved"
    await page.getByRole('button', { name: /Yes, tissue was saved/i }).click();
    await page.waitForTimeout(500);
    
    // Yes insurance + Medicare
    await page.getByRole('button', { name: /^Yes$/i }).first().click();
    await page.waitForTimeout(300);
    await page.locator('select').selectOption('Medicare');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(1500);
    
    const pageContent = await page.textContent('body');
    
    // Tumor-informed tests SHOULD appear
    expect(pageContent).toContain('Signatera');
    
    // Tumor-naive only tests should NOT appear
    expect(pageContent).not.toContain('Reveal');
  });
});
