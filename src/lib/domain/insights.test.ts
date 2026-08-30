import { describe, expect, it } from 'vitest';
import type { EatingEpisode } from '../data/schema';
import {
  firstInsightProgress,
  generateEarlyInsights,
  median,
  pairedEpisodes,
  remainingForFirstInsight,
  renderInsight
} from './insights';

function episode(id: string, before: number, after: number | null, status: EatingEpisode['status'] = 'complete'): EatingEpisode {
  return {
    id,
    programId: 'program-1',
    startedAt: Number(id.replace(/\D/g, '')) || 1,
    completedAt: after === null ? null : 2,
    capturedTimeZone: 'America/Toronto',
    beforeLevel: before,
    afterLevel: after,
    reason: null,
    occasion: null,
    note: null,
    photoId: null,
    recalledAfter: false,
    status,
    createdAt: 1,
    updatedAt: 2,
    schemaVersion: 1
  };
}

describe('early insight engine', () => {
  it.each([
    [[1], 1],
    [[1, 4], 2.5],
    [[5, 1, 3], 3],
    [[2, 8, 4, 6], 5]
  ])('calculates a robust median for %j', (values, expected) => {
    expect(median(values)).toBe(expected);
  });

  it('counts only complete paired episodes', () => {
    const episodes = [episode('1', 3, 6), episode('2', 4, null, 'unfinished'), episode('3', 4, 7, 'open')];
    expect(pairedEpisodes(episodes).map(({ id }) => id)).toEqual(['1']);
    expect(remainingForFirstInsight(episodes)).toBe(3);
  });

  it('counts completed onboarding as the first of five honest insight steps', () => {
    expect(firstInsightProgress([])).toEqual({ completed: 1, total: 5, percent: 20 });
    expect(firstInsightProgress([episode('1', 3, 6), episode('2', 4, 7)])).toEqual({
      completed: 3,
      total: 5,
      percent: 60
    });
  });

  it('suppresses every personalized claim below four pairs', () => {
    const episodes = [episode('1', 3, 6), episode('2', 4, 6), episode('3', 5, 7)];
    expect(generateEarlyInsights(episodes)).toEqual([]);
  });

  it('returns complete structured typical-start and typical-end results at the gate', () => {
    const episodes = [episode('1', 3, 6), episode('2', 4, 6), episode('3', 4, 7), episode('4', 5, 6)];
    expect(generateEarlyInsights(episodes)).toEqual([
      {
        id: 'typical-start-v1',
        algorithmVersion: 1,
        kind: 'typical-start',
        strength: 'early',
        evidenceEpisodeIds: ['1', '2', '3', '4'],
        sampleSize: 4,
        metrics: { median: 4, minimum: 3, maximum: 5 }
      },
      {
        id: 'typical-end-v1',
        algorithmVersion: 1,
        kind: 'typical-end',
        strength: 'early',
        evidenceEpisodeIds: ['1', '2', '3', '4'],
        sampleSize: 4,
        metrics: { median: 6, minimum: 6, maximum: 7 }
      }
    ]);
  });

  it('uses neutral evidence copy without strengthening an early result', () => {
    const result = generateEarlyInsights([
      episode('1', 3, 6),
      episode('2', 4, 6),
      episode('3', 4, 7),
      episode('4', 5, 6)
    ])[0];
    expect(renderInsight(result)).toEqual({
      title: 'Where your check-ins began',
      finding: 'Your 4 paired check-ins began near 4, early hunger.',
      evidence: 'Based on 4 paired check-ins',
      explanation: 'Early observation. The middle starting value was 4; values ranged from 3 to 5.'
    });
  });

  it('promotes strength only at eight complete pairs', () => {
    const episodes = Array.from({ length: 8 }, (_, index) => episode(String(index + 1), 4, 6));
    expect(generateEarlyInsights(episodes)[0].strength).toBe('recurring');
  });
});
