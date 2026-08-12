import { pinyin as toPinyin } from 'pinyin-pro'

export const RENAME_SETTINGS_SCHEMA = 'openflow.rename.v2' as const

export type RenameMediaType = 'image' | 'video'
export type RenamePresetKind = 'regular' | 'special' | 'custom'
export type RenameMode = 'regular' | 'special' | 'custom'
export type RenameDateFormat = 'YYYYMMDD' | 'YYYY-MM-DD' | 'MMDD'
export type RenameTokenType =
  | 'ProjectName'
  | 'CleanProjectName'
  | 'Date'
  | 'Producer'
  | 'Resolution'
  | 'AspectRatio'
  | 'Sequence'
  | 'OriginalName'
  | 'CustomText'

export interface RenameToken {
  id: string
  type: RenameTokenType
  value?: string
}

export interface RenameSequenceOptions {
  start: number
  padding: number
  prefix: string
  suffix: string
}

export interface RenameRule {
  tokens: RenameToken[]
  separator: string
  dateFormat: RenameDateFormat
  sequence: RenameSequenceOptions
}

export interface RenamePreset {
  id: string
  name: string
  kind: RenamePresetKind
  rules: Record<RenameMediaType, RenameRule>
}

export interface RenameSettingsV2 {
  schemaVersion: typeof RENAME_SETTINGS_SCHEMA
  presets: RenamePreset[]
  lastCustomPresetId: string | null
}

export interface RenameSelection {
  mode: RenameMode
  customPresetId?: string | null
}

export interface RenameFileInput {
  filePath: string
  fileName: string
  ext: string
  status: 'valid' | 'mismatch' | 'missing' | 'error' | 'format_error'
  actualWidth: number
  actualHeight: number
}

export interface RenameRequest {
  files: RenameFileInput[]
  settings: RenameSettingsV2
  selection: RenameSelection
  projectName: string
  producer?: string
  now?: Date
}

export type RenamePlanStatus = 'ready' | 'noop' | 'blocked'

export interface RenamePlanItem {
  oldPath: string
  newPath: string
  oldFileName: string
  newFileName: string
  presetId?: string
  presetName?: string
  mediaType?: RenameMediaType
  status: RenamePlanStatus
  errorCode?: string
  error?: string
}

export interface RenamePreview {
  canExecute: boolean
  items: RenamePlanItem[]
  errorCount: number
}

export interface RenameExecutionItem {
  oldPath: string
  newPath: string
  oldFileName: string
  newFileName: string
  success: boolean
  status: 'renamed' | 'noop' | 'failed'
  errorCode?: string
  error?: string
}

export interface RenameBatchResult {
  successCount: number
  failedCount: number
  results: RenameExecutionItem[]
  preview: RenamePreview
}

export type LegacyTemplateKey =
  | 'videoRegular'
  | 'videoSpecial'
  | 'videoManual'
  | 'imageRegular'
  | 'imageSpecial'
  | 'imageManual'

export interface LegacyRenameToken {
  type: string
  value?: string
}

export type LegacyRenameTemplates = Partial<Record<LegacyTemplateKey, LegacyRenameToken[]>>

export interface RenameVariables {
  ProjectName: string
  CleanProjectName: string
  Date: Date
  Producer: string
  Resolution: string
  AspectRatio: string
  OriginalName: string
}

export type RenameRenderResult =
  | { ok: true; value: string }
  | { ok: false; error: string; tokenId?: string }

export const RENAME_TOKEN_LABELS: Record<RenameTokenType, string> = {
  ProjectName: '项目名',
  CleanProjectName: '清理后项目名',
  Date: '日期',
  Producer: '制作人缩写',
  Resolution: '分辨率',
  AspectRatio: '横竖',
  Sequence: '序号',
  OriginalName: '原文件名',
  CustomText: '自定义文本',
}

export const RENAME_TOKEN_OPTIONS = (Object.entries(RENAME_TOKEN_LABELS) as Array<[RenameTokenType, string]>)
  .map(([value, label]) => ({ value, label }))

