import { test, expect } from '@playwright/test';

const BASE = 'https://sanket-custom-chatbot.vercel.app';

test.describe('Chat Source Display', () => {
  test('should show sources with metadata when asking a question', async ({ page }) => {
    const email = 'skkeni06@gmail.com';
    const password = 'Test@123456';

    // Login
    await page.goto(`${BASE}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for dashboard
    await expect(page.locator('h1')).toContainText('Knowledge Bases', { timeout: 15000 });

    // Go to chat page for the KB
    await page.goto(`${BASE}/chat/kb-f45697583d10`);
    await page.waitForTimeout(3000);

    // Type a question
    const input = page.locator('input[placeholder="Ask a question..."]');
    await input.fill('explain Stefan-Boltzmann Law');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(15000);

    // Check the last assistant message for sources
    const assistantMessages = page.locator('text=Sources:');
    const count = await assistantMessages.count();
    console.log(`Found ${count} source sections`);

    // Take a screenshot
    await page.screenshot({ path: 'chat-response.png', fullPage: true });

    // Check sources content
    if (count > 0) {
      const lastSources = assistantMessages.last().locator('..');
      const sourceText = await lastSources.textContent();
      console.log('Sources content:', sourceText);

      // Check if sources have chunk IDs or page numbers
      const hasBrackets = sourceText?.includes('[');
      const hasPageNum = sourceText?.includes('p.');
      console.log(`Has chunk IDs: ${hasBrackets}`);
      console.log(`Has page numbers: ${hasPageNum}`);
    }

    // Print all assistant message content
    const allText = await page.locator('.whitespace-pre-wrap').allTextContents();
    for (const t of allText) {
      console.log('--- message ---');
      console.log(t.substring(0, 500));
    }
  });
});
