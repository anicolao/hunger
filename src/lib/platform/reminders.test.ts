import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyReminderSchedule, type ReminderSchedule } from '../domain/reminders';
import { resetNativeCapabilityCacheForTests } from './native';
import { configureBrowserReminders, reconcileReminders } from './reminders';

const schedule: ReminderSchedule = {
  version: 1,
  message: 'Want to notice how your body feels?',
  items: [{ identifier: 'appetite.reminder.morning', kind: 'window', hour: 9, repeatsDaily: true }]
};

describe('browser reminder adapter', () => {
  it('does not claim that the browser scheduled a notification', () => {
    expect(configureBrowserReminders()).toEqual({
      capability: 'browser-unavailable',
      status: 'unsupported',
      permissionState: 'unsupported',
      scheduled: 0,
      explanation: 'Background reminders are unavailable in this browser. Your window preferences are still saved on this device.'
    });
  });
});

describe('native reminder adapter', () => {
  afterEach(() => {
    resetNativeCapabilityCacheForTests();
    vi.unstubAllGlobals();
  });

  it('requests permission in context and replaces the complete desired schedule', async () => {
    const commands = ['capabilities.get', 'notifications.authorizationStatus', 'notifications.requestAuthorization', 'notifications.replaceSchedule', 'notifications.cancelAll'];
    const request = vi.fn(async (command: string, payload?: object) => {
      if (command === 'capabilities.get') return { version: 1, platform: 'ios', commands };
      if (command === 'notifications.authorizationStatus') return { status: 'not_determined' };
      if (command === 'notifications.requestAuthorization') return { status: 'authorized' };
      if (command === 'notifications.replaceSchedule') {
        expect(payload).toEqual({ schedule });
        return { scheduled: 1 };
      }
    });
    vi.stubGlobal('window', { hungerNative: { request } });

    expect(await reconcileReminders(schedule, true)).toEqual({
      capability: 'native-ios',
      status: 'authorized',
      permissionState: 'granted',
      scheduled: 1,
      explanation: 'Scheduled 1 private iOS reminder.'
    });
  });

  it('does not prompt without an explicit action and clears an unauthorized schedule', async () => {
    const commands = ['capabilities.get', 'notifications.authorizationStatus', 'notifications.requestAuthorization', 'notifications.replaceSchedule', 'notifications.cancelAll'];
    const request = vi.fn(async (command: string) => {
      if (command === 'capabilities.get') return { version: 1, platform: 'ios', commands };
      if (command === 'notifications.authorizationStatus') return { status: 'not_determined' };
      if (command === 'notifications.cancelAll') return { cancelled: true };
    });
    vi.stubGlobal('window', { hungerNative: { request } });

    const result = await reconcileReminders(schedule);
    expect(result.permissionState).toBe('default');
    expect(request).not.toHaveBeenCalledWith('notifications.requestAuthorization', expect.anything());
    expect(request).toHaveBeenCalledWith('notifications.cancelAll', {});
  });

  it('replaces an authorized schedule with the empty desired set', async () => {
    const commands = ['capabilities.get', 'notifications.authorizationStatus', 'notifications.requestAuthorization', 'notifications.replaceSchedule', 'notifications.cancelAll'];
    const request = vi.fn(async (command: string, payload?: object) => {
      if (command === 'capabilities.get') return { version: 1, platform: 'ios', commands };
      if (command === 'notifications.authorizationStatus') return { status: 'authorized' };
      if (command === 'notifications.replaceSchedule') {
        expect(payload).toEqual({ schedule: emptyReminderSchedule() });
        return { scheduled: 0 };
      }
    });
    vi.stubGlobal('window', { hungerNative: { request } });
    expect((await reconcileReminders(emptyReminderSchedule())).scheduled).toBe(0);
  });
});
