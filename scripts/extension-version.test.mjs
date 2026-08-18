import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  assertExtensionVersionAligned,
  syncExtensionVersion,
  validateChromeVersion,
} from './extension-version.mjs'

test('desktop versions used by Chrome stay numeric and in range', () => {
  assert.equal(validateChromeVersion('2.5.3'), '2.5.3')
  assert.equal(assertExtensionVersionAligned('2.5.3', '2.5.3'), '2.5.3')
  assert.throws(() => validateChromeVersion('2.5.3-beta.1'), /cannot be used/)
  assert.throws(() => validateChromeVersion('2.5'), /cannot be used/)
  assert.throws(() => validateChromeVersion('2.5.65536'), /cannot be used/)
  assert.throws(() => validateChromeVersion('2.05.3'), /cannot be used/)
})

test('extension version is synchronized from the desktop package version', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'openflow-extension-version-'))
  const packagePath = resolve(root, 'package.json')
  const manifestPath = resolve(root, 'manifest.json')
  try {
    await writeFile(packagePath, JSON.stringify({ version: '2.5.3' }))
    await writeFile(manifestPath, JSON.stringify({ manifest_version: 3, version: '1.2.1' }))

    assert.deepEqual(
      await syncExtensionVersion({ packagePath, manifestPath }),
      { changed: true, version: '2.5.3' },
    )
    assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).version, '2.5.3')
    assert.deepEqual(
      await syncExtensionVersion({ packagePath, manifestPath, checkOnly: true }),
      { changed: false, version: '2.5.3' },
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('check-only mode rejects a mismatch without changing the manifest', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'openflow-extension-version-check-'))
  const packagePath = resolve(root, 'package.json')
  const manifestPath = resolve(root, 'manifest.json')
  try {
    await writeFile(packagePath, JSON.stringify({ version: '2.5.4' }))
    await writeFile(manifestPath, JSON.stringify({ manifest_version: 3, version: '2.5.3' }))

    await assert.rejects(
      syncExtensionVersion({ packagePath, manifestPath, checkOnly: true }),
      /does not match desktop version/,
    )
    assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).version, '2.5.3')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
