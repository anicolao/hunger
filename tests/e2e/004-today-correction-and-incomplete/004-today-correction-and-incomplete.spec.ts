import { expect, test } from '@playwright/test';
import {
  activateProgram,
  blockExternalRequests,
  finishAfter,
  saveBefore
} from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Today supports unfinished, correction, and event-based deletion', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Today, correction, and incomplete episodes',
    'Recent moments remain editable and deletable, while an abandoned check-in never receives an invented after score.'
  );
  await blockExternalRequests(context);
  await activateProgram(page);
  await saveBefore(page, 5);
  await finishAfter(page, 7);
  await saveBefore(page, 2);
  await page.goto('/check-in/new');
  await expect(page.getByRole('heading', { name: 'Finish the check-in you started?' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark unfinished' }).click();
  await expect(page.getByRole('heading', { name: 'How does your body feel?' })).toBeVisible();
  await page.goto('/');

  await steps.step('complete-and-unfinished-history', {
    description: 'Today distinguishes complete and deliberately unfinished moments',
    verifications: [
      {
        spec: 'Both moments are retained in local-time order',
        check: async () => {
          await expect(page.getByText('2 moments noticed')).toBeVisible();
          await expect(page.getByText(/2 → —/)).toBeVisible();
          await expect(page.getByText(/5 → 7/)).toBeVisible();
        }
      },
      {
        spec: 'The abandoned entry explicitly says Unfinished and has no invented after value',
        check: async () => expect(page.getByText('Unfinished')).toBeVisible()
      }
    ]
  });

  await page.getByRole('link').filter({ hasText: '5 → 7' }).click();
  await page.getByRole('button', { name: 'Edit check-in' }).click();
  await page.getByRole('group', { name: 'Before eating' }).getByRole('radio', { name: '4, Early hunger' }).check();
  await page.getByRole('group', { name: 'After eating' }).getByRole('radio', { name: '8, Too full' }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/observations may update too/)).toBeVisible();

  await steps.step('corrected-episode', {
    description: 'A correction appends an event and updates the episode projection',
    verifications: [
      {
        spec: 'The corrected values and full phrases replace the mistaken values',
        check: async () => {
          await expect(page.getByText('4 · Early hunger')).toBeVisible();
          await expect(page.getByText('8 · Too full')).toBeVisible();
        }
      },
      {
        spec: 'The interface warns that derived observations may update',
        check: async () => expect(page.getByText(/observations may update too/)).toBeVisible()
      }
    ]
  });

  await page.getByRole('button', { name: 'Delete this check-in' }).click();
  await page.getByLabel('I understand this cannot be undone').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete this check-in' }).click();
  await expect(page.getByText(/2 → —/)).toBeVisible();
  await expect(page.getByText(/4 → 8/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/2 → —/)).toBeVisible();
  await expect(page.getByText(/4 → 8/)).toHaveCount(0);
  steps.generateDocs();
});
