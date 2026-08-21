import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import fs from 'fs-extra'
import type {
  WorkspaceFolderPreset,
  WorkspaceInitProject,
  WorkspaceInitRequest,
  WorkspaceInitResult,
  WorkspaceDateStyle,
  WorkspaceMediaKind,
  WorkspaceMonthStyle,
} from '../shared/workspaceContract.ts'

const INVALID_SEGMENT = /[<>:"/\\|?*\u0000-\u001f]/g
const MONTH_PATTERNS = [
  { id: 'm-cn' as const, regex: /^([1-9]|1[0-2])月$/, render: (month: number) => `${month}月` },
  { id: 'mm-cn' as const, regex: /^(0[1-9]|1[0-2])月$/, render: (month: number) => `${String(month).padStart(2, '0')}月` },
  { id: 'm-number' as const, regex: /^([1-9]|1[0-2])$/, render: (month: number) => `${month}` },
  { id: 'mm-number' as const, regex: /^(0[1-9]|1[0-2])$/, render: (month: number) => String(month).padStart(2, '0') },
]
const DATE_PATTERNS = [
  { id: 'm-dot-d' as const, regex: /^([1-9]|1[0-2])\.([1-9]|[12]\d|3[01])$/, render: (month: number, day: number) => `${month}.${day}` },
  { id: 'mm-dot-dd' as const, regex: /^(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])$/, render: (month: number, day: number) => `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}` },
  { id: 'm-cn-d-cn' as const, regex: /^([1-9]|1[0-2])月([1-9]|[12]\d|3[01])日$/, render: (month: number, day: number) => `${month}月${day}日` },
  { id: 'mm-cn-dd-cn' as const, regex: /^(0[1-9]|1[0-2])月(0[1-9]|[12]\d|3[01])日$/, render: (month: number, day: number) => `${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日` },
  { id: 'mmdd' as const, regex: /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/, render: (month: number, day: number) => `${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}` },
]

export function safeWorkspaceSegment(value: string, fallback = '未命名项目'): string {
  const normalized = String(value || '').replace(INVALID_SEGMENT, '').replace(/\.{2,}/g, '.').trim().replace(/[. ]+$/g, '')
  return normalized && normalized !== '.' && normalized !== '..' ? normalized : fallback
}

