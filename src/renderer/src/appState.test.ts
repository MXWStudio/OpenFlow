import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCustomPreset, migrateLegacyRenameTemplates } from '../../shared/renameTemplates.ts'
import { DEFAULT_WORKFLOW, hydrateWorkflowSettings } from './appState.ts'

describe('workflow settings hydration', () => {
  it('hydrates the persisted v2 named-template source without falling back to legacy data', () => {
    const renameSettings = migrateLegacyRenameTemplates()
    const custom = createCustomPreset('团队渠道模板')
    custom.rules.image.tokens = [{ id: 'custom', type: 'CustomText', value: '渠道验收' }]
    renameSettings.presets.push(custom)
    renameSettings.lastCustomPresetId = custom.id

    const hydrated = hydrateWorkflowSettings({
      workflow: {
        ...DEFAULT_WORKFLOW,
        renameSettings,
      },
      renameTemplates: {
        imageManual: [{ type: 'CustomText', value: '不应覆盖V2' }],
      },
    })

    assert.strictEqual(hydrated.renameSettings.lastCustomPresetId, custom.id)
    assert.strictEqual(hydrated.renameSettings.presets.find((preset) => preset.id === custom.id)?.rules.image.tokens[0].value, '渠道验收')
  })

  it('migrates legacy hand-made image and video custom text when v2 settings are absent', () => {
    const hydrated = hydrateWorkflowSettings({
      workflow: {
        organizerFormats: ['jpg', 'mp4'],
        renameTemplates: {
          imageManual: [{ type: 'CustomText', value: '旧手搓图' }],
          videoManual: [{ type: 'CustomText', value: '旧手搓视频' }],
        },
      },
    })
    const manual = hydrated.renameSettings.presets.find((preset) => preset.kind === 'custom')

    assert.ok(manual)
    assert.strictEqual(manual.rules.image.tokens[0].value, '旧手搓图')
    assert.strictEqual(manual.rules.video.tokens[0].value, '旧手搓视频')
  })
})
