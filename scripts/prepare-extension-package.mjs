import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncExtensionVersion } from './extension-version.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(root, 'extensions/chrome')
const outputRoot = resolve(root, '.openflow-build/chrome-extension')

await syncExtensionVersion()

async function listFiles(current = sourceRoot) {
  const entries = await readdir(current, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = resolve(current, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(fullPath))
    else if (entry.isFile()) files.push(relative(sourceRoot, fullPath).replace(/\\/g, '/'))
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'))
}

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })
await cp(sourceRoot, outputRoot, { recursive: true })

const chromeManifest = JSON.parse(await readFile(resolve(sourceRoot, 'manifest.json'), 'utf8'))
const sourceFiles = (await listFiles()).filter((path) => path !== 'extension-release.json' && path !== 'openflow-bridge.json')
const files = []
for (const path of sourceFiles) {
  const sourcePath = resolve(sourceRoot, path)
  const bytes = await readFile(sourcePath)
  const fileStat = await stat(sourcePath)
  files.push({
    path,
    size: fileStat.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
}

const releaseManifest = {
  schemaVersion: 1,
  extensionVersion: chromeManifest.version,
  files,
}
await writeFile(
  resolve(outputRoot, 'extension-release.json'),
  `${JSON.stringify(releaseManifest, null, 2)}\n`,
  'utf8',
)
console.log(`Prepared Chrome extension ${chromeManifest.version} with ${files.length} verified files.`)
