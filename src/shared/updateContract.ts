export type DesktopUpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export type DesktopUpdateType = 'critical' | 'standard'

export type RestorableAppView = 'daily' | 'organizer' | 'format' | 'settings'

export interface UpdateActivitySnapshot {
  activeView: RestorableAppView
  busy: boolean
  hasUnsavedChanges: boolean
  lastUserActivityAt: number
  rendererReady: boolean
}

export type ExtensionUpdateStatus =
  | 'preparing'
  | 'ready'
  | 'waiting-reload'
  | 'rolled-back'
  | 'error'

export interface ExtensionUpdateViewState {
  status: ExtensionUpdateStatus
  bundledVersion: string
  installedVersion: string
  extensionPath: string
  message?: string
}

export interface UpdateViewState {
  desktop: {
    status: DesktopUpdateStatus
    currentVersion: string
    availableVersion?: string
    progressPercent?: number
    lastCheckedAt?: string
    updateType?: DesktopUpdateType
    installBehavior?: 'automatic-when-idle' | 'manual'
    message?: string
  }
  extension: ExtensionUpdateViewState
  channelConfigured: boolean
}

export interface ExtensionReleaseFile {
  path: string
  size: number
  sha256: string
}

export interface ExtensionReleaseManifest {
  schemaVersion: 1
  extensionVersion: string
  files: ExtensionReleaseFile[]
}

export interface SignedDesktopRelease {
  schemaVersion: 1
  version: string
  publishedAt: string
  feedUrl: string
  updateType: DesktopUpdateType
  desktop: {
    installer: string
    size: number
    sha512: string
  }
  extension: {
    version: string
    archive: string
    size: number
    sha256: string
    manifest: string
    manifestSha256: string
  }
}

export interface SignedReleaseEnvelope {
  schemaVersion: 1
  algorithm: 'RSA-SHA256'
  payload: string
  signature: string
}
