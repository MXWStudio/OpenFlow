import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import fs from 'fs-extra'
import type {
  DiagnosticEventInput,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticsUploadEnvelope,
  DiagnosticsViewState,
  StoredDiagnosticEvent,
} from '../shared/diagnosticsContract'

const DEFAULT_UPLOAD_INTERVAL_MINUTES = 30
const MIN_UPLOAD_INTERVAL_MINUTES = 5
const MAX_UPLOAD_INTERVAL_MINUTES = 24 * 60
const DEFAULT_MAX_QUEUE_EVENTS = 500
const DEFAULT_MAX_BATCH_EVENTS = 50
const MAX_EVENT_BYTES = 24 * 1024
const MAX_UPLOAD_BYTES = 512 * 1024
const MAX_STRING_LENGTH = 1_000
const MAX_ARRAY_LENGTH = 50
const MAX_OBJECT_KEYS = 50
const MAX_VALUE_DEPTH = 5
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1_000
const NEXT_BATCH_DELAY_MS = 30 * 1_000

interface DiagnosticsConfiguration {
  sentryDsn: string
  uploadIntervalMinutes: number
}

interface UpdateConfigurationFile {
  schemaVersion?: number
  diagnostics?: {
    sentryDsn?: unknown
    uploadIntervalMinutes?: unknown
  }
}

interface DiagnosticsIdentity {
  schemaVersion: 1
  installationId: string
  createdAt: string
}

export interface DiagnosticsManagerOptions {
  rootPath: string
  configurationPath: string
  desktopVersion: string
  platform: string
  architecture: string
  locale: string
  getExtensionVersion?: () => string | undefined
  uploadBatch?: (envelope: DiagnosticsUploadEnvelope) => Promise<void>
  maxQueueEvents?: number
  maxBatchEvents?: number
  autoSchedule?: boolean
  onStateChange?: (state: DiagnosticsViewState) => void
}

const SENSITIVE_KEY = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|bridge|credential)/i
const URL_KEY = /(url|uri|href|source)/i
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const WINDOWS_PATH_PATTERN = /\b[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*/g
const POSIX_HOME_PATTERN = /\/(?:Users|home)\/[^\s/]+(?:\/[^\s]*)?/g
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi
const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeSeverity(value: unknown): DiagnosticSeverity {
  return value === 'info' || value === 'warning' || value === 'error' ? value : 'error'
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString()
  return new Date().toISOString()
}

function sanitizeUrl(value: string): string {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return `${parsed.protocol}//${parsed.host}/[redacted]`
  } catch {
    // Fall through to generic string redaction.
  }
  return value
}

function sanitizeString(value: string, key: string): string {
  let result = URL_KEY.test(key) ? sanitizeUrl(value) : value
  result = result
    .replace(HTTP_URL_PATTERN, (url) => sanitizeUrl(url))
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(EMAIL_PATTERN, '[email]')
    .replace(WINDOWS_PATH_PATTERN, '[local-path]')
    .replace(POSIX_HOME_PATTERN, '[local-path]')
  return result.length > MAX_STRING_LENGTH ? `${result.slice(0, MAX_STRING_LENGTH)}...[truncated]` : result
}

export function sanitizeDiagnosticValue(
  value: unknown,
  key = '',
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (SENSITIVE_KEY.test(key)) return '[redacted]'
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return sanitizeString(value, key)
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value !== 'object') return String(value)
  if (depth >= MAX_VALUE_DEPTH) return '[max-depth]'
  if (seen.has(value)) return '[circular]'
  seen.add(value)

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => sanitizeDiagnosticValue(entry, key, depth + 1, seen))
    if (value.length > MAX_ARRAY_LENGTH) result.push(`[${value.length - MAX_ARRAY_LENGTH} more items]`)
    return result
  }

  const result: Record<string, unknown> = {}
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS)
  for (const [entryKey, entryValue] of entries) {
    result[entryKey] = sanitizeDiagnosticValue(entryValue, entryKey, depth + 1, seen)
  }
  if (Object.keys(value as object).length > MAX_OBJECT_KEYS) result.__truncatedKeys = true
  return result
}

