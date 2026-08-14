import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  expectedExtensionArtifactNames,
  expectedReleaseArtifactNames,
  expectedReleaseTag,
  validateReleaseArtifacts,
  validateExtensionReleaseArtifacts,
  validatePackageLockVersion,
  validateReleaseTag
} from './release-contract.mjs'

test('release tags must exactly match the package version', () => {
  assert.equal(expectedReleaseTag('2.5.0'), 'v2.5.0')
  assert.equal(validateReleaseTag('2.5.0', 'v2.5.0'), 'v2.5.0')
  assert.throws(() => validateReleaseTag('2.5.0', 'v2.5'), /expected v2\.5\.0/)
  assert.throws(() => expectedReleaseTag('2.5'), /Invalid package version/)
})

test('package and lockfile versions must stay synchronized', () => {
  assert.doesNotThrow(() =>
    validatePackageLockVersion('2.5.0', { version: '2.5.0', packages: { '': { version: '2.5.0' } } })
  )
  assert.throws(
    () => validatePackageLockVersion('2.5.0', { version: '2.5', packages: { '': { version: '2.5.0' } } }),
    /version mismatch/
  )
})

test('release artifacts must agree with latest.yml', () => {
  const directory = mkdtempSync(join(tmpdir(), 'openflow-release-contract-'))
  const version = '2.5.0'
  const names = expectedReleaseArtifactNames(version)
  const installer = Buffer.from('verified installer content')
  const sha512 = createHash('sha512').update(installer).digest('base64')

  try {
    writeFileSync(join(directory, names.installer), installer)
    writeFileSync(join(directory, names.blockmap), 'blockmap')
    writeFileSync(
      join(directory, names.updateManifest),
      `version: ${version}\nfiles:\n  - url: ${names.installer}\n    sha512: ${sha512}\n    size: ${installer.length}\npath: ${names.installer}\nsha512: ${sha512}\n`
    )

    const result = validateReleaseArtifacts({ artifactDirectory: directory, version })
    assert.deepEqual(result.names, names)

    writeFileSync(
      join(directory, names.updateManifest),
      readFileSync(join(directory, names.updateManifest), 'utf8').replace(`version: ${version}`, 'version: 2.4.0')
    )
    assert.throws(
      () => validateReleaseArtifacts({ artifactDirectory: directory, version }),
      /does not match package version/
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('extension release artifacts include a versioned archive and integrity manifest', () => {
  const directory = mkdtempSync(join(tmpdir(), 'openflow-extension-release-contract-'))
  try {
    const names = expectedExtensionArtifactNames('1.2.0')
    writeFileSync(join(directory, names.archive), 'extension zip')
    writeFileSync(join(directory, names.manifest), JSON.stringify({
      schemaVersion: 1,
      extensionVersion: '1.2.0',
      files: [{ path: 'manifest.json', size: 1, sha256: 'a'.repeat(64) }]
    }))
    assert.deepEqual(validateExtensionReleaseArtifacts({ artifactDirectory: directory }).names, names)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('workflows keep builds reproducible and releases single-owner', () => {
  const releaseWorkflow = readFileSync(resolve('.github/workflows/release.yml'), 'utf8')
  const repairWorkflow = readFileSync(resolve('.github/workflows/repair-cos-channel.yml'), 'utf8')
  const verifyCosWorkflow = readFileSync(resolve('.github/workflows/verify-cos-configuration.yml'), 'utf8')
  const mainWorkflow = readFileSync(resolve('.github/workflows/main.yml'), 'utf8')
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))

  assert.match(releaseWorkflow, /node scripts\/release-contract\.mjs --tag/)
  assert.match(releaseWorkflow, /node scripts\/release-contract\.mjs --tag .* --artifacts build-dist/)
  assert.match(releaseWorkflow, /npm ci/)
  assert.match(releaseWorkflow, /npm run build/)
  assert.match(releaseWorkflow, /prepare-update-config\.mjs --require/)
  assert.match(releaseWorkflow, /sync-release-to-cos\.mjs --stage build-dist/)
  assert.match(releaseWorkflow, /sync-release-to-cos\.mjs --promote build-dist\/release\.json/)
  assert.match(releaseWorkflow, /OPENFLOW_RELEASE_PRIVATE_KEY/)
  assert.match(releaseWorkflow, /OPENFLOW_COS_FULL_READBACK/)
  assert.match(releaseWorkflow, /OPENFLOW_COS_OPERATION_ATTEMPTS/)
  assert.match(releaseWorkflow, /OpenFlow-Chrome-Extension-/)
  assert.match(releaseWorkflow, /extension-release\.json/)
  assert.match(releaseWorkflow, /release\.json/)
  assert.ok(
    releaseWorkflow.indexOf('sync-release-to-cos.mjs --stage build-dist') < releaseWorkflow.indexOf('gh release create'),
    'COS versioned files must be staged before the GitHub release is created'
  )
  assert.ok(
    releaseWorkflow.indexOf('sync-release-to-cos.mjs --promote build-dist/release.json') > releaseWorkflow.indexOf('--draft=false'),
    'COS stable pointer must be promoted only after GitHub publication'
  )
  assert.match(packageJson.scripts.build, /--publish never/)
  assert.match(releaseWorkflow, /gh release create/)
  assert.match(releaseWorkflow, /gh release upload/)
  assert.match(releaseWorkflow, /--draft/)
  assert.match(releaseWorkflow, /gh release edit/)
  assert.match(releaseWorkflow, /--draft=false/)
  assert.match(releaseWorkflow, /\.state -ne "uploaded" -or \$_\.size -le 0/)
  assert.match(releaseWorkflow, /RELEASE_CREATED=true/)
  assert.match(releaseWorkflow, /failure\(\).*RELEASE_CREATED/)
  assert.match(releaseWorkflow, /gh release delete/)
  assert.doesNotMatch(releaseWorkflow, /--cleanup-tag/)
  assert.match(releaseWorkflow, /concurrency:/)
  assert.doesNotMatch(releaseWorkflow, /npm install|rm -Force package-lock\.json|-p always/)

  assert.match(mainWorkflow, /npm ci/)
  assert.doesNotMatch(mainWorkflow, /npm install|rm -Force package-lock\.json/)

  assert.match(repairWorkflow, /workflow_dispatch:/)
  assert.match(repairWorkflow, /gh release download/)
  assert.match(repairWorkflow, /--pattern release\.json/)
  assert.match(repairWorkflow, /sync-release-to-cos\.mjs --promote repair-artifacts\/release\.json/)
  assert.match(repairWorkflow, /OPENFLOW_COS_FULL_READBACK/)
  assert.doesNotMatch(repairWorkflow, /gh release edit|--draft=false/)

  assert.match(verifyCosWorkflow, /workflow_dispatch:/)
  assert.match(verifyCosWorkflow, /sync-release-to-cos\.mjs --verify-configuration/)
  assert.match(verifyCosWorkflow, /TENCENT_COS_SECRET_ID/)
  assert.match(verifyCosWorkflow, /TENCENT_COS_SECRET_KEY/)
  assert.match(verifyCosWorkflow, /OPENFLOW_COS_FULL_READBACK: 'true'/)
  assert.doesNotMatch(verifyCosWorkflow, /gh release|--stage|--promote/)
})
