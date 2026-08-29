import type { EatingEpisode } from '../data/schema';
import { pairedEpisodes } from './insights';

export function supportEligible(episodes: EatingEpisode[]): boolean {
  const recent = pairedEpisodes(episodes).slice(-6);
  return recent.filter((episode) => (episode.afterLevel ?? 0) >= 9).length >= 3;
}

export const forbiddenJudgmentCopy = /\b(good|bad|clean|cheat|failed|perfect|on track|fell off|missed your goal|control yourself|resist)\b/i;
