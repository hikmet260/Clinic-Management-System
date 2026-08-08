import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, transformWithOxc, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const SW_SOURCE = resolve(import.meta.dirname, 'src/sw.ts');

async function compileSw(): Promise<string> {
  const source = readFileSync(SW_SOURCE, 'utf-8');
  const result = await transformWithOxc(source, 'sw.ts', {
    lang: 'ts',
    sourceType: 'script',
    target: 'es2022',
  });
  return result.code;
}

function serviceWorker(): Plugin {
  return {
    name: 'clinic-service-worker',
    async configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname !== '/sw.js') {
          next();
          return;
        }
        compileSw()
          .then((code) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(code);
          })
          .catch(next);
      });
    },
    async closeBundle() {
      writeFileSync(resolve(import.meta.dirname, 'dist/sw.js'), await compileSw());
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
