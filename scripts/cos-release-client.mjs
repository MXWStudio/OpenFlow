import COS from 'cos-nodejs-sdk-v5'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open, stat } from 'node:fs/promises'

const MEBIBYTE = 1024 * 1024
const TRANSIENT_ERROR_CODES = new Set([
  'ConnectionTimeout',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'EPIPE',
  'ETIMEDOUT',
  'InternalError',
  'NetworkingError',
  'RequestTimeout',
  'ServiceUnavailable',
  'SlowDown',
  'SocketTimeout',
])

function requiredEnvironment(environment, name) {
  const value = (environment[name] ?? '').trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function integerEnvironment(environment, name, fallback, { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = (environment[name] ?? '').trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return value
}

function booleanEnvironment(environment, name, fallback) {
  const raw = (environment[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  throw new Error(`${name} must be true or false`)
}

export function createConfiguredCosClient(environment = process.env, CosConstructor = COS) {
  const chunkSize = integerEnvironment(environment, 'OPENFLOW_COS_CHUNK_SIZE_MB', 8, {
    minimum: 1,
    maximum: 64,
  }) * MEBIBYTE
  const chunkParallel = integerEnvironment(environment, 'OPENFLOW_COS_CHUNK_PARALLEL', 3, {
    minimum: 1,
    maximum: 16,
  })
  const chunkRetries = integerEnvironment(environment, 'OPENFLOW_COS_CHUNK_RETRIES', 4, {
    minimum: 0,
    maximum: 10,
  })
  const operationAttempts = integerEnvironment(environment, 'OPENFLOW_COS_OPERATION_ATTEMPTS', 3, {
    minimum: 1,
    maximum: 6,
  })
  const fullPublicReadback = booleanEnvironment(environment, 'OPENFLOW_COS_FULL_READBACK', true)
  const clientOptions = {
    SecretId: requiredEnvironment(environment, 'TENCENT_COS_SECRET_ID'),
    SecretKey: requiredEnvironment(environment, 'TENCENT_COS_SECRET_KEY'),
    SecurityToken: (environment.TENCENT_COS_SESSION_TOKEN ?? '').trim() || undefined,
    FileParallelLimit: 1,
    ChunkParallelLimit: chunkParallel,
    ChunkRetryTimes: chunkRetries,
    ChunkSize: chunkSize,
    SliceSize: chunkSize,
    ProgressInterval: 1000,
    UploadCheckContentMd5: true,
    Timeout: integerEnvironment(environment, 'OPENFLOW_COS_REQUEST_TIMEOUT_MS', 120_000, {
      minimum: 10_000,
      maximum: 600_000,
    }),
    KeepAlive: true,
    StrictSsl: true,
    UseAccelerate: booleanEnvironment(environment, 'OPENFLOW_COS_USE_ACCELERATE', false),
  }
  return {
    cos: new CosConstructor(clientOptions),
    chunkSize,
    chunkParallel,
    chunkAttempts: chunkRetries + 1,
    fullPublicReadback,
    operationAttempts,
  }
}

export function contentTypeForFile(fileName) {
  if (fileName.endsWith('.json')) return 'application/json; charset=utf-8'
  if (fileName.endsWith('.yml')) return 'text/yaml; charset=utf-8'
  if (fileName.endsWith('.zip')) return 'application/zip'
  return 'application/octet-stream'
}

export async function sha256File(filePath) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

export function isTransientCosError(error) {
  if (!error) return false
  if (error.retryable === true || error.code === 'OPENFLOW_VERIFY_MISMATCH') return true
  const statusCode = Number(error.statusCode ?? error.status)
  if ([408, 425, 429].includes(statusCode) || statusCode >= 500) return true
  if (TRANSIENT_ERROR_CODES.has(error.code) || TRANSIENT_ERROR_CODES.has(error.name)) return true
  return error instanceof TypeError && /fetch|network|socket/i.test(error.message)
}

export async function retryOperation(
  label,
  operation,
  {
    attempts = 3,
    baseDelayMs = 750,
    logger = console,
    sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
    random = Math.random,
  } = {},
) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isTransientCosError(error)) throw error
      const delay = Math.round(baseDelayMs * (2 ** (attempt - 1)) * (0.8 + random() * 0.4))
      logger.warn(`${label} failed temporarily; retrying (${attempt + 1}/${attempts}) in ${delay} ms.`)
      await sleep(delay)
    }
  }
  throw lastError
}

function normalizedHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value)]),
  )
}

function normalizedCacheControl(value = '') {
  return value.toLowerCase().split(',').map((part) => part.trim()).filter(Boolean).sort().join(',')
}

function verificationError(message) {
  const error = new Error(message)
  error.code = 'OPENFLOW_VERIFY_MISMATCH'
  return error
}

function missingObjectError(error) {
  const statusCode = Number(error?.statusCode ?? error?.status)
  return statusCode === 404 || ['NoSuchKey', 'NoSuchObject', 'NotFound'].includes(error?.code)
}

function publicObjectUrl(publicBaseUrl, key, verificationToken) {
  const url = new URL(publicBaseUrl)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('OPENFLOW_COS_PUBLIC_BASE_URL must be an HTTPS URL without credentials')
  }
  const basePath = url.pathname.replace(/\/+$/g, '')
  const encodedKey = key.split('/').map((part) => encodeURIComponent(part)).join('/')
  url.pathname = `${basePath}/${encodedKey}`
  url.search = ''
  url.hash = ''
  url.searchParams.set('openflow-verify', verificationToken)
  return url.toString()
}

function assertSuccessfulUpload(result, key) {
  const statusCode = Number(result?.statusCode)
  if (Number.isFinite(statusCode) && (statusCode < 200 || statusCode >= 300)) {
    throw new Error(`COS upload returned HTTP ${statusCode}: ${key}`)
  }
}

function expectedDescriptor(filePath, fileStat, sha256, cacheControl) {
  return {
    filePath,
    size: fileStat.size,
    sha256,
    cacheControl,
    contentType: contentTypeForFile(filePath),
  }
}

function compareHead(head, expected) {
  const headers = normalizedHeaders(head?.headers)
  const mismatches = []
  if (Number(headers['content-length']) !== expected.size) mismatches.push('size')
  if (headers['x-cos-meta-sha256'] !== expected.sha256) mismatches.push('sha256')
  if ((headers['content-type'] ?? '').toLowerCase() !== expected.contentType.toLowerCase()) mismatches.push('content-type')
  if (normalizedCacheControl(headers['cache-control']) !== normalizedCacheControl(expected.cacheControl)) {
    mismatches.push('cache-control')
  }
  return mismatches
}

function progressReporter(key, logger, now) {
  let lastPercent = -10
  let lastLoggedAt = 0
  return ({ loaded = 0, total = 0, percent }) => {
    const calculated = total > 0 ? loaded / total : 0
    const progress = Number.isFinite(percent) ? percent : calculated
    const roundedPercent = Math.min(100, Math.max(0, Math.floor(progress * 100)))
    const currentTime = now()
    if (roundedPercent < 100 && roundedPercent < lastPercent + 10 && currentTime - lastLoggedAt < 15_000) return
    lastPercent = roundedPercent
    lastLoggedAt = currentTime
    const loadedMiB = (loaded / MEBIBYTE).toFixed(1)
    const totalMiB = (total / MEBIBYTE).toFixed(1)
    logger.info(`COS upload ${roundedPercent}%: ${key} (${loadedMiB}/${totalMiB} MiB)`)
  }
}

async function readChunk(fileHandle, position, length) {
  const buffer = Buffer.allocUnsafe(length)
  let offset = 0
  while (offset < length) {
    const { bytesRead } = await fileHandle.read(buffer, offset, length - offset, position + offset)
    if (bytesRead === 0) throw new Error(`Unexpected end of file at byte ${position + offset}`)
    offset += bytesRead
  }
  return buffer
}