const DEFAULT_LEGACY_TEMPLATES: Required<LegacyRenameTemplates> = {
  videoRegular: [
    { type: 'CustomText', value: 'RSQM' },
    { type: 'Date' },
    { type: 'ProjectName' },
    { type: 'Producer' },
    { type: 'AspectRatio' },
    { type: 'Sequence' },
  ],
  videoSpecial: [
    { type: 'ProjectName' },
    { type: 'CustomText', value: '激励视频' },
    { type: 'Date' },
    { type: 'AspectRatio' },
    { type: 'Producer' },
    { type: 'CustomText', value: 'RSQM' },
    { type: 'Sequence' },
  ],
  videoManual: [
    { type: 'CustomText', value: 'RS' },
    { type: 'Date' },
    { type: 'ProjectName' },
    { type: 'Producer' },
    { type: 'AspectRatio' },
    { type: 'Sequence' },
  ],
  imageRegular: [
    { type: 'CustomText', value: 'RSQ' },
    { type: 'Date' },
    { type: 'ProjectName' },
    { type: 'Resolution' },
    { type: 'Producer' },
    { type: 'Sequence' },
  ],
  imageSpecial: [
    { type: 'CustomText', value: 'RSQ' },
    { type: 'Date' },
    { type: 'ProjectName' },
    { type: 'Resolution' },
    { type: 'Producer' },
    { type: 'Sequence' },
  ],
  imageManual: [
    { type: 'CustomText', value: 'RS' },
    { type: 'Date' },
    { type: 'ProjectName' },
    { type: 'Producer' },
    { type: 'AspectRatio' },
    { type: 'Sequence' },
  ],
}

let fallbackIdCounter = 0

function makeId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}-${uuid}`
  fallbackIdCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`
}

function isRenameTokenType(value: unknown): value is RenameTokenType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RENAME_TOKEN_LABELS, value)
}

function toRenameTokens(tokens: LegacyRenameToken[] | undefined, fallback: LegacyRenameToken[]): RenameToken[] {
  const source = Array.isArray(tokens) ? tokens : fallback
  return source
    .filter((token) => token && isRenameTokenType(token.type))
    .map((token, index) => ({
      id: `legacy-${index}-${token.type}`,
      type: token.type as RenameTokenType,
      ...(token.type === 'CustomText' ? { value: token.value ?? '' } : {}),
    }))
}

function defaultRule(tokens: LegacyRenameToken[]): RenameRule {
  return {
    tokens: toRenameTokens(tokens, tokens),
    separator: '-',
    dateFormat: 'YYYYMMDD',
    sequence: { start: 1, padding: 0, prefix: '(', suffix: ')' },
  }
}

function presetFromLegacy(
  id: string,
  name: string,
  kind: RenamePresetKind,
  templates: LegacyRenameTemplates,
  imageKey: LegacyTemplateKey,
  videoKey: LegacyTemplateKey,
): RenamePreset {
  return {
    id,
    name,
    kind,
    rules: {
      image: defaultRule(toRenameTokens(templates[imageKey], DEFAULT_LEGACY_TEMPLATES[imageKey])),
      video: defaultRule(toRenameTokens(templates[videoKey], DEFAULT_LEGACY_TEMPLATES[videoKey])),
    },
  }
}

export function migrateLegacyRenameTemplates(templates: LegacyRenameTemplates = {}): RenameSettingsV2 {
  return {
    schemaVersion: RENAME_SETTINGS_SCHEMA,
    presets: [
      presetFromLegacy('system-regular', '常规命名', 'regular', templates, 'imageRegular', 'videoRegular'),
      presetFromLegacy('system-special', '特殊版块', 'special', templates, 'imageSpecial', 'videoSpecial'),
      presetFromLegacy('legacy-manual', '手搓命名', 'custom', templates, 'imageManual', 'videoManual'),
    ],
    lastCustomPresetId: 'legacy-manual',
  }
}

export const DEFAULT_RENAME_SETTINGS: RenameSettingsV2 = migrateLegacyRenameTemplates()

export function createRenameToken(type: RenameTokenType = 'ProjectName', value?: string): RenameToken {
  return {
    id: makeId('token'),
    type,
    ...(type === 'CustomText' ? { value: value ?? '' } : {}),
  }
}

function createDefaultCustomRule(): RenameRule {
  return {
    tokens: [
      createRenameToken('ProjectName'),
      createRenameToken('Sequence'),
    ],
    separator: '-',
    dateFormat: 'YYYYMMDD',
    sequence: { start: 1, padding: 0, prefix: '(', suffix: ')' },
  }
}

