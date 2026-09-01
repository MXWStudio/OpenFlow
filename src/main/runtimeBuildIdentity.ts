import { app } from 'electron'
import { join } from 'node:path'
import fs from 'fs-extra'
import {
  normalizeBuildIdentity,
  normalizeDevSyncMarker,
  type OpenFlowRuntimeBuildInfo,
} from '../shared/buildIdentity.ts'

function readJsonIfPresent(path: string): unknown {
  if (!fs.existsSync(path)) return undefined
  return fs.readJsonSync(path)
}

export function loadRuntimeBuildInfo(): OpenFlowRuntimeBuildInfo {
  const root = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), '.openflow-build')
  const identity = normalizeBuildIdentity(readJsonIfPresent(join(root, 'build-metadata.json')))
  const marker = normalizeDevSyncMarker(readJsonIfPresent(join(root, 'dev-sync.json')), identity)
  return { ...identity, devSyncLabel: marker?.label ?? '' }
}
