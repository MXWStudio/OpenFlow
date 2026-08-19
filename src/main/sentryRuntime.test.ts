import assert from 'node:assert/strict'
import test from 'node:test'
import type { Event } from '@sentry/core'
import type { DiagnosticsUploadEnvelope, StoredDiagnosticEvent } from '../shared/diagnosticsContract'
import { diagnosticToSentryEvent, protectSentryEvent, shouldForwardDiagnostic } from './sentryDiagnostics.ts'

const baseEvent: StoredDiagnosticEvent = {
  schemaVersion: 1,
  id: 'event-1',
  source: 'extension',
  type: 'extension.extraction_incomplete',
  severity: 'warning',
  occurredAt: '2026-08-19T01:00:00.000Z',
  receivedAt: '2026-08-19T01:00:01.000Z',
  desktopVersion: '2.5.3',
  extensionVersion: '2.5.3',
  payload: { failureCodes: ['missing-card'], token: 'removed-before-storage' },
}

const envelope: DiagnosticsUploadEnvelope = {
  schemaVersion: 1,
  installationId: 'anonymous-installation',
  generatedAt: '2026-08-19T01:30:00.000Z',
  desktopVersion: '2.5.3',
  platform: 'win32',
  architecture: 'x64',
  locale: 'zh-CN',
  events: [baseEvent],
}

test('forwards actionable diagnostics but avoids SDK duplicates and success noise', () => {
  assert.equal(shouldForwardDiagnostic(baseEvent), true)
  assert.equal(shouldForwardDiagnostic({ ...baseEvent, type: 'extension.extraction_summary', severity: 'info' }), false)
  assert.equal(shouldForwardDiagnostic({ ...baseEvent, type: 'renderer.unhandled_error', severity: 'error' }), false)
})

test('maps structured diagnostics to stable Sentry grouping', () => {
  const event = diagnosticToSentryEvent(envelope, baseEvent)
  assert.deepEqual(event.fingerprint, ['openflow-diagnostic', 'extension', 'extension.extraction_incomplete', 'missing-card'])
  assert.equal(event.tags?.extension_version, '2.5.3')
  assert.equal(event.extra?.installation_id, 'anonymous-installation')
})

test('removes personal and request context from automatic Sentry events', () => {
  const event = protectSentryEvent({
    user: { email: 'person@example.com' },
    request: { url: 'https://example.com/private?id=1' },
    server_name: 'DESKTOP-NAME',
    breadcrumbs: [{ message: 'private action' }],
    extra: { localPath: 'C:\\Users\\person\\private.txt', token: 'secret' },
  } as Event)
  assert.equal(event.user, undefined)
  assert.equal(event.request, undefined)
  assert.equal(event.server_name, undefined)
  assert.equal(event.breadcrumbs, undefined)
  assert.equal((event.extra as Record<string, unknown>).token, '[redacted]')
})
