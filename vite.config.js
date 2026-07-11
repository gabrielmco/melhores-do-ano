import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['import', 'legacy-js-api']
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        portal: resolve(__dirname, 'portal.html'),
        votar: resolve(__dirname, 'votar.html'),
        resultados: resolve(__dirname, 'resultados.html'),
        candidato: resolve(__dirname, 'candidato.html'),
        comercial: resolve(__dirname, 'comercial.html'),
        admin: resolve(__dirname, 'admin.html'),
        termos: resolve(__dirname, 'termos.html'),
        privacidade: resolve(__dirname, 'privacidade.html')
      }
    }
  }
});
