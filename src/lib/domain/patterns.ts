import type { EatingEpisode, EatingReason, Occasion } from '../data/schema';
import { pairedEpisodes, type InsightResult } from './insights';

export type TimeBucket = 'morning' | 'midday' | 'evening' | 'late';
export type PatternKind =
  | 'urgent-start-association'
  | 'comfortable-start-band'
  | 'difficult-context'
  | 'easy-context'
  | 'non-hunger-context';

export interface PatternInsightResult {
  id: string;
  algorithmVersion: 1;
  kind: PatternKind;
  strength: 'early' | 'recurring';
  evidenceEpisodeIds: string[];
  sampleSize: number;
  context?: TimeBucket | Occasion;
  eligibleExperiment?:
    | 'eat-earlier-noticing'
    | 'midway-pause'
    | 'name-body-hunger'
    | 'slow-first-minutes';
  metrics: {
    primaryCount: number;
    primaryTotal: number;
    comparisonCount: number;
    comparisonTotal: number;
    difference: number;
  };
}

export type AnyInsightResult = InsightResult | PatternInsightResult;

export function getTimeBucket(timestamp: number, timeZone: string): TimeBucket {
  const parts = new Intl.DateTimeFormat('en-CA', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone
  }).formatToParts(timestamp);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'midday';
  if (hour >= 16 && hour < 21) return 'evening';
  return 'late';
}

function uncomfortableRate(episodes: EatingEpisode[]) {
  const count = episodes.filter((episode) => (episode.afterLevel ?? 0) >= 8).length;
  return { count, total: episodes.length, rate: count / episodes.length };
}

function comfortableRate(episodes: EatingEpisode[]) {
  const count = episodes.filter((episode) => (episode.afterLevel ?? 0) >= 5 && (episode.afterLevel ?? 0) <= 7).length;
  return { count, total: episodes.length, rate: count / episodes.length };
}

function comparisonResult(input: {
  kind: PatternKind;
  primary: EatingEpisode[];
  comparison: EatingEpisode[];
  outcome: (episodes: EatingEpisode[]) => { count: number; total: number; rate: number };
  context?: TimeBucket | Occasion;
  experiment?: PatternInsightResult['eligibleExperiment'];
}): PatternInsightResult | null {
  if (input.primary.length < 3 || input.comparison.length < 3) return null;
  const primary = input.outcome(input.primary);
  const comparison = input.outcome(input.comparison);
  const difference = primary.rate - comparison.rate;
  if (Math.abs(difference) < 0.25) return null;
  const evidence = [...input.primary, ...input.comparison];
  return {
    id: `${input.kind}-${input.context ?? 'overall'}-v1`,
    algorithmVersion: 1,
    kind: input.kind,
    strength: evidence.length >= 8 && input.primary.length >= 4 ? 'recurring' : 'early',
    evidenceEpisodeIds: evidence.map((episode) => episode.id),
    sampleSize: evidence.length,
    context: input.context,
    eligibleExperiment: input.experiment,
    metrics: {
      primaryCount: primary.count,
      primaryTotal: primary.total,
      comparisonCount: comparison.count,
      comparisonTotal: comparison.total,
      difference
    }
  };
}

