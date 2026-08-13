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
  requirements: RequirementDetail[]
  fullName?: string
  producerName?: string
  materialType?: string
  raw?: unknown
}

export interface ParsedRequirementJson {
  projectName: string
  producerName: string
  department: string
  email: string
  sizes: string[]
  projects: RequirementProject[]
  rawData: unknown
  fileName: string
  warnings: string[]
}

export interface MissingRequirement {
  resolution: string
  requiredQuantity: number
  actualQuantity: number
  missingCount: number
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function readNestedString(record: UnknownRecord, nestedKey: string, keys: string[]): string {
  const nested = record[nestedKey]
  if (!isRecord(nested)) return ''
  return readString(nested, keys)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

export function normalizeResolution(value: unknown): string {
  if (value == null) return ''
  const text = String(value).trim()
  const match = text.match(/(\d+)\s*[*xX×-]\s*(\d+)/)
  if (!match) return ''
  return `${match[1]}*${match[2]}`
}

export function parseRequiredQuantity(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value !== 'string') return undefined
  const match = value.match(/\d+/)
  if (!match) return undefined
  const parsed = Number.parseInt(match[0], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function sanitizePathSegment(value: unknown, fallback = '未命名'): string {
  let text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '')

  if (!text) text = fallback
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(text)) {
    text = `${text}_`
  }
  return text
}

function parseRequirementDetail(
  detail: unknown,
  defaultQuantity: number | undefined,
  warnings: string[],
  context: string
): RequirementDetail | null {
  if (typeof detail === 'string') {
    const resolution = normalizeResolution(detail)
    if (!resolution) {
      warnings.push(`${context}无法识别尺寸：${detail}`)
      return null
    }
    return { resolution, requiredQuantity: defaultQuantity }
  }

  if (!isRecord(detail)) {
    warnings.push(`${context}不是可识别的尺寸对象`)
    return null
  }

  const resolution = normalizeResolution(
    detail.resolution ?? detail.size ?? detail['分辨率'] ?? detail['尺寸']
  )
  if (!resolution) {
    warnings.push(`${context}无法识别尺寸`)
    return null
  }

  const requiredQuantity = parseRequiredQuantity(
    detail.requiredQuantity ?? detail.quantity ?? detail.count ?? detail['所需数量'] ?? detail['尺寸所需数量']
  ) ?? defaultQuantity

  if (requiredQuantity == null) {
    warnings.push(`${context}${resolution} 缺少所需数量`)
  }

  const positionType = readString(detail, ['positionType', 'placement', '版位类型'])
  const sizeLimit = readString(detail, ['sizeLimit', 'limit', '大小限制'])
  return {
    resolution,
    ...(requiredQuantity != null ? { requiredQuantity } : {}),
    ...(positionType ? { positionType } : {}),
    ...(sizeLimit ? { sizeLimit } : {}),
  }
}

function parseRequirementList(
  value: unknown,
  defaultQuantity: number | undefined,
  warnings: string[],
  context: string
): RequirementDetail[] {
  if (!Array.isArray(value)) return []
  return value
    .map((detail, index) => parseRequirementDetail(detail, defaultQuantity, warnings, `${context}第 ${index + 1} 条尺寸`))
    .filter((detail): detail is RequirementDetail => detail !== null)
}

function projectFromRecord(
  record: UnknownRecord,
  warnings: string[],
  index: number,
  defaultQuantity: number | undefined
): RequirementProject | null {
  const projectName =
    readNestedString(record, '其他信息', ['项目名称', 'projectName', 'name']) ||
    readString(record, ['projectName', 'project_name', 'name', '项目名称', '项目游戏名称'])

  if (!projectName) {
    warnings.push(`第 ${index + 1} 个项目缺少项目名称，已跳过`)
    return null
  }

  const detailsSource =
    record.requirements ??
    record['尺寸要求明细'] ??
    record.sizes ??
    record.dimensions ??
    record.details

  const requirements = parseRequirementList(
    detailsSource,
    defaultQuantity,
    warnings,
    `第 ${index + 1} 个项目`
  )
  if (requirements.length === 0) {
    warnings.push(`第 ${index + 1} 个项目没有可用尺寸要求`)
  }

  const sizes = uniqueStrings(requirements.map((item) => item.resolution))
  const other = isRecord(record['其他信息']) ? record['其他信息'] : {}
  const fullName = readString(record, ['fullName', '项目全称', '项目游戏名称']) || readString(other, ['项目全称'])
  const producerName =
    readString(record, ['producerName', 'producer_name', 'producer', '制作人', '制作者']) ||
    readString(other, ['制作人', '制作者'])
  const materialType = readString(record, ['materialType', '素材类型'])
  const taskId = readString(record, ['taskId', 'task_id', '任务ID']) || readString(other, ['任务ID'])

  return {
    ...(taskId ? { taskId } : {}),
    projectName,
    sizes,
    requirements,
    ...(fullName ? { fullName } : {}),
    ...(producerName ? { producerName } : {}),
    ...(materialType ? { materialType } : {}),
    raw: record,
  }
}

function extractProducerFromFileName(fileName: string): string {
  const match = fileName.match(/-(.*?)(数据表|需求|需求表|工作表)?\.json$/i)
  return match?.[1]?.trim() ?? ''
}

function firstProjectMeta(projects: RequirementProject[], key: 'producerName' | 'materialType'): string {
  return projects.find((project) => project[key])?.[key] ?? ''
}

export function parseRequirementJson(rawData: unknown, fileName = ''): ParsedRequirementJson {
  const warnings: string[] = []
  let projects: RequirementProject[] = []
  let producerName = ''
  let department = ''
  let email = ''

  if (Array.isArray(rawData)) {
    projects = rawData
      .map((item, index) => isRecord(item) ? projectFromRecord(item, warnings, index, undefined) : null)
      .filter((project): project is RequirementProject => project !== null)

    const firstItem = rawData.find(isRecord)
    if (firstItem) {
      producerName =
        readNestedString(firstItem, '其他信息', ['制作人', '制作者']) ||
        readString(firstItem, ['制作人', '制作者', 'producerName', 'producer_name', 'producer'])
      department =
        readNestedString(firstItem, '其他信息', ['部门']) ||
        readString(firstItem, ['部门', 'department'])
      email =
        readNestedString(firstItem, '其他信息', ['邮箱']) ||
        readString(firstItem, ['邮箱', 'email'])
    }
  } else if (isRecord(rawData)) {
    const schemaVersion = readString(rawData, ['schemaVersion'])
    const sourceProjects = Array.isArray(rawData.projects) ? rawData.projects : null

    if (schemaVersion === 'openflow.requirements.v1' || sourceProjects) {
      projects = (sourceProjects ?? [rawData])
        .map((item, index) => isRecord(item) ? projectFromRecord(item, warnings, index, undefined) : null)
        .filter((project): project is RequirementProject => project !== null)
      producerName =
        readString(rawData, ['producerName', 'producer_name', 'producer', '制作人', '制作者']) ||
        firstProjectMeta(projects, 'producerName')
      department = readString(rawData, ['department', '部门'])
      email = readString(rawData, ['email', '邮箱'])
    } else {
      const project = projectFromRecord(rawData, warnings, 0, 1)
      projects = project ? [project] : []
      producerName =
        readString(rawData, ['producerName', 'producer_name', 'producer', '制作人', '制作者']) ||
        project?.producerName ||
        ''
      department = readString(rawData, ['department', '部门'])
      email = readString(rawData, ['email', '邮箱'])
    }
  } else {
    warnings.push('JSON 根节点不是对象或数组')
  }

  if (projects.length === 0) {
    warnings.push('未解析到任何项目')
  }

  if (isRecord(rawData)) {
    const extraction = isRecord(rawData.extraction) ? rawData.extraction : null
    if (extraction?.complete === false) {
      const failedCount = typeof extraction.failedCount === 'number' && Number.isFinite(extraction.failedCount)
        ? Math.max(0, Math.floor(extraction.failedCount))
        : 0
      warnings.push(failedCount > 0
        ? `扩展导出不完整：有 ${failedCount} 个任务抓取失败`
        : '扩展导出未通过完整性校验')
    }
  }

  const seenTaskIds = new Map<string, string>()
  projects.forEach((project) => {
    if (!project.taskId) return
    const previousProjectName = seenTaskIds.get(project.taskId)
    if (previousProjectName) {
      warnings.push(`${project.projectName} 与 ${previousProjectName} 的任务ID重复：${project.taskId}`)
      return
    }
    seenTaskIds.set(project.taskId, project.projectName)
  })

  if (!producerName) producerName = extractProducerFromFileName(fileName)

  const sizes = uniqueStrings(projects.flatMap((project) => project.sizes))
  return {
    projectName: projects[0]?.projectName ?? '',
    producerName,
    department,
    email,
    sizes,
    projects,
    rawData,
    fileName,
    warnings,
  }
}

export function getMissingRequirements(
  requirements: RequirementDetail[],
  validCountBySize: Map<string, number>
): MissingRequirement[] {
  const requiredBySize = new Map<string, number>()

  for (const requirement of requirements) {
    const resolution = normalizeResolution(requirement.resolution)
    if (!resolution) continue
    const requiredQuantity = Math.max(1, requirement.requiredQuantity ?? 1)
    requiredBySize.set(resolution, (requiredBySize.get(resolution) ?? 0) + requiredQuantity)
  }

  return Array.from(requiredBySize.entries()).flatMap(([resolution, requiredQuantity]) => {
    const actualQuantity = validCountBySize.get(resolution) ?? 0
    if (actualQuantity >= requiredQuantity) return []
    return [{
      resolution,
      requiredQuantity,
      actualQuantity,
      missingCount: requiredQuantity - actualQuantity,
    }]
  })
}
