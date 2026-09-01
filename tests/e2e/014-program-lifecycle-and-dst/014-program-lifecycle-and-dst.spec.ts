import { expect, test } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

test('program pause, calendar completion, and restart stay authoritative', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Program lifecycle and local calendar progression',
    'Pause blocks new check-ins, day 30 completes from any route, and restart requires explicit confirmation.'
  );
  await blockExternalRequests(context);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');

  const paused = buildHistoryFixture(10, []);
  paused.program.status = 'paused';
  await page.evaluate(async (fixture) => window.__HUNGER_E2E__?.importFixture(fixture), paused);
  await page.goto('/');

  await steps.step('paused-program-retains-history', {
    description: 'A paused program keeps its calendar and history while removing the new check-in action',
    verifications: [
      { spec: 'Today explains the pause without streak or failure language', check: async () => {
        await expect(page.getByRole('heading', { name: 'Your history is still here.' })).toBeVisible();
        await expect(page.getByText(/calendar continues without a streak/)).toBeVisible();
      } },
      { spec: 'No new before-eating check-in action is available while paused', check: async () => {
        await expect(page.getByRole('link', { name: 'Check in before eating' })).toHaveCount(0);
      } }
    ]
  });

  await page.getByRole('link', { name: 'Review program settings' }).click();
  await page.getByRole('button', { name: 'Resume check-ins' }).click();
  await expect(page.getByRole('button', { name: 'Pause check-ins' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Check in before eating' })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Pause check-ins' }).click();
  await expect(page.getByRole('button', { name: 'Resume check-ins' })).toBeVisible();
  await page.goto('/check-in/new');
  await expect(page.getByRole('heading', { name: 'Your program is taking a pause.' })).toBeVisible();

  const day30 = buildHistoryFixture(29, []);
  day30.program.status = 'active';
  await page.evaluate(async (fixture) => window.__HUNGER_E2E__?.importFixture(fixture), day30);
  await page.goto('/settings');
  await expect(page.getByText('Day 30 of 30')).toBeVisible();
  await expect(page.getByText(/30-day guide is complete/)).toBeVisible();
  await page.getByRole('button', { name: 'Start a new 30-day program' }).click();
  await expect(page.getByRole('heading', { name: 'Start a new 30-day program?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start new program' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I understand this starts a new program' }).check();
  await page.getByRole('button', { name: 'Start new program' }).click();

  await steps.step('confirmed-restart-begins-day-one', {
    description: 'A confirmed restart begins a fresh day-one projection without deleting prior source events',
    verifications: [
      { spec: 'Today renders the new program at day 1 with check-ins available', check: async () => {
        await expect(page.getByText('Day 1 · Week 1')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Check in before eating' })).toBeVisible();
      } },
      { spec: 'Playback retains both program starts and the completion transition', check: async () => {
        const replay = await page.evaluate(async () => window.__HUNGER_E2E__?.replayEvents());
        expect(replay?.eventTypes.filter((type) => type === 'program/started')).toHaveLength(2);
        expect(replay?.eventTypes).toContain('program/status-changed');
      } }
    ]
  });
  steps.generateDocs();
});