export function generatePatternInsights(episodes: EatingEpisode[]): PatternInsightResult[] {
  const paired = pairedEpisodes(episodes);
  const candidates: PatternInsightResult[] = [];
  const urgent = paired.filter((episode) => episode.beforeLevel <= 2);
  const nonUrgent = paired.filter((episode) => episode.beforeLevel > 2);
  const urgentResult = comparisonResult({
    kind: 'urgent-start-association',
    primary: urgent,
    comparison: nonUrgent,
    outcome: uncomfortableRate,
    experiment: 'eat-earlier-noticing'
  });
  if (urgentResult) candidates.push(urgentResult);

  const comfortableStart = paired.filter((episode) => episode.beforeLevel >= 3 && episode.beforeLevel <= 4);
  const otherStart = paired.filter((episode) => episode.beforeLevel < 3 || episode.beforeLevel > 4);
  const comfortableResult = comparisonResult({
    kind: 'comfortable-start-band',
    primary: comfortableStart,
    comparison: otherStart,
    outcome: comfortableRate,
    experiment: 'midway-pause'
  });
  if (comfortableResult) candidates.push(comfortableResult);

  for (const context of ['morning', 'midday', 'evening', 'late'] as const) {
    const contextual = paired.filter(
      (episode) => getTimeBucket(episode.startedAt, episode.capturedTimeZone) === context
    );
    const other = paired.filter(
      (episode) => getTimeBucket(episode.startedAt, episode.capturedTimeZone) !== context
    );
    if (contextual.length >= 4 && other.length >= 3) {
      const difficult = comparisonResult({
        kind: 'difficult-context',
        primary: contextual,
        comparison: other,
        outcome: uncomfortableRate,
        context,
        experiment: 'slow-first-minutes'
      });
      if (difficult && difficult.metrics.difference > 0) candidates.push(difficult);

      const easy = comparisonResult({
        kind: 'easy-context',
        primary: contextual,
        comparison: other,
        outcome: comfortableRate,
        context
      });
      if (easy && easy.metrics.difference > 0) candidates.push(easy);
    }
  }

  const nonPhysicalReasons: EatingReason[] = ['craving', 'emotion', 'boredom', 'habit', 'social-context'];
  for (const context of ['evening', 'late'] as const) {
    const described = paired.filter(
      (episode) =>
        episode.reason && getTimeBucket(episode.startedAt, episode.capturedTimeZone) === context
    );
    if (described.length < 3) continue;
    const nonPhysical = described.filter((episode) => nonPhysicalReasons.includes(episode.reason as EatingReason));
    if (nonPhysical.length / described.length < 0.67) continue;
    candidates.push({
      id: `non-hunger-context-${context}-v1`,
      algorithmVersion: 1,
      kind: 'non-hunger-context',
      strength: described.length >= 4 ? 'recurring' : 'early',
      evidenceEpisodeIds: described.map((episode) => episode.id),
      sampleSize: described.length,
      context,
      eligibleExperiment: 'name-body-hunger',
      metrics: {
        primaryCount: nonPhysical.length,
        primaryTotal: described.length,
        comparisonCount: described.length - nonPhysical.length,
        comparisonTotal: described.length,
        difference: nonPhysical.length / described.length
      }
    });
  }

  return candidates
    .sort((left, right) => {
      const strength = Number(right.strength === 'recurring') - Number(left.strength === 'recurring');
      const magnitude = Math.abs(right.metrics.difference) - Math.abs(left.metrics.difference);
      const priority: Record<PatternKind, number> = {
        'urgent-start-association': 0,
        'comfortable-start-band': 1,
        'difficult-context': 2,
        'non-hunger-context': 3,
        'easy-context': 4
      };
      return strength || magnitude || priority[left.kind] - priority[right.kind] || left.id.localeCompare(right.id);
    })
    .filter((candidate, index, all) =>
      all.findIndex((item) => item.kind === candidate.kind && item.context === candidate.context) === index
    );
}

export function renderPattern(result: PatternInsightResult) {
  const { primaryCount, primaryTotal, comparisonCount, comparisonTotal } = result.metrics;
  switch (result.kind) {
    case 'urgent-start-association':
      return {
        title: 'Very hungry starts ended differently',
        finding: `Check-ins that began at 1–2 more often ended uncomfortably full (${primaryCount} of ${primaryTotal} vs ${comparisonCount} of ${comparisonTotal}).`
      };
    case 'comfortable-start-band':
      return {
        title: 'A comfortable starting range appeared',
        finding: `Starting around 3–4 was more often followed by a comfortable ending (${primaryCount} of ${primaryTotal} vs ${comparisonCount} of ${comparisonTotal}).`
      };
    case 'difficult-context':
      return {
        title: `${capitalize(result.context)} check-ins ended differently`,
        finding: `${capitalize(result.context)} check-ins more often ended at 8 or above (${primaryCount} of ${primaryTotal} vs ${comparisonCount} of ${comparisonTotal}).`
      };
    case 'easy-context':
      return {
        title: `${capitalize(result.context)} felt more comfortable`,
        finding: `${capitalize(result.context)} check-ins more often ended in the comfortable range (${primaryCount} of ${primaryTotal} vs ${comparisonCount} of ${comparisonTotal}).`
      };
    case 'non-hunger-context':
      return {
        title: `What was present ${result.context}`,
        finding: `${primaryCount} of ${primaryTotal} ${result.context} check-ins were described as craving, emotion, boredom, habit, or social context rather than physical hunger.`
      };
  }
}

function capitalize(value: string | undefined): string {
  return value ? value[0].toUpperCase() + value.slice(1) : 'Context';
}
