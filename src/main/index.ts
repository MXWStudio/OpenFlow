/**
 * Electron 主进程入口
 * 负责：窗口管理、所有 IPC 通道处理、底层 Node.js 能力
 */

import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron'
import { join, extname, basename, dirname } from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs-extra'
import sizeOf from 'image-size'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
// @ts-expect-error 无类型包
import ffprobeStatic from 'ffprobe-static'
import { pinyin } from 'pinyin-pro'

// ─── 初始化 ────────────────────────────────────────────
// 禁用硬件加速，解决部分环境下的黑屏问题
app.disableHardwareAcceleration()

// 设置 fluent-ffmpeg 使用静态 ffmpeg 可执行文件
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string)
}

// 设置 ffprobe 路径，确保视频尺寸可读；打包后需从 app.asar.unpacked 加载
if (ffprobeStatic?.path) {
  let ffprobePath = ffprobeStatic.path as string
  if (ffprobePath.includes('app.asar')) {
    ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked')
  }
  ffmpeg.setFfprobePath(ffprobePath)
}

// ─── 轻量级 JSON 配置存储 ────────────────────────────────
// 替代 electron-store（v10 为纯 ESM，与 Electron CJS 主进程不兼容）
// 数据持久化到用户数据目录的 config.json

function getConfigPath(): string {
  return join(app.getPath('userData'), 'openflow-config.json')
}

async function storeRead(): Promise<Record<string, unknown>> {
  try {
    return await fs.readJson(getConfigPath())
  } catch {
    return {}
  }
}

async function storeGetValue(key: string): Promise<unknown> {
  const data = await storeRead()
  // 支持点号路径，如 "userInfo.name"
  return key.split('.').reduce((obj: Record<string, unknown>, k) => obj?.[k] as Record<string, unknown>, data)
}

async function storeSetValue(key: string, value: unknown): Promise<void> {
  const data = await storeRead()
  const keys = key.split('.')
  let current: Record<string, unknown> = data
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {}
    }
    current = current[keys[i]] as Record<string, unknown>
  }
  current[keys[keys.length - 1]] = value
  await fs.outputJson(getConfigPath(), data, { spaces: 2 })
}

async function storeDeleteKey(key: string): Promise<void> {
  const data = await storeRead()
  const keys = key.split('.')
  if (keys.length === 1) {
    delete data[key]
  } else {
    let current: Record<string, unknown> = data
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>
      if (!current) return
    }
    delete current[keys[keys.length - 1]]
  }
  await fs.outputJson(getConfigPath(), data, { spaces: 2 })
}

// ─── 类型定义 ───────────────────────────────────────────

interface ValidationResult {
  fileName: string
  filePath: string
  folderName: string
  ext: string
  fileSize: number
  actualWidth: number
  actualHeight: number
  duration?: number
  status: 'valid' | 'mismatch' | 'missing' | 'error' | 'format_error'
  targetSize?: string
  /** 底层错误或说明，供前端展示 */
  error?: string
  workspaceProjectName?: string
}

interface RenameResult {
  oldFileName: string
  newFileName: string
  success: boolean
  error?: string
}

// ─── 支持的媒体文件扩展名 ────────────────────────────────
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'])

// ─── 工具函数 ───────────────────────────────────────────

/** 将 ffprobe 封装为 Promise */
function getVideoInfo(
  filePath: string
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
      if (!videoStream) return reject(new Error('未找到视频流'))
      resolve({
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        duration: metadata.format.duration || 0,
      })
    })
  })
}

/**
 * 应用新的对象数组形式重命名模板
 */
