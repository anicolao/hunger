import { nativeCapabilities, nativeRequest } from './native';

export interface ReminderRequest { windows: string[]; cadence: string; message: 'Want to notice how your body feels?'; }
export interface ReminderResult { capability: 'in-app-only'; request: ReminderRequest; explanation: string; }
export function configureBrowserReminders(windows: string[], cadence: string): ReminderResult {
  return { capability: 'in-app-only', request: { windows: [...windows], cadence, message: 'Want to notice how your body feels?' }, explanation: 'Saved as an in-app prompt. This browser cannot promise a reminder while the app is closed.' };
}

export interface NativeReminderResult {
  capability: 'native-ios';
  status: string;
  permissionState: NotificationPermission;
  scheduled: number;
  explanation: string;
}

export async function configureReminders(
  windows: string[],
  cadence: string
): Promise<ReminderResult | NativeReminderResult> {
  const capabilities = await nativeCapabilities();
  const required = [
    'notifications.authorizationStatus',
    'notifications.requestAuthorization',
    'notifications.replaceSchedule'
  ];
  if (!required.every((command) => capabilities?.commands.includes(command))) {
    return configureBrowserReminders(windows, cadence);
  }

  let { status } = await nativeRequest<{ status: string }>('notifications.authorizationStatus');
  if (status === 'not_determined') {
    ({ status } = await nativeRequest<{ status: string }>('notifications.requestAuthorization'));
  }
  if (!['authorized', 'provisional', 'ephemeral'].includes(status)) {
    return {
      capability: 'native-ios',
      status,
      permissionState: status === 'not_determined' ? 'default' : 'denied',
      scheduled: 0,
      explanation: status === 'denied'
        ? 'iOS notifications are off. You can enable them in system Settings.'
        : 'iOS could not schedule reminders right now.'
    };
  }
  const { scheduled } = await nativeRequest<{ scheduled: number }>(
    'notifications.replaceSchedule',
    { windows: [...windows], cadence }
  );
  return {
    capability: 'native-ios',
    status,
    permissionState: 'granted',
    scheduled,
    explanation: `Scheduled ${scheduled} private iOS reminder${scheduled === 1 ? '' : 's'}.`
  };
}

export async function cancelNativeReminders(): Promise<boolean> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes('notifications.cancelAll')) return false;
  await nativeRequest('notifications.cancelAll');
  return true;
}
