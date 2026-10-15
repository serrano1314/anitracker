import { cpSync, mkdirSync } from 'node:fs'
import * as esbuild from 'esbuild'

const apiBase = process.env.EXTENSION_API_BASE?.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8000'

mkdirSync('dist', { recursive: true })

const shared = {
  bundle: true,
  target: 'chrome120',
  define: {
    EXTENSION_API_BASE: JSON.stringify(apiBase),
  },
}

await esbuild.build({
  ...shared,
  entryPoints: ['src/background.ts'],
  outfile: 'dist/background.js',
  format: 'esm',
})

await esbuild.build({
  ...shared,
  entryPoints: ['src/content.ts'],
  outfile: 'dist/content.js',
  format: 'iife',
})

await esbuild.build({
  ...shared,
  entryPoints: ['src/popup/popup.ts'],
  outfile: 'dist/popup.js',
  format: 'iife',
})

cpSync('src/popup/popup.html', 'dist/popup.html')
cpSync('src/popup/popup.css', 'dist/popup.css')
cpSync('manifest.json', 'dist/manifest.json')
