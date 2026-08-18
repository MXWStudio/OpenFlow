import type { RestorableAppView, RestorableSettingsTab } from '../../shared/updateContract'

const RESTORABLE_VIEWS = new Set<RestorableAppView>(['daily', 'organizer', 'format', 'settings'])
const RESTORABLE_SETTINGS_TABS = new Set<RestorableSettingsTab>([
  'system',
  'account',
  'workspace',
  'templates',
  'shortcuts',
  'about',
])

export function normalizeRestorableView(value: unknown): RestorableAppView {
  return typeof value === 'string' && RESTORABLE_VIEWS.has(value as RestorableAppView)
    ? value as RestorableAppView
    : 'daily'
}

export function normalizeRestorableSettingsTab(value: unknown): RestorableSettingsTab {
  return typeof value === 'string' && RESTORABLE_SETTINGS_TABS.has(value as RestorableSettingsTab)
    ? value as RestorableSettingsTab
    : 'system'
}
