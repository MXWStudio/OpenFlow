import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = resolve(dirname(scriptPath), '..')
const outputPath = resolve(root, '.openflow-build/update-config.json')

export function createUpdateConfiguration(environment = process.env, requireConfiguration = false) {
  const channelUrl = (environment.OPENFLOW_UPDATE_CHANNEL_URL ?? '').trim()
  const releasePublicKey = (environment.OPENFLOW_UPDATE_PUBLIC_KEY ?? '').replace(/\s+/g, '')
  const sentryDsn = (environment.OPENFLOW_SENTRY_DSN ?? '').trim()
  const diagnosticsUploadIntervalSource = (environment.OPENFLOW_DIAGNOSTICS_UPLOAD_INTERVAL_MINUTES ?? '').trim()
  const diagnosticsUploadIntervalMinutes = Number(diagnosticsUploadIntervalSource || 30)

  if (channelUrl) {
    const parsed = new URL(channelUrl)
    if (parsed.protocol !== 'https:') throw new Error('OPENFLOW_UPDATE_CHANNEL_URL must use HTTPS')
  }
  if (releasePublicKey && !/^[A-Za-z0-9+/]+={0,2}$/.test(releasePublicKey)) {
    throw new Error('OPENFLOW_UPDATE_PUBLIC_KEY must be a base64 SPKI public key')
  }
  if (sentryDsn) {
    const parsed = new URL(sentryDsn)
    if (parsed.protocol !== 'https:') throw new Error('OPENFLOW_SENTRY_DSN must use HTTPS')
    if (!parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname === '/') {
      throw new Error('OPENFLOW_SENTRY_DSN must be a valid client DSN without a secret, query, or fragment')
    }
  }
  if (!Number.isInteger(diagnosticsUploadIntervalMinutes) || diagnosticsUploadIntervalMinutes < 5 || diagnosticsUploadIntervalMinutes > 1440) {
    throw new Error('OPENFLOW_DIAGNOSTICS_UPLOAD_INTERVAL_MINUTES must be an integer from 5 to 1440')
  }
  if (requireConfiguration && (!channelUrl || !releasePublicKey || !sentryDsn)) {
    throw new Error('Release builds require OPENFLOW_UPDATE_CHANNEL_URL, OPENFLOW_UPDATE_PUBLIC_KEY, and OPENFLOW_SENTRY_DSN')
  }

  return {
    schemaVersion: 1,
    channelUrl,
    releasePublicKey,
    diagnostics: {
      sentryDsn,
      uploadIntervalMinutes: diagnosticsUploadIntervalMinutes,
    },
  }
}

async function main() {
  const configuration = createUpdateConfiguration(process.env, process.argv.includes('--require'))
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(configuration, null, 2)}\n`, 'utf8')
  console.log(configuration.channelUrl
    ? `Prepared signed update channel: ${configuration.channelUrl}`
    : 'Prepared a local build with cloud updates disabled.')
  console.log(configuration.diagnostics.sentryDsn
    ? `Prepared Sentry diagnostics upload every ${configuration.diagnostics.uploadIntervalMinutes} minutes.`
    : 'Prepared automatic local diagnostics collection with remote upload disabled.')
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  await main()
}
