import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'), 
    },
  },
  build: {
    outDir: '../../dist', // Replace with your desired output folder name
    // assetsDir: 'assets',         // Folder for storing built JS/CSS assets
    // rollupOptions: {
    //   output: {
    //     assetFileNames: 'assets/[name].[hash][extname]', // For hashed asset names
    //     chunkFileNames: 'assets/[name].[hash].js',
    //     entryFileNames: 'assets/[name].[hash].js',
    //   },
    // },
  },
  server: {
    hmr: false
  },
});
