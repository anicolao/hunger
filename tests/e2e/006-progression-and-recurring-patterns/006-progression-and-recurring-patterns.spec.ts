import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture, type EpisodeFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

const recurringHistory: EpisodeFixture[] = [
  { before: 1, after: 9, localHour: 18, reason: 'craving' },
  { before: 2, after: 8, localHour: 18, reason: 'habit' },
  { before: 1, after: 8, localHour: 19, reason: 'boredom' },
  { before: 2, after: 6, localHour: 19, reason: 'physical-hunger' },
  { before: 4, after: 6, localHour: 12, reason: 'physical-hunger' },
  { before: 4, after: 6, localHour: 12, reason: 'physical-hunger' },
  { before: 5, after: 7, localHour: 13, reason: 'social-context' },
  { before: 5, after: 6, localHour: 13, reason: 'physical-hunger' }
];

async function importHistory(page: Page, daysElapsed: number) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  await page.evaluate(async (fixture) => {
    if (!window.__HUNGER_E2E__) throw new Error('E2E fixture boundary is unavailable');
    await window.__HUNGER_E2E__.importFixture(fixture);
  }, buildHistoryFixture(daysElapsed, recurringHistory));
  await page.reload();
}

test('elapsed weeks unlock a conservatively gated recurring pattern', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Progression and recurring patterns',
    'Elapsed program stages survive gaps, while a fixed eight-pair history produces a rate-gated recurring pattern and tapered reminders.'
  );
  await blockExternalRequests(context);
  await importHistory(page, 22);

  await steps.step('week-four-today', {
    description: 'Elapsed time reaches personal patterns without a streak or reset',
    verifications: [
      {
        spec: 'Day 23 is Week 4 with the personal-pattern focus',
        check: async () => {
          await expect(page.getByText('Day 23 · Week 4')).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Personal patterns' })).toBeVisible();
          await expect(page.getByText(/Look for what repeats/)).toBeVisible();
        }
      },
      {
        spec: 'Recent moments remain available after elapsed days with no compliance warning',
        check: async () => {
          await expect(page.getByRole('link').filter({ hasText: /→/ })).toHaveCount(6);
          await expect(page.getByText(/fell off|missed your goal|on track/i)).toHaveCount(0);
        }
      }
    ]
  });

  await page.goto('/insights');
  const recurring = page.locator('article').first();
  await recurring.getByText("Why you're seeing this").click();
  await steps.step('recurring-rate-pattern', {
    description: 'The strongest supported association is ranked first with exact evidence',
    verifications: [
      {
        spec: 'The urgent-start association crosses recurring and effect-size gates',
        check: async () => {
          await expect(recurring.getByText('Recurring pattern', { exact: true })).toBeVisible();
          await expect(recurring.getByText('Very hungry starts ended differently')).toBeVisible();
          await expect(recurring.getByText(/3 of 4 vs 0 of 4/)).toBeVisible();
        }
      },
      {
        spec: 'The disclosure names fixed gates and exposes all eight source episodes',
        check: async () => {
          await expect(recurring.getByText(/fixed sample and 25-point difference gates/)).toBeVisible();
          await expect(recurring.locator('details li a')).toHaveCount(8);
        }
      }
    ]
  });

  await page.goto('/settings');
  await expect(page.getByText(/Week 4 · Only pending completion prompts/)).toBeVisible();
  await page.getByRole('button', { name: 'Pause reminders' }).click();
  await expect(page.getByText('Week 4 · Paused')).toBeVisible();

  await importHistory(page, 7);
  await expect(page.getByText('Day 8 · Week 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fullness' })).toBeVisible();
  await importHistory(page, 14);
  await expect(page.getByText('Day 15 · Week 3')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hunger and wanting food' })).toBeVisible();
  steps.generateDocs();
});
