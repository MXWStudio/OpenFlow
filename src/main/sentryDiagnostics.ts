import type { Event } from '@sentry/core'
import type { DiagnosticsUploadEnvelope, StoredDiagnosticEvent } from '../shared/diagnosticsContract'
import { sanitizeDiagnosticValue } from './diagnosticsManager.ts'

const SDK_CAPTURED_TYPES = new Set([
  'renderer.unhandled_error',
  'renderer.unhandled_rejection',
  'renderer.unresponsive',
])

function removeFrameDetails(event: Event): void {
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars
      delete frame.pre_context
      delete frame.context_line
      delete frame.post_context
    }
  }
}

export function protectSentryEvent(event: Event): Event {
  delete event.user
  delete event.request
  delete event.server_name
  delete event.breadcrumbs
  event.extra = sanitizeDiagnosticValue(event.extra, 'extra') as Record<string, unknown>
  event.contexts = sanitizeDiagnosticValue(event.contexts, 'contexts') as Event['contexts']
  removeFrameDetails(event)
  return event
}

export function shouldForwardDiagnostic(event: StoredDiagnosticEvent): boolean {
  if (SDK_CAPTURED_TYPES.has(event.type)) return false
  return event.severity === 'warning' || event.severity === 'error' || event.type === 'renderer.responsive'
}

export function diagnosticToSentryEvent(
  envelope: DiagnosticsUploadEnvelope,
  diagnostic: StoredDiagnosticEvent,
): Event {
  const failureCodes = diagnostic.payload && typeof diagnostic.payload === 'object'
    ? (diagnostic.payload as Record<string, unknown>).failureCodes
    : undefined
  const fingerprintParts = Array.isArray(failureCodes)
    ? failureCodes.filter((value): value is string => typeof value === 'string').slice(0, 5)
    : []
  return {
    message: `OpenFlow diagnostic: ${diagnostic.type}`,
    level: diagnostic.severity === 'warning' ? 'warning' : diagnostic.severity === 'info' ? 'info' : 'error',
    timestamp: Date.parse(diagnostic.occurredAt) / 1_000,
    fingerprint: ['openflow-diagnostic', diagnostic.source, diagnostic.type, ...fingerprintParts],
    tags: {
      diagnostic_source: diagnostic.source,
      diagnostic_type: diagnostic.type,
      desktop_version: diagnostic.desktopVersion,
      ...(diagnostic.extensionVersion ? { extension_version: diagnostic.extensionVersion } : {}),
    },
    extra: {
      installation_id: envelope.installationId,
      platform: envelope.platform,
      architecture: envelope.architecture,
      locale: envelope.locale,
      diagnostic: diagnostic.payload,
      diagnostic_id: diagnostic.id,
      received_at: diagnostic.receivedAt,
    },
  }
}
