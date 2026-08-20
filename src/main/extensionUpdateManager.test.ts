import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import fs from 'fs-extra'
import { ExtensionUpdateManager } from './extensionUpdateManager.ts'
import { validateExtensionPackage } from './extensionInstaller.ts'

const EXTENSION_ID = 'lphkbjbbpafcehckpdminkhidjojmhke'

async function createPackage(root: string, version: string, workerText: string): Promise<void> {
  await fs.ensureDir(root)
  const files = new Map([
    ['manifest.json', JSON.stringify({ manifest_version: 3, name: 'OpenFlow', version })],
    ['service-worker.js', workerText],
  ])
  for (const [relativePath, content] of files) await fs.outputFile(join(root, relativePath), content)
  await fs.writeJson(join(root, 'extension-release.json'), {
    schemaVersion: 1,
    extensionVersion: version,
    files: [...files].map(([path, content]) => ({
      path,
      size: Buffer.byteLength(content),
      sha256: createHash('sha256').update(content).digest('hex'),
    })),
  })
}

async function bridgeRequest(
  targetRoot: string,
  path: string,
  version: string,
  body?: unknown,
): Promise<Response> {
  const config = await fs.readJson(join(targetRoot, 'openflow-bridge.json')) as { port: number, token: string }
  return fetch(`http://127.0.0.1:${config.port}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Origin: `chrome-extension://${EXTENSION_ID}`,
      'Content-Type': 'application/json',
      'X-OpenFlow-Extension-Version': version,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function createManagerRoot(timeoutMs = 2_000) {
  const root = mkdtempSync(join(tmpdir(), 'openflow-extension-manager-'))
  const sourceRoot = join(root, 'source')
  const targetRoot = join(root, 'installed')
  const statePath = join(root, 'pending.json')
  await createPackage(targetRoot, '1.2.0', 'old worker')
  await createPackage(sourceRoot, '1.2.1', 'new worker')
  const manager = new ExtensionUpdateManager({
    sourceRoot,
    targetRoot,
    statePath,
    getDesktopVersion: () => '2.5.3',
    acknowledgementTimeoutMs: timeoutMs,
  })
  await manager.start()
  return { root, sourceRoot, targetRoot, statePath, manager }
}

test('desktop and Chrome complete a verified extension update handshake', async () => {
  const fixture = await createManagerRoot()
  try {
    assert.equal(fixture.manager.getState().status, 'waiting-reload')
    assert.equal(fixture.manager.getState().installedVersion, '1.2.1')
    assert.equal((await validateExtensionPackage(`${fixture.targetRoot}.backup`)).extensionVersion, '1.2.0')

    const reloadStatus = await bridgeRequest(fixture.targetRoot, '/v1/status', '1.2.0')
    assert.equal(reloadStatus.status, 200)
    assert.deepEqual(await reloadStatus.json(), {
      pending: true,
      targetVersion: '1.2.1',
      desktopVersion: '2.5.3',
      action: 'reload',
      message: '桌面端已准备好新版扩展',
      protocols: { updates: 1, diagnostics: 1, extractions: 2 },
    })
    assert.equal((await fs.readJson(join(fixture.targetRoot, 'openflow-bridge.json'))).extractionProtocolVersion, 2)

    const acknowledgeStatus = await bridgeRequest(fixture.targetRoot, '/v1/status', '1.2.1')
    assert.equal((await acknowledgeStatus.json()).action, 'acknowledge')
    const acknowledgement = await bridgeRequest(fixture.targetRoot, '/v1/ack', '1.2.1', {
      version: '1.2.1',
      status: 'ready',
    })
    assert.deepEqual(await acknowledgement.json(), { reload: false })
    assert.equal(fixture.manager.getState().status, 'ready')
    assert.equal(await fs.pathExists(`${fixture.targetRoot}.backup`), false)
    assert.equal(await fs.pathExists(fixture.statePath), false)
  } finally {
    await fixture.manager.stop()
    await fs.remove(fixture.root)
  }
})

test('same-version content changes are installed and require a reload handshake', async () => {
  const root = mkdtempSync(join(tmpdir(), 'openflow-extension-manager-same-version-'))
  const sourceRoot = join(root, 'source')
  const targetRoot = join(root, 'installed')
  const statePath = join(root, 'pending.json')
  await createPackage(targetRoot, '2.5.3', 'old same-version worker')
  await createPackage(sourceRoot, '2.5.3', 'new same-version worker')
  const manager = new ExtensionUpdateManager({
    sourceRoot,
    targetRoot,
    statePath,
    getDesktopVersion: () => '2.5.3',
  })
  try {
    await manager.start()
    assert.equal(manager.getState().status, 'waiting-reload')
    assert.equal(await fs.readFile(join(targetRoot, 'service-worker.js'), 'utf8'), 'new same-version worker')
    assert.equal(await fs.readFile(join(`${targetRoot}.backup`, 'service-worker.js'), 'utf8'), 'old same-version worker')

    const statusResponse = await bridgeRequest(targetRoot, '/v1/status', '2.5.3')
    const status = await statusResponse.json() as { action: string; reloadToken?: string }
    assert.equal(status.action, 'reload')
    assert.match(status.reloadToken ?? '', /^[0-9a-f-]{36}$/i)

    const acknowledgement = await bridgeRequest(targetRoot, '/v1/ack', '2.5.3', {
      version: '2.5.3',
      status: 'ready',
    })
    assert.deepEqual(await acknowledgement.json(), { reload: false })
    assert.equal(manager.getState().status, 'ready')
    assert.equal(await fs.pathExists(`${targetRoot}.backup`), false)
  } finally {
    await manager.stop()
    await fs.remove(root)
  }
})

test('extension self-check failure restores the previous verified version', async () => {
  const fixture = await createManagerRoot()
  try {
    const acknowledgement = await bridgeRequest(fixture.targetRoot, '/v1/ack', '1.2.1', {
      version: '1.2.1',
      status: 'failed',
      reason: 'candidate package failed self-check',
    })
    assert.deepEqual(await acknowledgement.json(), { reload: true })
    assert.equal(fixture.manager.getState().status, 'rolled-back')
    assert.equal(fixture.manager.getState().installedVersion, '1.2.0')
    assert.equal((await validateExtensionPackage(fixture.targetRoot)).extensionVersion, '1.2.0')
    assert.equal(await fs.pathExists(fixture.statePath), false)
  } finally {
    await fixture.manager.stop()
    await fs.remove(fixture.root)
  }
})

test('an unacknowledged extension update rolls back after the deadline', async () => {
  const fixture = await createManagerRoot(20)
  try {
    const status = await bridgeRequest(fixture.targetRoot, '/v1/status', '1.2.0')
    assert.equal(status.status, 200)
    await new Promise((resolve) => setTimeout(resolve, 80))
    assert.equal(fixture.manager.getState().status, 'rolled-back')
    assert.equal(fixture.manager.getState().installedVersion, '1.2.0')
    assert.equal((await validateExtensionPackage(fixture.targetRoot)).extensionVersion, '1.2.0')
  } finally {
    await fixture.manager.stop()
    await fs.remove(fixture.root)
  }
})
