import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'actual-monzo',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'commander',
        'inquirer',
        'conf',
        'chalk',
        'ora',
        'date-fns',
        'fs',
        'fs/promises',
        'path',
        'child_process',
        'util',
        'os',
        'url',
        'crypto',
        'http',
        'https',
        'zlib',
        'stream',
        'buffer',
        'axios',
        'zod',
        'js-yaml',
        'open',
        '@actual-app/api',
        /^node:/
      ],
      output: {
        banner: '#!/usr/bin/env node'
      }
    },
    target: 'node18',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false
  },
  ssr: {
    target: 'node'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/config': resolve(__dirname, 'src/config')
    }
  },
  define: {
    __dirname: 'import.meta.dirname'
  }
});