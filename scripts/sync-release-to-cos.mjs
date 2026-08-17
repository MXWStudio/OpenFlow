import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import {
  createConfiguredCosClient,
  createCosReleasePublisher,
  sha256File,
} from './cos-release-client.mjs'
import {
  expectedExtensionArtifactNames,
  validateExtensionReleaseArtifacts,
  validateReleaseArtifacts,
} from './release-contract.mjs'

function requireEnvironment(name) {
  const value = (process.env[name] ?? '').trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function normalizedPrefix(value) {
  return value.replace(/^\/+|\/+$/g, '')
}

function loadPrivateKey() {
  const value = requireEnvironment('OPENFLOW_RELEASE_PRIVATE_KEY')
  const pem = value.includes('BEGIN PRIVATE KEY') ? value : Buffer.from(value, 'base64').toString('utf8')
  return createPrivateKey(pem)
}

function assertConfiguredPublicKey(privateKey) {
  const configured = requireEnvironment('OPENFLOW_UPDATE_PUBLIC_KEY').replace(/\s+/g, '')
  const derived = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('base64')
  if (configured !== derived) throw new Error('OPENFLOW_UPDATE_PUBLIC_KEY does not match the release signing private key')
}

const bucket = requireEnvironment('TENCENT_COS_BUCKET')
const region = requireEnvironment('TENCENT_COS_REGION')
const publicBaseUrl = requireEnvironment('OPENFLOW_COS_PUBLIC_BASE_URL').replace(/\/+$/g, '')
const prefix = normalizedPrefix(process.env.OPENFLOW_COS_PREFIX || 'openflow')
const cosConfiguration = createConfiguredCosClient(process.env)
const publisher = createCosReleasePublisher({
  cos: cosConfiguration.cos,
  bucket,
  region,
  publicBaseUrl,
  chunkSize: cosConfiguration.chunkSize,
  chunkParallel: cosConfiguration.chunkParallel,
  chunkAttempts: cosConfiguration.chunkAttempts,
  fullPublicReadback: cosConfiguration.fullPublicReadback,
  operationAttempts: cosConfiguration.operationAttempts,
})

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const STABLE_CACHE_CONTROL = 'no-cache, no-store, must-revalidate'

async function stage(artifactDirectory) {
  const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'))
  const version = packageJson.version
  const desktop = validateReleaseArtifacts({
    artifactDirectory,
    version,
    productName: packageJson.productName ?? packageJson.name,
  })
  const extension = validateExtensionReleaseArtifacts({ artifactDirectory })
  const extensionNames = expectedExtensionArtifactNames(extension.version)
  const archivePath = resolve(artifactDirectory, extensionNames.archive)
  const extensionManifestPath = resolve(artifactDirectory, extensionNames.manifest)
  const archive = { size: (await stat(archivePath)).size, sha256: await sha256File(archivePath) }
  const manifestSha256 = await sha256File(extensionManifestPath)
  const releasePrefix = `${prefix}/releases/v${version}`
  const feedUrl = `${publicBaseUrl}/${releasePrefix}/`
  const payload = {
    schemaVersion: 1,
    version,
    publishedAt: new Date().toISOString(),
    feedUrl,
    desktop: {
      installer: desktop.names.installer,
      size: desktop.installerSize,
      sha512: desktop.sha512,
    },
    extension: {
      version: extension.version,
      archive: extensionNames.archive,
      size: archive.size,
      sha256: archive.sha256,
      manifest: extensionNames.manifest,
      manifestSha256,
    },
  }
  const payloadBytes = Buffer.from(JSON.stringify(payload))
  const privateKey = loadPrivateKey()
  assertConfiguredPublicKey(privateKey)
  const envelope = {
    schemaVersion: 1,
    algorithm: 'RSA-SHA256',
    payload: payloadBytes.toString('base64'),
    signature: sign('RSA-SHA256', payloadBytes, privateKey).toString('base64'),
  }
  const releasePath = resolve(artifactDirectory, 'release.json')
  await writeFile(releasePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8')

  const files = [
    desktop.paths.installer,
    desktop.paths.blockmap,
    desktop.paths.updateManifest,
    archivePath,
    extensionManifestPath,
    releasePath,
  ]
  for (const filePath of files) {
    await publisher.uploadVerifiedFile(filePath, `${releasePrefix}/${basename(filePath)}`, IMMUTABLE_CACHE_CONTROL, {
      immutable: true,
    })
  }
  console.log(`COS version ${version} staged. Stable clients still point to the previous release.`)
}

async function promote(releasePath) {
  const privateKey = loadPrivateKey()
  assertConfiguredPublicKey(privateKey)
  const envelope = JSON.parse(await readFile(releasePath, 'utf8'))
  if (envelope.schemaVersion !== 1 || envelope.algorithm !== 'RSA-SHA256') {
    throw new Error('Cannot promote an unsupported release envelope')
  }
  const payloadBytes = Buffer.from(envelope.payload ?? '', 'base64')
  const signature = Buffer.from(envelope.signature ?? '', 'base64')
  if (!verify('RSA-SHA256', payloadBytes, createPublicKey(privateKey), signature)) {
    throw new Error('Cannot promote a release with an invalid signature')
  }
  const payload = JSON.parse(payloadBytes.toString('utf8'))
  if (!/^\d+\.\d+\.\d+$/.test(payload.version ?? '')) {
    throw new Error('Cannot promote a release with an invalid version')
  }
  const versionedKey = `${prefix}/releases/v${payload.version}/release.json`
  await publisher.verifyExistingFile(releasePath, versionedKey, IMMUTABLE_CACHE_CONTROL, {
    requirePublicReadback: true,
  })
  await publisher.uploadVerifiedFile(releasePath, `${prefix}/stable/release.json`, STABLE_CACHE_CONTROL, {
    immutable: false,
    requirePublicReadback: true,
  })
  console.log(`COS stable channel now points to OpenFlow ${payload.version}.`)
}

async function verifyConfiguration() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'openflow-cos-verification-'))
  const verificationPath = resolve(temporaryDirectory, 'configuration.json')
  const verificationKey = `${prefix}/verification/configuration.json`
  try {
    await writeFile(verificationPath, `${JSON.stringify({
      schemaVersion: 1,
      purpose: 'OpenFlow COS configuration verification',
      runId: (process.env.GITHUB_RUN_ID ?? '').trim() || `local-${Date.now()}`,
      verifiedAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf8')
    await publisher.uploadVerifiedFile(verificationPath, verificationKey, STABLE_CACHE_CONTROL, {
      immutable: false,
      requirePublicReadback: true,
    })
    console.log('Tencent COS credentials, upload permission, object metadata, and public download readback verified.')
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

const stageIndex = process.argv.indexOf('--stage')
const promoteIndex = process.argv.indexOf('--promote')
if (process.argv.includes('--verify-configuration')) {
  await verifyConfiguration()
} else if (stageIndex !== -1 && process.argv[stageIndex + 1]) {
  await stage(resolve(process.argv[stageIndex + 1]))
} else if (promoteIndex !== -1 && process.argv[promoteIndex + 1]) {
  await promote(resolve(process.argv[promoteIndex + 1]))
} else {
  throw new Error('Usage: node scripts/sync-release-to-cos.mjs --verify-configuration | --stage <artifact-directory> | --promote <release.json>')
}
