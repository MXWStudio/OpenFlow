export type WorkspaceMediaKind = 'image' | 'video'
export type WorkspaceMonthStyle = 'm-cn' | 'mm-cn' | 'm-number' | 'mm-number'
export type WorkspaceDateStyle = 'm-dot-d' | 'mm-dot-dd' | 'm-cn-d-cn' | 'mm-cn-dd-cn' | 'mmdd'

export interface WorkspaceInitOverrides {
  monthStyle?: WorkspaceMonthStyle
  dateStyle?: WorkspaceDateStyle
  fallbackMediaKinds?: WorkspaceMediaKind[]
}

export interface WorkspaceInitConflict {
  kind: 'month-style' | 'date-style' | 'media-kind'
  message: string
  options: Array<{ value: string; label: string }>
  projectNames?: string[]
}

export interface WorkspaceFolderPreset {
  id: string
  label: string
  suffix: string
  mediaKinds: WorkspaceMediaKind[]
  enabled: boolean
  builtIn?: boolean
}

export interface WorkspaceAutomationSettings {
  rootDir: string
  folderPresets: WorkspaceFolderPreset[]
  completedVisibilityMs: number
  historyRetentionDays: number
  cleanupReportRetentionDays: number
}

export interface WorkspaceInitProject {
  taskId?: string
  projectName: string
  sizes: string[]
  materialType?: string
}

export interface WorkspaceInitRequest {
  projects: WorkspaceInitProject[]
  settings: WorkspaceAutomationSettings
  now?: string
  overrides?: WorkspaceInitOverrides
}

export interface WorkspaceInitResult {
  success: boolean
  destPath: string
  projectPaths?: string[]
  createdPaths?: string[]
  reusedPaths?: string[]
  warnings?: string[]
  conflict?: WorkspaceInitConflict
  error?: string
}

export interface WorkspaceCleanupScanRequest {
  scanId?: string
  rootDir: string
  targetPaths: string[]
  activePaths?: string[]
  removeEmptyParents?: boolean
}

export interface WorkspaceCleanupDiscoveryRequest {
  rootDir: string
  scopePath: string
  presetSuffixes: string[]
  activePaths?: string[]
}

export interface WorkspaceCleanupDiscoveryResult {
  success: boolean
  targetPaths: string[]
  blockedPaths: string[]
  error?: string
}

export type WorkspaceCleanupTreeLevel = 'root' | 'year' | 'month' | 'date' | 'media' | 'game' | 'child' | 'invalid'

export interface WorkspaceCleanupTreeRequest {
  rootDir: string
  parentPath?: string
  activePaths?: string[]
}

export interface WorkspaceCleanupTreeNode {
  path: string
  name: string
  level: WorkspaceCleanupTreeLevel
  selectable: boolean
  hasChildren: boolean
  protectedReason?: string
}

export interface WorkspaceCleanupTreeResult {
  success: boolean
  parentPath: string
  nodes: WorkspaceCleanupTreeNode[]
  error?: string
}

export interface WorkspaceCleanupEntry {
  path: string
  name: string
  kind: 'folder' | 'file'
  bytes: number
  fileCount: number
}

export interface WorkspaceCleanupScanResult {
  success: boolean
  entries: WorkspaceCleanupEntry[]
  totalBytes: number
  totalFiles: number
  blockedPaths?: string[]
  error?: string
}

export const DEFAULT_WORKSPACE_FOLDER_PRESETS: WorkspaceFolderPreset[] = [
  { id: 'jimeng', label: '即梦生成', suffix: '即梦生成', mediaKinds: ['image', 'video'], enabled: true, builtIn: true },
  { id: 'screenshot', label: '截屏素材', suffix: '截屏素材', mediaKinds: ['image'], enabled: true, builtIn: true },
  { id: 'recording', label: '录屏素材', suffix: '录屏素材', mediaKinds: ['video'], enabled: true, builtIn: true },
  { id: 'qimi', label: '奇觅生成', suffix: '奇觅生成', mediaKinds: ['image', 'video'], enabled: true, builtIn: true },
  { id: 'blur', label: '模糊处理', suffix: '模糊处理', mediaKinds: ['image', 'video'], enabled: true, builtIn: true },
]

export const DEFAULT_WORKSPACE_AUTOMATION: WorkspaceAutomationSettings = {
  rootDir: '',
  folderPresets: DEFAULT_WORKSPACE_FOLDER_PRESETS,
  completedVisibilityMs: 120_000,
  historyRetentionDays: 3,
  cleanupReportRetentionDays: 30,
}

export function normalizeWorkspaceAutomationSettings(
  value?: Partial<WorkspaceAutomationSettings> | null,
): WorkspaceAutomationSettings {
  const presets = Array.isArray(value?.folderPresets) && value.folderPresets.length
    ? value.folderPresets
    : DEFAULT_WORKSPACE_FOLDER_PRESETS
  return {
    rootDir: typeof value?.rootDir === 'string' ? value.rootDir : '',
    folderPresets: presets.map((preset, index) => ({
      id: preset.id || `custom-${index}`,
      label: preset.label || preset.suffix || `目录 ${index + 1}`,
      suffix: preset.suffix || preset.label || `目录 ${index + 1}`,
      mediaKinds: Array.isArray(preset.mediaKinds) && preset.mediaKinds.length
        ? [...new Set(preset.mediaKinds.filter((kind): kind is WorkspaceMediaKind => kind === 'image' || kind === 'video'))]
        : ['image', 'video'],
      enabled: preset.enabled !== false,
      builtIn: preset.builtIn === true,
    })),
    completedVisibilityMs: Number.isFinite(value?.completedVisibilityMs)
      ? Math.max(10_000, Number(value?.completedVisibilityMs))
      : DEFAULT_WORKSPACE_AUTOMATION.completedVisibilityMs,
    historyRetentionDays: Number.isFinite(value?.historyRetentionDays)
      ? Math.max(1, Number(value?.historyRetentionDays))
      : DEFAULT_WORKSPACE_AUTOMATION.historyRetentionDays,
    cleanupReportRetentionDays: Number.isFinite(value?.cleanupReportRetentionDays)
      ? Math.max(1, Number(value?.cleanupReportRetentionDays))
      : DEFAULT_WORKSPACE_AUTOMATION.cleanupReportRetentionDays,
  }
}
