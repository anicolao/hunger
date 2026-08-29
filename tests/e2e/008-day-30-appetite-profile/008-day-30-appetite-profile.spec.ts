import { expect, test, type Download, type Page } from '@playwright/test';
import type { ExperimentRecord } from '$lib/data/schema';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture, E2E_NOW } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

const history = [
  { before: 1, after: 9, localHour: 19, reason: 'emotion' as const },
  { before: 2, after: 8, localHour: 19, reason: 'craving' as const },
  { before: 1, after: 8, localHour: 19, reason: 'habit' as const },
  { before: 2, after: 6, localHour: 19, reason: 'social-context' as const },
  { before: 4, after: 6, localHour: 12, reason: 'physical-hunger' as const },
  { before: 4, after: 6, localHour: 12, reason: 'physical-hunger' as const },
  { before: 5, after: 7, localHour: 13, reason: 'physical-hunger' as const },
  { before: 5, after: 6, localHour: 13, reason: 'physical-hunger' as const }
];

async function importFixture(page: Page, fixture: ReturnType<typeof buildHistoryFixture>) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  await page.evaluate(async (value: typeof fixture) => window.__HUNGER_E2E__?.importFixture(value), fixture);
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

const experiment: ExperimentRecord = {
  id: 'completed-experiment', programId: 'fixture-program', insightId: 'urgent-start-association-overall-v1', kind: 'eat-earlier-noticing',
  startedAt: E2E_NOW - 14 * 86_400_000, endedAt: E2E_NOW - 7 * 86_400_000,
  baselineEpisodeIds: ['fixture-episode-1', 'fixture-episode-2', 'fixture-episode-3', 'fixture-episode-4'],
  target: { label: 'Notice hunger a little earlier', measure: 'uncomfortable-ending-rate', direction: 'lower', days: 7 },
  status: 'complete', result: { state: 'changed', baselineCount: 3, baselineTotal: 4, experimentCount: 0, experimentTotal: 4 }, algorithmVersion: 1
};

test('day 30 assembles only supported profile sections and private exports', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Day-30 Appetite Profile', 'The finite program ends with an evidence-labelled profile that remains locally accessible and exportable.');
  await blockExternalRequests(context);

  const sparse = buildHistoryFixture(30, history.slice(4));
  await importFixture(page, sparse);
  await page.goto('/profile');
  await expect(page.getByText('No time or occasion comparison has enough evidence yet.')).toBeVisible();
  await expect(page.getByText('No completed experiment comparison yet.')).toBeVisible();

  const complete = { ...buildHistoryFixture(30, history), experiments: [experiment] };
  complete.episodes[0].photoId = 'secret-local-photo-id';
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), complete);
  await page.goto('/profile');

  await steps.step('supported-day-30-profile', {
    description: 'Day 30 ends the guide and assembles only evidence-supported sections',
    verifications: [
      { spec: 'Program completion does not lock records or imply a streak', check: async () => {
        await expect(page.getByText('Day 30 of 30')).toBeVisible();
        await expect(page.getByText(/completes the guided program, not your access/)).toBeVisible();
        await expect(page.getByText(/streak|on track|missed your goal/i)).toHaveCount(0);
      } },
      { spec: 'Start, end, context, reason, and experiment sections each show evidence', check: async () => {
        await expect(page.getByRole('heading', { name: 'Typical starting sensation' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Context pattern' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Experiment comparison' })).toBeVisible();
        await expect(page.getByText('Based on 8')).toHaveCount(3);
      } },
      { spec: 'Continuing practices come from supported patterns', check: async () => expect(page.getByRole('heading', { name: 'Practices to keep' })).toBeVisible() }
    ]
  });

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const jsonDownload = await jsonDownloadPromise;
  const json = await downloadText(jsonDownload);
  expect(jsonDownload.suggestedFilename()).toBe('appetite-profile.json');
  expect(JSON.parse(json).exportVersion).toBe(1);
  expect(json).not.toContain('secret-local-photo-id');
  expect(json).not.toContain('photoId');

  const htmlDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download readable profile' }).click();
  const htmlDownload = await htmlDownloadPromise;
  const html = await downloadText(htmlDownload);
  expect(htmlDownload.suggestedFilename()).toBe('appetite-profile.html');
  expect(html).toContain('<h1>My Appetite Profile</h1>');
  expect(html).not.toContain('secret-local-photo-id');

  await steps.step('private-export', {
    description: 'Readable and structured exports are explicit and exclude photos by default',
    verifications: [
      { spec: 'Both downloads use stable names and the structured export declares version 1', check: async () => expect(page.getByText(/Photos are excluded by default/)).toBeVisible() },
      { spec: 'Neither downloaded representation contains the local photo identifier', check: async () => expect(page.getByRole('button', { name: 'Download JSON' })).toBeVisible() }
    ]
  });
  steps.generateDocs();
});
