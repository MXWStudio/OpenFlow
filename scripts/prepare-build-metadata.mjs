import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT = resolve(root, '.openflow-build/build-metadata.json')

export const channelIdentities = {
  stable: {
    appName: 'OpenFlow Studio',
    appId: 'com.openflow.studio',
    userDataDirectory: 'openflow-studio',
    updateChannel: 'stable',
  },
  dev: {
    appName: 'OpenFlow Studio Dev',
    appId: 'com.openflow.studio.dev',
    userDataDirectory: 'openflow-studio-dev',
    updateChannel: 'dev-disabled',
  },
  candidate: {
    appName: 'OpenFlow Studio Candidate',
    appId: 'com.openflow.studio.candidate',
    userDataDirectory: 'openflow-studio-candidate',
    updateChannel: 'candidate-disabled',
  },
}

function argument(name, args = process.argv.slice(2)) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : ''
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

export function createBuildMetadata({
  channel,
  sourceCommit,
  sourceSnapshotSha256,
  sourceDirty,
  builtAt,
}) {
  if (!(channel in channelIdentities)) throw new Error(`Unsupported build channel: ${channel}`)
  if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) throw new Error('Source commit must be a full Git SHA')
  if (!/^[a-f0-9]{64}$/i.test(sourceSnapshotSha256)) throw new Error('Source snapshot must be SHA-256')
  if (!Number.isFinite(Date.parse(builtAt))) throw new Error('Build time must be ISO-8601')
  return {
    schemaVersion: 1,
    channel,
    ...channelIdentities[channel],
    sourceCommit: sourceCommit.toLowerCase(),
    sourceSnapshotSha256: sourceSnapshotSha256.toLowerCase(),
    sourceDirty: Boolean(sourceDirty),
    builtAt: new Date(builtAt).toISOString(),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const channel = argument('--channel', args) || 'stable'
  const sourceCommit = argument('--commit', args) || git(['rev-parse', 'HEAD'])
  const dirty = argument('--dirty', args)
  const sourceDirty = dirty ? dirty === 'true' : Boolean(git(['status', '--porcelain', '--untracked-files=normal']))
  const sourceSnapshotSha256 = argument('--snapshot-sha256', args) || '0'.repeat(64)
  const builtAt = argument('--built-at', args) || new Date().toISOString()
  const output = resolve(argument('--output', args) || DEFAULT_OUTPUT)
  const metadata = createBuildMetadata({ channel, sourceCommit, sourceSnapshotSha256, sourceDirty, builtAt })
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
  console.log(`Prepared ${channel} build identity: ${metadata.appId}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
