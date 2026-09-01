import { expect, test, type Download, type Page } from '@playwright/test';
import { activateProgram, blockExternalRequests } from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function choosePhoto(page: Page) {
  const disclosure = page.getByText('Add optional context');
  if (await disclosure.isVisible()) await disclosure.click();
  await page.getByLabel('Add an optional photo').setInputFiles({
    name: 'moment.png', mimeType: 'image/png', buffer: onePixelPng
  });
  await expect(page.getByText('Stored only on this device')).toBeVisible();
}

async function text(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('storage pressure preserves sensations and photo exports require explicit consent', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Storage pressure and private export',
    'Photo failures never discard a sensation; exports remain photo-free until an explicit, bounded opt-in.'
  );
  await blockExternalRequests(context);
  await activateProgram(page);

  await page.getByRole('link', { name: 'Check in before eating' }).click();
  await page.getByRole('radio', { name: /^4,/ }).check();
  await choosePhoto(page);
  await page.evaluate(() => window.__HUNGER_E2E__?.failNextPhotoWrite());
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await steps.step('create-survives-photo-quota', {
    description: 'A failed optional photo write preserves the authoritative sensation event',
    verifications: [
      { spec: 'Today announces both the saved check-in and omitted photo', check: async () => {
        await expect(page.getByText('Before check-in saved')).toBeVisible();
        await expect(page.getByText(/check-in was saved, but the photo was not/)).toBeVisible();
      } },
      { spec: 'Manage Data is offered at the failure boundary', check: async () => {
        await expect(page.getByRole('link', { name: 'Manage Data' })).toBeVisible();
      } }
    ]
  });

  await page.getByRole('link', { name: 'How do you feel now?' }).click();
  await page.getByRole('radio', { name: /^6,/ }).check();
  await page.getByRole('button', { name: 'Finish check-in' }).click();
  await page.locator('section[aria-labelledby="recent-title"] li a').first().click();
  await page.getByRole('button', { name: 'Edit check-in' }).click();
  await choosePhoto(page);
  await page.evaluate(() => window.__HUNGER_E2E__?.failNextPhotoWrite());
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/check-in was updated, but the new photo was not/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage Data' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit check-in' }).click();
  await choosePhoto(page);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Check-in updated. Your observations may update too.')).toBeVisible();

  await page.goto('/profile');
  let pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const privateJson = await text(await pending);
  expect(JSON.parse(privateJson).photos).toBeUndefined();
  expect(JSON.parse(privateJson).photoPolicy).toMatchObject({ included: false, omittedCount: 1 });

  await page.goto('/settings');
  await page.getByRole('checkbox', { name: /Include photos in exports/ }).check();
  await expect(page.getByText('Photo export preference saved.')).toBeVisible();
  await page.goto('/profile');
  pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const optedInJson = await text(await pending);
  const optedIn = JSON.parse(optedInJson);
  expect(optedIn.photos[0].dataUrl).toMatch(/^data:image\/webp;base64,/);
  expect(optedIn.photoPolicy).toMatchObject({ included: true, maximumSourceBytes: 750_000, omittedCount: 0 });

  await steps.step('explicit-bounded-photo-export', {
    description: 'The same export changes policy only after the persisted iOS-style opt-in',
    verifications: [
      { spec: 'Default JSON contained metadata but no image bytes', check: async () => expect(page.getByText(/included only because you enabled them/)).toBeVisible() },
      { spec: 'Opted-in JSON documents its source-byte ceiling and omission count', check: async () => expect(page.getByRole('button', { name: 'Download JSON' })).toBeVisible() }
    ]
  });

  await page.goto('/');
  await page.locator('section[aria-labelledby="recent-title"] li a').first().click();
  await page.getByRole('button', { name: 'Delete this check-in' }).click();
  await page.getByLabel('I understand this cannot be undone').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete this check-in' }).click();
  await page.evaluate(async () => window.__HUNGER_E2E__?.replayEvents());
  const projectedPhotoCount = await page.evaluate(async () => {
    const request = indexedDB.open('learn-your-appetite');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('photos', 'readonly');
    const countRequest = transaction.objectStore('photos').count();
    const count = await new Promise<number>((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    database.close();
    return count;
  });
  expect(projectedPhotoCount).toBe(0);
  steps.generateDocs();
});
