import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, verify } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { prepareLocalUpdateFeed } from './prepare-local-update-feed.mjs'

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'openflow-local-feed-test-'))
  const artifacts = resolve(root, 'artifacts')
  const output = resolve(root, 'feed')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(artifacts, { recursive: true }))

  const installerName = 'openflow-studio-Setup-2.5.3.exe'
  const installer = Buffer.from('local installer fixture')
  const installerSha512 = createHash('sha512').update(installer).digest('base64')
  await writeFile(resolve(artifacts, installerName), installer)
  await writeFile(resolve(artifacts, `${installerName}.blockmap`), 'block map')
  await writeFile(resolve(artifacts, 'latest.yml'), [
    'version: 2.5.3',
    'files:',
    `  - url: ${installerName}`,
    `    sha512: ${installerSha512}`,
    `    size: ${installer.length}`,
    `path: ${installerName}`,
    `sha512: ${installerSha512}`,
    '',
  ].join('\n'))
  await writeFile(resolve(artifacts, 'OpenFlow-Chrome-Extension-2.5.3.zip'), 'extension archive')
  await writeFile(resolve(artifacts, 'extension-release.json'), JSON.stringify({
    schemaVersion: 1,
    extensionVersion: '2.5.3',
    files: [{ path: 'manifest.json', size: 1, sha256: 'a'.repeat(64) }],
  }))
  const packagePath = resolve(root, 'package.json')
  await writeFile(packagePath, JSON.stringify({
    name: 'openflow-studio',
    productName: 'openflow-studio',
    version: '2.5.3',
  }))

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privateKeyPath = resolve(root, 'private.pem')
  const publicKeyPath = resolve(root, 'public.txt')
  await writeFile(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }))
  await writeFile(publicKeyPath, publicKey.export({ format: 'der', type: 'spki' }).toString('base64'))
  return { root, artifacts, output, packagePath, privateKeyPath, publicKeyPath, publicKey }
}

test('local feed copies verified artifacts and signs a loopback-only release', async () => {
  const fixture = await createFixture()
  try {
    const result = await prepareLocalUpdateFeed({
      artifactDirectory: fixture.artifacts,
      outputDirectory: fixture.output,
      packagePath: fixture.packagePath,
      privateKeyPath: fixture.privateKeyPath,
      publicKeyPath: fixture.publicKeyPath,
      baseUrl: 'http://127.0.0.1:18765',
      updateType: 'critical',
    })
    assert.equal(result.channelUrl, 'http://127.0.0.1:18765/stable/release.json')
    assert.equal(result.feedUrl, 'http://127.0.0.1:18765/releases/v2.5.3/')

    const stableSource = await readFile(resolve(fixture.output, 'stable/release.json'), 'utf8')
    const versionedSource = await readFile(
      resolve(fixture.output, 'releases/v2.5.3/release.json'),
      'utf8',
    )
    assert.equal(stableSource, versionedSource)
    const envelope = JSON.parse(stableSource)
    const payloadBytes = Buffer.from(envelope.payload, 'base64')
    assert.equal(
      verify('RSA-SHA256', payloadBytes, fixture.publicKey, Buffer.from(envelope.signature, 'base64')),
      true,
    )
    const payload = JSON.parse(payloadBytes.toString('utf8'))
    assert.equal(payload.updateType, 'critical')
    assert.equal(payload.extension.version, '2.5.3')
    assert.equal(
      (await stat(resolve(fixture.output, 'releases/v2.5.3/openflow-studio-Setup-2.5.3.exe'))).size,
      Buffer.byteLength('local installer fixture'),
    )
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('local feed refuses a non-loopback address', async () => {
  const fixture = await createFixture()
  try {
    await assert.rejects(
      prepareLocalUpdateFeed({
        artifactDirectory: fixture.artifacts,
        outputDirectory: fixture.output,
        packagePath: fixture.packagePath,
        privateKeyPath: fixture.privateKeyPath,
        publicKeyPath: fixture.publicKeyPath,
        baseUrl: 'https://example.com',
      }),
      /HTTP loopback/,
    )
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})
