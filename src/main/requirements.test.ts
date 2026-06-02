import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  getMissingRequirements,
  normalizeResolution,
  parseRequiredQuantity,
  parseRequirementJson,
  sanitizePathSegment,
} from './requirements.ts'

describe('requirements', () => {
  it('normalizes resolution separators and whitespace', () => {
    assert.strictEqual(normalizeResolution('1080 x 1920'), '1080*1920')
    assert.strictEqual(normalizeResolution('1080×607'), '1080*607')
    assert.strictEqual(normalizeResolution('720-1280'), '720*1280')
    assert.strictEqual(normalizeResolution('bad value'), '')
  })

  it('parses required quantities from localized strings', () => {
    assert.strictEqual(parseRequiredQuantity('所需数量：3'), 3)
    assert.strictEqual(parseRequiredQuantity(' 2 个 '), 2)
    assert.strictEqual(parseRequiredQuantity(4), 4)
    assert.strictEqual(parseRequiredQuantity('无'), undefined)
  })

  it('parses openflow.requirements.v1 JSON', () => {
    const result = parseRequirementJson({
      schemaVersion: 'openflow.requirements.v1',
      extractedAt: '2026-06-01T00:00:00.000Z',
      source: { url: 'https://example.test/orders' },
      projects: [{
        projectName: '小火车',
        fullName: '赛诺斯-小火车-华为-0601',
        producerName: '孟祥伟',
        materialType: '视频',
        requirements: [{
          resolution: '1080x1920',
          requiredQuantity: 3,
          positionType: '竖版',
          sizeLimit: '50M',
        }],
      }],
    }, '20260601-孟祥伟数据表.json')

    assert.strictEqual(result.projectName, '小火车')
    assert.strictEqual(result.producerName, '孟祥伟')
    assert.deepStrictEqual(result.sizes, ['1080*1920'])
    assert.strictEqual(result.projects[0].requirements[0].requiredQuantity, 3)
    assert.deepStrictEqual(result.warnings, [])
  })

  it('parses current plugin Chinese-key JSON arrays without losing quantity', () => {
    const result = parseRequirementJson([{
      '项目名称': '小火车',
      '制作人': '孟祥伟',
      '素材类型': '平面',
      '尺寸要求明细': [
        { '版位类型': '信息流', '分辨率': '1080×1920', '大小限制': '5M', '所需数量': '所需数量：2' },
        { '版位类型': '横版', '分辨率': '1920x1080', '大小限制': '5M', '所需数量': '1' },
      ],
    }], '20260601-孟祥伟数据表.json')

    assert.strictEqual(result.projectName, '小火车')
    assert.strictEqual(result.producerName, '孟祥伟')
    assert.deepStrictEqual(result.projects[0].sizes, ['1080*1920', '1920*1080'])
    assert.deepStrictEqual(result.projects[0].requirements.map((item) => item.requiredQuantity), [2, 1])
  })

  it('keeps old projectName/sizes objects backward compatible', () => {
    const result = parseRequirementJson({
      projectName: '旧项目',
      producerName: '制作者',
      sizes: ['720x1280', '1920*1080'],
    }, 'old.json')

    assert.strictEqual(result.projectName, '旧项目')
    assert.deepStrictEqual(result.projects[0].requirements, [
      { resolution: '720*1280', requiredQuantity: 1 },
      { resolution: '1920*1080', requiredQuantity: 1 },
    ])
  })

  it('returns warnings for malformed detail rows', () => {
    const result = parseRequirementJson([{
      '项目名称': '异常项目',
      '尺寸要求明细': [
        { '分辨率': 'not-a-size', '所需数量': '' },
      ],
    }], 'bad.json')

    assert.strictEqual(result.projects[0].requirements.length, 0)
    assert.match(result.warnings.join('\n'), /无法识别尺寸/)
  })

  it('sanitizes file and directory path segments without stripping Chinese names', () => {
    assert.strictEqual(sanitizePathSegment(' 小火车:华为/0601 '), '小火车_华为_0601')
    assert.strictEqual(sanitizePathSegment(''), '未命名')
    assert.strictEqual(sanitizePathSegment('CON'), 'CON_')
  })

  it('reports missing quantity by normalized resolution', () => {
    const missing = getMissingRequirements(
      [
        { resolution: '1080x1920', requiredQuantity: 3 },
        { resolution: '1920*1080', requiredQuantity: 1 },
      ],
      new Map([
        ['1080*1920', 1],
        ['1920*1080', 1],
      ])
    )

    assert.deepStrictEqual(missing, [{
      resolution: '1080*1920',
      requiredQuantity: 3,
      actualQuantity: 1,
      missingCount: 2,
    }])
  })

  it('aggregates duplicate resolution requirements before comparing counts', () => {
    const missing = getMissingRequirements(
      [
        { resolution: '1080x1920', requiredQuantity: 2 },
        { resolution: '1080*1920', requiredQuantity: 1 },
      ],
      new Map([['1080*1920', 2]])
    )

    assert.deepStrictEqual(missing, [{
      resolution: '1080*1920',
      requiredQuantity: 3,
      actualQuantity: 2,
      missingCount: 1,
    }])
  })
})
