import { dirname, resolve } from 'node:path'
import fs from 'fs-extra'
import type { DiagnosticEventInput } from '../shared/diagnosticsContract'
import type { ExtensionUpdateViewState } from '../shared/updateContract'
import {
  finalizeExtensionInstall,
  installExtensionTransaction,
  rollbackExtensionInstall,
  validateExtensionPackage,
} from './extensionInstaller.ts'
import {
  LocalUpdateBridge,
  type ExtensionBridgeAcknowledgement,
  type ExtensionBridgeStatus,
} from './localUpdateBridge.ts'

const EXTENSION_ID = 'lphkbjbbpafcehckpdminkhidjojmhke'
const ACK_TIMEOUT_MS = 2 * 60 * 1000

interface PendingExtensionUpdate {
  schemaVersion: 1
  targetVersion: string
  previousVersion?: string
  backupRoot?: string
  installedAt: string
  acknowledgementDeadline?: string
}

export interface ExtensionUpdateManagerOptions {
  sourceRoot: string
  targetRoot: string
  statePath: string
  getDesktopVersion: () => string
  acknowledgementTimeoutMs?: number
  onStateChange?: (state: ExtensionUpdateViewState) => void
  captureDiagnostics?: (events: DiagnosticEventInput[], extensionVersion: string) => Promise<{ accepted: number }>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class ExtensionUpdateManager {
  private readonly options: ExtensionUpdateManagerOptions
  private state: ExtensionUpdateViewState
  private pending: PendingExtensionUpdate | null = null
  private bridge: LocalUpdateBridge | null = null
  private bridgeConfig: { port: number; token: string } | null = null
  private timeout: NodeJS.Timeout | null = null

  constructor(options: ExtensionUpdateManagerOptions) {
    this.options = options
    this.state = {
      status: 'preparing',
      bundledVersion: '',
      installedVersion: '',
      extensionPath: options.targetRoot,
    }
  }

  getState(): ExtensionUpdateViewState {
    return { ...this.state }
  }

  getPath(): string {
    return this.options.targetRoot
  }

  async start(): Promise<void> {
    try {
      const sourceManifest = await validateExtensionPackage(this.options.sourceRoot)
      this.patchState({ bundledVersion: sourceManifest.extensionVersion })
      await this.restorePendingState()

      if (!this.pending) {
        const orphanedBackup = `${this.options.targetRoot}.backup`
        if (await fs.pathExists(orphanedBackup) && await fs.pathExists(this.options.targetRoot)) {
          try {
            const installed = await validateExtensionPackage(this.options.targetRoot)
            const previous = await validateExtensionPackage(orphanedBackup)
            if (installed.extensionVersion === sourceManifest.extensionVersion) {
              this.pending = {
                schemaVersion: 1,
                targetVersion: installed.extensionVersion,
                previousVersion: previous.extensionVersion,
                backupRoot: orphanedBackup,
                installedAt: new Date().toISOString(),
              }
              await this.savePendingState()
            } else {
              await fs.remove(orphanedBackup)
            }
          } catch {
            await fs.remove(orphanedBackup)
          }
        }
      }

      if (this.pending) {
        let pendingTargetValid = false
        try {
          const installed = await validateExtensionPackage(this.options.targetRoot)
          pendingTargetValid = installed.extensionVersion === this.pending.targetVersion &&
            installed.extensionVersion === sourceManifest.extensionVersion
        } catch {
          pendingTargetValid = false
        }
        if (!pendingTargetValid) await this.rollbackPending('检测到未完成的旧扩展更新，已先恢复旧版本')
      }

      if (!this.pending) {
        const result = await installExtensionTransaction(this.options.sourceRoot, this.options.targetRoot)
        if (result.changed) {
          this.pending = {
            schemaVersion: 1,
            targetVersion: result.version,
            previousVersion: result.previousVersion,
            backupRoot: result.backupRoot,
            installedAt: new Date().toISOString(),
          }
          await this.savePendingState()
        }
      }

      const installedManifest = await validateExtensionPackage(this.options.targetRoot)
      this.patchState({
        installedVersion: installedManifest.extensionVersion,
        status: this.pending ? 'waiting-reload' : 'ready',
        message: this.pending ? '扩展文件已准备好，等待 Chrome 空闲后自动启用' : undefined,
      })
      await this.startBridge()
    } catch (error) {
      this.patchState({ status: 'error', message: `扩展更新准备失败：${errorMessage(error)}` })
      console.error('Extension update manager failed to start:', error)
    }
  }

  async stop(): Promise<void> {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = null
    await this.bridge?.stop()
    this.bridge = null
  }

  private async startBridge(): Promise<void> {
    this.bridge = new LocalUpdateBridge({
      extensionId: EXTENSION_ID,
      getStatus: (currentVersion) => this.getBridgeStatus(currentVersion),
      acknowledge: (acknowledgement) => this.acknowledge(acknowledgement),
      captureDiagnostics: this.options.captureDiagnostics,
    })
    this.bridgeConfig = await this.bridge.start()
    await this.writeBridgeConfig()
  }

  private async writeBridgeConfig(): Promise<void> {
    if (!this.bridgeConfig || !await fs.pathExists(this.options.targetRoot)) return
    await fs.writeJson(resolve(this.options.targetRoot, 'openflow-bridge.json'), {
      schemaVersion: 1,
      extensionId: EXTENSION_ID,
      host: '127.0.0.1',
      port: this.bridgeConfig.port,
      token: this.bridgeConfig.token,
      generatedAt: new Date().toISOString(),
    }, { spaces: 2 })
  }

  private async getBridgeStatus(currentVersion: string): Promise<ExtensionBridgeStatus> {
    if (!this.pending) {
      return {
        pending: false,
        targetVersion: this.state.installedVersion,
        desktopVersion: this.options.getDesktopVersion(),
        action: 'none',
      }
    }
    if (!this.pending.acknowledgementDeadline) {
      const timeoutMs = this.options.acknowledgementTimeoutMs ?? ACK_TIMEOUT_MS
      this.pending.acknowledgementDeadline = new Date(Date.now() + timeoutMs).toISOString()
      await this.savePendingState()
      this.armAcknowledgementTimeout()
    }
    return {
      pending: true,
      targetVersion: this.pending.targetVersion,
      desktopVersion: this.options.getDesktopVersion(),
      action: currentVersion === this.pending.targetVersion ? 'acknowledge' : 'reload',
      message: '桌面端已准备好新版扩展',
    }
  }

  private async acknowledge(acknowledgement: ExtensionBridgeAcknowledgement): Promise<{ reload: boolean }> {
    if (!this.pending || acknowledgement.version !== this.pending.targetVersion) {
      return { reload: false }
    }
    if (acknowledgement.status === 'failed') {
      await this.rollbackPending(acknowledgement.reason || '新版扩展自检失败，已恢复旧版本')
      await this.writeBridgeConfig()
      return { reload: true }
    }

    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = null
    await finalizeExtensionInstall(this.pending.backupRoot)
    this.pending = null
    await fs.remove(this.options.statePath)
    const installedManifest = await validateExtensionPackage(this.options.targetRoot)
    this.patchState({
      status: 'ready',
      installedVersion: installedManifest.extensionVersion,
      message: '桌面端与 Chrome 扩展已同步到最新版本',
    })
    return { reload: false }
  }

  private armAcknowledgementTimeout(): void {
    if (this.timeout) clearTimeout(this.timeout)
    if (!this.pending?.acknowledgementDeadline) return
    const delay = Math.max(0, Date.parse(this.pending.acknowledgementDeadline) - Date.now())
    this.timeout = setTimeout(() => {
      void this.rollbackPending('新版扩展启动后未能确认，已自动恢复旧版本')
        .then(() => this.writeBridgeConfig())
        .catch((error) => {
          this.patchState({ status: 'error', message: `扩展自动恢复失败：${errorMessage(error)}` })
        })
    }, delay)
  }

  private async restorePendingState(): Promise<void> {
    if (!await fs.pathExists(this.options.statePath)) return
    try {
      const value = await fs.readJson(this.options.statePath) as Partial<PendingExtensionUpdate>
      if (value.schemaVersion !== 1 || typeof value.targetVersion !== 'string') throw new Error('invalid state')
      this.pending = value as PendingExtensionUpdate
      // A deadline is meaningful only while this desktop process can serve the bridge.
      // Give Chrome a fresh acknowledgement window after a desktop restart.
      delete this.pending.acknowledgementDeadline
      await this.savePendingState()
    } catch {
      await fs.remove(this.options.statePath)
      this.pending = null
    }
  }

  private async savePendingState(): Promise<void> {
    if (!this.pending) return
    await fs.ensureDir(dirname(this.options.statePath))
    await fs.writeJson(this.options.statePath, this.pending, { spaces: 2 })
  }

  private async rollbackPending(reason: string): Promise<void> {
    if (!this.pending) return
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = null
    const rolledBack = await rollbackExtensionInstall(this.options.targetRoot, this.pending.backupRoot)
    this.pending = null
    await fs.remove(this.options.statePath)
    let installedVersion = this.state.installedVersion
    try {
      installedVersion = (await validateExtensionPackage(this.options.targetRoot)).extensionVersion
    } catch {
      // Keep the last known version in the UI when there was no previous installation to restore.
    }
    this.patchState({
      status: rolledBack ? 'rolled-back' : 'error',
      installedVersion,
      message: rolledBack ? reason : `${reason}；首次安装没有可恢复的旧版本`,
    })
  }

  private patchState(patch: Partial<ExtensionUpdateViewState>): void {
    this.state = { ...this.state, ...patch }
    this.options.onStateChange?.(this.getState())
  }
}
