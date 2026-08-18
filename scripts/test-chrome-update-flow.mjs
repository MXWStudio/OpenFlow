import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const extensionRoot = resolve(root, 'extensions/chrome')
const workerSource = readFileSync(resolve(extensionRoot, 'service-worker.js'), 'utf8')
const targetVersion = JSON.parse(readFileSync(resolve(extensionRoot, 'manifest.json'), 'utf8')).version
const workerBytes = Buffer.from(workerSource)
const fileMetadata = {
  path: 'service-worker.js',
  size: workerBytes.length,
  sha256: createHash('sha256').update(workerBytes).digest('hex'),
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value)
}

async function runWorker({
  currentVersion,
  runtimeState,
  status,
  corruptPackage = false,
  acknowledgementResult = { reload: false },
}) {
  const events = []
  const stored = {
    openflowUpdateRuntime: clone(runtimeState),
  }
  const listeners = {}
  const bridgeConfig = {
    schemaVersion: 1,
    extensionId: 'lphkbjbbpafcehckpdminkhidjojmhke',
    host: '127.0.0.1',
    port: 43127,
    token: 'a'.repeat(64),
  }

  const chrome = {
    alarms: {
      create: () => undefined,
      onAlarm: { addListener: (listener) => { listeners.alarm = listener } },
    },
    runtime: {
      id: bridgeConfig.extensionId,
      lastError: undefined,
      getManifest: () => ({ version: currentVersion }),
      getURL: (path) => `chrome-extension://${bridgeConfig.extensionId}/${path}`,
      reload: () => { events.push('runtime.reload') },
      onInstalled: { addListener: (listener) => { listeners.installed = listener } },
      onStartup: { addListener: (listener) => { listeners.startup = listener } },
      onMessage: { addListener: (listener) => { listeners.message = listener } },
    },
    storage: {
      local: {
        get: (key, callback) => callback({ [key]: clone(stored[key]) }),
        set: (value, callback) => {
          Object.assign(stored, clone(value))
          callback()
        },
      },
    },
    tabs: {
      reload: async (tabId) => { events.push(`tab.reload:${tabId}`) },
      onRemoved: { addListener: (listener) => { listeners.removed = listener } },
    },
  }

  const fetch = async (url, options = {}) => {
    const source = String(url)
    if (source.startsWith('chrome-extension://')) {
      const path = source.split('/').slice(3).join('/').split('?')[0]
      if (path === 'openflow-bridge.json') return jsonResponse(bridgeConfig)
      if (path === 'extension-release.json') {
        return jsonResponse({ schemaVersion: 1, extensionVersion: targetVersion, files: [fileMetadata] })
      }
      if (path === fileMetadata.path) {
        return new Response(corruptPackage ? 'corrupt' : workerBytes)
      }
      return new Response('missing', { status: 404 })
    }
    if (source === `http://127.0.0.1:${bridgeConfig.port}/v1/status`) {
      events.push(`status:${currentVersion}`)
      return jsonResponse(status)
    }
    if (source === `http://127.0.0.1:${bridgeConfig.port}/v1/ack`) {
      const body = JSON.parse(options.body)
      events.push(`ack:${body.status}:${body.version}`)
      return jsonResponse(acknowledgementResult)
    }
    throw new Error(`Unexpected fetch: ${source}`)
  }

  const sandbox = {
    chrome,
    console,
    crypto: webcrypto,
    fetch,
    Response,
    setTimeout: (callback) => {
      callback()
      return 1
    },
    clearTimeout: () => undefined,
  }
  vm.createContext(sandbox)
  vm.runInContext(workerSource, sandbox, { filename: 'service-worker.js' })
  await vm.runInContext('checkForUpdates()', sandbox)
  await Promise.resolve()
  return { events, stored, listeners }
}

const now = Date.now()

const reloadStep = await runWorker({
  currentVersion: '1.2.0',
  runtimeState: { trackedTabs: {}, busyTabs: {}, lastRefreshedVersion: '' },
  status: { pending: true, targetVersion, desktopVersion: '2.5.3', action: 'reload' },
})
assert.deepEqual(reloadStep.events, ['status:1.2.0', 'runtime.reload'])

const acknowledgementStep = await runWorker({
  currentVersion: targetVersion,
  runtimeState: {
    trackedTabs: { 101: now, 202: now - 8 * 24 * 60 * 60 * 1000 },
    busyTabs: {},
    lastRefreshedVersion: '',
  },
  status: { pending: true, targetVersion, desktopVersion: '2.5.3', action: 'acknowledge' },
})
assert.deepEqual(acknowledgementStep.events, [
  `status:${targetVersion}`,
  'tab.reload:101',
  `ack:ready:${targetVersion}`,
])
assert.equal(acknowledgementStep.stored.openflowUpdateRuntime.lastRefreshedVersion, targetVersion)
assert.deepEqual(acknowledgementStep.stored.openflowUpdateRuntime.busyTabs, {})
assert.equal(acknowledgementStep.stored.openflowUpdateRuntime.trackedTabs['202'], undefined)

const busyStep = await runWorker({
  currentVersion: '1.2.0',
  runtimeState: { trackedTabs: { 101: now }, busyTabs: { 101: now }, lastRefreshedVersion: '' },
  status: { pending: true, targetVersion, desktopVersion: '2.5.3', action: 'reload' },
})
assert.deepEqual(busyStep.events, [])

const rollbackStep = await runWorker({
  currentVersion: '1.2.0',
  runtimeState: { trackedTabs: {}, busyTabs: {}, lastRefreshedVersion: '' },
  status: { pending: true, targetVersion, desktopVersion: '2.5.3', action: 'reload' },
  corruptPackage: true,
  acknowledgementResult: { reload: true },
})
assert.deepEqual(rollbackStep.events, [
  'status:1.2.0',
  `ack:failed:${targetVersion}`,
  'runtime.reload',
])

console.log(`Chrome update flow checks passed for extension ${targetVersion}.`)
