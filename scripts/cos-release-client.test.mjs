import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createConfiguredCosClient,
  createCosReleasePublisher,
  retryOperation,
} from './cos-release-client.mjs'

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

function quietLogger() {
  const messages = []
  return {
    messages,
    info: (message) => messages.push(message),
    warn: (message) => messages.push(message),
  }
}

test('COS client enables bounded multipart retries, MD5 checking, and strict HTTPS', () => {
  let receivedOptions
  class FakeCos {
    constructor(options) {
      receivedOptions = options
    }
  }

  const configuration = createConfiguredCosClient({
    TENCENT_COS_SECRET_ID: 'secret-id',
    TENCENT_COS_SECRET_KEY: 'secret-key',
    OPENFLOW_COS_CHUNK_SIZE_MB: '12',
    OPENFLOW_COS_CHUNK_PARALLEL: '4',
    OPENFLOW_COS_CHUNK_RETRIES: '5',
    OPENFLOW_COS_OPERATION_ATTEMPTS: '4',
    OPENFLOW_COS_FULL_READBACK: 'true',
  }, FakeCos)

  assert.equal(receivedOptions.ChunkSize, 12 * 1024 * 1024)
  assert.equal(receivedOptions.SliceSize, 12 * 1024 * 1024)
  assert.equal(receivedOptions.ChunkParallelLimit, 4)
  assert.equal(receivedOptions.ChunkRetryTimes, 5)
  assert.equal(receivedOptions.UploadCheckContentMd5, true)
  assert.equal(receivedOptions.KeepAlive, true)
  assert.equal(receivedOptions.StrictSsl, true)
  assert.equal(configuration.operationAttempts, 4)
  assert.equal(configuration.fullPublicReadback, true)
})

test('request wrapper retries temporary failures but does not retry denied access', async () => {
  const logger = quietLogger()
  let attempts = 0
  const result = await retryOperation('temporary operation', async () => {
    attempts += 1
    if (attempts < 3) {
      const error = new Error('connection reset')
      error.code = 'ECONNRESET'
      throw error
    }
    return 'ok'
  }, { attempts: 3, logger, sleep: async () => {}, random: () => 0.5 })

  assert.equal(result, 'ok')
  assert.equal(attempts, 3)
  assert.equal(logger.messages.filter((message) => message.includes('retrying')).length, 2)

  let deniedAttempts = 0
  await assert.rejects(
    retryOperation('denied operation', async () => {
      deniedAttempts += 1
      const error = new Error('Access denied')
      error.code = 'AccessDenied'
      error.statusCode = 403
      throw error
    }, { attempts: 3, logger, sleep: async () => {} }),
    /Access denied/,
  )
  assert.equal(deniedAttempts, 1)
})

