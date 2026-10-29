import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    watch: { ignored: ['**/screenshots/**', '**/.npm-cache/**', '**/*.log'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js'] },
      },
    },
  },
});
