import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // raiz do projeto (onde está index.html)
  root: '.',
  publicDir: 'public',
  base: './', // permite servir o build em qualquer subcaminho (Steam Web, file://, GitHub Pages)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      // multi-página: o jogo e a ferramenta PDF → EPUB são entradas separadas
      input: {
        main: resolve(__dirname, 'index.html'),
        pdf2epub: resolve(__dirname, 'pdf2epub.html'),
      },
      output: {
        // mantém o bundle único pra prototipagem ficar simples de depurar
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    open: false,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  test: {
    environment: 'happy-dom', // DOM virtual leve pros testes de UI/save
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['dist/**', 'node_modules/**'],
    },
  },
});
