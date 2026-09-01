import assert from 'node:assert/strict'
import test from 'node:test'
import { channelIdentities, createBuildMetadata } from './prepare-build-metadata.mjs'

test('channel package identities are mutually isolated', () => {
  const values = Object.values(channelIdentities)
  assert.equal(new Set(values.map((value) => value.appId)).size, 3)
  assert.equal(new Set(values.map((value) => value.appName)).size, 3)
  assert.equal(new Set(values.map((value) => value.userDataDirectory)).size, 3)
  assert.equal(channelIdentities.dev.updateChannel, 'dev-disabled')
  assert.equal(channelIdentities.candidate.updateChannel, 'candidate-disabled')
})

test('build metadata binds commit, snapshot and build time', () => {
  const value = createBuildMetadata({
    channel: 'candidate',
    sourceCommit: 'a'.repeat(40),
    sourceSnapshotSha256: 'B'.repeat(64),
    sourceDirty: true,
    builtAt: '2026-08-31T03:00:00+08:00',
  })
  assert.equal(value.appId, 'com.openflow.studio.candidate')
  assert.equal(value.sourceSnapshotSha256, 'b'.repeat(64))
  assert.equal(value.sourceDirty, true)
  assert.equal(value.builtAt, '2026-08-30T19:00:00.000Z')
})
