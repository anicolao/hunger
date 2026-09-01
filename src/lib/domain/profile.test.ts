import { describe, expect, it } from 'vitest';
import type { EatingEpisode, Program } from '../data/schema';
import { buildProfile } from './profile';
import { buildExport, encodeExportPhotos, exportHtml, exportJson } from '../platform/export';

const now = Date.UTC(2026, 7, 29);
const program: Program = { id: 'p', startedAt: now - 30 * 86_400_000, timeZone: 'UTC', status: 'complete', onboardingVersion: 1, schemaVersion: 1 };
function episode(index: number, note: string | null = null): EatingEpisode { return { id: `e${index}`, programId: 'p', startedAt: now - index * 1000, completedAt: now, capturedTimeZone: 'UTC', beforeLevel: 3 + index % 2, afterLevel: 6, reason: null, occasion: null, note, photoId: index === 1 ? 'private-photo' : null, recalledAfter: false, status: 'complete', createdAt: now, updatedAt: now, schemaVersion: 1 }; }

describe('profile and export', () => {
  it('shows supported sections and honest sparse states', () => {
    const profile = buildProfile(program, [episode(1), episode(2), episode(3), episode(4)], [], now);
    expect(profile.sections.find((section) => section.id === 'start')?.supported).toBe(true);
    expect(profile.sections.find((section) => section.id === 'context')?.missing).toContain('enough evidence');
  });
  it('uses a stable export schema, escapes HTML, and excludes photo ids and blobs', () => {
    const episodes = [episode(1, '<script>alert(1)</script>'), episode(2), episode(3), episode(4)];
    const profile = buildProfile(program, episodes, [], now);
    const data = buildExport(program, profile, episodes, [], now);
    expect(exportJson(data)).not.toContain('private-photo');
    expect(exportJson(data)).not.toContain('photoId');
    expect(exportHtml(data)).not.toContain('<script>');
    expect(data.exportVersion).toBe(1);
    expect(data.photoPolicy).toEqual({ included: false, maximumSourceBytes: 750_000, omittedCount: 1 });
  });
  it('includes a bounded photo only after explicit opt-in', async () => {
    const episodes = [episode(1), episode(2), episode(3), episode(4)];
    const profile = buildProfile(program, episodes, [], now);
    const photos = await encodeExportPhotos(episodes, async (id) => id === 'private-photo' ? {
      id,
      programId: program.id,
      blob: new Blob(['private image bytes'], { type: 'image/jpeg' }),
      mediaType: 'image/jpeg',
      width: 1,
      height: 1,
      bytes: 19
    } : null);
    const data = buildExport(program, profile, episodes, [], now, photos, true);
    expect(data.photos).toHaveLength(1);
    expect(data.photos?.[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(exportHtml(data)).toContain('Included photos');
    expect(data.photoPolicy).toMatchObject({ included: true, omittedCount: 0 });
  });
});
