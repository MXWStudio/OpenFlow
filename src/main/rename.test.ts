import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rename, rm, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCustomPreset, migrateLegacyRenameTemplates } from '../shared/renameTemplates.ts'
import { executeRenameRequest, previewRenameRequest, type RenameFileInput } from './rename.ts'

const tempRoots: string[] = []

async function createResolutionDir(projectName = '小火车', resolution = '1080x1920') {
  const root = await mkdtemp(join(tmpdir(), 'openflow-rename-'))
  tempRoots.push(root)
  const dir = join(root, projectName, resolution)
  await mkdir(dir, { recursive: true })
  return dir
}

function input(filePath: string, fileName: string, ext: string): RenameFileInput {
  return {
    filePath,
    fileName,
    ext,
    status: 'valid',
    actualWidth: 1080,
    actualHeight: 1920,
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('rename planner and executor', () => {
  it('allocates deterministic suffixes for a fixed custom template without Sequence', async () => {
    const dir = await createResolutionDir()
    const firstPath = join(dir, 'first.jpg')
    const secondPath = join(dir, 'second.jpg')
    await writeFile(firstPath, 'first')
    await writeFile(secondPath, 'second')

    const settings = migrateLegacyRenameTemplates()
    const preset = createCustomPreset('固定交付名')
    preset.rules.image.tokens = [{ id: 'fixed', type: 'CustomText', value: '交付图' }]
    settings.presets.push(preset)

    const preview = await previewRenameRequest({
      files: [input(firstPath, 'first', '.jpg'), input(secondPath, 'second', '.jpg')],
      settings,
      selection: { mode: 'custom', customPresetId: preset.id },
      projectName: '小火车',
      producer: '孟祥伟',
      now: new Date(2026, 6, 14),
    })

    assert.strictEqual(preview.canExecute, true)
    assert.deepStrictEqual(preview.items.map((item) => item.newFileName), ['交付图.jpg', '交付图-2.jpg'])
  })

  it('never overwrites an existing target, including case-only extension collisions', async () => {
    const dir = await createResolutionDir()
    const sourcePath = join(dir, 'source.jpg')
    const existingPath = join(dir, '交付图.JPG')
    await writeFile(sourcePath, 'source')
    await writeFile(existingPath, 'existing')
    const settings = migrateLegacyRenameTemplates()
    const preset = createCustomPreset('不覆盖已有文件')
    preset.rules.image.tokens = [{ id: 'fixed', type: 'CustomText', value: '交付图' }]
    settings.presets.push(preset)

    const result = await executeRenameRequest({
      files: [input(sourcePath, 'source', '.jpg')],
      settings,
      selection: { mode: 'custom', customPresetId: preset.id },
      projectName: '小火车',
    })

    assert.strictEqual(result.successCount, 1)
    assert.deepStrictEqual((await readdir(dir)).sort(), ['交付图-2.jpg', '交付图.JPG'].sort())
    assert.strictEqual(await readFile(existingPath, 'utf8'), 'existing')
  })

  it('uses custom text in real file names and preserves original video extensions', async () => {
    const dir = await createResolutionDir('游戏A', '1080×1920')
    const imagePath = join(dir, 'image-source.png')
    const videoPath = join(dir, 'video-source.mov')
    await writeFile(imagePath, 'image')
    await writeFile(videoPath, 'video')

    const settings = migrateLegacyRenameTemplates()
    const preset = createCustomPreset('渠道突发模板')
    preset.rules.image.tokens = [
      { id: 'custom-image', type: 'CustomText', value: '渠道图' },
      { id: 'original-image', type: 'OriginalName' },
    ]
    preset.rules.video.tokens = [
      { id: 'custom-video', type: 'CustomText', value: '渠道视频' },
      { id: 'original-video', type: 'OriginalName' },
    ]
    settings.presets.push(preset)

    const result = await executeRenameRequest({
      files: [
        input(imagePath, 'image-source', '.png'),
        input(videoPath, 'video-source', '.mov'),
      ],
      settings,
      selection: { mode: 'custom', customPresetId: preset.id },
      projectName: '游戏A',
      producer: '孟祥伟',
      now: new Date(2026, 6, 14),
    })

    assert.strictEqual(result.successCount, 2)
    assert.strictEqual(result.failedCount, 0)
    assert.deepStrictEqual((await readdir(dir)).sort(), ['渠道图-image-source.png', '渠道视频-video-source.mov'])
  })

  it('blocks an invalid custom selection before touching any file', async () => {
    const dir = await createResolutionDir()
    const sourcePath = join(dir, 'source.jpg')
    await writeFile(sourcePath, 'source')
    const settings = migrateLegacyRenameTemplates()

    const result = await executeRenameRequest({
      files: [input(sourcePath, 'source', '.jpg')],
      settings,
      selection: { mode: 'custom', customPresetId: 'missing-preset' },
      projectName: '小火车',
      producer: '孟祥伟',
      now: new Date(2026, 6, 14),
    })

    assert.strictEqual(result.successCount, 0)
    assert.strictEqual(result.failedCount, 1)
    assert.match(result.results[0].error || '', /自定义模板不存在/)
    assert.deepStrictEqual(await readdir(dir), ['source.jpg'])
  })

  it('uses the explicitly selected special or regular preset', async () => {
    const specialDir = await createResolutionDir('新品（创意比特）')
    const regularDir = await createResolutionDir('常规项目')
    const specialPath = join(specialDir, 'special.jpg')
    const regularPath = join(regularDir, 'regular.jpg')
    await writeFile(specialPath, 'special')
    await writeFile(regularPath, 'regular')
    const settings = migrateLegacyRenameTemplates()

    const specialPreview = await previewRenameRequest({
      files: [input(specialPath, 'special', '.jpg')],
      settings,
      selection: { mode: 'special' },
      projectName: '',
      producer: '孟祥伟',
      now: new Date(2026, 6, 14),
    })
    const regularPreview = await previewRenameRequest({
      files: [input(regularPath, 'regular', '.jpg')],
      settings,
      selection: { mode: 'regular' },
      projectName: '',
      producer: '孟祥伟',
      now: new Date(2026, 6, 14),
    })

    assert.strictEqual(specialPreview.canExecute, true)
    assert.strictEqual(regularPreview.canExecute, true)
    assert.strictEqual(specialPreview.items[0].presetName, '特殊版块')
    assert.strictEqual(regularPreview.items[0].presetName, '常规命名')
  })

  it('reports a partial failure and allows retrying only the failed source', async () => {
    const dir = await createResolutionDir('恢复测试')
    const firstPath = join(dir, 'first.jpg')
    const secondPath = join(dir, 'second.jpg')
    await writeFile(firstPath, 'first')
    await writeFile(secondPath, 'second')
    const settings = migrateLegacyRenameTemplates()
    const preset = createCustomPreset('失败恢复')
    preset.rules.image.tokens = [
      { id: 'fixed', type: 'CustomText', value: '恢复图' },
      { id: 'seq', type: 'Sequence' },
    ]
    settings.presets.push(preset)
    const request = {
      files: [input(firstPath, 'first', '.jpg'), input(secondPath, 'second', '.jpg')],
      settings,
      selection: { mode: 'custom' as const, customPresetId: preset.id },
      projectName: '恢复测试',
      producer: '孟祥伟',
      now: new Date(2026, 6, 14),
    }
    let calls = 0

    const firstResult = await executeRenameRequest(request, {
      renameFile: async (oldPath, newPath) => {
        calls += 1
        if (calls === 2) throw Object.assign(new Error('文件正被占用'), { code: 'EBUSY' })
        await rename(oldPath, newPath)
      },
    })

    assert.strictEqual(firstResult.successCount, 1)
    assert.strictEqual(firstResult.failedCount, 1)
    assert.strictEqual(firstResult.results[1].errorCode, 'EBUSY')
    assert.strictEqual((await readdir(dir)).includes('second.jpg'), true)

    const retryResult = await executeRenameRequest({ ...request, files: [input(secondPath, 'second', '.jpg')] })
    assert.strictEqual(retryResult.successCount, 1)
    assert.strictEqual(retryResult.failedCount, 0)
    assert.deepStrictEqual((await readdir(dir)).sort(), ['恢复图-(1).jpg', '恢复图-(2).jpg'])
  })

  it('blocks overlong generated names before changing the source', async () => {
    const dir = await createResolutionDir('长文本')
    const sourcePath = join(dir, 'source.jpg')
    await writeFile(sourcePath, 'source')
    const settings = migrateLegacyRenameTemplates()
    const preset = createCustomPreset('超长模板')
    preset.rules.image.tokens = [{ id: 'long', type: 'CustomText', value: '长'.repeat(100) }]
    settings.presets.push(preset)

    const result = await executeRenameRequest({
      files: [input(sourcePath, 'source', '.jpg')],
      settings,
      selection: { mode: 'custom', customPresetId: preset.id },
      projectName: '长文本',
    })

    assert.strictEqual(result.successCount, 0)
    assert.strictEqual(result.results[0].errorCode, 'FILE_NAME_TOO_LONG')
    assert.deepStrictEqual(await readdir(dir), ['source.jpg'])
  })

  it('blocks Windows-reserved names identically in preview instead of silently rewriting them', async () => {
    const dir = await createResolutionDir('保留名')
    const sourcePath = join(dir, 'source.jpg')
    await writeFile(sourcePath, 'source')
    const settings = migrateLegacyRenameTemplates()
    const preset = createCustomPreset('保留名模板')
    preset.rules.image.tokens = [{ id: 'reserved', type: 'CustomText', value: 'CON' }]
    settings.presets.push(preset)

    const preview = await previewRenameRequest({
      files: [input(sourcePath, 'source', '.jpg')],
      settings,
      selection: { mode: 'custom', customPresetId: preset.id },
      projectName: '保留名',
    })

    assert.strictEqual(preview.canExecute, false)
    assert.strictEqual(preview.items[0].errorCode, 'INVALID_TEMPLATE')
    assert.match(preview.items[0].error || '', /系统保留文件名/)
    assert.deepStrictEqual(await readdir(dir), ['source.jpg'])
  })
})
