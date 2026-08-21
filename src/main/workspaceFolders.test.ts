import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { join, resolve } from 'path'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  getWorkspaceDeleteLevel,
  createWorkspaceFolders,
  inferDateName,
  inferMonthName,
  inferProjectMediaKinds,
  isWithinWorkspace,
  safeWorkspaceSegment,
} from './workspaceFolders.ts'
import { DEFAULT_WORKSPACE_AUTOMATION } from '../shared/workspaceContract.ts'

describe('workspace folder rules', () => {
  it('infers sibling month and date styles', () => {
    assert.deepEqual(inferMonthName(['7月'], 8), { name: '8月', ambiguous: false })
    assert.deepEqual(inferMonthName(['07'], 8), { name: '08', ambiguous: false })
    assert.deepEqual(inferDateName(['0719'], 8, 20), { name: '0820', ambiguous: false })
    assert.deepEqual(inferDateName(['7月19日'], 8, 20), { name: '8月20日', ambiguous: false })
    assert.equal(inferMonthName(['7月', '08'], 9).ambiguous, true)
  })

  it('sanitizes one path segment and rejects traversal boundaries', () => {
    assert.equal(safeWorkspaceSegment('游戏:名称/..'), '游戏名称')
    const root = resolve('D:/workspace')
    assert.equal(isWithinWorkspace(root, join(root, '2026', '8月')), true)
    assert.equal(isWithinWorkspace(root, resolve(root, '..', 'outside')), false)
  })

  it('infers media and only permits supported cleanup levels', () => {
    assert.deepEqual(inferProjectMediaKinds({ projectName: 'A', sizes: [], materialType: '视频' }), ['video'])
    assert.deepEqual(inferProjectMediaKinds({ projectName: 'A', sizes: [], materialType: '图片和视频' }), ['image', 'video'])
    const root = resolve('D:/workspace')
    assert.equal(getWorkspaceDeleteLevel(root, join(root, '2026')), 'year')
    assert.equal(getWorkspaceDeleteLevel(root, join(root, '2026', '8月')), 'month')
    assert.equal(getWorkspaceDeleteLevel(root, join(root, '2026', '8月', '8.20')), 'date')
    assert.equal(getWorkspaceDeleteLevel(root, join(root, '2026', '8月', '8.20', '图片', '游戏')), 'game')
  })

  it('creates the full daily tree idempotently without overwriting existing content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openflow-workspace-'))
    try {
      const request = {
        projects: [{ projectName: '测试游戏', sizes: ['1080*1920'], materialType: '图片和视频' }],
        settings: { ...DEFAULT_WORKSPACE_AUTOMATION, rootDir: root },
        now: '2026-08-20T12:00:00',
      }
      const first = await createWorkspaceFolders(request)
      assert.equal(first.success, true)
      const imageGame = join(root, '2026', '8月', '8.20', '图片', '测试游戏')
      const videoGame = join(root, '2026', '8月', '8.20', '视频', '测试游戏')
      assert.equal(first.projectPaths?.includes(imageGame), true)
      assert.equal(first.projectPaths?.includes(videoGame), true)
      const sentinel = join(imageGame, '1080x1920', '保留.txt')
      await writeFile(sentinel, 'keep', 'utf8')
      const second = await createWorkspaceFolders(request)
      assert.equal(second.success, true)
      assert.equal(await readFile(sentinel, 'utf8'), 'keep')
      assert.equal(second.reusedPaths?.includes(imageGame), true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('pauses for ambiguous folder styles and unknown media instead of guessing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openflow-workspace-conflict-'))
    try {
      await mkdir(join(root, '2026', '7月'), { recursive: true })
      await mkdir(join(root, '2026', '08'), { recursive: true })
      const baseRequest = {
        projects: [{ projectName: '待确认游戏', sizes: ['1080*1920'] }],
        settings: { ...DEFAULT_WORKSPACE_AUTOMATION, rootDir: root },
        now: '2026-09-20T12:00:00',
      }
      const monthConflict = await createWorkspaceFolders(baseRequest)
      assert.equal(monthConflict.conflict?.kind, 'month-style')

      const mediaConflict = await createWorkspaceFolders({
        ...baseRequest,
        overrides: { monthStyle: 'm-cn' },
      })
      assert.equal(mediaConflict.conflict?.kind, 'media-kind')

      const resolved = await createWorkspaceFolders({
        ...baseRequest,
        overrides: { monthStyle: 'm-cn', fallbackMediaKinds: ['image'] },
      })
      assert.equal(resolved.success, true)
      assert.equal(resolved.projectPaths?.length, 1)
      assert.equal(resolved.projectPaths?.[0].includes(join('图片', '待确认游戏')), true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
