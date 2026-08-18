import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_PACKAGE_PATH = resolve(root, 'package.json')
const DEFAULT_MANIFEST_PATH = resolve(root, 'extensions/chrome/manifest.json')
const CHROME_VERSION_PATTERN = /^\d+(?:\.\d+){2,3}$/

export function validateChromeVersion(version) {
  if (typeof version !== 'string' || !CHROME_VERSION_PATTERN.test(version)) {
    throw new Error(`Desktop version ${version} cannot be used as a Chrome extension version`)
  }
  const parts = version.split('.')
  if (parts.some((part) => Number(part) > 65535 || String(Number(part)) !== part)) {
    throw new Error(`Desktop version ${version} cannot be used as a Chrome extension version`)
  }
  return version
}

export function assertExtensionVersionAligned(desktopVersion, extensionVersion) {
  validateChromeVersion(desktopVersion)
  if (extensionVersion !== desktopVersion) {
    throw new Error(
      `Chrome extension version ${extensionVersion} does not match desktop version ${desktopVersion}`,
    )
  }
  return desktopVersion
}

export async function syncExtensionVersion({
  packagePath = DEFAULT_PACKAGE_PATH,
  manifestPath = DEFAULT_MANIFEST_PATH,
  checkOnly = false,
} = {}) {
  const packageJson = JSON.parse(await readFile(resolve(packagePath), 'utf8'))
  const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'))
  const desktopVersion = validateChromeVersion(packageJson.version)

  if (manifest.version === desktopVersion) {
    return { changed: false, version: desktopVersion }
  }
  if (checkOnly) {
    assertExtensionVersionAligned(desktopVersion, manifest.version)
  }

  manifest.version = desktopVersion
  await writeFile(resolve(manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { changed: true, version: desktopVersion }
}

async function runCli() {
  const checkOnly = process.argv.slice(2).includes('--check')
  const result = await syncExtensionVersion({ checkOnly })
  console.log(
    result.changed
      ? `Chrome extension version synchronized to desktop ${result.version}.`
      : `Chrome extension version matches desktop ${result.version}.`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
