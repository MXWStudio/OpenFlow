import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, '.openflow-build/update-config.json')
const requireConfiguration = process.argv.includes('--require')
const channelUrl = (process.env.OPENFLOW_UPDATE_CHANNEL_URL ?? '').trim()
const releasePublicKey = (process.env.OPENFLOW_UPDATE_PUBLIC_KEY ?? '').replace(/\s+/g, '')

if (channelUrl) {
  const parsed = new URL(channelUrl)
  if (parsed.protocol !== 'https:') throw new Error('OPENFLOW_UPDATE_CHANNEL_URL must use HTTPS')
}
if (releasePublicKey && !/^[A-Za-z0-9+/]+={0,2}$/.test(releasePublicKey)) {
  throw new Error('OPENFLOW_UPDATE_PUBLIC_KEY must be a base64 SPKI public key')
}
if (requireConfiguration && (!channelUrl || !releasePublicKey)) {
  throw new Error('Release builds require OPENFLOW_UPDATE_CHANNEL_URL and OPENFLOW_UPDATE_PUBLIC_KEY')
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  channelUrl,
  releasePublicKey,
}, null, 2)}\n`, 'utf8')
console.log(channelUrl ? `Prepared signed update channel: ${channelUrl}` : 'Prepared a local build with cloud updates disabled.')
