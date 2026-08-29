import { describe, expect, it } from 'vitest';
import type { EatingEpisode } from '../data/schema';
import { forbiddenJudgmentCopy, supportEligible } from './support';
const episode = (id: string, after: number): EatingEpisode => ({ id, programId: 'p', startedAt: Number(id), completedAt: 2, capturedTimeZone: 'UTC', beforeLevel: 3, afterLevel: after, reason: null, occasion: null, note: null, photoId: null, recalledAfter: false, status: 'complete', createdAt: 1, updatedAt: 2, schemaVersion: 2 });
describe('quiet support eligibility', () => {
  it('waits for repeated extreme discomfort', () => { expect(supportEligible([episode('1', 9), episode('2', 9)])).toBe(false); expect(supportEligible([episode('1', 9), episode('2', 9), episode('3', 10)])).toBe(true); });
  it('detects judgmental state copy', () => expect(forbiddenJudgmentCopy.test('You failed today')).toBe(true));
});
