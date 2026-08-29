import type { E2EFixture } from '$lib/platform/e2e';
import type { EatingEpisode } from '$lib/data/schema';

export const E2E_NOW = Date.UTC(2026, 7, 29, 16);
const DAY = 24 * 60 * 60 * 1000;

export interface EpisodeFixture {
  before: number;
  after: number;
  localHour: number;
  reason?: EatingEpisode['reason'];
  occasion?: EatingEpisode['occasion'];
}

export function buildHistoryFixture(daysElapsed: number, inputs: EpisodeFixture[]): E2EFixture {
  const programId = 'fixture-program';
  return {
    version: 1,
    program: {
      id: programId,
      startedAt: E2E_NOW - daysElapsed * DAY,
      timeZone: 'America/Toronto',
      status: daysElapsed >= 30 ? 'complete' : 'active',
      onboardingVersion: 1,
      schemaVersion: 1
    },
    episodes: inputs.map((input, index) => {
      const startedAt = Date.UTC(2026, 7, 20 + index, input.localHour + 4);
      return {
        id: `fixture-episode-${index + 1}`,
        programId,
        startedAt,
        completedAt: startedAt + 45 * 60 * 1000,
        capturedTimeZone: 'America/Toronto',
        beforeLevel: input.before,
        afterLevel: input.after,
        reason: input.reason ?? null,
        occasion: input.occasion ?? null,
        note: null,
        photoId: null,
        recalledAfter: false,
        status: 'complete',
        createdAt: startedAt,
        updatedAt: startedAt + 45 * 60 * 1000,
        schemaVersion: 1
      };
    })
  };
}
