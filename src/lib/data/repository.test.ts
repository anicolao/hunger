import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { IndexedDbRepository } from './repository';
import { SCHEMA_VERSION, type Program } from './schema';

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

    await repository.clearAll();
    expect(await repository.getProgram()).toBeNull();
    repository.close();
  });
});
