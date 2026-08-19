import assert from 'node:assert/strict'
import test from 'node:test'
import { LocalUpdateBridge } from './localUpdateBridge.ts'

test('local extension bridge requires its random token and extension origin', async () => {
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop'
  const captured: unknown[] = []
  const bridge = new LocalUpdateBridge({
    extensionId,
    getStatus: async (currentVersion) => ({
      pending: true,
      targetVersion: '1.2.0',
      desktopVersion: '2.6.0',
      action: currentVersion === '1.2.0' ? 'acknowledge' : 'reload',
    }),
    acknowledge: async () => ({ reload: false }),
    captureDiagnostics: async (events, extensionVersion) => {
      captured.push({ events, extensionVersion })
      return { accepted: events.length }
    },
  })
  const connection = await bridge.start()
  const url = `http://127.0.0.1:${connection.port}/v1/status`
  try {
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await fetch(url, {
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Origin: 'https://example.com',
      },
    })).status, 403)
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Origin: `chrome-extension://${extensionId}`,
        'X-OpenFlow-Extension-Version': '1.1.0',
      },
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).action, 'reload')

    const diagnostics = await fetch(`http://127.0.0.1:${connection.port}/v1/diagnostics`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Origin: `chrome-extension://${extensionId}`,
        'Content-Type': 'application/json',
        'X-OpenFlow-Extension-Version': '1.1.0',
      },
      body: JSON.stringify({
        events: [{
          type: 'extension.extraction_summary',
          severity: 'warning',
          occurredAt: '2026-08-18T09:00:00.000Z',
          payload: { matchedCount: 3, successCount: 2 },
        }],
      }),
    })
    assert.equal(diagnostics.status, 200)
    assert.deepEqual(await diagnostics.json(), { accepted: 1 })
    assert.deepEqual(captured, [{
      extensionVersion: '1.1.0',
      events: [{
        type: 'extension.extraction_summary',
        severity: 'warning',
        occurredAt: '2026-08-18T09:00:00.000Z',
        payload: { matchedCount: 3, successCount: 2 },
      }],
    }])
  } finally {
    await bridge.stop()
  }
})
