import { expect, test, type Locator } from '@playwright/test';
import { blockExternalRequests } from '../helpers/app-fixture';
import { buildHistoryFixture } from '../helpers/fixture-builder';
import { TestStepHelper } from '../helpers/test-step-helper';

async function press(control: Locator) {
  await control.focus();
  await control.press('Enter');
}

test('the primary journey reflows and remains operable by keyboard', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Responsive and accessible journey', 'Activation, a paired moment, an experiment offer, and Profile remain keyboard-operable across required viewport classes.');
  await blockExternalRequests(context);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 852, height: 393 });
  await page.goto('/');
  await press(page.getByRole('link', { name: 'Begin the 30-day program' }));
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'ready');
  await press(page.getByRole('button', { name: 'Begin' }));
  const onboardingRadio = page.getByRole('radio', { name: '4, Early hunger' });
  await onboardingRadio.focus(); await onboardingRadio.press('Space');
  await press(page.getByRole('button', { name: 'Continue' }));
  await expect(page.getByRole('heading', { name: 'Small moments become patterns' })).toBeFocused();
  await press(page.getByRole('button', { name: 'Continue' }));
  await expect(page.getByRole('heading', { name: 'Private by default' })).toBeFocused();
  await press(page.getByRole('button', { name: 'Not now' }));
  await press(page.getByRole('button', { name: 'Start day 1' }));
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  await press(page.getByRole('link', { name: 'Check in before eating' }));
  const before = page.getByRole('radio', { name: '4, Early hunger' }); await before.focus(); await before.press('Space');
  await press(page.getByRole('button', { name: 'Save', exact: true }));
  await expect(page.getByText('Before check-in saved')).toBeVisible();
  await press(page.getByRole('link', { name: 'How do you feel now?' }));
  const after = page.getByRole('radio', { name: '6, Satisfied' }); await after.focus(); await after.press('Space');
  await press(page.getByRole('button', { name: 'Finish check-in' }));
  await expect(page.getByText('Check-in complete')).toBeVisible();

  await steps.step('keyboard-landscape-check-in', {
    description: 'The complete paired loop works from the keyboard in a short landscape viewport',
    verifications: [
      { spec: 'The before and after actions persisted one completed local moment', check: async () => expect(page.getByText('4 → 6')).toBeVisible() },
      { spec: 'No horizontal overflow appears at mobile landscape size', check: async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true) },
      { spec: 'Reduced-motion media preference is active', check: async () => expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true) }
    ]
  });

  const history = buildHistoryFixture(22, [
    { before: 1, after: 9, localHour: 19 }, { before: 2, after: 8, localHour: 19 },
    { before: 1, after: 8, localHour: 19 }, { before: 2, after: 6, localHour: 19 },
    { before: 4, after: 6, localHour: 12 }, { before: 4, after: 6, localHour: 12 },
    { before: 5, after: 7, localHour: 13 }, { before: 5, after: 6, localHour: 13 }
  ]);
  await page.evaluate(async (value) => window.__HUNGER_E2E__?.importFixture(value), history);
  await page.goto('/');
  await press(page.getByRole('link', { name: 'Insights' }));
  const experimentLink = page.locator('article').first().getByRole('link', { name: /Try a 7-day/ });
  await experimentLink.focus();
  await expect(experimentLink).toHaveCSS('outline-style', 'solid');
  await experimentLink.press('Enter');
  await press(page.getByRole('button', { name: 'Start experiment' }));
  await expect(page.getByText('In progress')).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await press(page.getByRole('link', { name: 'Profile' }));
  await steps.step('tablet-profile-reflow', {
    description: 'The progressive Profile reflows at tablet width after a keyboard-started experiment',
    verifications: [
      { spec: 'The Profile exposes evidence-labelled supported and sparse sections', check: async () => { await expect(page.getByRole('heading', { name: 'Typical starting sensation' })).toBeVisible(); await expect(page.getByText('Still learning')).toHaveCount(2); } },
      { spec: 'Every visible interactive target is at least 44 by 44 CSS pixels', check: async () => expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('a,button,input')].filter((item) => item.checkVisibility()).every((item) => { const box = item.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true) },
      { spec: 'No forbidden judgement, calorie, weight, streak, diagnostic, or causal-result copy appears', check: async () => expect((await page.locator('body').innerText()).match(/\b(clean|cheat|failed|perfect|calorie|weight target|streak|diagnos(?:e|is)|caused)\b/i)).toBeNull() }
    ]
  });
  steps.generateDocs();
});
