import type { UpdateActivitySnapshot, UpdateViewState } from '../shared/updateContract'

export const CRITICAL_UPDATE_IDLE_MS = 10 * 60 * 1000

export function canInstallCriticalUpdate(input: {
  state: UpdateViewState['desktop']
  activity: UpdateActivitySnapshot
  windowFocused: boolean
  now?: number
}): boolean {
  const now = input.now ?? Date.now()
  return input.state.status === 'downloaded'
    && input.state.updateType === 'critical'
    && input.activity.rendererReady
    && !input.activity.busy
    && !input.activity.hasUnsavedChanges
    && !input.windowFocused
    && Number.isFinite(input.activity.lastUserActivityAt)
    && now - input.activity.lastUserActivityAt >= CRITICAL_UPDATE_IDLE_MS
}

export function updateAttentionColor(state: UpdateViewState['desktop']): 'red' | 'orange' | null {
  if (!['available', 'downloading', 'downloaded'].includes(state.status)) return null
  return state.updateType === 'critical' ? 'red' : 'orange'
}
