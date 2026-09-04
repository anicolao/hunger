export const NATIVE_BRIDGE_VERSION = 1 as const;

export interface NativeCapabilities {
  version: 1;
  platform: 'ios' | 'android';
  commands: readonly string[];
}

export interface NativeLifecycleEvent {
  reason: 'foreground' | 'notification';
  occurredAt: number;
  route?: 'today';
  kind?: 'window' | 'context' | 'experiment' | 'pending-completion';
}

interface NativeRequest {
  request(command: string, payload?: Record<string, unknown>): Promise<unknown>;
}

declare global {
  interface Window {
    hungerNative?: NativeRequest;
    __hungerNativeLifecycle?: (event: NativeLifecycleEvent) => void;
  }
}

let capabilitiesPromise: Promise<NativeCapabilities | null> | null = null;

function isCapabilities(value: unknown): value is NativeCapabilities {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NativeCapabilities>;
  return (
    candidate.version === NATIVE_BRIDGE_VERSION &&
    (candidate.platform === 'ios' || candidate.platform === 'android') &&
    Array.isArray(candidate.commands) &&
    candidate.commands.every((command) => typeof command === 'string')
  );
}

export function installNativeLifecycleBoundary(): void {
  if (typeof window === 'undefined' || window.__hungerNativeLifecycle) return;
  Object.defineProperty(window, '__hungerNativeLifecycle', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: (event: NativeLifecycleEvent) => {
      window.dispatchEvent(new CustomEvent<NativeLifecycleEvent>('hunger:native-lifecycle', {
        detail: Object.freeze({ ...event })
      }));
    }
  });
}

export async function nativeCapabilities(): Promise<NativeCapabilities | null> {
  if (typeof window === 'undefined' || !window.hungerNative) return null;
  capabilitiesPromise ??= window.hungerNative
    .request('capabilities.get')
    .then((value) => (isCapabilities(value) ? Object.freeze({ ...value }) : null))
    .catch(() => null);
  return capabilitiesPromise;
}

export async function nativeRequest<T>(
  command: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes(command) || !window.hungerNative) {
    throw new Error(`Native capability is unavailable: ${command}`);
  }
  return (await window.hungerNative.request(command, payload)) as T;
}

export async function completeNativeDelete(): Promise<boolean> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes('privacy.completeDelete')) return false;
  await nativeRequest('privacy.completeDelete');
  return true;
}

export async function signalNativeAppReady(): Promise<boolean> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes('app.ready')) return false;
  await nativeRequest('app.ready');
  return true;
}

export async function syncNativeAppearance(appearance: 'light' | 'dark'): Promise<boolean> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes('appearance.set')) return false;
  try {
    await nativeRequest('appearance.set', { appearance });
    return true;
  } catch {
    return false;
  }
}

export function resetNativeCapabilityCacheForTests(): void {
  capabilitiesPromise = null;
}
