/**
 * Electron 主进程入口
 * 负责：窗口管理、所有 IPC 通道处理、底层 Node.js 能力
 */

import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, globalShortcut, Tray, Menu, desktopCapturer, screen, clipboard, nativeImage } from 'electron'
import { join, extname, basename, dirname } from 'path'
import { autoUpdater } from 'electron-updater'
import { pathToFileURL } from 'url'
import fs from 'fs-extra'
import sizeOf from 'image-size'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
// @ts-expect-error 无类型包
import ffprobeStatic from 'ffprobe-static'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { pinyin } from 'pinyin-pro'
import * as xlsx from 'xlsx'
import sharp from 'sharp'
import {
  clearAllImportedData,
  deleteBatch,
  deleteImportedData,
  getImportedData,
  insertImportedData,
  updateImportedData,
  getGameMappings,
  insertGameMapping,
  updateGameMapping,
  deleteGameMapping,
  getExcelFiles,
  insertExcelFile,
  deleteExcelFile,
  clearAllExcelFiles
} from './utils/db'

// ─── 初始化 ────────────────────────────────────────────
// 禁用硬件加速，解决部分环境下的黑屏问题
app.disableHardwareAcceleration()

let tray: Tray | null = null
let screenshotWindow: BrowserWindow | null = null
const pinWindows: Set<BrowserWindow> = new Set()

// 设置 fluent-ffmpeg 使用静态 ffmpeg 可执行文件
let ffmpegPath = ffmpegInstaller.path || (ffmpegStatic as string)
if (ffmpegPath) {
  if (ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
  }
  ffmpeg.setFfmpegPath(ffmpegPath)
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
  const keys = key.split('.')
  // 安全检查：防止原型污染
  if (keys.some((k) => ['__proto__', 'constructor', 'prototype'].includes(k))) {
    return undefined
  }
  // 支持点号路径，如 "userInfo.name"
  return keys.reduce(
    (obj: Record<string, unknown>, k) => obj?.[k] as Record<string, unknown>,
    data
  )
}

