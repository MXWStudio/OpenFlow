import assert from 'node:assert/strict'
import test from 'node:test'
import { LocalUpdateBridge } from './localUpdateBridge.ts'

test('local extension bridge requires its random token and extension origin', async () => {
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop'
  const captured: unknown[] = []
  const extractions: unknown[] = []
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
    receiveExtraction: async (envelope, extensionVersion) => {
      extractions.push({ envelope, extensionVersion })
      return {
        protocolVersion: 2,
        messageId: envelope.messageId,
        status: 'accepted',
        receivedAt: '2026-08-19T02:00:00.000Z',
      }
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
    const status = await response.json()
    assert.equal(status.action, 'reload')
    assert.equal(status.protocols.extractions, 2)

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

    const extractionEnvelope = {
      protocolVersion: 2,
      messageId: '778b833c-7e09-4bb4-9f4d-a8b9f3762ec4',
      createdAt: '2026-08-19T01:00:00.000Z',
      payload: {
        schemaVersion: 'openflow.requirements.v1',
        source: { app: 'OpenFlow', url: 'https://example.test/tasks' },
        extractedAt: '2026-08-19T01:00:00.000Z',
        warnings: [],
        extraction: {
          deadline: '2026-08-19',
          matchedCount: 1,
          successCount: 1,
          failedCount: 0,
          complete: true,
        },
        projects: [{
          taskId: 'task-1',
          projectName: '项目甲',
          sizes: ['1080x1920'],
          requirements: [{ resolution: '1080x1920', requiredQuantity: 1 }],
        }],
      },
    }
    assert.equal((await fetch(`http://127.0.0.1:${connection.port}/v2/extractions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Origin: `chrome-extension://${extensionId}`,
        'Content-Type': 'application/json',
        'X-OpenFlow-Extension-Version': '2.5.3',
        'X-OpenFlow-Protocol-Version': '2',
      },
      body: JSON.stringify({ ...extractionEnvelope, protocolVersion: 1 }),
    })).status, 400)

    const extractionResponse = await fetch(`http://127.0.0.1:${connection.port}/v2/extractions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Origin: `chrome-extension://${extensionId}`,
        'Content-Type': 'application/json',
        'X-OpenFlow-Extension-Version': '2.5.3',
        'X-OpenFlow-Protocol-Version': '2',
      },
      body: JSON.stringify(extractionEnvelope),
    })
    assert.equal(extractionResponse.status, 200)
    assert.equal((await extractionResponse.json()).messageId, extractionEnvelope.messageId)
    assert.equal(extractions.length, 1)
  } finally {
    await bridge.stop()
  }
})
