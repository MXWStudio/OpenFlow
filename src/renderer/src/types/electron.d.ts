/**
 * Electron IPC 桥接层的全局类型定义
 * 所有通过 contextBridge 暴露的 API 都在这里声明类型
 */

import type {
  RenameBatchResult,
  RenamePreview,
  RenameRequest,
  RenameSettingsV2,
} from '../../../shared/renameTemplates.ts'
import type { UpdateActivitySnapshot, UpdateViewState } from '../../../shared/updateContract.ts'
import type { DiagnosticEventInput } from '../../../shared/diagnosticsContract.ts'
import type { DesktopExtractionCandidate } from '../../../shared/extractionContract.ts'
import type {
  WorkspaceAutomationSettings,
  WorkspaceCleanupDiscoveryRequest,
  WorkspaceCleanupDiscoveryResult,
  WorkspaceCleanupScanRequest,
  WorkspaceCleanupScanResult,
  WorkspaceCleanupTreeRequest,
  WorkspaceCleanupTreeResult,
  WorkspaceFolderPreset,
  WorkspaceInitRequest,
  WorkspaceInitResult,
} from '../../../shared/workspaceContract.ts'

/** 校验结果状态 */
export type ValidationStatus = 'valid' | 'mismatch' | 'missing' | 'error' | 'format_error'

/** 单个文件的校验结果 */
export interface ValidationResult {
  fileName: string
  filePath: string
  folderName: string
  ext: string
  fileSize: number
  actualWidth: number
  actualHeight: number
  duration?: number
  status: ValidationStatus
  targetSize?: string
  requiredQuantity?: number
  actualQuantity?: number
  missingCount?: number
  missingKind?: 'empty_folder'
  error?: string
}

/** 初始化文件夹的结果 */
export type InitFoldersResult = WorkspaceInitResult

export interface RequirementDetail {
  resolution: string
  requiredQuantity?: number
  positionType?: string
  sizeLimit?: string
}

export interface RequirementProject {
  taskId?: string
  projectName: string
  sizes: string[]
  requirements?: RequirementDetail[]
  fullName?: string
  producerName?: string
  materialType?: string
}

export interface DailyRequirementSession {
  importedAt: number
  importedDateKey: string
  fileName: string
  sizes: string[]
  projects: RequirementProject[]
  producerName?: string
  department?: string
  email?: string
  warnings?: string[]
  source?: 'manual' | 'extension'
  sourceMessageId?: string
  extractedAt?: string
}

/** 历史记录条目 */
export interface HistoryEntry {
  id: number
  project: string
  count: number
  status: 'success' | 'warning' | 'error'
  timestamp: number
  paths?: string[]
  cleanedAt?: number
}

/** 消息中心条目 */
export interface NotificationHistoryEntry {
  id: string
  color: string
  title: string
  message?: string
  timestamp: number
}

/** 用户账户信息 */
export interface UserInfo {
  name: string
  email: string
  department: string
  avatarSeed: string
}

/** 工作流预设配置 */
export interface WorkflowPreset {
  renameTemplates: Record<string, Array<{ type: string; value?: string }>>
  renameSettings?: RenameSettingsV2
  organizerFormats: string[]
}

/** 系统设置 */
export interface SystemSettings {
  theme: 'dark' | 'light' | 'auto'
  autoStart: boolean
  closeToTray: boolean
}

/** 素材整理路径设置 */
export interface WorkspaceSettings {
  sourceDir: string
  destDir: string
  rootDir: string
  folderPresets: WorkspaceFolderPreset[]
  completedVisibilityMs: number
  historyRetentionDays: number
  cleanupReportRetentionDays: number
}

/** 快捷键设置 */
export interface ShortcutSettings {
  togglePanel: string
}

/** 全局 App 配置（存储在本地 JSON 配置中） */
export interface AppConfig {
  userInfo: UserInfo
  workflow: WorkflowPreset
  systemSettings: SystemSettings
  workspaceSettings: WorkspaceSettings
  shortcutSettings: ShortcutSettings
  history: HistoryEntry[]
  notificationHistory: NotificationHistoryEntry[]
  dailyRequirementSession?: DailyRequirementSession
  dismissedExtractionMessageIds?: string[]
  updateSession?: {
    activeView: import('../../../shared/updateContract.ts').RestorableAppView
    savedAt: number
  }
  dailyLayoutLeft: string[]
  dailyLayoutRight: string[]
  renameTemplates?: WorkflowPreset['renameTemplates']
}

/** 解析的 JSON 需求文件结果 */
export interface ParsedRequirementJson {
  projectName: string
  producerName?: string
  department?: string
  email?: string
  sizes: string[]
  projects?: RequirementProject[]
  rawData: unknown
  fileName?: string
  warnings?: string[]
}

/** window.electronAPI 接口全量定义 */
export interface ElectronAPI {
  /** 应用启动状态 */
  app: {
    rendererReady: () => void
    onNavigate: (listener: (target: { view: string, settingsTab?: string }) => void) => void
    offNavigate: (listener: (target: { view: string, settingsTab?: string }) => void) => void
  }

  /** Electron 辅助工具 */
  webUtils: {
    getPathForFile: (file: File) => string
  }

