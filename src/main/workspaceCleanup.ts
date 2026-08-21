import { basename, dirname, join, resolve } from 'path'
import fs from 'fs-extra'
import type {
  WorkspaceCleanupDiscoveryRequest,
  WorkspaceCleanupDiscoveryResult,
  WorkspaceCleanupEntry,
  WorkspaceCleanupScanRequest,
  WorkspaceCleanupScanResult,
  WorkspaceCleanupTreeNode,
  WorkspaceCleanupTreeRequest,
  WorkspaceCleanupTreeResult,
} from '../shared/workspaceContract.ts'
import {
  getWorkspaceDeleteLevel,
  isSameOrInside,
  isWithinWorkspace,
} from './workspaceFolders.ts'

class WorkspaceCleanupCancelledError extends Error {}

async function measurePath(targetPath: string, shouldCancel: () => boolean): Promise<{ bytes: number; fileCount: number }> {
  if (shouldCancel()) throw new WorkspaceCleanupCancelledError('扫描已取消。')
  const stat = await fs.lstat(targetPath)
  if (stat.isSymbolicLink()) throw new Error('不允许清理符号链接或目录联接。')
  if (stat.isFile()) return { bytes: stat.size, fileCount: 1 }
  if (!stat.isDirectory()) return { bytes: 0, fileCount: 0 }

  let bytes = 0
  let fileCount = 0
  const names = await fs.readdir(targetPath)
  for (const name of names) {
    const measured = await measurePath(resolve(targetPath, name), shouldCancel)
    bytes += measured.bytes
    fileCount += measured.fileCount
  }
  return { bytes, fileCount }
}

function dedupeTargets(paths: string[]): string[] {
  const normalized = [...new Set(paths.map((path) => resolve(path)))]
  return normalized.filter((candidate) => !normalized.some((other) => other !== candidate && isSameOrInside(other, candidate)))
}

function isPresetFolderName(name: string, suffixes: string[]): boolean {
  const normalizedName = name.toLocaleLowerCase()
  return suffixes.some((suffix) => {
    const normalizedSuffix = suffix.trim().toLocaleLowerCase()
    return normalizedSuffix && (normalizedName === normalizedSuffix || normalizedName.endsWith(`-${normalizedSuffix}`))
  })
}

async function hasRealDirectoryChild(parentPath: string): Promise<boolean> {
  for (const name of await fs.readdir(parentPath)) {
    const stat = await fs.lstat(join(parentPath, name))
    if (!stat.isSymbolicLink() && stat.isDirectory()) return true
  }
  return false
}

/**
 * 懒加载工作区目录树的一层子目录。不会递归扫描，也不会跟随符号链接或目录联接，
 * 因此月份中包含大量素材时仍只承担当前展开层级的开销。
 */
