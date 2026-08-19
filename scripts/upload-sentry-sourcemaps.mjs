import { readdir, readFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = resolve(dirname(scriptPath), '..')
const outputRoot = resolve(root, 'out')

export function resolveSentryUploadConfiguration(environment = process.env) {
  const dsn = (environment.OPENFLOW_SENTRY_DSN ?? '').trim()
  const authToken = (environment.SENTRY_AUTH_TOKEN ?? '').trim()
  const org = (environment.SENTRY_ORG ?? '').trim()
  const project = (environment.SENTRY_PROJECT ?? '').trim()
  if (!dsn) return { enabled: false, dsn, authToken, org, project }
  const missing = [!authToken && 'SENTRY_AUTH_TOKEN', !org && 'SENTRY_ORG', !project && 'SENTRY_PROJECT'].filter(Boolean)
  if (missing.length) throw new Error(`Sentry source map upload requires ${missing.join(', ')}`)
  return { enabled: true, dsn, authToken, org, project }
}

async function findSourceMaps(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await findSourceMaps(path))
    else if (entry.isFile() && entry.name.endsWith('.map')) result.push(path)
  }
  return result
}

export async function removeSourceMaps(directory = outputRoot) {
  const maps = await findSourceMaps(directory)
  await Promise.all(maps.map((path) => rm(path, { force: true })))
  return maps.length
}

export function resolveSentryCliInvocation(platform = process.platform, nodeExecutable = process.execPath) {
  if (platform === 'win32') {
    return {
      executable: nodeExecutable,
      prefixArgs: [resolve(root, 'node_modules', '@sentry', 'cli', 'bin', 'sentry-cli')],
    }
  }
  return {
    executable: resolve(root, 'node_modules', '.bin', 'sentry-cli'),
    prefixArgs: [],
  }
}

function runCli(args, environment) {
  const { executable, prefixArgs } = resolveSentryCliInvocation()
  const result = spawnSync(executable, [...prefixArgs, ...args], {
    cwd: root,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`sentry-cli ${args.slice(0, 2).join(' ')} failed with exit code ${result.status}`)
}

async function main() {
  const configuration = resolveSentryUploadConfiguration()
  if (!configuration.enabled) {
    const removed = await removeSourceMaps()
    console.log(`Sentry is disabled for this build; removed ${removed} local source map file(s).`)
    return
  }
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  const release = `openflow-studio@${packageJson.version}`
  const sentryEnvironment = { SENTRY_AUTH_TOKEN: configuration.authToken }
  runCli(['sourcemaps', 'inject', outputRoot], sentryEnvironment)
  runCli([
    'sourcemaps', 'upload',
    '--org', configuration.org,
    '--project', configuration.project,
    '--release', release,
    outputRoot,
  ], sentryEnvironment)
  const removed = await removeSourceMaps()
  console.log(`Uploaded Sentry source maps for ${release}; removed ${removed} map file(s) from the packaged app.`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) await main()
