import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: "dist", // Specify the output directory
    emptyOutDir: true, // Clears the output directory before each build
  },
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'), 
    },
  },
});