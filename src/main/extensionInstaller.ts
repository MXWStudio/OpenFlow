import { createHash } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import fs from 'fs-extra'
import type { ExtensionReleaseManifest } from '../shared/updateContract'

const IGNORED_RUNTIME_FILES = new Set(['extension-release.json', 'openflow-bridge.json'])
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/')
}

function resolveContainedPath(root: string, relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath)
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
    throw new Error(`Unsafe extension file path: ${relativePath}`)
  }
  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe extension file path: ${relativePath}`)
  }
  const target = resolve(root, ...segments)
  const rootPrefix = `${resolve(root)}${sep}`.toLowerCase()
  if (!target.toLowerCase().startsWith(rootPrefix)) {
    throw new Error(`Extension file escapes package root: ${relativePath}`)
  }
  return target
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = resolve(current, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, fullPath))
    } else if (entry.isFile()) {
      files.push(normalizeRelativePath(relative(root, fullPath)))
    } else {
      throw new Error(`Extension package contains an unsupported entry: ${entry.name}`)
    }
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'))
}

async function sha256File(filePath: string): Promise<string> {
  const bytes = await fs.readFile(filePath)
  return createHash('sha256').update(bytes).digest('hex')
}

export async function validateExtensionPackage(root: string): Promise<ExtensionReleaseManifest> {
  const manifestPath = resolve(root, 'extension-release.json')
  const releaseManifest = await fs.readJson(manifestPath) as Partial<ExtensionReleaseManifest>
  if (releaseManifest.schemaVersion !== 1 || !VERSION_PATTERN.test(releaseManifest.extensionVersion ?? '')) {
    throw new Error('Extension release manifest is invalid')
  }
  if (!Array.isArray(releaseManifest.files) || releaseManifest.files.length === 0) {
    throw new Error('Extension release manifest has no files')
  }

  const seen = new Set<string>()
  for (const file of releaseManifest.files) {
    if (!file || typeof file.path !== 'string') throw new Error('Extension release file path is invalid')
    const normalizedPath = normalizeRelativePath(file.path)
    if (seen.has(normalizedPath)) throw new Error(`Duplicate extension release file: ${normalizedPath}`)
    seen.add(normalizedPath)
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/i.test(file.sha256 ?? '')) {
      throw new Error(`Extension release metadata is invalid: ${normalizedPath}`)
    }
    const filePath = resolveContainedPath(root, normalizedPath)
    const stat = await fs.stat(filePath)
    if (!stat.isFile() || stat.size !== file.size) throw new Error(`Extension file size mismatch: ${normalizedPath}`)
    const actualHash = await sha256File(filePath)
    if (actualHash !== file.sha256.toLowerCase()) throw new Error(`Extension file hash mismatch: ${normalizedPath}`)
  }

  const actualFiles = (await listFiles(root)).filter((path) => !IGNORED_RUNTIME_FILES.has(path))
  const listedFiles = [...seen].sort((left, right) => left.localeCompare(right, 'en'))
  if (actualFiles.length !== listedFiles.length || actualFiles.some((path, index) => path !== listedFiles[index])) {
    throw new Error('Extension release manifest does not describe the complete package')
  }

  const chromeManifest = await fs.readJson(resolve(root, 'manifest.json')) as { version?: unknown }
  if (chromeManifest.version !== releaseManifest.extensionVersion) {
    throw new Error('Chrome manifest version does not match extension release manifest')
  }
  return releaseManifest as ExtensionReleaseManifest
}

function releaseManifestsMatch(left: ExtensionReleaseManifest, right: ExtensionReleaseManifest): boolean {
  if (left.extensionVersion !== right.extensionVersion || left.files.length !== right.files.length) return false
  const normalize = (manifest: ExtensionReleaseManifest) => [...manifest.files]
    .map((file) => ({ path: normalizeRelativePath(file.path), size: file.size, sha256: file.sha256.toLowerCase() }))
    .sort((first, second) => first.path.localeCompare(second.path, 'en'))
  const leftFiles = normalize(left)
  const rightFiles = normalize(right)
  return leftFiles.every((file, index) => {
    const other = rightFiles[index]
    return file.path === other.path && file.size === other.size && file.sha256 === other.sha256
  })
}

export async function extensionPackagesMatch(leftRoot: string, rightRoot: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    validateExtensionPackage(leftRoot),
    validateExtensionPackage(rightRoot),
  ])
  return releaseManifestsMatch(left, right)
}

export interface ExtensionInstallResult {
  changed: boolean
  version: string
  previousVersion?: string
  backupRoot?: string
}

export async function installExtensionTransaction(sourceRoot: string, targetRoot: string): Promise<ExtensionInstallResult> {
  const sourceManifest = await validateExtensionPackage(sourceRoot)
  let previousVersion: string | undefined
  if (await fs.pathExists(targetRoot)) {
    try {
      const targetManifest = await validateExtensionPackage(targetRoot)
      previousVersion = targetManifest.extensionVersion
      if (releaseManifestsMatch(sourceManifest, targetManifest)) {
        return { changed: false, version: sourceManifest.extensionVersion, previousVersion }
      }
    } catch {
      previousVersion = undefined
    }
  }

  const stagingRoot = `${targetRoot}.staging`
  const backupRoot = `${targetRoot}.backup`
  await fs.ensureDir(dirname(targetRoot))
  await fs.remove(stagingRoot)
  await fs.remove(backupRoot)
  await fs.copy(sourceRoot, stagingRoot, { dereference: true, overwrite: false, errorOnExist: true })
  await validateExtensionPackage(stagingRoot)

  const hadTarget = await fs.pathExists(targetRoot)
  if (hadTarget) await fs.move(targetRoot, backupRoot, { overwrite: false })
  try {
    await fs.move(stagingRoot, targetRoot, { overwrite: false })
  } catch (error) {
    await fs.remove(stagingRoot)
    if (hadTarget && await fs.pathExists(backupRoot) && !await fs.pathExists(targetRoot)) {
      await fs.move(backupRoot, targetRoot, { overwrite: false })
    }
    throw error
  }

  return {
    changed: true,
    version: sourceManifest.extensionVersion,
    previousVersion,
    backupRoot: hadTarget ? backupRoot : undefined,
  }
}

export async function finalizeExtensionInstall(backupRoot?: string): Promise<void> {
  if (backupRoot) await fs.remove(backupRoot)
}

export async function rollbackExtensionInstall(targetRoot: string, backupRoot?: string): Promise<boolean> {
  if (!backupRoot || !await fs.pathExists(backupRoot)) return false
  const failedRoot = `${targetRoot}.failed`
  await fs.remove(failedRoot)
  if (await fs.pathExists(targetRoot)) await fs.move(targetRoot, failedRoot, { overwrite: false })
  try {
    await fs.move(backupRoot, targetRoot, { overwrite: false })
  } catch (error) {
    if (await fs.pathExists(failedRoot) && !await fs.pathExists(targetRoot)) {
      await fs.move(failedRoot, targetRoot, { overwrite: false })
    }
    throw error
  }
  await fs.remove(failedRoot)
  return true
}
