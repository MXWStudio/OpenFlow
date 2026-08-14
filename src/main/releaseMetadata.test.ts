import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import test from 'node:test'
import type { SignedDesktopRelease } from '../shared/updateContract'
import { compareReleaseVersions, verifySignedReleaseEnvelope } from './releaseMetadata.ts'

function createSignedRelease(overrides: Partial<SignedDesktopRelease> = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const payload: SignedDesktopRelease = {
    schemaVersion: 1,
    version: '2.6.0',
    publishedAt: '2026-08-14T00:00:00.000Z',
    feedUrl: 'https://example.cos.ap-shanghai.myqcloud.com/openflow/releases/v2.6.0/',
    desktop: {
      installer: 'openflow-studio-Setup-2.6.0.exe',
      size: 123,
      sha512: Buffer.alloc(64, 1).toString('base64'),
    },
    extension: {
      version: '1.2.0',
      archive: 'OpenFlow-Chrome-Extension-1.2.0.zip',
      size: 456,
      sha256: 'a'.repeat(64),
      manifest: 'extension-release.json',
      manifestSha256: 'b'.repeat(64),
    },
    ...overrides,
  }
  const bytes = Buffer.from(JSON.stringify(payload))
  return {
    envelope: {
      schemaVersion: 1,
      algorithm: 'RSA-SHA256',
      payload: bytes.toString('base64'),
      signature: sign('RSA-SHA256', bytes, privateKey).toString('base64'),
    },
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  }
}

test('signed releases are accepted only with the matching public key', () => {
  const release = createSignedRelease()
  assert.equal(verifySignedReleaseEnvelope(release.envelope, release.publicKey).version, '2.6.0')

  const other = createSignedRelease()
  assert.throws(
    () => verifySignedReleaseEnvelope(release.envelope, other.publicKey),
    /signature verification failed/,
  )
})

test('signed release fields are validated after signature verification', () => {
  const release = createSignedRelease({ feedUrl: 'http://example.com/releases/' })
  assert.throws(
    () => verifySignedReleaseEnvelope(release.envelope, release.publicKey),
    /must use HTTPS/,
  )
})

test('release version comparison handles stable and prerelease versions', () => {
  assert.equal(compareReleaseVersions('2.6.0', '2.5.9'), 1)
  assert.equal(compareReleaseVersions('2.6.0', '2.6.0'), 0)
  assert.equal(compareReleaseVersions('2.6.0-beta.2', '2.6.0'), -1)
  assert.equal(compareReleaseVersions('2.6.0-beta.10', '2.6.0-beta.2'), 1)
})
