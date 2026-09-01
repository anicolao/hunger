import { expect, test } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

test('repeated strong discomfort opens a quiet, dismissible support path', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Safety and non-judgmental states', 'Repeated high-discomfort endings prompt options, never a diagnosis or alarm.');
  await blockExternalRequests(context);
  const fixture = buildHistoryFixture(18, [
    { before: 2, after: 9, localHour: 12 }, { before: 3, after: 6, localHour: 13 },
    { before: 4, after: 10, localHour: 18 }, { before: 5, after: 7, localHour: 19 },
    { before: 3, after: 9, localHour: 20 }, { before: 4, after: 6, localHour: 8 }
  ]);
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), fixture);
  await page.goto('/settings');

  await steps.step('quiet-support-card', {
    description: 'A calm card offers pause, dismissal, and outside support after repeated discomfort',
    verifications: [
      { spec: 'The copy observes recent discomfort without diagnosis, alarm, or moral judgement', check: async () => { const card = page.getByRole('complementary'); await expect(card.getByRole('heading', { name: 'Would a pause or extra support feel useful?' })).toBeVisible(); await expect(card.getByText(/qualified healthcare professional can help/)).toBeVisible(); } },
      { spec: 'Pause, learning, and dismissal remain independent choices', check: async () => { await expect(page.getByRole('complementary').getByRole('button', { name: 'Pause check-ins' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Learn about support' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible(); } },
      { spec: 'Rendered copy contains no forbidden achievement or eating-morality language', check: async () => { const text = await page.locator('body').innerText(); expect(text).not.toMatch(/\b(clean|cheat|failed|perfect|on track|fell off|missed your goal)\b/i); } }
    ]
  });

  await page.getByRole('complementary').getByRole('button', { name: 'Pause check-ins' }).click();
  await expect(page.getByText(/guided program is paused/)).toBeVisible();
  await page.reload(); await expect(page.getByText(/guided program is paused/)).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Would a pause or extra support feel useful?' })).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Would a pause or extra support feel useful?' })).toHaveCount(0);
  steps.generateDocs();
});