export function createCustomPreset(name = '新建模板'): RenamePreset {
  return {
    id: makeId('preset'),
    name,
    kind: 'custom',
    rules: {
      image: createDefaultCustomRule(),
      video: createDefaultCustomRule(),
    },
  }
}

export function cloneRenamePreset(preset: RenamePreset, name = `${preset.name} 副本`): RenamePreset {
  const cloneRule = (rule: RenameRule): RenameRule => ({
    ...rule,
    sequence: { ...rule.sequence },
    tokens: rule.tokens.map((token) => ({ ...token, id: makeId('token') })),
  })
  return {
    id: makeId('preset'),
    name,
    kind: 'custom',
    rules: {
      image: cloneRule(preset.rules.image),
      video: cloneRule(preset.rules.video),
    },
  }
}

export function addRenamePreset(settings: RenameSettingsV2, preset: RenamePreset): RenameSettingsV2 {
  return {
    ...settings,
    presets: [...settings.presets, preset],
    lastCustomPresetId: preset.kind === 'custom' ? preset.id : settings.lastCustomPresetId,
  }
}

export function renameRenamePreset(
  settings: RenameSettingsV2,
  presetId: string,
  name: string,
): RenameSettingsV2 {
  return {
    ...settings,
    presets: settings.presets.map((preset) => preset.id === presetId && preset.kind === 'custom'
      ? { ...preset, name }
      : preset),
  }
}

export function deleteRenamePreset(settings: RenameSettingsV2, presetId: string): RenameSettingsV2 {
  const target = settings.presets.find((preset) => preset.id === presetId)
  if (!target || target.kind !== 'custom') return settings

  const presets = settings.presets.filter((preset) => preset.id !== presetId)
  const nextCustom = presets.find((preset) => preset.kind === 'custom')
  return {
    ...settings,
    presets,
    lastCustomPresetId: settings.lastCustomPresetId === presetId
      ? nextCustom?.id || null
      : settings.lastCustomPresetId,
  }
}

export function moveRenameToken(rule: RenameRule, tokenId: string, direction: -1 | 1): RenameRule {
  const index = rule.tokens.findIndex((token) => token.id === tokenId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= rule.tokens.length) return rule
  const tokens = [...rule.tokens]
  const [token] = tokens.splice(index, 1)
  tokens.splice(nextIndex, 0, token)
  return { ...rule, tokens }
}

export function filterRenamePresets(presets: RenamePreset[], query: string): RenamePreset[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return presets
  return presets.filter((preset) => {
    const kindLabel = preset.kind === 'custom' ? '自定义 手搓' : preset.kind === 'special' ? '系统 特殊' : '系统 常规'
    return `${preset.name} ${kindLabel} 图片 视频`.toLocaleLowerCase().includes(normalized)
  })
}