  /** 对话框相关 */
  dialog: {
    /** 打开系统文件选择框，仅限 .json 文件 */
    openJson: () => Promise<ParsedRequirementJson | null>
    /** 打开文件夹选择框 */
    selectFolder: () => Promise<string | null>
    /** 导出错误日志到用户指定的文件路径 */
    exportLogs: () => Promise<{ success: boolean; path?: string }>
  }

  /** 文件系统相关 */
  fs: {
    /**
     * 批量在选定目录下创建多项目文件夹结构（主进程内弹窗选择目标总目录）
     * @param projectsData 项目列表，每项含 projectName、sizes；尺寸子文件夹按纯数字命名（如 1080x1920）
     */
    initFolders: (request: WorkspaceInitRequest) => Promise<InitFoldersResult>

    /** 懒加载工作区清理目录树的一层子目录 */
    listWorkspaceCleanupChildren: (request: WorkspaceCleanupTreeRequest) => Promise<WorkspaceCleanupTreeResult>

    /** 在月份、日期或游戏范围内批量查找配置的生成目录 */
    discoverWorkspaceCleanupTargets: (request: WorkspaceCleanupDiscoveryRequest) => Promise<WorkspaceCleanupDiscoveryResult>

    /** 只读扫描待清理目录，返回精确路径、文件数和体积 */
    scanWorkspaceCleanup: (request: WorkspaceCleanupScanRequest) => Promise<WorkspaceCleanupScanResult>

    cancelWorkspaceCleanupScan: (scanId: string) => Promise<{ success: boolean }>

    /** 将已扫描确认的工作区目录移动到系统废纸篓 */
    trashWorkspacePaths: (request: WorkspaceCleanupScanRequest) => Promise<{ success: boolean; removedPaths: string[]; error?: string }>

    /** 永久删除已扫描确认的工作区目录；界面必须进行二次确认 */
    deleteWorkspacePaths: (request: WorkspaceCleanupScanRequest) => Promise<{ success: boolean; removedPaths: string[]; error?: string }>

    /**
     * 读取若干文件夹下的一级子目录名，识别尺寸格式（如 720x1280）并返回规范化尺寸数组
     */
    readProjectSizes: (folderPaths: string[]) => Promise<string[]>

    /**
     * 扫描指定目录，对比目标尺寸，返回校验结果数组
     * @param folderPath 素材所在文件夹
     * @param targetSizes 目标尺寸数组
     */
    startValidation: (
      folderPath: string,
      targetSizes: Array<string | RequirementDetail>
    ) => Promise<ValidationResult[]>

    /** 将单个素材文件移到系统废纸篓 */
    trashFile: (filePath: string) => Promise<{ success: boolean; error?: string }>

    /** 生成真实文件名预检，不修改文件 */
    previewRename: (request: RenameRequest) => Promise<RenamePreview>

    /** 根据预检同源规则执行批量重命名 */
    executeRename: (request: RenameRequest) => Promise<RenameBatchResult>

    /** 扫描素材整理目录 */
    scanOrganizerFolder: (sourceDir: string, allowedFormats: string[]) => Promise<any[]>

    /** 执行素材转移 */
    executeOrganize: (files: any[], destDir: string, isQimiEnabled?: boolean) => Promise<{ success: boolean; results?: any[]; error?: string; missingFolders?: string[] }>

    /** 撤销上一次素材转移 */
    undoOrganize: () => Promise<{ success: boolean; message?: string; error?: string }>

    /** 批量格式处理 */
    processFormat: (files: any[], config: any) => Promise<{ success: boolean; results: any[]; error?: string }>
  }

  /** 本地持久化配置相关（基于 electron-store） */
  store: {
    /** 获取指定 key 的配置值 */
    get: <T = unknown>(key: string) => Promise<T>
    /** 设置指定 key 的配置值 */
    set: (key: string, value: unknown) => Promise<void>
    /** 获取所有配置 */
    getAll: () => Promise<Partial<AppConfig> & Record<string, unknown>>
    /** 删除指定配置项 */
    delete: (key: string) => Promise<void>
  }

  /** 自动诊断事件上报到本机持久队列 */
  diagnostics: {
    report: (event: DiagnosticEventInput) => Promise<boolean>
  }

  /** Chrome 扩展自动送达的今日抓取结果 */
  extractions: {
    getLatestToday: () => Promise<DesktopExtractionCandidate | null>
    onAvailable: (listener: (candidate: DesktopExtractionCandidate) => void) => void
    offAvailable: (listener: (candidate: DesktopExtractionCandidate) => void) => void
  }

  /** 窗口控制 */
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }

  /** Shell 调用系统能力 */
  shell: {
    openPath: (path: string) => Promise<string>
  }

  /** 桌面程序与 Chrome 扩展更新 */
  updates: {
    getState: () => Promise<UpdateViewState>
    check: () => Promise<UpdateViewState>
    install: () => Promise<boolean>
    openExtensionFolder: () => Promise<string>
    openManualDownload: () => Promise<void>
    reportActivity: (activity: UpdateActivitySnapshot) => Promise<boolean>
    onState: (listener: (state: UpdateViewState) => void) => void
    offState: (listener: (state: UpdateViewState) => void) => void
    onPrepareRestart: (listener: () => void) => void
    offPrepareRestart: (listener: () => void) => void
  }

  /** 受限 IPC 桥接，用于当前设置页调用少量主进程通道 */
  ipcRenderer: {
    invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
    removeListener: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
  }
}

/** 扩展全局 Window 类型，使 window.electronAPI 有类型提示 */
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