async function runConcurrently(count, limit, operation) {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(count, limit) }, async () => {
    while (nextIndex < count) {
      const index = nextIndex
      nextIndex += 1
      await operation(index)
    }
  })
  await Promise.all(workers)
}

export function createCosReleasePublisher({
  cos,
  bucket,
  region,
  publicBaseUrl,
  chunkSize = 8 * MEBIBYTE,
  chunkParallel = 3,
  chunkAttempts = 5,
  fullPublicReadback = true,
  operationAttempts = 3,
  logger = console,
  fetchImpl = globalThis.fetch,
  sleep,
  random,
  now = Date.now,
}) {
  if (!cos) throw new Error('A COS client is required')
  if (!bucket || !region) throw new Error('COS bucket and region are required')
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required for public readback')
  publicObjectUrl(publicBaseUrl, 'health-check', 'configuration')

  const retryOptions = { attempts: operationAttempts, logger, sleep, random }
  const chunkRetryOptions = { attempts: chunkAttempts, logger, sleep, random }

  async function uploadMultipartFile(filePath, key, expected, headers) {
    const initialization = await retryOperation(
      `COS initialize multipart ${key}`,
      () => cos.multipartInit({ Bucket: bucket, Region: region, Key: key, Headers: { ...headers } }),
      retryOptions,
    )
    assertSuccessfulUpload(initialization, key)
    const uploadId = initialization?.UploadId
    if (!uploadId) throw new Error(`COS multipart upload returned no UploadId: ${key}`)

    try {
      const partCount = Math.ceil(expected.size / chunkSize)
      const parts = new Array(partCount)
      const fileHandle = await open(filePath, 'r')
      const reportProgress = progressReporter(key, logger, now)
      let uploadedBytes = 0
      try {
        reportProgress({ loaded: 0, total: expected.size, percent: 0 })
        await runConcurrently(partCount, chunkParallel, async (index) => {
          const partNumber = index + 1
          const position = index * chunkSize
          const length = Math.min(chunkSize, expected.size - position)
          const body = await readChunk(fileHandle, position, length)
          const uploaded = await retryOperation(
            `COS upload part ${partNumber}/${partCount}: ${key}`,
            () => cos.multipartUpload({
              Bucket: bucket,
              Region: region,
              Key: key,
              UploadId: uploadId,
              PartNumber: partNumber,
              Body: body,
              ContentLength: body.length,
              Headers: {},
            }),
            chunkRetryOptions,
          )
          assertSuccessfulUpload(uploaded, key)
          if (!uploaded?.ETag) throw new Error(`COS multipart part returned no ETag: ${key}#${partNumber}`)
          parts[index] = { PartNumber: partNumber, ETag: uploaded.ETag }
          uploadedBytes += body.length
          reportProgress({ loaded: uploadedBytes, total: expected.size, percent: uploadedBytes / expected.size })
        })
      } finally {
        await fileHandle.close()
      }

      const completed = await retryOperation(
        `COS complete multipart ${key}`,
        () => cos.multipartComplete({
          Bucket: bucket,
          Region: region,
          Key: key,
          UploadId: uploadId,
          Parts: parts,
          Headers: {},
        }),
        retryOptions,
      )
      assertSuccessfulUpload(completed, key)
      return completed
    } catch (error) {
      try {
        await retryOperation(
          `COS abort multipart ${key}`,
          () => cos.multipartAbort({ Bucket: bucket, Region: region, Key: key, UploadId: uploadId, Headers: {} }),
          retryOptions,
        )
      } catch (abortError) {
        logger.warn(`COS multipart cleanup failed: ${key} (${abortError instanceof Error ? abortError.message : abortError})`)
      }
      throw error
    }
  }

  async function headObject(key, { optional = false } = {}) {
    try {
      return await retryOperation(
        `COS HEAD ${key}`,
        () => cos.headObject({ Bucket: bucket, Region: region, Key: key }),
        retryOptions,
      )
    } catch (error) {
      if (optional && missingObjectError(error)) return null
      throw error
    }
  }

  async function publicReadback(key, expected) {
    await retryOperation(
      `Public readback ${key}`,
      async (attempt) => {
        const token = `${expected.sha256.slice(0, 16)}-${now()}-${attempt}`
        const response = await fetchImpl(publicObjectUrl(publicBaseUrl, key, token), {
          headers: { 'cache-control': 'no-cache' },
          redirect: 'follow',
        })
        if (!response.ok) {
          await response.body?.cancel?.().catch(() => {})
          const error = new Error(`Public readback returned HTTP ${response.status}: ${key}`)
          error.statusCode = response.status
          throw error
        }
        if (!response.body) throw verificationError(`Public readback returned an empty body: ${key}`)
        const hash = createHash('sha256')
        let size = 0
        for await (const chunk of response.body) {
          const bytes = Buffer.from(chunk)
          size += bytes.length
          hash.update(bytes)
        }
        const sha256 = hash.digest('hex')
        if (size !== expected.size || sha256 !== expected.sha256) {
          throw verificationError(`Public readback content mismatch: ${key}`)
        }
      },
      retryOptions,
    )
    logger.info(`Public download verified: ${key} (${expected.size} bytes)`)
  }

  async function descriptor(filePath, cacheControl) {
    const fileStat = await stat(filePath)
    return expectedDescriptor(filePath, fileStat, await sha256File(filePath), cacheControl)
  }

  async function verifyExistingFile(filePath, key, cacheControl, { requirePublicReadback = true } = {}) {
    const expected = await descriptor(filePath, cacheControl)
    const head = await headObject(key)
    const mismatches = compareHead(head, expected)
    if (mismatches.length) throw verificationError(`COS object verification failed (${mismatches.join(', ')}): ${key}`)
    if (requirePublicReadback) await publicReadback(key, expected)
    logger.info(`COS object verified: ${key} (${expected.size} bytes)`)
    return { ...expected, key, action: 'verified' }
  }

  async function uploadVerifiedFile(
    filePath,
    key,
    cacheControl,
    { immutable = true, requirePublicReadback = fullPublicReadback } = {},
  ) {
    const expected = await descriptor(filePath, cacheControl)
    const existing = await headObject(key, { optional: true })
    if (existing) {
      const mismatches = compareHead(existing, expected)
      if (!mismatches.length) {
        if (requirePublicReadback) await publicReadback(key, expected)
        logger.info(`COS unchanged and verified: ${key} (${expected.size} bytes)`)
        return { ...expected, key, action: 'skipped' }
      }
      if (immutable) {
        throw new Error(`Refusing to overwrite immutable COS object (${mismatches.join(', ')}): ${key}`)
      }
    }

    logger.info(`COS upload starting: ${key} (${expected.size} bytes)`)
    const headers = {
      'Content-Type': expected.contentType,
      'Cache-Control': cacheControl,
      'x-cos-meta-sha256': expected.sha256,
    }
    const result = expected.size > chunkSize
      ? await uploadMultipartFile(filePath, key, expected, headers)
      : await retryOperation(
        `COS upload ${key}`,
        () => cos.uploadFile({
          Bucket: bucket,
          Region: region,
          Key: key,
          FilePath: filePath,
          SliceSize: chunkSize,
          Headers: headers,
          onProgress: progressReporter(key, logger, now),
        }),
        retryOptions,
      )
    assertSuccessfulUpload(result, key)

    const head = await headObject(key)
    const mismatches = compareHead(head, expected)
    if (mismatches.length) throw verificationError(`COS upload verification failed (${mismatches.join(', ')}): ${key}`)
    if (requirePublicReadback) await publicReadback(key, expected)
    logger.info(`COS upload verified: ${key} (${expected.size} bytes)`)
    return { ...expected, key, action: 'uploaded' }
  }

  return {
    publicReadback,
    uploadVerifiedFile,
    verifyExistingFile,
  }
}
