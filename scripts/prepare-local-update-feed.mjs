import { createPrivateKey, createPublicKey, createHash, sign } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  expectedExtensionArtifactNames,
  validateExtensionReleaseArtifacts,
  validateReleaseArtifacts,
} from './release-contract.mjs'

function readOption(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function normalizeLoopbackBaseUrl(value) {
  const parsed = new URL(value)
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Local acceptance feed must use an HTTP loopback address')
  }
  parsed.hash = ''
  parsed.search = ''
  parsed.pathname = parsed.pathname.replace(/\/+$/g, '')
  return parsed.toString().replace(/\/+$/g, '')
}

async function sha256File(filePath) {
  const source = await readFile(filePath)
  return createHash('sha256').update(source).digest('hex')
}

async function loadSigningKeys(privateKeyPath, publicKeyPath) {
  const privateKeySource = await readFile(privateKeyPath, 'utf8')
  const privateKey = createPrivateKey(privateKeySource)
  const configuredPublicKey = (await readFile(publicKeyPath, 'utf8')).replace(/\s+/g, '')
  const derivedPublicKey = createPublicKey(privateKey)
    .export({ format: 'der', type: 'spki' })
    .toString('base64')
  if (configuredPublicKey !== derivedPublicKey) {
    throw new Error('Configured public key does not match the release signing private key')
  }
  return { privateKey, publicKey: derivedPublicKey }
}

export async function prepareLocalUpdateFeed({
  artifactDirectory,
  outputDirectory,
  packagePath = 'package.json',
  privateKeyPath,
  publicKeyPath,
  baseUrl,
  updateType,
}) {
  const artifacts = resolve(artifactDirectory)
  const output = resolve(outputDirectory)
  const packageJson = JSON.parse(await readFile(resolve(packagePath), 'utf8'))
  const version = packageJson.version
  const releaseType = updateType ?? packageJson.openflowRelease?.updateType ?? 'standard'
  if (!['critical', 'standard'].includes(releaseType)) {
    throw new Error('Update type must be critical or standard')
  }

  const localBaseUrl = normalizeLoopbackBaseUrl(baseUrl)
  const desktop = validateReleaseArtifacts({
    artifactDirectory: artifacts,
    version,
    productName: packageJson.productName ?? packageJson.name,
  })
  const extension = validateExtensionReleaseArtifacts({
    artifactDirectory: artifacts,
    desktopVersion: version,
  })
  const extensionNames = expectedExtensionArtifactNames(extension.version)
  const extensionArchivePath = resolve(artifacts, extensionNames.archive)
  const extensionManifestPath = resolve(artifacts, extensionNames.manifest)
  const extensionArchiveStat = await stat(extensionArchivePath)
  const { privateKey, publicKey } = await loadSigningKeys(
    resolve(privateKeyPath),
    resolve(publicKeyPath),
  )

  const versionDirectory = resolve(output, 'releases', `v${version}`)
  const stableDirectory = resolve(output, 'stable')
  await mkdir(versionDirectory, { recursive: true })
  await mkdir(stableDirectory, { recursive: true })

  const artifactPaths = [
    desktop.paths.installer,
    desktop.paths.blockmap,
    desktop.paths.updateManifest,
    extensionArchivePath,
    extensionManifestPath,
  ]
  for (const sourcePath of artifactPaths) {
    await copyFile(sourcePath, resolve(versionDirectory, basename(sourcePath)))
  }

  const payload = {
    schemaVersion: 1,
    version,
    publishedAt: new Date().toISOString(),
    feedUrl: `${localBaseUrl}/releases/v${version}/`,
    updateType: releaseType,
    desktop: {
      installer: desktop.names.installer,
      size: desktop.installerSize,
      sha512: desktop.sha512,
    },
    extension: {
      version: extension.version,
      archive: extensionNames.archive,
      size: extensionArchiveStat.size,
      sha256: await sha256File(extensionArchivePath),
      manifest: extensionNames.manifest,
      manifestSha256: await sha256File(extensionManifestPath),
    },
  }
  const payloadBytes = Buffer.from(JSON.stringify(payload))
  const envelope = {
    schemaVersion: 1,
    algorithm: 'RSA-SHA256',
    payload: payloadBytes.toString('base64'),
    signature: sign('RSA-SHA256', payloadBytes, privateKey).toString('base64'),
  }
  const envelopeSource = `${JSON.stringify(envelope, null, 2)}\n`
  await writeFile(resolve(versionDirectory, 'release.json'), envelopeSource, 'utf8')
  await writeFile(resolve(stableDirectory, 'release.json'), envelopeSource, 'utf8')

  const updateConfiguration = {
    schemaVersion: 1,
    channelUrl: `${localBaseUrl}/stable/release.json`,
    releasePublicKey: publicKey,
    diagnostics: {
      sentryDsn: '',
      uploadIntervalMinutes: 30,
    },
  }
  await writeFile(
    resolve(output, 'update-config.json'),
    `${JSON.stringify(updateConfiguration, null, 2)}\n`,
    'utf8',
  )

  return {
    version,
    extensionVersion: extension.version,
    updateType: releaseType,
    outputDirectory: output,
    channelUrl: updateConfiguration.channelUrl,
    feedUrl: payload.feedUrl,
  }
}

async function runCli() {
  const args = process.argv.slice(2)
  const artifactDirectory = readOption(args, '--artifacts')
  const outputDirectory = readOption(args, '--output')
  const privateKeyPath = readOption(args, '--private-key')
  const publicKeyPath = readOption(args, '--public-key')
  const baseUrl = readOption(args, '--base-url')
  if (!artifactDirectory || !outputDirectory || !privateKeyPath || !publicKeyPath || !baseUrl) {
    throw new Error(
      'Usage: node scripts/prepare-local-update-feed.mjs --artifacts <directory> --output <directory> --private-key <pem> --public-key <spki-base64> --base-url <http://127.0.0.1:port> [--update-type standard|critical]',
    )
  }
  const result = await prepareLocalUpdateFeed({
    artifactDirectory,
    outputDirectory,
    packagePath: readOption(args, '--package') ?? 'package.json',
    privateKeyPath,
    publicKeyPath,
    baseUrl,
    updateType: readOption(args, '--update-type'),
  })
  console.log(
    `Prepared local-only OpenFlow ${result.version} (${result.updateType}) feed with extension ${result.extensionVersion}.`,
  )
  console.log(`Channel: ${result.channelUrl}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
