// @ts-check
const { test, expect } = require('@playwright/test');

test('happy path: log an episode and view in timeline', async ({ page }) => {
  // Navigate to local dev server. Ensure you run `npm run dev` before executing this test.
  await page.goto('http://localhost:3000');
  // Log tab should be active by default
  await expect(page.locator('nav button.active')).toHaveText('Log');
  // Fill out the log form
  const now = new Date();
  const dtValue = now.toISOString().slice(0,16);
  await page.fill('#log-datetime', dtValue);
  await page.fill('#log-intensity', '5');
  await page.fill('#log-duration', '45');
  await page.fill('#log-notes', 'Test entry');
  // click save
  await page.click('button:has-text("Save")');
  // After saving, timeline tab should be active
  await expect(page.locator('nav button.active')).toHaveText('Timeline');
  // Timeline list should contain at least one entry
  await expect(page.locator('#timeline-list .card')).toHaveCount(1);
});
