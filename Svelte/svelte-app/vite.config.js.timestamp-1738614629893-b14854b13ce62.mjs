// vite.config.js
import { defineConfig } from "file:///C:/Users/paige/OneDrive/CS%20425/Trackmysci/Svelte/svelte-app/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///C:/Users/paige/OneDrive/CS%20425/Trackmysci/Svelte/svelte-app/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import path from "path";
var vite_config_default = defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib")
    }
  },
  build: {
    outDir: "../../dist"
    // Replace with your desired output folder name
    // assetsDir: 'assets',         // Folder for storing built JS/CSS assets
    // rollupOptions: {
    //   output: {
    //     assetFileNames: 'assets/[name].[hash][extname]', // For hashed asset names
    //     chunkFileNames: 'assets/[name].[hash].js',
    //     entryFileNames: 'assets/[name].[hash].js',
    //   },
    // },
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxwYWlnZVxcXFxPbmVEcml2ZVxcXFxDUyA0MjVcXFxcVHJhY2tteXNjaVxcXFxTdmVsdGVcXFxcc3ZlbHRlLWFwcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxccGFpZ2VcXFxcT25lRHJpdmVcXFxcQ1MgNDI1XFxcXFRyYWNrbXlzY2lcXFxcU3ZlbHRlXFxcXHN2ZWx0ZS1hcHBcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3BhaWdlL09uZURyaXZlL0NTJTIwNDI1L1RyYWNrbXlzY2kvU3ZlbHRlL3N2ZWx0ZS1hcHAvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgc3ZlbHRlIH0gZnJvbSAnQHN2ZWx0ZWpzL3ZpdGUtcGx1Z2luLXN2ZWx0ZSc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbc3ZlbHRlKCldLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICRsaWI6IHBhdGgucmVzb2x2ZSgnLi9zcmMvbGliJyksIFxyXG4gICAgfSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6ICcuLi8uLi9kaXN0JywgLy8gUmVwbGFjZSB3aXRoIHlvdXIgZGVzaXJlZCBvdXRwdXQgZm9sZGVyIG5hbWVcclxuICAgIC8vIGFzc2V0c0RpcjogJ2Fzc2V0cycsICAgICAgICAgLy8gRm9sZGVyIGZvciBzdG9yaW5nIGJ1aWx0IEpTL0NTUyBhc3NldHNcclxuICAgIC8vIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgIC8vICAgb3V0cHV0OiB7XHJcbiAgICAvLyAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXVtleHRuYW1lXScsIC8vIEZvciBoYXNoZWQgYXNzZXQgbmFtZXNcclxuICAgIC8vICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0uW2hhc2hdLmpzJyxcclxuICAgIC8vICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0uW2hhc2hdLmpzJyxcclxuICAgIC8vICAgfSxcclxuICAgIC8vIH0sXHJcbiAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVgsU0FBUyxvQkFBb0I7QUFDbFosU0FBUyxjQUFjO0FBQ3ZCLE9BQU8sVUFBVTtBQUVqQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsT0FBTyxDQUFDO0FBQUEsRUFDbEIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsTUFBTSxLQUFLLFFBQVEsV0FBVztBQUFBLElBQ2hDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBU1Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
