import fs from 'fs-extra'
import { basename, dirname, extname, join } from 'node:path'
import {
  formatRenameProducer,
  getRenamePreset,
  renderRenameRule,
  validateRenamePreset,
  type RenameMediaType,
  type RenameBatchResult,
  type RenameExecutionItem,
  type RenameFileInput,
  type RenamePlanItem,
  type RenamePlanStatus,
  type RenamePreset,
  type RenamePreview,
  type RenameRequest,
  type RenameRule,
  type RenameSelection,
  type RenameSettingsV2,
  type RenameVariables,
} from '../shared/renameTemplates.ts'
import { sanitizePathSegment } from './requirements.ts'
import { getResolutionFolderContext } from './renameContext.ts'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'])

export type {
  RenameBatchResult,
  RenameExecutionItem,
  RenameFileInput,
  RenamePlanItem,
  RenamePlanStatus,
  RenamePreview,
  RenameRequest,
} from '../shared/renameTemplates.ts'

interface DirectoryState {
  names: Set<string>
}

function canonicalFileName(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase()
}

function getMediaType(extension: string): RenameMediaType | null {
  const normalized = extension.toLocaleLowerCase()
  if (IMAGE_EXTS.has(normalized)) return 'image'
  if (VIDEO_EXTS.has(normalized)) return 'video'
  return null
}

function selectPreset(
  settings: RenameSettingsV2,
  selection: RenameSelection,
): { preset?: RenamePreset; error?: string } {
  if (selection.mode === 'custom') {
    const preset = getRenamePreset(settings, selection.customPresetId)
    if (!preset || preset.kind !== 'custom') return { error: '选择的自定义模板不存在，请重新选择或改用常规模板' }
    const errors = validateRenamePreset(preset)
    if (errors.length > 0) return { error: errors[0] }
    return { preset }
  }

  const kind = selection.mode === 'special' ? 'special' : 'regular'
  const preset = settings.presets.find((item) => item.kind === kind)
  if (!preset) return { error: kind === 'special' ? '特殊模板不存在' : '常规模板不存在' }
  const errors = validateRenamePreset(preset)
  return errors.length > 0 ? { error: errors[0] } : { preset }
}

function buildVariables(
  file: RenameFileInput,
  contextName: string,
  date: Date,
  producer: string,
): RenameVariables {
  const cleanProjectName = contextName.replace(/\(创意比特\)|（创意比特）|创意比特/g, '').trim()
  return {
    ProjectName: sanitizePathSegment(contextName, ''),
    CleanProjectName: sanitizePathSegment(cleanProjectName, ''),
    Date: date,
    Producer: sanitizePathSegment(formatRenameProducer(producer), ''),
    Resolution: `${file.actualWidth}x${file.actualHeight}`,
    AspectRatio: file.actualWidth >= file.actualHeight ? '横' : '竖',
    OriginalName: sanitizePathSegment(file.fileName, ''),
  }
}

function blockedItem(file: RenameFileInput, errorCode: string, error: string): RenamePlanItem {
  return {
    oldPath: file.filePath || '',
    newPath: '',
    oldFileName: `${file.fileName || ''}${file.ext || ''}`,
    newFileName: '',
    status: 'blocked',
    errorCode,
    error,
  }
}

function hasSequence(rule: RenameRule): boolean {
  return rule.tokens.some((token) => token.type === 'Sequence')
}

function appendCollisionSuffix(baseName: string, rule: RenameRule, suffix: number): string {
  return `${baseName}${rule.separator || '-'}${suffix}`
}