function normalizeEventType(value: unknown): string {
  const type = typeof value === 'string' ? value.trim() : ''
  return /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(type) ? type : 'unknown'
}

export function normalizeSentryDsn(value: unknown): string {
  const dsn = typeof value === 'string' ? value.trim() : ''
  if (!dsn) return ''
  const parsed = new URL(dsn)
  if (parsed.protocol !== 'https:') throw new Error('Sentry DSN 必须使用 HTTPS')
  if (!parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname === '/') {
    throw new Error('Sentry DSN 格式无效')
  }
  return parsed.toString()
}

function normalizeIntervalMinutes(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_UPLOAD_INTERVAL_MINUTES
  return Math.min(MAX_UPLOAD_INTERVAL_MINUTES, Math.max(MIN_UPLOAD_INTERVAL_MINUTES, Math.round(parsed)))
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.ensureDir(dirname(filePath))
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  await fs.writeJson(temporaryPath, value, { spaces: 2 })
  await fs.move(temporaryPath, filePath, { overwrite: true })
}

export class DiagnosticsManager {
  private readonly options: DiagnosticsManagerOptions
  private readonly pendingPath: string
  private readonly identityPath: string
  private configuration: DiagnosticsConfiguration = {
    sentryDsn: '',
    uploadIntervalMinutes: DEFAULT_UPLOAD_INTERVAL_MINUTES,
  }
  private identity: DiagnosticsIdentity | null = null
  private timer: NodeJS.Timeout | null = null
  private activeFlush: Promise<boolean> | null = null
  private failureCount = 0
  private state: DiagnosticsViewState = {
    status: 'local-only',
    pendingCount: 0,
    uploadIntervalMinutes: DEFAULT_UPLOAD_INTERVAL_MINUTES,
    sentryConfigured: false,
    message: '正在准备自动诊断收集',
  }

  constructor(options: DiagnosticsManagerOptions) {
    this.options = options
    this.pendingPath = join(options.rootPath, 'pending')
    this.identityPath = join(options.rootPath, 'identity.json')
  }

  getState(): DiagnosticsViewState {
    return { ...this.state }
  }