async function withFixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'openflow-cos-publisher-'))
  const filePath = join(directory, 'release.json')
  const fileBytes = Buffer.from('{"version":"2.5.0"}\n')
  await writeFile(filePath, fileBytes)
  try {
    await run({ filePath, fileBytes })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function publisherFixture({ fileBytes, existingObject, publicBytes = fileBytes, operationAttempts = 3 } = {}) {
  const objects = new Map()
  if (existingObject) objects.set('openflow/release.json', existingObject)
  let uploadCalls = 0
  let publicCalls = 0
  const cos = {
    async headObject({ Key }) {
      const object = objects.get(Key)
      if (!object) {
        const error = new Error('Not found')
        error.code = 'NoSuchKey'
        error.statusCode = 404
        throw error
      }
      return { headers: object.headers }
    },
    async uploadFile(params) {
      uploadCalls += 1
      const bytes = await readFile(params.FilePath)
      objects.set(params.Key, {
        bytes,
        headers: {
          ...params.Headers,
          'content-length': String(bytes.length),
        },
      })
      params.onProgress?.({ loaded: bytes.length, total: bytes.length, percent: 1, speed: bytes.length })
      return { statusCode: 200 }
    },
  }
  const logger = quietLogger()
  const publisher = createCosReleasePublisher({
    cos,
    bucket: 'openflow-updates-123',
    region: 'ap-guangzhou',
    publicBaseUrl: 'https://downloads.example.test/base',
    operationAttempts,
    logger,
    sleep: async () => {},
    random: () => 0.5,
    now: () => 1234,
    fetchImpl: async (url) => {
      publicCalls += 1
      const key = new URL(url).pathname.replace(/^\/base\//, '').split('/').map(decodeURIComponent).join('/')
      if (!objects.has(key)) return new Response('missing', { status: 404 })
      return new Response(publicBytes, { status: 200 })
    },
  })
  return {
    logger,
    objects,
    publisher,
    uploadCalls: () => uploadCalls,
    publicCalls: () => publicCalls,
  }
}

test('publisher uploads, checks COS headers, then hashes the public download', async () => {
  await withFixture(async ({ filePath, fileBytes }) => {
    const fixture = publisherFixture({ fileBytes })
    const result = await fixture.publisher.uploadVerifiedFile(
      filePath,
      'openflow/release.json',
      CACHE_CONTROL,
    )

    assert.equal(result.action, 'uploaded')
    assert.equal(fixture.uploadCalls(), 1)
    assert.equal(fixture.publicCalls(), 1)
    assert.match(fixture.objects.get('openflow/release.json').headers['x-cos-meta-sha256'], /^[a-f0-9]{64}$/)
    assert.ok(fixture.logger.messages.some((message) => message.includes('COS upload 100%')))
    assert.ok(fixture.logger.messages.some((message) => message.includes('Public download verified')))
  })
})

test('publisher skips an identical immutable object and refuses a conflicting one', async () => {
  await withFixture(async ({ filePath, fileBytes }) => {
    const first = publisherFixture({ fileBytes })
    await first.publisher.uploadVerifiedFile(filePath, 'openflow/release.json', CACHE_CONTROL)
    const stored = first.objects.get('openflow/release.json')

    const identical = publisherFixture({ fileBytes, existingObject: stored })
    const result = await identical.publisher.uploadVerifiedFile(filePath, 'openflow/release.json', CACHE_CONTROL)
    assert.equal(result.action, 'skipped')
    assert.equal(identical.uploadCalls(), 0)

    const conflicting = publisherFixture({
      fileBytes,
      existingObject: {
        bytes: Buffer.from('different'),
        headers: {
          'content-length': '9',
          'content-type': 'application/json; charset=utf-8',
          'cache-control': CACHE_CONTROL,
          'x-cos-meta-sha256': '0'.repeat(64),
        },
      },
    })
    await assert.rejects(
      conflicting.publisher.uploadVerifiedFile(filePath, 'openflow/release.json', CACHE_CONTROL),
      /Refusing to overwrite immutable COS object/,
    )
    assert.equal(conflicting.uploadCalls(), 0)
  })
})

test('publisher can replace only the mutable stable pointer and verifies the replacement', async () => {
  await withFixture(async ({ filePath, fileBytes }) => {
    const fixture = publisherFixture({
      fileBytes,
      existingObject: {
        bytes: Buffer.from('old release'),
        headers: {
          'content-length': '11',
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'x-cos-meta-sha256': '0'.repeat(64),
        },
      },
    })
    const result = await fixture.publisher.uploadVerifiedFile(
      filePath,
      'openflow/release.json',
      'no-cache, no-store, must-revalidate',
      { immutable: false },
    )
    assert.equal(result.action, 'uploaded')
    assert.equal(fixture.uploadCalls(), 1)
    assert.deepEqual(fixture.objects.get('openflow/release.json').bytes, fileBytes)
  })
})

test('publisher retries and rejects a public download whose bytes do not match', async () => {
  await withFixture(async ({ filePath, fileBytes }) => {
    const fixture = publisherFixture({
      fileBytes,
      publicBytes: Buffer.from('tampered'),
      operationAttempts: 2,
    })
    await assert.rejects(
      fixture.publisher.uploadVerifiedFile(filePath, 'openflow/release.json', CACHE_CONTROL),
      /Public readback content mismatch/,
    )
    assert.equal(fixture.uploadCalls(), 1)
    assert.equal(fixture.publicCalls(), 2)
  })
})
