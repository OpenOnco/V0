// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Wizard Cancer Type Filtering', () => {
  
  test.beforeEach(async ({ page }) => {
    // Go directly to the patient watching wizard
    await page.goto('/patient/watching');
    await page.waitForLoadState('networkidle');
  });

  test('breast cancer should NOT show blood cancer tests', async ({ page }) => {
    // Step 1: Welcome - click to start
    await page.click('button:has-text("Let\'s get started")');
    await page.waitForTimeout(300);
    
    // Step 2: Treatment - select Yes (completed treatment - required for MRD)
    await page.click('button:has-text("Yes, I\'ve completed treatment")');
    await page.waitForTimeout(500); // Auto-advances
    
    // Step 3: Location - first select United States, then California
    await page.selectOption('select', 'United States');
    await page.waitForTimeout(300);
    await page.selectOption('select >> nth=1', 'CA');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);
    
    // Step 4: Cancer type - select Breast
    await page.click('button:has-text("Breast")');
    await page.waitForTimeout(300);
    
    // Step 5: Tumor tissue - select Yes
    await page.click('button:has-text("Yes")');
    await page.waitForTimeout(300);
    
    // Step 6: Insurance - select Yes
    await page.click('button:has-text("Yes, I have insurance")');
    await page.waitForTimeout(300);
    
    // Select Medicare from dropdown
    await page.selectOption('select', 'Medicare');
    await page.click('button:has-text("See my options")');
    await page.waitForTimeout(1000);
    
    // Check results - should NOT contain blood cancer tests
    const pageContent = await page.textContent('body');
    
    // These are blood cancer tests that should NOT appear for breast cancer
    const bloodCancerTests = [
      'clonoSEQ',
      'LymphoVista', 
      'LymphoTrack',
      'BD OneFlow',
      'Liquid Trace Heme'
    ];
    
    for (const testName of bloodCancerTests) {
      expect(pageContent, `Should not contain blood cancer test: ${testName}`).not.toContain(testName);
    }
    
    // These breast-relevant tests SHOULD appear
    const breastTests = ['Signatera', 'Guardant', 'FoundationOne'];
    let foundAtLeastOne = false;
    for (const testName of breastTests) {
      if (pageContent.includes(testName)) {
        foundAtLeastOne = true;
        break;
      }
    }
    expect(foundAtLeastOne, 'Should find at least one breast cancer test').toBe(true);
  });

  test('multiple myeloma should show blood cancer tests', async ({ page }) => {
    await page.click('button:has-text("Let\'s get started")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes, I\'ve completed treatment")');
    await page.waitForTimeout(500);
    
    await page.selectOption('select', 'United States');
    await page.waitForTimeout(300);
    await page.selectOption('select >> nth=1', 'CA');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Multiple myeloma")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes, I have insurance")');
    await page.waitForTimeout(300);
    
    await page.selectOption('select', 'Medicare');
    await page.click('button:has-text("See my options")');
    await page.waitForTimeout(1000);
    
    const pageContent = await page.textContent('body');
    
    // clonoSEQ SHOULD appear for multiple myeloma
    expect(pageContent, 'Should contain clonoSEQ for multiple myeloma').toContain('clonoSEQ');
    
    // Oncotype DX Breast should NOT appear
    expect(pageContent, 'Should not contain breast-only test').not.toContain('Oncotype DX Breast');
  });

  test('colorectal cancer shows CRC tests, not blood cancer tests', async ({ page }) => {
    await page.click('button:has-text("Let\'s get started")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes, I\'ve completed treatment")');
    await page.waitForTimeout(500);
    
    await page.selectOption('select', 'United States');
    await page.waitForTimeout(300);
    await page.selectOption('select >> nth=1', 'CA');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Colorectal")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes, I have insurance")');
    await page.waitForTimeout(300);
    
    await page.selectOption('select', 'Medicare');
    await page.click('button:has-text("See my options")');
    await page.waitForTimeout(1000);
    
    const pageContent = await page.textContent('body');
    
    // Signatera should appear (has colorectal)
    expect(pageContent, 'Should contain Signatera for CRC').toContain('Signatera');
    
    // Blood cancer tests should NOT appear
    expect(pageContent, 'Should not contain clonoSEQ for CRC').not.toContain('clonoSEQ');
    expect(pageContent, 'Should not contain LymphoVista for CRC').not.toContain('LymphoVista');
  });

  test('no insurance shows cost sensitivity options', async ({ page }) => {
    await page.click('button:has-text("Let\'s get started")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes, I\'ve completed treatment")');
    await page.waitForTimeout(500);
    
    await page.selectOption('select', 'United States');
    await page.waitForTimeout(300);
    await page.selectOption('select >> nth=1', 'CA');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Breast")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes")');
    await page.waitForTimeout(300);
    
    // Select No insurance
    await page.click('button:has-text("No, I don\'t have insurance")');
    await page.waitForTimeout(300);
    
    // Should see cost sensitivity question
    const pageContent = await page.textContent('body');
    expect(pageContent.toLowerCase(), 'Should ask about cost').toContain('cost');
  });

  test('Other insurance shows warning message', async ({ page }) => {
    await page.click('button:has-text("Let\'s get started")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes, I\'ve completed treatment")');
    await page.waitForTimeout(500);
    
    await page.selectOption('select', 'United States');
    await page.waitForTimeout(300);
    await page.selectOption('select >> nth=1', 'CA');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Breast")');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Yes")');
    await page.waitForTimeout(300);
    
    // Select Yes insurance
    await page.click('button:has-text("Yes, I have insurance")');
    await page.waitForTimeout(300);
    
    // Select "Other" from dropdown
    await page.selectOption('select', 'other');
    await page.waitForTimeout(300);
    
    // Should see warning about no coverage data
    const pageContent = await page.textContent('body');
    expect(pageContent.toLowerCase(), 'Should show warning about coverage data').toContain('coverage');
  });
});