export async function listWorkspaceCleanupChildren(
  request: WorkspaceCleanupTreeRequest,
): Promise<WorkspaceCleanupTreeResult> {
  if (!request.rootDir) return { success: false, parentPath: '', nodes: [], error: '请先选择工作区。' }
  const rootDir = resolve(request.rootDir)
  const parentPath = resolve(request.parentPath || rootDir)
  if (parentPath !== rootDir && !isWithinWorkspace(rootDir, parentPath)) {
    return { success: false, parentPath, nodes: [], error: '只能浏览工作区内的目录。' }
  }

  try {
    if (!await fs.pathExists(parentPath)) return { success: false, parentPath, nodes: [], error: '目录不存在。' }
    const parentStat = await fs.lstat(parentPath)
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
      return { success: false, parentPath, nodes: [], error: '不允许浏览符号链接、目录联接或文件。' }
    }

    const nodes: WorkspaceCleanupTreeNode[] = []
    const activePaths = (request.activePaths || []).map((activePath) => resolve(activePath))
    for (const name of await fs.readdir(parentPath)) {
      const childPath = join(parentPath, name)
      const stat = await fs.lstat(childPath)
      if (stat.isSymbolicLink() || !stat.isDirectory()) continue
      const level = getWorkspaceDeleteLevel(rootDir, childPath)
      if (level === 'invalid') continue
      const activeBlocked = activePaths.some(
        (activePath) => isSameOrInside(childPath, activePath) || isSameOrInside(activePath, childPath),
      )
      const levelSelectable = ['month', 'date', 'game', 'child'].includes(level)
      nodes.push({
        path: childPath,
        name,
        level,
        selectable: levelSelectable && !activeBlocked,
        hasChildren: await hasRealDirectoryChild(childPath),
        protectedReason: activeBlocked && levelSelectable
          ? '当前目录或其子目录正在使用，不能清理'
          : level === 'year'
          ? '年份层仅用于展开，不能直接删除'
          : level === 'media'
            ? '图片／视频层仅用于展开，不能直接删除'
            : undefined,
      })
    }
    nodes.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN', { numeric: true }))
    return { success: true, parentPath, nodes }
  } catch (error) {
    return {
      success: false,
      parentPath,
      nodes: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function discoverWorkspaceCleanupTargets(
  request: WorkspaceCleanupDiscoveryRequest,
): Promise<WorkspaceCleanupDiscoveryResult> {
  const rootDir = resolve(request.rootDir || '')
  const scopePath = resolve(request.scopePath || '')
  const scopeLevel = getWorkspaceDeleteLevel(rootDir, scopePath)
  if (!request.rootDir || !request.scopePath || !['month', 'date', 'game'].includes(scopeLevel)) {
    return { success: false, targetPaths: [], blockedPaths: [], error: '请选择工作区内的月份、日期或游戏目录。' }
  }
  const suffixes = [...new Set((request.presetSuffixes || []).map((suffix) => suffix.trim()).filter(Boolean))]
  if (!suffixes.length) return { success: false, targetPaths: [], blockedPaths: [], error: '请至少选择一种生成目录。' }
  if (!await fs.pathExists(scopePath)) return { success: false, targetPaths: [], blockedPaths: [], error: '所选范围不存在。' }

  const activePaths = (request.activePaths || []).map((path) => resolve(path))
  const targetMap = new Map<string, string>()
  const blockedMap = new Map<string, string>()

  const walk = async (currentPath: string): Promise<void> => {
    const stat = await fs.lstat(currentPath)
    if (stat.isSymbolicLink() || !stat.isDirectory()) return
    const name = basename(currentPath)
    if (currentPath !== scopePath && isPresetFolderName(name, suffixes)) {
      const key = currentPath.toLocaleLowerCase()
      if (activePaths.some((activePath) => isSameOrInside(currentPath, activePath) || isSameOrInside(activePath, currentPath))) {
        blockedMap.set(key, currentPath)
      } else {
        targetMap.set(key, currentPath)
      }
      return
    }
    for (const childName of await fs.readdir(currentPath)) {
      await walk(join(currentPath, childName))
    }
  }

  try {
    await walk(scopePath)
    return {
      success: true,
      targetPaths: [...targetMap.values()].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      blockedPaths: [...blockedMap.values()].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    }
  } catch (error) {
    return {
      success: false,
      targetPaths: [...targetMap.values()],
      blockedPaths: [...blockedMap.values()],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function scanWorkspaceCleanup(
  request: WorkspaceCleanupScanRequest,
  shouldCancel: () => boolean = () => false,
): Promise<WorkspaceCleanupScanResult> {
  const rootDir = resolve(request.rootDir || '')
  if (!request.rootDir) return { success: false, entries: [], totalBytes: 0, totalFiles: 0, error: '请先选择工作区。' }
  const activePaths = (request.activePaths || []).map((path) => resolve(path))
  const blockedPaths: string[] = []
  const entries: WorkspaceCleanupEntry[] = []

  try {
    const expandedTargets = [...(request.targetPaths || [])]
    const allOrNothingBlocked = new Set<string>()
    for (const targetPath of request.targetPaths || []) {
      if (getWorkspaceDeleteLevel(rootDir, targetPath) !== 'game') continue
      const mediaPath = dirname(targetPath)
      const datePath = dirname(mediaPath)
      const counterpartMedia = basename(mediaPath) === '图片' ? '视频' : basename(mediaPath) === '视频' ? '图片' : ''
      if (counterpartMedia) {
        const counterpartPath = join(datePath, counterpartMedia, basename(targetPath))
        expandedTargets.push(counterpartPath)
        const gameTargets = [resolve(targetPath), resolve(counterpartPath)]
        if (gameTargets.some((gamePath) => activePaths.some((activePath) => isSameOrInside(gamePath, activePath) || isSameOrInside(activePath, gamePath)))) {
          gameTargets.forEach((gamePath) => allOrNothingBlocked.add(gamePath))
        }
      }
    }
    for (const targetPath of dedupeTargets(expandedTargets)) {
      if (shouldCancel()) throw new WorkspaceCleanupCancelledError('扫描已取消。')
      const level = getWorkspaceDeleteLevel(rootDir, targetPath)
      if (!isWithinWorkspace(rootDir, targetPath) || level === 'invalid' || level === 'year' || level === 'media') {
        blockedPaths.push(targetPath)
        continue
      }
      if (allOrNothingBlocked.has(resolve(targetPath)) || activePaths.some((activePath) => isSameOrInside(targetPath, activePath) || isSameOrInside(activePath, targetPath))) {
        blockedPaths.push(targetPath)
        continue
      }
      if (!await fs.pathExists(targetPath)) continue
      const stat = await fs.lstat(targetPath)
      if (stat.isSymbolicLink()) {
        blockedPaths.push(targetPath)
        continue
      }
      const measured = await measurePath(targetPath, shouldCancel)
      entries.push({
        path: targetPath,
        name: basename(targetPath),
        kind: stat.isDirectory() ? 'folder' : 'file',
        bytes: measured.bytes,
        fileCount: measured.fileCount,
      })
    }
    return {
      success: true,
      entries,
      totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      totalFiles: entries.reduce((sum, entry) => sum + entry.fileCount, 0),
      blockedPaths,
    }
  } catch (error) {
    return {
      success: false,
      entries,
      totalBytes: 0,
      totalFiles: 0,
      blockedPaths,
      error: error instanceof WorkspaceCleanupCancelledError ? '扫描已取消。' : error instanceof Error ? error.message : String(error),
    }
  }
}

export function validateWorkspaceCleanupTargets(rootDir: string, targetPaths: string[], activePaths: string[] = []): string[] {
  const root = resolve(rootDir)
  const active = activePaths.map((path) => resolve(path))
  return dedupeTargets(targetPaths).filter((targetPath) => {
    const level = getWorkspaceDeleteLevel(root, targetPath)
    if (!['month', 'date', 'game', 'child'].includes(level)) return false
    return !active.some((activePath) => isSameOrInside(targetPath, activePath) || isSameOrInside(activePath, targetPath))
  })
}

export async function pruneEmptyWorkspaceParents(rootDir: string, removedPaths: string[]): Promise<string[]> {
  const root = resolve(rootDir)
  const removedParents: string[] = []
  const visited = new Set<string>()
  for (const removedPath of removedPaths) {
    let candidate = dirname(resolve(removedPath))
    while (candidate !== root && isWithinWorkspace(root, candidate)) {
      const key = candidate.toLocaleLowerCase()
      if (visited.has(key)) break
      visited.add(key)
      if (!await fs.pathExists(candidate)) {
        candidate = dirname(candidate)
        continue
      }
      const stat = await fs.lstat(candidate)
      if (stat.isSymbolicLink() || !stat.isDirectory() || (await fs.readdir(candidate)).length > 0) break
      await fs.rmdir(candidate)
      removedParents.push(candidate)
      candidate = dirname(candidate)
    }
  }
  return removedParents
}
