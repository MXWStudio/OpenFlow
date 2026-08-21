import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { join } from 'node:path'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { discoverWorkspaceCleanupTargets, listWorkspaceCleanupChildren, pruneEmptyWorkspaceParents, scanWorkspaceCleanup } from './workspaceCleanup.ts'

describe('workspace cleanup safety', () => {
  it('lists a lazy selectable tree while keeping year and media layers protected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openflow-cleanup-tree-'))
    try {
      const game = join(root, '2026', '8月', '8.20', '图片', '测试游戏')
      await mkdir(join(game, '测试游戏-奇觅生成'), { recursive: true })

      const rootResult = await listWorkspaceCleanupChildren({ rootDir: root })
      assert.equal(rootResult.success, true)
      assert.deepEqual(rootResult.nodes.map((node) => [node.name, node.level, node.selectable, node.hasChildren]), [
        ['2026', 'year', false, true],
      ])

      const yearResult = await listWorkspaceCleanupChildren({ rootDir: root, parentPath: join(root, '2026') })
      assert.deepEqual(yearResult.nodes.map((node) => [node.name, node.level, node.selectable]), [
        ['8月', 'month', true],
      ])
      const dateResult = await listWorkspaceCleanupChildren({ rootDir: root, parentPath: join(root, '2026', '8月', '8.20') })
      assert.deepEqual(dateResult.nodes.map((node) => [node.name, node.level, node.selectable]), [
        ['图片', 'media', false],
      ])
      const mediaResult = await listWorkspaceCleanupChildren({ rootDir: root, parentPath: join(root, '2026', '8月', '8.20', '图片') })
      assert.deepEqual(mediaResult.nodes.map((node) => [node.name, node.level, node.selectable]), [
        ['测试游戏', 'game', true],
      ])

      const activeMonthResult = await listWorkspaceCleanupChildren({
        rootDir: root,
        parentPath: join(root, '2026'),
        activePaths: [game],
      })
      assert.equal(activeMonthResult.nodes[0]?.selectable, false)
      assert.match(activeMonthResult.nodes[0]?.protectedReason || '', /正在使用/)
      assert.equal(activeMonthResult.nodes[0]?.hasChildren, true)

      const activeGameResult = await listWorkspaceCleanupChildren({
        rootDir: root,
        parentPath: join(root, '2026', '8月', '8.20', '图片'),
        activePaths: [game],
      })
      assert.equal(activeGameResult.nodes[0]?.selectable, false)
      assert.match(activeGameResult.nodes[0]?.protectedReason || '', /正在使用/)

      const outside = await listWorkspaceCleanupChildren({ rootDir: root, parentPath: tmpdir() })
      assert.equal(outside.success, false)
      assert.equal(outside.error, '只能浏览工作区内的目录。')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('expands a whole game across image and video while protecting year and active paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openflow-cleanup-'))
    try {
      const imageGame = join(root, '2026', '8月', '8.20', '图片', '测试游戏')
      const videoGame = join(root, '2026', '8月', '8.20', '视频', '测试游戏')
      await mkdir(imageGame, { recursive: true })
      await mkdir(videoGame, { recursive: true })
      await writeFile(join(imageGame, 'a.png'), 'image')
      await writeFile(join(videoGame, 'a.mp4'), 'video')
      const scan = await scanWorkspaceCleanup({ rootDir: root, targetPaths: [imageGame] })
      assert.equal(scan.success, true)
      assert.deepEqual(new Set(scan.entries.map((entry) => entry.path)), new Set([imageGame, videoGame]))
      assert.equal(scan.totalFiles, 2)

      const blocked = await scanWorkspaceCleanup({
        rootDir: root,
        targetPaths: [join(root, '2026'), imageGame],
        activePaths: [imageGame],
      })
      assert.equal(blocked.entries.length, 0)
      assert.equal(blocked.blockedPaths?.length, 1)
      const activeBlocked = await scanWorkspaceCleanup({ rootDir: root, targetPaths: [imageGame], activePaths: [imageGame] })
      assert.equal(activeBlocked.entries.length, 0)
      assert.equal(activeBlocked.blockedPaths?.length, 2)
      const cancelled = await scanWorkspaceCleanup({ rootDir: root, targetPaths: [imageGame] }, () => true)
      assert.equal(cancelled.success, false)
      assert.equal(cancelled.error, '扫描已取消。')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('discovers configured generated folders across a month and skips active matches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openflow-cleanup-discovery-'))
    try {
      const monthPath = join(root, '2026', '8月')
      const first = join(monthPath, '8.19', '图片', '游戏甲', '游戏甲-奇觅生成')
      const second = join(monthPath, '8.20', '视频', '游戏乙', '游戏乙-奇觅生成')
      const unrelated = join(monthPath, '8.20', '图片', '游戏乙', '游戏乙-即梦生成')
      await mkdir(first, { recursive: true })
      await mkdir(second, { recursive: true })
      await mkdir(unrelated, { recursive: true })
      const result = await discoverWorkspaceCleanupTargets({
        rootDir: root,
        scopePath: monthPath,
        presetSuffixes: ['奇觅生成'],
        activePaths: [second],
      })
      assert.equal(result.success, true)
      assert.deepEqual(result.targetPaths, [first])
      assert.deepEqual(result.blockedPaths, [second])

      const blockedYear = await discoverWorkspaceCleanupTargets({
        rootDir: root,
        scopePath: join(root, '2026'),
        presetSuffixes: ['奇觅生成'],
      })
      assert.equal(blockedYear.success, false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('optionally removes empty parent layers but never removes the workspace root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openflow-cleanup-prune-'))
    try {
      const target = join(root, '2026', '8月', '8.20', '图片', '游戏甲', '游戏甲-奇觅生成')
      await mkdir(target, { recursive: true })
      await rm(target, { recursive: true })
      const pruned = await pruneEmptyWorkspaceParents(root, [target])
      assert.equal(pruned.includes(join(root, '2026')), true)
      await access(root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
