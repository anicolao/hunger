import { expect, test, type Page } from '@playwright/test';
import type { ExperimentRecord } from '$lib/data/schema';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture, E2E_NOW } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

const history = [
  { before: 1, after: 9, localHour: 19 },
  { before: 2, after: 8, localHour: 19 },
  { before: 1, after: 8, localHour: 19 },
  { before: 2, after: 6, localHour: 19 },
  { before: 4, after: 6, localHour: 12 },
  { before: 4, after: 6, localHour: 12 },
  { before: 5, after: 7, localHour: 13 },
  { before: 5, after: 6, localHour: 13 }
] as const;

async function importFixture(page: Page, fixture: ReturnType<typeof buildHistoryFixture>) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  await page.evaluate(async (value: typeof fixture) => window.__HUNGER_E2E__?.importFixture(value), fixture);
}

function completedExperiment(state: 'changed' | 'similar' | 'learning'): ExperimentRecord {
  const values = state === 'changed' ? [4, 4] : state === 'similar' ? [3, 4] : [3, 2];
  return {
    id: `experiment-${state}`,
    programId: 'fixture-program',
    insightId: 'urgent-start-association-overall-v1',
    kind: 'eat-earlier-noticing',
    startedAt: E2E_NOW - 7 * 86_400_000,
    endedAt: E2E_NOW,
    baselineEpisodeIds: ['fixture-episode-1', 'fixture-episode-2', 'fixture-episode-3', 'fixture-episode-4'],
    target: { label: 'Notice hunger a little earlier', measure: 'uncomfortable-ending-rate', direction: 'lower', days: 7 },
    status: 'complete',
    result: { state, baselineCount: 4, baselineTotal: 4, experimentCount: values[0], experimentTotal: values[1] },
    algorithmVersion: 1
  };
}

test('a supported observation can become one optional experiment and a neutral comparison', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Experiment lifecycle', 'A passed observation can offer one optional, stoppable, non-causal seven-day comparison.');
  await blockExternalRequests(context);
  const fixture = buildHistoryFixture(22, [...history]);
  await importFixture(page, fixture);
  await page.goto('/insights');
  await page.locator('article').first().getByRole('link', { name: /Try a 7-day/ }).click();

  await steps.step('supported-offer', {
    description: 'The highest-priority supported pattern offers a fixed and fully optional practice',
    verifications: [
      { spec: 'The offer states seven days, the practice, exact comparison, and non-causal rationale', check: async () => {
        await expect(page.getByRole('heading', { name: 'Notice hunger a little earlier' })).toBeVisible();
        await page.getByText('Why this experiment?').click();
        await expect(page.getByText(/does not prove a cause/)).toBeVisible();
        await expect(page.getByText(/share ending at 8 or above/)).toBeVisible();
      } },
      { spec: 'Not now returns to insights without creating an experiment', check: async () => {
        await page.getByRole('link', { name: 'Not now' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
        await page.locator('article').first().getByRole('link', { name: /Try a 7-day/ }).click();
      } }
    ]
  });

  await page.getByRole('button', { name: 'Start experiment' }).click();
  await expect(page.getByText('In progress')).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused')).toBeVisible();
  await page.getByRole('button', { name: 'Resume experiment' }).click();
  await steps.step('one-active-experiment', {
    description: 'One record is active and remains freely pausable or stoppable',
    verifications: [
      { spec: 'The active view names its baseline and offers pause, timed comparison, and stop paths', check: async () => {
        await expect(page.getByText(/7 recent paired check-ins/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Compare in 7 days' })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Stop without a result' })).toBeVisible();
      } }
    ]
  });

  for (const state of ['changed', 'similar', 'learning'] as const) {
    const resultFixture = { ...fixture, experiments: [completedExperiment(state)] };
    await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), resultFixture);
    await page.goto('/experiment');
    await expect(page.getByRole('heading', { name: state === 'changed' ? 'Appeared to change' : state === 'similar' ? 'Appeared similar' : 'Still learning' })).toBeVisible();
    await expect(page.getByText(/This comparison is an observation, not proof/)).toBeVisible();
    if (state === 'learning') await expect(page.getByText(/a few more paired check-ins/)).toBeVisible();
  }

  const changedFixture = { ...fixture, experiments: [completedExperiment('changed')] };
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), changedFixture);
  await page.goto('/experiment');
  await steps.step('neutral-comparison', {
    description: 'Completed results report only the predeclared measure with cautious language',
    verifications: [
      { spec: 'Changed, similar, and still-learning states were all rendered from deterministic records', check: async () => expect(page.getByRole('heading', { name: 'Appeared to change' })).toBeVisible() },
      { spec: 'The result shows before and during counts and explicitly rejects causality', check: async () => {
        await expect(page.getByText('4 of 4')).toHaveCount(2);
        await expect(page.getByText(/not proof that the practice caused/)).toBeVisible();
      } }
    ]
  });
  steps.generateDocs();
});
