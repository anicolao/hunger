import { expect, test } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

test('insight publication stays conservative and history stays immutable', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Insight history and evidence',
    'Constant or outlier-only data makes no claim; a supported observation publishes once and retains honest history after its sources change.'
  );
  await blockExternalRequests(context);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');

  const constant = buildHistoryFixture(10, Array.from({ length: 4 }, (_, index) => ({
    before: 4,
    after: 6,
    localHour: 12 + index
  })));
  await page.evaluate(async (fixture) => window.__HUNGER_E2E__?.importFixture(fixture), constant);
  await page.goto('/insights');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await steps.step('no-variation-no-claim', {
    description: 'A constant history remains in the learning state',
    verifications: [
      { spec: 'No personalized observation is created without variation', check: async () => {
        await expect(page.locator('article')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: /More varied moments may support an observation/ })).toBeVisible();
      } },
      { spec: 'The UI does not turn a constant value into advice', check: async () => {
        await expect(page.getByText(/you should|caused|try eating/i)).toHaveCount(0);
      } }
    ]
  });

  const supported = buildHistoryFixture(18, [
    { before: 1, after: 9, localHour: 18 }, { before: 2, after: 8, localHour: 18 },
    { before: 1, after: 8, localHour: 19 }, { before: 2, after: 6, localHour: 19 },
    { before: 4, after: 6, localHour: 12 }, { before: 4, after: 6, localHour: 12 },
    { before: 5, after: 7, localHour: 13 }, { before: 5, after: 6, localHour: 13 }
  ]);
  await page.evaluate(async (fixture) => window.__HUNGER_E2E__?.importFixture(fixture), supported);
  await page.goto('/insights');
  const current = page.locator('article').first();
  await expect(page.locator('article')).toHaveCount(1);
  await current.getByRole('button', { name: 'Helpful' }).click();
  await expect(current.getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true');
  await current.getByText("Why you're seeing this").click();
  await current.locator('details li a').first().click();
  await page.getByRole('button', { name: 'Edit check-in' }).click();
  await page.getByRole('group', { name: 'Before eating' }).getByRole('radio', { name: /^3,/ }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Check-in updated. Your observations may update too.')).toBeVisible();
  await page.goto('/insights');
  await expect(page.getByText(/source records changed after this was shown/)).toBeVisible();

  const history = page.getByRole('region', { name: 'Observation history' });
  await history.getByText('Historical evidence').click();
  await history.getByRole('link').first().click();
  await page.getByRole('button', { name: 'Delete this check-in' }).click();
  await page.getByLabel('I understand this cannot be undone').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete this check-in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Rebuild local views' }).click();
  await expect(page.getByText('Local views were rebuilt from the source event log.')).toBeVisible();
  await page.goto('/insights');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await steps.step('immutable-history-after-source-changes', {
    description: 'The saved observation survives edits, deletion, and projection replay with explicit provenance',
    verifications: [
      { spec: 'Deleted evidence is labeled without rewriting the historical finding', check: async () => {
        await expect(page.getByText(/source records were deleted/)).toBeVisible();
        await expect(page.getByText('Very hungry starts ended differently')).toBeVisible();
      } },
      { spec: 'History retains evidence count, algorithm version, and optional feedback', check: async () => {
        await expect(page.getByText(/Algorithm v1 · 8 source records/)).toBeVisible();
        await page.getByRole('region', { name: 'Observation history' }).getByText('Historical evidence').click();
        await expect(page.getByText('Feedback: Helpful')).toBeVisible();
        await expect(page.getByText('Deleted source record')).toBeVisible();
      } },
      { spec: 'Rebuilding projections does not resurrect deleted current evidence', check: async () => {
        await expect(page.locator('article')).toHaveCount(0);
      } }
    ]
  });
  steps.generateDocs();
});