  async start(): Promise<void> {
    await fs.ensureDir(this.pendingPath)
    this.identity = await this.loadOrCreateIdentity()
    let configurationError = ''
    try {
      this.configuration = await this.readConfiguration()
    } catch (error) {
      configurationError = errorMessage(error)
    }
    const pendingCount = (await this.listEventPaths()).length
    const sentryConfigured = Boolean(this.configuration.sentryDsn && this.options.uploadBatch)
    this.patchState({
      status: configurationError ? 'error' : sentryConfigured ? (pendingCount ? 'queued' : 'idle') : 'local-only',
      pendingCount,
      uploadIntervalMinutes: this.configuration.uploadIntervalMinutes,
      sentryConfigured,
      message: configurationError
        ? `诊断回传配置无效，现场仍保存在本机：${configurationError}`
        : sentryConfigured
          ? pendingCount
            ? `已自动保存 ${pendingCount} 条诊断信息，等待批量回传`
            : `Sentry 自动诊断已启用，每 ${this.configuration.uploadIntervalMinutes} 分钟批量回传`
          : `自动诊断已启用；未配置 OpenFlow Sentry DSN，现场暂存在本机`,
    })
    if (sentryConfigured && this.options.autoSchedule !== false) {
      this.scheduleUpload(this.configuration.uploadIntervalMinutes * 60_000)
    }
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  async record(
    source: DiagnosticSource,
    input: DiagnosticEventInput,
    extensionVersion = this.options.getExtensionVersion?.(),
  ): Promise<StoredDiagnosticEvent> {
    const now = new Date().toISOString()
    const event: StoredDiagnosticEvent = {
      schemaVersion: 1,
      id: randomUUID(),
      source,
      type: normalizeEventType(input.type),
      severity: normalizeSeverity(input.severity),
      occurredAt: normalizeTimestamp(input.occurredAt),
      receivedAt: now,
      desktopVersion: this.options.desktopVersion,
      ...(extensionVersion ? { extensionVersion: sanitizeString(extensionVersion, 'extensionVersion') } : {}),
      payload: sanitizeDiagnosticValue(input.payload),
    }
    const sourceBytes = Buffer.byteLength(JSON.stringify(event))
    if (sourceBytes > MAX_EVENT_BYTES) {
      const previewSource = typeof event.payload === 'string'
        ? event.payload
        : JSON.stringify(event.payload)
      event.payload = {
        truncated: true,
        originalBytes: sourceBytes,
        preview: sanitizeString(previewSource, 'preview'),
      }
    }
    const finalPath = join(this.pendingPath, `${Date.now()}-${event.id}.json`)
    await writeJsonAtomic(finalPath, event)
    await this.pruneQueue()
    const pendingCount = (await this.listEventPaths()).length
    this.patchState({
      status: this.configuration.sentryDsn && this.options.uploadBatch ? 'queued' : 'local-only',
      pendingCount,
      message: this.configuration.sentryDsn && this.options.uploadBatch
        ? `已自动保存 ${pendingCount} 条诊断信息，等待发送到 Sentry`
        : `已自动保存 ${pendingCount} 条诊断信息；配置 OpenFlow Sentry DSN 后会自动补传`,
    })
    return event
  }

  async recordBatch(
    source: DiagnosticSource,
    inputs: DiagnosticEventInput[],
    extensionVersion?: string,
  ): Promise<number> {
    const boundedInputs = inputs.slice(0, 25)
    for (const input of boundedInputs) await this.record(source, input, extensionVersion)
    return boundedInputs.length
  }

  flushNow(): Promise<boolean> {
    if (!this.activeFlush) {
      this.activeFlush = this.performFlush().finally(() => {
        this.activeFlush = null
      })
    }
    return this.activeFlush
  }

  async exportSnapshot(filePath: string): Promise<void> {
    const events = await this.readPendingEvents(this.options.maxQueueEvents ?? DEFAULT_MAX_QUEUE_EVENTS)
    await writeJsonAtomic(filePath, {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      desktopVersion: this.options.desktopVersion,
      platform: this.options.platform,
      architecture: this.options.architecture,
      locale: this.options.locale,
      diagnostics: this.getState(),
      events: events.map(({ event }) => event),
    })
  }

  private async performFlush(): Promise<boolean> {
    if (!this.configuration.sentryDsn || !this.options.uploadBatch || !this.identity) return false
    const maxBatchEvents = this.options.maxBatchEvents ?? DEFAULT_MAX_BATCH_EVENTS
    const candidates = await this.readPendingEvents(maxBatchEvents)
    if (!candidates.length) {
      this.failureCount = 0
      this.patchState({ status: 'idle', pendingCount: 0, message: `Sentry 自动诊断已启用，每 ${this.configuration.uploadIntervalMinutes} 分钟批量回传` })
      this.scheduleAfterFlush(this.configuration.uploadIntervalMinutes * 60_000)
      return true
    }

    const selected: typeof candidates = []
    for (const candidate of candidates) {
      const prospective = [...selected, candidate]
      const bytes = Buffer.byteLength(JSON.stringify(prospective.map(({ event }) => event)))
      if (bytes > MAX_UPLOAD_BYTES && selected.length > 0) break
      selected.push(candidate)
    }
    const envelope: DiagnosticsUploadEnvelope = {
      schemaVersion: 1,
      installationId: this.identity.installationId,
      generatedAt: new Date().toISOString(),
      desktopVersion: this.options.desktopVersion,
      platform: this.options.platform,
      architecture: this.options.architecture,
      locale: this.options.locale,
      events: selected.map(({ event }) => event),
    }
    this.patchState({ status: 'uploading', message: `正在批量回传 ${selected.length} 条诊断信息` })

    try {
      await this.options.uploadBatch(envelope)
      await Promise.all(selected.map(({ filePath: path }) => fs.remove(path)))
      this.failureCount = 0
      const pendingCount = (await this.listEventPaths()).length
      const lastUploadedAt = new Date().toISOString()
      this.patchState({
        status: pendingCount ? 'queued' : 'idle',
        pendingCount,
        lastUploadedAt,
        message: pendingCount
          ? `已完成一批回传，仍有 ${pendingCount} 条等待下一批`
          : `诊断信息已自动发送到 Sentry，当前没有待发送内容`,
      })
      this.scheduleAfterFlush(pendingCount ? NEXT_BATCH_DELAY_MS : this.configuration.uploadIntervalMinutes * 60_000)
      return true
    } catch (error) {
      this.failureCount += 1
      const delay = Math.min(
        MAX_BACKOFF_MS,
        this.configuration.uploadIntervalMinutes * 60_000 * (2 ** Math.min(this.failureCount - 1, 6)),
      )
      this.patchState({
        status: 'error',
        pendingCount: (await this.listEventPaths()).length,
        message: `诊断回传暂时失败，现场已保留并会自动重试：${sanitizeString(errorMessage(error), 'error')}`,
      })
      this.scheduleAfterFlush(delay)
      return false
    }
  }

  private async readConfiguration(): Promise<DiagnosticsConfiguration> {
    if (!await fs.pathExists(this.options.configurationPath)) {
      return { sentryDsn: '', uploadIntervalMinutes: DEFAULT_UPLOAD_INTERVAL_MINUTES }
    }
    const value = await fs.readJson(this.options.configurationPath) as UpdateConfigurationFile
    if (value.schemaVersion !== 1) throw new Error('不支持的应用配置')
    return {
      sentryDsn: normalizeSentryDsn(value.diagnostics?.sentryDsn),
      uploadIntervalMinutes: normalizeIntervalMinutes(value.diagnostics?.uploadIntervalMinutes),
    }
  }

  private async loadOrCreateIdentity(): Promise<DiagnosticsIdentity> {
    try {
      const value = await fs.readJson(this.identityPath) as Partial<DiagnosticsIdentity>
      if (value.schemaVersion === 1 && typeof value.installationId === 'string' && value.installationId) {
        return value as DiagnosticsIdentity
      }
    } catch {
      // Create a new pseudonymous installation identity below.
    }
    const identity: DiagnosticsIdentity = {
      schemaVersion: 1,
      installationId: randomUUID(),
      createdAt: new Date().toISOString(),
    }
    await writeJsonAtomic(this.identityPath, identity)
    return identity
  }

  private async listEventPaths(): Promise<string[]> {
    if (!await fs.pathExists(this.pendingPath)) return []
    return (await fs.readdir(this.pendingPath))
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => join(this.pendingPath, name))
  }

