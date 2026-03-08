import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  root: 'src',
  publicDir: '../public',
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@worker': path.resolve(__dirname, './worker'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          'query-vendor': ['@tanstack/react-query'],
          'utils-vendor': ['clsx', 'tailwind-merge', 'date-fns'],
        },
      },
    },
  },
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
      },
    },
  },
  
  preview: {
    port: 4173,
  },
});
