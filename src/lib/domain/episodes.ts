import { isSensationLevel } from './scale';
import { SCHEMA_VERSION, type EatingEpisode, type EatingReason, type Occasion } from '../data/schema';

export const OPEN_EPISODE_STALE_MS = 4 * 60 * 60 * 1000;
export const RECALL_LIMIT_MS = 24 * 60 * 60 * 1000;

export interface EpisodeContext {
  reason?: EatingReason | null;
  occasion?: Occasion | null;
  note?: string | null;
  photoId?: string | null;
}

function cleanNote(note: string | null | undefined): string | null {
  const cleaned = note?.trim() ?? '';
  if (cleaned.length > 140) throw new RangeError('Notes can contain at most 140 characters');
  return cleaned || null;
}

export function createOpenEpisode(input: {
  id: string;
  programId: string;
  level: number;
  now: number;
  timeZone: string;
  context?: Pick<EpisodeContext, 'occasion' | 'photoId'>;
}): EatingEpisode {
  if (!isSensationLevel(input.level)) throw new RangeError('Choose a sensation from 1 to 10');

  return {
    id: input.id,
    programId: input.programId,
    startedAt: input.now,
    completedAt: null,
    capturedTimeZone: input.timeZone,
    beforeLevel: input.level,
    afterLevel: null,
    reason: null,
    occasion: input.context?.occasion ?? null,
    note: null,
    photoId: input.context?.photoId ?? null,
    recalledAfter: false,
    status: 'open',
    createdAt: input.now,
    updatedAt: input.now,
    schemaVersion: SCHEMA_VERSION
  };
}

export function completeEpisode(
  episode: EatingEpisode,
  level: number,
  now: number,
  context: EpisodeContext = {}
): EatingEpisode {
  if (episode.status === 'complete') throw new Error('This check-in is already complete');
  if (now - episode.startedAt > RECALL_LIMIT_MS) throw new Error('This eating moment is too old to recall');
  if (!isSensationLevel(level)) throw new RangeError('Choose a sensation from 1 to 10');

  return {
    ...episode,
    afterLevel: level,
    completedAt: now,
    reason: context.reason ?? null,
    occasion: context.occasion ?? episode.occasion,
    note: cleanNote(context.note),
    photoId: context.photoId ?? episode.photoId,
    recalledAfter: now - episode.startedAt >= OPEN_EPISODE_STALE_MS,
    status: 'complete',
    updatedAt: now
  };
}

export function markEpisodeUnfinished(episode: EatingEpisode, now: number): EatingEpisode {
  if (episode.status === 'complete') throw new Error('A completed check-in cannot be unfinished');
  return { ...episode, status: 'unfinished', afterLevel: null, completedAt: null, updatedAt: now };
}

export function updateEpisode(
  episode: EatingEpisode,
  changes: { beforeLevel: number; afterLevel: number | null } & EpisodeContext,
  now: number
): EatingEpisode {
  if (!isSensationLevel(changes.beforeLevel)) throw new RangeError('Choose a before sensation');
  if (changes.afterLevel !== null && !isSensationLevel(changes.afterLevel)) {
    throw new RangeError('Choose an after sensation');
  }

  return {
    ...episode,
    beforeLevel: changes.beforeLevel,
    afterLevel: changes.afterLevel,
    reason: changes.reason ?? null,
    occasion: changes.occasion ?? null,
    note: cleanNote(changes.note),
    photoId: changes.photoId ?? null,
    status: changes.afterLevel === null ? 'unfinished' : 'complete',
    completedAt: changes.afterLevel === null ? null : (episode.completedAt ?? now),
    updatedAt: now
  };
}

export function isOpenEpisodeStale(episode: EatingEpisode, now: number): boolean {
  return episode.status === 'open' && now - episode.startedAt >= OPEN_EPISODE_STALE_MS;
}
