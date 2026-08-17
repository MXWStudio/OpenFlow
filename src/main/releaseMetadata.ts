import { createPublicKey, verify } from 'node:crypto'
import type { SignedDesktopRelease, SignedReleaseEnvelope } from '../shared/updateContract'

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is missing`)
  }
}

function assertSafeAssetName(value: unknown, label: string): asserts value is string {
  assertString(value, label)
  if (value.includes('/') || value.includes('\\') || value === '.' || value === '..') {
    throw new Error(`${label} must be a file name`)
  }
}

function assertReleasePayload(value: unknown): asserts value is SignedDesktopRelease {
  if (!value || typeof value !== 'object') throw new Error('Signed release payload must be an object')
  const payload = value as Partial<SignedDesktopRelease>
  if (payload.schemaVersion !== 1) throw new Error('Unsupported signed release schema')
  if (!VERSION_PATTERN.test(payload.version ?? '')) throw new Error('Signed release version is invalid')
  assertString(payload.publishedAt, 'publishedAt')
  if (Number.isNaN(Date.parse(payload.publishedAt))) throw new Error('publishedAt is invalid')
  assertString(payload.feedUrl, 'feedUrl')
  const feedUrl = new URL(payload.feedUrl)
  if (feedUrl.protocol !== 'https:' && feedUrl.hostname !== '127.0.0.1' && feedUrl.hostname !== 'localhost') {
    throw new Error('feedUrl must use HTTPS')
  }
  const updateType = payload.updateType ?? 'standard'
  if (updateType !== 'critical' && updateType !== 'standard') {
    throw new Error('updateType is invalid')
  }
  payload.updateType = updateType

  if (!payload.desktop || typeof payload.desktop !== 'object') throw new Error('desktop release data is missing')
  assertSafeAssetName(payload.desktop.installer, 'desktop.installer')
  if (!Number.isSafeInteger(payload.desktop.size) || payload.desktop.size <= 0) {
    throw new Error('desktop.size is invalid')
  }
  assertString(payload.desktop.sha512, 'desktop.sha512')
  if (!BASE64_PATTERN.test(payload.desktop.sha512)) throw new Error('desktop.sha512 is invalid')

  if (!payload.extension || typeof payload.extension !== 'object') throw new Error('extension release data is missing')
  if (!VERSION_PATTERN.test(payload.extension.version ?? '')) throw new Error('extension.version is invalid')
  assertSafeAssetName(payload.extension.archive, 'extension.archive')
  assertSafeAssetName(payload.extension.manifest, 'extension.manifest')
  if (!Number.isSafeInteger(payload.extension.size) || payload.extension.size <= 0) {
    throw new Error('extension.size is invalid')
  }
  for (const [label, hash] of [
    ['extension.sha256', payload.extension.sha256],
    ['extension.manifestSha256', payload.extension.manifestSha256],
  ] as const) {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error(`${label} is invalid`)
  }
}

export function verifySignedReleaseEnvelope(
  envelopeValue: unknown,
  publicKeySpkiBase64: string,
): SignedDesktopRelease {
  if (!envelopeValue || typeof envelopeValue !== 'object') throw new Error('Release envelope must be an object')
  const envelope = envelopeValue as Partial<SignedReleaseEnvelope>
  if (envelope.schemaVersion !== 1 || envelope.algorithm !== 'RSA-SHA256') {
    throw new Error('Unsupported release signature format')
  }
  assertString(envelope.payload, 'release payload')
  assertString(envelope.signature, 'release signature')
  if (!BASE64_PATTERN.test(envelope.payload) || !BASE64_PATTERN.test(envelope.signature)) {
    throw new Error('Release signature data is invalid')
  }
  if (!BASE64_PATTERN.test(publicKeySpkiBase64)) throw new Error('Release public key is invalid')

  const payloadBytes = Buffer.from(envelope.payload, 'base64')
  const publicKey = createPublicKey({
    key: Buffer.from(publicKeySpkiBase64, 'base64'),
    format: 'der',
    type: 'spki',
  })
  const signatureValid = verify(
    'RSA-SHA256',
    payloadBytes,
    publicKey,
    Buffer.from(envelope.signature, 'base64'),
  )
  if (!signatureValid) throw new Error('Release signature verification failed')

  let payload: unknown
  try {
    payload = JSON.parse(payloadBytes.toString('utf8'))
  } catch {
    throw new Error('Signed release payload is not valid JSON')
  }
  assertReleasePayload(payload)
  return payload
}

export function compareReleaseVersions(left: string, right: string): number {
  const parse = (value: string) => {
    if (!VERSION_PATTERN.test(value)) throw new Error(`Invalid version: ${value}`)
    const [core, prerelease = ''] = value.split('-', 2)
    return { numbers: core.split('.').map(Number), prerelease }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1
  }
  if (a.prerelease === b.prerelease) return 0
  if (!a.prerelease) return 1
  if (!b.prerelease) return -1
  return a.prerelease.localeCompare(b.prerelease, 'en', { numeric: true })
}
