import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { basename, resolve } from 'node:path'
import { NsisUpdater, type UpdateDownloadedEvent } from 'electron-updater'
import fs from 'fs-extra'
import type { DiagnosticEventInput, DiagnosticsViewState } from '../shared/diagnosticsContract'
import type { ExtensionUpdateViewState, SignedDesktopRelease, UpdateViewState } from '../shared/updateContract'
import { compareReleaseVersions, verifySignedReleaseEnvelope } from './releaseMetadata'

const INITIAL_CHECK_DELAY_MS = 30 * 1000
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const RELEASE_RESPONSE_LIMIT = 256 * 1024
const CRITICAL_AUTO_INSTALL_CHECK_INTERVAL_MS = 30 * 1000
const DEFAULT_MANUAL_DOWNLOAD_URL = 'https://github.com/MXWStudio/OpenFlow/releases/latest'

interface UpdateConfiguration {
  schemaVersion: 1
  channelUrl: string
  releasePublicKey: string
}

export interface DesktopUpdateManagerOptions {
  getWindow: () => BrowserWindow | null
  getExtensionState: () => ExtensionUpdateViewState
  getDiagnosticsState?: () => DiagnosticsViewState
  extensionPath: string
  canAutoInstallCritical?: () => boolean | Promise<boolean>
  prepareForInstall?: () => Promise<void>
  onStateChange?: (state: UpdateViewState) => void
  captureDiagnostic?: (event: DiagnosticEventInput) => void | Promise<void>
  manualDownloadUrl?: string
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function sha512File(filePath: string): Promise<{ size: number; sha512: string }> {
  const hash = createHash('sha512')
  let size = 0
  for await (const chunk of createReadStream(filePath)) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    hash.update(bytes)
  }
  return { size, sha512: hash.digest('base64') }
}

export class DesktopUpdateManager {
  private configuration: UpdateConfiguration | null = null
  private signedRelease: SignedDesktopRelease | null = null
  private updater: NsisUpdater | null = null
  private checking: Promise<UpdateViewState> | null = null
  private initialTimer: NodeJS.Timeout | null = null
  private periodicTimer: NodeJS.Timeout | null = null
  private criticalAutoInstallTimer: NodeJS.Timeout | null = null
  private handlersRegistered = false
  private installing = false
  private desktopState: UpdateViewState['desktop'] = {
    status: 'disabled',
    currentVersion: app.getVersion(),
    message: '正在读取更新配置',
  }

  constructor(private readonly options: DesktopUpdateManagerOptions) {}

  async start(): Promise<void> {
    this.registerIpcHandlers()
    try {
      this.configuration = await this.readConfiguration()
      if (!this.configuration.channelUrl || !this.configuration.releasePublicKey) {
        this.patchDesktopState({ status: 'disabled', message: '此安装包未配置腾讯云更新线路' })
        return
      }
      if (!app.isPackaged) {
        this.patchDesktopState({ status: 'disabled', message: '开发模式不会下载安装包更新' })
        return
      }
      this.patchDesktopState({ status: 'idle', message: '已连接腾讯云更新线路' })
      this.initialTimer = setTimeout(() => void this.checkForUpdates(), INITIAL_CHECK_DELAY_MS)
      this.periodicTimer = setInterval(() => void this.checkForUpdates(), PERIODIC_CHECK_INTERVAL_MS)
    } catch (error) {
      this.patchDesktopState({ status: 'error', message: `更新配置读取失败：${toMessage(error)}` })
    }
  }

