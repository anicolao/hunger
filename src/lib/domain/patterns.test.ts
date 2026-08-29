import { describe, expect, it } from 'vitest';
import type { EatingEpisode } from '../data/schema';
import { generatePatternInsights, getTimeBucket } from './patterns';
import { reminderCadence } from './reminders';

function episode(id: string, before: number, after: number, hour: number): EatingEpisode {
  return {
    id,
    programId: 'program-1',
    startedAt: Date.UTC(2026, 7, Number(id) || 1, hour),
    completedAt: Date.UTC(2026, 7, Number(id) || 1, hour + 1),
    capturedTimeZone: 'UTC',
    beforeLevel: before,
    afterLevel: after,
    reason: null,
    occasion: null,
    note: null,
    photoId: null,
    recalledAfter: false,
    status: 'complete',
    createdAt: 1,
    updatedAt: 2,
    schemaVersion: 1
  };
}

describe('progression patterns', () => {
  it.each([
    [5, 'morning'],
    [10, 'morning'],
    [11, 'midday'],
    [15, 'midday'],
    [16, 'evening'],
    [20, 'evening'],
    [21, 'late'],
    [4, 'late']
  ])('buckets local hour %s as %s', (hour, bucket) => {
    expect(getTimeBucket(Date.UTC(2026, 0, 1, hour), 'UTC')).toBe(bucket);
  });

  it('uses the captured timezone across a daylight-saving boundary', () => {
    expect(getTimeBucket(Date.UTC(2026, 2, 8, 13), 'America/Toronto')).toBe('morning');
    expect(getTimeBucket(Date.UTC(2026, 10, 1, 14), 'America/Toronto')).toBe('morning');
  });

  it('requires both group sizes and a 25-point rate difference', () => {
    const tooSmall = [episode('1', 1, 9, 17), episode('2', 1, 9, 17), episode('3', 4, 6, 12), episode('4', 4, 6, 12)];
    expect(generatePatternInsights(tooSmall)).toEqual([]);

    const eligible = [
      episode('1', 1, 9, 17), episode('2', 2, 8, 17), episode('3', 1, 8, 17), episode('4', 2, 6, 17),
      episode('5', 4, 6, 12), episode('6', 4, 6, 12), episode('7', 5, 7, 12), episode('8', 5, 6, 12)
    ];
    expect(generatePatternInsights(eligible)[0]).toMatchObject({
      kind: 'urgent-start-association',
      strength: 'recurring',
      sampleSize: 8,
      metrics: { primaryCount: 3, primaryTotal: 4, comparisonCount: 0, comparisonTotal: 4, difference: 0.75 },
      eligibleExperiment: 'eat-earlier-noticing'
    });
  });

  it.each([
    [1, false, 'Up to two chosen windows'],
    [2, false, 'One chosen window'],
    [3, false, 'Context-focused'],
    [4, false, 'Experiment reminder'],
    [1, true, 'Paused']
  ] as const)('tapers week %s reminders', (week, paused, expected) => {
    expect(reminderCadence(week, paused)).toContain(expected);
  });
});
