import { expect, test } from '@playwright/test';
import { activateProgram, blockExternalRequests, finishAfter, openSettingsGroup, saveBefore } from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

test('the release journey respects chosen appearance and remains operable across supported layouts', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Accessible release journey',
    'The primary phone journey respects the chosen appearance, keyboard and motion preferences, and remains usable at layout extremes.'
  );
  await blockExternalRequests(context);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await activateProgram(page, 'dark');
  await saveBefore(page, 4);
  await finishAfter(page, 6);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toHaveCount(1);

  await steps.step('dark-phone-keyboard-journey', {
    description: 'A paired check-in completes in system dark appearance with visible keyboard focus',
    verifications: [
      { spec: 'Chosen dark colors are active without changing semantic content', check: async () => {
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain('dark');
        await expect(page.getByText('1 moment noticed')).toBeVisible();
      } },
      { spec: 'Reduced motion and keyboard focus remain observable', check: async () => {
        expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
        await expect(page.locator(':focus-visible')).toHaveCount(1);
      } }
    ]
  });

  const layouts = [
    { width: 320, height: 568 },
    { width: 852, height: 393 },
    { width: 820, height: 1180 }
  ];
  for (const viewport of layouts) {
    await page.setViewportSize(viewport);
    await page.goto('/settings');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  }

  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce', forcedColors: 'active' });
  await page.goto('/settings');
  await openSettingsGroup(page, 'Accessibility');
  await expect(page.getByRole('checkbox', { name: /Reduced prompts/ })).toBeVisible();
  await page.getByRole('checkbox', { name: /Reduced prompts/ }).check();
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth * 2)).toBe(true);
  await page.evaluate(() => { document.body.style.zoom = ''; });

  await steps.step('appearance-and-size-matrix', {
    description: 'Settings remains semantic at 200% text, forced colors, smallest phone, landscape, and tablet sizes',
    verifications: [
      { spec: 'The iOS-style preferences retain accessible switch names', check: async () => expect(page.getByRole('checkbox', { name: /Reduced prompts/ })).toBeChecked() },
      { spec: 'The page has no horizontal overflow in the canonical phone viewport', check: async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true) }
    ]
  });

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce', forcedColors: 'none' });
  await page.goto('/profile');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  await download;
  await page.goto('/settings');
  await openSettingsGroup(page, 'Your data');
  const deleteButton = page.getByRole('button', { name: 'Delete everything' });
  for (let attempt = 0; attempt < 6 && !await deleteButton.isVisible(); attempt += 1) {
    await page.mouse.wheel(0, 600);
  }
  await deleteButton.click();
  await page.getByLabel('I understand this cannot be undone').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('heading', { name: 'Learn your appetite.' })).toBeVisible();
  steps.generateDocs();
});
