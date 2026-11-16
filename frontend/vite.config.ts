import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages no sabe que es una SPA: una ruta como /finca/mapa no existe como archivo y se servía con el
 * 404.html (la página cargaba, pero con estado HTTP 404: mal para buscadores, vistas previas de enlaces y monitoreo).
 * Se copia index.html como <ruta>.html para cada ruta fija; GitHub Pages sirve /finca/mapa desde finca/mapa.html
 * con estado 200. Las rutas con parámetros (/finca/cultivos/:id) siguen cayendo en 404.html.
 * Mantener esta lista al día con las rutas de App.tsx.
 */
const RUTAS = ['finca', 'finca/mapa', 'finca/cultivos', 'finca/historial', 'finca/perfil', 'explorar', 'estilo']

function rutasEstaticas(): Plugin {
  let outDir = 'dist'
  return {
    name: 'groundy-rutas-estaticas',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      const copiar = (destino: string) => {
        mkdirSync(dirname(destino), { recursive: true })
        copyFileSync(index, destino)
      }
      for (const r of RUTAS) copiar(resolve(outDir, `${r}.html`))
      copiar(resolve(outDir, 'finca/index.html')) // por si Pages prefiere la carpeta finca/ sobre finca.html
      copiar(resolve(outDir, '404.html'))
    },
  }
}

// Groundy se publica en GitHub Pages con dominio propio (groundy.site), por eso base = '/'.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    rutasEstaticas(),
    VitePWA({
      registerType: 'autoUpdate',
      // El service worker se activa en el paso F10 (modo sin conexión); por ahora solo el manifiesto.
      injectRegister: false,
      selfDestroying: true,
      manifest: {
        name: 'Groundy',
        short_name: 'Groundy',
        description: 'Your farm seen from space, with the evidence behind every number. By Potatonauts.',
        lang: 'en',
        theme_color: '#0E3B23',
        background_color: '#FFF9F5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
