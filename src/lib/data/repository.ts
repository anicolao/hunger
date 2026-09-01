import {
  DATABASE_NAME,
  DATABASE_VERSION,
  EVENT_STORE_NAME,
  METADATA_STORE_NAME,
  allStoreNames,
  initialSettings,
  storeNames,
  type AppSettings,
  type EatingEpisode,
  type ExperimentRecord,
  type InsightSnapshot,
  type PhotoRecord,
  type Program,
  type StoreName
} from './schema';
import {
  EVENT_SCHEMA_VERSION,
  projectAppetiteEvents,
  type AppetiteEvent,
  type NewAppetiteEvent
} from './events';
import { migrateEpisode, migrateProgram } from './migrations';

type StoreRecord =
  | Program
  | EatingEpisode
  | InsightSnapshot
  | ExperimentRecord
  | PhotoRecord
  | AppSettings;

interface RepositoryMetadata {
  id: 'event-log';
  legacyProjectionImported: true;
}

export interface FixtureSnapshot {
  program: Program;
  episodes: EatingEpisode[];
  settings?: AppSettings;
  experiments?: ExperimentRecord[];
}

export interface AppetiteRepository {
  getProgram(): Promise<Program | null>;
  getSettings(): Promise<AppSettings>;
  listEpisodes(programId: string): Promise<EatingEpisode[]>;
  getEpisode(id: string): Promise<EatingEpisode | null>;
  getOpenEpisode(programId: string): Promise<EatingEpisode | null>;
  getPhoto(id: string): Promise<PhotoRecord | null>;
  listInsightSnapshots(programId: string): Promise<InsightSnapshot[]>;
  listExperiments(programId: string): Promise<ExperimentRecord[]>;
  append(...events: NewAppetiteEvent[]): Promise<void>;
  listEvents(): Promise<AppetiteEvent[]>;
  rebuildProjection(): Promise<void>;
  importFixture(fixture: FixtureSnapshot): Promise<void>;
  clearAll(): Promise<void>;
  deleteAll(): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function eventTime(record: StoreRecord): number {
  if ('startedAt' in record) return record.startedAt;
  if ('shownAt' in record) return record.shownAt;
  return 0;
}

export class IndexedDbRepository implements AppetiteRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readyPromise: Promise<IDBDatabase> | null = null;
  private failNextPhotoAppend = false;

  constructor(
    private readonly factory: IDBFactory = indexedDB,
    private readonly createEventId: () => string = () => crypto.randomUUID()
  ) {}

  async getProgram(): Promise<Program | null> {
    const records = await this.getAll<Program>('programs');
    return records.sort((left, right) => right.startedAt - left.startedAt)[0] ?? null;
  }

  async getSettings(): Promise<AppSettings> {
    return (await this.get<AppSettings>('settings', 'settings')) ?? {
      ...initialSettings,
      reminderWindows: []
    };
  }

  async listEpisodes(programId: string): Promise<EatingEpisode[]> {
    return (await this.getAll<EatingEpisode>('episodes'))
      .filter((episode) => episode.programId === programId)
      .sort((left, right) => right.startedAt - left.startedAt);
  }

  async getEpisode(id: string): Promise<EatingEpisode | null> {
    return (await this.get<EatingEpisode>('episodes', id)) ?? null;
  }

  async getOpenEpisode(programId: string): Promise<EatingEpisode | null> {
    return (await this.listEpisodes(programId)).find((episode) => episode.status === 'open') ?? null;
  }

  async getPhoto(id: string): Promise<PhotoRecord | null> {
    return (await this.get<PhotoRecord>('photos', id)) ?? null;
  }

  async listInsightSnapshots(programId: string): Promise<InsightSnapshot[]> {
    return (await this.getAll<InsightSnapshot>('insights'))
      .filter((snapshot) => snapshot.programId === programId)
      .sort((left, right) => right.shownAt - left.shownAt);
  }

  async listExperiments(programId: string): Promise<ExperimentRecord[]> {
    return (await this.getAll<ExperimentRecord>('experiments'))
      .filter((experiment) => experiment.programId === programId)
      .sort((left, right) => right.startedAt - left.startedAt);
  }

