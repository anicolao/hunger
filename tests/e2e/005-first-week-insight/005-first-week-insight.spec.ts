import { expect, test } from '@playwright/test';
import {
  activateProgram,
  blockExternalRequests,
  finishAfter,
  saveBefore
} from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

async function addPair(page: Parameters<typeof saveBefore>[0], before: number, after: number) {
  await saveBefore(page, before);
  await finishAfter(page, after);
}

test('the fourth paired episode unlocks an evidence-backed early observation', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'First-week insight',
    'The app makes no personal claim below its fixed gate, then explains the exact records behind a neutral early observation.'
  );
  await blockExternalRequests(context);
  await activateProgram(page);
  await addPair(page, 3, 6);
  await addPair(page, 4, 6);
  await addPair(page, 4, 7);
  await page.goto('/insights');

  await steps.step('still-learning', {
    description: 'Three pairs produce progress, not generic advice disguised as an insight',
    verifications: [
      {
        spec: 'The exact remaining evidence and paired definition are visible',
        check: async () => {
          await expect(page.getByRole('heading', { name: /1 more paired check-in/ })).toBeVisible();
          await expect(page.getByText('4 of 5 insight steps')).toBeVisible();
          await expect(page.getByText(/before and after check-in from the same eating moment/)).toBeVisible();
        }
      },
      {
        spec: 'No personalized finding or unsupported recommendation is rendered',
        check: async () => {
          await expect(page.getByText(/Your 3 paired check-ins began/)).toHaveCount(0);
          await expect(page.getByText(/you should|try eating|caused/i)).toHaveCount(0);
        }
      }
    ]
  });

  await page.goto('/');
  await addPair(page, 5, 6);
  await page.goto('/insights');
  const primaryInsight = page.locator('article').first();
  await primaryInsight.getByText("Why you're seeing this").click();
  await primaryInsight.getByRole('button', { name: 'Helpful' }).click();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | null)?.blur();
  });

  await steps.step('first-observation', {
    description: 'Four pairs unlock a transparent, feedback-ready early observation',
    verifications: [
      {
        spec: 'The structured typical-start result renders its median phrase and evidence count',
        check: async () => {
          await expect(primaryInsight.getByText('Early observation', { exact: true })).toBeVisible();
          await expect(primaryInsight.getByText('Your 4 paired check-ins began near 4, early hunger.')).toBeVisible();
          await expect(primaryInsight.getByText('Based on 4 paired check-ins')).toBeVisible();
        }
      },
      {
        spec: 'The disclosure shows range, source records, and a non-causal caveat',
        check: async () => {
          await expect(primaryInsight.getByText(/middle starting value was 4; values ranged from 3 to 5/)).toBeVisible();
          await expect(primaryInsight.getByText('This is an observation, not proof of cause.')).toBeVisible();
          await expect(primaryInsight.getByRole('link')).toHaveCount(4);
        }
      },
      {
        spec: 'Helpful feedback is optional and persisted separately from source episodes',
        check: async () => expect(primaryInsight.getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true')
      }
    ]
  });

  await page.reload();
  await expect(page.locator('article').first().getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('article').first().getByText("Why you're seeing this").click();
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: 'Delete this check-in' }).click();
  await page.getByLabel('I understand this cannot be undone').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete this check-in' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  await page.goto('/insights');
  await expect(page.getByText('4 of 5 insight steps')).toBeVisible();
  await expect(page.getByText('Early observation')).toHaveCount(0);
  steps.generateDocs();
});
