import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { ExtractionInbox } from './extractionInbox.ts'

function envelope(messageId: string, extractedAt: string) {
  return {
    protocolVersion: 2,
    messageId,
    createdAt: extractedAt,
    payload: {
      schemaVersion: 'openflow.requirements.v1',
      source: { app: 'OpenFlow', url: 'https://example.test/tasks' },
      extractedAt,
      warnings: [],
      extraction: {
        deadline: '2026-08-19',
        filterMode: 'deadline',
        matchedCount: 1,
        successCount: 1,
        failedCount: 0,
        complete: true,
      },
      projects: [{
        taskId: 'task-1',
        projectName: '测试项目',
        producerName: '测试制作人',
        materialType: '视频',
        requirements: [{ resolution: '1080x1920', requiredQuantity: 2 }],
        sizes: ['1080x1920'],
      }],
    },
  }
}

test('extraction inbox validates, atomically stores, deduplicates, and exposes today latest', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'openflow-extraction-inbox-'))
  const now = new Date('2026-08-19T10:00:00.000+08:00')
  const inbox = new ExtractionInbox({ rootPath, now: () => now, processId: 42 })
  const message = envelope('778b833c-7e09-4bb4-9f4d-a8b9f3762ec4', '2026-08-19T09:30:00.000+08:00')
  try {
    const accepted = await inbox.accept(message, '2.5.3')
    assert.equal(accepted.status, 'accepted')
    assert.equal(accepted.protocolVersion, 2)

    await rm(join(rootPath, 'daily', '2026-08-19.json'))
    const duplicate = await inbox.accept(message, '2.5.3')
    assert.equal(duplicate.status, 'duplicate')
    assert.equal(duplicate.messageId, message.messageId)

    const latest = await inbox.getLatestForToday()
    assert.equal(latest?.envelope.messageId, message.messageId)
    assert.equal(latest?.envelope.payload.projects[0].requirements[0].resolution, '1080*1920')
    assert.equal(latest?.extensionVersion, '2.5.3')

    const persisted = JSON.parse(await readFile(join(rootPath, 'messages', `${message.messageId}.json`), 'utf8'))
    assert.equal(persisted.envelope.messageId, message.messageId)
  } finally {
    await rm(rootPath, { recursive: true, force: true })
  }
})

test('extraction inbox keeps the newest extraction for the local day and rejects incomplete input', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'openflow-extraction-inbox-'))
  const now = new Date('2026-08-19T18:00:00.000+08:00')
  const inbox = new ExtractionInbox({ rootPath, now: () => now })
  try {
    const newest = envelope('b9fd680d-1dd3-48e6-8ba8-e99ef6fe6684', '2026-08-19T17:00:00.000+08:00')
    const older = envelope('6c0531b3-d595-4f1e-8c58-90dfa5549f98', '2026-08-19T12:00:00.000+08:00')
    await inbox.accept(newest, '2.5.3')
    await inbox.accept(older, '2.5.3')
    assert.equal((await inbox.getLatestForToday())?.envelope.messageId, newest.messageId)

    const incomplete = envelope('90e4ba48-d007-4686-b685-d968c5004454', '2026-08-19T17:30:00.000+08:00')
    incomplete.payload.extraction.complete = false
    await assert.rejects(inbox.accept(incomplete, '2.5.3'), /只接收完整抓取结果/)
  } finally {
    await rm(rootPath, { recursive: true, force: true })
  }
})
