import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('application shell activates the local-first 30-day program', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Application shell and onboarding',
    'A new user can understand the promise and unified scale, decline optional reminders, and activate a private 30-day program.'
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

  await page.getByRole('link', { name: 'Begin the 30-day program' }).click();
  await steps.step('onboarding-promise', {
    description: 'Onboarding introduces one calm idea at a time',
    verifications: [
      {
        spec: 'The promise states the finite 30-day duration and lightweight effort',
        check: async () => {
          await expect(page).toHaveURL(/\/onboarding$/);
          await expect(page.getByText('1 of 4')).toBeVisible();
          await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learn your appetite');
          await expect(page.getByText('30 days. About 10 seconds at a time.')).toBeVisible();
        }
      },
      {
        spec: 'Activation asks for no account, weight, calorie target, or diet goal',
        check: async () => {
          await expect(page.getByRole('textbox')).toHaveCount(0);
          await expect(page.getByText(/account|weight|calorie target|diet goal/i)).toHaveCount(0);
        }
      }
    ]
  });

  await page.getByRole('button', { name: 'Begin' }).click();
  const levelThree = page.getByRole('radio', { name: '3, Clear hunger' });
  await levelThree.check();
  await levelThree.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '4, Early hunger' })).toBeChecked();
  await steps.step('one-unified-scale', {
    description: 'The user explores one keyboard-operable scale',
    verifications: [
      {
        spec: 'The scale retains urgent hunger, neutral, and painful fullness anchors',
        check: async () => {
          await expect(page.getByText('Urgent hunger')).toBeVisible();
          await expect(page.getByText(/5\s+Neutral/)).toBeVisible();
          await expect(page.getByText('Painfully full')).toBeVisible();
        }
      },
      {
        spec: 'Arrow keys change the native radio selection and announce its phrase',
        check: async () => {
          await expect(page.getByRole('radio', { name: '4, Early hunger' })).toBeChecked();
          await expect(page.getByText('4 · Early hunger')).toBeVisible();
          await expect(page.getByText('Subtle body cues or more thoughts of food.')).toBeVisible();
        }
      },
      {
        spec: 'The interface says numbers describe rather than grade a moment',
        check: async () =>
          expect(page.getByText('Numbers describe a moment. They are not grades.')).toBeVisible()
      }
    ]
  });

  await page.getByRole('button', { name: 'I understand' }).click();
  await steps.step('learning-loop', {
    description: 'Paired moments lead to evidence-backed patterns',
    verifications: [
      {
        spec: 'The complete check-in and learning sequence is explicit',
        check: async () => {
          await expect(page.getByText('Check in before')).toBeVisible();
          await expect(page.getByText('Check in after')).toBeVisible();
          await expect(page.getByText('See what repeats')).toBeVisible();
          await expect(
            page.getByText(
              'When there is enough evidence, you will see what the app noticed and which check-ins support it.'
            )
          ).toBeVisible();
        }
      }
    ]
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  await steps.step('privacy-and-choice', {
    description: 'Private storage, optional context, and support stay visible',
    verifications: [
      {
        spec: 'Records stay local and every context field remains optional',
        check: async () => {
          await expect(page.getByText('Records stay on this device.')).toBeVisible();
          await expect(page.getByText('Only a sensation is required.')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Not now' })).toHaveAttribute(
            'aria-pressed',
            'true'
          );
        }
      },
      {
        spec: 'The medical boundary and freedom to pause are stated without alarm',
        check: async () => {
          await expect(page.getByText(/learning tool, not medical care/)).toBeVisible();
          await expect(page.getByText(/Pause or delete everything at any time/)).toBeVisible();
        }
      }
    ]
  });

  await page.getByRole('button', { name: 'Start day 1' }).click();
  await steps.step('today-day-one', {
    description: 'Activation opens a persisted Day 1 Today state',
    verifications: [
      {
        spec: 'Today uses elapsed program language with no quota or streak',
        check: async () => {
          await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
          await expect(page.getByText('Day 1 · Week 1')).toBeVisible();
          await expect(page.getByText('There is no daily target.')).toBeVisible();
          await expect(page.getByText('No moments yet')).toBeVisible();
        }
      },
      {
        spec: 'The next action, Week 1 focus, privacy, and app navigation are available',
        check: async () => {
          await expect(page.getByRole('link', { name: 'Check in before eating' })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Hunger' })).toBeVisible();
          await expect(page.getByText('Private on this device', { exact: true })).toBeAttached();
          await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeAttached();
          await expect(page.getByTestId('build-marker')).toHaveText('Build e2e-test');
        }
      }
    ]
  });

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  await expect(page.getByText('Day 1 · Week 1')).toBeVisible();

  steps.generateDocs();
});
