import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import fs from 'fs-extra'
import {
  finalizeExtensionInstall,
  installExtensionTransaction,
  rollbackExtensionInstall,
  validateExtensionPackage,
} from './extensionInstaller.ts'

async function createPackage(root: string, version: string, popupText: string): Promise<void> {
  await fs.ensureDir(root)
  const files = new Map([
    ['manifest.json', JSON.stringify({ manifest_version: 3, name: 'OpenFlow', version })],
    ['popup.js', popupText],
  ])
  for (const [relativePath, content] of files) await fs.outputFile(join(root, relativePath), content)
  await fs.writeJson(join(root, 'extension-release.json'), {
    schemaVersion: 1,
    extensionVersion: version,
    files: [...files].map(([path, content]) => ({
      path,
      size: Buffer.byteLength(content),
      sha256: createHash('sha256').update(content).digest('hex'),
    })),
  })
}

test('extension packages reject changed files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'openflow-extension-verify-'))
  try {
    await createPackage(root, '1.2.0', 'console.log("ok")')
    assert.equal((await validateExtensionPackage(root)).extensionVersion, '1.2.0')
    await fs.writeFile(join(root, 'popup.js'), 'changed')
    await assert.rejects(() => validateExtensionPackage(root), /mismatch/)
  } finally {
    await fs.remove(root)
  }
})

test('extension installation keeps a verified rollback copy until acknowledgement', async () => {
  const root = mkdtempSync(join(tmpdir(), 'openflow-extension-install-'))
  const source = join(root, 'source')
  const target = join(root, 'installed')
  try {
    await createPackage(target, '1.1.0', 'old')
    await createPackage(source, '1.2.0', 'new')
    const result = await installExtensionTransaction(source, target)
    assert.equal(result.changed, true)
    assert.equal((await validateExtensionPackage(target)).extensionVersion, '1.2.0')
    assert.equal((await validateExtensionPackage(result.backupRoot!)).extensionVersion, '1.1.0')

    assert.equal(await rollbackExtensionInstall(target, result.backupRoot), true)
    assert.equal((await validateExtensionPackage(target)).extensionVersion, '1.1.0')
  } finally {
    await fs.remove(root)
  }
})

test('acknowledged extension installs remove the rollback copy', async () => {
  const root = mkdtempSync(join(tmpdir(), 'openflow-extension-finalize-'))
  const source = join(root, 'source')
  const target = join(root, 'installed')
  try {
    await createPackage(target, '1.1.0', 'old')
    await createPackage(source, '1.2.0', 'new')
    const result = await installExtensionTransaction(source, target)
    await finalizeExtensionInstall(result.backupRoot)
    assert.equal(await fs.pathExists(result.backupRoot!), false)
    assert.equal((await validateExtensionPackage(target)).extensionVersion, '1.2.0')
  } finally {
    await fs.remove(root)
  }
})
