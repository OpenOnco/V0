// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Patient Intake Flow Tests
 * 
 * Tests the 3-step patient intake flow and chat Q&A sequences
 */

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
      await expect(page.getByText('Choosing the Right Treatment')).toBeVisible();
    });
  });

  test.describe('Step 2 - Journey Selection', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('select').selectOption('Breast Cancer');
      await page.waitForTimeout(500);
    });

    test('shows all three journey cards', async ({ page }) => {
      await expect(page.getByText('Choosing the Right Treatment')).toBeVisible();
      await expect(page.getByText('Tracking Treatment Response')).toBeVisible();
      await expect(page.getByText('Keeping Watch After Treatment')).toBeVisible();
    });

    test('clicking MRD journey opens modal with mode options', async ({ page }) => {
      await page.getByText('Keeping Watch After Treatment').click();
      await expect(page.getByText('Find the right tests for me')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('Or, learn more about these tests')).toBeVisible();
    });
  });

  test.describe('MRD Journey - Find Mode Q&A Flow', () => {
    
    const navigateToMrdFind = async (page, cancerType = 'Breast Cancer') => {
      await page.locator('select').selectOption(cancerType);
      await page.waitForTimeout(500);
      await page.getByText('Keeping Watch After Treatment').click();
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

    test('yes answer → proceeds to insurance question', async ({ page }) => {
      await navigateToMrdFind(page);
      
      // Answer Q1
      await page.locator('input[type="text"], textarea').fill('yes');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      // Should see insurance question in response
      const messages = page.locator('[data-message-role="assistant"]');
      await expect(messages.last().getByText(/insurance/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('no answer → proceeds to insurance question (not re-ask Q1)', async ({ page }) => {
      await navigateToMrdFind(page);
      
      // Answer Q1 with no
      await page.locator('input[type="text"], textarea').fill('no');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      // Should ask insurance, NOT re-ask about tissue
      const lastResponse = page.locator('[data-message-role="assistant"]').last();
      await expect(lastResponse.getByText(/insurance/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('full flow: yes → Medicare → gets recommendations with test names', async ({ page }) => {
      await navigateToMrdFind(page);
      
      // Q1: yes
      await page.locator('input[type="text"], textarea').fill('yes');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      // Q2: Medicare
      await page.locator('input[type="text"], textarea').fill('Medicare');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000);
      
      // Should have test recommendations - check for ANY test name
      const chatContent = await page.locator('.prose').last().textContent();
      const hasTestName = /Signatera|Guardant|RaDaR|FoundationOne|Pathlight|NeXT/i.test(chatContent || '');
      expect(hasTestName).toBe(true);
    });

    test('full flow: no tissue → private insurance → gets recommendations', async ({ page }) => {
      await navigateToMrdFind(page, 'Colorectal Cancer');
      
      // Q1: no
      await page.locator('input[type="text"], textarea').fill('no');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      // Q2: private
      await page.locator('input[type="text"], textarea').fill('private insurance');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000);
      
      // Should have recommendations
      const chatContent = await page.locator('.prose').last().textContent();
      const hasRecommendation = /test|option|consider|recommend/i.test(chatContent || '');
      expect(hasRecommendation).toBe(true);
    });
  });

  test.describe('TRM Journey - Find Mode Q&A Flow', () => {
    
    const navigateToTrmFind = async (page) => {
      await page.locator('select').selectOption('Lung Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Tracking Treatment Response').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
    };

    test('shows Q1 about current treatment', async ({ page }) => {
      await navigateToTrmFind(page);
      const chatArea = page.locator('.prose').first();
      await expect(chatArea.getByText(/treatment.*on|What type of treatment/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('chemo answer → proceeds to insurance', async ({ page }) => {
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
      await page.getByText('Choosing the Right Treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
    };

    test('shows Q1 about prior genomic testing', async ({ page }) => {
      await navigateToTdsFind(page);
      const chatArea = page.locator('.prose').first();
      await expect(chatArea.getByText(/genomic.*profiling|Foundation.*Medicine|Tempus/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('no answer → proceeds to insurance', async ({ page }) => {
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
      await page.getByText('Keeping Watch After Treatment').click();
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
    
    test('single word "no" is accepted as answer, not rejection', async ({ page }) => {
      await page.locator('select').selectOption('Breast Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Keeping Watch After Treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
      
      await page.locator('input[type="text"], textarea').fill('no');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      // Should proceed to Q2 (insurance), NOT end conversation or re-ask Q1
      const lastResponse = await page.locator('[data-message-role="assistant"]').last().textContent();
      expect(lastResponse?.toLowerCase()).toContain('insurance');
    });

    test('"I don\'t know" is accepted as answer', async ({ page }) => {
      await page.locator('select').selectOption('Lung Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Keeping Watch After Treatment').click();
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
    
    test('clicking test link icon opens detail modal', async ({ page }) => {
      await page.locator('select').selectOption('Breast Cancer');
      await page.waitForTimeout(500);
      await page.getByText('Keeping Watch After Treatment').click();
      await page.waitForTimeout(500);
      await page.getByText('Find the right tests for me').click();
      await page.waitForTimeout(1000);
      
      // Q1
      await page.locator('input[type="text"], textarea').fill('yes');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      
      // Q2
      await page.locator('input[type="text"], textarea').fill('Medicare');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(6000);
      
      // Look for test link icon
      const testLink = page.locator('button[title="View test details"]').first();
      if (await testLink.isVisible({ timeout: 5000 })) {
        await testLink.click();
        await page.waitForTimeout(1000);
        
        // Should open modal with test details
        await expect(page.getByText(/Clinical Performance|Methodology|Reimbursement/i).first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
