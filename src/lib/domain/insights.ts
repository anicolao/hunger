import type { EatingEpisode, InsightSnapshot } from '../data/schema';
import { getSensationLevel } from './scale';

export const INSIGHT_ALGORITHM_VERSION = 1;
export const FIRST_INSIGHT_PAIR_REQUIREMENT = 4;
export const FIRST_INSIGHT_TOTAL_STEPS = FIRST_INSIGHT_PAIR_REQUIREMENT + 1;
export const INSIGHT_RECENCY_DAYS = 21;
export const INSIGHT_PUBLICATION_INTERVAL_DAYS = 7;
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
  const results: InsightResult[] = [];
  const starts = paired.map((episode) => episode.beforeLevel);
  const endings = paired.map((episode) => episode.afterLevel as number);
  if (new Set(starts).size > 1) results.push(createResult('typical-start', starts, paired, strength));
  if (new Set(endings).size > 1) results.push(createResult('typical-end', endings, paired, strength));
  return results;
}

interface PublishableInsight {
  id: string;
  sampleSize: number;
  evidenceEpisodeIds: string[];
}

function snapshotResultId(snapshot: InsightSnapshot): string | null {
  if (!snapshot.result || typeof snapshot.result !== 'object' || !('id' in snapshot.result)) return null;
  return typeof snapshot.result.id === 'string' ? snapshot.result.id : null;
}

export function selectInsightForPublication<T extends PublishableInsight>(
  candidates: T[],
  snapshots: InsightSnapshot[],
  episodes: EatingEpisode[],
  now: number
): T | null {
  const interval = INSIGHT_PUBLICATION_INTERVAL_DAYS * 86_400_000;
  if (snapshots.some((snapshot) => now - snapshot.shownAt < interval)) return null;
  const publishedIds = new Set(snapshots.map(snapshotResultId).filter((id): id is string => id !== null));
  const byId = new Map(episodes.map((episode) => [episode.id, episode]));
  const recencyCutoff = now - INSIGHT_RECENCY_DAYS * 86_400_000;
  const unique = new Set<string>();
  return candidates.find((candidate) => {
    if (unique.has(candidate.id) || publishedIds.has(candidate.id)) return false;
    unique.add(candidate.id);
    const evidence = candidate.evidenceEpisodeIds.map((id) => byId.get(id));
    return candidate.sampleSize >= FIRST_INSIGHT_PAIR_REQUIREMENT &&
      evidence.length === candidate.sampleSize && evidence.every(Boolean) &&
      Math.max(...evidence.map((episode) => episode?.startedAt ?? 0)) >= recencyCutoff;
  }) ?? null;
}

export function insightSnapshotSourceStatus(
  snapshot: InsightSnapshot,
  episodes: EatingEpisode[]
): 'current' | 'changed' | 'deleted' {
  if (!snapshot.result || typeof snapshot.result !== 'object' || !('evidenceEpisodeIds' in snapshot.result)) {
    return snapshot.sourceStatus ?? (snapshot.sourceChanged ? 'changed' : 'current');
  }
  const ids = Array.isArray(snapshot.result.evidenceEpisodeIds)
    ? snapshot.result.evidenceEpisodeIds.filter((id): id is string => typeof id === 'string')
    : [];
  const byId = new Map(episodes.map((episode) => [episode.id, episode]));
  if (ids.some((id) => !byId.has(id))) return 'deleted';
  if (ids.some((id) => (byId.get(id)?.updatedAt ?? 0) >= snapshot.shownAt)) return 'changed';
  return 'current';
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
