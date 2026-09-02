import { expect, test } from '@playwright/test';
import { activateProgram, blockExternalRequests, openRecentCheckins, saveBefore } from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

test('an after-eating sensation completes the same episode with optional context', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'After-eating check-in',
    'The identical-direction scale completes the open episode while self-described context and a processed local photo remain optional.'
  );
  await blockExternalRequests(context);
  await activateProgram(page);
  await saveBefore(page, 8);
  await page.getByRole('link', { name: 'How do you feel now?' }).click();
  await page.getByRole('radio', { name: '3, Clear hunger' }).check();
  await page.getByText('Add optional context').click();
  await page.getByRole('button', { name: 'Physical hunger' }).click();
  await page.getByRole('button', { name: 'Snack' }).click();
  const note = 'A'.repeat(110);
  await page.getByLabel('Short note Optional').fill(note);
  await page.getByLabel('Add an optional photo').setInputFiles({
    name: 'moment.png',
    mimeType: 'image/png',
    buffer: onePixelPng
  });
  await expect(page.getByText('Stored only on this device')).toBeVisible();

  await steps.step('after-with-context', {
    description: 'Optional context enriches but never judges the same-scale answer',
    verifications: [
      {
        spec: 'The before summary and after scale preserve one direction',
        check: async () => {
          await expect(page.getByText(/began at 8 · Too full/)).toBeVisible();
          await expect(page.getByRole('radio', { name: '3, Clear hunger' })).toBeChecked();
          await expect(page.getByText(/same scale in the same direction/)).toBeVisible();
        }
      },
      {
        spec: 'A contradictory-looking physical-hunger answer is accepted without warning',
        check: async () => {
          await expect(page.getByRole('button', { name: 'Physical hunger' })).toHaveAttribute('aria-pressed', 'true');
          await expect(page.getByText(/inconsistent|wrong|correct/i)).toHaveCount(0);
        }
      },
      {
        spec: 'Note length and locally prepared photo state are explicit',
        check: async () => {
          await expect(page.getByText('30 characters remaining')).toBeVisible();
          await expect(page.getByText('Stored only on this device')).toBeVisible();
        }
      }
    ]
  });

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Finish check-in' }).click();
  await openRecentCheckins(page);
  await steps.step('paired-episode-complete', {
    description: 'Today shows one completed paired episode',
    verifications: [
      {
        spec: 'Completion is announced and the before/after values remain paired',
        check: async () => {
          await expect(page.getByText('Check-in complete')).toBeVisible();
          await expect(page.getByText('1 moment noticed')).toBeVisible();
          await expect(page.getByText(/8 → 3/)).toBeVisible();
        }
      },
      {
        spec: 'The optional occasion is shown without inferring a meal from time',
        check: async () => expect(page.getByText(/snack/)).toBeVisible()
      }
    ]
  });

  await page.reload();
  await openRecentCheckins(page);
  await expect(page.getByText(/8 → 3/)).toBeVisible();
  steps.generateDocs();
});
