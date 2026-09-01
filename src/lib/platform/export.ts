import type { EatingEpisode, ExperimentRecord, PhotoRecord, Program } from '../data/schema';
import type { AppetiteProfile } from '../domain/profile';
import { nativeCapabilities, nativeRequest } from './native';

export const MAX_EXPORT_PHOTO_BYTES = 750_000;

export interface ExportPhoto {
  episodeId: string;
  mediaType: string;
  bytes: number;
  dataUrl: string;
}

export interface AppetiteExport {
  exportVersion: 1;
  exportedAt: number;
  program: Program;
  profile: AppetiteProfile;
  episodes: Array<Omit<EatingEpisode, 'photoId'> & { hasLocalPhoto: boolean }>;
  experiments: ExperimentRecord[];
  photos?: ExportPhoto[];
  photoPolicy: { included: boolean; maximumSourceBytes: number; omittedCount: number };
}

export function buildExport(
  program: Program,
  profile: AppetiteProfile,
  episodes: EatingEpisode[],
  experiments: ExperimentRecord[],
  exportedAt: number,
  photos: ExportPhoto[] = [],
  includePhotos = false
): AppetiteExport {
  const photoCount = episodes.filter((episode) => episode.photoId).length;
  return {
    exportVersion: 1,
    exportedAt,
    program,
    profile,
    episodes: episodes.map(({ photoId, ...episode }) => ({ ...episode, hasLocalPhoto: Boolean(photoId) })),
    experiments,
    ...(includePhotos ? { photos } : {}),
    photoPolicy: {
      included: includePhotos,
      maximumSourceBytes: MAX_EXPORT_PHOTO_BYTES,
      omittedCount: includePhotos ? Math.max(0, photoCount - photos.length) : photoCount
    }
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export async function encodeExportPhotos(
  episodes: EatingEpisode[],
  getPhoto: (id: string) => Promise<PhotoRecord | null>
): Promise<ExportPhoto[]> {
  const encoded: ExportPhoto[] = [];
  let total = 0;
  for (const episode of episodes) {
    if (!episode.photoId) continue;
    const photo = await getPhoto(episode.photoId);
    if (!photo || total + photo.bytes > MAX_EXPORT_PHOTO_BYTES) continue;
    const bytes = new Uint8Array(await photo.blob.arrayBuffer());
    encoded.push({
      episodeId: episode.id,
      mediaType: photo.mediaType,
      bytes: photo.bytes,
      dataUrl: `data:${photo.mediaType};base64,${bytesToBase64(bytes)}`
    });
    total += photo.bytes;
  }
  return encoded;
}
export function exportJson(data: AppetiteExport): string { return `${JSON.stringify(data, null, 2)}\n`; }
function escapeHtml(value: unknown): string { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string); }
export function exportHtml(data: AppetiteExport): string {
  const supported = data.profile.sections.filter((section) => section.supported);
  const photos = data.photos?.length
    ? `<h2>Included photos</h2>${data.photos.map((photo) => `<figure><img alt="Eating moment ${escapeHtml(photo.episodeId)}" src="${escapeHtml(photo.dataUrl)}"><figcaption>Stored with check-in ${escapeHtml(photo.episodeId)}</figcaption></figure>`).join('')}`
    : '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>My Appetite Profile</title><body><main><h1>My Appetite Profile</h1><p>Based on ${data.profile.pairedCount} paired check-ins.</p>${supported.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.summary)}</p><p>Evidence: ${section.evidenceCount}</p></section>`).join('')}<h2>Practices to continue</h2><ul>${data.profile.practices.map((practice) => `<li>${escapeHtml(practice)}</li>`).join('')}</ul>${photos}<p>Photo policy: ${data.photoPolicy.included ? 'explicitly included' : 'excluded'}; ${data.photoPolicy.omittedCount} omitted.</p><p>This private export contains observations, not medical advice or proof of cause.</p></main></body></html>`;
}
export function downloadText(filename: string, mediaType: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function shareExport(
  filename: 'appetite-profile.json' | 'appetite-profile.html',
  mediaType: 'application/json' | 'text/html',
  content: string
): Promise<'native-ios' | 'browser-download'> {
  const capabilities = await nativeCapabilities();
  if (capabilities?.commands.includes('export.share')) {
    await nativeRequest('export.share', { filename, mimeType: mediaType, content });
    return 'native-ios';
  }
  downloadText(filename, mediaType, content);
  return 'browser-download';
}
