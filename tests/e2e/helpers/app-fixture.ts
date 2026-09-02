import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

export async function expectAboveFold(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}

export async function blockExternalRequests(context: BrowserContext) {
  await context.addInitScript(() => {
    if (navigator.storage) {
      Object.defineProperty(navigator.storage, 'estimate', {
        configurable: true,
        value: async () => ({ usage: 32_000, quota: 1_000_000_000 })
      });
    }
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') throw new Error(`external request blocked: ${url}`);
    await route.continue();
  });
}

export async function activateProgram(page: Page, appearance: 'light' | 'dark' = 'light') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Begin the 30-day program' }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('radio', { name: new RegExp(appearance, 'i') }).click();
  await page.getByRole('button', { name: `Use ${appearance} mode` }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'One scale, every time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Small moments become patterns' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Private by default' })).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Start day 1' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
}

export async function openSettingsGroup(page: Page, name: string) {
  const summary = page.locator('.settings-group > summary').filter({ hasText: name }).first();
  await expect(summary).toBeVisible();
  const open = await summary.evaluate((element) => element.parentElement?.hasAttribute('open') ?? false);
  if (!open) await summary.click();
}

export async function openRecentCheckins(page: Page) {
  const history = page.locator('details.empty-history');
  await expect(history).toBeVisible();
  if (!await history.evaluate((element) => element.hasAttribute('open'))) {
    await history.locator('summary').click();
  }
}

export async function saveBefore(page: Page, level: number) {
  await page.getByRole('link', { name: 'Check in before eating' }).click();
  await page.getByRole('radio', { name: new RegExp(`^${level},`) }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Before check-in saved')).toBeVisible();
}

export async function finishAfter(page: Page, level: number) {
  await page.getByRole('link', { name: 'How do you feel now?' }).click();
  await page.getByRole('radio', { name: new RegExp(`^${level},`) }).check();
  await page.getByRole('button', { name: 'Finish check-in' }).click();
  await expect(page.getByText('Check-in complete')).toBeVisible();
}
