import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentSource = readFileSync(resolve(root, 'extensions/chrome/content.js'), 'utf8')

const taskDetails = {
  初始任务: { taskId: '9999', sets: 1, file: '' },
  项目甲: {
    taskId: '1001',
    sets: 3,
    file: '白包_风暴战地先锋.apk',
    requirement: '第一段需求\n第二段需求',
    notice: '第一条注意\n第二条注意',
  },
  项目乙: {
    taskId: '1002',
    sets: 6,
    referenceUrl: 'https://pan.baidu.com/s/example?pwd=abcd',
  },
  项目丁: { taskId: '1003', sets: 2 },
}

let selectedProject = ''
let detailProject = '初始任务'
let staleProjects = new Set()
let delayedProjects = new Set()
let duplicateTaskIdFor = ''

function makeAnchor(href, text) {
  return {
    href,
    innerText: text,
    textContent: text,
    getAttribute(name) {
      return name === 'href' ? href : null
    },
  }
}

function makeFieldElement(text, anchors = []) {
  return {
    innerText: text,
    textContent: text,
    querySelectorAll(selector) {
      return selector === 'a[href]' ? anchors : []
    },
  }
}

function getCurrentDetail() {
  const detail = { ...(taskDetails[detailProject] || taskDetails.初始任务) }
  if (duplicateTaskIdFor === detailProject) detail.taskId = taskDetails.项目甲.taskId
  return detail
}

function getFieldElements() {
  const detail = getCurrentDetail()
  const fields = [
    makeFieldElement(`任务ID: ${detail.taskId}`),
    makeFieldElement('制作人:\n测试制作人'),
    makeFieldElement('应用类型:'),
    makeFieldElement('素材用途: 代投'),
    makeFieldElement('素材类型: 视频'),
    makeFieldElement(`素材数: ${detail.sets}套`),
    makeFieldElement('期望完成日期: 2026-07-16'),
    makeFieldElement(`需求详情:\n${detail.requirement || '默认需求'}`),
    makeFieldElement(`注意事项:\n${detail.notice || '默认注意'}`),
  ]

  if (detail.referenceUrl) {
    fields.push(makeFieldElement(
      `素材参考链接: ${detail.referenceUrl}`,
      [makeAnchor(detail.referenceUrl, '百度网盘 提取码 abcd')],
    ))
  } else {
    fields.push(makeFieldElement('素材参考链接:'))
  }
  fields.push(makeFieldElement(`参考文件: ${detail.file || ''}`))
  fields.push(makeFieldElement('已制作素材: 视频：12'))
  return fields
}

function getDetailInputs() {
  const detail = getCurrentDetail()
  const inputs = [
    { value: '720*1280' },
    { value: '<51200Kb' },
    { value: String(detail.sets) },
  ]
  const detailRow = { querySelectorAll: () => inputs }
  inputs.forEach(input => { input.closest = () => detailRow })
  return inputs
}

const detailPanel = {
  get innerText() {
    return getFieldElements().map(element => element.innerText).join('\n')
  },
  get textContent() {
    return this.innerText
  },
  querySelectorAll(selector) {
    if (selector === 'input.ant-input') return getDetailInputs()
    if (selector === 'span, p, div') return getFieldElements()
    return []
  },
}

function makeCard(text) {
  const projectName = text.split('\n')[0]
  return {
    innerText: text,
    textContent: text,
    className: 'p-4 cursor-pointer relative bg-transparent',
    style: {
      get backgroundColor() {
        return selectedProject === projectName ? 'rgb(221, 221, 221)' : 'transparent'
      },
    },
    getAttribute(name) {
      return name === 'aria-selected' && selectedProject === projectName ? 'true' : null
    },
    querySelector(selector) {
      return selector === '.truncate' ? { innerText: projectName, textContent: projectName } : null
    },
    scrollIntoView() {},
    click() {
      selectedProject = projectName
      if (staleProjects.has(projectName)) return
      if (delayedProjects.has(projectName)) {
        setTimeout(() => { detailProject = projectName }, 8)
      } else {
        detailProject = projectName
      }
    },
  }
}

const cards = [
  makeCard('项目甲\n完成\n第1次下单-视频类AI创意素材组\n截止日期：2026-07-16\n所需3套'),
  makeCard('项目乙\n未开始\n第1次下单-视频类AI创意素材组\n截止日期：2026-07-16\n所需6套'),
  makeCard('项目丁\n完成\n第1次下单-视频类AI创意素材组\n截止日期：2026-07-16\n所需2套'),
  makeCard('项目丙\n完成\n第1次下单-视频类AI创意素材组\n截止日期：2026-07-15\n所需2套'),
]

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

