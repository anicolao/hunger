import type { EatingEpisode, ExperimentRecord, Program } from '../data/schema';
import type { AppetiteProfile } from '../domain/profile';
import { nativeCapabilities, nativeRequest } from './native';

export interface AppetiteExport { exportVersion: 1; exportedAt: number; program: Program; profile: AppetiteProfile; episodes: Array<Omit<EatingEpisode, 'photoId'> & { hasLocalPhoto: boolean }>; experiments: ExperimentRecord[]; }

export function buildExport(program: Program, profile: AppetiteProfile, episodes: EatingEpisode[], experiments: ExperimentRecord[], exportedAt: number): AppetiteExport {
  return { exportVersion: 1, exportedAt, program, profile, episodes: episodes.map(({ photoId, ...episode }) => ({ ...episode, hasLocalPhoto: Boolean(photoId) })), experiments };
}
export function exportJson(data: AppetiteExport): string { return `${JSON.stringify(data, null, 2)}\n`; }
function escapeHtml(value: unknown): string { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string); }
export function exportHtml(data: AppetiteExport): string {
  const supported = data.profile.sections.filter((section) => section.supported);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>My Appetite Profile</title><body><main><h1>My Appetite Profile</h1><p>Based on ${data.profile.pairedCount} paired check-ins.</p>${supported.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.summary)}</p><p>Evidence: ${section.evidenceCount}</p></section>`).join('')}<h2>Practices to continue</h2><ul>${data.profile.practices.map((practice) => `<li>${escapeHtml(practice)}</li>`).join('')}</ul><p>This private export contains observations, not medical advice or proof of cause.</p></main></body></html>`;
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
