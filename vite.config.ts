import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    'import.meta.env.VITE_GIT_HASH': JSON.stringify(
      process.env.VITE_GIT_HASH?.slice(0, 8) ?? 'development'
    )
  }
});