const sandbox = {
  console: { log() {}, warn() {}, error: console.error, debug() {} },
  document: {
    body: detailPanel,
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
  setTimeout(callback, delay = 0) {
    return setTimeout(callback, Math.min(delay, 2))
  },
  clearTimeout,
}

vm.createContext(sandbox)
vm.runInContext(contentSource, sandbox, { filename: 'content.js' })

async function extract(deadline, options = {}) {
  let response
  const asynchronous = sandbox.messageListener(
    { action: 'EXTRACT_BULK_DOM', deadline, detailTimeoutMs: 40, maxAttempts: 2, ...options },
    {},
    value => { response = value },
  )
  assert.equal(asynchronous, true, 'Bulk extraction must keep the response channel open')
  for (let attempts = 0; attempts < 400 && !response; attempts += 1) {
    await new Promise(resolvePromise => setTimeout(resolvePromise, 5))
  }
  assert.ok(response, `Extraction response timed out for ${deadline}`)
  return response
}

function resetScenario() {
  selectedProject = ''
  detailProject = '初始任务'
  staleProjects = new Set()
  delayedProjects = new Set()
  duplicateTaskIdFor = ''
}

resetScenario()
const emptyResponse = await extract('2026-07-14')
assert.equal(emptyResponse.success, true)
assert.equal(emptyResponse.deadline, '2026-07-14')
assert.equal(emptyResponse.matchedCount, 0)
assert.equal(emptyResponse.complete, true)
assert.deepEqual(Array.from(emptyResponse.failedTasks), [])

resetScenario()
delayedProjects.add('项目乙')
const matchedResponse = await extract('2026-07-16', { detailTimeoutMs: 80 })
assert.equal(matchedResponse.success, true)
assert.equal(matchedResponse.matchedCount, 3)
assert.equal(matchedResponse.complete, true)
assert.equal(matchedResponse.data.length, 3)
assert.deepEqual(Array.from(matchedResponse.data, task => task.taskId), ['1001', '1002', '1003'])
assert.equal(matchedResponse.data[0].status, '完成')
assert.equal(matchedResponse.data[1].status, '未开始')
assert.equal(matchedResponse.data[0].deadline, '2026-07-16')
assert.equal(matchedResponse.data[0].details.length, 1)
assert.equal(matchedResponse.data[0]['应用类型'], undefined, 'Empty fields must stay empty')
assert.equal(matchedResponse.data[0]['素材用途'], '代投', 'The next field must not be consumed by an empty field')
assert.equal(matchedResponse.data[0]['需求详情'], '第一段需求\n第二段需求')
assert.equal(matchedResponse.data[0]['注意事项'], '第一条注意\n第二条注意')
assert.equal(matchedResponse.data[0]['参考文件'], '白包_风暴战地先锋.apk')
assert.deepEqual(
  Array.from(matchedResponse.data[0].referenceResources, ({ field, kind, fileName }) => ({ field, kind, fileName })),
  [{ field: '参考文件', kind: 'attachment', fileName: '白包_风暴战地先锋.apk' }],
)
assert.equal(matchedResponse.data[1].referenceResources[0].kind, 'cloud_link')
assert.equal(matchedResponse.data[1].referenceResources[0].url, taskDetails.项目乙.referenceUrl)

resetScenario()
const unstartedResponse = await extract('', { status: '未开始' })
assert.equal(unstartedResponse.success, true)
assert.equal(unstartedResponse.filterMode, 'status')
assert.equal(unstartedResponse.statusFilter, '未开始')
assert.equal(unstartedResponse.deadline, '')
assert.equal(unstartedResponse.matchedCount, 1)
assert.equal(unstartedResponse.complete, true)
assert.equal(unstartedResponse.data.length, 1)
assert.equal(unstartedResponse.data[0].projectName, '项目乙')
assert.equal(unstartedResponse.data[0].status, '未开始')
assert.equal(unstartedResponse.data[0].deadline, '2026-07-16')

resetScenario()
staleProjects.add('项目乙')
const staleResponse = await extract('2026-07-16')
assert.equal(staleResponse.success, true)
assert.equal(staleResponse.matchedCount, 3)
assert.equal(staleResponse.complete, false)
assert.equal(staleResponse.data.length, 2)
assert.equal(staleResponse.failedTasks.length, 1)
assert.equal(staleResponse.failedTasks[0].projectName, '项目乙')
assert.equal(staleResponse.failedTasks[0].code, 'DETAIL_IDENTITY_NOT_CONFIRMED')
assert.ok(!staleResponse.data.some(task => task.projectName === '项目乙'), 'A stale panel must never be exported as the next task')

resetScenario()
duplicateTaskIdFor = '项目丁'
const duplicateResponse = await extract('2026-07-16')
assert.equal(duplicateResponse.complete, false)
assert.equal(duplicateResponse.data.length, 2)
assert.equal(duplicateResponse.failedTasks.length, 1)
assert.equal(duplicateResponse.failedTasks[0].projectName, '项目丁')
assert.equal(duplicateResponse.failedTasks[0].code, 'DUPLICATE_TASK_ID')

console.log('Chrome deadline extraction tests passed.')
