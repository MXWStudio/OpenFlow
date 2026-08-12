import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addRenamePreset,
  cloneRenamePreset,
  createCustomPreset,
  deleteRenamePreset,
  filterRenamePresets,
  formatRenameProducer,
  migrateLegacyRenameTemplates,
  moveRenameToken,
  renameRenamePreset,
  renderRenameRule,
  validateRenamePreset,
  type LegacyRenameTemplates,
  type RenameRule,
} from './renameTemplates.ts'

const legacyTemplates: LegacyRenameTemplates = {
  videoRegular: [{ type: 'ProjectName' }, { type: 'Sequence' }],
  videoSpecial: [{ type: 'CustomText', value: 'SPECIAL-VIDEO' }, { type: 'Sequence' }],
  videoManual: [{ type: 'CustomText', value: '手搓视频' }, { type: 'OriginalName' }],
  imageRegular: [{ type: 'ProjectName' }, { type: 'Resolution' }, { type: 'Sequence' }],
  imageSpecial: [{ type: 'CustomText', value: 'SPECIAL-IMAGE' }, { type: 'Sequence' }],
  imageManual: [{ type: 'CustomText', value: '手搓图片' }, { type: 'OriginalName' }],
}

describe('rename template domain', () => {
  it('formats producer names exactly once for both preview and execution', () => {
    assert.strictEqual(formatRenameProducer('孟祥伟'), 'MXW')
    assert.strictEqual(formatRenameProducer(''), '')
  })

  it('migrates both legacy manual branches into one named custom preset without losing custom text', () => {
    const settings = migrateLegacyRenameTemplates(legacyTemplates)
    const manual = settings.presets.find((preset) => preset.kind === 'custom')

    assert.ok(manual)
    assert.strictEqual(manual.name, '手搓命名')
    assert.deepStrictEqual(
      manual.rules.video.tokens.map((token) => [token.type, token.value]),
      [['CustomText', '手搓视频'], ['OriginalName', undefined]],
    )
    assert.deepStrictEqual(
      manual.rules.image.tokens.map((token) => [token.type, token.value]),
      [['CustomText', '手搓图片'], ['OriginalName', undefined]],
    )
  })

  it('renders custom text, configurable separators, local date format and padded sequences in field order', () => {
    const rule: RenameRule = {
      separator: '_',
      dateFormat: 'YYYY-MM-DD',
      sequence: { start: 7, padding: 3, prefix: '[', suffix: ']' },
      tokens: [
        { id: 'custom', type: 'CustomText', value: '突发活动' },
        { id: 'date', type: 'Date' },
        { id: 'project', type: 'ProjectName' },
        { id: 'sequence', type: 'Sequence' },
      ],
    }

    const result = renderRenameRule(rule, {
      ProjectName: '小火车',
      CleanProjectName: '小火车',
      Date: new Date(2026, 6, 14),
      Producer: 'MXY',
      Resolution: '1080x1920',
      AspectRatio: '竖',
      OriginalName: 'original',
    }, 7)

    assert.deepStrictEqual(result, { ok: true, value: '突发活动_2026-07-14_小火车_[007]' })
  })

  it('rejects empty custom text and missing runtime variables instead of inserting fake placeholders', () => {
    const preset = createCustomPreset('临时模板')
    preset.rules.image.tokens = [{ id: 'custom', type: 'CustomText', value: '' }]

    assert.match(validateRenamePreset(preset).join('\n'), /自定义文本不能为空/)

    preset.rules.image.tokens = [{ id: 'producer', type: 'Producer' }]
    const result = renderRenameRule(preset.rules.image, {
      ProjectName: '项目',
      CleanProjectName: '项目',
      Date: new Date(2026, 6, 14),
      Producer: '',
      Resolution: '1080x1920',
      AspectRatio: '竖',
      OriginalName: 'original',
    }, 1)

    assert.strictEqual(result.ok, false)
    if (!result.ok) assert.match(result.error, /制作人缩写/)
  })

  it('rejects path control characters in custom text instead of silently changing the request', () => {
    const preset = createCustomPreset('非法字符测试')
    preset.rules.image.tokens = [{ id: 'unsafe', type: 'CustomText', value: '渠道/交付' }]

    assert.match(validateRenamePreset(preset).join('；'), /文件名禁用字符/)
  })

  it('blocks reserved or trailing-dot names in the shared renderer used by settings and execution', () => {
    const preset = createCustomPreset('系统保留名')
    const variables = {
      ProjectName: '项目',
      CleanProjectName: '项目',
      Date: new Date(2026, 6, 14),
      Producer: 'MXW',
      Resolution: '1080x1920',
      AspectRatio: '竖',
      OriginalName: 'original',
    }
    preset.rules.image.tokens = [{ id: 'reserved', type: 'CustomText', value: 'CON' }]
    const reserved = renderRenameRule(preset.rules.image, variables, 1)
    assert.strictEqual(reserved.ok, false)
    if (!reserved.ok) assert.match(reserved.error, /系统保留文件名/)

    preset.rules.image.tokens = [{ id: 'trailing-dot', type: 'CustomText', value: '交付图.' }]
    const trailingDot = renderRenameRule(preset.rules.image, variables, 1)
    assert.strictEqual(trailingDot.ok, false)
    if (!trailingDot.ok) assert.match(trailingDot.error, /点或空格/)

    preset.rules.image.tokens = [{ id: 'spacing', type: 'CustomText', value: '渠道  A' }]
    assert.deepStrictEqual(renderRenameRule(preset.rules.image, variables, 1), { ok: true, value: '渠道  A' })
  })

  it('creates, copies, renames and deletes named custom presets without mutating system presets', () => {
    const initial = migrateLegacyRenameTemplates(legacyTemplates)
    const created = createCustomPreset('团队模板')
    const afterCreate = addRenamePreset(initial, created)
    const copy = cloneRenamePreset(created, '团队模板副本')
    const afterCopy = addRenamePreset(afterCreate, copy)
    const afterRename = renameRenamePreset(afterCopy, copy.id, '渠道应急模板')
    const afterDelete = deleteRenamePreset(afterRename, created.id)

    assert.ok(afterCreate.presets.some((preset) => preset.id === created.id))
    assert.notStrictEqual(copy.id, created.id)
    assert.ok(copy.rules.image.tokens.every((token, index) => token.id !== created.rules.image.tokens[index]?.id))
    assert.strictEqual(afterRename.presets.find((preset) => preset.id === copy.id)?.name, '渠道应急模板')
    assert.strictEqual(afterDelete.presets.some((preset) => preset.id === created.id), false)
    assert.strictEqual(afterDelete.lastCustomPresetId, copy.id)

    const regular = initial.presets.find((preset) => preset.kind === 'regular')!
    assert.strictEqual(renameRenamePreset(afterDelete, regular.id, '不可改名').presets.find((preset) => preset.id === regular.id)?.name, regular.name)
    assert.strictEqual(deleteRenamePreset(afterDelete, regular.id), afterDelete)
  })

  it('moves fields by stable id and searches named templates by category labels', () => {
    const preset = createCustomPreset('渠道临时模板')
    preset.rules.image.tokens = [
      { id: 'project', type: 'ProjectName' },
      { id: 'custom', type: 'CustomText', value: '渠道A' },
      { id: 'sequence', type: 'Sequence' },
    ]

    const moved = moveRenameToken(preset.rules.image, 'custom', -1)
    assert.deepStrictEqual(moved.tokens.map((token) => token.id), ['custom', 'project', 'sequence'])

    const settings = migrateLegacyRenameTemplates(legacyTemplates)
    settings.presets.push(preset)
    assert.deepStrictEqual(filterRenamePresets(settings.presets, '渠道').map((item) => item.id), [preset.id])
    assert.ok(filterRenamePresets(settings.presets, '系统').some((item) => item.kind === 'regular'))
  })
})
