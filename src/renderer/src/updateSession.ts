import type { RestorableAppView } from '../../shared/updateContract'

const RESTORABLE_VIEWS = new Set<RestorableAppView>(['daily', 'organizer', 'format', 'settings'])

export function normalizeRestorableView(value: unknown): RestorableAppView {
  return typeof value === 'string' && RESTORABLE_VIEWS.has(value as RestorableAppView)
    ? value as RestorableAppView
    : 'daily'
}
