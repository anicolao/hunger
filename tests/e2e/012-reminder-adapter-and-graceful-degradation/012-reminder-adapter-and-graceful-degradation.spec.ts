import { expect, test } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';
import { initialSettings } from '$lib/data/schema';

declare global {
  interface Window {
    __reminderReconciliationCalls?: Array<{ command: string; payload: Record<string, unknown> }>;
  }
}

test('browser reminder preferences remain honest about unavailable background delivery', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Reminder adapter and graceful degradation', 'Reminder settings taper with the program and accurately describe browser capability.');
  await blockExternalRequests(context);
  const fixture = buildHistoryFixture(2, [{ before: 3, after: 6, localHour: 12 }]);
  fixture.settings = { ...initialSettings };
  await page.goto('/'); await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), fixture);
  await page.goto('/settings');
  await expect(page.getByText(/Week 1 · Up to two/)).toBeVisible();
  await page.getByLabel('Morning').check();
  const morningSwitch = page.getByLabel('Morning').locator('xpath=following-sibling::span');
  await expect(morningSwitch).toHaveCSS('width', '51px');
  await expect(morningSwitch).toHaveCSS('height', '31px');
  await expect(morningSwitch).toHaveCSS('background-color', 'rgb(52, 199, 89)');
  await expect(page.getByRole('button', { name: 'Allow iOS reminders' })).toBeEnabled();
  await page.getByRole('button', { name: 'Allow iOS reminders' }).click();

  await steps.step('honest-browser-reminder', {
    description: 'A selected window is retained without making a false browser scheduling claim',
    verifications: [
      { spec: 'The adapter is triggered only after a window is selected', check: async () => expect(page.getByLabel('Morning')).toBeChecked() },
      { spec: 'Reminder choices retain checkbox semantics in an iOS-sized switch', check: async () => expect(morningSwitch).toHaveCSS('width', '51px') },
      { spec: 'The app says browser background reminders are unavailable', check: async () => expect(page.getByRole('status')).toHaveText('Background reminders are unavailable in this browser. Your window preferences are still saved on this device.') },
      { spec: 'Pause is available and no native scheduling claim is rendered', check: async () => { await expect(page.getByRole('button', { name: 'Pause reminders' })).toBeVisible(); await expect(page.getByText(/notification scheduled|will notify you/i)).toHaveCount(0); } }
    ]
  });

  const weekFour = buildHistoryFixture(22, [{ before: 3, after: 6, localHour: 12 }]);
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), weekFour);
  await page.reload();
  await expect(page.getByText('Week 4 · One experiment reminder while an experiment is active')).toBeVisible();
  await page.getByRole('button', { name: 'Pause reminders' }).click();
  await expect(page.getByText('Week 4 · Paused')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Reminder preferences are paused.');

  await context.addInitScript(() => {
    const calls: Array<{ command: string; payload: Record<string, unknown> }> = [];
    window.__reminderReconciliationCalls = calls;
    window.hungerNative = {
      request: async (command: string, payload: Record<string, unknown> = {}) => {
        calls.push({ command, payload });
        if (command === 'capabilities.get') {
          return {
            version: 1,
            platform: 'ios',
            commands: [
              'notifications.authorizationStatus',
              'notifications.requestAuthorization',
              'notifications.replaceSchedule',
              'notifications.cancelAll'
            ]
          };
        }
        if (command === 'notifications.authorizationStatus') return { status: 'authorized' };
        if (command === 'notifications.replaceSchedule') {
          const schedule = payload.schedule as { items: unknown[] };
          return { scheduled: schedule.items.length };
        }
        if (command === 'notifications.cancelAll') return { cancelled: true };
        throw new Error(`Unexpected native command: ${command}`);
      }
    };
  });
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), fixture);
  await page.reload();
  await page.getByLabel('Morning').check();
  await page.getByLabel('Midday').check();
  await page.getByLabel('Evening').check();
  await expect(page.getByRole('status')).toHaveText('Choose up to two reminder windows.');
  await page.getByRole('button', { name: 'Pause reminders' }).click();
  await expect(page.getByRole('status')).toHaveText('Private iOS reminders are paused.');
  await page.getByRole('button', { name: 'Resume reminders' }).click();
  await expect(page.getByRole('status')).toHaveText('Scheduled 2 private iOS reminders.');

  await steps.step('native-schedule-reconciliation', {
    description: 'Every settings transition replaces the complete desired native schedule',
    verifications: [
      {
        spec: 'Two selected windows reconcile immediately without an extra apply action',
        check: async () => {
          const schedules = await page.evaluate(() =>
            window.__reminderReconciliationCalls
              ?.filter(({ command }) => command === 'notifications.replaceSchedule')
              .map(({ payload }) => payload.schedule as { items: unknown[] }) ?? []
          );
          expect(schedules.map(({ items }) => items.length)).toEqual([1, 2, 0, 2]);
        }
      },
      {
        spec: 'Resume restores the desired schedule and the UI retains both choices',
        check: async () => {
          await expect(page.getByLabel('Morning')).toBeChecked();
          await expect(page.getByLabel('Midday')).toBeChecked();
          await expect(page.getByRole('button', { name: 'Pause reminders' })).toBeVisible();
        }
      }
    ]
  });
  steps.generateDocs();
});
