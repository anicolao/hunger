import { base } from '$app/paths';
export async function registerOfflineShell(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register(`${base}/service-worker.js`, { scope: base ? `${base}/` : '/' }); }
  catch { return null; }
}
export async function clearDeviceCaches(): Promise<void> {
  if ('serviceWorker' in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) => registration.unregister()));
  if ('caches' in globalThis) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  localStorage.clear();
}
