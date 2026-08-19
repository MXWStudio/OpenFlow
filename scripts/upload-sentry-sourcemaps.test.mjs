import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import fs from 'fs-extra'
import {
  removeSourceMaps,
  resolveSentryCliInvocation,
  resolveSentryUploadConfiguration,
} from './upload-sentry-sourcemaps.mjs'

test('source map upload is disabled for local builds without a DSN', () => {
  assert.equal(resolveSentryUploadConfiguration({}).enabled, false)
})

test('a Sentry-enabled build requires server-side upload credentials', () => {
  assert.throws(
    () => resolveSentryUploadConfiguration({ OPENFLOW_SENTRY_DSN: 'https://public@example.ingest.sentry.io/123' }),
    /SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT/,
  )
})

test('Windows runs the Sentry CLI through Node instead of spawning a cmd shim', () => {
  const invocation = resolveSentryCliInvocation('win32', 'C:\\runtime\\node.exe')
  assert.equal(invocation.executable, 'C:\\runtime\\node.exe')
  assert.match(invocation.prefixArgs[0], /node_modules[\\/]@sentry[\\/]cli[\\/]bin[\\/]sentry-cli$/)
})

test('source maps are removed while application JavaScript remains', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openflow-sourcemaps-'))
  try {
    await mkdir(join(root, 'renderer'), { recursive: true })
    await writeFile(join(root, 'renderer', 'index.js'), 'console.log("ok")')
    await writeFile(join(root, 'renderer', 'index.js.map'), '{}')
    assert.equal(await removeSourceMaps(root), 1)
    assert.equal(await fs.pathExists(join(root, 'renderer', 'index.js')), true)
    assert.equal(await fs.pathExists(join(root, 'renderer', 'index.js.map')), false)
  } finally {
    await fs.remove(root)
  }
})
