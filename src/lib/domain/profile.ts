import type { EatingEpisode, ExperimentRecord, Program } from '../data/schema';
import { generateEarlyInsights, pairedEpisodes } from './insights';
import { generatePatternInsights, renderPattern, type PatternInsightResult } from './patterns';

export interface ProfileSection { id: string; title: string; summary: string; evidenceCount: number; supported: boolean; missing?: string; }
export interface AppetiteProfile { version: 1; programId: string; generatedAt: number; pairedCount: number; sections: ProfileSection[]; practices: string[]; }

const practiceByExperiment: Record<NonNullable<PatternInsightResult['eligibleExperiment']>, string> = {
  'eat-earlier-noticing': 'Keep noticing the first signs of hunger when it is useful.',
  'midway-pause': 'Use an occasional midway pause to notice satisfaction.',
  'name-body-hunger': 'Name body hunger and other reasons without judging either one.',
  'slow-first-minutes': 'Slow the first few minutes when you want more room to notice.'
};

export function buildProfile(program: Program, episodes: EatingEpisode[], experiments: ExperimentRecord[], now: number): AppetiteProfile {
  const paired = pairedEpisodes(episodes);
  const early = generateEarlyInsights(episodes);
  const patterns = generatePatternInsights(episodes);
  const typicalStart = early.find((result) => result.kind === 'typical-start');
  const typicalEnd = early.find((result) => result.kind === 'typical-end');
  const context = patterns.find((result) => result.context && result.kind !== 'non-hunger-context');
  const reason = patterns.find((result) => result.kind === 'non-hunger-context');
  const completed = experiments.filter((experiment) => experiment.status === 'complete' && experiment.result);
  const remaining = Math.max(0, 4 - paired.length);
  const missing = `Needs ${remaining} more paired check-in${remaining === 1 ? '' : 's'}.`;
  const sections: ProfileSection[] = [
    typicalStart ? { id: 'start', title: 'Typical starting sensation', summary: `Near ${Math.round(typicalStart.metrics.median)} across ${typicalStart.sampleSize} paired check-ins.`, evidenceCount: typicalStart.sampleSize, supported: true } : { id: 'start', title: 'Typical starting sensation', summary: '', evidenceCount: paired.length, supported: false, missing },
    typicalEnd ? { id: 'end', title: 'Typical ending sensation', summary: `Near ${Math.round(typicalEnd.metrics.median)} across ${typicalEnd.sampleSize} paired check-ins.`, evidenceCount: typicalEnd.sampleSize, supported: true } : { id: 'end', title: 'Typical ending sensation', summary: '', evidenceCount: paired.length, supported: false, missing },
    context ? { id: 'context', title: 'Context pattern', summary: renderPattern(context).finding, evidenceCount: context.sampleSize, supported: true } : { id: 'context', title: 'Context pattern', summary: '', evidenceCount: paired.length, supported: false, missing: 'No time or occasion comparison has enough evidence yet.' },
    reason ? { id: 'reason', title: 'What was present', summary: renderPattern(reason).finding, evidenceCount: reason.sampleSize, supported: true } : { id: 'reason', title: 'What was present', summary: '', evidenceCount: paired.filter((episode) => episode.reason).length, supported: false, missing: 'More optional reason descriptions would be needed.' },
    completed.length ? { id: 'experiment', title: 'Experiment comparison', summary: `${completed.length} completed seven-day comparison${completed.length === 1 ? '' : 's'}.`, evidenceCount: completed.length, supported: true } : { id: 'experiment', title: 'Experiment comparison', summary: '', evidenceCount: 0, supported: false, missing: 'No completed experiment comparison yet.' }
  ];
  const practices = [...new Set(patterns.flatMap((pattern) => pattern.eligibleExperiment ? [practiceByExperiment[pattern.eligibleExperiment]] : []))].slice(0, 3);
  return { version: 1, programId: program.id, generatedAt: now, pairedCount: paired.length, sections, practices };
}
