import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHANNEL_IDENTITIES,
  normalizeBuildIdentity,
  normalizeDevSyncMarker,
  STABLE_BUILD_IDENTITY,
} from './buildIdentity.ts'

const commit = 'a'.repeat(40)
const snapshot = 'b'.repeat(64)

test('missing build metadata remains Stable and never displays a Dev marker', () => {
  const identity = normalizeBuildIdentity(undefined)
  assert.deepEqual(identity, STABLE_BUILD_IDENTITY)
  assert.equal(normalizeDevSyncMarker({ label: 'DEV · 08-31 11:05:58' }, identity), null)
})

test('Dev and Candidate identities are isolated from Stable', () => {
  assert.notEqual(CHANNEL_IDENTITIES.dev.appId, CHANNEL_IDENTITIES.stable.appId)
  assert.notEqual(CHANNEL_IDENTITIES.candidate.appId, CHANNEL_IDENTITIES.stable.appId)
  assert.notEqual(CHANNEL_IDENTITIES.dev.userDataDirectory, CHANNEL_IDENTITIES.candidate.userDataDirectory)
  assert.notEqual(CHANNEL_IDENTITIES.dev.appName, CHANNEL_IDENTITIES.candidate.appName)
  assert.equal(CHANNEL_IDENTITIES.dev.updateChannel, 'dev-disabled')
  assert.equal(CHANNEL_IDENTITIES.candidate.updateChannel, 'candidate-disabled')
})

test('Dev marker must match the verified source identity', () => {
  const identity = normalizeBuildIdentity({
    schemaVersion: 1,
    ...CHANNEL_IDENTITIES.dev,
    sourceCommit: commit,
    sourceSnapshotSha256: snapshot,
    sourceDirty: true,
    builtAt: '2026-08-31T03:00:00.000Z',
  })
  const marker = normalizeDevSyncMarker({
    schemaVersion: 1,
    label: 'DEV · 08-31 11:05:58',
    synchronizedAt: '2026-08-31T03:05:58.000Z',
    sourceCommit: commit,
    sourceSnapshotSha256: snapshot,
  }, identity)
  assert.equal(marker?.label, 'DEV · 08-31 11:05:58')
  assert.equal(normalizeDevSyncMarker({ ...marker, sourceSnapshotSha256: 'c'.repeat(64) }, identity), null)
})

test('identity drift fails closed', () => {
  assert.throws(() => normalizeBuildIdentity({
    schemaVersion: 1,
    ...CHANNEL_IDENTITIES.dev,
    appId: 'com.openflow.studio',
    sourceCommit: commit,
    sourceSnapshotSha256: snapshot,
    builtAt: '2026-08-31T03:00:00.000Z',
  }), /identity mismatch/)
})
