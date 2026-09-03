import type { AppSettings } from '$lib/data/schema';
import { syncNativeAppearance } from '$lib/platform/native';

export type Appearance = AppSettings['appearance'];

export function preferredAppearance(): Appearance {
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyAppearance(appearance: Appearance): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = appearance;
  document.documentElement.style.colorScheme = appearance;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    appearance === 'dark' ? '#071917' : '#f7f2e8'
  );
  void syncNativeAppearance(appearance);
}
