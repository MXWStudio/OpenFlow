import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRequirementJson } from './requirements.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const extensionRoot = resolve(root, 'extensions/chrome')

describe('OpenFlow Chrome extension contract', () => {
  it('keeps the exporter and desktop parser on openflow.requirements.v1', () => {
    const popupSource = readFileSync(resolve(extensionRoot, 'popup.js'), 'utf8')
    assert.match(popupSource, /schemaVersion:\s*['"]openflow\.requirements\.v1['"]/)

    const fixture = JSON.parse(
      readFileSync(resolve(extensionRoot, 'fixtures/requirements-v1.example.json'), 'utf8')
    )
    assert.equal(fixture.source?.app, 'OpenFlow')
    assert.match(popupSource, /app:\s*['"]OpenFlow['"]/)

    const parsed = parseRequirementJson(fixture, 'openflow-requirements.json')

    assert.equal(parsed.projectName, '示例项目')
    assert.equal(parsed.producerName, '测试制作人')
    assert.deepEqual(parsed.sizes, ['1080*1920', '1920*1080'])
    assert.deepEqual(
      parsed.projects[0].requirements.map(({ resolution, requiredQuantity }) => ({
        resolution,
        requiredQuantity,
      })),
      [
        { resolution: '1080*1920', requiredQuantity: 3 },
        { resolution: '1920*1080', requiredQuantity: 1 },
      ]
    )
    assert.deepEqual(parsed.warnings, [])
  })
})
