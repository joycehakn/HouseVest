import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'))
if (!hosting.project_id) throw new Error('.openai/hosting.json is missing project_id')

await mkdir('dist/server', { recursive: true })
await mkdir('dist/.openai', { recursive: true })
await copyFile('server/sites-worker.mjs', 'dist/server/index.js')
await writeFile('dist/.openai/hosting.json', JSON.stringify(hosting, null, 2))

