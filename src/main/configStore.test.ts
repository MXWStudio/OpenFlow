import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { JsonConfigStore } from './configStore.ts'

const tempRoots: string[] = []

async function createStore(options: ConstructorParameters<typeof JsonConfigStore>[1] = {}) {
  const root = await mkdtemp(join(tmpdir(), 'openflow-config-'))
  tempRoots.push(root)
  const configPath = join(root, 'openflow-config.json')
  return { root, configPath, store: new JsonConfigStore(configPath, options) }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('JsonConfigStore', () => {
  it('serializes concurrent nested mutations without losing updates', async () => {
    const { configPath, store } = await createStore()

    await Promise.all(Array.from({ length: 24 }, (_, index) => store.set(`team.member${index}`, index)))
    await store.delete('team.member3')

    const data = await store.getAll()
    const team = data.team as Record<string, unknown>
    assert.strictEqual(Object.keys(team).length, 23)
    assert.strictEqual(team.member0, 0)
    assert.strictEqual(team.member23, 23)
    assert.strictEqual(team.member3, undefined)
    assert.deepStrictEqual(JSON.parse(await readFile(configPath, 'utf8')), data)
  })

  it('keeps the live configuration intact when atomic replacement fails', async () => {
    const replaceError = Object.assign(new Error('simulated interruption before replace'), { code: 'EIO' })
    const { root, configPath, store } = await createStore({
      processId: 42,
      replaceFile: async () => { throw replaceError },
    })
    const original = { workflow: { renameSettings: { marker: 'previous-valid-config' } } }
    await writeFile(configPath, `${JSON.stringify(original, null, 2)}\n`, 'utf8')

    await assert.rejects(store.set('workflow.renameSettings.marker', 'new-value'), /simulated interruption/)

    assert.deepStrictEqual(JSON.parse(await readFile(configPath, 'utf8')), original)
    assert.deepStrictEqual(await store.getAll(), original)
    assert.deepStrictEqual((await readdir(root)).filter((name) => name.endsWith('.tmp')), [])
  })

  it('replaces with a complete file through the configured same-filesystem rename', async () => {
    let replacementCalls = 0
    const { configPath, store } = await createStore({
      replaceFile: async (temporaryPath, destinationPath) => {
        replacementCalls += 1
        await rename(temporaryPath, destinationPath)
      },
    })

    await store.set('workflow.renameSettings.schemaVersion', 'openflow.rename.v2')
    await store.set('workflow.renameSettings.lastCustomPresetId', 'team-template')

    assert.strictEqual(replacementCalls, 2)
    assert.deepStrictEqual(JSON.parse(await readFile(configPath, 'utf8')), await store.getAll())
  })

  it('rejects prototype-pollution paths without mutating storage', async () => {
    const { store } = await createStore()
    await store.set('safe.value', 1)
    await store.set('__proto__.polluted', true)
    await store.delete('constructor.prototype')

    assert.deepStrictEqual(await store.getAll(), { safe: { value: 1 } })
  })
})
