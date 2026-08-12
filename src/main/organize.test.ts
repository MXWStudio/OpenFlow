import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  getPreferredQimiFolderName,
  QIMI_FOLDER_NAME,
  selectQimiFolderName,
} from './organize.ts'

describe('organize', () => {
  it('prefers the game-prefixed qimi folder when it already exists', () => {
    assert.strictEqual(
      selectQimiFolderName('小火车', ['奇觅生成', '小火车-奇觅生成', '1080x1920']),
      '小火车-奇觅生成'
    )
  })

  it('reuses an existing qimi folder that contains the keyword', () => {
    assert.strictEqual(
      selectQimiFolderName('小火车', ['旧项目-奇觅生成', '奇觅生成', '1080x1920']),
      '旧项目-奇觅生成'
    )
  })

  it('keeps legacy exact qimi folders when they are the only match', () => {
    assert.strictEqual(selectQimiFolderName('小火车', ['奇觅生成']), QIMI_FOLDER_NAME)
  })

  it('creates a game-prefixed qimi folder name when no qimi folder exists', () => {
    assert.strictEqual(getPreferredQimiFolderName('小火车'), '小火车-奇觅生成')
    assert.strictEqual(selectQimiFolderName('小火车', ['1080x1920']), '小火车-奇觅生成')
  })
})