async function storeSetValue(key: string, value: unknown): Promise<void> {
  const data = await storeRead()
  const keys = key.split('.')
  // 安全检查：防止原型污染
  if (keys.some((k) => ['__proto__', 'constructor', 'prototype'].includes(k))) {
    return
  }
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
  // 安全检查：防止原型污染
  if (keys.some((k) => ['__proto__', 'constructor', 'prototype'].includes(k))) {
    return
  }
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
      // 规则：当前是 Date，并且上一个是 CustomText 且它是第一个元素
      const prevToken = templateTokens[i - 1]
      const omitHyphen = token.type === 'Date' &&
                         prevToken &&
                         prevToken.type === 'CustomText' &&
                         i - 1 === 0

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

let mainWindow: BrowserWindow | null = null

let closeToTray = true // 默认为 true

function createWindow(): void {
  mainWindow = new BrowserWindow({
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

  mainWindow.on('close', (e) => {
    if (closeToTray && !(app as any).isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
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

// ─── 截屏功能 ───────────────────────────────────────────

async function startScreenshot() {
  console.log('--- Starting Screenshot ---')
  if (screenshotWindow) {
    console.log('Screenshot window already exists')
    if (!screenshotWindow.isDestroyed()) {
      screenshotWindow.focus()
      return
    }
    screenshotWindow = null
  }

  // Get total bounds of all displays
  const displays = screen.getAllDisplays()
  let minX = 0, minY = 0, maxX = 0, maxY = 0
  displays.forEach(display => {
    const bounds = display.bounds
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  })

  const width = maxX - minX
  const height = maxY - minY
  console.log('Display bounds:', { minX, minY, width, height })

  screenshotWindow = new BrowserWindow({
    x: minX,
    y: minY,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  // Capture all screens
  try {
    console.log('Capturing sources...')
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    })

    console.log('Sources found:', sources.length)
    if (sources.length === 0) {
      throw new Error('No screen sources found')
    }

    // We'll pass the first source for now
    const source = sources[0]
    console.log('Selected source:', source.name)

    screenshotWindow.once('ready-to-show', () => {
      console.log('Screenshot window ready to show')
      if (screenshotWindow && !screenshotWindow.isDestroyed()) {
        screenshotWindow.show()
        screenshotWindow.webContents.send('screenshot:captured', source.thumbnail.toDataURL())
        console.log('Sent screenshot:captured to renderer')
      }
    })

    const isDev = !app.isPackaged
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      const url = `${process.env['ELECTRON_RENDERER_URL']}/screenshot.html`
      console.log('Loading URL:', url)
      screenshotWindow.loadURL(url)
    } else {
      const path = join(__dirname, '../renderer/screenshot.html')
      console.log('Loading file:', path)
      screenshotWindow.loadFile(path)
    }
  } catch (err) {
    console.error('Screenshot capture failed:', err)
    if (screenshotWindow) {
      screenshotWindow.close()
      screenshotWindow = null
    }
  }

  screenshotWindow?.on('closed', () => {
    console.log('Screenshot window closed')
    screenshotWindow = null
  })
}

function closeScreenshot() {
  if (screenshotWindow) {
    screenshotWindow.close()
    screenshotWindow = null
  }
}

// ─── 悬浮贴图功能 ────────────────────────────────────────

function createPinWindow(dataUrl: string, bounds: { width: number, height: number, x: number, y: number }) {
  console.log('Creating Pin Window with bounds:', bounds)
  const pinWin = new BrowserWindow({
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  pinWin.once('ready-to-show', () => {
    pinWin.show()
    pinWin.webContents.send('pin:data', dataUrl)
  })

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    pinWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/pin.html`)
  } else {
    pinWin.loadFile(join(__dirname, '../renderer/pin.html'))
  }

  pinWindows.add(pinWin)
  pinWin.on('closed', () => {
    pinWindows.delete(pinWin)
  })
}

/**
 * 从剪贴板读取图片并贴图
 */
function pinFromClipboard() {
  console.log('--- Pinning from Clipboard ---')
  const image = clipboard.readImage()
  if (image.isEmpty()) {
    console.log('Clipboard is empty or does not contain an image')
    return
  }

  const size = image.getSize()
  const display = screen.getPrimaryDisplay()
  const x = (display.bounds.width - size.width) / 2
  const y = (display.bounds.height - size.height) / 2

  createPinWindow(image.toDataURL(), {
    width: size.width,
    height: size.height,
    x: Math.max(0, x),
    y: Math.max(0, y)
  })
}


// ─── IPC: 截屏 & 贴图 ───────────────────────────────────

ipcMain.on('screenshot:close', () => {
  closeScreenshot()
})

ipcMain.on('screenshot:copy', (_, dataUrl: string) => {
  const image = nativeImage.createFromDataURL(dataUrl)
  clipboard.writeImage(image)
  closeScreenshot()
})

ipcMain.on('screenshot:save', async (_, dataUrl: string) => {
  closeScreenshot()
  const image = nativeImage.createFromDataURL(dataUrl)
  const result = await dialog.showSaveDialog({
    title: '保存截图',
    defaultPath: `screenshot-${Date.now()}.png`,
    filters: [{ name: 'Images', extensions: ['png'] }]
  })
  if (!result.canceled && result.filePath) {
    await fs.writeFile(result.filePath, image.toPNG())
  }
})

ipcMain.on('screenshot:pin', (_, data: { dataUrl: string, bounds: { x: number, y: number, width: number, height: number } }) => {
  closeScreenshot()
  createPinWindow(data.dataUrl, data.bounds)
})

ipcMain.on('pin:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.close()
})

// ─── 自动更新 ────────────────────────────────────────────

function setupAutoUpdater() {
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: '更新准备就绪',
      message: '新版本已下载，是否立即重启安装？',
      buttons: ['立即重启', '稍后重启']
    })

    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto Updater Error:', err)
  })
}

// ─── 应用生命周期 ────────────────────────────────────────

// 添加一个全局变量标记是否正在退出
;(app as any).isQuitting = false

app.whenReady().then(async () => {
  setupAutoUpdater()

  // 读取系统设置
  const systemSettings = await storeGetValue('systemSettings') as { autoStart?: boolean, closeToTray?: boolean } | undefined
  if (systemSettings) {
    if (systemSettings.closeToTray !== undefined) {
      closeToTray = systemSettings.closeToTray
    }
    if (systemSettings.autoStart !== undefined) {
      app.setLoginItemSettings({
        openAtLogin: systemSettings.autoStart,
        openAsHidden: true
      })
    }
  }

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

  // Tray
  const iconPath = join(__dirname, '../../icons/icon.png')
  // dynamically resize to 16x16 to fix stretched appearance on macOS menu bar
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主面板', click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    { label: '开始截图', click: () => startScreenshot() },
    { label: '截图开发调试', click: () => {
        if (screenshotWindow) screenshotWindow.webContents.openDevTools({ mode: 'detach' })
        else {
          startScreenshot().then(() => {
            screenshotWindow?.webContents.openDevTools({ mode: 'detach' })
          })
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => {
        (app as any).isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setToolTip('OpenFlow Studio')
  tray.setContextMenu(contextMenu)

  // Register shortcuts
  const screenshotShortcut = await storeGetValue('screenshotShortcut') as string || 'F1'
  const pinShortcut = await storeGetValue('pinShortcut') as string || 'F3'

  globalShortcut.register(screenshotShortcut, () => {
    console.log('Screenshot shortcut triggered:', screenshotShortcut)
    startScreenshot()
  })

  globalShortcut.register(pinShortcut, () => {
    console.log('Pin shortcut triggered:', pinShortcut)
    pinFromClipboard()
  })

  console.log(`Shortcuts registered - Screenshot: ${screenshotShortcut}, Pin: ${pinShortcut}`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('shortcut:update', async (_, newShortcut: string | { screenshot: string, togglePanel: string, pinImage: string }) => {
  globalShortcut.unregisterAll()

  if (typeof newShortcut === 'string') {
    const success = globalShortcut.register(newShortcut, () => {
      startScreenshot()
    })
    if (success) {
      await storeSetValue('screenshotShortcut', newShortcut)
    }
    return success
  } else {
    // Handling the new ShortcutSettings object
    let success = true
    if (newShortcut.screenshot) {
      success = globalShortcut.register(newShortcut.screenshot, () => startScreenshot()) && success
      if (success) await storeSetValue('screenshotShortcut', newShortcut.screenshot)
    }
    if (newShortcut.pinImage) {
      success = globalShortcut.register(newShortcut.pinImage, () => pinFromClipboard()) && success
      if (success) await storeSetValue('pinShortcut', newShortcut.pinImage)
    }
    if (newShortcut.togglePanel) {
      success = globalShortcut.register(newShortcut.togglePanel, () => {
        if (mainWindow) {
          if (mainWindow.isVisible() && mainWindow.isFocused()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.focus()
          }
        } else {
          createWindow()
        }
      }) && success
    }
    return success
  }
})

ipcMain.handle('shortcut:check', (_, accelerator: string) => {
  return globalShortcut.isRegistered(accelerator)
})

ipcMain.handle('settings:applySystem', async (_, settings: { autoStart?: boolean, closeToTray?: boolean }) => {
  if (settings.closeToTray !== undefined) {
    closeToTray = settings.closeToTray
  }
  if (settings.autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      openAsHidden: true
    })
  }
  return true
})


// ─── IPC: 数据库 (SQLite) ───────────────────────────────

ipcMain.handle('db:getImportedData', async (_, batchId?: string) => {
  try {
    return await getImportedData(batchId)
  } catch (error) {
    console.error('db:getImportedData Error:', error)
    return []
  }
})

ipcMain.handle('db:insertImportedData', async (_, batchId: string, rowData: any) => {
  try {
    return await insertImportedData(batchId, rowData)
  } catch (error) {
    console.error('db:insertImportedData Error:', error)
    return -1
  }
})

ipcMain.handle('db:updateImportedData', async (_, id: number, rowData: any) => {
  try {
    await updateImportedData(id, rowData)
    return true
  } catch (error) {
    console.error('db:updateImportedData Error:', error)
    return false
  }
})

ipcMain.handle('db:getExcelFiles', async () => {
  try {
    return await getExcelFiles()
  } catch (error) {
    console.error('db:getExcelFiles Error:', error)
    return []
  }
})

ipcMain.handle('db:insertExcelFile', async (_, file: any) => {
  try {
    return await insertExcelFile(file)
  } catch (error) {
    console.error('db:insertExcelFile Error:', error)
    return -1
  }
})

ipcMain.handle('db:deleteExcelFile', async (_, id: number) => {
  try {
    await deleteExcelFile(id)
    return true
  } catch (error) {
    console.error('db:deleteExcelFile Error:', error)
    return false
  }
})

ipcMain.handle('db:clearAllExcelFiles', async () => {
  try {
    await clearAllExcelFiles()
    return true
  } catch (error) {
    console.error('db:clearAllExcelFiles Error:', error)
    return false
  }
})

ipcMain.handle('db:deleteImportedData', async (_, id: number) => {
  try {
    await deleteImportedData(id)
    return true
  } catch (error) {
    console.error('db:deleteImportedData Error:', error)
    return false
  }
})

ipcMain.handle('db:deleteBatch', async (_, batchId: string) => {
  try {
    await deleteBatch(batchId)
    return true
  } catch (error) {
    console.error('db:deleteBatch Error:', error)
    return false
  }
})

ipcMain.handle('db:clearAllImportedData', async () => {
  try {
    await clearAllImportedData()
    return true
  } catch (error) {
    console.error('db:clearAllImportedData Error:', error)
    return false
  }
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

// ─── IPC: Excel 解析 ────────────────────────────────────

ipcMain.handle('dialog:importExcel', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入 Excel 表格',
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] }],
    properties: ['openFile'],
  })

  if (result.canceled || !result.filePaths[0]) return null

  try {
    const filePath = result.filePaths[0]
    const fileName = basename(filePath)
    const ext = extname(filePath)

    // Ensure local backup directory exists
    const userDataPath = app.getPath('userData')
    const backupDir = join(userDataPath, 'imported_excels')
    await fs.ensureDir(backupDir)

    // Create a unique filename to avoid overwrites
    const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`
    const savedPath = join(backupDir, uniqueFilename)

    // Copy the original file to the backup location
    await fs.copyFile(filePath, savedPath)

    // Read the file
    const fileBuffer = await fs.readFile(filePath)
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' })

    // Get first sheet
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Convert to JSON (array of objects)
    const data = xlsx.utils.sheet_to_json(worksheet)

    return { fileName, data, savedPath }
  } catch (error) {
    console.error('Error parsing Excel:', error)
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法解析 Excel 文件: ${message}`)
  }
})

// Auto-cleanup handler for old Excel files (older than 30 days)
ipcMain.handle('fs:cleanupOldExcels', async () => {
  try {
    const userDataPath = app.getPath('userData')
    const backupDir = join(userDataPath, 'imported_excels')
    if (!(await fs.pathExists(backupDir))) return true

    const files = await fs.readdir(backupDir)
    const now = Date.now()
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

    let deletedCount = 0
    for (const file of files) {
      const filePath = join(backupDir, file)
      const stat = await fs.stat(filePath)
      if (now - stat.mtimeMs > THIRTY_DAYS_MS) {
        await fs.remove(filePath)
        deletedCount++
      }
    }
    console.log(`Cleaned up ${deletedCount} old Excel files.`)
    return true
  } catch (error) {
    console.error('Error cleaning up Excel files:', error)
    return false
  }
})

ipcMain.handle('fs:saveImageToLocal', async (_, args: { dataUrl?: string; sourcePath?: string }) => {
  try {
    const userDataPath = app.getPath('userData')
    const imagesDir = join(userDataPath, 'game_dictionary_images')
    await fs.ensureDir(imagesDir)

    let destPath = ''
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}`

    if (args.dataUrl) {
      const base64Data = args.dataUrl.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(base64Data, 'base64')
      destPath = join(imagesDir, `${filename}.png`)
      await fs.writeFile(destPath, buffer)
    } else if (args.sourcePath) {
      const ext = extname(args.sourcePath) || '.png'
      destPath = join(imagesDir, `${filename}${ext}`)
      await fs.copyFile(args.sourcePath, destPath)
    } else {
      throw new Error('No dataUrl or sourcePath provided')
    }

    return destPath
  } catch (error) {
    console.error('fs:saveImageToLocal error:', error)
    throw error
  }
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
  let department = ''
  let email = ''
  let sizes: string[] = []

  const norm = (s: string) => (s || '').replace(/[xX×-]/g, '*')

  if (Array.isArray(rawData)) {
    if (rawData.length > 0) {
      const firstItem = rawData[0]
      producerName = firstItem['制作人'] || firstItem['producerName'] || firstItem['producer'] || ''
      department = firstItem['部门'] || firstItem['department'] || ''
      email = firstItem['邮箱'] || firstItem['email'] || ''
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
    department = rawData['部门'] || rawData['department'] || ''
    email = rawData['邮箱'] || rawData['email'] || ''
  }

  return { projectName, producerName, department, email, sizes, projects, rawData, fileName }
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

// ─── IPC: 媒体批量处理 ──────────────────────────────────
ipcMain.handle('fs:processFormat', async (_, { files, config }) => {
  const results = []
  const dirCache = new Map<string, Set<string>>()

  const getDirEntries = async (dir: string) => {
    if (!dirCache.has(dir)) {
      try {
        const names = await fs.readdir(dir)
        dirCache.set(dir, new Set(names))
      } catch {
        dirCache.set(dir, new Set())
      }
    }
    return dirCache.get(dir)!
  }

  for (const file of files) {
    try {
      if (!file.id) {
         throw new Error(`缺少唯一标识: file.id`);
      }

      if (!file.filePath || typeof file.filePath !== 'string' || !file.filePath.trim()) {
        throw new Error(`文件路径不存在或无效: ${file.filePath}`)
      }

      if (!await fs.pathExists(file.filePath)) {
         throw new Error(`本地文件不存在，请检查路径: ${file.filePath}`)
      }

      const dir = dirname(file.filePath)
      const originalName = basename(file.fileName, file.ext)

      // Determine output directory
      let outDir = ''
      if (config.customExportPath) {
        outDir = config.customExportPath
      } else {
        let subFolderName = 'openflow处理'
        if (config.useDynamicFolderName && config.dynamicFolderName) {
          subFolderName = `openflow(${config.dynamicFolderName})处理`
        }
        outDir = join(dir, subFolderName)
      }

      await fs.ensureDir(outDir)

      const isImage = IMAGE_EXTS.has(file.ext.toLowerCase())
      const isVideo = VIDEO_EXTS.has(file.ext.toLowerCase())

      // targetExt 可能是原后缀，也可能被动作流修改
      let targetExt = file.ext.toLowerCase()
      if (config.format) {
         targetExt = config.format.startsWith('.') ? config.format : `.${config.format}`
      }

      const existingFiles = await getDirEntries(outDir)
      let outFileName = `${originalName}${targetExt}`

      // 冲突处理
      let counter = 1
      while (existingFiles.has(outFileName)) {
        outFileName = `${originalName}_${counter}${targetExt}`
        counter++
      }
      let outFilePath = join(outDir, outFileName)

      if (isImage) {
        let pipeline = sharp(file.filePath)

        // 1. Resize
        if (config.resize && config.resize.enabled) {
          if (config.resize.mode === 'percentage') {
             const meta = await pipeline.metadata()
             const p = config.resize.percentage / 100
             pipeline = pipeline.resize(Math.round((meta.width || 0) * p), Math.round((meta.height || 0) * p), { fit: 'inside' })
          } else if (config.resize.mode === 'resolution') {
             pipeline = pipeline.resize(config.resize.width, config.resize.height, { fit: 'inside' })
          }
        }

        // 2. Format & Quality
        const formatName = targetExt.replace('.', '')
        if (formatName === 'jpg' || formatName === 'jpeg') {
          pipeline = pipeline.jpeg({ quality: config.quality || 80 })
        } else if (formatName === 'png') {
          pipeline = pipeline.png({ quality: config.quality || 80 })
        } else if (formatName === 'webp') {
          pipeline = pipeline.webp({ quality: config.quality || 80 })
        }

        await pipeline.toFile(outFilePath)
        existingFiles.add(outFileName)
        results.push({ id: file.id, success: true, targetPath: outFilePath })
      } else if (isVideo) {
        await new Promise((resolve, reject) => {
          let cmd = ffmpeg(file.filePath)

          if (config.resize && config.resize.enabled) {
            if (config.resize.mode === 'percentage') {
               cmd = cmd.size(`${config.resize.percentage}%`)
            } else if (config.resize.mode === 'resolution') {
               cmd = cmd.size(`${config.resize.width}x${config.resize.height}`)
            }
          }

          if (config.quality) {
            // ffmpeg video quality can be tricky. Using CRF (Constant Rate Factor) for typical formats
            // mapping 1-100 to crf 51-0 (approximate). Lower CRF is better quality.
            const crf = Math.floor(51 - (config.quality / 100) * 51)
            cmd = cmd.outputOptions([`-crf ${crf}`])
          }

          cmd.on('end', () => {
            existingFiles.add(outFileName)
            resolve(true)
          })
             .on('error', (err) => reject(err))
             .save(outFilePath)
        })
        results.push({ id: file.id, success: true, targetPath: outFilePath })
      } else {
        throw new Error('不支持的媒体格式')
      }
    } catch (err) {
      results.push({
        id: file.id,
        success: false,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return { success: true, results }
})

// ─── IPC: 文件系统 ───────────────────────────────────────

// 记录最近一次整理操作的文件移动路径 (新路径 -> 旧路径)
let lastOrganizedFiles: Record<string, string> = {}

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
  try {
    await Promise.all(
      list.map(async (project) => {
        const projectRoot = join(rootPath, project.projectName)
        await fs.ensureDir(projectRoot)

        const dirPromises: Promise<void>[] = []
        const sizes = project.sizes || []

        for (const size of sizes) {
          const folderName = size.replace(/\*/g, 'x')
          const sizeDir = join(projectRoot, folderName)
          dirPromises.push(fs.ensureDir(join(sizeDir, '_Assets')))
        }

        for (const name of FIXED_FOLDERS) {
          dirPromises.push(fs.ensureDir(join(projectRoot, name)))
        }

        await Promise.all(dirPromises)
      })
    )
    return { success: true, destPath: rootPath }
  } catch (error) {
    return { success: false, destPath: '', error: String(error) }
  }
})

/** 仅识别纯数字尺寸的一级子目录，如 720x1280、1080x1920 */
/** 各种特殊固定文件夹名称 */
const FIXED_FOLDERS = ['截屏素材', '录屏素材', '奇觅生成', '模糊处理', '即梦生成']
/** 仅识别纯数字尺寸的一级子目录，如 720x1280、1080x1920 */
const SIZE_FOLDER_REGEX = /^\d+[xX-]\d+$/
/** 这些文件夹为原始物料目录，不参与尺寸识别，必须忽略 */
const SKIP_DIRS_READ_SIZE = new Set([...FIXED_FOLDERS, '_Assets'])

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
    const statPromises = names.map(async (name) => {
      if (SKIP_DIRS_READ_SIZE.has(name)) return
      if (!SIZE_FOLDER_REGEX.test(name)) return
      const full = join(dir, name)
      try {
        const stat = await fs.stat(full)
        if (stat.isDirectory()) {
          sizeSet.add(name.replace(/[xX-]/g, '*'))
        }
      } catch {
        // ignore
      }
    })
    await Promise.all(statPromises)
  }
  return [...sizeSet]
})

/** 校验时必须跳过的目录：仅对「纯数字尺寸」文件夹内的媒体做校验，不读取物料目录 */
const SKIP_DIRS_VALIDATION = new Set([...FIXED_FOLDERS, '_Assets'])

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
ipcMain.handle('fs:executeRename', async (_, { files, templates, projectName, producer, isSpecialEnabled, isManualEnabled }) => {
  const results: RenameResult[] = []
  const dirCache = new Map<string, Set<string>>()

  const getDirEntries = async (dir: string) => {
    if (!dirCache.has(dir)) {
      try {
        const names = await fs.readdir(dir)
        dirCache.set(dir, new Set(names))
      } catch {
        dirCache.set(dir, new Set())
      }
    }
    return dirCache.get(dir)!
  }

  // Date in YYYYMMDD format
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}${month}${day}`

  // 记录每个文件夹和媒体类型独立的序号
  const sequenceCounters: Record<string, number> = {}

  // 1. 先收集所有项目根目录（基于 ValidationResult 中的文件路径）
  const projectRoots = new Set<string>()
  for (const file of files as ValidationResult[]) {
    if (!file.filePath || file.status === 'missing') continue
    // 文件路径通常是 ProjectRoot / SizeFolder / file.ext
    // 所以 dirname(dirname(filePath)) 即为 ProjectRoot
    projectRoots.add(dirname(dirname(file.filePath)))
  }

  // 2. 静默处理 5 个特殊固定文件夹
  // 规则：[父文件夹名称(即游戏名)][当前固定文件夹名]-[制作人缩写]-([序号]).[扩展名]
  const producerAbbr = producer
    ? pinyin(producer, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toUpperCase()
    : ''

  for (const root of projectRoots) {
    const gameName = basename(root)
    for (const fixedFolderName of FIXED_FOLDERS) {
      const fixedFolderPath = join(root, fixedFolderName)
      try {
        const stat = await fs.stat(fixedFolderPath)
        if (stat.isDirectory()) {
          // 获取文件夹内容，并利用现有的 dirCache 优化查询
          const existingFiles = await getDirEntries(fixedFolderPath)
          const names = Array.from(existingFiles)
          const fixedSequenceCounters: Record<string, number> = {}

          for (const name of names) {
            const fullPath = join(fixedFolderPath, name)
            const fileStat = await fs.stat(fullPath)
            if (fileStat.isFile()) {
              const ext = extname(name).toLowerCase()
              const isImage = IMAGE_EXTS.has(ext)
              const isVideo = VIDEO_EXTS.has(ext)

              if (!isImage && !isVideo) continue // 静默跳过非图片/视频

              const mediaType = isImage ? 'image' : 'video'
              const seqKey = `${fixedFolderPath}_${mediaType}`
              if (!fixedSequenceCounters[seqKey]) {
                fixedSequenceCounters[seqKey] = 1
              }
              const currentSequence = fixedSequenceCounters[seqKey]

              // 小火车截屏素材-MXW-(1).jpg
              const newBaseName = `${gameName}${fixedFolderName}-${producerAbbr}-(${currentSequence})`
              let newFileName = `${newBaseName}${ext}`

              // 冲突处理：追加数字后缀（特殊文件夹的异常/冲突也默默处理，不报错）
              let collisionCounter = 1
              while (existingFiles.has(newFileName) && join(fixedFolderPath, newFileName) !== fullPath) {
                newFileName = `${newBaseName}_${collisionCounter}${ext}`
                collisionCounter++
              }

              const newFilePath = join(fixedFolderPath, newFileName)

              if (fullPath !== newFilePath) {
                try {
                  await fs.rename(fullPath, newFilePath)
                  existingFiles.delete(name)
                  existingFiles.add(newFileName)
                } catch (e) {
                  // 即使出错也默默跳过
                }
              }

              fixedSequenceCounters[seqKey]++
            }
          }
        }
      } catch (e) {
        // 固定文件夹不存在或读取失败，默默跳过
      }
    }
  }

  // 3. 处理正常的分辨率文件夹
  for (const file of files as ValidationResult[]) {
    if (!file.filePath || file.status === 'missing') continue

    const dir = dirname(file.filePath)
    // 动态读取上一级目录作为游戏名称
    const gameName = basename(dirname(dir))

    // 覆盖原本逻辑中的 projectName
    const currentProjectName = gameName || projectName || ''
    const isSpecial = isSpecialEnabled || currentProjectName.includes('创意比特') || currentProjectName.includes('（创意比特）') || currentProjectName.includes('(创意比特)')
    const cleanProjectName = currentProjectName.replace(/\(创意比特\)|（创意比特）|创意比特/g, '')

    const originalExt = file.ext || extname(file.filePath)
    const originalBaseName = file.fileName
    const sizeStr = `${file.actualWidth}x${file.actualHeight}`

    const isImage = IMAGE_EXTS.has(originalExt.toLowerCase())
    const isVideo = VIDEO_EXTS.has(originalExt.toLowerCase())

    let targetTemplate = []
    let finalExt = originalExt

    if (isVideo) {
      if (isManualEnabled) targetTemplate = templates.videoManual
      else targetTemplate = isSpecial ? templates.videoSpecial : templates.videoRegular
      finalExt = '.mp4'
    } else if (isImage) {
      if (isManualEnabled) targetTemplate = templates.imageManual
      else targetTemplate = isSpecial ? templates.imageSpecial : templates.imageRegular
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

    const existingFiles = await getDirEntries(dir)
    let newFileName = `${newBaseName}${finalExt}`

    // 冲突处理：追加数字后缀
    let collisionCounter = 1
    while (existingFiles.has(newFileName) && join(dir, newFileName) !== file.filePath) {
      newFileName = `${newBaseName}_${collisionCounter}${finalExt}`
      collisionCounter++
    }
    const newFilePath = join(dir, newFileName)

    try {
      await fs.rename(file.filePath, newFilePath)
      existingFiles.delete(basename(file.filePath))
      existingFiles.add(newFileName)
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
 * fs:renameAiBatch
 * 为 AI 识图结果批量重命名文件
 */
ipcMain.handle('fs:renameAiBatch', async (_, { filePath, templates, producerName, vars }) => {
  const dirCache = new Map<string, Set<string>>()
  const getDirEntries = async (dir: string) => {
    if (!dirCache.has(dir)) {
      try {
        const names = await fs.readdir(dir)
        dirCache.set(dir, new Set(names))
      } catch {
        dirCache.set(dir, new Set())
      }
    }
    return dirCache.get(dir)!
  }

  const dir = dirname(filePath)
  const originalExt = extname(filePath)

  // Producer conversion
  const producerAbbr = producerName
    ? pinyin(producerName, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toUpperCase()
    : ''

  const finalVars = { ...vars, Producer: producerAbbr }

  // Filter out any potential illegal path characters in vars to prevent fs errors
  // AI returns can sometimes contain random symbols
  for (const key of Object.keys(finalVars)) {
    if (typeof finalVars[key] === 'string') {
      finalVars[key] = finalVars[key].replace(/[\\/:*?"<>|]/g, '')
    }
  }

  const newBaseName = applyNewTemplate(templates, finalVars)
  const existingFiles = await getDirEntries(dir)
  let newFileName = `${newBaseName}${originalExt}`

  let collisionCounter = 1
  while (existingFiles.has(newFileName) && join(dir, newFileName) !== filePath) {
    newFileName = `${newBaseName}_${collisionCounter}${originalExt}`
    collisionCounter++
  }
  const newFilePath = join(dir, newFileName)

  try {
    await fs.rename(filePath, newFilePath)
    existingFiles.delete(basename(filePath))
    existingFiles.add(newFileName)
    return { success: true, newFileName }
  } catch (err) {
    return { success: false, error: String(err) }
  }
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
    if (parts.length >= 2) {
      let sequence = ''
      let date = ''
      let rawRes = ''

      const isRes = (p: string) => /^\d+[xX*]\d+$/.test(p)

      if (isRes(parts[parts.length - 1])) {
        // 格式: 游戏名-分辨率
        rawRes = parts.pop() as string
      } else if (parts.length >= 3 && isRes(parts[parts.length - 2])) {
        // 格式: 游戏名-分辨率-时间
        date = parts.pop() as string
        rawRes = parts.pop() as string
      } else if (parts.length >= 4 && isRes(parts[parts.length - 3])) {
        // 格式: 游戏名-分辨率-时间-序号
        sequence = parts.pop() as string
        date = parts.pop() as string
        rawRes = parts.pop() as string
      } else if (parts.length >= 3) {
        // 退化容错处理
        if (parts.length >= 4) {
          sequence = parts.pop() as string
          date = parts.pop() as string
          rawRes = parts.pop() as string
        } else {
          date = parts.pop() as string
          rawRes = parts.pop() as string
        }
      } else {
        continue
      }

      const gameName = parts.join('-')

      if (rawRes && gameName) {
        // 转换分辨率 (如 1080x607 -> 1080-607)
        const parsedRes = rawRes.replace(/[xX*]/g, '-')
        results.push({
          id: fullPath,
          fileName: name,
          filePath: fullPath,
          gameName,
          resolution: parsedRes,
          date,
          sequence,
          ext,
          size: stat.size,
          selected: true
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
ipcMain.handle('fs:executeOrganize', async (_, { files, destDir, isQimiEnabled }) => {
  if (!files || files.length === 0) return { success: false, error: '没有需要移动的文件' }

  // 清空上一次的记录，确保撤销只针对当前这一次转移
  lastOrganizedFiles = {}

  const results = []
  const dirCache = new Map<string, Set<string>>()

  const getDirEntries = async (dir: string) => {
    if (!dirCache.has(dir)) {
      try {
        const names = await fs.readdir(dir)
        dirCache.set(dir, new Set(names))
      } catch {
        dirCache.set(dir, new Set())
      }
    }
    return dirCache.get(dir)!
  }
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

    // If it is an mp4 file and qimi generation is enabled, force the target folder to be '奇觅生成'
    let qimiCreated = false;
    if (isQimiEnabled && file.ext && file.ext.toLowerCase() === '.mp4') {
      finalResolution = '奇觅生成';
    } else {
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
    }

    const targetFolder = join(gameFolder, finalResolution)

    // 如果目标文件夹不存在，记录并创建
    if (!(await fs.pathExists(targetFolder))) {
      if (finalResolution === '奇觅生成') {
        missingFolders.add(`已为您创建【奇觅生成】文件夹。`)
      } else {
        missingFolders.add(`【${file.gameName}】缺少文件夹，已为您创建【${finalResolution}】文件夹。`)
      }
      await fs.ensureDir(targetFolder)
    }

    const existingFiles = await getDirEntries(targetFolder)
    let targetFileName = file.fileName

    // 冲突处理：如果同名，自动加今日时间：yyyymmdd
    // 如果加了时间还冲突，就再加序号
    if (existingFiles.has(targetFileName)) {
      const baseName = basename(file.fileName, file.ext)
      targetFileName = `${baseName}-${today}${file.ext}`

      let counter = 1
      while (existingFiles.has(targetFileName)) {
        targetFileName = `${baseName}-${today}-${counter}${file.ext}`
        counter++
      }
    }
    const targetFilePath = join(targetFolder, targetFileName)

    try {
      await fs.move(file.filePath, targetFilePath)
      existingFiles.add(targetFileName)
      results.push({ id: file.id, success: true, targetPath: targetFilePath })
      lastOrganizedFiles[targetFilePath] = file.filePath
    } catch (err) {
      results.push({ id: file.id, success: false, error: String(err) })
    }
  }

  return { success: true, results, missingFolders: Array.from(missingFolders) }
})

/**
 * fs:undoOrganize
 * 撤销上一次的素材整理移动
 */
ipcMain.handle('fs:undoOrganize', async () => {
  const keys = Object.keys(lastOrganizedFiles)
  if (keys.length === 0) {
    return { success: false, error: '没有可以撤销的转移记录' }
  }

  let successCount = 0
  let failCount = 0

  for (const currentPath of keys) {
    const originalPath = lastOrganizedFiles[currentPath]
    try {
      if (await fs.pathExists(currentPath)) {
        await fs.move(currentPath, originalPath, { overwrite: true })
        successCount++
      } else {
        failCount++
      }
    } catch (err) {
      console.error(`撤销转移失败: ${currentPath} -> ${originalPath}`, err)
      failCount++
    }
  }

  // 清空记录
  lastOrganizedFiles = {}

  return {
    success: true,
    message: `撤销完成。成功恢复 ${successCount} 个文件，失败/未找到 ${failCount} 个。`
  }
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

// --- Game Mappings DB Handlers ---
ipcMain.handle('db:getGameMappings', async () => {
  try {
    return await getGameMappings()
  } catch (error) {
    console.error('db:getGameMappings Error:', error)
    throw error
  }
})

ipcMain.handle('db:insertGameMapping', async (_, mapping: any) => {
  try {
    return await insertGameMapping(mapping)
  } catch (error) {
    console.error('db:insertGameMapping Error:', error)
    throw error
  }
})

ipcMain.handle('db:updateGameMapping', async (_, id: number, mapping: any) => {
  try {
    await updateGameMapping(id, mapping)
    return true
  } catch (error) {
    console.error('db:updateGameMapping Error:', error)
    throw error
  }
})

ipcMain.handle('db:deleteGameMapping', async (_, id: number) => {
  try {
    await deleteGameMapping(id)
    return true
  } catch (error) {
    console.error('db:deleteGameMapping Error:', error)
    throw error
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
