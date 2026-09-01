import { expect, test, type Page } from '@playwright/test';
import type { ExperimentRecord } from '$lib/data/schema';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture, E2E_NOW } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

const DAY = 86_400_000;
const history = [
  { before: 1, after: 9, localHour: 18 }, { before: 2, after: 8, localHour: 18 },
  { before: 1, after: 8, localHour: 19 }, { before: 2, after: 6, localHour: 19 },
  { before: 4, after: 6, localHour: 12 }, { before: 4, after: 6, localHour: 12 },
  { before: 5, after: 7, localHour: 13 }, { before: 5, after: 6, localHour: 13 }
] as const;

function experiment(startedAt: number, status: ExperimentRecord['status'] = 'active'): ExperimentRecord {
  return {
    id: 'timed-experiment',
    programId: 'fixture-program',
    insightId: 'urgent-start-association-overall-v1',
    kind: 'eat-earlier-noticing',
    startedAt,
    endedAt: status === 'complete' ? E2E_NOW : null,
    baselineEpisodeIds: ['fixture-episode-1', 'fixture-episode-2', 'fixture-episode-3', 'fixture-episode-4'],
    target: {
      label: 'Notice hunger a little earlier',
      measure: 'uncomfortable-ending-rate',
      direction: 'lower',
      days: 7
    },
    status,
    result: status === 'complete'
      ? { state: 'similar', baselineCount: 3, baselineTotal: 4, experimentCount: 3, experimentTotal: 4 }
      : null,
    algorithmVersion: 1
  };
}

async function importFixture(page: Page, value: ReturnType<typeof buildHistoryFixture>) {
  await page.evaluate(async (fixture) => window.__HUNGER_E2E__?.importFixture(fixture), value);
}

test('an experiment remains secondary on Today until its seven-day comparison is ready', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Timed experiment on Today',
    'A predeclared experiment stays optional, cannot finish early, and becomes an honest comparison after seven local days.'
  );
  await blockExternalRequests(context);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');

  const baseFixture = buildHistoryFixture(22, [...history]);
  await importFixture(page, { ...baseFixture, experiments: [experiment(E2E_NOW)] });
  await page.goto('/');

  await steps.step('secondary-action-and-early-gate', {
    description: 'Today keeps the check-in primary while exposing reversible experiment controls',
    verifications: [
      { spec: 'The active experiment is a secondary card with pause and stop controls', check: async () => {
        await expect(page.getByRole('heading', { name: 'Begin with how your body feels.' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Notice hunger a little earlier' })).toBeVisible();
        await page.getByRole('button', { name: 'Pause' }).click();
        await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
        await page.getByRole('button', { name: 'Resume' }).click();
      } },
      { spec: 'The comparison remains disabled before seven local calendar days', check: async () => {
        await page.getByRole('link', { name: 'View experiment' }).click();
        await expect(page.getByRole('button', { name: 'Compare in 7 days' })).toBeDisabled();
      } }
    ]
  });

  await importFixture(page, { ...baseFixture, experiments: [experiment(E2E_NOW - 7 * DAY)] });
  await page.goto('/');
  await page.getByRole('link', { name: 'View the comparison' }).click();
  await expect(page.getByText(/observation, not proof/)).toBeVisible();
  const replay = await page.evaluate(async () => window.__HUNGER_E2E__?.replayEvents());
  expect(replay?.eventTypes).toContain('experiment/changed');
  await page.reload();

  await steps.step('calendar-completion-and-replay', {
    description: 'The seventh local day materializes one neutral result through the append-only event log',
    verifications: [
      { spec: 'Today promotes the comparison only after the complete interval', check: async () => {
        await expect(page.getByRole('heading', { name: /Appeared to change|Appeared similar|Still learning/ })).toBeVisible();
      } },
      { spec: 'Projection replay retains the fixed baseline, target, and result', check: async () => {
        await expect(page.getByText(/Before/)).toBeVisible();
        await expect(page.getByText(/During/)).toBeVisible();
        await expect(page.getByText(/not proof that the practice caused/)).toBeVisible();
      } }
    ]
  });

  for (const state of ['changed', 'similar', 'learning'] as const) {
    const completed = experiment(E2E_NOW - 7 * DAY, 'complete');
    completed.result = { ...completed.result!, state };
    await importFixture(page, { ...baseFixture, experiments: [completed] });
    await page.goto('/experiment');
    await expect(page.getByRole('heading', {
      name: state === 'changed' ? 'Appeared to change' : state === 'similar' ? 'Appeared similar' : 'Still learning'
    })).toBeVisible();
  }
  steps.generateDocs();
});
