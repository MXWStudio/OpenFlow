import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRestorableView } from './updateSession.ts'

test('update restart sessions restore only known application pages', () => {
  assert.equal(normalizeRestorableView('organizer'), 'organizer')
  assert.equal(normalizeRestorableView('settings'), 'settings')
  assert.equal(normalizeRestorableView('unknown'), 'daily')
  assert.equal(normalizeRestorableView({ activeView: 'format' }), 'daily')
})