export function isWithinWorkspace(rootDir: string, targetPath: string): boolean {
  if (!rootDir || !targetPath || !isAbsolute(rootDir) || !isAbsolute(targetPath)) return false
  const root = resolve(rootDir)
  const target = resolve(targetPath)
  const rel = relative(root, target)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

function inferName(
  siblingNames: string[],
  patterns: Array<{ regex: RegExp; render: (month: number, day: number) => string }>,
  month: number,
  day: number,
): { name: string; ambiguous: boolean } {
  const matchedIndexes = new Set<number>()
  siblingNames.forEach((name) => patterns.forEach((pattern, index) => {
    if (pattern.regex.test(name)) matchedIndexes.add(index)
  }))
  const renderedNames = [...matchedIndexes].map((index) => patterns[index].render(month, day))
  return {
    name: renderedNames[0] ?? patterns[0].render(month, day),
    ambiguous: new Set(renderedNames).size > 1,
  }
}

export function inferMonthName(siblingNames: string[], month: number): { name: string; ambiguous: boolean } {
  return inferName(siblingNames, MONTH_PATTERNS, month, 1)
}

export function inferDateName(siblingNames: string[], month: number, day: number): { name: string; ambiguous: boolean } {
  return inferName(siblingNames, DATE_PATTERNS, month, day)
}

export function inferProjectMediaKinds(project: WorkspaceInitProject): WorkspaceMediaKind[] {
  const material = String(project.materialType || '').toLowerCase()
  const hasVideo = /视频|video|录屏|mov|mp4/.test(material)
  const hasImage = /图片|图像|image|截图|截屏|png|jpg|jpeg|webp/.test(material)
  if (hasVideo && !hasImage) return ['video']
  if (hasImage && !hasVideo) return ['image']
  return ['image', 'video']
}

export function hasExplicitProjectMediaKind(project: WorkspaceInitProject): boolean {
  const material = String(project.materialType || '').toLowerCase()
  return /视频|video|录屏|mov|mp4|图片|图像|image|截图|截屏|png|jpg|jpeg|webp/.test(material)
}

function renderMonthStyle(style: WorkspaceMonthStyle, month: number): string {
  return MONTH_PATTERNS.find((pattern) => pattern.id === style)?.render(month, 1) || MONTH_PATTERNS[0].render(month, 1)
}

function renderDateStyle(style: WorkspaceDateStyle, month: number, day: number): string {
  return DATE_PATTERNS.find((pattern) => pattern.id === style)?.render(month, day) || DATE_PATTERNS[0].render(month, day)
}

function presetsForMedia(presets: WorkspaceFolderPreset[], media: WorkspaceMediaKind) {
  return presets.filter((preset) => preset.enabled && preset.mediaKinds.includes(media))
}

async function ensureTracked(path: string, created: string[], reused: string[]) {
  if (await fs.pathExists(path)) reused.push(path)
  else {
    await fs.ensureDir(path)
    created.push(path)
  }
}

export async function createWorkspaceFolders(request: WorkspaceInitRequest): Promise<WorkspaceInitResult> {
  const rootDir = resolve(request.settings.rootDir || '')
  if (!request.settings.rootDir || !isAbsolute(request.settings.rootDir)) {
    return { success: false, destPath: '', error: '请先在设置中选择工作区。' }
  }
  if (!Array.isArray(request.projects) || request.projects.length === 0) {
    return { success: false, destPath: rootDir, error: '项目列表为空。' }
  }

  const date = request.now ? new Date(request.now) : new Date()
  if (Number.isNaN(date.getTime())) return { success: false, destPath: rootDir, error: '日期无效。' }
  const year = String(date.getFullYear())
  const month = date.getMonth() + 1
  const day = date.getDate()
  const yearPath = join(rootDir, year)
  const createdPaths: string[] = []
  const reusedPaths: string[] = []
  const warnings: string[] = []

  try {
    const yearSiblings = await fs.pathExists(yearPath) ? await fs.readdir(yearPath) : []
    const monthChoice = inferMonthName(yearSiblings, month)
    if (monthChoice.ambiguous && !request.overrides?.monthStyle) {
      return {
        success: false,
        destPath: rootDir,
        error: '工作区中存在多种月份命名格式。',
        conflict: {
          kind: 'month-style',
          message: '请选择今天要使用的月份文件夹格式。已有目录不会被改名或覆盖。',
          options: MONTH_PATTERNS.map((pattern) => ({ value: pattern.id, label: pattern.render(month, day) })),
        },
      }
    }
    const monthName = request.overrides?.monthStyle ? renderMonthStyle(request.overrides.monthStyle, month) : monthChoice.name
    const monthPath = join(yearPath, monthName)
    const monthSiblings = await fs.pathExists(monthPath) ? await fs.readdir(monthPath) : []
    const dateChoice = inferDateName(monthSiblings, month, day)
    if (dateChoice.ambiguous && !request.overrides?.dateStyle) {
      return {
        success: false,
        destPath: rootDir,
        error: '当前月份中存在多种日期命名格式。',
        conflict: {
          kind: 'date-style',
          message: '请选择今天要使用的日期文件夹格式。已有目录不会被改名或覆盖。',
          options: DATE_PATTERNS.map((pattern) => ({ value: pattern.id, label: pattern.render(month, day) })),
        },
      }
    }
    const dateName = request.overrides?.dateStyle ? renderDateStyle(request.overrides.dateStyle, month, day) : dateChoice.name
    const datePath = join(monthPath, dateName)
    const ambiguousMediaProjects = request.projects.filter((project) => !hasExplicitProjectMediaKind(project))
    if (ambiguousMediaProjects.length && !request.overrides?.fallbackMediaKinds?.length) {
      return {
        success: false,
        destPath: datePath,
        error: '部分项目无法判断素材类型。',
        conflict: {
          kind: 'media-kind',
          message: '请选择这些项目要创建图片目录、视频目录，还是两者都创建。',
          projectNames: ambiguousMediaProjects.map((project) => safeWorkspaceSegment(project.projectName)),
          options: [
            { value: 'image', label: '仅图片' },
            { value: 'video', label: '仅视频' },
            { value: 'image,video', label: '图片和视频' },
          ],
        },
      }
    }

    await ensureTracked(rootDir, createdPaths, reusedPaths)
    await ensureTracked(yearPath, createdPaths, reusedPaths)
    await ensureTracked(monthPath, createdPaths, reusedPaths)
    await ensureTracked(datePath, createdPaths, reusedPaths)

    const projectPaths: string[] = []
    for (const project of request.projects) {
      const projectName = safeWorkspaceSegment(project.projectName)
      const mediaKinds = hasExplicitProjectMediaKind(project)
        ? inferProjectMediaKinds(project)
        : request.overrides?.fallbackMediaKinds || ['image', 'video']
      for (const media of mediaKinds) {
        const mediaPath = join(datePath, media === 'image' ? '图片' : '视频')
        await ensureTracked(mediaPath, createdPaths, reusedPaths)
        const projectPath = join(mediaPath, projectName)
        await ensureTracked(projectPath, createdPaths, reusedPaths)
        projectPaths.push(projectPath)
        for (const size of project.sizes || []) {
          const sizeName = safeWorkspaceSegment(size.replace(/\*/g, 'x'), '')
          if (sizeName) await ensureTracked(join(projectPath, sizeName), createdPaths, reusedPaths)
        }
        for (const preset of presetsForMedia(request.settings.folderPresets || [], media)) {
          const suffix = safeWorkspaceSegment(preset.suffix, '')
          if (!suffix) {
            warnings.push(`已跳过无效目录配置：${preset.label}`)
            continue
          }
          await ensureTracked(join(projectPath, `${projectName}-${suffix}`), createdPaths, reusedPaths)
        }
      }
    }

    return {
      success: true,
      destPath: datePath,
      projectPaths: [...new Set(projectPaths)],
      createdPaths,
      reusedPaths,
      warnings: [...new Set(warnings)],
    }
  } catch (error) {
    return { success: false, destPath: rootDir, error: error instanceof Error ? error.message : String(error) }
  }
}

export function getWorkspaceDeleteLevel(rootDir: string, targetPath: string): 'year' | 'month' | 'date' | 'media' | 'game' | 'child' | 'invalid' {
  if (!isWithinWorkspace(rootDir, targetPath)) return 'invalid'
  const depth = relative(resolve(rootDir), resolve(targetPath)).split(sep).filter(Boolean).length
  return depth === 1 ? 'year' : depth === 2 ? 'month' : depth === 3 ? 'date' : depth === 4 ? 'media' : depth === 5 ? 'game' : 'child'
}

export function isSameOrInside(parentPath: string, candidatePath: string): boolean {
  const rel = relative(resolve(parentPath), resolve(candidatePath))
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

export function getSafeCleanupLabel(path: string): string {
  return basename(path) || basename(dirname(path))
}
