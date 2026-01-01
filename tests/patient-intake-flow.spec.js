// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Patient Intake Flow Tests
 * 
 * Tests the 3-step patient intake flow and chat Q&A sequences.
 * API-dependent tests (those requiring chat responses) are skipped on localhost.
 */

// Helper to check if we're running against localhost (no API)
const isLocalhost = (baseURL) => baseURL?.includes('localhost') || baseURL?.includes('127.0.0.1');

test.describe('Patient Intake Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('openonco-persona', 'patient'));
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test.describe('Step 1 - Cancer Type Selection', () => {
    test('shows cancer type dropdown', async ({ page }) => {
      await expect(page.getByText('What kind of cancer are you concerned about?')).toBeVisible();
    });

    test('can select breast cancer and advances to step 2', async ({ page }) => {
      await page.locator('select').selectOption('Breast Cancer');
      await expect(page.getByText('Tests that help choose my treatment')).toBeVisible();
    });
  });

  test.describe('Step 2 - Journey Selection', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('select').selectOption('Breast Cancer');
      await page.waitForTimeout(500);
    });

    test('shows all three journey cards', async ({ page }) => {
      await expect(page.getByText('Tests that help choose my treatment')).toBeVisible();
      await expect(page.getByText('Tests that track my response to treatment')).toBeVisible();
      await expect(page.getByText('Tests that watch over me after treatment')).toBeVisible();
    });

    test('clicking MRD journey opens modal with mode options', async ({ page }) => {
      await page.getByText('Tests that watch over me after treatment').click();
      await expect(page.getByText('Find the right tests for me')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('Or, learn more about these tests')).toBeVisible();
    });
  });

  test.describe('MRD Journey - Find Mode Q&A Flow', () => {
    
    const navigateToMrdFind = async (page, cancerType = 'Breast Cancer') => {
      await page.locator('select').selectOption(cancerType);
      await page.waitForTimeout(500);
      await page.getByText('Tests that watch over me after treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
    };

    test('shows Q1 about tissue availability', async ({ page }) => {
      await navigateToMrdFind(page);
      // Check the chat area for the tissue question
      const chatArea = page.locator('.prose, [class*="chat"]').first();
      await expect(chatArea.getByText(/tumor tissue.*saved|tissue.*surgery|biopsy/i).first()).toBeVisible({ timeout: 5000 });
    });

    // API-dependent tests - skip on localhost
    test('yes answer → proceeds to insurance question', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await navigateToMrdFind(page);
      await page.locator('input[type="text"], textarea').fill('yes');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      const messages = page.locator('[data-message-role="assistant"]');
      await expect(messages.last().getByText(/insurance/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('no answer → proceeds to insurance question (not re-ask Q1)', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await navigateToMrdFind(page);
      await page.locator('input[type="text"], textarea').fill('no');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      const lastResponse = page.locator('[data-message-role="assistant"]').last();
      await expect(lastResponse.getByText(/insurance/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('full flow: yes → Medicare → gets recommendations with test names', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await navigateToMrdFind(page);
      
      await page.locator('input[type="text"], textarea').fill('yes');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      await page.locator('input[type="text"], textarea').fill('Medicare');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000);
      
      const chatContent = await page.locator('.prose').last().textContent();
      const hasTestName = /Signatera|Guardant|RaDaR|FoundationOne|Pathlight|NeXT/i.test(chatContent || '');
      expect(hasTestName).toBe(true);
    });

    test('full flow: no tissue → private insurance → gets recommendations', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await navigateToMrdFind(page, 'Colorectal Cancer');
      
      await page.locator('input[type="text"], textarea').fill('no');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      await page.locator('input[type="text"], textarea').fill('private insurance');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000);
      
      const chatContent = await page.locator('.prose').last().textContent();
      const hasRecommendation = /test|option|consider|recommend/i.test(chatContent || '');
      expect(hasRecommendation).toBe(true);
    });
  });

  test.describe('TRM Journey - Find Mode Q&A Flow', () => {
    
    const navigateToTrmFind = async (page) => {
      await page.locator('select').selectOption('Lung Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Tests that track my response to treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
    };

    test('shows Q1 about current treatment', async ({ page }) => {
      await navigateToTrmFind(page);
      const chatArea = page.locator('.prose').first();
      await expect(chatArea.getByText(/treatment.*on|What type of treatment/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('chemo answer → proceeds to insurance', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await navigateToTrmFind(page);
      await page.locator('input[type="text"], textarea').fill('chemotherapy');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      const lastResponse = page.locator('[data-message-role="assistant"]').last();
      await expect(lastResponse.getByText(/insurance/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('TDS Journey - Find Mode Q&A Flow', () => {
    
    const navigateToTdsFind = async (page) => {
      await page.locator('select').selectOption('Lung Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Tests that help choose my treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
    };

    test('shows Q1 about prior genomic testing', async ({ page }) => {
      await navigateToTdsFind(page);
      const chatArea = page.locator('.prose').first();
      await expect(chatArea.getByText(/genomic.*profiling|Foundation.*Medicine|Tempus/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('no answer → proceeds to insurance', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await navigateToTdsFind(page);
      await page.locator('input[type="text"], textarea').fill('no');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      const lastResponse = page.locator('[data-message-role="assistant"]').last();
      await expect(lastResponse.getByText(/insurance/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Learn Mode', () => {
    
    test('MRD learn mode shows educational welcome and suggestions', async ({ page }) => {
      await page.locator('select').selectOption('Breast Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Tests that watch over me after treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Or, learn more about these tests').click();
      await page.waitForTimeout(1000);
      
      // Should see welcome message
      await expect(page.locator('.prose').first().getByText(/help you understand/i).first()).toBeVisible({ timeout: 5000 });
      
      // Should see clickable suggestions
      await expect(page.getByRole('button', { name: /MRD tests.*available/i }).first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Edge Cases', () => {
    
    test('single word "no" is accepted as answer, not rejection', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await page.locator('select').selectOption('Breast Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Tests that watch over me after treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
      
      await page.locator('input[type="text"], textarea').fill('no');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      const lastResponse = await page.locator('[data-message-role="assistant"]').last().textContent();
      expect(lastResponse?.toLowerCase()).toContain('insurance');
    });

    test('"I don\'t know" is accepted as answer', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await page.locator('select').selectOption('Lung Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Tests that watch over me after treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
      
      await page.locator('input[type="text"], textarea').fill("I don't know");
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      const lastResponse = await page.locator('[data-message-role="assistant"]').last().textContent();
      expect(lastResponse?.toLowerCase()).toContain('insurance');
    });
  });

  test.describe('Test Link Clicks', () => {
    
    test('clicking test link icon opens detail modal', async ({ page, baseURL }) => {
      test.skip(isLocalhost(baseURL), 'Skipping API test on localhost');
      
      await page.locator('select').selectOption('Breast Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Tests that watch over me after treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
      
      await page.locator('input[type="text"], textarea').fill('yes');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      await page.locator('input[type="text"], textarea').fill('Medicare');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000);
      
      const testLink = page.locator('button[title="View test details"]').first();
      if (await testLink.isVisible({ timeout: 5000 })) {
        await testLink.click();
        await page.waitForTimeout(1000);
        
        await expect(page.getByText(/Clinical Performance|Methodology|Reimbursement/i).first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
