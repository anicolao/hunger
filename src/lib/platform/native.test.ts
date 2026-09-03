import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeNativeDelete,
  installNativeLifecycleBoundary,
  nativeCapabilities,
  nativeRequest,
  resetNativeCapabilityCacheForTests,
  signalNativeAppReady,
  syncNativeAppearance
} from './native';

describe('native platform boundary', () => {
  afterEach(() => {
    resetNativeCapabilityCacheForTests();
    vi.unstubAllGlobals();
  });

  it('negotiates and allowlists a versioned capability before dispatch', async () => {
    const request = vi.fn(async (command: string) => ({
      version: 1,
      platform: 'ios',
      commands: command === 'capabilities.get' ? ['capabilities.get', 'example.status'] : []
    }));
    vi.stubGlobal('window', { hungerNative: { request } });

    expect(await nativeCapabilities()).toEqual({
      version: 1,
      platform: 'ios',
      commands: ['capabilities.get', 'example.status']
    });
    await nativeRequest('example.status');
    await expect(nativeRequest('events.read')).rejects.toThrow('Native capability is unavailable');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('falls back when the bridge is absent or returns the wrong protocol', async () => {
    vi.stubGlobal('window', {});
    expect(await nativeCapabilities()).toBeNull();

    resetNativeCapabilityCacheForTests();
    vi.stubGlobal('window', {
      hungerNative: { request: async () => ({ version: 2, platform: 'ios', commands: [] }) }
    });
    expect(await nativeCapabilities()).toBeNull();
  });

  it('installs one fixed lifecycle event adapter', () => {
    const dispatchEvent = vi.fn();
    const fakeWindow: Record<string, unknown> = { dispatchEvent };
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init: unknown) {} });

    installNativeLifecycleBoundary();
    const adapter = fakeWindow.__hungerNativeLifecycle as (event: object) => void;
    adapter({ reason: 'foreground', occurredAt: 123 });

    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(Object.getOwnPropertyDescriptor(fakeWindow, '__hungerNativeLifecycle')?.writable).toBe(false);
  });

  it('completes native cleanup only when the negotiated command is available', async () => {
    const request = vi.fn(async (command: string) => command === 'capabilities.get'
      ? { version: 1, platform: 'ios', commands: ['privacy.completeDelete'] }
      : { deleted: true });
    vi.stubGlobal('window', { hungerNative: { request } });

    expect(await completeNativeDelete()).toBe(true);
    expect(request).toHaveBeenLastCalledWith('privacy.completeDelete', {});

    resetNativeCapabilityCacheForTests();
    vi.stubGlobal('window', {});
    expect(await completeNativeDelete()).toBe(false);
  });

  it('signals application readiness only after the command is negotiated', async () => {
    const request = vi.fn(async (command: string) => command === 'capabilities.get'
      ? { version: 1, platform: 'ios', commands: ['app.ready'] }
      : { ready: true });
    vi.stubGlobal('window', { hungerNative: { request } });
    expect(await signalNativeAppReady()).toBe(true);
    expect(request).toHaveBeenLastCalledWith('app.ready', {});
  });

  it('synchronizes the selected appearance only when the native shell advertises support', async () => {
    const request = vi.fn(async (command: string) => command === 'capabilities.get'
      ? { version: 1, platform: 'ios', commands: ['appearance.set'] }
      : { appearance: 'dark' });
    vi.stubGlobal('window', { hungerNative: { request } });

    expect(await syncNativeAppearance('dark')).toBe(true);
    expect(request).toHaveBeenLastCalledWith('appearance.set', { appearance: 'dark' });

    resetNativeCapabilityCacheForTests();
    vi.stubGlobal('window', {});
    expect(await syncNativeAppearance('light')).toBe(false);

    resetNativeCapabilityCacheForTests();
    vi.stubGlobal('window', {
      hungerNative: {
        request: async (command: string) => {
          if (command === 'capabilities.get') {
            return { version: 1, platform: 'ios', commands: ['appearance.set'] };
          }
          throw new Error('Native appearance update failed');
        }
      }
    });
    expect(await syncNativeAppearance('dark')).toBe(false);
  });
});
