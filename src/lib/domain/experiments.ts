import type { EatingEpisode, ExperimentRecord } from '../data/schema';
import type { PatternInsightResult } from './patterns';

export type ExperimentKind = ExperimentRecord['kind'];

export interface ExperimentOffer {
  kind: ExperimentKind;
  title: string;
  practice: string;
  measure: ExperimentRecord['target']['measure'];
  direction: ExperimentRecord['target']['direction'];
}

const offers: Record<ExperimentKind, ExperimentOffer> = {
  'eat-earlier-noticing': {
    kind: 'eat-earlier-noticing',
    title: 'Notice hunger a little earlier',
    practice: 'When it is practical, pause when hunger first becomes noticeable. Nothing to hit and no day is missed.',
    measure: 'uncomfortable-ending-rate',
    direction: 'lower'
  },
  'midway-pause': {
    kind: 'midway-pause',
    title: 'Try one midway pause',
    practice: 'Once during eating, pause briefly and notice what your body says before choosing what comes next.',
    measure: 'comfortable-ending-rate',
    direction: 'higher'
  },
  'name-body-hunger': {
    kind: 'name-body-hunger',
    title: 'Name what is present',
    practice: 'Before eating, notice whether body hunger, craving, emotion, habit, or company feels most present.',
    measure: 'comfortable-ending-rate',
    direction: 'higher'
  },
  'slow-first-minutes': {
    kind: 'slow-first-minutes',
    title: 'Notice the first few minutes',
    practice: 'For the first few minutes, slow down enough to notice taste and body sensation. Continue however you choose.',
    measure: 'uncomfortable-ending-rate',
    direction: 'lower'
  }
};

export function offerForInsight(insight: PatternInsightResult): ExperimentOffer | null {
  return insight.eligibleExperiment ? offers[insight.eligibleExperiment] : null;
}

function successful(episode: EatingEpisode, measure: ExperimentRecord['target']['measure']): boolean {
  if (measure === 'uncomfortable-ending-rate') return (episode.afterLevel ?? 0) >= 8;
  return (episode.afterLevel ?? 0) >= 5 && (episode.afterLevel ?? 0) <= 7;
}

export function evaluateExperiment(
  experiment: ExperimentRecord,
  episodes: EatingEpisode[],
  now: number
): NonNullable<ExperimentRecord['result']> {
  const baseline = experiment.baselineEpisodeIds
    .map((id) => episodes.find((episode) => episode.id === id))
    .filter((episode): episode is EatingEpisode => episode?.status === 'complete');
  const intervention = episodes.filter(
    (episode) => episode.status === 'complete' && episode.startedAt >= experiment.startedAt && episode.startedAt <= now
  );
  const baselineCount = baseline.filter((episode) => successful(episode, experiment.target.measure)).length;
  const experimentCount = intervention.filter((episode) => successful(episode, experiment.target.measure)).length;
  const common = { baselineCount, baselineTotal: baseline.length, experimentCount, experimentTotal: intervention.length };
  if (baseline.length < 3 || intervention.length < 3 || now - experiment.startedAt < 7 * 86_400_000) {
    return { state: 'learning', ...common };
  }
  const baselineRate = baselineCount / baseline.length;
  const experimentRate = experimentCount / intervention.length;
  const difference = experimentRate - baselineRate;
  const changed = experiment.target.direction === 'lower' ? difference <= -0.25 : difference >= 0.25;
  return { state: changed ? 'changed' : 'similar', ...common };
}

export function activeExperiment(experiments: ExperimentRecord[]): ExperimentRecord | null {
  return experiments.find((experiment) => experiment.status === 'active' || experiment.status === 'paused') ?? null;
}

export function experimentResultCopy(result: NonNullable<ExperimentRecord['result']>): string {
  if (result.state === 'learning') return 'Still learning — a few more paired check-ins will make the comparison clearer.';
  if (result.state === 'changed') return 'This measure appeared to change during the experiment.';
  return 'This measure appeared similar during the experiment.';
}
