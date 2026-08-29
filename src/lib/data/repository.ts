import {
  DATABASE_NAME,
  DATABASE_VERSION,
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
import { migrateEpisode, migrateProgram } from './migrations';

type StoreRecord = Program | EatingEpisode | InsightSnapshot | ExperimentRecord | PhotoRecord | AppSettings;

export interface AppetiteRepository {
  getProgram(): Promise<Program | null>;
  saveProgram(program: Program): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  listEpisodes(programId: string): Promise<EatingEpisode[]>;
  getEpisode(id: string): Promise<EatingEpisode | null>;
  getOpenEpisode(programId: string): Promise<EatingEpisode | null>;
  saveEpisode(episode: EatingEpisode): Promise<void>;
  deleteEpisode(id: string): Promise<void>;
  savePhoto(photo: PhotoRecord): Promise<void>;
  getPhoto(id: string): Promise<PhotoRecord | null>;
  listInsightSnapshots(programId: string): Promise<InsightSnapshot[]>;
  saveInsightSnapshot(snapshot: InsightSnapshot): Promise<void>;
  listExperiments(programId: string): Promise<ExperimentRecord[]>;
  saveExperiment(experiment: ExperimentRecord): Promise<void>;
  importFixture(fixture: { program: Program; episodes: EatingEpisode[]; settings?: AppSettings; experiments?: ExperimentRecord[] }): Promise<void>;
  clearAll(): Promise<void>;
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

export class IndexedDbRepository implements AppetiteRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  async getProgram(): Promise<Program | null> {
    const records = await this.getAll<Program>('programs');
    const record = records.sort((left, right) => right.startedAt - left.startedAt)[0];
    return record ? migrateProgram(record) : null;
  }

  async saveProgram(program: Program): Promise<void> {
    await this.put('programs', program);
  }

  async getSettings(): Promise<AppSettings> {
    const database = await this.open();
    const transaction = database.transaction('settings', 'readonly');
    const stored = await requestResult<AppSettings | undefined>(
      transaction.objectStore('settings').get('settings')
    );
    await transactionDone(transaction);
    return stored ?? { ...initialSettings };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.put('settings', settings);
  }

  async listEpisodes(programId: string): Promise<EatingEpisode[]> {
    const episodes = await this.getAll<EatingEpisode>('episodes');
    return episodes.map(migrateEpisode)
      .filter((episode) => episode.programId === programId)
      .sort((left, right) => right.startedAt - left.startedAt);
  }

  async getEpisode(id: string): Promise<EatingEpisode | null> {
    return (await this.get<EatingEpisode>('episodes', id)) ?? null;
  }

  async getOpenEpisode(programId: string): Promise<EatingEpisode | null> {
    return (await this.listEpisodes(programId)).find((episode) => episode.status === 'open') ?? null;
  }

  async saveEpisode(episode: EatingEpisode): Promise<void> {
    await this.put('episodes', episode);
  }

  async deleteEpisode(id: string): Promise<void> {
    const episode = await this.getEpisode(id);
    const database = await this.open();
    const stores: StoreName[] = episode?.photoId ? ['episodes', 'photos'] : ['episodes'];
    const transaction = database.transaction(stores, 'readwrite');
    transaction.objectStore('episodes').delete(id);
    if (episode?.photoId) transaction.objectStore('photos').delete(episode.photoId);
    await transactionDone(transaction);
  }

  async savePhoto(photo: PhotoRecord): Promise<void> {
    await this.put('photos', photo);
  }

  async getPhoto(id: string): Promise<PhotoRecord | null> {
    return (await this.get<PhotoRecord>('photos', id)) ?? null;
  }

  async listInsightSnapshots(programId: string): Promise<InsightSnapshot[]> {
    return (await this.getAll<InsightSnapshot>('insights'))
      .filter((snapshot) => snapshot.programId === programId)
      .sort((left, right) => right.shownAt - left.shownAt);
  }

  async saveInsightSnapshot(snapshot: InsightSnapshot): Promise<void> {
    await this.put('insights', snapshot);
  }

  async listExperiments(programId: string): Promise<ExperimentRecord[]> {
    return (await this.getAll<ExperimentRecord>('experiments'))
      .filter((experiment) => experiment.programId === programId)
      .sort((left, right) => right.startedAt - left.startedAt);
  }

  async saveExperiment(experiment: ExperimentRecord): Promise<void> {
    await this.put('experiments', experiment);
  }

  async importFixture(fixture: { program: Program; episodes: EatingEpisode[]; settings?: AppSettings; experiments?: ExperimentRecord[] }): Promise<void> {
    await this.clearAll();
    await this.saveProgram(fixture.program);
    if (fixture.settings) await this.saveSettings(fixture.settings);
    for (const episode of fixture.episodes) await this.saveEpisode(episode);
    for (const experiment of fixture.experiments ?? []) await this.saveExperiment(experiment);
  }

  async clearAll(): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction([...storeNames], 'readwrite');
    for (const storeName of storeNames) transaction.objectStore(storeName).clear();
    await transactionDone(transaction);
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close());
    this.databasePromise = null;
  }

  private async getAll<T extends StoreRecord>(storeName: StoreName): Promise<T[]> {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readonly');
    const records = await requestResult<T[]>(transaction.objectStore(storeName).getAll());
    await transactionDone(transaction);
    return records;
  }

  private async get<T extends StoreRecord>(storeName: StoreName, id: IDBValidKey): Promise<T | undefined> {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readonly');
    const record = await requestResult<T | undefined>(transaction.objectStore(storeName).get(id));
    await transactionDone(transaction);
    return record;
  }

  private async put(storeName: StoreName, value: StoreRecord): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
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
