export const EXTRACTION_PROTOCOL_VERSION = 2 as const
export const MAX_EXTRACTION_REQUEST_BYTES = 512 * 1024
export const MAX_EXTRACTION_PROJECTS = 200
export const MAX_REQUIREMENTS_PER_PROJECT = 200

export interface ExtractionRequirement {
  resolution: string
  requiredQuantity: number
  positionType?: string
  sizeLimit?: string
}

export interface ExtractionProject {
  taskId: string
  projectName: string
  sizes: string[]
  requirements: ExtractionRequirement[]
  fullName?: string
  producerName?: string
  materialType?: string
}

export interface OpenFlowExtractionPayload {
  schemaVersion: 'openflow.requirements.v1'
  source: { app: 'OpenFlow'; url: string }
  extractedAt: string
  warnings: string[]
  extraction: {
    deadline: string
    filterMode?: 'deadline' | 'status'
    statusFilter?: string
    matchedCount: number
    successCount: number
    failedCount: number
    complete: true
  }
  projects: ExtractionProject[]
}

export interface ExtractionEnvelope {
  protocolVersion: typeof EXTRACTION_PROTOCOL_VERSION
  messageId: string
  createdAt: string
  payload: OpenFlowExtractionPayload
}

export interface ExtractionAcknowledgement {
  protocolVersion: typeof EXTRACTION_PROTOCOL_VERSION
  messageId: string
  status: 'accepted' | 'duplicate'
  receivedAt: string
}

export interface DesktopExtractionCandidate {
  messageId: string
  extractedAt: string
  receivedAt: string
  extensionVersion: string
  payload: OpenFlowExtractionPayload
}

export type ExtractionEnvelopeValidation =
  | { ok: true; envelope: ExtractionEnvelope }
  | { ok: false; error: string }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= maxLength && (allowEmpty || value.trim().length > 0)
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum
}

function optionalString(record: UnknownRecord, key: string, maximum: number): string | undefined {
  const value = record[key]
  return isBoundedString(value, maximum) ? value.trim() : undefined
}

function validateRequirement(value: unknown): ExtractionRequirement | null {
  if (!isRecord(value)) return null
  const resolution = typeof value.resolution === 'string'
    ? value.resolution.trim().replace(/[xX×-]/, '*')
    : ''
  if (!/^\d{2,5}\*\d{2,5}$/.test(resolution)) return null
  if (!Number.isSafeInteger(value.requiredQuantity) || Number(value.requiredQuantity) < 1 || Number(value.requiredQuantity) > 10_000) {
    return null
  }
  return {
    resolution,
    requiredQuantity: Number(value.requiredQuantity),
    ...(optionalString(value, 'positionType', 100) ? { positionType: optionalString(value, 'positionType', 100) } : {}),
    ...(optionalString(value, 'sizeLimit', 100) ? { sizeLimit: optionalString(value, 'sizeLimit', 100) } : {}),
  }
}

function validateProject(value: unknown): ExtractionProject | null {
  if (!isRecord(value)) return null
  if (!isBoundedString(value.taskId, 128) || !isBoundedString(value.projectName, 300)) return null
  if (!Array.isArray(value.requirements) || value.requirements.length === 0 || value.requirements.length > MAX_REQUIREMENTS_PER_PROJECT) {
    return null
  }
  const requirements = value.requirements.map(validateRequirement)
  if (requirements.some((item) => item === null)) return null
  const normalizedRequirements = requirements as ExtractionRequirement[]
  const sizes = [...new Set(normalizedRequirements.map((item) => item.resolution))]
  return {
    taskId: value.taskId.trim(),
    projectName: value.projectName.trim(),
    sizes,
    requirements: normalizedRequirements,
    ...(optionalString(value, 'fullName', 500) ? { fullName: optionalString(value, 'fullName', 500) } : {}),
    ...(optionalString(value, 'producerName', 100) ? { producerName: optionalString(value, 'producerName', 100) } : {}),
    ...(optionalString(value, 'materialType', 100) ? { materialType: optionalString(value, 'materialType', 100) } : {}),
  }
}

