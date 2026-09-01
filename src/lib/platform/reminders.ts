import { getRepository } from '../data/repository';
import { deriveReminderSchedule, type ReminderSchedule } from '../domain/reminders';
import { nativeCapabilities, nativeRequest } from './native';
import { reconcileProgramLifecycle } from './program';

export interface BrowserReminderResult {
  capability: 'browser-unavailable';
  status: 'unsupported';
  permissionState: 'unsupported';
  scheduled: 0;
  explanation: string;
}

export interface NativeReminderResult {
  capability: 'native-ios';
  status: string;
  permissionState: NotificationPermission;
  scheduled: number;
  explanation: string;
}

export type ReminderResult = BrowserReminderResult | NativeReminderResult;

export interface NativeReminderDiagnostics {
  scheduled: number;
  identifiers: string[];
}

export function configureBrowserReminders(): BrowserReminderResult {
  return {
    capability: 'browser-unavailable',
    status: 'unsupported',
    permissionState: 'unsupported',
    scheduled: 0,
    explanation: 'Background reminders are unavailable in this browser. Your window preferences are still saved on this device.'
  };
}

function permissionState(status: string): NotificationPermission {
  if (['authorized', 'provisional', 'ephemeral'].includes(status)) return 'granted';
  if (status === 'not_determined') return 'default';
  return 'denied';
}

export async function reconcileReminders(
  schedule: ReminderSchedule,
  requestPermission = false
): Promise<ReminderResult> {
  const capabilities = await nativeCapabilities();
  const required = [
    'notifications.authorizationStatus',
    'notifications.requestAuthorization',
    'notifications.replaceSchedule',
    'notifications.cancelAll'
  ];
  if (!required.every((command) => capabilities?.commands.includes(command))) {
    return configureBrowserReminders();
  }

  let { status } = await nativeRequest<{ status: string }>('notifications.authorizationStatus');
  if (status === 'not_determined' && requestPermission && schedule.items.length > 0) {
    ({ status } = await nativeRequest<{ status: string }>('notifications.requestAuthorization'));
  }
  if (!['authorized', 'provisional', 'ephemeral'].includes(status)) {
    await nativeRequest('notifications.cancelAll');
    return {
      capability: 'native-ios',
      status,
      permissionState: permissionState(status),
      scheduled: 0,
      explanation: status === 'denied'
        ? 'iOS notifications are off. Open notification settings to enable them.'
        : 'Choose a reminder window and allow notifications when you are ready.'
    };
  }
  const { scheduled } = await nativeRequest<{ scheduled: number }>(
    'notifications.replaceSchedule',
    { schedule }
  );
  return {
    capability: 'native-ios',
    status,
    permissionState: 'granted',
    scheduled,
    explanation: scheduled === 0
      ? 'Private iOS reminders are off for the current program stage.'
      : `Scheduled ${scheduled} private iOS reminder${scheduled === 1 ? '' : 's'}.`
  };
}

export async function openNativeNotificationSettings(): Promise<boolean> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes('app.openNotificationSettings')) return false;
  const result = await nativeRequest<{ opened: boolean }>('app.openNotificationSettings');
  return result.opened;
}

export async function getNativeReminderDiagnostics(): Promise<NativeReminderDiagnostics | null> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes('notifications.pendingSchedule')) return null;
  const diagnostics = await nativeRequest<NativeReminderDiagnostics>('notifications.pendingSchedule');
  if (!Number.isInteger(diagnostics.scheduled) || diagnostics.scheduled < 0 ||
      !Array.isArray(diagnostics.identifiers) ||
      diagnostics.identifiers.some((identifier) => typeof identifier !== 'string')) return null;
  return diagnostics;
}

export async function reconcileStoredReminders(
  now: number,
  requestPermission = false
): Promise<ReminderResult> {
  const repository = getRepository();
  const program = await reconcileProgramLifecycle(now, repository);
  if (!program) {
    await cancelNativeReminders();
    return configureBrowserReminders();
  }
  const [settings, episodes, experiments] = await Promise.all([
    repository.getSettings(),
    repository.listEpisodes(program.id),
    repository.listExperiments(program.id)
  ]);
  const result = await reconcileReminders(
    deriveReminderSchedule({ program, settings, episodes, experiments, now }),
    requestPermission
  );
  if (settings.permissionState !== result.permissionState) {
    await repository.append({
      type: 'settings/changed',
      occurredAt: now,
      payload: {
        settings: {
          ...settings,
          reminderWindows: [...settings.reminderWindows],
          permissionState: result.permissionState
        }
      }
    });
  }
  return result;
}

export async function cancelNativeReminders(): Promise<boolean> {
  const capabilities = await nativeCapabilities();
  if (!capabilities?.commands.includes('notifications.cancelAll')) return false;
  await nativeRequest('notifications.cancelAll');
  return true;
}
