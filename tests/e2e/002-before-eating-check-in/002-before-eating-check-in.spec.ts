import { expect, test } from '@playwright/test';
import { activateProgram, blockExternalRequests } from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

test('a before-eating sensation creates one persistent open episode', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Before-eating check-in',
    'One keyboard-operable sensation selection creates a private open eating episode and a clear next action.'
  );
  await blockExternalRequests(context);
  await activateProgram(page);

  await page.getByRole('link', { name: 'Check in before eating' }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  const levelThree = page.getByRole('radio', { name: '3, Clear hunger' });
  await levelThree.check();
  await levelThree.press('ArrowRight');

  await steps.step('before-sensation', {
    description: 'The required path is one unambiguous sensation and one save',
    verifications: [
      {
        spec: 'No scale value is selected by default',
        check: async () => expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
      },
      {
        spec: 'Arrow-key selection exposes the complete number and phrase',
        check: async () => {
          await expect(page.getByRole('radio', { name: '4, Early hunger' })).toBeChecked();
          await expect(page.getByText('4 · Early hunger')).toBeVisible();
          await expect(page.getByText(/Nothing is preselected/)).toBeVisible();
        }
      },
      {
        spec: 'Optional context is disclosed separately and does not block save',
        check: async () => {
          await expect(page.getByText('Add optional context')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
        }
      }
    ]
  });

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await steps.step('pending-after', {
    description: 'Today preserves the open episode and makes completion the next action',
    verifications: [
      {
        spec: 'The saved-state announcement and exact starting sensation are visible',
        check: async () => {
          await expect(page.getByText('Before check-in saved')).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Finish your check-in' })).toBeVisible();
          await expect(page.getByText(/began at 4 · Early hunger/)).toBeVisible();
        }
      },
      {
        spec: 'Completion is primary and unfinished is a deliberate alternative',
        check: async () => {
          await expect(page.getByRole('link', { name: 'How do you feel now?' })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Mark unfinished' })).toBeVisible();
        }
      }
    ]
  });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Finish your check-in' })).toBeVisible();
  await expect(page.getByText(/began at 4 · Early hunger/)).toBeVisible();
  steps.generateDocs();
});
