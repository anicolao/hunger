import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetNativeCapabilityCacheForTests } from './native';
import { configureBrowserReminders, configureReminders } from './reminders';
describe('browser reminder adapter', () => { it('returns the exact local payload without a false scheduling claim', () => expect(configureBrowserReminders(['morning'], 'up to twice daily')).toEqual({ capability: 'in-app-only', request: { windows: ['morning'], cadence: 'up to twice daily', message: 'Want to notice how your body feels?' }, explanation: 'Saved as an in-app prompt. This browser cannot promise a reminder while the app is closed.' })); });

describe('native reminder adapter', () => {
  afterEach(() => {
    resetNativeCapabilityCacheForTests();
    vi.unstubAllGlobals();
  });

  it('requests in context and schedules only after iOS authorizes', async () => {
    const commands = [
      'capabilities.get',
      'notifications.authorizationStatus',
      'notifications.requestAuthorization',
      'notifications.replaceSchedule'
    ];
    const request = vi.fn(async (command: string, payload?: object) => {
      if (command === 'capabilities.get') return { version: 1, platform: 'ios', commands };
      if (command === 'notifications.authorizationStatus') return { status: 'not_determined' };
      if (command === 'notifications.requestAuthorization') return { status: 'authorized' };
      if (command === 'notifications.replaceSchedule') {
        expect(payload).toEqual({ windows: ['morning'], cadence: 'daily' });
        return { scheduled: 1 };
      }
    });
    vi.stubGlobal('window', { hungerNative: { request } });

    expect(await configureReminders(['morning'], 'daily')).toEqual({
      capability: 'native-ios',
      status: 'authorized',
      permissionState: 'granted',
      scheduled: 1,
      explanation: 'Scheduled 1 private iOS reminder.'
    });
  });
});
