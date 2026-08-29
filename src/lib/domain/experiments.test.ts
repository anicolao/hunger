import { describe, expect, it } from 'vitest';
import type { EatingEpisode, ExperimentRecord } from '../data/schema';
import { activeExperiment, evaluateExperiment, offerForInsight } from './experiments';
import type { PatternInsightResult } from './patterns';

const DAY = 86_400_000;
const now = Date.UTC(2026, 7, 29);

function episode(id: string, startedAt: number, afterLevel: number): EatingEpisode {
  return { id, programId: 'p', startedAt, completedAt: startedAt + 1, capturedTimeZone: 'UTC', beforeLevel: 2, afterLevel, reason: null, occasion: null, note: null, photoId: null, recalledAfter: false, status: 'complete', createdAt: startedAt, updatedAt: startedAt, schemaVersion: 1 };
}

function record(direction: 'lower' | 'higher' = 'lower'): ExperimentRecord {
  return { id: 'x', programId: 'p', insightId: 'i', kind: 'eat-earlier-noticing', startedAt: now - 7 * DAY, endedAt: null, baselineEpisodeIds: ['b1', 'b2', 'b3', 'b4'], target: { label: 'Uncomfortable ending rate', measure: 'uncomfortable-ending-rate', direction, days: 7 }, status: 'active', result: null, algorithmVersion: 1 };
}

describe('experiments', () => {
  it('maps only eligible passed insights to fixed offers', () => {
    const insight = { eligibleExperiment: 'eat-earlier-noticing' } as PatternInsightResult;
    expect(offerForInsight(insight)?.title).toContain('earlier');
    expect(offerForInsight({ ...insight, eligibleExperiment: undefined })).toBeNull();
  });

  it('keeps one active record visible', () => {
    expect(activeExperiment([{ ...record(), status: 'stopped' }, record()])?.id).toBe('x');
  });

  it.each([
    [[9, 9, 8, 8], [6, 6, 7, 7], 'changed'],
    [[8, 6, 6, 6], [8, 6, 6, 6], 'similar'],
    [[8, 8, 8, 8], [6, 6], 'learning']
  ] as const)('reports changed, similar, and learning without causal claims', (baseline, during, state) => {
    const episodes = [
      ...baseline.map((after, index) => episode(`b${index + 1}`, now - (12 - index) * DAY, after)),
      ...during.map((after, index) => episode(`d${index + 1}`, now - (6 - index) * DAY, after))
    ];
    expect(evaluateExperiment(record(), episodes, now).state).toBe(state);
  });
});
