import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { IndexedDbRepository } from './repository';
import { SCHEMA_VERSION, type Program } from './schema';
import { createOpenEpisode } from '../domain/episodes';

describe('IndexedDbRepository', () => {
  it('round-trips a program and clears every private store', async () => {
    const repository = new IndexedDbRepository(new IDBFactory());
    const program: Program = {
      id: 'program-1',
      startedAt: 1_788_020_800_000,
      timeZone: 'America/Toronto',
      status: 'active',
      onboardingVersion: 1,
      schemaVersion: SCHEMA_VERSION
    };

    await repository.saveProgram(program);
    expect(await repository.getProgram()).toEqual(program);
    expect(await repository.getSettings()).toMatchObject({ id: 'settings', remindersPaused: false });

    const episode = createOpenEpisode({
      id: 'episode-1',
      programId: program.id,
      level: 4,
      now: program.startedAt,
      timeZone: program.timeZone
    });
    await repository.saveEpisode(episode);
    expect(await repository.getOpenEpisode(program.id)).toEqual(episode);
    expect(await repository.listEpisodes(program.id)).toEqual([episode]);

    await repository.deleteEpisode(episode.id);
    expect(await repository.getEpisode(episode.id)).toBeNull();

    await repository.clearAll();
    expect(await repository.getProgram()).toBeNull();
    repository.close();
  });
});
