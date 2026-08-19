import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import fs from 'fs-extra'
import { DiagnosticsManager, sanitizeDiagnosticValue } from './diagnosticsManager.ts'

async function createRoot(configuration: unknown) {
  const root = mkdtempSync(join(tmpdir(), 'openflow-diagnostics-'))
  const configurationPath = join(root, 'update-config.json')
  await fs.writeJson(configurationPath, configuration)
  return { root, configurationPath }
}

function createManager(root: string, configurationPath: string, overrides = {}) {
  return new DiagnosticsManager({
    rootPath: join(root, 'diagnostics'),
    configurationPath,
    desktopVersion: '2.5.3',
    platform: 'win32',
    architecture: 'x64',
    locale: 'zh-CN',
    autoSchedule: false,
    ...overrides,
  })
}

test('diagnostics stay on disk without a receiver and survive a restart', async () => {
  const fixture = await createRoot({
    schemaVersion: 1,
    diagnostics: { sentryDsn: '', uploadIntervalMinutes: 30 },
  })
  try {
    const manager = createManager(fixture.root, fixture.configurationPath)
    await manager.start()
    await manager.record('renderer', {
      type: 'renderer.unhandled_error',
      payload: {
        sourceUrl: 'https://example.com/private/task?id=123',
        token: 'must-not-leave-the-device',
        message: 'Contact alice@example.com at C:\\Users\\Alice\\OpenFlow\\secret.txt or https://example.com/task?id=private',
      },
    })
    assert.equal(manager.getState().status, 'local-only')
    assert.equal(manager.getState().pendingCount, 1)

    const exportPath = join(fixture.root, 'export.json')
    await manager.exportSnapshot(exportPath)
    const exported = await fs.readJson(exportPath)
    assert.equal(exported.events[0].payload.sourceUrl, 'https://example.com/[redacted]')
    assert.equal(exported.events[0].payload.token, '[redacted]')
    assert.match(exported.events[0].payload.message, /\[email\]/)
    assert.match(exported.events[0].payload.message, /\[local-path\]/)
    assert.doesNotMatch(exported.events[0].payload.message, /id=private/)

    const restarted = createManager(fixture.root, fixture.configurationPath)
    await restarted.start()
    assert.equal(restarted.getState().pendingCount, 1)
  } finally {
    await fs.remove(fixture.root)
  }
})

test('diagnostics upload in a bounded batch and are deleted only after success', async () => {
  let received: any = null
  const fixture = await createRoot({
    schemaVersion: 1,
    diagnostics: { sentryDsn: 'https://public@example.ingest.sentry.io/123', uploadIntervalMinutes: 15 },
  })
  try {
    const manager = createManager(fixture.root, fixture.configurationPath, {
      getExtensionVersion: () => '2.5.3',
      uploadBatch: async (envelope: unknown) => { received = envelope },
    })
    await manager.start()
    await manager.recordBatch('extension', [
      { type: 'extension.extraction_summary', severity: 'warning', payload: { matchedCount: 3, successCount: 2 } },
      { type: 'extension.extraction_exception', payload: { message: 'detail timeout' } },
    ], '2.5.3')
    assert.equal(manager.getState().pendingCount, 2)
    assert.equal(await manager.flushNow(), true)
    assert.equal(manager.getState().pendingCount, 0)
    assert.equal(manager.getState().status, 'idle')
    assert.equal(received.schemaVersion, 1)
    assert.match(received.installationId, /^[0-9a-f-]{36}$/)
    assert.equal(received.events.length, 2)
    assert.equal(received.events[0].source, 'extension')
    assert.equal(received.events[0].extensionVersion, '2.5.3')
  } finally {
    await fs.remove(fixture.root)
  }
})

test('failed uploads retain the queue for an automatic retry', async () => {
  const fixture = await createRoot({
    schemaVersion: 1,
    diagnostics: { sentryDsn: 'https://public@example.ingest.sentry.io/123', uploadIntervalMinutes: 5 },
  })
  try {
    const manager = createManager(fixture.root, fixture.configurationPath, {
      uploadBatch: async () => { throw new Error('temporarily unavailable') },
    })
    await manager.start()
    await manager.record('desktop', { type: 'desktop.update_error', payload: { message: 'network failure' } })
    assert.equal(await manager.flushNow(), false)
    assert.equal(manager.getState().status, 'error')
    assert.equal(manager.getState().pendingCount, 1)
  } finally {
    await fs.remove(fixture.root)
  }
})

test('diagnostic sanitization bounds circular and sensitive input', () => {
  const value: Record<string, unknown> = { authorization: 'Bearer abc', nested: {} }
  ;(value.nested as Record<string, unknown>).self = value
  assert.deepEqual(sanitizeDiagnosticValue(value), {
    authorization: '[redacted]',
    nested: { self: '[circular]' },
  })
})

test('oversized diagnostic payloads are replaced by a bounded sanitized preview', async () => {
  const fixture = await createRoot({
    schemaVersion: 1,
    diagnostics: { sentryDsn: '', uploadIntervalMinutes: 30 },
  })
  try {
    const manager = createManager(fixture.root, fixture.configurationPath)
    await manager.start()
    const event = await manager.record('desktop', {
      type: 'desktop.oversized',
      payload: Array.from({ length: 50 }, (_, index) => ({
        index,
        message: `${'x'.repeat(900)} https://example.com/private?token=${index}`,
      })),
    })
    assert.equal((event.payload as { truncated?: boolean }).truncated, true)
    assert.ok(Buffer.byteLength(JSON.stringify(event)) < 24 * 1024)
    assert.doesNotMatch(JSON.stringify(event), /token=0/)
  } finally {
    await fs.remove(fixture.root)
  }
})