  async append(...events: NewAppetiteEvent[]): Promise<void> {
    if (events.length === 0) return;
    if (this.failNextPhotoAppend && events.some((event) => event.type === 'photo/stored')) {
      this.failNextPhotoAppend = false;
      throw new DOMException('The device has no room for this photo.', 'QuotaExceededError');
    }
    const database = await this.ready();
    const transaction = database.transaction(EVENT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(EVENT_STORE_NAME);
    for (const event of events) {
      store.add({
        ...event,
        id: this.createEventId(),
        version: EVENT_SCHEMA_VERSION
      });
    }
    await transactionDone(transaction);
    await this.materialize(database);
  }

  simulateNextPhotoAppendFailure(): void {
    this.failNextPhotoAppend = true;
  }

  async listEvents(): Promise<AppetiteEvent[]> {
    return this.readAll<AppetiteEvent>(await this.ready(), EVENT_STORE_NAME);
  }

  async rebuildProjection(): Promise<void> {
    await this.materialize(await this.ready());
  }

  async importFixture(fixture: FixtureSnapshot): Promise<void> {
    await this.clearAll();
    const events: NewAppetiteEvent[] = [
      {
        type: 'program/started',
        occurredAt: fixture.program.startedAt,
        payload: { program: fixture.program }
      }
    ];
    if (fixture.settings) {
      events.push({
        type: 'settings/changed',
        occurredAt: fixture.program.startedAt,
        payload: { settings: fixture.settings }
      });
    }
    for (const episode of fixture.episodes) {
      events.push({
        type: 'episode/started',
        occurredAt: episode.startedAt,
        payload: { episode }
      });
    }
    for (const experiment of fixture.experiments ?? []) {
      events.push({
        type: 'experiment/changed',
        occurredAt: experiment.startedAt,
        payload: { experiment }
      });
    }
    await this.append(...events);
  }

  async clearAll(): Promise<void> {
    const database = await this.ready();
    const transaction = database.transaction([...allStoreNames], 'readwrite');
    for (const storeName of allStoreNames) transaction.objectStore(storeName).clear();
    await transactionDone(transaction);
  }

  async deleteAll(): Promise<void> {
    await this.clearAll();
    const database = await this.databasePromise;
    database?.close();
    this.databasePromise = null;
    this.readyPromise = null;
    await new Promise<void>((resolve, reject) => {
      const request = this.factory.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not delete private app storage'));
      request.onblocked = () => reject(new Error('Private app storage is still open'));
    });
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close());
    this.databasePromise = null;
    this.readyPromise = null;
  }

  private async getAll<T extends StoreRecord>(storeName: StoreName): Promise<T[]> {
    return this.readAll<T>(await this.ready(), storeName);
  }

  private async get<T extends StoreRecord>(
    storeName: StoreName,
    id: IDBValidKey
  ): Promise<T | undefined> {
    const database = await this.ready();
    const transaction = database.transaction(storeName, 'readonly');
    const record = await requestResult<T | undefined>(transaction.objectStore(storeName).get(id));
    await transactionDone(transaction);
    return record;
  }

