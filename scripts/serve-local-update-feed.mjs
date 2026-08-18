import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const CONTENT_TYPES = {
  '.blockmap': 'application/octet-stream',
  '.exe': 'application/octet-stream',
  '.json': 'application/json',
  '.yml': 'text/yaml',
  '.zip': 'application/zip',
}

function readOption(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function parseSingleRange(value, size) {
  const match = /^(\d*)-(\d*)$/.exec(value.trim())
  if (!match || (!match[1] && !match[2])) throw new Error('invalid range')
  let start
  let end
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) throw new Error('invalid range')
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
    throw new Error('invalid range')
  }
  return { start, end: Math.min(end, size - 1) }
}

function parseRanges(value, size) {
  if (!value) return []
  const match = /^bytes=(.+)$/.exec(value.trim())
  if (!match) throw new Error('invalid range')
  const ranges = match[1].split(',').map((item) => parseSingleRange(item, size))
  if (ranges.length === 0 || ranges.length > 1000) throw new Error('invalid range')
  return ranges
}

async function pipeRange(response, targetPath, range) {
  await new Promise((resolvePromise, rejectPromise) => {
    const source = createReadStream(targetPath, range)
    source.once('error', rejectPromise)
    source.once('end', resolvePromise)
    source.pipe(response, { end: false })
  })
}

export function createLocalUpdateServer({ rootDirectory, onRequest = () => undefined }) {
  const root = resolve(rootDirectory)
  return createServer(async (request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' })
        response.end()
        return
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const targetPath = resolve(root, relativePath)
      if (targetPath !== root && !targetPath.startsWith(`${root}${sep}`)) {
        response.writeHead(403)
        response.end('forbidden')
        return
      }
      const file = await stat(targetPath)
      if (!file.isFile()) throw new Error('not a file')

      let ranges = []
      try {
        ranges = parseRanges(request.headers.range, file.size)
      } catch {
        response.writeHead(416, { 'Content-Range': `bytes */${file.size}` })
        response.end()
        return
      }
      const range = ranges.length === 1 ? ranges[0] : null
      const start = range?.start ?? 0
      const end = range?.end ?? file.size - 1
      const length = end - start + 1
      const headers = {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'Content-Type': CONTENT_TYPES[extname(targetPath)] ?? 'application/octet-stream',
      }
      if (ranges.length === 0 || range) headers['Content-Length'] = length
      if (range) headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`
      const boundary = `openflow-${Date.now().toString(16)}`
      if (ranges.length > 1) headers['Content-Type'] = `multipart/byteranges; boundary=${boundary}`
      response.writeHead(ranges.length > 0 ? 206 : 200, headers)
      onRequest({ method: request.method, path: url.pathname, range: request.headers.range ?? '' })
      if (request.method === 'HEAD') {
        response.end()
        return
      }
      if (ranges.length <= 1) {
        createReadStream(targetPath, { start, end }).pipe(response)
        return
      }
      for (const item of ranges) {
        response.write(`--${boundary}\r\n`)
        response.write(`Content-Type: ${CONTENT_TYPES[extname(targetPath)] ?? 'application/octet-stream'}\r\n`)
        response.write(`Content-Range: bytes ${item.start}-${item.end}/${file.size}\r\n\r\n`)
        await pipeRange(response, targetPath, item)
        response.write('\r\n')
      }
      response.end(`--${boundary}--\r\n`)
    } catch {
      response.writeHead(404)
      response.end('not found')
    }
  })
}

async function runCli() {
  const args = process.argv.slice(2)
  const rootDirectory = readOption(args, '--root')
  const port = Number(readOption(args, '--port'))
  if (!rootDirectory || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('Usage: node scripts/serve-local-update-feed.mjs --root <directory> --port <port>')
  }
  const server = createLocalUpdateServer({
    rootDirectory,
    onRequest: ({ method, path, range }) => console.log(`${method} ${path}${range ? ` ${range}` : ''}`),
  })
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise)
    server.listen(port, '127.0.0.1', resolvePromise)
  })
  console.log(`Local OpenFlow update feed ready at http://127.0.0.1:${port}/`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
