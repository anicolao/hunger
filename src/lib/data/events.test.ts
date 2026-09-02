import { describe, expect, it } from 'vitest';
import { createOpenEpisode, markEpisodeUnfinished } from '../domain/episodes';
import {
  EVENT_SCHEMA_VERSION,
  UnsupportedEventError,
  projectAppetiteEvents,
  type AppetiteEvent,
  type NewAppetiteEvent
} from './events';
import { initialSettings, SCHEMA_VERSION, type ExperimentRecord, type Program } from './schema';

const program: Program = {
  id: 'program-1',
  startedAt: 1_788_020_800_000,
  timeZone: 'America/Toronto',
  status: 'active',
  onboardingVersion: 1,
  schemaVersion: SCHEMA_VERSION
};

function stored(
  sequence: number,
  event: NewAppetiteEvent,
  id = `event-${sequence}`
): AppetiteEvent {
  return { ...event, id, sequence, version: EVENT_SCHEMA_VERSION } as AppetiteEvent;
}

describe('appetite event projection', () => {
  it('derives the current episode from its complete immutable history', () => {
    const open = createOpenEpisode({
      id: 'episode-1',
      programId: program.id,
      level: 4,
      now: program.startedAt,
      timeZone: program.timeZone
    });
    const unfinished = markEpisodeUnfinished(open, program.startedAt + 1_000);
    const events = [
      stored(1, {
        type: 'program/started',
        occurredAt: program.startedAt,
        payload: { program }
      }),
      stored(2, {
        type: 'episode/started',
        occurredAt: open.startedAt,
        payload: { episode: open }
      }),
      stored(3, {
        type: 'episode/changed',
        occurredAt: unfinished.updatedAt,
        payload: { episode: unfinished }
      })
    ];

    expect(projectAppetiteEvents(events).episodes).toEqual([unfinished]);
    expect(events[1].payload).toEqual({ episode: open });
  });

  it('applies deletion as a tombstone and removes the projected photo', () => {
    const photo = {
      id: 'photo-1',
      programId: program.id,
      blob: new Blob(['private']),
      mediaType: 'image/webp',
      width: 1,
      height: 1,
      bytes: 7
    };
    const episode = {
      ...createOpenEpisode({
        id: 'episode-1',
        programId: program.id,
        level: 4,
        now: program.startedAt,
        timeZone: program.timeZone
      }),
      photoId: photo.id
    };
    const projection = projectAppetiteEvents([
      stored(1, { type: 'photo/stored', occurredAt: 1, payload: { photo } }),
      stored(2, { type: 'episode/started', occurredAt: 2, payload: { episode } }),
      stored(3, {
        type: 'episode/deleted',
        occurredAt: 3,
        payload: { episodeId: episode.id }
      })
    ]);

    expect(projection.episodes).toEqual([]);
    expect(projection.photos).toEqual([]);
  });

  it('is idempotent by event ID and rejects an unknown event schema', () => {
    const event = stored(1, {
      type: 'program/started',
      occurredAt: program.startedAt,
      payload: { program }
    });
    expect(projectAppetiteEvents([event, { ...event, sequence: 2 }]).programs).toEqual([program]);
    expect(() =>
      projectAppetiteEvents([{ ...event, version: 99 } as unknown as AppetiteEvent])
    ).toThrow(UnsupportedEventError);
  });

  it('preserves the one-active-experiment invariant during playback', () => {
    const experiment = (id: string): ExperimentRecord => ({
      id, programId: program.id, insightId: 'insight', kind: 'midway-pause',
      startedAt: program.startedAt, endedAt: null, baselineEpisodeIds: [],
      target: { label: 'Pause', measure: 'comfortable-ending-rate', direction: 'higher', days: 7 },
      status: 'active', result: null, algorithmVersion: 1
    });
    const projection = projectAppetiteEvents([
      stored(1, { type: 'experiment/changed', occurredAt: 1, payload: { experiment: experiment('one') } }),
      stored(2, { type: 'experiment/changed', occurredAt: 2, payload: { experiment: experiment('two') } })
    ]);
    expect(projection.experiments.find(({ id }) => id === 'one')).toMatchObject({ status: 'stopped', endedAt: 2 });
    expect(projection.experiments.find(({ id }) => id === 'two')).toMatchObject({ status: 'active' });
  });

  it('derives the chosen appearance from the latest settings event', () => {
    const light = { ...initialSettings, appearance: 'light' as const };
    const dark = { ...initialSettings, appearance: 'dark' as const };
    const events = [
      stored(1, { type: 'settings/changed', occurredAt: 1, payload: { settings: light } }),
      stored(2, { type: 'settings/changed', occurredAt: 2, payload: { settings: dark } })
    ];

    expect(projectAppetiteEvents(events).settings).toEqual(dark);
    expect(events[0].payload).toEqual({ settings: light });
  });
});
