import { expect, test } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

test('browser reminders save an exact in-app prompt without promising background delivery', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Reminder adapter and graceful degradation', 'Reminder settings taper with the program and accurately describe browser capability.');
  await blockExternalRequests(context);
  const fixture = buildHistoryFixture(2, [{ before: 3, after: 6, localHour: 12 }]);
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), fixture);
  await page.goto('/settings');
  await expect(page.getByText(/Week 1 · Up to two/)).toBeVisible();
  await page.getByLabel('Morning').check();
  await expect(page.getByRole('button', { name: 'Use in-app reminders' })).toBeEnabled();
  await page.getByRole('button', { name: 'Use in-app reminders' }).click();

  await steps.step('honest-browser-reminder', {
    description: 'A user-selected window becomes an in-app prompt with an explicit capability limit',
    verifications: [
      { spec: 'The adapter is triggered only after a window is selected', check: async () => expect(page.getByLabel('Morning')).toBeChecked() },
      { spec: 'The app says it cannot promise delivery while closed', check: async () => expect(page.getByRole('status')).toHaveText('Saved as an in-app prompt. This browser cannot promise a reminder while the app is closed.') },
      { spec: 'Pause is available and no native scheduling claim is rendered', check: async () => { await expect(page.getByRole('button', { name: 'Pause reminders' })).toBeVisible(); await expect(page.getByText(/notification scheduled|will notify you/i)).toHaveCount(0); } }
    ]
  });

  const weekFour = buildHistoryFixture(22, [{ before: 3, after: 6, localHour: 12 }]);
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), weekFour);
  await page.reload();
  await expect(page.getByText('Week 4 · Only pending completion prompts')).toBeVisible();
  await page.getByRole('button', { name: 'Pause reminders' }).click();
  await expect(page.getByText('Week 4 · Paused')).toBeVisible();
  steps.generateDocs();
});
