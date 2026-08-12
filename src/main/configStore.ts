import { dirname } from 'node:path'
import { mkdir, open, readFile, rename, rm, type FileHandle } from 'node:fs/promises'

export type ConfigRecord = Record<string, unknown>

export interface JsonConfigStoreOptions {
  replaceFile?: (temporaryPath: string, destinationPath: string) => Promise<void>
  processId?: number
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function keyParts(key: string): string[] | null {
  const parts = key.split('.')
  return parts.length > 0 && parts.every((part) => part && !UNSAFE_KEYS.has(part)) ? parts : null
}

function isConfigRecord(value: unknown): value is ConfigRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function syncDirectory(path: string): Promise<void> {
  let handle: FileHandle | undefined
  try {
    handle = await open(path, 'r')
    await handle.sync()
  } catch {
    // Some platforms do not allow opening directories. The file itself is still fsynced.
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

export class JsonConfigStore {
  private mutationQueue: Promise<void> = Promise.resolve()
  private temporaryCounter = 0
  private readonly configPath: string
  private readonly replaceFile: (temporaryPath: string, destinationPath: string) => Promise<void>
  private readonly processId: number

  constructor(
    configPath: string,
    options: JsonConfigStoreOptions = {},
  ) {
    this.configPath = configPath
    // node:fs rename replaces a same-filesystem destination atomically. Unlike
    // fs-extra.move({ overwrite: true }), it never deletes the live file first.
    this.replaceFile = options.replaceFile || rename
    this.processId = options.processId ?? process.pid
  }

  private async readCurrent(): Promise<ConfigRecord> {
    try {
      const parsed = JSON.parse(await readFile(this.configPath, 'utf8')) as unknown
      return isConfigRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  private async writeAtomic(data: ConfigRecord): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true })
    this.temporaryCounter += 1
    const temporaryPath = `${this.configPath}.${this.processId}.${this.temporaryCounter}.tmp`
    let handle: FileHandle | undefined

    try {
      handle = await open(temporaryPath, 'w', 0o600)
      await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8')
      await handle.sync()
      await handle.close()
      handle = undefined
      await this.replaceFile(temporaryPath, this.configPath)
      await syncDirectory(dirname(this.configPath))
    } catch (error) {
      await handle?.close().catch(() => undefined)
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  private enqueueMutation(mutate: (data: ConfigRecord) => void): Promise<void> {
    const mutation = this.mutationQueue.then(async () => {
      const data = await this.readCurrent()
      mutate(data)
      await this.writeAtomic(data)
    })
    this.mutationQueue = mutation.catch(() => undefined)
    return mutation
  }

  async get(key: string): Promise<unknown> {
    await this.mutationQueue
    const parts = keyParts(key)
    if (!parts) return undefined
    const data = await this.readCurrent()
    let current: unknown = data
    for (const part of parts) {
      if (!isConfigRecord(current)) return undefined
      current = current[part]
    }
    return current
  }

  async set(key: string, value: unknown): Promise<void> {
    const parts = keyParts(key)
    if (!parts) return
    return this.enqueueMutation((data) => {
      let current = data
      for (let index = 0; index < parts.length - 1; index += 1) {
        const existing = current[parts[index]]
        if (!isConfigRecord(existing)) current[parts[index]] = {}
        current = current[parts[index]] as ConfigRecord
      }
      current[parts[parts.length - 1]] = value
    })
  }

  async delete(key: string): Promise<void> {
    const parts = keyParts(key)
    if (!parts) return
    return this.enqueueMutation((data) => {
      let current = data
      for (let index = 0; index < parts.length - 1; index += 1) {
        const existing = current[parts[index]]
        if (!isConfigRecord(existing)) return
        current = existing
      }
      delete current[parts[parts.length - 1]]
    })
  }

  async getAll(): Promise<ConfigRecord> {
    await this.mutationQueue
    return this.readCurrent()
  }
}
