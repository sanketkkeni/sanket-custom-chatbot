import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const BASE = 'https://sanket-custom-chatbot.vercel.app';
const email = 'skkeni06@gmail.com';
const password = 'Test@123456';

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(5000);

  const chatButton = page.getByRole('button', { name: 'Chat' }).first();
  await chatButton.click();
  await page.waitForTimeout(5000);

  const chatInput = page.locator('input').last();
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  await chatInput.fill('explain Stefan-Boltzmann Law');
  await chatInput.press('Enter');

  await page.waitForSelector('text=/Sources/i', { timeout: 45000 });
  await page.waitForTimeout(2000);

  // Get the assistant message HTML
  const assistantDivs = page.locator('div.bg-dark-700');
  const ac = await assistantDivs.count();
  for (let i = 0; i < ac; i++) {
    const html = await assistantDivs.nth(i).innerHTML();
    console.log(`=== Assistant ${i} sources section ===`);
    // Extract just the sources part
    const srcMatch = html.match(/<div class="mt-3[^"]*"[^>]*>[\s\S]*/);
    if (srcMatch) {
      console.log(srcMatch[0]);
    }
  }

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await browser.close();
}
