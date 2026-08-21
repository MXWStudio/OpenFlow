import assert from 'node:assert/strict'
import test from 'node:test'
import { getDailyWaterSlothMotion, type DailyWaterSlothState } from './waterSlothMotion.ts'

const baseState: DailyWaterSlothState = {
  isChangingRequirement: false,
  isValidating: false,
  isRenaming: false,
  hasValidated: false,
  needsAttention: false,
  hasRenameFailure: false,
  hasRecentRenameSuccess: false,
  hasFolders: false,
}

test('daily water sloth peeks before a workflow starts', () => {
  assert.equal(getDailyWaterSlothMotion(baseState), 'empty')
})

test('daily water sloth uses processing motion for real active operations', () => {
  assert.equal(getDailyWaterSlothMotion({ ...baseState, isChangingRequirement: true }), 'processing')
  assert.equal(getDailyWaterSlothMotion({ ...baseState, isValidating: true }), 'processing')
  assert.equal(getDailyWaterSlothMotion({ ...baseState, isRenaming: true }), 'processing')
})

test('daily water sloth stays still when validation or rename needs attention', () => {
  assert.equal(getDailyWaterSlothMotion({ ...baseState, hasValidated: true, needsAttention: true }), 'still')
  assert.equal(getDailyWaterSlothMotion({ ...baseState, hasRenameFailure: true }), 'still')
})

test('daily water sloth celebrates successful validation or a recent rename', () => {
  assert.equal(getDailyWaterSlothMotion({ ...baseState, hasValidated: true }), 'success')
  assert.equal(getDailyWaterSlothMotion({ ...baseState, hasRecentRenameSuccess: true }), 'success')
})

test('daily water sloth idles after folders are added but work has not started', () => {
  assert.equal(getDailyWaterSlothMotion({ ...baseState, hasFolders: true }), 'idle')
})

test('active processing takes priority over stale attention or success state', () => {
  assert.equal(getDailyWaterSlothMotion({
    ...baseState,
    isValidating: true,
    needsAttention: true,
    hasRecentRenameSuccess: true,
  }), 'processing')
})
