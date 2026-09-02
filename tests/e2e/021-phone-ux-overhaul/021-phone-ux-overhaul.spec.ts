import { expect, test } from '@playwright/test';
import { blockExternalRequests, expectAboveFold } from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

test('the compact phone journey preserves its action geometry in both appearances', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'The canonical UX contract is the 393 × 852 phone viewport.');
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Phone UX overhaul',
    'The complete setup and daily shell fit the primary phone viewport, with identical semantics in deliberate light and dark appearances.'
  );
  await blockExternalRequests(context);
  await page.goto('/onboarding');
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'ready');

  await page.getByRole('radio', { name: /Light/ }).click();
  await expectAboveFold(page, page.getByRole('button', { name: 'Use light mode' }));
  await page.getByRole('button', { name: 'Use light mode' }).click();
  await expectAboveFold(page, page.getByRole('button', { name: 'Begin' }));
  await page.getByRole('button', { name: 'Begin' }).click();
  await expectAboveFold(page, page.getByRole('button', { name: 'Continue' }));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectAboveFold(page, page.getByRole('button', { name: 'Continue' }));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expectAboveFold(page, page.getByRole('button', { name: 'Start day 1' }));
  await page.getByRole('button', { name: 'Start day 1' }).click();

  const lightAction = page.getByRole('link', { name: 'Check in before eating' });
  await expectAboveFold(page, lightAction);
  const lightBox = await lightAction.boundingBox();
  await steps.step('light-decision-viewport', {
    description: 'Light mode keeps Today’s action and both glanceable summaries in one viewport',
    verifications: [
      { spec: 'The primary action is completely above the phone fold', check: async () => expectAboveFold(page, lightAction) },
      { spec: 'Moments and week focus are visible without scrolling', check: async () => {
        await expect(page.getByText('No moments yet')).toBeInViewport();
        await expect(page.getByRole('heading', { name: 'Hunger' })).toBeInViewport();
      } }
    ]
  });

  await lightAction.click();
  await page.getByRole('radio', { name: /^4,/ }).check();
  await expectAboveFold(page, page.getByRole('button', { name: 'Save', exact: true }));
  await expect(page.getByRole('button', { name: 'Add optional context' })).toBeInViewport();

  await page.goto('/settings');
  for (const name of ['Appearance', 'Reminders', 'Program & scale', 'Your data', 'Accessibility', 'Support']) {
    await expect(page.getByText(name, { exact: true }).first()).toBeInViewport();
  }
  await steps.step('settings-hub', {
    description: 'Settings presents every top-level choice as a one-screen hub',
    verifications: [
      { spec: 'Appearance and all five focused categories are visible in the phone viewport', check: async () => {
        for (const name of ['Appearance', 'Reminders', 'Program & scale', 'Your data', 'Accessibility', 'Support']) {
          await expect(page.getByText(name, { exact: true }).first()).toBeInViewport();
        }
      } },
      { spec: 'The build identity remains confined to Settings', check: async () => expect(page.getByTestId('build-marker')).toBeAttached() }
    ]
  });
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.getByText('Dark appearance saved.')).toBeVisible();
  await page.evaluate(() => window.__HUNGER_E2E__?.replayEvents());
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');

  const darkAction = page.getByRole('link', { name: 'Check in before eating' });
  await expectAboveFold(page, darkAction);
  const darkBox = await darkAction.boundingBox();
  expect(darkBox?.width).toBe(lightBox?.width);
  expect(darkBox?.height).toBe(lightBox?.height);
  await steps.step('dark-decision-viewport', {
    description: 'Event-replayed dark mode changes material, not content or action geometry',
    verifications: [
      { spec: 'Dark appearance survives projection replay and relaunch', check: async () => expect(page.locator('html')).toHaveAttribute('data-theme', 'dark') },
      { spec: 'The dark primary action retains the light layout geometry above the fold', check: async () => expectAboveFold(page, darkAction) }
    ]
  });
  steps.generateDocs();
});
