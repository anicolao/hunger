import { expect, test, type Download } from '@playwright/test';
import { activateProgram, blockExternalRequests } from '../helpers/app-fixture';
import { TestStepHelper } from '../helpers/test-step-helper';

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test.use({ serviceWorkers: 'allow' });

test('source events migrate, unsupported data recovers, and the versioned shell updates offline', async ({ page, context }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Migration and offline update',
    'Source events rebuild disposable views, fail safely when unsupported, and remain usable behind one versioned offline shell.'
  );
  await blockExternalRequests(context);
  await activateProgram(page);
  await page.getByRole('link', { name: 'Check in before eating' }).click();
  await page.getByRole('radio', { name: /^4,/ }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('learn-your-appetite');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores = ['programs', 'episodes', 'insights', 'experiments', 'photos', 'settings'];
    const transaction = database.transaction(stores, 'readwrite');
    for (const store of stores) transaction.objectStore(store).clear();
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  // Rebuilding every disposable projection from the event log can exceed the
  // suite's two-second UI assertion budget on a contended CI runner.
  await expect(page.getByRole('heading', { name: /Finish the check-in/ })).toBeVisible({ timeout: 10_000 });

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('learn-your-appetite');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('events', 'readwrite');
    transaction.objectStore('events').add({
      id: 'unsupported-future-event',
      version: 99,
      type: 'settings/changed',
      occurredAt: Date.now(),
      payload: { settings: { id: 'settings' } }
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your records could not be opened safely.' })).toBeVisible();
  const pendingExport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Original Data' }).click();
  const original = await downloadText(await pendingExport);
  expect(original).toContain('unsupported-future-event');
  expect(original).toContain('"version": 99');

  await steps.step('safe-migration-recovery', {
    description: 'Projection deletion replays, while unsupported source data stops with export-before-reset recovery',
    verifications: [
      { spec: 'The open episode survived wholesale projection deletion', check: async () => expect(original).toContain('episode/started') },
      { spec: 'Original Data includes the unmodified unsupported event before Reset', check: async () => expect(page.getByText(/without changing them/)).toBeVisible() }
    ]
  });

  await page.getByRole('checkbox', { name: /I exported what I need/ }).check();
  await page.getByRole('button', { name: 'Reset local app data' }).click();
  await expect(page.getByRole('heading', { name: 'Learn your appetite.' })).toBeVisible();
  await activateProgram(page);

  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
    await caches.open('learn-your-appetite-shell-obsolete-fixture');
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'hunger:activate-update' });
  });
  await expect.poll(() => page.evaluate(async () => !(await caches.keys()).includes('learn-your-appetite-shell-obsolete-fixture'))).toBe(true);

  const primaryRoutes = [
    { route: '/', heading: 'Today' },
    { route: '/insights', heading: 'Insights' },
    { route: '/profile', heading: 'Your appetite profile' },
    { route: '/settings', heading: 'Settings' },
    { route: '/scale', heading: 'One direction, every time' },
    { route: '/experiment', heading: 'Try one small noticing practice' }
  ];
  for (const { route, heading } of primaryRoutes) {
    expect((await page.goto(route))?.ok()).toBe(true);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await context.setOffline(true);
  for (const { route, heading } of primaryRoutes) {
    expect((await page.goto(route))?.ok()).toBe(true);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await page.goto('/settings');

  await steps.step('versioned-offline-shell', {
    description: 'The activation cleanup removes an obsolete cache and the current shell serves every primary route without a network',
    verifications: [
      { spec: 'Only current versioned application caches remain', check: async () => expect.poll(async () => (await page.evaluate(() => caches.keys())).filter((key) => key.startsWith('learn-your-appetite-shell-')).length).toBe(1) },
      { spec: 'Settings and every other primary route rendered offline', check: async () => expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible() }
    ]
  });
  steps.generateDocs();
});