function applyNewTemplate(
  templateTokens: Array<{ type: string; value?: string }>,
  vars: Record<string, string>
): string {
  if (!Array.isArray(templateTokens) || templateTokens.length === 0) {
    return vars.Name || 'untitled'
  }

  let result = ''
  for (let i = 0; i < templateTokens.length; i++) {
    const token = templateTokens[i]
    let tokenStr = ''

    if (token.type === 'CustomText') {
      tokenStr = token.value || ''
    } else {
      tokenStr = vars[token.type] || ''
    }

    if (!tokenStr) continue

    if (result.length === 0) {
      result = tokenStr
    } else {
      // 检查是否需要省略横杠
      // 规则：当前是 Date，并且上一个是 CustomText 且其值为 RS 或 RSQ
      const prevToken = templateTokens[i - 1]
      const omitHyphen = token.type === 'Date' &&
                         prevToken &&
                         prevToken.type === 'CustomText' &&
                         (prevToken.value === 'RS' || prevToken.value === 'RSQ')

      if (omitHyphen) {
        result += tokenStr
      } else {
        result += '-' + tokenStr
      }
    }
  }

  return result.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

// ─── 窗口创建 ───────────────────────────────────────────

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false, // 先隐藏，等 ready-to-show 再显示，避免白屏
    autoHideMenuBar: true,
    backgroundColor: '#0f172a', // slate-900，防止加载时白色闪烁
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, // 安全：隔离上下文
      nodeIntegration: false, // 安全：禁止 renderer 直接访问 Node
      sandbox: false, // preload 需要访问 Node API
    },
  })

  // 窗口准备好后再显示，优化视觉体验
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 开发模式：加载 Vite dev server；生产模式：加载本地 HTML
  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 在系统默认浏览器中打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ─── 应用生命周期 ────────────────────────────────────────

app.whenReady().then(() => {
  // 注册自定义协议以允许安全加载本地文件
  protocol.handle('asset', (request) => {
    // request.url 将形如 "asset://<URL 编码后的本地路径>"
    let urlStr = request.url.slice('asset://'.length)
    // 还原被编码的路径，例如将 %20 还原为空格
    try {
      urlStr = decodeURIComponent(urlStr)
    } catch (e) {
      console.error('URI Decode Error', e)
    }

    // 将绝对路径转换为 file:// 协议 URL 以适配 net.fetch
    let fileUrl = ''
    try {
      fileUrl = pathToFileURL(urlStr).toString()
    } catch (e) {
      console.error('Invalid file path', urlStr)
      return new Response('Not Found', { status: 404 })
    }

    return net.fetch(fileUrl)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: 窗口控制 ──────────────────────────────────────

ipcMain.on('window:minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize()
})

ipcMain.on('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})

ipcMain.on('window:close', () => {
  BrowserWindow.getFocusedWindow()?.close()
})

// ─── IPC: 对话框 ─────────────────────────────────────────

/** 单个项目结构，供批量初始化目录使用 */
interface ProjectItem {
  projectName: string
  sizes: string[]
}

/**
 * dialog:openJson
 * 弹出系统文件选择框（仅限 .json），读取并智能解析内容。
 * 始终返回 projects 数组（多项目用于批量建目录），以及首项 projectName/sizes 兼容左侧单项目展示。
 *
 * 支持的 JSON 格式：
 *   1. 孟祥伟数据表：[{ "项目名称", "尺寸要求明细": [{ "分辨率": "1080*607" }] }] → 每行一个项目
 *   2. 标准对象：{ projectName, sizes } → 单项目
 */
ipcMain.handle('dialog:openJson', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择需求 JSON 文件',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile'],
  })

  if (result.canceled || !result.filePaths[0]) return null

  const filePath = result.filePaths[0]
  const fileName = basename(filePath)
  const rawData = JSON.parse(await fs.readFile(filePath, 'utf-8'))

  const projects: ProjectItem[] = []
  let projectName = ''
  let producerName = ''
  let sizes: string[] = []

  const norm = (s: string) => (s || '').replace(/[xX×-]/g, '*')

  if (Array.isArray(rawData)) {
    if (rawData.length > 0) {
      const firstItem = rawData[0]
      producerName = firstItem['制作人'] || firstItem['producerName'] || firstItem['producer'] || ''
    }

    for (const item of rawData) {
      const name =
        (item['其他信息'] && item['其他信息']['项目名称']) ||
        item['项目名称'] ||
        item['projectName'] ||
        item['project_name'] ||
        item['name'] ||
        ''
      const sizeSet = new Set<string>()
      const details = item['尺寸要求明细'] || item['sizes'] || []
      if (Array.isArray(details)) {
        for (const d of details) {
          const res = d['分辨率'] || d['resolution'] || d['size'] || ''
          if (res) sizeSet.add(norm(res))
        }
      }
      if (name) projects.push({ projectName: name, sizes: [...sizeSet] })
    }
    if (projects.length > 0) {
      projectName = projects[0].projectName
      const firstSizes = new Set<string>()
      for (const p of projects) p.sizes.forEach((s) => firstSizes.add(s))
      sizes = [...firstSizes]
    }
  } else {
    projectName =
      rawData.projectName || rawData.project_name || rawData.name || ''
    if (Array.isArray(rawData.sizes)) {
      sizes = rawData.sizes.map((s: string) => norm(s))
    } else if (Array.isArray(rawData.dimensions)) {
      sizes = rawData.dimensions.map((s: string) => norm(s))
    } else if (Array.isArray(rawData.requirements)) {
      sizes = rawData.requirements.map(
        (r: { width?: number; height?: number; size?: string }) =>
          r.size ? norm(r.size) : `${r.width}*${r.height}`
      )
    }
    if (projectName || sizes.length) {
      projects.push({ projectName: projectName || '未命名项目', sizes })
    }
    producerName = rawData['制作人'] || rawData['producerName'] || rawData['producer'] || ''
  }

  return { projectName, producerName, sizes, projects, rawData, fileName }
})

