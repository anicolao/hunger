import type { EatingEpisode } from '../data/schema';
import { getSensationLevel } from './scale';

export const INSIGHT_ALGORITHM_VERSION = 1;
export const FIRST_INSIGHT_PAIR_REQUIREMENT = 4;
export const FIRST_INSIGHT_TOTAL_STEPS = FIRST_INSIGHT_PAIR_REQUIREMENT + 1;
export type InsightKind = 'typical-start' | 'typical-end';

export interface InsightResult {
  id: string;
  algorithmVersion: number;
  kind: InsightKind;
  strength: 'early' | 'recurring';
  evidenceEpisodeIds: string[];
  sampleSize: number;
  metrics: { median: number; minimum: number; maximum: number };
}

export interface RenderedInsight {
  title: string;
  finding: string;
  evidence: string;
  explanation: string;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('A median needs at least one value');
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

export function pairedEpisodes(episodes: EatingEpisode[]): EatingEpisode[] {
  return episodes
    .filter(
      (episode) =>
        episode.status === 'complete' &&
        episode.afterLevel !== null &&
        episode.beforeLevel >= 1 &&
        episode.beforeLevel <= 10 &&
        episode.afterLevel >= 1 &&
        episode.afterLevel <= 10
    )
    .sort((left, right) => left.startedAt - right.startedAt);
}

export function generateEarlyInsights(episodes: EatingEpisode[]): InsightResult[] {
  const paired = pairedEpisodes(episodes);
  if (paired.length < FIRST_INSIGHT_PAIR_REQUIREMENT) return [];
  const strength = paired.length >= 8 ? 'recurring' : 'early';

  return [
    createResult('typical-start', paired.map((episode) => episode.beforeLevel), paired, strength),
    createResult(
      'typical-end',
      paired.map((episode) => episode.afterLevel as number),
      paired,
      strength
    )
  ];
}

function createResult(
  kind: InsightKind,
  values: number[],
  episodes: EatingEpisode[],
  strength: 'early' | 'recurring'
): InsightResult {
  return {
    id: `${kind}-v${INSIGHT_ALGORITHM_VERSION}`,
    algorithmVersion: INSIGHT_ALGORITHM_VERSION,
    kind,
    strength,
    evidenceEpisodeIds: episodes.map((episode) => episode.id),
    sampleSize: episodes.length,
    metrics: {
      median: median(values),
      minimum: Math.min(...values),
      maximum: Math.max(...values)
    }
  };
}

export function renderInsight(result: InsightResult): RenderedInsight {
  const roundedMedian = Math.round(result.metrics.median);
  const sensation = getSensationLevel(roundedMedian);
  const count = result.sampleSize;
  const strengthLabel = result.strength === 'early' ? 'Early observation' : 'Recurring pattern';

  if (result.kind === 'typical-start') {
    return {
      title: 'Where your check-ins began',
      finding: `Your ${count} paired check-ins began near ${roundedMedian}, ${sensation.phrase.toLowerCase()}.`,
      evidence: `Based on ${count} paired check-ins`,
      explanation: `${strengthLabel}. The middle starting value was ${result.metrics.median}; values ranged from ${result.metrics.minimum} to ${result.metrics.maximum}.`
    };
  }

  return {
    title: 'Where your check-ins ended',
    finding: `Your ${count} paired check-ins ended near ${roundedMedian}, ${sensation.phrase.toLowerCase()}.`,
    evidence: `Based on ${count} paired check-ins`,
    explanation: `${strengthLabel}. The middle ending value was ${result.metrics.median}; values ranged from ${result.metrics.minimum} to ${result.metrics.maximum}.`
  };
}

export function remainingForFirstInsight(episodes: EatingEpisode[]): number {
  return Math.max(0, FIRST_INSIGHT_PAIR_REQUIREMENT - pairedEpisodes(episodes).length);
}

export function firstInsightProgress(episodes: EatingEpisode[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const completedPairs = Math.min(
    FIRST_INSIGHT_PAIR_REQUIREMENT,
    pairedEpisodes(episodes).length
  );
  const completed = 1 + completedPairs;

  return {
    completed,
    total: FIRST_INSIGHT_TOTAL_STEPS,
    percent: (completed / FIRST_INSIGHT_TOTAL_STEPS) * 100
  };
}
