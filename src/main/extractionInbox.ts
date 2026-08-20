import { dirname, join } from 'node:path'
import { mkdir, open, readFile, rename, rm, stat, type FileHandle } from 'node:fs/promises'
import {
  EXTRACTION_PROTOCOL_VERSION,
  validateExtractionEnvelope,
  type ExtractionAcknowledgement,
  type ExtractionEnvelope,
} from '../shared/extractionContract.ts'

export interface StoredExtraction {
  schemaVersion: 1
  receivedAt: string
  extensionVersion: string
  envelope: ExtractionEnvelope
}

export interface ExtractionInboxOptions {
  rootPath: string
  now?: () => Date
  replaceFile?: (temporaryPath: string, destinationPath: string) => Promise<void>
  processId?: number
}

function localDateKey(value: string): string {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function syncDirectory(path: string): Promise<void> {
  let handle: FileHandle | undefined
  try {
    handle = await open(path, 'r')
    await handle.sync()
  } catch {
    // Windows may reject directory handles. The file itself is still fsynced.
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

async function readStored(path: string): Promise<StoredExtraction | null> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as StoredExtraction
    const validation = validateExtractionEnvelope(parsed?.envelope)
    if (!validation.ok || parsed.schemaVersion !== 1 || typeof parsed.receivedAt !== 'string') return null
    return { ...parsed, envelope: validation.envelope }
  } catch {
    return null
  }
}

export class ExtractionInbox {
  private readonly rootPath: string
  private readonly now: () => Date
  private readonly replaceFile: (temporaryPath: string, destinationPath: string) => Promise<void>
  private readonly processId: number
  private mutationQueue: Promise<void> = Promise.resolve()
  private temporaryCounter = 0

  constructor(options: ExtractionInboxOptions) {
    this.rootPath = options.rootPath
    this.now = options.now || (() => new Date())
    this.replaceFile = options.replaceFile || rename
    this.processId = options.processId ?? process.pid
  }

  private messagePath(messageId: string): string {
    return join(this.rootPath, 'messages', `${messageId}.json`)
  }

  private dailyPath(dateKey: string): string {
    return join(this.rootPath, 'daily', `${dateKey}.json`)
  }

  private async writeAtomic(destinationPath: string, value: unknown): Promise<void> {
    await mkdir(dirname(destinationPath), { recursive: true })
    this.temporaryCounter += 1
    const temporaryPath = `${destinationPath}.${this.processId}.${this.temporaryCounter}.tmp`
    let handle: FileHandle | undefined
    try {
      handle = await open(temporaryPath, 'wx', 0o600)
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
      await handle.sync()
      await handle.close()
      handle = undefined
      await this.replaceFile(temporaryPath, destinationPath)
      await syncDirectory(dirname(destinationPath))
    } catch (error) {
      await handle?.close().catch(() => undefined)
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  private async updateDailyLatest(stored: StoredExtraction): Promise<void> {
    const dateKey = localDateKey(stored.envelope.payload.extractedAt)
    const latestPath = this.dailyPath(dateKey)
    const currentLatest = await readStored(latestPath)
    if (!currentLatest || Date.parse(currentLatest.envelope.payload.extractedAt) <= Date.parse(stored.envelope.payload.extractedAt)) {
      await this.writeAtomic(latestPath, stored)
    }
  }

  async accept(value: unknown, extensionVersion: string): Promise<ExtractionAcknowledgement> {
    const validation = validateExtractionEnvelope(value)
    if (!validation.ok) throw new Error(validation.error)
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(extensionVersion)) {
      throw new Error('扩展版本无效')
    }
    const envelope = validation.envelope
    let acknowledgement: ExtractionAcknowledgement | undefined

    const mutation = this.mutationQueue.then(async () => {
      const receivedAt = this.now().toISOString()
      const targetPath = this.messagePath(envelope.messageId)
      try {
        await stat(targetPath)
        const existing = await readStored(targetPath)
        if (!existing || existing.envelope.messageId !== envelope.messageId) {
          throw new Error('已存在的提取消息文件无法通过完整性校验')
        }
        await this.updateDailyLatest(existing)
        acknowledgement = {
          protocolVersion: EXTRACTION_PROTOCOL_VERSION,
          messageId: envelope.messageId,
          status: 'duplicate',
          receivedAt,
        }
        return
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        // A missing message continues into the durable write.
      }

      const stored: StoredExtraction = {
        schemaVersion: 1,
        receivedAt,
        extensionVersion,
        envelope,
      }
      await this.writeAtomic(targetPath, stored)
      await this.updateDailyLatest(stored)
      acknowledgement = {
        protocolVersion: EXTRACTION_PROTOCOL_VERSION,
        messageId: envelope.messageId,
        status: 'accepted',
        receivedAt,
      }
    })
    this.mutationQueue = mutation.catch(() => undefined)
    await mutation
    return acknowledgement!
  }

  async getLatestForToday(): Promise<StoredExtraction | null> {
    await this.mutationQueue
    return readStored(this.dailyPath(localDateKey(this.now().toISOString())))
  }
}
