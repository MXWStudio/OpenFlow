import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  expectedReleaseArtifactNames,
  expectedReleaseTag,
  validateReleaseArtifacts,
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

test('workflows keep builds reproducible and releases single-owner', () => {
  const releaseWorkflow = readFileSync(resolve('.github/workflows/release.yml'), 'utf8')
  const mainWorkflow = readFileSync(resolve('.github/workflows/main.yml'), 'utf8')
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))

  assert.match(releaseWorkflow, /node scripts\/release-contract\.mjs --tag/)
  assert.match(releaseWorkflow, /node scripts\/release-contract\.mjs --tag .* --artifacts build-dist/)
  assert.match(releaseWorkflow, /npm ci/)
  assert.match(releaseWorkflow, /npm run build/)
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
})