function validateRule(rule: RenameRule, label: string): string[] {
  const errors: string[] = []
  const invalidPathChars = /[<>:"/\\|?*\u0000-\u001f]/
  if (!Array.isArray(rule.tokens) || rule.tokens.length === 0) errors.push(`${label}至少需要一个字段`)
  for (const token of rule.tokens || []) {
    if (!isRenameTokenType(token.type)) errors.push(`${label}包含未知字段`)
    if (token.type === 'CustomText' && !token.value?.trim()) errors.push(`${label}的自定义文本不能为空`)
    if (token.type === 'CustomText' && token.value && invalidPathChars.test(token.value)) {
      errors.push(`${label}的自定义文本包含文件名禁用字符`)
    }
  }
  if (invalidPathChars.test(rule.separator)) errors.push(`${label}的连接符包含文件名禁用字符`)
  if (invalidPathChars.test(rule.sequence.prefix) || invalidPathChars.test(rule.sequence.suffix)) {
    errors.push(`${label}的序号包裹符包含文件名禁用字符`)
  }
  if (!Number.isInteger(rule.sequence.start) || rule.sequence.start < 0) errors.push(`${label}的序号起点必须是非负整数`)
  if (!Number.isInteger(rule.sequence.padding) || rule.sequence.padding < 0 || rule.sequence.padding > 6) {
    errors.push(`${label}的序号补零位数必须在 0–6 之间`)
  }
  if (!['YYYYMMDD', 'YYYY-MM-DD', 'MMDD'].includes(rule.dateFormat)) errors.push(`${label}的日期格式无效`)
  return errors
}

export function validateRenamePreset(preset: RenamePreset): string[] {
  const errors: string[] = []
  if (!preset.name.trim()) errors.push('模板名称不能为空')
  errors.push(...validateRule(preset.rules.image, '图片规则'))
  errors.push(...validateRule(preset.rules.video, '视频规则'))
  return errors
}

export function validateRenameSettings(settings: RenameSettingsV2): string[] {
  const errors = settings.presets.flatMap(validateRenamePreset)
  const seen = new Set<string>()
  for (const preset of settings.presets) {
    const key = preset.name.trim().toLocaleLowerCase()
    if (seen.has(key)) errors.push(`模板名称“${preset.name}”重复`)
    seen.add(key)
  }
  if (!settings.presets.some((preset) => preset.kind === 'regular')) errors.push('缺少常规模板')
  if (!settings.presets.some((preset) => preset.kind === 'special')) errors.push('缺少特殊模板')
  return errors
}

export function formatRenameDate(date: Date, format: RenameDateFormat): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`
  if (format === 'MMDD') return `${month}${day}`
  return `${year}${month}${day}`
}

export function formatRenameSequence(sequence: number, options: RenameSequenceOptions): string {
  const raw = String(sequence).padStart(options.padding, '0')
  return `${options.prefix}${raw}${options.suffix}`
}

export function formatRenameProducer(producer: string): string {
  if (!producer.trim()) return ''
  return toPinyin(producer, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toUpperCase()
}

export function renderRenameRule(
  rule: RenameRule,
  variables: RenameVariables,
  sequence: number,
): RenameRenderResult {
  const staticErrors = validateRule(rule, '命名规则')
  if (staticErrors.length > 0) return { ok: false, error: staticErrors[0] }

  const parts: string[] = []
  for (const token of rule.tokens) {
    let value = ''
    if (token.type === 'CustomText') value = token.value ?? ''
    else if (token.type === 'Date') value = formatRenameDate(variables.Date, rule.dateFormat)
    else if (token.type === 'Sequence') value = formatRenameSequence(sequence, rule.sequence)
    else value = variables[token.type]

    if (!value?.trim()) {
      return { ok: false, error: `${RENAME_TOKEN_LABELS[token.type]}为空`, tokenId: token.id }
    }
    parts.push(value)
  }

  const value = parts.join(rule.separator).normalize('NFC')
  if (!value.trim()) return { ok: false, error: '命名规则没有生成有效文件名' }
  if (/[<>:"/\\|?*\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, error: '生成的文件名包含系统禁用字符' }
  }
  if (/^[. ]|[. ]$/.test(value)) {
    return { ok: false, error: '生成的文件名不能以点或空格开头、结尾' }
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    return { ok: false, error: `“${value}”是系统保留文件名，请调整模板` }
  }
  return { ok: true, value }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isRenameSettingsV2(value: unknown): value is RenameSettingsV2 {
  return isRecord(value) && value.schemaVersion === RENAME_SETTINGS_SCHEMA && Array.isArray(value.presets)
}

export function normalizeRenameSettings(value: unknown, legacy?: LegacyRenameTemplates): RenameSettingsV2 {
  if (!isRenameSettingsV2(value)) return migrateLegacyRenameTemplates(legacy)

  const presets = value.presets.filter((preset): preset is RenamePreset => {
    return Boolean(preset?.id && preset?.name && preset?.rules?.image && preset?.rules?.video)
  })
  const normalized = presets.length > 0
    ? { schemaVersion: RENAME_SETTINGS_SCHEMA, presets, lastCustomPresetId: value.lastCustomPresetId ?? null }
    : migrateLegacyRenameTemplates(legacy)

  if (!normalized.presets.some((preset) => preset.kind === 'regular')) {
    normalized.presets.unshift(migrateLegacyRenameTemplates().presets[0])
  }
  if (!normalized.presets.some((preset) => preset.kind === 'special')) {
    normalized.presets.splice(1, 0, migrateLegacyRenameTemplates().presets[1])
  }
  return normalized
}

export function getRenamePreset(settings: RenameSettingsV2, id: string | null | undefined): RenamePreset | undefined {
  return settings.presets.find((preset) => preset.id === id)
}
