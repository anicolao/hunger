import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('application shell presents the Learn Your Appetite promise', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Application shell and landing promise',
    'The static Learn Your Appetite client loads a responsive, accessible explanation of the 30-day program.'
  );

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') throw new Error(`external request blocked: ${url}`);
    await route.continue();
  });

  await page.goto('/');
  await steps.step('landing-page', {
    description: 'The 30-day learning promise is clear',
    verifications: [
      {
        spec: 'The document title identifies Learn Your Appetite',
        check: async () =>
          expect(page).toHaveTitle('Learn Your Appetite — Notice, understand, learn')
      },
      {
        spec: 'The primary promise avoids calorie tracking',
        check: async () => {
          await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learn your appetite.');
          await expect(page.getByText('About 10 seconds at a time.')).toBeVisible();
          await expect(
            page.getByText('Notice hunger, fullness, and what shapes your eating—without calorie counting.')
          ).toBeVisible();
        }
      },
      {
        spec: 'The unified scale keeps its direction and non-judgmental framing',
        check: async () => {
          await expect(page.getByText('One scale, every time')).toBeVisible();
          await expect(page.getByText('Urgent hunger')).toBeVisible();
          await expect(page.getByText('Neutral', { exact: true })).toBeVisible();
          await expect(page.getByText('Painfully full')).toBeVisible();
          await expect(page.getByText('Numbers describe a moment. They are not grades.')).toBeVisible();
        }
      },
      {
        spec: 'The page explains the complete Notice, Understand, Experiment loop',
        check: async () => {
          await expect(page.getByRole('heading', { name: 'Notice', exact: true })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Understand', exact: true })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Experiment', exact: true })).toBeVisible();
        }
      },
      {
        spec: 'Privacy is visible and the deterministic build marker is present',
        check: async () => {
          await expect(page.getByText('Private by default')).toBeAttached();
          await expect(page.getByTestId('build-marker')).toHaveText('Build e2e-test');
        }
      }
    ]
  });

  const action = page.getByRole('link', { name: 'See how it works' });
  await action.focus();
  await expect(action).toBeFocused();
  await action.click();
  await expect(page).toHaveURL(/#approach$/);
  await expect(page.getByRole('heading', { name: 'Check in less. Learn more.' })).toBeInViewport();

  steps.generateDocs();
});
