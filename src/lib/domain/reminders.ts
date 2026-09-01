import type { AppSettings, EatingEpisode, ExperimentRecord, Program } from '../data/schema';
import { getProgramProgress } from './progression';

export const REMINDER_SCHEDULE_VERSION = 1 as const;
export const REMINDER_MESSAGE = 'Want to notice how your body feels?' as const;

export type ReminderWindowName = 'morning' | 'midday' | 'evening';
export type ReminderKind = 'window' | 'pending-completion' | 'context' | 'experiment';

export interface ReminderScheduleItem {
  identifier: `appetite.reminder.${string}`;
  kind: ReminderKind;
  hour?: number;
  fireAt?: number;
  repeatsDaily: boolean;
}

export interface ReminderSchedule {
  version: typeof REMINDER_SCHEDULE_VERSION;
  message: typeof REMINDER_MESSAGE;
  items: ReminderScheduleItem[];
}

export interface ReminderState {
  program: Program;
  settings: AppSettings;
  episodes: EatingEpisode[];
  experiments: ExperimentRecord[];
  now: number;
}

const windowHours: Record<ReminderWindowName, number> = {
  morning: 9,
  midday: 13,
  evening: 18
};

function selectedWindows(settings: AppSettings): ReminderWindowName[] {
  return settings.reminderWindows.filter(
    (window): window is ReminderWindowName => window in windowHours
  );
}

function dailyItem(window: ReminderWindowName, kind: ReminderKind): ReminderScheduleItem {
  const identifier = kind === 'window' ? window : kind;
  return {
    identifier: `appetite.reminder.${identifier}`,
    kind,
    hour: windowHours[window],
    repeatsDaily: true
  };
}

export function emptyReminderSchedule(): ReminderSchedule {
  return { version: REMINDER_SCHEDULE_VERSION, message: REMINDER_MESSAGE, items: [] };
}

export function deriveReminderSchedule(state: ReminderState): ReminderSchedule {
  const { program, settings, episodes, experiments, now } = state;
  const progress = getProgramProgress(program.startedAt, now);
  if (program.status !== 'active' || settings.remindersPaused || progress.complete) {
    return emptyReminderSchedule();
  }

  const windows = selectedWindows(settings);
  const items: ReminderScheduleItem[] = [];
  if (progress.week === 1) {
    items.push(...windows.slice(0, 2).map((window) => dailyItem(window, 'window')));
  } else if (progress.week === 2 && windows[0]) {
    items.push(dailyItem(windows[0], 'window'));
  } else if (progress.week === 3 && windows[0]) {
    items.push(dailyItem(windows[0], 'context'));
  } else if (
    progress.week === 4 &&
    windows[0] &&
    experiments.some((experiment) => experiment.status === 'active')
  ) {
    items.push(dailyItem(windows[0], 'experiment'));
  }

  if (progress.week <= 2) {
    const openEpisode = episodes.find((episode) => episode.status === 'open');
    const fireAt = openEpisode ? openEpisode.startedAt + 4 * 60 * 60 * 1000 : 0;
    if (fireAt > now) {
      items.push({
        identifier: 'appetite.reminder.pending-completion',
        kind: 'pending-completion',
        fireAt,
        repeatsDaily: false
      });
    }
  }

  return { version: REMINDER_SCHEDULE_VERSION, message: REMINDER_MESSAGE, items };
}

export function reminderCadence(
  week: 1 | 2 | 3 | 4,
  paused: boolean,
  complete = false
): string {
  if (complete) return 'Complete · reminders off';
  if (paused) return 'Paused';
  if (week === 1) return 'Up to two chosen windows plus a pending check-in reminder';
  if (week === 2) return 'One chosen window plus a pending completion reminder';
  if (week === 3) return 'Context-focused reminder when a window is enabled';
  return 'One experiment reminder while an experiment is active';
}
