/**
 * Electron 主进程入口
 * 负责：窗口管理、所有 IPC 通道处理、底层 Node.js 能力
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, extname, basename, dirname } from 'path'
import fs from 'fs-extra'
import sizeOf from 'image-size'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'

// ─── 初始化 ────────────────────────────────────────────

// 设置 fluent-ffmpeg 使用静态 ffmpeg 可执行文件
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string)
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
  fileName: string    // 纯文件名（不含扩展名）
  filePath: string    // 完整路径（用于重命名）
  folderName: string  // 所在文件夹名（直接父级目录名）
  ext: string         // 扩展名含点，如 .mp4
  fileSize: number
  actualWidth: number
  actualHeight: number
  duration?: number
  status: 'valid' | 'mismatch' | 'missing' | 'error'
  targetSize?: string
  error?: string
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
 * 应用重命名模板
 * 支持变量：[Project], [Name], [Size], [Producer], [Date]
 */
function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\[(\w+)\]/g, (_, key) => vars[key] ?? `[${key}]`)
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
  const rawData = JSON.parse(await fs.readFile(filePath, 'utf-8'))

  const projects: ProjectItem[] = []
  let projectName = ''
  let sizes: string[] = []

  const norm = (s: string) => (s || '').replace(/[xX×]/g, '*')

  if (Array.isArray(rawData)) {
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
  }

  return { projectName, sizes, projects, rawData }
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

  try {
    for (const project of list) {
      const projectRoot = join(rootPath, project.projectName)
      await fs.ensureDir(projectRoot)

      const sizes = project.sizes || []
      for (const size of sizes) {
        // 仅用数字命名：将 * 替换为小写 x，如 1080*1920 → 1080x1920，不添加任何中文后缀
        const folderName = size.replace(/\*/g, 'x')
        const sizeDir = join(projectRoot, folderName)
        await fs.ensureDir(sizeDir)
        await fs.ensureDir(join(sizeDir, '_Assets'))
      }
    }
    return { success: true, destPath: rootPath }
  } catch (error) {
    return { success: false, destPath: '', error: String(error) }
  }
})

/**
 * fs:readProjectSizes
 * 接收一个或多个文件夹路径，读取各自的一级子目录名称；
 * 若子目录名符合尺寸格式（纯数字+小写x，如 720x1280、1080x1920），则提取并去重，
 * 返回规范化后的尺寸数组（* 分隔，与左侧胶囊一致）。
 */
const SIZE_FOLDER_REGEX = /^\d+[xX]\d+$/
ipcMain.handle('fs:readProjectSizes', async (_, folderPaths: string[]) => {
  const paths = Array.isArray(folderPaths) ? folderPaths : []
  const sizeSet = new Set<string>()
  for (const dir of paths) {
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const name of names) {
      const full = join(dir, name)
      let stat: fs.Stats
      try {
        stat = await fs.stat(full)
      } catch {
        continue
      }
      if (!stat.isDirectory()) continue
      if (SIZE_FOLDER_REGEX.test(name)) {
        sizeSet.add(name.replace(/[xX]/g, '*'))
      }
    }
  }
  return [...sizeSet]
})

/**
 * 深度递归收集目录下所有媒体文件。
 * 不使用 { withFileTypes: true }，改用 fs.stat 以获得最大的跨平台兼容性
 * （尤其是含中文名的目录在部分 Windows 环境下 Dirent.isDirectory() 会失效）。
 */
async function collectMediaFiles(
  dirPath: string,
  fileList: { filePath: string; fileName: string; folderName: string; ext: string; size: number }[]
): Promise<void> {
  let names: string[]
  try {
    names = await fs.readdir(dirPath)
  } catch {
    // 无权访问或路径无效时跳过该层，不影响其他层
    return
  }

  for (const name of names) {
    const fullPath = join(dirPath, name)
    let stat: fs.Stats
    try {
      stat = await fs.stat(fullPath)
    } catch {
      continue // 无法 stat 的项（如临时文件、系统占用）跳过
    }

    if (stat.isDirectory()) {
      // 无条件递归进入，不过滤任何目录名
      await collectMediaFiles(fullPath, fileList)
      continue
    }

    if (!stat.isFile()) continue

    const ext = extname(name).toLowerCase()
    if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue

    // folderName: 该文件直接所在的父级目录名（不含路径，用于表格"文件夹"列展示）
    const folderName = basename(dirPath)

    fileList.push({
      filePath: fullPath,
      fileName: basename(name, ext), // 纯文件名，不含扩展名
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
    (targetSizes as string[]).map((s) => s.replace('x', '*'))
  )

  const fileList: { filePath: string; fileName: string; folderName: string; ext: string; size: number }[] = []
  await collectMediaFiles(folderPath, fileList)

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
      results.push({
        fileName,
        filePath,
        folderName,
        ext,
        fileSize,
        actualWidth,
        actualHeight,
        duration,
        status: targetSizeSet.has(actualSizeKey) ? 'valid' : 'mismatch',
      })
    } catch (err) {
      results.push({
        fileName,
        filePath,
        folderName,
        ext,
        fileSize,
        actualWidth: 0,
        actualHeight: 0,
        status: 'error',
        error: String(err),
      })
    }
  }

  // 补充 missing：目标尺寸在本次文件夹中没有任何匹配文件
  for (const targetSize of targetSizes as string[]) {
    const normalized = targetSize.replace('x', '*')
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
      })
    }
  }

  return results
})

/**
 * fs:executeRename
 * 批量重命名文件，自动处理同名冲突（追加 _1, _2...）
 */
ipcMain.handle('fs:executeRename', async (_, { files, template, projectName, producer }) => {
  const results: RenameResult[] = []
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')

  for (const file of files as ValidationResult[]) {
    if (!file.filePath || file.status === 'missing') continue

    // fileName 已是不含扩展名的纯名称，ext 字段即扩展名（含点，如 .mp4）
    const ext = file.ext || extname(file.filePath)
    const originalBaseName = file.fileName
    const sizeStr = `${file.actualWidth}x${file.actualHeight}`
    const dir = dirname(file.filePath)

    const newBaseName = applyTemplate(template || '[Project]-[Name]-[Size]', {
      Project: projectName || 'Project',
      Name: originalBaseName,
      Size: sizeStr,
      Producer: producer || '',
      Date: today,
    })

    let newFileName = `${newBaseName}${ext}`
    let newFilePath = join(dir, newFileName)

    // 冲突处理：追加数字后缀
    let counter = 1
    while ((await fs.pathExists(newFilePath)) && newFilePath !== file.filePath) {
      newFileName = `${newBaseName}_${counter}${ext}`
      newFilePath = join(dir, newFileName)
      counter++
    }

    try {
      await fs.rename(file.filePath, newFilePath)
      results.push({ oldFileName: file.fileName, newFileName, success: true })
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
