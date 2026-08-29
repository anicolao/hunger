import { describe, expect, it } from 'vitest';
import {
  completeEpisode,
  createOpenEpisode,
  isOpenEpisodeStale,
  markEpisodeUnfinished,
  updateEpisode
} from './episodes';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 10, 12);

function openEpisode() {
  return createOpenEpisode({
    id: 'episode-1',
    programId: 'program-1',
    level: 3,
    now: NOW,
    timeZone: 'America/Toronto'
  });
}

describe('episode lifecycle', () => {
  it('creates one open before-eating moment without invented after data', () => {
    expect(openEpisode()).toMatchObject({
      beforeLevel: 3,
      afterLevel: null,
      completedAt: null,
      status: 'open'
    });
  });

  it('pairs an after sensation and optional self-described context', () => {
    expect(
      completeEpisode(openEpisode(), 8, NOW + HOUR, {
        reason: 'physical-hunger',
        occasion: 'snack',
        note: 'Both answers are accepted.'
      })
    ).toMatchObject({
      beforeLevel: 3,
      afterLevel: 8,
      reason: 'physical-hunger',
      occasion: 'snack',
      status: 'complete',
      recalledAfter: false
    });
  });

  it('labels a completion after four hours as recalled and rejects one after 24 hours', () => {
    expect(completeEpisode(openEpisode(), 6, NOW + 4 * HOUR).recalledAfter).toBe(true);
    expect(() => completeEpisode(openEpisode(), 6, NOW + 25 * HOUR)).toThrow(/too old/);
  });

  it('marks an abandoned moment unfinished without inventing an after score', () => {
    expect(markEpisodeUnfinished(openEpisode(), NOW + 5 * HOUR)).toMatchObject({
      status: 'unfinished',
      afterLevel: null
    });
  });

  it('validates edits and the 140-character note boundary', () => {
    const complete = completeEpisode(openEpisode(), 6, NOW + HOUR);
    expect(updateEpisode(complete, { beforeLevel: 4, afterLevel: 7, note: 'corrected' }, NOW + 2 * HOUR))
      .toMatchObject({ beforeLevel: 4, afterLevel: 7, note: 'corrected' });
    expect(() => updateEpisode(complete, { beforeLevel: 4, afterLevel: 7, note: 'x'.repeat(141) }, NOW))
      .toThrow(/140/);
  });

  it('recognizes an open episode at the four-hour boundary', () => {
    expect(isOpenEpisodeStale(openEpisode(), NOW + 4 * HOUR - 1)).toBe(false);
    expect(isOpenEpisodeStale(openEpisode(), NOW + 4 * HOUR)).toBe(true);
  });
});