/**
 * dialog:selectFolder
 * 弹出文件夹选择框
 */
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择文件夹',
    properties: ['openDirectory'],
  })

  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

// ─── IPC: 文件系统 ───────────────────────────────────────

/**
 * fs:initFolders
 * 批量生成项目文件夹结构。接收 projectsData: Array<{ projectName, sizes }>，
 * 弹窗选择目标总目录后，为每个项目创建主文件夹，内部按尺寸建子文件夹（纯数字如 1080x1920）及 _Assets。
 */
ipcMain.handle('fs:initFolders', async (_, projectsData: ProjectItem[]) => {
  const list = Array.isArray(projectsData) ? projectsData : []
  if (list.length === 0) {
    return { success: false, destPath: '', error: '项目列表为空' }
  }

  const result = await dialog.showOpenDialog({
    title: '选择目标总目录',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) {
    return { success: false, destPath: '', error: '用户取消选择' }
  }
  const rootPath = result.filePaths[0]

  // 每个项目下除尺寸文件夹外，固定创建的 4 个素材分类文件夹（与尺寸文件夹同级）
  const FIXED_FOLDERS = ['截屏素材', '录屏素材', '奇觅生成', '模糊处理']

  try {
    for (const project of list) {
      const projectRoot = join(rootPath, project.projectName)
      await fs.ensureDir(projectRoot)

      const sizes = project.sizes || []
      for (const size of sizes) {
        const folderName = size.replace(/\*/g, 'x')
        const sizeDir = join(projectRoot, folderName)
        await fs.ensureDir(sizeDir)
        await fs.ensureDir(join(sizeDir, '_Assets'))
      }

      for (const name of FIXED_FOLDERS) {
        await fs.ensureDir(join(projectRoot, name))
      }
    }
    return { success: true, destPath: rootPath }
  } catch (error) {
    return { success: false, destPath: '', error: String(error) }
  }
})

/** 仅识别纯数字尺寸的一级子目录，如 720x1280、1080x1920 */
const SIZE_FOLDER_REGEX = /^\d+[xX-]\d+$/
/** 这些文件夹为原始物料目录，不参与尺寸识别，必须忽略 */
const SKIP_DIRS_READ_SIZE = new Set(['截屏素材', '录屏素材', '奇觅生成', '模糊处理', '_Assets'])

/**
 * fs:readProjectSizes
 * 根据传入的路径推断「项目根」并读取其一级子目录，仅提取名称符合「数字+x+数字」的文件夹，返回规范化尺寸数组供前端自动勾选。
 * - 若传入的是项目根（如 D:\\Project）：直接读该目录下 720x1280、1080x1920 等。
 * - 若传入的是尺寸子文件夹（如 D:\\Project\\720x1280，拖入时常会变成这种）：用其父目录作为项目根再读，否则会读不到任何尺寸。
 */
ipcMain.handle('fs:readProjectSizes', async (_, folderPaths: string[]) => {
  const paths = Array.isArray(folderPaths) ? folderPaths : []
  const sizeSet = new Set<string>()
  const roots = new Set<string>()

  for (const p of paths) {
    const base = basename(p)
    if (SIZE_FOLDER_REGEX.test(base)) {
      roots.add(dirname(p))
    } else {
      roots.add(p)
    }
  }

  for (const dir of roots) {
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (SKIP_DIRS_READ_SIZE.has(name)) continue
      const full = join(dir, name)
      let stat: fs.Stats
      try {
        stat = await fs.stat(full)
      } catch {
        continue
      }
      if (!stat.isDirectory()) continue
      if (!SIZE_FOLDER_REGEX.test(name)) continue
      sizeSet.add(name.replace(/[xX-]/g, '*'))
    }
  }
  return [...sizeSet]
})

