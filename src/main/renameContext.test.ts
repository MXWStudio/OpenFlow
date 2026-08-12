import { describe, it } from 'node:test'
import assert from 'node:assert'
import { join } from 'path'
import { getResolutionFolderContext } from './renameContext.ts'

describe('getResolutionFolderContext', () => {
  it('uses the project folder name for files directly inside a resolution folder', () => {
    const filePath = join('/workspace', 'Project A', '1080x1920', 'clip.mp4')
    const context = getResolutionFolderContext(filePath)

    assert.ok(context)
    assert.strictEqual(context.projectRoot, join('/workspace', 'Project A'))
    assert.strictEqual(context.resolutionFolderName, '1080x1920')
    assert.strictEqual(context.namingProjectName, 'Project A')
  })

  it('uses the first folder below the resolution folder for nested batch exports', () => {
    const filePath = join('/workspace', 'Project A', '1080x1920', 'Game Name', 'clip.mp4')
    const context = getResolutionFolderContext(filePath)

    assert.ok(context)
    assert.strictEqual(context.projectRoot, join('/workspace', 'Project A'))
    assert.strictEqual(context.resolutionFolderName, '1080x1920')
    assert.strictEqual(context.namingProjectName, 'Game Name')
  })

  it('keeps deeper nested files attached to the game folder below the resolution folder', () => {
    const filePath = join('/workspace', 'Project A', '1080x1920', 'Game Name', 'exports', 'clip.mp4')
    const context = getResolutionFolderContext(filePath)

    assert.ok(context)
    assert.strictEqual(context.projectRoot, join('/workspace', 'Project A'))
    assert.strictEqual(context.resolutionFolderName, '1080x1920')
    assert.strictEqual(context.namingProjectName, 'Game Name')
  })
})
