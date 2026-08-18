import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRestorableSettingsTab, normalizeRestorableView } from './updateSession.ts'

test('update restart sessions restore only known application pages', () => {
  assert.equal(normalizeRestorableView('organizer'), 'organizer')
  assert.equal(normalizeRestorableView('settings'), 'settings')
  assert.equal(normalizeRestorableView('unknown'), 'daily')
  assert.equal(normalizeRestorableView({ activeView: 'format' }), 'daily')
})

test('update restart sessions restore the exact settings page safely', () => {
  assert.equal(normalizeRestorableSettingsTab('about'), 'about')
  assert.equal(normalizeRestorableSettingsTab('templates'), 'templates')
  assert.equal(normalizeRestorableSettingsTab('unknown'), 'system')
  assert.equal(normalizeRestorableSettingsTab({ tab: 'about' }), 'system')
})
