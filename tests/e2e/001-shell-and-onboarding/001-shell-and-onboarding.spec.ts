import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

declare global {
  interface Window {
    __onboardingReminderCalls?: Array<{ command: string; payload: Record<string, unknown> }>;
  }
}

test('application shell activates the local-first 30-day program', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Application shell and onboarding',
    'A new user can understand the promise and unified scale, choose private reminder windows, and activate a private 30-day program.'
  );

  await context.addInitScript(() => {
    const calls: Array<{ command: string; payload: Record<string, unknown> }> = [];
    window.__onboardingReminderCalls = calls;
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
        if (command === 'notifications.authorizationStatus') return { status: 'not_determined' };
        if (command === 'notifications.requestAuthorization') return { status: 'authorized' };
        if (command === 'notifications.replaceSchedule') return { scheduled: 1 };
        if (command === 'notifications.cancelAll') return { cancelled: true };
        throw new Error(`Unexpected native command: ${command}`);
      }
    };
  });

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
        spec: 'Privacy is visible without exposing implementation details',
        check: async () => {
          await expect(page.getByText('Private by default')).toBeAttached();
          await expect(page.getByTestId('build-marker')).toHaveCount(0);
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
  await steps.step('one-unified-scale', {
    description: 'Scale education is clearly separate from a real check-in',
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
        spec: 'The optional practice is explicitly not saved as a check-in',
        check: async () => {
          await expect(page.getByText('Practice only—not a check-in.')).toBeVisible();
          await expect(page.getByText(/continue without choosing.*Nothing on this screen is saved/)).toBeVisible();
          await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
        }
      },
      {
        spec: 'The interface says numbers describe rather than grade a moment',
        check: async () =>
          expect(page.getByText('Numbers describe a moment. They are not grades.')).toBeVisible()
      }
    ]
  });

  await page.getByRole('button', { name: 'Continue' }).click();
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
  await page.getByRole('button', { name: 'Set up reminders' }).click();
  await expect(page.getByRole('button', { name: 'Allow reminders and start' })).toBeDisabled();
  await page.getByLabel('Morning').check();
  await steps.step('privacy-and-choice', {
    description: 'Reminder setup reveals native-style windows before asking permission',
    verifications: [
      {
        spec: 'Records stay local and every context field remains optional',
        check: async () => {
          await expect(page.getByText('Records stay on this device.')).toBeVisible();
          await expect(page.getByText('Only a sensation is required.')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Set up reminders' })).toHaveAttribute(
            'aria-pressed',
            'true'
          );
        }
      },
      {
        spec: 'Morning, Midday, and Evening switches appear and one window is selected',
        check: async () => {
          await expect(page.getByLabel('Morning')).toBeChecked();
          await expect(page.getByLabel('Midday')).not.toBeChecked();
          await expect(page.getByLabel('Evening')).not.toBeChecked();
          await expect(page.getByRole('button', { name: 'Allow reminders and start' })).toBeEnabled();
        }
      },
      {
        spec: 'Permission timing is explained before the activation action',
        check: async () => {
          await expect(page.getByText(/iOS will ask for notification permission/)).toBeVisible();
          const permissionCalls = await page.evaluate(() =>
            window.__onboardingReminderCalls?.filter(({ command }) =>
              command === 'notifications.requestAuthorization'
            ) ?? []
          );
          expect(permissionCalls).toEqual([]);
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

  await page.getByRole('button', { name: 'Allow reminders and start' }).click();
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
        spec: 'The next action, Week 1 focus, privacy, and four app destinations are available',
        check: async () => {
          await expect(page.getByRole('link', { name: 'Check in before eating' })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Hunger' })).toBeVisible();
          await expect(page.getByText('Private on this device', { exact: true })).toBeAttached();
          await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeAttached();
          await expect(page.locator('.bottom-nav a')).toHaveCount(4);
          await expect(page.locator('.bottom-nav a[href$="/settings"]')).toBeAttached();
          await expect(page.locator('.bottom-nav [data-icon="settings"]')).toBeAttached();
          await expect(page.getByTestId('build-marker')).toHaveCount(0);
        }
      },
      {
        spec: 'Activation requests permission and schedules only the selected window',
        check: async () => {
          const reminderCalls = await page.evaluate(() =>
            window.__onboardingReminderCalls?.filter(({ command }) =>
              command.startsWith('notifications.')
            ) ?? []
          );
          expect(reminderCalls).toEqual([
            { command: 'notifications.authorizationStatus', payload: {} },
            { command: 'notifications.requestAuthorization', payload: {} },
            {
              command: 'notifications.replaceSchedule',
              payload: {
                windows: ['morning'],
                cadence: 'Up to two chosen windows plus an open check-in reminder'
              }
            }
          ]);
        }
      }
    ]
  });

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  await expect(page.getByText('Day 1 · Week 1')).toBeVisible();

  await page.goto('/settings');
  await steps.step('settings-navigation-and-build', {
    description: 'Settings owns the build identity and the fourth navigation tab',
    verifications: [
      {
        spec: 'The selected reminder window persists in Settings',
        check: async () => {
          await expect(page.getByLabel('Morning')).toBeChecked();
          await expect(page.getByLabel('Midday')).not.toBeChecked();
          await expect(page.getByLabel('Evening')).not.toBeChecked();
        }
      },
      {
        spec: 'The deterministic build identifier appears only in Settings',
        check: async () => {
          await expect(page.getByTestId('build-marker')).toHaveText('Build e2e-test');
        }
      },
      {
        spec: 'Settings uses the bundled SVG gear and no gear emoji',
        check: async () => {
          const settingsIcons = page.locator('[data-icon="settings"]');
          await expect(settingsIcons).toHaveCount(2);
          const maskImages = await settingsIcons.evaluateAll((icons) =>
            icons.map((icon) => getComputedStyle(icon).maskImage)
          );
          for (const maskImage of maskImages) {
            expect(maskImage).toContain('gear');
            expect(maskImage).toContain('.svg');
            expect(maskImage).not.toContain('data:');
          }
          await expect(page.getByText('⚙')).toHaveCount(0);
        }
      }
    ]
  });

  await page.goto('/insights');
  await steps.step('first-insight-progress', {
    description: 'Completed onboarding supplies an honest first step toward an insight',
    verifications: [
      {
        spec: 'The initial meter starts at one of five steps, or 20 percent',
        check: async () => {
          await expect(page.getByRole('progressbar', { name: 'Progress toward your first insight' })).toHaveAttribute('aria-valuenow', '1');
          await expect(page.getByText('1 of 5 insight steps')).toBeVisible();
        }
      },
      {
        spec: 'The completed step is onboarding, while all four evidence pairs remain required',
        check: async () => {
          await expect(page.getByText('Completed: learn how insights work.')).toBeVisible();
          await expect(page.getByText(/4 more paired check-ins/)).toBeVisible();
        }
      },
      {
        spec: 'No synthetic eating moment or personalized claim was created',
        check: async () => {
          await expect(page.getByText(/Your 0 paired check-ins/)).toHaveCount(0);
          await expect(page.getByText('Early observation')).toHaveCount(0);
        }
      }
    ]
  });

  steps.generateDocs();
});