export function validateExtractionEnvelope(value: unknown): ExtractionEnvelopeValidation {
  if (!isRecord(value)) return { ok: false, error: '提取消息不是对象' }
  if (value.protocolVersion !== EXTRACTION_PROTOCOL_VERSION) return { ok: false, error: '提取协议版本不受支持' }
  if (!isBoundedString(value.messageId, 64) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.messageId)) {
    return { ok: false, error: '提取消息 ID 无效' }
  }
  if (!isIsoDateTime(value.createdAt)) return { ok: false, error: '提取消息时间无效' }
  if (!isRecord(value.payload)) return { ok: false, error: '提取消息缺少数据' }

  const payload = value.payload
  if (payload.schemaVersion !== 'openflow.requirements.v1') return { ok: false, error: '需求数据版本不受支持' }
  if (!isIsoDateTime(payload.extractedAt)) return { ok: false, error: '抓取时间无效' }
  if (!isRecord(payload.source) || payload.source.app !== 'OpenFlow' || !isBoundedString(payload.source.url, 2048, true)) {
    return { ok: false, error: '抓取来源无效' }
  }
  if (!Array.isArray(payload.warnings) || payload.warnings.length > 100 || !payload.warnings.every((warning) => isBoundedString(warning, 1000, true))) {
    return { ok: false, error: '抓取警告列表无效' }
  }
  if (!isRecord(payload.extraction)) return { ok: false, error: '抓取完整性信息缺失' }
  const extraction = payload.extraction
  if (extraction.complete !== true || extraction.failedCount !== 0) {
    return { ok: false, error: '只接收完整抓取结果' }
  }
  if (
    !isBoundedInteger(extraction.matchedCount, MAX_EXTRACTION_PROJECTS) ||
    !isBoundedInteger(extraction.successCount, MAX_EXTRACTION_PROJECTS) ||
    !isBoundedInteger(extraction.failedCount, MAX_EXTRACTION_PROJECTS)
  ) {
    return { ok: false, error: '抓取数量无效' }
  }
  if (!isBoundedString(extraction.deadline, 10, true) || (extraction.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(extraction.deadline))) {
    return { ok: false, error: '抓取截止日期无效' }
  }
  const filterMode = extraction.filterMode
  if (filterMode !== undefined && filterMode !== 'deadline' && filterMode !== 'status') {
    return { ok: false, error: '抓取筛选模式无效' }
  }
  if (extraction.statusFilter !== undefined && !isBoundedString(extraction.statusFilter, 40, true)) {
    return { ok: false, error: '抓取状态筛选无效' }
  }
  if (!Array.isArray(payload.projects) || payload.projects.length === 0 || payload.projects.length > MAX_EXTRACTION_PROJECTS) {
    return { ok: false, error: '抓取项目数量无效' }
  }
  const projects = payload.projects.map(validateProject)
  if (projects.some((project) => project === null)) return { ok: false, error: '抓取项目结构无效' }
  const normalizedProjects = projects as ExtractionProject[]
  const taskIds = new Set(normalizedProjects.map((project) => project.taskId))
  if (taskIds.size !== normalizedProjects.length) return { ok: false, error: '抓取任务 ID 重复' }
  if (extraction.matchedCount !== normalizedProjects.length || extraction.successCount !== normalizedProjects.length) {
    return { ok: false, error: '抓取数量与项目列表不一致' }
  }

  return {
    ok: true,
    envelope: {
      protocolVersion: EXTRACTION_PROTOCOL_VERSION,
      messageId: value.messageId,
      createdAt: new Date(value.createdAt).toISOString(),
      payload: {
        schemaVersion: 'openflow.requirements.v1',
        source: { app: 'OpenFlow', url: payload.source.url },
        extractedAt: new Date(payload.extractedAt).toISOString(),
        warnings: [...payload.warnings],
        extraction: {
          deadline: extraction.deadline,
          ...(filterMode ? { filterMode } : {}),
          ...(typeof extraction.statusFilter === 'string' ? { statusFilter: extraction.statusFilter } : {}),
          matchedCount: extraction.matchedCount,
          successCount: extraction.successCount,
          failedCount: 0,
          complete: true,
        },
        projects: normalizedProjects,
      },
    },
  }
}
