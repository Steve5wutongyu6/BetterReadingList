import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, 'sidebar.html')
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});
