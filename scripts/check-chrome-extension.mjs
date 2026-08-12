import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const extensionRoot = resolve(root, 'extensions/chrome')
const manifestPath = resolve(extensionRoot, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

assert.equal(manifest.manifest_version, 3, 'Chrome extension must use Manifest V3')
assert.equal(manifest.action?.default_popup, 'popup.html', 'Popup entry must stay explicit')
assert.equal(manifest.background, undefined, 'Extension must not add a background worker without review')
assert.equal(manifest.host_permissions, undefined, 'Extension must not request persistent host access')

const expectedPermissions = ['activeTab', 'downloads', 'scripting', 'storage']
assert.deepEqual(
  [...(manifest.permissions ?? [])].sort(),
  expectedPermissions,
  'Extension permissions changed; review and update the contract intentionally'
)

const requiredFiles = [
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'xlsx.bundle.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'fixtures/requirements-v1.example.json',
  'THIRD_PARTY_NOTICES.md',
  'licenses/xlsx-js-style-LICENSE.txt',
]

for (const relativePath of requiredFiles) {
  assert.ok(existsSync(resolve(extensionRoot, relativePath)), `Missing extension resource: ${relativePath}`)
}

const popupHtml = readFileSync(resolve(extensionRoot, 'popup.html'), 'utf8')
const localReferences = [...popupHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((value) => !/^(?:https?:|data:|chrome:|#)/i.test(value))

for (const relativePath of localReferences) {
  assert.ok(existsSync(resolve(extensionRoot, relativePath)), `Broken popup resource reference: ${relativePath}`)
}

for (const scriptName of ['popup.js', 'content.js', 'xlsx.bundle.js']) {
  const result = spawnSync(process.execPath, ['--check', resolve(extensionRoot, scriptName)], {
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${scriptName} syntax check failed:\n${result.stderr || result.stdout}`)
}

const popupSource = readFileSync(resolve(extensionRoot, 'popup.js'), 'utf8')
assert.match(popupSource, /schemaVersion:\s*['"]openflow\.requirements\.v1['"]/, 'JSON export schema is missing')
assert.match(popupSource, /projects:\s*formattedDataList/, 'JSON export projects payload is missing')
assert.match(popupSource, /action:\s*["']EXTRACT_BULK_DOM["'],\s*deadline/, 'Deadline filter is not sent to the page extractor')

const contentSource = readFileSync(resolve(extensionRoot, 'content.js'), 'utf8')
assert.match(contentSource, /截止日期\[：:\]/, 'Deadline card matching is missing')
assert.match(contentSource, /matchedCards/, 'Deadline-matched card traversal is missing')
assert.match(contentSource, /loadAllTaskCards/, 'Infinite task list loading is missing')

console.log('Chrome extension checks passed.')
