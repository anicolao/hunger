import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createOpenEpisode, markEpisodeUnfinished } from '../domain/episodes';
import { IndexedDbRepository } from './repository';
import { DATABASE_NAME, SCHEMA_VERSION, storeNames, type Program } from './schema';

const program: Program = {
  id: 'program-1',
  startedAt: 1_788_020_800_000,
  timeZone: 'America/Toronto',
  status: 'active',
  onboardingVersion: 1,
  schemaVersion: SCHEMA_VERSION
};

function eventIds() {
  let next = 0;
  return () => `event-${++next}`;
}

function openLegacyDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      for (const storeName of storeNames) {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName, { keyPath: 'id' });
        }
      }
      request.transaction?.objectStore('programs').put({
        ...program,
        onboardingVersion: undefined,
        schemaVersion: 1
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('IndexedDbRepository', () => {
  it('appends user events and rebuilds disposable records by replay', async () => {
    const factory = new IDBFactory();
    const repository = new IndexedDbRepository(factory, eventIds());
    await repository.append({
      type: 'program/started',
      occurredAt: program.startedAt,
      payload: { program }
    });

    const open = createOpenEpisode({
      id: 'episode-1',
      programId: program.id,
      level: 4,
      now: program.startedAt,
      timeZone: program.timeZone
    });
    await repository.append({
      type: 'episode/started',
      occurredAt: open.startedAt,
      payload: { episode: open }
    });
    const unfinished = markEpisodeUnfinished(open, open.startedAt + 1_000);
    await repository.append({
      type: 'episode/changed',
      occurredAt: unfinished.updatedAt,
      payload: { episode: unfinished }
    });

    const events = await repository.listEvents();
    expect(events.map(({ type }) => type)).toEqual([
      'program/started',
      'episode/started',
      'episode/changed'
    ]);
    expect(events[1].payload).toEqual({ episode: open });
    expect(await repository.getEpisode(open.id)).toEqual(unfinished);

    await repository.rebuildProjection();
    expect(await repository.getEpisode(open.id)).toEqual(unfinished);

    await repository.append({
      type: 'episode/deleted',
      occurredAt: unfinished.updatedAt + 1,
      payload: { episodeId: open.id }
    });
    expect(await repository.getEpisode(open.id)).toBeNull();
    expect((await repository.listEvents()).map(({ type }) => type)).toContain('episode/deleted');

    await repository.clearAll();
    expect(await repository.getProgram()).toBeNull();
    expect(await repository.listEvents()).toEqual([]);
    repository.close();
  });

  it('physically deletes the database after clearing the event-backed model', async () => {
    const factory = new IDBFactory();
    const repository = new IndexedDbRepository(factory, eventIds());
    await repository.append({
      type: 'program/started',
      occurredAt: program.startedAt,
      payload: { program }
    });

    await repository.deleteAll();

    const reopened = new IndexedDbRepository(factory, eventIds());
    expect(await reopened.getProgram()).toBeNull();
    expect(await reopened.listEvents()).toEqual([]);
    reopened.close();
  });

  it('does not append a partial source event when a photo write runs out of space', async () => {
    const factory = new IDBFactory();
    const repository = new IndexedDbRepository(factory, eventIds());
    await repository.append({
      type: 'program/started', occurredAt: program.startedAt, payload: { program }
    });
    repository.simulateNextPhotoAppendFailure();
    await expect(repository.append({
      type: 'photo/stored',
      occurredAt: program.startedAt,
      payload: {
        photo: {
          id: 'photo-1', programId: program.id, blob: new Blob(['x']), mediaType: 'image/jpeg',
          width: 1, height: 1, bytes: 1
        }
      }
    })).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect((await repository.listEvents()).map(({ type }) => type)).toEqual(['program/started']);
    repository.close();
  });

  it('converts the prior mutable stores into source events once', async () => {
    const factory = new IDBFactory();
    const legacyDatabase = await openLegacyDatabase(factory);
    legacyDatabase.close();

    const repository = new IndexedDbRepository(factory, eventIds());
    expect(await repository.getProgram()).toEqual(program);
    expect(await repository.listEvents()).toMatchObject([
      { id: 'legacy-program/started-program-1', type: 'program/started' }
    ]);

    repository.close();
  });
});