/** 校验时必须跳过的目录：仅对「纯数字尺寸」文件夹内的媒体做校验，不读取物料目录 */
const SKIP_DIRS_VALIDATION = new Set(['截屏素材', '录屏素材', '奇觅生成', '模糊处理', '_Assets'])

/**
 * 收集可参与校验的媒体文件：仅从「纯数字尺寸」文件夹及其子目录（且排除物料目录）内读取。
 * - 在项目根（isRoot=true）：只进入匹配 SIZE_FOLDER_REGEX 的一级子目录。
 * - 进入后：不再进入 SKIP_DIRS_VALIDATION 中的目录（如 _Assets、截屏素材 等）。
 */
async function collectMediaFiles(
  dirPath: string,
  fileList: { filePath: string; fileName: string; folderName: string; ext: string; size: number }[],
  isRoot: boolean
): Promise<void> {
  let names: string[]
  try {
    names = await fs.readdir(dirPath)
  } catch {
    return
  }

  for (const name of names) {
    const fullPath = join(dirPath, name)
    let stat: fs.Stats
    try {
      stat = await fs.stat(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (isRoot) {
        if (SKIP_DIRS_VALIDATION.has(name) || !SIZE_FOLDER_REGEX.test(name)) continue
        await collectMediaFiles(fullPath, fileList, false)
      } else {
        if (SKIP_DIRS_VALIDATION.has(name)) continue
        await collectMediaFiles(fullPath, fileList, false)
      }
      continue
    }

    if (!stat.isFile()) continue

    const ext = extname(name).toLowerCase()
    if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue

    const folderName = basename(dirPath)

    fileList.push({
      filePath: fullPath,
      fileName: basename(name, ext),
      folderName,
      ext,
      size: stat.size,
    })
  }
}

/**
 * fs:startValidation
 * 递归扫描文件夹内媒体文件，读取真实宽高，与目标尺寸对比并打标
 */
ipcMain.handle('fs:startValidation', async (_, { folderPath, targetSizes }) => {
  const results: ValidationResult[] = []

  const targetSizeSet = new Set<string>(
    (targetSizes as string[]).map((s) => s.replace(/[xX-]/g, '*'))
  )

  const fileList: { filePath: string; fileName: string; folderName: string; ext: string; size: number }[] = []
  await collectMediaFiles(folderPath, fileList, true)

  for (const { filePath, fileName, folderName, ext, size: fileSize } of fileList) {
    const isImage = IMAGE_EXTS.has(ext)
    const isVideo = VIDEO_EXTS.has(ext)
    let actualWidth = 0
    let actualHeight = 0
    let duration: number | undefined

    try {
      if (isImage) {
        const dim = sizeOf(filePath)
        actualWidth = dim.width || 0
        actualHeight = dim.height || 0
      } else if (isVideo) {
        const info = await getVideoInfo(filePath)
        actualWidth = info.width
        actualHeight = info.height
        duration = info.duration
      }

      const actualSizeKey = `${actualWidth}*${actualHeight}`

      if (actualWidth === 0 && actualHeight === 0) {
        results.push({
          fileName,
          filePath,
          folderName,
          ext,
          fileSize,
          actualWidth: 0,
          actualHeight: 0,
          status: 'error',
          error: '无法获取尺寸（文件可能损坏或格式不支持）',
        })
        continue
      }

      if (targetSizeSet.has(actualSizeKey)) {
        results.push({
          fileName,
          filePath,
          folderName,
          ext,
          fileSize,
          actualWidth,
          actualHeight,
          duration,
          status: 'valid',
        })
      } else {
        results.push({
          fileName,
          filePath,
          folderName,
          ext,
          fileSize,
          actualWidth,
          actualHeight,
          duration,
          status: 'mismatch',
          error: '尺寸不符（当前尺寸未在左侧勾选）',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({
        fileName,
        filePath,
        folderName,
        ext,
        fileSize,
        actualWidth: 0,
        actualHeight: 0,
        status: 'error',
        error: `文件读取失败或损坏: ${message}`,
      })
    }
  }

  // 补充 missing：目标尺寸在本次文件夹中没有任何匹配文件
  for (const targetSize of targetSizes as string[]) {
    const normalized = targetSize.replace(/[xX-]/g, '*')
    const hasMatch = results.some(
      (r) => r.status === 'valid' && `${r.actualWidth}*${r.actualHeight}` === normalized
    )
    if (!hasMatch) {
      results.push({
        fileName: `[缺失] ${targetSize}`,
        filePath: '',
        folderName: '-',
        ext: '',
        fileSize: 0,
        actualWidth: 0,
        actualHeight: 0,
        status: 'missing',
        targetSize,
        error: '该尺寸在文件夹中无对应文件',
      })
    }
  }

  return results
})

/**
 * fs:executeRename
 * 批量重命名文件，自动处理同名冲突（追加 _1, _2...）
 */
ipcMain.handle('fs:executeRename', async (_, { files, templates, projectName, producer, isSpecialEnabled }) => {
  const results: RenameResult[] = []

  // Date in YYYYMMDD format
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}${month}${day}`

  // 记录每个文件夹和媒体类型独立的序号
  const sequenceCounters: Record<string, number> = {}

  for (const file of files as ValidationResult[]) {
    if (!file.filePath || file.status === 'missing') continue

    // 优先使用 file.workspaceProjectName (被拖入的工作区文件夹名)，后备使用全局 projectName
    const currentProjectName = file.workspaceProjectName || projectName || ''
    const isSpecial = isSpecialEnabled || currentProjectName.includes('创意比特') || currentProjectName.includes('（创意比特）') || currentProjectName.includes('(创意比特)')
    const cleanProjectName = currentProjectName.replace(/\(创意比特\)|（创意比特）|创意比特/g, '')

    const originalExt = file.ext || extname(file.filePath)
    const originalBaseName = file.fileName
    const sizeStr = `${file.actualWidth}x${file.actualHeight}`
    const dir = dirname(file.filePath)

    const isImage = IMAGE_EXTS.has(originalExt.toLowerCase())
    const isVideo = VIDEO_EXTS.has(originalExt.toLowerCase())

    let targetTemplate = []
    let finalExt = originalExt

    if (isVideo) {
      targetTemplate = isSpecial ? templates.videoSpecial : templates.videoRegular
      finalExt = '.mp4'
    } else if (isImage) {
      targetTemplate = isSpecial ? templates.imageSpecial : templates.imageRegular
    }

    const aspectRatio = file.actualWidth >= file.actualHeight ? '横' : '竖'
    const mediaType = isImage ? 'image' : (isVideo ? 'video' : 'other')
    const sequenceKey = `${dir}_${mediaType}`

    // 初始化该文件夹及媒体类型的序号，从 1 开始
    if (!sequenceCounters[sequenceKey]) {
      sequenceCounters[sequenceKey] = 1
    }
    const currentSequence = sequenceCounters[sequenceKey]

    const producerAbbr = producer
      ? pinyin(producer, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toUpperCase()
      : ''

    const vars: Record<string, string> = {
      ProjectName: currentProjectName || 'Project',
      CleanProjectName: cleanProjectName || 'Project',
      Date: today,
      Producer: producerAbbr,
      Resolution: sizeStr,
      AspectRatio: aspectRatio,
      Sequence: `(${currentSequence})`,
      OriginalName: originalBaseName
    }

    const newBaseName = applyNewTemplate(targetTemplate, vars)

    let newFileName = `${newBaseName}${finalExt}`
    let newFilePath = join(dir, newFileName)

    // 冲突处理：追加数字后缀
    let collisionCounter = 1
    while ((await fs.pathExists(newFilePath)) && newFilePath !== file.filePath) {
      newFileName = `${newBaseName}_${collisionCounter}${finalExt}`
      newFilePath = join(dir, newFileName)
      collisionCounter++
    }

    try {
      await fs.rename(file.filePath, newFilePath)
      results.push({ oldFileName: file.fileName, newFileName, success: true })
      sequenceCounters[sequenceKey]++ // 仅在成功时累加系列号
    } catch (err) {
      results.push({
        oldFileName: file.fileName,
        newFileName,
        success: false,
        error: String(err),
      })
    }
  }

  return results
})

/**
 * fs:scanOrganizerFolder
 * 扫描下载目录，匹配 游戏名-分辨率-时间-序号.后缀，并返回预览列表
 */
ipcMain.handle('fs:scanOrganizerFolder', async (_, { sourceDir, allowedFormats }) => {
  const results = []
  if (!sourceDir || !(await fs.pathExists(sourceDir))) return results

  let names = []
  try {
    names = await fs.readdir(sourceDir)
  } catch (err) {
    return results
  }

  const allowedExts = new Set((allowedFormats || []).map((f: string) => f.toLowerCase()))

  for (const name of names) {
    const ext = extname(name).toLowerCase()
    // 检查是否在允许的后缀中 (去掉点的名称比较，比如 .jpg -> jpg)
    if (!allowedExts.has(ext.replace('.', ''))) continue

    const fullPath = join(sourceDir, name)
    const stat = await fs.stat(fullPath)
    if (!stat.isFile()) continue

    const baseName = basename(name, ext)
    // 解析规则: 游戏名-分辨率-时间-序号
    // 分辨率支持 x 或 * (1080x607 -> 1080-607)
    // 但实际要求转换成分辨率用 '-' 作为分隔符
    const parts = baseName.split('-')
    if (parts.length >= 4) {
      // 假设格式为：GameName-1080x607-20260401-19
      // 注意：游戏名本身可能包含 '-'
      const sequence = parts.pop()
      const date = parts.pop()
      const rawRes = parts.pop()
      const gameName = parts.join('-') // 剩余部分都是游戏名

      if (rawRes && gameName) {
        // 转换分辨率 (如 1080x607 -> 1080-607)
        const parsedRes = rawRes.replace(/[xX*]/g, '-')
        results.push({
          id: fullPath, // 使用全路径作为唯一标识
          fileName: name,
          filePath: fullPath,
          gameName,
          resolution: parsedRes,
          date,
          sequence,
          ext,
          size: stat.size,
          selected: true // 默认选中
        })
      }
    }
  }

  return results
})

/**
 * fs:executeOrganize
 * 执行整理移动：从扫描结果列表中，移动到目标目录/游戏名/分辨率/
 */
ipcMain.handle('fs:executeOrganize', async (_, { files, destDir }) => {
  if (!files || files.length === 0) return { success: false, error: '没有需要移动的文件' }
  const results = []
  if (!destDir || !(await fs.pathExists(destDir))) {
    return { success: false, error: '目标转移目录不存在' }
  }

  // YYYYMMDD 用于冲突时追加日期
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}${month}${day}`

  let missingFolders = new Set<string>()

  for (const file of files) {
    if (!file.selected || !file.filePath || !file.gameName || !file.resolution) continue

    const gameFolder = join(destDir, file.gameName)
    let finalResolution = file.resolution

    // Check if the game folder exists and look for an existing resolution folder
    if (await fs.pathExists(gameFolder)) {
      try {
        const gameSubDirs = await fs.readdir(gameFolder)
        // Normalize the target resolution to just numbers, e.g. "1080-607" -> "1080_607"
        const normalizedTarget = file.resolution.replace(/[xX*\-]/g, '_')

        for (const subDir of gameSubDirs) {
          const fullSubDirPath = join(gameFolder, subDir)
          const stat = await fs.stat(fullSubDirPath)
          if (stat.isDirectory()) {
            const normalizedSubDir = subDir.replace(/[xX*\-]/g, '_')
            if (normalizedSubDir === normalizedTarget) {
              finalResolution = subDir
              break
            }
          }
        }
      } catch (err) {
        // Ignore read errors, will just use the default resolution name
      }
    }

    const targetFolder = join(gameFolder, finalResolution)

    // 如果目标文件夹不存在，记录并创建
    if (!(await fs.pathExists(targetFolder))) {
      missingFolders.add(`【${file.gameName}】缺少文件夹，已为您创建【${finalResolution}】文件夹。`)
      await fs.ensureDir(targetFolder)
    }

    let targetFileName = file.fileName
    let targetFilePath = join(targetFolder, targetFileName)

    // 冲突处理：如果同名，自动加今日时间：yyyymmdd
    // 如果加了时间还冲突，就再加序号
    if (await fs.pathExists(targetFilePath)) {
      const baseName = basename(file.fileName, file.ext)
      targetFileName = `${baseName}-${today}${file.ext}`
      targetFilePath = join(targetFolder, targetFileName)

      let counter = 1
      while (await fs.pathExists(targetFilePath)) {
        targetFileName = `${baseName}-${today}-${counter}${file.ext}`
        targetFilePath = join(targetFolder, targetFileName)
        counter++
      }
    }

    try {
      await fs.move(file.filePath, targetFilePath)
      results.push({ id: file.id, success: true, targetPath: targetFilePath })
    } catch (err) {
      results.push({ id: file.id, success: false, error: String(err) })
    }
  }

  return { success: true, results, missingFolders: Array.from(missingFolders) }
})

// ─── IPC: Shell ──────────────────────────────────────────

ipcMain.handle('shell:openPath', async (_, path: string) => {
  try {
    const errorMsg = await shell.openPath(path)
    return errorMsg || 'success'
  } catch (error) {
    return String(error)
  }
})

// ─── IPC: 持久化配置 ─────────────────────────────────────

ipcMain.handle('store:get', async (_, key: string) => {
  return storeGetValue(key)
})

ipcMain.handle('store:set', async (_, { key, value }: { key: string; value: unknown }) => {
  await storeSetValue(key, value)
})

ipcMain.handle('store:getAll', async () => {
  return storeRead()
})

ipcMain.handle('store:delete', async (_, key: string) => {
  await storeDeleteKey(key)
})

/**
 * dialog:exportLogs
 * 弹出“另存为”对话框，导出模拟日志文本到用户指定路径
 */
ipcMain.handle('dialog:exportLogs', async () => {
  const result = await dialog.showSaveDialog({
    title: '导出错误日志',
    defaultPath: `openflow-logs-${new Date().toISOString().slice(0, 10)}.txt`,
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
  })
  if (result.canceled || !result.filePath) return { success: false }

  const mockLog = `OpenFlow Studio - 系统日志
导出时间: ${new Date().toISOString()}
----------------------------------------
[INFO] 应用启动完成
[INFO] 配置加载成功
[INFO] 无错误记录
----------------------------------------
（此文件为模拟导出，用于测试“导出错误日志”功能）
`
  await fs.writeFile(result.filePath, mockLog, 'utf-8')
  return { success: true, path: result.filePath }
})
