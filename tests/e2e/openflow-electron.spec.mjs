import { expect, test, _electron as electron } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const executablePath = process.env.OPENFLOW_E2E_EXECUTABLE_PATH || ''
const expectedChannel = process.env.OPENFLOW_E2E_EXPECT_CHANNEL || 'dev'
const expectedBatch = process.env.OPENFLOW_E2E_EXPECT_DEV_BATCH || ''
const expectedExistingMarker = process.env.OPENFLOW_E2E_EXPECT_EXISTING_MARKER || ''
const expectedVersion = process.env.OPENFLOW_E2E_EXPECT_VERSION || ''
const markerToWrite = process.env.OPENFLOW_E2E_WRITE_MARKER || `acceptance-${Date.now()}`
const expectedUserDataDirectory = {
  dev: 'openflow-studio-dev',
  candidate: 'openflow-studio-candidate',
  stable: 'openflow-studio',
}[expectedChannel]
const launchedApplications = new Set()

async function launchApplication(userDataRoot = '') {
  const env = {
    ...process.env,
    OPENFLOW_E2E: '1',
    ...(userDataRoot ? { OPENFLOW_E2E_USER_DATA_ROOT: userDataRoot } : {}),
  }
  const application = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? [] : ['.'],
    cwd: root,
    env,
  })
  launchedApplications.add(application)
  return application
}

async function quitApplication(application) {
  await application.evaluate(({ app }) => {
    app.isQuitting = true
    app.quit()
  }).catch(() => undefined)
  await application.close().catch(() => undefined)
  launchedApplications.delete(application)
}

test.afterEach(async () => {
  for (const application of launchedApplications) await quitApplication(application)
})

test('Electron launches with isolated identity, navigation and persistent local data', async () => {
  const isolatedRoot = executablePath ? '' : await mkdtemp(join(tmpdir(), 'OpenFlow-E2E-'))
  let application = await launchApplication(isolatedRoot)
  let window = await application.firstWindow()
  await expect(window.locator('[data-openflow-app-ready="true"]')).toBeVisible()

  const mainIdentity = await application.evaluate(({ app }) => ({
    name: app.getName(),
    version: app.getVersion(),
    userData: app.getPath('userData'),
    executablePath: process.execPath,
  }))
  const buildInfo = await window.evaluate(() => window.electronAPI.app.getBuildInfo())
  expect(buildInfo.channel).toBe(expectedChannel)
  expect(buildInfo.userDataDirectory).toBe(expectedUserDataDirectory)
  expect(mainIdentity.name).toBe(buildInfo.appName)
  await expect(window).toHaveTitle(buildInfo.appName)
  if (expectedVersion) expect(mainIdentity.version).toBe(expectedVersion)
  if (isolatedRoot) {
    expect(mainIdentity.userData).toBe(isolatedRoot)
  }
  else {
    expect(mainIdentity.userData.toLowerCase()).toContain(expectedUserDataDirectory.toLowerCase())
  }
  if (executablePath) expect(mainIdentity.executablePath.toLowerCase()).toBe(executablePath.toLowerCase())

  for (const label of ['整理', '格式处理', '日常']) {
    await window.getByRole('button', { name: label, exact: true }).click()
    await expect(window.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
  }

  if (expectedBatch) {
    await expect(window.locator('[data-openflow-dev-batch]')).toHaveText(expectedBatch)
  }
  else {
    await expect(window.locator('[data-openflow-dev-batch]')).toHaveCount(0)
  }

  if (expectedExistingMarker) {
    expect(await window.evaluate(() => window.electronAPI.store.get('candidateAcceptanceMarker'))).toBe(expectedExistingMarker)
  }
  await window.evaluate((value) => window.electronAPI.store.set('candidateAcceptanceMarker', value), markerToWrite)
  expect(await window.evaluate(() => window.electronAPI.store.get('candidateAcceptanceMarker'))).toBe(markerToWrite)
  await quitApplication(application)

  application = await launchApplication(isolatedRoot)
  window = await application.firstWindow()
  await expect(window.locator('[data-openflow-app-ready="true"]')).toBeVisible()
  expect(await window.evaluate(() => window.electronAPI.store.get('candidateAcceptanceMarker'))).toBe(markerToWrite)
  await quitApplication(application)
})
