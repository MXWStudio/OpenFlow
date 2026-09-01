export type OpenFlowBuildChannel = 'stable' | 'dev' | 'candidate'

export interface OpenFlowBuildIdentity {
  schemaVersion: 1
  channel: OpenFlowBuildChannel
  appName: string
  appId: string
  userDataDirectory: string
  updateChannel: 'stable' | 'dev-disabled' | 'candidate-disabled'
  sourceCommit: string
  sourceSnapshotSha256: string
  sourceDirty: boolean
  builtAt: string
}

export interface OpenFlowDevSyncMarker {
  schemaVersion: 1
  label: string
  synchronizedAt: string
  sourceCommit: string
  sourceSnapshotSha256: string
}

export interface OpenFlowRuntimeBuildInfo extends OpenFlowBuildIdentity {
  devSyncLabel: string
}

export const STABLE_BUILD_IDENTITY: OpenFlowBuildIdentity = {
  schemaVersion: 1,
  channel: 'stable',
  appName: 'OpenFlow Studio',
  appId: 'com.openflow.studio',
  userDataDirectory: 'openflow-studio',
  updateChannel: 'stable',
  sourceCommit: '',
  sourceSnapshotSha256: '',
  sourceDirty: false,
  builtAt: '',
}

export const CHANNEL_IDENTITIES: Record<OpenFlowBuildChannel, Pick<OpenFlowBuildIdentity,
  'channel' | 'appName' | 'appId' | 'userDataDirectory' | 'updateChannel'>> = {
  stable: {
    channel: 'stable',
    appName: 'OpenFlow Studio',
    appId: 'com.openflow.studio',
    userDataDirectory: 'openflow-studio',
    updateChannel: 'stable',
  },
  dev: {
    channel: 'dev',
    appName: 'OpenFlow Studio Dev',
    appId: 'com.openflow.studio.dev',
    userDataDirectory: 'openflow-studio-dev',
    updateChannel: 'dev-disabled',
  },
  candidate: {
    channel: 'candidate',
    appName: 'OpenFlow Studio Candidate',
    appId: 'com.openflow.studio.candidate',
    userDataDirectory: 'openflow-studio-candidate',
    updateChannel: 'candidate-disabled',
  },
}

const SHA256 = /^[a-f0-9]{64}$/i
const COMMIT = /^[a-f0-9]{40}$/i
const DEV_LABEL = /^DEV · \d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

export function normalizeBuildIdentity(value: unknown): OpenFlowBuildIdentity {
  if (!value || typeof value !== 'object') return { ...STABLE_BUILD_IDENTITY }
  const candidate = value as Partial<OpenFlowBuildIdentity>
  const channel = candidate.channel
  if (candidate.schemaVersion !== 1 || !channel || !(channel in CHANNEL_IDENTITIES)) {
    throw new Error('Unsupported OpenFlow build identity')
  }
  const expected = CHANNEL_IDENTITIES[channel]
  if (
    candidate.appName !== expected.appName
    || candidate.appId !== expected.appId
    || candidate.userDataDirectory !== expected.userDataDirectory
    || candidate.updateChannel !== expected.updateChannel
  ) {
    throw new Error(`OpenFlow ${channel} build identity mismatch`)
  }
  const sourceCommit = typeof candidate.sourceCommit === 'string' ? candidate.sourceCommit : ''
  const sourceSnapshotSha256 = typeof candidate.sourceSnapshotSha256 === 'string' ? candidate.sourceSnapshotSha256 : ''
  const builtAt = typeof candidate.builtAt === 'string' ? candidate.builtAt : ''
  if (sourceCommit && !COMMIT.test(sourceCommit)) throw new Error('Invalid source commit')
  if (sourceSnapshotSha256 && !SHA256.test(sourceSnapshotSha256)) throw new Error('Invalid source snapshot SHA-256')
  if (builtAt && !Number.isFinite(Date.parse(builtAt))) throw new Error('Invalid build time')
  return {
    schemaVersion: 1,
    ...expected,
    sourceCommit,
    sourceSnapshotSha256,
    sourceDirty: candidate.sourceDirty === true,
    builtAt,
  }
}

export function normalizeDevSyncMarker(value: unknown, identity: OpenFlowBuildIdentity): OpenFlowDevSyncMarker | null {
  if (identity.channel !== 'dev' || !value || typeof value !== 'object') return null
  const marker = value as Partial<OpenFlowDevSyncMarker>
  if (
    marker.schemaVersion !== 1
    || typeof marker.label !== 'string'
    || !DEV_LABEL.test(marker.label)
    || typeof marker.synchronizedAt !== 'string'
    || !Number.isFinite(Date.parse(marker.synchronizedAt))
    || marker.sourceCommit !== identity.sourceCommit
    || marker.sourceSnapshotSha256 !== identity.sourceSnapshotSha256
  ) return null
  return marker as OpenFlowDevSyncMarker
}
