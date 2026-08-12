import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentSource = readFileSync(resolve(root, 'extensions/chrome/content.js'), 'utf8')

let selectedProject = ''
const detailInputs = [
  { value: '720*1280' },
  { value: '<51200Kb' },
  { value: '6' },
]
const detailRow = { querySelectorAll: () => detailInputs }
for (const input of detailInputs) input.closest = () => detailRow

const detailPanel = {
  get innerText() {
    return `${selectedProject}\n制作人：测试制作人\n素材类型：视频\n素材分辨率：720*1280\n大小限制：<51200Kb\n所需数量：6`
  },
  querySelectorAll(selector) {
    if (selector === 'input.ant-input') return detailInputs
    return []
  },
}

const taskList = {
  _scrollTop: 0,
  get scrollTop() {
    return this._scrollTop
  },
  set scrollTop(value) {
    this._scrollTop = Math.min(Number(value) || 0, Math.max(0, this.scrollHeight - this.clientHeight))
  },
  clientHeight: 100,
  scrollHeight: 100,
  querySelectorAll(selector) {
    return selector === '.p-4.cursor-pointer' ? cards : []
  },
  dispatchEvent() {},
}

const makeCard = (text) => ({
  innerText: text,
  querySelector(selector) {
    return selector === '.truncate' ? { innerText: text.split('\n')[0] } : null
  },
  click() {
    selectedProject = text.split('\n')[0]
  },
})
const cards = [
  makeCard('项目甲\n完成\n截止日期：2026-07-16\n所需3套'),
  makeCard('项目乙\n未开始\n截止日期：2026-07-16\n所需6套'),
  makeCard('项目丙\n完成\n截止日期：2026-07-15\n所需2套'),
]

const sandbox = {
  console,
  document: {
    querySelector(selector) {
      if (selector === '.ant-tabs-content-holder') return detailPanel
      if (selector === '.TaskListScroll') return taskList
      return null
    },
    querySelectorAll(selector) {
      return selector === '.p-4.cursor-pointer' ? cards : []
    },
  },
  location: { href: 'https://www.rsth.plus/CreativeCenter/ProductCreationWorkbench' },
  window: {},
  Event: class Event {
    constructor(type, options = {}) {
      this.type = type
      this.bubbles = Boolean(options.bubbles)
    }
  },
  chrome: {
    runtime: {
      onMessage: {
        addListener(listener) {
          sandbox.messageListener = listener
        },
      },
    },
  },
  setTimeout,
  clearTimeout,
}

sandbox.setTimeout = (callback, delay = 0) => setTimeout(callback, delay >= 300 ? 0 : delay)

vm.createContext(sandbox)
vm.runInContext(contentSource, sandbox, { filename: 'content.js' })

let response
taskList.querySelectorAll = () => []
taskList.clientHeight = 100
taskList.scrollHeight = 100
const asynchronous = sandbox.messageListener(
  { action: 'EXTRACT_BULK_DOM', deadline: '2026-07-14' },
  {},
  (value) => {
    response = value
  },
)

assert.equal(asynchronous, true, 'Bulk extraction must keep the response channel open')
await new Promise(resolvePromise => setTimeout(resolvePromise, 0))
assert.equal(response?.success, true)
assert.equal(response?.deadline, '2026-07-14')
assert.equal(response?.matchedCount, 0)
assert.equal(Array.isArray(response?.data), true)
assert.equal(response?.data.length, 0)

let matchedResponse
taskList.querySelectorAll = selector => selector === '.p-4.cursor-pointer' ? cards : []
taskList.clientHeight = 100
taskList.scrollHeight = 100
const matchingAsynchronous = sandbox.messageListener(
  { action: 'EXTRACT_BULK_DOM', deadline: '2026-07-16' },
  {},
  (value) => {
    matchedResponse = value
  },
)
assert.equal(matchingAsynchronous, true)
for (let attempts = 0; attempts < 400 && !matchedResponse; attempts += 1) {
  await new Promise(resolvePromise => setTimeout(resolvePromise, 25))
}

assert.equal(matchedResponse?.success, true)
assert.equal(matchedResponse?.matchedCount, 2)
assert.equal(matchedResponse?.data.length, 2)
assert.equal(matchedResponse?.data[0].status, '完成')
assert.equal(matchedResponse?.data[1].status, '未开始')
assert.equal(matchedResponse?.data[0].deadline, '2026-07-16')
assert.equal(matchedResponse?.data[0].details.length, 1)

console.log('Chrome deadline extraction tests passed.')
