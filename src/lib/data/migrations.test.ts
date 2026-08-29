import { describe, expect, it } from 'vitest';
import { migrateEpisode, UnsupportedSchemaError } from './migrations';
import type { EatingEpisode } from './schema';

const legacy = { id: 'e', programId: 'p', startedAt: 1, completedAt: 2, capturedTimeZone: 'UTC', beforeLevel: 3, afterLevel: 6, reason: null, occasion: null, status: 'complete', createdAt: 1, updatedAt: 2, schemaVersion: 1 } as EatingEpisode;
describe('stored schema migrations', () => {
  it('fills safe defaults while retaining the record', () => expect(migrateEpisode(legacy)).toMatchObject({ recalledAfter: false, note: null, schemaVersion: 2 }));
  it('rejects unknown future records rather than guessing', () => expect(() => migrateEpisode({ ...legacy, schemaVersion: 99 })).toThrow(UnsupportedSchemaError));
});
