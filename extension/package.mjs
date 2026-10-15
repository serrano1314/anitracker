import { spawnSync } from 'node:child_process'

const apiBase = 'https://anitracker-zvt8.onrender.com'

const build = spawnSync(process.execPath, ['build.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, EXTENSION_API_BASE: apiBase },
})
if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

const zip = spawnSync('python', ['package_zip.py'], { stdio: 'inherit' })
process.exit(zip.status ?? 1)
