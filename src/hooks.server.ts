import type { Handle } from '@sveltejs/kit';

const nativeShell = process.env.VITE_NATIVE_SHELL === 'ios';

export const handle: Handle = async ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) => {
      if (!nativeShell) return html;
      return html
        .replace("connect-src 'self' ws:; worker-src 'self'", "connect-src 'self'; worker-src 'none'")
        .replace(/\s*<link rel="manifest"[^>]*>/, '')
        .replace('<html lang="en">', '<html lang="en" data-native-shell="ios">');
    }
  });
