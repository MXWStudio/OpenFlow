import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

export function expectedReleaseTag(version) {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid package version: ${version}`)
  }

  return `v${version}`
}

export function validateReleaseTag(version, tag) {
  const expectedTag = expectedReleaseTag(version)
  if (tag !== expectedTag) {
    throw new Error(`Release tag ${tag} does not match package version ${version}; expected ${expectedTag}`)
  }

  return expectedTag
}

export function validatePackageLockVersion(version, packageLock) {
  const rootVersion = packageLock.version
  const rootPackageVersion = packageLock.packages?.['']?.version
  if (rootVersion !== version || rootPackageVersion !== version) {
    throw new Error(
      `package-lock.json version mismatch; expected ${version}, got root=${rootVersion}, package=${rootPackageVersion}`
    )
  }
}

export function expectedReleaseArtifactNames(version, productName = 'openflow-studio') {
  expectedReleaseTag(version)
  const installer = `${productName}-Setup-${version}.exe`

  return {
    installer,
    blockmap: `${installer}.blockmap`,
    updateManifest: 'latest.yml'
  }
}

export function expectedExtensionArtifactNames(version) {
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid extension version: ${version}`)
  return {
    archive: `OpenFlow-Chrome-Extension-${version}.zip`,
    manifest: 'extension-release.json'
  }
}

export function validateExtensionReleaseArtifacts({ artifactDirectory }) {
  const directory = resolve(artifactDirectory)
  const manifestPath = resolve(directory, 'extension-release.json')
  if (!existsSync(manifestPath) || statSync(manifestPath).size === 0) {
    throw new Error(`Missing or empty extension release manifest: ${manifestPath}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || !VERSION_PATTERN.test(manifest.extensionVersion ?? '')) {
    throw new Error('Invalid extension release manifest')
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Extension release manifest contains no files')
  }
  const names = expectedExtensionArtifactNames(manifest.extensionVersion)
  const archivePath = resolve(directory, names.archive)
  if (!existsSync(archivePath) || statSync(archivePath).size === 0) {
    throw new Error(`Missing or empty extension archive: ${archivePath}`)
  }
  return { version: manifest.extensionVersion, names, manifestPath, archivePath }
}

function readYamlScalar(source, pattern, label) {
  const match = source.match(pattern)
  if (!match) {
    throw new Error(`latest.yml is missing ${label}`)
  }

  return match[1].trim().replace(/^(['"])(.*)\1$/, '$2')
}

export function validateReleaseArtifacts({ artifactDirectory, version, productName = 'openflow-studio' }) {
  const directory = resolve(artifactDirectory)
  const names = expectedReleaseArtifactNames(version, productName)
  const paths = Object.fromEntries(
    Object.entries(names).map(([key, name]) => [key, resolve(directory, name)])
  )

  for (const [key, filePath] of Object.entries(paths)) {
    if (!existsSync(filePath) || statSync(filePath).size === 0) {
      throw new Error(`Missing or empty release artifact (${key}): ${filePath}`)
    }
  }

  const installer = readFileSync(paths.installer)
  const manifest = readFileSync(paths.updateManifest, 'utf8')
  const manifestVersion = readYamlScalar(manifest, /^version:\s*(.+)$/m, 'version')
  const manifestUrl = readYamlScalar(manifest, /^\s*-\s+url:\s*(.+)$/m, 'files[0].url')
  const manifestPath = readYamlScalar(manifest, /^path:\s*(.+)$/m, 'path')
  const manifestSize = Number(readYamlScalar(manifest, /^[ \t]+size:[ \t]*(\d+)$/m, 'files[0].size'))
  const manifestHashes = [...manifest.matchAll(/^[ \t]*sha512:[ \t]*(.+)$/gm)].map((match) =>
    match[1].trim().replace(/^(['"])(.*)\1$/, '$2')
  )
  const actualHash = createHash('sha512').update(installer).digest('base64')

  if (manifestVersion !== version) {
    throw new Error(`latest.yml version ${manifestVersion} does not match package version ${version}`)
  }
  if (manifestUrl !== names.installer || manifestPath !== names.installer) {
    throw new Error(
      `latest.yml must reference ${names.installer}; got url=${manifestUrl}, path=${manifestPath}`
    )
  }
  if (manifestSize !== installer.length) {
    throw new Error(`latest.yml size ${manifestSize} does not match installer size ${installer.length}`)
  }
  if (manifestHashes.length === 0 || manifestHashes.some((hash) => hash !== actualHash)) {
    throw new Error('latest.yml SHA-512 does not match the installer')
  }

  return { names, paths, installerSize: installer.length, sha512: actualHash }
}

function readOption(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function runCli() {
  const args = process.argv.slice(2)
  const packagePath = resolve(readOption(args, '--package') ?? 'package.json')
  const packageLockPath = resolve(readOption(args, '--package-lock') ?? 'package-lock.json')
  const tag = readOption(args, '--tag')
  const artifactDirectory = readOption(args, '--artifacts')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'))

  if (!tag) {
    throw new Error('Usage: node scripts/release-contract.mjs --tag <vX.Y.Z> [--artifacts <directory>]')
  }

  validatePackageLockVersion(packageJson.version, packageLock)
  const expectedTag = validateReleaseTag(packageJson.version, tag)
  console.log(`Release tag verified: ${expectedTag}`)

  if (artifactDirectory) {
    const result = validateReleaseArtifacts({
      artifactDirectory,
      version: packageJson.version,
      productName: packageJson.productName ?? packageJson.name
    })
    console.log(`Release artifacts verified: ${Object.values(result.names).join(', ')}`)
    const extension = validateExtensionReleaseArtifacts({ artifactDirectory })
    console.log(`Extension artifacts verified: ${Object.values(extension.names).join(', ')}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
