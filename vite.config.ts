import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), wasm()],
    build: {
      // vectortracer's wasm glue uses top-level await, which needs a modern
      // baseline (Chrome 89+, Firefox 89+, Safari 15+).
      target: 'es2022',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
