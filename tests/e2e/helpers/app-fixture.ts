import { expect, type BrowserContext, type Page } from '@playwright/test';

export async function blockExternalRequests(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') throw new Error(`external request blocked: ${url}`);
    await route.continue();
  });
}

export async function activateProgram(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Begin the 30-day program' }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'One scale, every time' })).toBeVisible();
  await page.getByRole('radio', { name: '4, Early hunger' }).check();
  await page.getByRole('button', { name: 'I understand' }).click();
  await expect(page.getByRole('heading', { name: 'Small moments become patterns' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Private by default' })).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Start day 1' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
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
