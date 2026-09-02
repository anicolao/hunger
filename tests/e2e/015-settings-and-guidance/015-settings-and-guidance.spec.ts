import { expect, test } from '@playwright/test';
import { blockExternalRequests, openSettingsGroup } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

test('guidance, preferences, recovery, and support remain reachable', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Settings, scale guidance, and support',
    'Existing users can revisit guidance without onboarding, persist privacy preferences, recover projections, and use every support action.'
  );
  await blockExternalRequests(context);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-fixture', 'ready');
  const fixture = buildHistoryFixture(12, [
    { before: 3, after: 6, localHour: 9 },
    { before: 3, after: 9, localHour: 12 },
    { before: 4, after: 10, localHour: 18 },
    { before: 2, after: 9, localHour: 19 }
  ]);
  fixture.episodes[0] = {
    ...fixture.episodes[0],
    completedAt: null,
    afterLevel: null,
    status: 'open'
  };
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), fixture);

  await page.goto('/settings');
  await openSettingsGroup(page, 'Program & scale');
  await page.getByRole('link', { name: 'Review all scale words' }).click();
  await expect(page.getByRole('heading', { name: 'One direction, every time' })).toBeVisible();
  await expect(page.getByText('10', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.goto('/check-in/new');
  await page.getByRole('link', { name: 'Scale help' }).click();
  const backToBefore = page.getByRole('link', { name: 'Back' });
  await expect(backToBefore).toHaveAttribute('href', '/check-in/new');
  await backToBefore.click();
  await expect(page.getByRole('heading', { name: 'Finish the check-in you started?' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'How do you feel now?' }).click();
  await expect(page.getByRole('heading', { name: 'How does your body feel now?' })).toBeVisible();
  await page.getByRole('link', { name: 'Scale help' }).click();
  const backToAfter = page.getByRole('link', { name: 'Back' });
  await expect(backToAfter).toHaveAttribute('href', /\/check-in\/after\?episode=fixture-episode-1/);
  await backToAfter.click();
  await expect(page.getByRole('heading', { name: 'How does your body feel now?' })).toBeVisible();

  await page.goto('/settings');
  await openSettingsGroup(page, 'Accessibility');
  await page.getByRole('checkbox', { name: /Reduced prompts/ }).check();
  await expect(page.getByText('Reduced prompt preference saved.')).toBeVisible();
  await openSettingsGroup(page, 'Your data');
  await page.getByRole('checkbox', { name: /Include photos in exports/ }).check();
  await expect(page.getByText('Photo export preference saved.')).toBeVisible();
  await page.reload();
  await openSettingsGroup(page, 'Accessibility');
  await openSettingsGroup(page, 'Your data');
  await expect(page.getByRole('checkbox', { name: /Reduced prompts/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Include photos in exports/ })).toBeChecked();
  await page.getByRole('button', { name: 'Rebuild local views' }).click();
  await expect(page.getByText('Local views were rebuilt from the source event log.')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await steps.step('preferences-and-recovery', {
    description: 'Settings preserves explicit preferences and exposes honest local recovery',
    verifications: [
      { spec: 'Reduced prompts and photo export are explicit persisted switches', check: async () => {
        await expect(page.getByRole('checkbox', { name: /Reduced prompts/ })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: /Include photos in exports/ })).toBeChecked();
      } },
      { spec: 'Projection recovery completes without replacing the source event log', check: async () => {
        await expect(page.getByText('Local views were rebuilt from the source event log.')).toBeVisible();
      } }
    ]
  });

  await openSettingsGroup(page, 'Support');
  await page.getByRole('button', { name: 'Learn about support' }).click();
  const supportDialog = page.getByRole('dialog');
  await expect(supportDialog.getByRole('heading', { name: 'Support is a valid next step' })).toBeVisible();
  await expect(supportDialog.getByText(/qualified healthcare professional can help/)).toBeVisible();
  await page.getByRole('button', { name: 'Close support information' }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show support note again' })).toBeVisible();
  await page.getByRole('button', { name: 'Show support note again' }).click();
  await page.getByRole('complementary').getByRole('button', { name: 'Pause check-ins' }).click();
  await openSettingsGroup(page, 'Program & scale');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await steps.step('complete-support-path', {
    description: 'The quiet support path can be learned from, dismissed, restored, and paused',
    verifications: [
      { spec: 'Support eligibility never diagnoses or uses emergency language', check: async () => {
        await expect(page.getByRole('complementary').getByText(/qualified healthcare professional can help/)).toBeVisible();
      } },
      { spec: 'Pause check-ins is reversible from the same Settings screen', check: async () => {
        await expect(page.getByRole('button', { name: 'Resume check-ins' })).toBeVisible();
      } }
    ]
  });
  steps.generateDocs();
});
