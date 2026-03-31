/**
 * Electron IPC 桥接层的全局类型定义
 * 所有通过 contextBridge 暴露的 API 都在这里声明类型
 */

/** 校验结果状态 */
export type ValidationStatus = 'valid' | 'mismatch' | 'missing' | 'error'

/** 单个文件的校验结果 */
export interface ValidationResult {
  fileName: string
  filePath: string
  ext: string
  fileSize: number
  actualWidth: number
  actualHeight: number
  duration?: number
  status: ValidationStatus
  targetSize?: string
  error?: string
}

/** 单个文件的重命名结果 */
export interface RenameResult {
  oldFileName: string
  newFileName: string
  success: boolean
  error?: string
}

/** 初始化文件夹的结果 */
export interface InitFoldersResult {
  success: boolean
  destPath: string
  error?: string
}

/** 历史记录条目 */
export interface HistoryEntry {
  id: string
  type: 'renamed' | 'validated' | 'imported'
  projectName: string
  fileCount: number
  timestamp: number
  details?: string
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
  defaultOutputPath: string
  renameTemplate: string
  scanSubfolders: boolean
}

/** API Keys 配置 */
export interface ApiKeys {
  gemini: string
  stableDiffusion: string
}

/** 全局 App 配置（存储在 electron-store 中） */
export interface AppConfig {
  userInfo: UserInfo
  workflow: WorkflowPreset
  apiKeys: ApiKeys
  language: 'zh' | 'en' | 'ja'
  theme: 'dark' | 'light'
  history: HistoryEntry[]
}

/** 解析的 JSON 需求文件结果 */
export interface ParsedRequirementJson {
  projectName: string
  producerName?: string
  sizes: string[]
  rawData: Record<string, unknown>
}

/** window.electronAPI 接口全量定义 */
export interface ElectronAPI {
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
    initFolders: (
      projectsData: Array<{ projectName: string; sizes: string[] }>
    ) => Promise<InitFoldersResult>

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
      targetSizes: string[]
    ) => Promise<ValidationResult[]>

    /**
     * 根据模板批量重命名文件
     * @param files 通过校验的文件列表
     * @param templates 4种重命名模板
     * @param projectName 项目名称（用于填充 [Project] 变量）
     * @param producer 制作人（用于填充 [Producer] 变量）
     */
    executeRename: (
      files: ValidationResult[],
      templates: {
        videoRegular: any[];
        videoSpecial: any[];
        imageRegular: any[];
        imageSpecial: any[];
      },
      projectName: string,
      producer?: string
    ) => Promise<RenameResult[]>
  }

  /** 本地持久化配置相关（基于 electron-store） */
  store: {
    /** 获取指定 key 的配置值 */
    get: <T = unknown>(key: string) => Promise<T>
    /** 设置指定 key 的配置值 */
    set: (key: string, value: unknown) => Promise<void>
    /** 获取所有配置 */
    getAll: () => Promise<Partial<AppConfig>>
    /** 删除指定配置项 */
    delete: (key: string) => Promise<void>
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
}

/** 扩展全局 Window 类型，使 window.electronAPI 有类型提示 */
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
