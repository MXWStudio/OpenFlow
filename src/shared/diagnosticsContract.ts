export type DiagnosticSeverity = 'info' | 'warning' | 'error'

export type DiagnosticSource = 'desktop' | 'renderer' | 'extension'

export interface DiagnosticEventInput {
  type: string
  severity?: DiagnosticSeverity
  occurredAt?: string
  payload?: unknown
}

export interface StoredDiagnosticEvent {
  schemaVersion: 1
  id: string
  source: DiagnosticSource
  type: string
  severity: DiagnosticSeverity
  occurredAt: string
  receivedAt: string
  desktopVersion: string
  extensionVersion?: string
  payload: unknown
}

export type DiagnosticsStatus = 'local-only' | 'idle' | 'queued' | 'uploading' | 'error'

export interface DiagnosticsViewState {
  status: DiagnosticsStatus
  pendingCount: number
  uploadIntervalMinutes: number
  sentryConfigured: boolean
  lastUploadedAt?: string
  nextUploadAt?: string
  message: string
}

export interface DiagnosticsUploadEnvelope {
  schemaVersion: 1
  installationId: string
  generatedAt: string
  desktopVersion: string
  platform: string
  architecture: string
  locale: string
  events: StoredDiagnosticEvent[]
}
