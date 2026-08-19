import fs from 'fs-extra'
import * as Sentry from '@sentry/electron/main'
import type { DiagnosticsUploadEnvelope } from '../shared/diagnosticsContract'
import { normalizeSentryDsn } from './diagnosticsManager'
import { diagnosticToSentryEvent, protectSentryEvent, shouldForwardDiagnostic } from './sentryDiagnostics'

interface SentryConfigurationFile {
  schemaVersion?: number
  diagnostics?: { sentryDsn?: unknown }
}

export interface OpenFlowSentryRuntime {
  initialized: boolean
  dsn: string
  uploadBatch?: (envelope: DiagnosticsUploadEnvelope) => Promise<void>
}

export function initializeOpenFlowSentry(configurationPath: string, release: string): OpenFlowSentryRuntime {
  let dsn = ''
  try {
    if (fs.pathExistsSync(configurationPath)) {
      const configuration = fs.readJsonSync(configurationPath) as SentryConfigurationFile
      if (configuration.schemaVersion === 1) dsn = normalizeSentryDsn(configuration.diagnostics?.sentryDsn)
    }
  } catch (error) {
    console.warn('Unable to load Sentry configuration:', error instanceof Error ? error.message : error)
  }
  if (!dsn) return { initialized: false, dsn: '' }

  Sentry.init({
    dsn,
    release,
    environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    includeServerName: false,
    integrations(defaultIntegrations) {
      return defaultIntegrations.filter((integration) => ![
        'Breadcrumbs',
        'ContextLines',
        'LocalVariables',
        'RequestData',
      ].includes(integration.name))
    },
    beforeSend: protectSentryEvent,
  })

  return {
    initialized: true,
    dsn,
    async uploadBatch(envelope) {
      for (const diagnostic of envelope.events.filter(shouldForwardDiagnostic)) {
        Sentry.captureEvent(diagnosticToSentryEvent(envelope, diagnostic))
      }
      if (!await Sentry.flush(20_000)) throw new Error('Sentry 在超时时间内未确认发送')
    },
  }
}