  private async readAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
    const transaction = database.transaction(storeName, 'readonly');
    const records = await requestResult<T[]>(transaction.objectStore(storeName).getAll());
    await transactionDone(transaction);
    return records;
  }

  private async ready(): Promise<IDBDatabase> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.open().then(async (database) => {
      await this.importLegacyProjectionOnce(database);
      await this.materialize(database);
      return database;
    });
    return this.readyPromise;
  }

  private async importLegacyProjectionOnce(database: IDBDatabase): Promise<void> {
    const metadataTransaction = database.transaction(METADATA_STORE_NAME, 'readonly');
    const metadata = await requestResult<RepositoryMetadata | undefined>(
      metadataTransaction.objectStore(METADATA_STORE_NAME).get('event-log')
    );
    await transactionDone(metadataTransaction);
    if (metadata) return;

    const existingEvents = await this.readAll<AppetiteEvent>(database, EVENT_STORE_NAME);
    const legacyEvents = existingEvents.length === 0 ? await this.legacyProjectionEvents(database) : [];
    const transaction = database.transaction([EVENT_STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const eventStore = transaction.objectStore(EVENT_STORE_NAME);
    for (const event of legacyEvents) {
      eventStore.add({
        ...event,
        id: `legacy-${event.type}-${this.legacyRecordId(event)}`,
        version: EVENT_SCHEMA_VERSION
      });
    }
    transaction.objectStore(METADATA_STORE_NAME).put({
      id: 'event-log',
      legacyProjectionImported: true
    } satisfies RepositoryMetadata);
    await transactionDone(transaction);
  }

  private async legacyProjectionEvents(database: IDBDatabase): Promise<NewAppetiteEvent[]> {
    const [programs, episodes, insights, experiments, photos, settings] = await Promise.all([
      this.readAll<Program>(database, 'programs'),
      this.readAll<EatingEpisode>(database, 'episodes'),
      this.readAll<InsightSnapshot>(database, 'insights'),
      this.readAll<ExperimentRecord>(database, 'experiments'),
      this.readAll<PhotoRecord>(database, 'photos'),
      this.readAll<AppSettings>(database, 'settings')
    ]);
    const events: NewAppetiteEvent[] = [];
    for (const program of programs) {
      events.push({
        type: 'program/started',
        occurredAt: eventTime(program),
        payload: { program: migrateProgram(program) }
      });
    }
    for (const photo of photos) {
      events.push({ type: 'photo/stored', occurredAt: eventTime(photo), payload: { photo } });
    }
    for (const episode of episodes) {
      events.push({
        type: 'episode/started',
        occurredAt: eventTime(episode),
        payload: { episode: migrateEpisode(episode) }
      });
    }
    for (const snapshot of insights) {
      events.push({
        type: 'insight/snapshot-recorded',
        occurredAt: eventTime(snapshot),
        payload: { snapshot }
      });
    }
    for (const experiment of experiments) {
      events.push({
        type: 'experiment/changed',
        occurredAt: eventTime(experiment),
        payload: { experiment }
      });
    }
    for (const setting of settings) {
      events.push({ type: 'settings/changed', occurredAt: 0, payload: { settings: setting } });
    }
    return events.sort(
      (left, right) => left.occurredAt - right.occurredAt || left.type.localeCompare(right.type)
    );
  }

  private legacyRecordId(event: NewAppetiteEvent): string {
    if ('program' in event.payload) return event.payload.program.id;
    if ('episode' in event.payload) return event.payload.episode.id;
    if ('snapshot' in event.payload) return event.payload.snapshot.id;
    if ('experiment' in event.payload) return event.payload.experiment.id;
    if ('photo' in event.payload) return event.payload.photo.id;
    if ('settings' in event.payload) return event.payload.settings.id;
    return event.payload.episodeId;
  }

  private async materialize(database: IDBDatabase): Promise<void> {
    const projection = projectAppetiteEvents(
      await this.readAll<AppetiteEvent>(database, EVENT_STORE_NAME)
    );
    const transaction = database.transaction([...storeNames], 'readwrite');
    for (const storeName of storeNames) transaction.objectStore(storeName).clear();
    for (const program of projection.programs) transaction.objectStore('programs').put(program);
    for (const episode of projection.episodes) transaction.objectStore('episodes').put(episode);
    for (const insight of projection.insights) transaction.objectStore('insights').put(insight);
    for (const experiment of projection.experiments) {
      transaction.objectStore('experiments').put(experiment);
    }
    for (const photo of projection.photos) transaction.objectStore('photos').put(photo);
    transaction.objectStore('settings').put(projection.settings);
    await transactionDone(transaction);
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const storeName of storeNames) {
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
        if (!database.objectStoreNames.contains(EVENT_STORE_NAME)) {
          const events = database.createObjectStore(EVENT_STORE_NAME, {
            keyPath: 'sequence',
            autoIncrement: true
          });
          events.createIndex('id', 'id', { unique: true });
        }
        if (!database.objectStoreNames.contains(METADATA_STORE_NAME)) {
          database.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open private app storage'));
      request.onblocked = () => reject(new Error('Private app storage is open in another tab'));
    });
    return this.databasePromise;
  }
}

let repository: IndexedDbRepository | null = null;

export function getRepository(): IndexedDbRepository {
  repository ??= new IndexedDbRepository();
  return repository;
}
