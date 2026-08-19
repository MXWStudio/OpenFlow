import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { DiagnosticEventInput } from '../shared/diagnosticsContract'

const MAX_REQUEST_BYTES = 128 * 1024
const MAX_DIAGNOSTIC_EVENTS = 25

export interface ExtensionBridgeStatus {
  pending: boolean
  targetVersion: string
  desktopVersion: string
  action: 'none' | 'reload' | 'acknowledge'
  message?: string
}

export interface ExtensionBridgeAcknowledgement {
  version: string
  status: 'ready' | 'failed'
  reason?: string
}

export interface LocalUpdateBridgeOptions {
  extensionId: string
  getStatus: (currentVersion: string) => Promise<ExtensionBridgeStatus>
  acknowledge: (acknowledgement: ExtensionBridgeAcknowledgement) => Promise<{ reload: boolean }>
  captureDiagnostics?: (events: DiagnosticEventInput[], extensionVersion: string) => Promise<{ accepted: number }>
}

function isDiagnosticEvent(value: unknown): value is DiagnosticEventInput {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<DiagnosticEventInput>
  return typeof event.type === 'string' &&
    event.type.length > 0 &&
    event.type.length <= 80 &&
    (event.severity === undefined || event.severity === 'info' || event.severity === 'warning' || event.severity === 'error') &&
    (event.occurredAt === undefined || typeof event.occurredAt === 'string')
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown, allowedOrigin?: string): void {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (allowedOrigin) response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  response.end(JSON.stringify(body))
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_REQUEST_BYTES) throw new Error('Request body is too large')
    chunks.push(bytes)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export class LocalUpdateBridge {
  private readonly token = randomBytes(32).toString('hex')
  private readonly options: LocalUpdateBridgeOptions
  private server: Server | null = null
  private port = 0

  constructor(options: LocalUpdateBridgeOptions) {
    this.options = options
  }

  async start(): Promise<{ port: number; token: string }> {
    if (this.server) return { port: this.port, token: this.token }
    const allowedOrigin = `chrome-extension://${this.options.extensionId}`
    const server = createServer((request, response) => {
      void this.handleRequest(request, response, allowedOrigin).catch((error) => {
        sendJson(response, 500, { error: error instanceof Error ? error.message : 'Internal error' }, allowedOrigin)
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      throw new Error('Local extension bridge did not receive a loopback port')
    }
    this.server = server
    this.port = address.port
    return { port: this.port, token: this.token }
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = null
    this.port = 0
    if (!server) return
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  private isAuthorized(request: IncomingMessage): boolean {
    const header = request.headers.authorization ?? ''
    const candidate = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
    const expectedBytes = Buffer.from(this.token)
    const candidateBytes = Buffer.from(candidate)
    return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    allowedOrigin: string,
  ): Promise<void> {
    const origin = request.headers.origin
    if (origin && origin !== allowedOrigin) {
      sendJson(response, 403, { error: 'Origin is not allowed' })
      return
    }
    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-OpenFlow-Extension-Version')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.setHeader('Cache-Control', 'no-store')
      response.end()
      return
    }
    if (!this.isAuthorized(request)) {
      sendJson(response, 401, { error: 'Unauthorized' }, allowedOrigin)
      return
    }

    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const versionHeader = request.headers['x-openflow-extension-version']
    const currentVersion = Array.isArray(versionHeader) ? versionHeader[0] : versionHeader ?? ''
    if (request.method === 'GET' && url.pathname === '/v1/status') {
      sendJson(response, 200, await this.options.getStatus(currentVersion), allowedOrigin)
      return
    }
    if (request.method === 'POST' && url.pathname === '/v1/ack') {
      const body = await readJsonBody(request) as Partial<ExtensionBridgeAcknowledgement>
      if (
        typeof body.version !== 'string' ||
        (body.status !== 'ready' && body.status !== 'failed') ||
        (body.reason !== undefined && typeof body.reason !== 'string')
      ) {
        sendJson(response, 400, { error: 'Invalid acknowledgement' }, allowedOrigin)
        return
      }
      sendJson(response, 200, await this.options.acknowledge(body as ExtensionBridgeAcknowledgement), allowedOrigin)
      return
    }
    if (request.method === 'POST' && url.pathname === '/v1/diagnostics') {
      if (!this.options.captureDiagnostics) {
        sendJson(response, 503, { error: 'Diagnostics collector is unavailable' }, allowedOrigin)
        return
      }
      const body = await readJsonBody(request) as { events?: unknown }
      if (
        !Array.isArray(body.events) ||
        body.events.length === 0 ||
        body.events.length > MAX_DIAGNOSTIC_EVENTS ||
        !body.events.every(isDiagnosticEvent)
      ) {
        sendJson(response, 400, { error: 'Invalid diagnostics batch' }, allowedOrigin)
        return
      }
      sendJson(
        response,
        200,
        await this.options.captureDiagnostics(body.events, currentVersion),
        allowedOrigin,
      )
      return
    }
    sendJson(response, 404, { error: 'Not found' }, allowedOrigin)
  }
}
