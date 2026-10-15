import { cpSync, mkdirSync } from 'node:fs'
import * as esbuild from 'esbuild'

mkdirSync('dist', { recursive: true })

await esbuild.build({
  entryPoints: ['src/background.ts'],
  outfile: 'dist/background.js',
  bundle: true,
  format: 'esm',
  target: 'chrome120',
})

await esbuild.build({
  entryPoints: ['src/content.ts'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
})

await esbuild.build({
  entryPoints: ['src/popup/popup.ts'],
  outfile: 'dist/popup.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
})

cpSync('src/popup/popup.html', 'dist/popup.html')
cpSync('src/popup/popup.css', 'dist/popup.css')
cpSync('manifest.json', 'dist/manifest.json')
