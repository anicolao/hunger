import { describe, expect, it } from 'vitest';
import type { EatingEpisode } from '../data/schema';
import {
  firstInsightProgress,
  generateEarlyInsights,
  insightSnapshotSourceStatus,
  median,
  pairedEpisodes,
  remainingForFirstInsight,
  renderInsight,
  selectInsightForPublication
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
    const episodes = Array.from({ length: 8 }, (_, index) => episode(String(index + 1), 4 + index % 2, 6 + index % 2));
    expect(generateEarlyInsights(episodes)[0].strength).toBe('recurring');
  });

  it('suppresses a claim when its evidence has no variation', () => {
    expect(generateEarlyInsights(Array.from({ length: 4 }, (_, index) => episode(String(index + 1), 4, 6)))).toEqual([]);
  });

  it('publishes at most one recent novel observation in seven days', () => {
    const now = Date.UTC(2026, 7, 29);
    const episodes = [episode('1', 3, 6), episode('2', 4, 7), episode('3', 5, 6), episode('4', 4, 8)]
      .map((item, index) => ({ ...item, startedAt: now - index * 86_400_000 }));
    const candidates = generateEarlyInsights(episodes);
    expect(selectInsightForPublication(candidates, [], episodes, now)?.id).toBe('typical-start-v1');
    const snapshot = {
      id: 'snapshot', programId: 'program-1', shownAt: now - 2 * 86_400_000,
      algorithmVersion: 1, copyVersion: 1, result: candidates[0], feedback: null,
      sourceChanged: false, sourceStatus: 'current' as const
    };
    expect(selectInsightForPublication(candidates, [snapshot], episodes, now)).toBeNull();
    expect(selectInsightForPublication(candidates, [{ ...snapshot, shownAt: now - 8 * 86_400_000 }], episodes, now)?.id).toBe('typical-end-v1');
  });

  it('labels immutable snapshot evidence as changed or deleted', () => {
    const result = generateEarlyInsights([episode('1', 3, 6), episode('2', 4, 7), episode('3', 5, 6), episode('4', 4, 8)])[0];
    const snapshot = { id: 'snapshot', programId: 'program-1', shownAt: 10, algorithmVersion: 1, copyVersion: 1, result, feedback: null, sourceChanged: false };
    const unchanged = result.evidenceEpisodeIds.map((id) => ({ ...episode(id, 3, 6), updatedAt: 9 }));
    expect(insightSnapshotSourceStatus(snapshot, unchanged)).toBe('current');
    expect(insightSnapshotSourceStatus(snapshot, unchanged.map((item, index) => index === 0 ? { ...item, updatedAt: 10 } : item))).toBe('changed');
    expect(insightSnapshotSourceStatus(snapshot, unchanged.slice(1))).toBe('deleted');
  });
});
