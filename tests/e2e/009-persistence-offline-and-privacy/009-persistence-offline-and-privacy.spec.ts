import { expect, test, type Page } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

test.use({ serviceWorkers: 'allow' });

async function importFixture(page: Page, fixture: ReturnType<typeof buildHistoryFixture>) {
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  await page.evaluate(async (value: typeof fixture) => window.__HUNGER_E2E__?.importFixture(value), fixture);
}

test('private records migrate, survive offline, and can be physically cleared', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Persistence, offline, and privacy', 'Legacy local records remain useful offline, while deletion is deliberate and complete.');
  await blockExternalRequests(context);
  const legacy = buildHistoryFixture(10, [
    { before: 3, after: 6, localHour: 8 }, { before: 4, after: 7, localHour: 12 },
    { before: 3, after: 6, localHour: 18 }, { before: 5, after: 7, localHour: 20 }
  ]);
  await importFixture(page, legacy);
  await page.goto('/settings');
  await expect(page.getByText('4 local eating moments.')).toBeVisible();
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event('offline')));

  await steps.step('private-and-offline', {
    description: 'Version-one records migrate through the real repository and reopen without a network',
    verifications: [
      { spec: 'The offline shell reports its real state and retains all four local moments', check: async () => { await expect(page.getByText('App ready offline')).toBeVisible(); await expect(page.getByText('4 local eating moments.')).toBeVisible(); } },
      { spec: 'Privacy copy names browser-profile visibility and provides export access', check: async () => { await expect(page.getByText(/not end-to-end encrypted/)).toBeVisible(); await expect(page.getByRole('link', { name: 'Export profile and data' })).toBeVisible(); } }
    ]
  });

  await context.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.reload();
  await expect(page.getByText('4 local eating moments.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await steps.step('deliberate-delete-all', {
    description: 'Delete-all enumerates every private category and stays disabled without confirmation',
    verifications: [
      { spec: 'The dialog includes records, photos, settings, reminders, and cached app data', check: async () => expect(page.getByText(/check-ins, photos, insights, experiments, settings, reminders, and cached app data/)).toBeVisible() },
      { spec: 'The destructive control requires an explicit irreversible confirmation', check: async () => expect(page.getByRole('dialog').getByRole('button', { name: 'Delete everything' })).toBeDisabled() }
    ]
  });
  await page.getByLabel('I understand this cannot be undone').check();
  await Promise.all([page.waitForURL(/\/$/), page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click()]);
  await expect(page.getByRole('heading', { name: 'Learn your appetite.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Begin the 30-day program' })).toBeVisible();
  steps.generateDocs();
});
