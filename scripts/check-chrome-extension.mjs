import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const extensionRoot = resolve(root, 'extensions/chrome')
const manifestPath = resolve(extensionRoot, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

assert.equal(manifest.manifest_version, 3, 'Chrome extension must use Manifest V3')
assert.equal(manifest.action?.default_popup, 'popup.html', 'Popup entry must stay explicit')
assert.equal(manifest.background, undefined, 'Extension must not add a background worker without review')
assert.equal(manifest.host_permissions, undefined, 'Extension must not request persistent host access')

const expectedPermissions = ['activeTab', 'downloads', 'scripting', 'storage']
assert.deepEqual(
  [...(manifest.permissions ?? [])].sort(),
  expectedPermissions,
  'Extension permissions changed; review and update the contract intentionally'
)

const requiredFiles = [
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'xlsx.bundle.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'fixtures/requirements-v1.example.json',
  'THIRD_PARTY_NOTICES.md',
  'licenses/xlsx-js-style-LICENSE.txt',
]

for (const relativePath of requiredFiles) {
  assert.ok(existsSync(resolve(extensionRoot, relativePath)), `Missing extension resource: ${relativePath}`)
}

const popupHtml = readFileSync(resolve(extensionRoot, 'popup.html'), 'utf8')
const localReferences = [...popupHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((value) => !/^(?:https?:|data:|chrome:|#)/i.test(value))

for (const relativePath of localReferences) {
  assert.ok(existsSync(resolve(extensionRoot, relativePath)), `Broken popup resource reference: ${relativePath}`)
}

for (const scriptName of ['popup.js', 'content.js', 'xlsx.bundle.js']) {
  const result = spawnSync(process.execPath, ['--check', resolve(extensionRoot, scriptName)], {
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${scriptName} syntax check failed:\n${result.stderr || result.stdout}`)
}

const popupSource = readFileSync(resolve(extensionRoot, 'popup.js'), 'utf8')
const extractDefaultHeaders = (constantName) => {
  const match = popupSource.match(new RegExp(`const ${constantName} = "([^"]+)"`))
  assert.ok(match, `${constantName} is missing`)
  return match[1].split(',')
}

assert.deepEqual(
  extractDefaultHeaders('DEFAULT_GRAPHIC_HEADERS'),
  ['日期', '制作者', '项目名称', '公司主体', '集团', '需求方', '网易标识', '业务分类', '广告策略', '素材用途', '投放渠道', '素材类型', '原创', '尺寸延展'],
  'Graphic spreadsheet fields changed; keep the independent graphic contract'
)
assert.deepEqual(
  extractDefaultHeaders('DEFAULT_VIDEO_HEADERS'),
  ['日期', '制作人', '项目名称', '公司名称', '集团', '设计小组', '需求归属', '需求属性', '渠道', '素材类型', '工具标签', '视频总产出', '原创视频', '尺寸延展'],
  'Video spreadsheet fields changed; keep the independent video contract'
)

assert.match(popupSource, /schemaVersion:\s*['"]openflow\.requirements\.v1['"]/, 'JSON export schema is missing')
assert.match(popupSource, /projects:\s*formattedDataList/, 'JSON export projects payload is missing')
assert.match(popupSource, /action:\s*["']EXTRACT_BULK_DOM["'],\s*deadline/, 'Deadline filter is not sent to the page extractor')
assert.match(popupSource, /ensureExtractionCanExport/, 'Incomplete extraction export guard is missing')
assert.match(popupSource, /ALLOWED_TOOL_TAGS\s*=\s*new Set\(\[["']奇觅["'],\s*["']人工["']\]\)/, 'Tool tag options must stay limited to 奇觅 and 人工')
assert.match(popupSource, /toSpreadsheetCellValue/, 'Spreadsheet formula-injection guard is missing')
assert.match(popupSource, /calculateGraphicOutput/, 'Shared graphic output rule is missing')
assert.match(popupSource, /calculateVideoOutput/, 'Shared video output rule is missing')
assert.match(popupSource, /orderedData\["原创"\]\s*=\s*graphicOutput\.original/, 'JSON graphic original count is missing')
assert.match(popupSource, /orderedData\["尺寸延展"\]\s*=\s*graphicOutput\.sizeExtension/, 'JSON graphic size extension is missing')
assert.match(popupSource, /orderedData\["尺寸延展"\]\s*=\s*videoOutput\.sizeExtension/, 'JSON video size extension is missing')

const graphicOutputHelpersMatch = popupSource.match(/function parseRequiredQuantity\([\s\S]*?function calculateGraphicOutput\([\s\S]*?\n\}/)
assert.ok(graphicOutputHelpersMatch, 'Shared graphic output function cannot be evaluated')
const calculateGraphicOutput = vm.runInNewContext(
  `(() => { ${graphicOutputHelpersMatch[0]}; return calculateGraphicOutput })()`
)

for (const testCase of [
  { sets: 3, quantities: [3, 3, 3], original: 3, extension: 9 },
  { sets: 3, quantities: [3, 3, 3, 3, 3, 3], original: 3, extension: 18 },
  { sets: 6, quantities: [6, 6, 6], original: 6, extension: 18 },
  { sets: 3, quantities: [undefined, undefined], original: 3, extension: 6 },
]) {
  const result = calculateGraphicOutput(
    testCase.sets,
    testCase.quantities.map((requiredQuantity) => ({ requiredQuantity }))
  )
  assert.equal(result.original, testCase.original, 'Graphic original count mismatch')
  assert.equal(result.sizeExtension, testCase.extension, 'Graphic size extension mismatch')
}

assert.equal(
  [...popupSource.matchAll(/calculateGraphicOutput\(rawMaterialCount, details\)/g)].length,
  3,
  'The graphic rule must have one definition and be used by both JSON and Excel'
)

const videoOutputFunctionMatch = popupSource.match(/function calculateVideoOutput\([\s\S]*?\n\}/)
assert.ok(videoOutputFunctionMatch, 'Shared video output function cannot be evaluated')
const calculateVideoOutput = vm.runInNewContext(`(${videoOutputFunctionMatch[0]})`)

for (const testCase of [
  { sets: 3, detailCount: 0, original: 3, extension: 0, total: 3 },
  { sets: 3, detailCount: 1, original: 3, extension: 0, total: 3 },
  { sets: 6, detailCount: 2, original: 6, extension: 6, total: 12 },
  { sets: 3, detailCount: 3, original: 3, extension: 6, total: 9 },
  { sets: 3, detailCount: 4, original: 3, extension: 6, total: 9 },
]) {
  const result = calculateVideoOutput(testCase.sets, Array.from({ length: testCase.detailCount }, () => ({})))
  assert.equal(result.originalVideo, testCase.original, `${testCase.detailCount} sizes original video mismatch`)
  assert.equal(result.sizeExtension, testCase.extension, `${testCase.detailCount} sizes extension mismatch`)
  assert.equal(result.totalVideoOutput, testCase.total, `${testCase.detailCount} sizes total mismatch`)
}

assert.equal(
  [...popupSource.matchAll(/calculateVideoOutput\(rawMaterialCount, details\)/g)].length,
  3,
  'The shared video output rule must have one definition and be used by both JSON and Excel'
)

const contentSource = readFileSync(resolve(extensionRoot, 'content.js'), 'utf8')
assert.match(contentSource, /截止日期\[：:\]/, 'Deadline card matching is missing')
assert.match(contentSource, /matchedDescriptors/, 'Deadline-matched task traversal is missing')
assert.match(contentSource, /loadAllTaskCards/, 'Infinite task list loading is missing')
assert.match(contentSource, /DUPLICATE_TASK_ID/, 'Duplicate task ID rejection is missing')
assert.match(contentSource, /DETAIL_IDENTITY_NOT_CONFIRMED/, 'Stale detail rejection is missing')
assert.match(contentSource, /referenceResources/, 'Reference attachment classification is missing')

console.log('Chrome extension checks passed.')
