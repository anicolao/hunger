import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Android's asset packager drops directories whose names begin with an
    // underscore, so its embedded bundle cannot use SvelteKit's `_app` default.
    appDir: process.env.VITE_NATIVE_SHELL === 'android' ? 'app' : '_app',
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      strict: true
    }),
    paths: {
      base: process.env.PUBLIC_BASE_PATH ?? ''
    },
    serviceWorker: {
      register: !['ios', 'android'].includes(process.env.VITE_NATIVE_SHELL ?? '')
    }
  }
};

export default config;
