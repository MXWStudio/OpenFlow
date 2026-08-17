import assert from 'node:assert/strict'
import test from 'node:test'
import type { UpdateActivitySnapshot, UpdateViewState } from '../shared/updateContract'
import { canInstallCriticalUpdate, CRITICAL_UPDATE_IDLE_MS, updateAttentionColor } from './updatePolicy.ts'

const downloadedCritical: UpdateViewState['desktop'] = {
  status: 'downloaded',
  currentVersion: '2.5.1',
  availableVersion: '2.5.2',
  updateType: 'critical',
  installBehavior: 'automatic-when-idle',
}

const idleActivity: UpdateActivitySnapshot = {
  activeView: 'daily',
  busy: false,
  hasUnsavedChanges: false,
  lastUserActivityAt: 1_000,
  rendererReady: true,
}

test('critical updates install only after a safe ten-minute idle window', () => {
  assert.equal(canInstallCriticalUpdate({
    state: downloadedCritical,
    activity: idleActivity,
    windowFocused: false,
    now: 1_000 + CRITICAL_UPDATE_IDLE_MS,
  }), true)

  for (const unsafe of [
    { activity: { ...idleActivity, busy: true }, windowFocused: false },
    { activity: { ...idleActivity, hasUnsavedChanges: true }, windowFocused: false },
    { activity: { ...idleActivity, rendererReady: false }, windowFocused: false },
    { activity: idleActivity, windowFocused: true },
  ]) {
    assert.equal(canInstallCriticalUpdate({
      state: downloadedCritical,
      activity: unsafe.activity,
      windowFocused: unsafe.windowFocused,
      now: 1_000 + CRITICAL_UPDATE_IDLE_MS,
    }), false)
  }
})

test('standard updates never enter the automatic installation path', () => {
  assert.equal(canInstallCriticalUpdate({
    state: { ...downloadedCritical, updateType: 'standard', installBehavior: 'manual' },
    activity: idleActivity,
    windowFocused: false,
    now: 1_000 + CRITICAL_UPDATE_IDLE_MS * 2,
  }), false)
  assert.equal(updateAttentionColor({ ...downloadedCritical, updateType: 'critical' }), 'red')
  assert.equal(updateAttentionColor({ ...downloadedCritical, updateType: 'standard' }), 'orange')
  assert.equal(updateAttentionColor({ status: 'up-to-date', currentVersion: '2.5.1' }), null)
})
