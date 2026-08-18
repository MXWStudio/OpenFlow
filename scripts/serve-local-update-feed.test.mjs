import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { createLocalUpdateServer } from './serve-local-update-feed.mjs'

test('local update server supports full, head, and byte-range downloads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openflow-local-server-test-'))
  const releaseDirectory = resolve(root, 'releases/v2.5.3')
  await mkdir(releaseDirectory, { recursive: true })
  await writeFile(resolve(releaseDirectory, 'fixture.exe'), '0123456789')
  const requests = []
  const server = createLocalUpdateServer({ rootDirectory: root, onRequest: (request) => requests.push(request) })
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  const address = server.address()
  try {
    assert.ok(address && typeof address === 'object')
    const url = `http://127.0.0.1:${address.port}/releases/v2.5.3/fixture.exe`
    const full = await fetch(url)
    assert.equal(full.status, 200)
    assert.equal(full.headers.get('accept-ranges'), 'bytes')
    assert.equal(await full.text(), '0123456789')

    const head = await fetch(url, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('content-length'), '10')
    assert.equal(await head.text(), '')

    const partial = await fetch(url, { headers: { Range: 'bytes=2-5' } })
    assert.equal(partial.status, 206)
    assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10')
    assert.equal(await partial.text(), '2345')
    assert.equal(requests.some((request) => request.range === 'bytes=2-5'), true)

    const multipart = await fetch(url, { headers: { Range: 'bytes=0-1, 8-9' } })
    assert.equal(multipart.status, 206)
    assert.match(multipart.headers.get('content-type') ?? '', /^multipart\/byteranges; boundary=/)
    const multipartBody = await multipart.text()
    assert.match(multipartBody, /Content-Range: bytes 0-1\/10\r\n\r\n01/)
    assert.match(multipartBody, /Content-Range: bytes 8-9\/10\r\n\r\n89/)
  } finally {
    await new Promise((resolvePromise, rejectPromise) => server.close((error) => error ? rejectPromise(error) : resolvePromise()))
    await rm(root, { recursive: true, force: true })
  }
})