  private async readPendingEvents(limit: number): Promise<Array<{ filePath: string, event: StoredDiagnosticEvent }>> {
    const result: Array<{ filePath: string, event: StoredDiagnosticEvent }> = []
    for (const filePath of (await this.listEventPaths()).slice(0, limit)) {
      try {
        const event = await fs.readJson(filePath) as StoredDiagnosticEvent
        if (event.schemaVersion !== 1 || typeof event.id !== 'string' || typeof event.type !== 'string') throw new Error('invalid')
        result.push({ filePath, event })
      } catch {
        await fs.remove(filePath)
      }
    }
    return result
  }

  private async pruneQueue(): Promise<void> {
    const paths = await this.listEventPaths()
    const maxQueueEvents = this.options.maxQueueEvents ?? DEFAULT_MAX_QUEUE_EVENTS
    const overflow = paths.length - maxQueueEvents
    if (overflow > 0) await Promise.all(paths.slice(0, overflow).map((filePath) => fs.remove(filePath)))
  }

  private scheduleAfterFlush(delay: number): void {
    if (this.options.autoSchedule === false || !this.configuration.sentryDsn || !this.options.uploadBatch) return
    this.scheduleUpload(delay)
  }

  private scheduleUpload(delay: number): void {
    if (this.timer) clearTimeout(this.timer)
    const boundedDelay = Math.max(1_000, delay)
    const nextUploadAt = new Date(Date.now() + boundedDelay).toISOString()
    this.timer = setTimeout(() => void this.flushNow(), boundedDelay)
    this.patchState({ nextUploadAt })
  }

  private patchState(patch: Partial<DiagnosticsViewState>): void {
    this.state = { ...this.state, ...patch }
    this.options.onStateChange?.(this.getState())
  }
}