  stop(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer)
    if (this.periodicTimer) clearInterval(this.periodicTimer)
    if (this.criticalAutoInstallTimer) clearInterval(this.criticalAutoInstallTimer)
    this.initialTimer = null
    this.periodicTimer = null
    this.criticalAutoInstallTimer = null
  }

  getState(): UpdateViewState {
    return {
      desktop: { ...this.desktopState },
      extension: this.options.getExtensionState(),
      diagnostics: this.options.getDiagnosticsState?.() ?? {
        status: 'local-only',
        pendingCount: 0,
        uploadIntervalMinutes: 30,
        sentryConfigured: false,
        message: '自动诊断正在准备',
      },
      channelConfigured: Boolean(this.configuration?.channelUrl && this.configuration?.releasePublicKey),
    }
  }

  notifyExtensionStateChanged(): void {
    this.broadcastState()
  }

  notifyDiagnosticsStateChanged(): void {
    this.broadcastState()
  }

  async checkForUpdates(): Promise<UpdateViewState> {
    if (this.checking) return this.checking
    this.checking = this.performCheck().finally(() => {
      this.checking = null
    })
    return this.checking
  }

  async installDownloadedUpdate(): Promise<boolean> {
    if (!this.updater || this.desktopState.status !== 'downloaded' || this.installing) return false
    this.installing = true
    try {
      await this.options.prepareForInstall?.()
      ;(app as typeof app & { isQuitting?: boolean }).isQuitting = true
      setImmediate(() => this.updater?.quitAndInstall(false, true))
      return true
    } catch (error) {
      this.installing = false
      this.patchDesktopState({ message: `安装前保存失败：${toMessage(error)}` })
      return false
    }
  }

  private async performCheck(): Promise<UpdateViewState> {
    if (!this.configuration?.channelUrl || !this.configuration.releasePublicKey) return this.getState()
    if (!app.isPackaged) return this.getState()

    this.patchDesktopState({
      status: 'checking',
      progressPercent: undefined,
      message: '正在检查腾讯云上的新版本',
    })
    try {
      const response = await fetch(this.configuration.channelUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error(`更新线路返回 ${response.status}`)
      const source = await response.text()
      if (Buffer.byteLength(source) > RELEASE_RESPONSE_LIMIT) throw new Error('更新信息大小异常')
      const envelope = JSON.parse(source) as unknown
      const release = verifySignedReleaseEnvelope(envelope, this.configuration.releasePublicKey)
      this.signedRelease = release
      const checkedAt = new Date().toISOString()
      if (compareReleaseVersions(release.version, app.getVersion()) <= 0) {
        this.patchDesktopState({
          status: 'up-to-date',
          availableVersion: release.version,
          lastCheckedAt: checkedAt,
          message: '当前已经是最新版本',
        })
        return this.getState()
      }

      this.patchDesktopState({
        status: 'available',
        availableVersion: release.version,
        lastCheckedAt: checkedAt,
        updateType: release.updateType,
        installBehavior: release.updateType === 'critical' ? 'automatic-when-idle' : 'manual',
        message: `发现新版本 ${release.version}，正在自动下载`,
      })
      await this.startUpdater(release)
    } catch (error) {
      this.patchDesktopState({
        status: 'error',
        lastCheckedAt: new Date().toISOString(),
        message: `检查更新失败：${toMessage(error)}`,
      })
    }
    return this.getState()
  }

  private async startUpdater(release: SignedDesktopRelease): Promise<void> {
    this.updater?.removeAllListeners()
    const updater = new NsisUpdater({ provider: 'generic', url: release.feedUrl })
    this.updater = updater
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = false
    updater.allowDowngrade = false
    updater.disableWebInstaller = true

    updater.on('error', (error) => {
      this.stopCriticalAutoInstallTimer()
      this.patchDesktopState({ status: 'error', message: `下载安装包失败：${toMessage(error)}` })
    })
    updater.on('update-available', (info) => {
      if (info.version !== release.version) {
        updater.autoDownload = false
        this.patchDesktopState({ status: 'error', message: '腾讯云版本信息前后不一致，已停止更新' })
        return
      }
      this.patchDesktopState({
        status: 'downloading',
        updateType: release.updateType,
        installBehavior: release.updateType === 'critical' ? 'automatic-when-idle' : 'manual',
        message: `正在后台下载版本 ${info.version}`,
      })
    })
    updater.on('update-not-available', () => {
      this.patchDesktopState({ status: 'up-to-date', message: '当前已经是最新版本' })
    })
    updater.on('download-progress', (progress) => {
      this.patchDesktopState({
        status: 'downloading',
        progressPercent: Math.max(0, Math.min(100, progress.percent)),
        message: `正在下载新版本，已完成 ${Math.round(progress.percent)}%`,
      })
    })
    updater.on('update-downloaded', (event) => {
      void this.handleDownloadedUpdate(event, release)
    })
    await updater.checkForUpdates()
  }

  private async handleDownloadedUpdate(event: UpdateDownloadedEvent, release: SignedDesktopRelease): Promise<void> {
    try {
      if (basename(event.downloadedFile) !== release.desktop.installer) {
        throw new Error('安装包文件名与已签名发布信息不一致')
      }
      const verified = await sha512File(event.downloadedFile)
      if (verified.size !== release.desktop.size || verified.sha512 !== release.desktop.sha512) {
        throw new Error('安装包完整性校验失败')
      }
      if (!this.updater) throw new Error('更新器状态已失效')
      this.updater.autoInstallOnAppQuit = false
      this.patchDesktopState({
        status: 'downloaded',
        progressPercent: 100,
        updateType: release.updateType,
        installBehavior: release.updateType === 'critical' ? 'automatic-when-idle' : 'manual',
        message: release.updateType === 'critical'
          ? `紧急修复 ${release.version} 已准备好，将在软件安全空闲时自动安装`
          : `版本 ${release.version} 已准备好，请在设置中手动安装`,
      })
      if (release.updateType === 'critical') this.startCriticalAutoInstallTimer()
    } catch (error) {
      this.stopCriticalAutoInstallTimer()
      this.updater && (this.updater.autoInstallOnAppQuit = false)
      this.patchDesktopState({ status: 'error', message: `安装包验证失败：${toMessage(error)}` })
      await fs.remove(event.downloadedFile).catch(() => undefined)
    }
  }

  private async readConfiguration(): Promise<UpdateConfiguration> {
    const configPath = app.isPackaged
      ? resolve(process.resourcesPath, 'update-config.json')
      : resolve(app.getAppPath(), '.openflow-build/update-config.json')
    if (!await fs.pathExists(configPath)) return { schemaVersion: 1, channelUrl: '', releasePublicKey: '' }
    const value = await fs.readJson(configPath) as Partial<UpdateConfiguration>
    if (value.schemaVersion !== 1) throw new Error('不支持的更新配置')
    return {
      schemaVersion: 1,
      channelUrl: typeof value.channelUrl === 'string' ? value.channelUrl : '',
      releasePublicKey: typeof value.releasePublicKey === 'string' ? value.releasePublicKey : '',
    }
  }

  private registerIpcHandlers(): void {
    if (this.handlersRegistered) return
    this.handlersRegistered = true
    ipcMain.handle('updates:get-state', () => this.getState())
    ipcMain.handle('updates:check', () => this.checkForUpdates())
    ipcMain.handle('updates:install', () => this.installDownloadedUpdate())
    ipcMain.handle('updates:open-extension-folder', () => shell.openPath(this.options.extensionPath))
    ipcMain.handle('updates:open-manual-download', () => shell.openExternal(
      this.options.manualDownloadUrl || DEFAULT_MANUAL_DOWNLOAD_URL,
    ))
  }

  private startCriticalAutoInstallTimer(): void {
    this.stopCriticalAutoInstallTimer()
    this.criticalAutoInstallTimer = setInterval(
      () => void this.tryInstallCriticalUpdate(),
      CRITICAL_AUTO_INSTALL_CHECK_INTERVAL_MS,
    )
  }

  private stopCriticalAutoInstallTimer(): void {
    if (this.criticalAutoInstallTimer) clearInterval(this.criticalAutoInstallTimer)
    this.criticalAutoInstallTimer = null
  }

  private async tryInstallCriticalUpdate(): Promise<void> {
    if (this.desktopState.status !== 'downloaded' || this.desktopState.updateType !== 'critical') {
      this.stopCriticalAutoInstallTimer()
      return
    }
    if (!await this.options.canAutoInstallCritical?.()) return
    this.stopCriticalAutoInstallTimer()
    await this.installDownloadedUpdate()
  }

  private patchDesktopState(patch: Partial<UpdateViewState['desktop']>): void {
    const previousStatus = this.desktopState.status
    const previousMessage = this.desktopState.message
    this.desktopState = { ...this.desktopState, ...patch }
    if (
      this.desktopState.status === 'error' &&
      (previousStatus !== 'error' || previousMessage !== this.desktopState.message)
    ) {
      void this.options.captureDiagnostic?.({
        type: 'desktop.update_error',
        severity: 'error',
        payload: {
          message: this.desktopState.message,
          currentVersion: this.desktopState.currentVersion,
          availableVersion: this.desktopState.availableVersion,
          updateType: this.desktopState.updateType,
        },
      })
    }
    this.broadcastState()
  }

  private broadcastState(): void {
    const state = this.getState()
    this.options.onStateChange?.(state)
    const window = this.options.getWindow()
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return
    window.webContents.send('updates:state', state)
  }
}