export async function previewRenameRequest(request: RenameRequest): Promise<RenamePreview> {
  const items: RenamePlanItem[] = []
  const directoryCache = new Map<string, DirectoryState>()
  const sequenceCounters = new Map<string, number>()
  const now = request.now ? new Date(request.now) : new Date()

  const getDirectoryState = async (dir: string): Promise<DirectoryState> => {
    const cached = directoryCache.get(dir)
    if (cached) return cached
    const names = await fs.readdir(dir)
    const state = { names: new Set(names.map(canonicalFileName)) }
    directoryCache.set(dir, state)
    return state
  }

  for (const file of request.files) {
    if (!file.filePath || file.status !== 'valid') {
      items.push(blockedItem(file, 'INVALID_INPUT', '只有校验通过且路径有效的文件可以重命名'))
      continue
    }

    const context = getResolutionFolderContext(file.filePath)
    if (!context) {
      items.push(blockedItem(file, 'INVALID_RESOLUTION_FOLDER', '文件不在可识别的尺寸目录中'))
      continue
    }

    const extension = (file.ext || extname(file.filePath)).toLocaleLowerCase()
    const mediaType = getMediaType(extension)
    if (!mediaType) {
      items.push(blockedItem(file, 'UNSUPPORTED_MEDIA', `不支持的媒体格式：${extension || '无扩展名'}`))
      continue
    }

    if (!(await fs.pathExists(file.filePath))) {
      items.push(blockedItem(file, 'SOURCE_MISSING', '源文件不存在或已移动'))
      continue
    }

    const dir = dirname(file.filePath)
    const contextName = context.namingProjectName || request.projectName.trim()
    const selected = selectPreset(request.settings, request.selection)
    if (!selected.preset) {
      items.push(blockedItem(file, 'PRESET_NOT_FOUND', selected.error || '命名模板不存在'))
      continue
    }

    const rule = selected.preset.rules[mediaType]
    const variables = buildVariables(file, contextName, now, request.producer || '')
    const sequenceKey = `${dir}\u0000${mediaType}`
    let sequence = sequenceCounters.get(sequenceKey) ?? rule.sequence.start
    const originalFileName = basename(file.filePath)
    const originalKey = canonicalFileName(originalFileName)

    let rendered = renderRenameRule(rule, variables, sequence)
    if (!rendered.ok) {
      items.push(blockedItem(file, 'INVALID_TEMPLATE', rendered.error))
      continue
    }

    let baseName = rendered.value

    let newFileName = `${baseName}${extension}`
    let state: DirectoryState
    try {
      state = await getDirectoryState(dir)
    } catch (error) {
      items.push(blockedItem(file, 'DIRECTORY_UNREADABLE', error instanceof Error ? error.message : String(error)))
      continue
    }

    const maxAttempts = state.names.size + request.files.length + 2
    let attempts = 0
    let allocationError: RenamePlanItem | null = null
    while (state.names.has(canonicalFileName(newFileName)) && canonicalFileName(newFileName) !== originalKey) {
      attempts += 1
      if (attempts > maxAttempts) {
        allocationError = blockedItem(file, 'NAME_ALLOCATION_FAILED', '无法在有限次数内分配唯一文件名')
        break
      }

      if (hasSequence(rule)) {
        sequence += 1
        rendered = renderRenameRule(rule, variables, sequence)
        if (!rendered.ok) break
        baseName = rendered.value
      } else {
        baseName = appendCollisionSuffix(rendered.value, rule, attempts + 1)
      }
      newFileName = `${baseName}${extension}`
    }
    if (allocationError) {
      items.push(allocationError)
      continue
    }

    if (Buffer.byteLength(newFileName, 'utf8') > 255) {
      items.push(blockedItem(file, 'FILE_NAME_TOO_LONG', '生成的文件名超过 255 bytes，请缩短自定义文本'))
      continue
    }

    const newPath = join(dir, newFileName)
    const status: RenamePlanStatus = canonicalFileName(newFileName) === originalKey ? 'noop' : 'ready'
    state.names.add(canonicalFileName(newFileName))
    sequenceCounters.set(sequenceKey, sequence + 1)
    items.push({
      oldPath: file.filePath,
      newPath,
      oldFileName: originalFileName,
      newFileName,
      presetId: selected.preset.id,
      presetName: selected.preset.name,
      mediaType,
      status,
    })
  }

  const errorCount = items.filter((item) => item.status === 'blocked').length
  return { canExecute: items.length > 0 && errorCount === 0, items, errorCount }
}

export interface RenameExecutionDependencies {
  pathExists?: (path: string) => Promise<boolean>
  renameFile?: (oldPath: string, newPath: string) => Promise<void>
}

export async function executeRenameRequest(
  request: RenameRequest,
  dependencies: RenameExecutionDependencies = {},
): Promise<RenameBatchResult> {
  const preview = await previewRenameRequest(request)
  if (!preview.canExecute) {
    const firstBlockingError = preview.items.find((item) => item.status === 'blocked')
    const results = preview.items.map<RenameExecutionItem>((item) => ({
      oldPath: item.oldPath,
      newPath: item.newPath,
      oldFileName: item.oldFileName,
      newFileName: item.newFileName,
      success: false,
      status: 'failed',
      errorCode: item.errorCode || 'BATCH_BLOCKED',
      error: item.error || firstBlockingError?.error || '批次预检未通过',
    }))
    return { successCount: 0, failedCount: results.length, results, preview }
  }

  const pathExists = dependencies.pathExists || fs.pathExists
  const renameFile = dependencies.renameFile || ((oldPath: string, newPath: string) => fs.rename(oldPath, newPath))
  const results: RenameExecutionItem[] = []
  for (const item of preview.items) {
    if (item.status === 'noop') {
      results.push({
        oldPath: item.oldPath,
        newPath: item.newPath,
        oldFileName: item.oldFileName,
        newFileName: item.newFileName,
        success: true,
        status: 'noop',
      })
      continue
    }

    try {
      if (await pathExists(item.newPath)) throw Object.assign(new Error('目标文件已存在'), { code: 'TARGET_EXISTS' })
      await renameFile(item.oldPath, item.newPath)
      results.push({
        oldPath: item.oldPath,
        newPath: item.newPath,
        oldFileName: item.oldFileName,
        newFileName: item.newFileName,
        success: true,
        status: 'renamed',
      })
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'RENAME_FAILED'
      results.push({
        oldPath: item.oldPath,
        newPath: item.newPath,
        oldFileName: item.oldFileName,
        newFileName: item.newFileName,
        success: false,
        status: 'failed',
        errorCode: code,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const successCount = results.filter((item) => item.success).length
  return {
    successCount,
    failedCount: results.length - successCount,
    results,
    preview,
  }
}
