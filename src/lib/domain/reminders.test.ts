import { describe, expect, it } from 'vitest';
import { initialSettings, type EatingEpisode, type ExperimentRecord, type Program } from '../data/schema';
import { deriveReminderSchedule } from './reminders';

const day = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 0, 1, 12);
const program: Program = { id: 'program', startedAt: start, timeZone: 'UTC', status: 'active', onboardingVersion: 1, schemaVersion: 2 };
const settings = { ...initialSettings, reminderWindows: ['morning', 'midday', 'evening'] };
const openEpisode = {
  id: 'episode', programId: program.id, startedAt: start + 60_000, completedAt: null,
  capturedTimeZone: 'UTC', beforeLevel: 3, afterLevel: null, reason: null, occasion: null,
  note: null, photoId: null, recalledAfter: false, status: 'open', createdAt: start,
  updatedAt: start, schemaVersion: 2
} satisfies EatingEpisode;
const experiment = {
  id: 'experiment', programId: program.id, insightId: 'insight', kind: 'midway-pause',
  startedAt: start, endedAt: null, baselineEpisodeIds: [],
  target: { label: 'Pause', measure: 'comfortable-ending-rate', direction: 'higher', days: 7 },
  status: 'active', result: null, algorithmVersion: 1
} satisfies ExperimentRecord;

function scheduleAt(days: number, overrides: Partial<{ program: Program; episodes: EatingEpisode[]; experiments: ExperimentRecord[] }> = {}) {
  return deriveReminderSchedule({
    program: overrides.program ?? program,
    settings,
    episodes: overrides.episodes ?? [],
    experiments: overrides.experiments ?? [],
    now: start + days * day
  });
}

describe('derived reminder schedule', () => {
  it('tapers selected windows and uses stable identifiers', () => {
    expect(scheduleAt(0).items.map((item) => item.identifier)).toEqual(['appetite.reminder.morning', 'appetite.reminder.midday']);
    expect(scheduleAt(8).items.map((item) => item.identifier)).toEqual(['appetite.reminder.morning']);
    expect(scheduleAt(15).items).toEqual([expect.objectContaining({ identifier: 'appetite.reminder.context', kind: 'context' })]);
    expect(scheduleAt(22, { experiments: [experiment] }).items).toEqual([expect.objectContaining({ identifier: 'appetite.reminder.experiment' })]);
    expect(scheduleAt(22).items).toEqual([]);
  });

  it('adds and removes the one-shot pending completion reminder from episode state', () => {
    expect(scheduleAt(0, { episodes: [openEpisode] }).items).toContainEqual({
      identifier: 'appetite.reminder.pending-completion', kind: 'pending-completion',
      fireAt: openEpisode.startedAt + 4 * 60 * 60 * 1000, repeatsDaily: false
    });
    expect(scheduleAt(1, { episodes: [openEpisode] }).items.some((item) => item.kind === 'pending-completion')).toBe(false);
  });

  it('returns an empty schedule when reminders or the program are paused or complete', () => {
    expect(deriveReminderSchedule({ program, settings: { ...settings, remindersPaused: true }, episodes: [], experiments: [], now: start }).items).toEqual([]);
    expect(scheduleAt(0, { program: { ...program, status: 'paused' } }).items).toEqual([]);
    expect(scheduleAt(30).items).toEqual([]);
  });
});
