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
  fileName: string
  filePath: string
  ext: string
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

/**
 * dialog:openJson
 * 弹出系统文件选择框（仅限 .json），读取并智能解析内容
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

  // 智能解析：兼容多种常见 JSON 格式
  const projectName =
    rawData.projectName || rawData.project_name || rawData.name || ''

  let sizes: string[] = []
  if (Array.isArray(rawData.sizes)) {
    sizes = rawData.sizes
  } else if (Array.isArray(rawData.dimensions)) {
    sizes = rawData.dimensions
  } else if (Array.isArray(rawData.requirements)) {
    sizes = rawData.requirements.map(
      (r: { width: number; height: number; size?: string }) =>
        r.size || `${r.width}*${r.height}`
    )
  }

  return { projectName, sizes, rawData }
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
 * 在目标目录下创建项目文件夹结构：
 *   outputPath/ProjectName/1920x1080_横版/_Assets/
 */
ipcMain.handle('fs:initFolders', async (_, { projectName, sizes, outputPath }) => {
  try {
    const projectRoot = join(outputPath, projectName)
    await fs.ensureDir(projectRoot)

    for (const size of sizes as string[]) {
      const normalized = size.replace('x', '*')
      const [w, h] = normalized.split('*').map(Number)
      const orientation = w > h ? '横版' : w < h ? '竖版' : '方形'
      const folderName = `${w}x${h}_${orientation}`

      const sizeDir = join(projectRoot, folderName)
      await fs.ensureDir(sizeDir)
      await fs.ensureDir(join(sizeDir, '_Assets'))
    }

    return { success: true, rootPath: projectRoot }
  } catch (error) {
    return { success: false, rootPath: '', error: String(error) }
  }
})

/**
 * fs:startValidation
 * 扫描文件夹，读取每个媒体文件的真实尺寸，对比目标尺寸
 */
ipcMain.handle('fs:startValidation', async (_, { folderPath, targetSizes }) => {
  const results: ValidationResult[] = []

  // 标准化目标尺寸为 "W*H" 格式的 Set
  const targetSizeSet = new Set<string>(
    (targetSizes as string[]).map((s) => s.replace('x', '*'))
  )

  let files: string[]
  try {
    files = await fs.readdir(folderPath)
  } catch {
    return []
  }

  for (const fileName of files) {
    const filePath = join(folderPath, fileName)

    let stat: fs.Stats
    try {
      stat = await fs.stat(filePath)
    } catch {
      continue
    }

    if (!stat.isFile()) continue

    const ext = extname(fileName).toLowerCase()
    const isImage = IMAGE_EXTS.has(ext)
    const isVideo = VIDEO_EXTS.has(ext)
    if (!isImage && !isVideo) continue

    let actualWidth = 0
    let actualHeight = 0
    let duration: number | undefined

    try {
      if (isImage) {
        const dim = sizeOf(filePath)
        actualWidth = dim.width || 0
        actualHeight = dim.height || 0
      } else {
        const info = await getVideoInfo(filePath)
        actualWidth = info.width
        actualHeight = info.height
        duration = info.duration
      }

      const actualSizeKey = `${actualWidth}*${actualHeight}`
      results.push({
        fileName,
        filePath,
        ext,
        fileSize: stat.size,
        actualWidth,
        actualHeight,
        duration,
        status: targetSizeSet.has(actualSizeKey) ? 'valid' : 'mismatch',
      })
    } catch (err) {
      results.push({
        fileName,
        filePath,
        ext,
        fileSize: stat.size,
        actualWidth: 0,
        actualHeight: 0,
        status: 'error',
        error: String(err),
      })
    }
  }

  // 补充 missing 记录：目标尺寸中没有找到对应文件
  for (const targetSize of targetSizes as string[]) {
    const normalized = targetSize.replace('x', '*')
    const hasMatch = results.some(
      (r) => r.status === 'valid' && `${r.actualWidth}*${r.actualHeight}` === normalized
    )
    if (!hasMatch) {
      results.push({
        fileName: `[缺失] ${targetSize}`,
        filePath: '',
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

    const ext = extname(file.fileName)
    const originalBaseName = basename(file.fileName, ext)
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
