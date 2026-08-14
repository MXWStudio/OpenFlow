/**
 * Electron 主进程入口
 * 负责：窗口管理、所有 IPC 通道处理、底层 Node.js 能力
 */

import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, globalShortcut, Tray, Menu, nativeImage, screen } from 'electron'
import { join, extname, basename, dirname } from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs-extra'
import sizeOf from 'image-size'
import ffmpeg from 'fluent-ffmpeg'
import {
  getMissingRequirements,
  normalizeResolution,
  parseRequiredQuantity,
  parseRequirementJson,
  sanitizePathSegment,
  type RequirementDetail,
} from './requirements'
import { selectQimiFolderName } from './organize'
import { getResolutionFolderContext, SIZE_FOLDER_REGEX } from './renameContext'
import { executeRenameRequest, previewRenameRequest, type RenameRequest } from './rename'
import { JsonConfigStore } from './configStore'
import { DesktopUpdateManager } from './desktopUpdateManager'
import { ExtensionUpdateManager } from './extensionUpdateManager'

// ─── 初始化 ────────────────────────────────────────────
// 禁用硬件加速，解决部分环境下的黑屏问题
app.disableHardwareAcceleration()

let tray: Tray | null = null

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join('\n')
  }
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function showFatalError(title: string, error: unknown): void {
  const detail = normalizeError(error)
  console.error(title, detail)
  dialog.showErrorBox(title, detail || '未知错误')
}

process.on('uncaughtException', (error) => {
  showFatalError('OpenFlow Studio 启动失败', error)
})

process.on('unhandledRejection', (reason) => {
  showFatalError('OpenFlow Studio 异步任务失败', reason)
})

function requireOptional<T>(moduleName: string): T | null {
  try {
    return require(moduleName) as T
  } catch (error) {
    console.warn(`Optional dependency unavailable: ${moduleName}`, normalizeError(error))
    return null
  }
}

function requireRuntimeDependency<T>(moduleName: string): T {
  const dependency = requireOptional<T>(moduleName)
  if (!dependency) {
    throw new Error(`缺少运行依赖 ${moduleName}。请重新安装当前系统架构对应的 OpenFlow Studio 安装包。`)
  }
  return dependency
}

function unpackedPath(binaryPath: string): string {
  return binaryPath.includes('app.asar')
    ? binaryPath.replace('app.asar', 'app.asar.unpacked')
    : binaryPath
}

type SharpModule = typeof import('sharp')

let sharpModule: SharpModule | null = null

function getSharp(): SharpModule {
  if (!sharpModule) {
    sharpModule = requireRuntimeDependency<SharpModule>('sharp')
  }
  return sharpModule
}

let ffmpegPathsConfigured = false

function configureFfmpegPaths(): void {
  if (ffmpegPathsConfigured) return
  ffmpegPathsConfigured = true

  const installer = requireOptional<{ path?: string }>('@ffmpeg-installer/ffmpeg')
  const staticPath = requireOptional<string>('ffmpeg-static')
  const ffmpegPath = installer?.path || staticPath
  if (typeof ffmpegPath === 'string' && ffmpegPath) {
    ffmpeg.setFfmpegPath(unpackedPath(ffmpegPath))
  }

  const ffprobeStatic = requireOptional<{ path?: string }>('ffprobe-static')
  if (ffprobeStatic?.path) {
    ffmpeg.setFfprobePath(unpackedPath(ffprobeStatic.path))
  }
}

// ─── 轻量级 JSON 配置存储 ────────────────────────────────
// 替代 electron-store（v10 为纯 ESM，与 Electron CJS 主进程不兼容）
// 数据持久化到用户数据目录的 config.json

function getConfigPath(): string {
  return join(app.getPath('userData'), 'openflow-config.json')
}

async function storeRead(): Promise<Record<string, unknown>> {
  return getConfigStore().getAll()
}

let configStore: JsonConfigStore | null = null

function getConfigStore(): JsonConfigStore {
  if (!configStore) configStore = new JsonConfigStore(getConfigPath())
  return configStore
}

async function storeGetValue(key: string): Promise<unknown> {
  return getConfigStore().get(key)
}

async function storeSetValue(key: string, value: unknown): Promise<void> {
  return getConfigStore().set(key, value)
}

async function storeDeleteKey(key: string): Promise<void> {
  return getConfigStore().delete(key)
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
  requiredQuantity?: number
  actualQuantity?: number
  missingCount?: number
  missingKind?: 'empty_folder'
  /** 底层错误或说明，供前端展示 */
  error?: string
  workspaceProjectName?: string
}

// ─── 支持的媒体文件扩展名 ────────────────────────────────
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'])

// ─── 工具函数 ───────────────────────────────────────────

/** 将 ffprobe 封装为 Promise */
function getVideoInfo(
  filePath: string
): Promise<{ width: number; height: number; duration: number }> {
  configureFfmpegPaths()
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

// ─── 窗口创建 ───────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let extensionUpdateManager: ExtensionUpdateManager | null = null
let desktopUpdateManager: DesktopUpdateManager | null = null

let closeToTray = true // 默认为 true

const RENDERER_BOOT_CHECK_DELAY_MS = 1500
const MAX_RENDERER_RECOVERY_ATTEMPTS = 2

function isUsableWindow(window: BrowserWindow): boolean {
  return !window.isDestroyed() && !window.webContents.isDestroyed()
}

async function hasMountedRenderer(window: BrowserWindow): Promise<boolean> {
  if (!isUsableWindow(window)) return false
  try {
    return await window.webContents.executeJavaScript(
      "Boolean(document.getElementById('root')?.childElementCount)",
      true,
    ) as boolean
  } catch (error) {
    console.error('Renderer health check failed:', normalizeError(error))
    return false
  }
}

async function showRendererLoadFailure(window: BrowserWindow): Promise<void> {
  if (!isUsableWindow(window)) return
  try {
    await window.webContents.executeJavaScript(`
      (() => {
        const root = document.getElementById('root') || document.body;
        root.innerHTML = '';
        Object.assign(root.style, {
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          color: '#e2e8f0',
          background: '#0f172a',
          fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
          textAlign: 'center'
        });
        root.textContent = '界面加载失败，请关闭并重新启动 OpenFlow Studio。';
      })()
    `, true)
  } catch (error) {
    console.error('Failed to render startup fallback:', normalizeError(error))
  }
  if (!window.isVisible()) window.show()
}

function createWindow(): void {
  const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize
  const windowWidth = Math.min(1440, Math.max(1080, Math.floor(workWidth * 0.92)))
  const windowHeight = Math.min(900, Math.max(640, Math.floor(workHeight * 0.92)))

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 1080,
    minHeight: 640,
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

  const window = mainWindow
  let rendererRecoveryAttempts = 0
  let rendererHealthTimer: NodeJS.Timeout | null = null

  const clearRendererHealthTimer = () => {
    if (rendererHealthTimer) clearTimeout(rendererHealthTimer)
    rendererHealthTimer = null
  }

  const handleRendererReady = (event: Electron.IpcMainEvent) => {
    if (event.sender !== window.webContents || !isUsableWindow(window)) return
    clearRendererHealthTimer()
    rendererRecoveryAttempts = 0
    if (!window.isVisible()) window.show()
  }

  const verifyRendererMounted = () => {
    clearRendererHealthTimer()
    rendererHealthTimer = setTimeout(async () => {
      rendererHealthTimer = null
      if (!isUsableWindow(window)) return

      if (await hasMountedRenderer(window)) {
        rendererRecoveryAttempts = 0
        if (!window.isVisible()) window.show()
        return
      }

      if (rendererRecoveryAttempts < MAX_RENDERER_RECOVERY_ATTEMPTS) {
        rendererRecoveryAttempts += 1
        console.warn(
          `Renderer root is empty; retrying startup (${rendererRecoveryAttempts}/${MAX_RENDERER_RECOVERY_ATTEMPTS}).`,
        )
        window.webContents.reloadIgnoringCache()
        return
      }

      console.error('Renderer failed to mount after automatic startup retries.')
      await showRendererLoadFailure(window)
    }, RENDERER_BOOT_CHECK_DELAY_MS)
  }

  window.webContents.on('did-finish-load', verifyRendererMounted)
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return // -3 = ERR_ABORTED，由正常跳转或重载触发
    console.error('Renderer load failed:', { errorCode, errorDescription, validatedURL })
    verifyRendererMounted()
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process exited:', details)
  })
  ipcMain.on('app:renderer-ready', handleRendererReady)

  window.on('close', (e) => {
    if (closeToTray && !(app as any).isQuitting) {
      e.preventDefault()
      window.hide()
    }
  })

  window.on('closed', () => {
    clearRendererHealthTimer()
    ipcMain.removeListener('app:renderer-ready', handleRendererReady)
    if (mainWindow === window) mainWindow = null
  })

  // 开发模式：加载 Vite dev server；生产模式：加载本地 HTML
  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']).catch((error) => {
      console.error('Unable to load renderer URL:', normalizeError(error))
      verifyRendererMounted()
    })
    window.webContents.openDevTools()
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html')).catch((error) => {
      console.error('Unable to load renderer file:', normalizeError(error))
      verifyRendererMounted()
    })
  }

  // 在系统默认浏览器中打开外部链接
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function toggleMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide()
    } else {
      restoreMainWindow()
    }
  } else {
    createWindow()
  }
}

function restoreMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()

  if (process.platform === 'darwin') {
    app.focus({ steal: true })
  }

  mainWindow.focus()
}

async function getTogglePanelShortcut(): Promise<string> {
  const nestedShortcut = await storeGetValue('shortcutSettings.togglePanel')
  if (typeof nestedShortcut === 'string' && nestedShortcut.trim()) {
    return nestedShortcut
  }

  const shortcutSettings = await storeGetValue('shortcutSettings') as { togglePanel?: unknown } | undefined
  if (shortcutSettings && typeof shortcutSettings.togglePanel === 'string' && shortcutSettings.togglePanel.trim()) {
    return shortcutSettings.togglePanel
  }

  return 'CommandOrControl+Shift+Space'
}

// ─── 应用生命周期 ────────────────────────────────────────

// 添加一个全局变量标记是否正在退出
;(app as any).isQuitting = false

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

app.on('second-instance', () => {
  restoreMainWindow()
})

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return

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

  const extensionSourceRoot = app.isPackaged
    ? join(process.resourcesPath, 'chrome-extension')
    : join(app.getAppPath(), '.openflow-build', 'chrome-extension')
  const extensionTargetRoot = join(app.getPath('userData'), 'chrome-extension')
  extensionUpdateManager = new ExtensionUpdateManager({
    sourceRoot: extensionSourceRoot,
    targetRoot: extensionTargetRoot,
    statePath: join(app.getPath('userData'), 'chrome-extension-update-state.json'),
    onStateChange: () => desktopUpdateManager?.notifyExtensionStateChanged(),
  })
  await extensionUpdateManager.start()

  createWindow()

  desktopUpdateManager = new DesktopUpdateManager({
    getWindow: () => mainWindow,
    getExtensionState: () => extensionUpdateManager?.getState() ?? {
      status: 'error',
      bundledVersion: '',
      installedVersion: '',
      extensionPath: extensionTargetRoot,
      message: '扩展更新服务未启动',
    },
    extensionPath: extensionTargetRoot,
  })
  await desktopUpdateManager.start()
  desktopUpdateManager.notifyExtensionStateChanged()

  // Tray
  const iconPath = join(__dirname, '../../icons/icon.png')
  // dynamically resize to 16x16 to fix stretched appearance on macOS menu bar
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主面板', click: () => {
        restoreMainWindow()
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
  tray.on('click', restoreMainWindow)
  tray.on('double-click', restoreMainWindow)

  const togglePanelShortcut = await getTogglePanelShortcut()
  const registered = globalShortcut.register(togglePanelShortcut, toggleMainWindow)
  console.log(`Shortcut registered - Toggle Panel: ${togglePanelShortcut} (${registered ? 'ok' : 'failed'})`)

  app.on('activate', () => {
    restoreMainWindow()
  })
}).catch((error) => {
  showFatalError('OpenFlow Studio 启动失败', error)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  desktopUpdateManager?.stop()
  void extensionUpdateManager?.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('shortcut:update', async (_, newShortcut: string | { togglePanel?: string }) => {
  globalShortcut.unregisterAll()

  const accelerator = typeof newShortcut === 'string' ? newShortcut : newShortcut.togglePanel
  if (!accelerator) {
    return true
  }

  const success = globalShortcut.register(accelerator, toggleMainWindow)
  if (success) {
    await storeSetValue('shortcutSettings.togglePanel', accelerator)
  }
  return success
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
  requirements?: RequirementDetail[]
}

/**
 * dialog:openJson
 * 弹出系统文件选择框，读取并规范化新旧需求 JSON。
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
  return parseRequirementJson(rawData, fileName)
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
        const sharp = getSharp()
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
        configureFfmpegPaths()
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
            // ffmpeg video quality can be tricky. Using CRF (Constant Rate Factor) for typical formats.
            // Convert 1-100 to crf 51-0 (approximate). Lower CRF is better quality.
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
    const createdPaths = await Promise.all(
      list.map(async (project) => {
        const projectRoot = join(rootPath, sanitizePathSegment(project.projectName))
        await fs.ensureDir(projectRoot)

        const dirPromises: Promise<void>[] = []
        const sizes = project.sizes || []

        for (const size of sizes) {
          const folderName = size.replace(/\*/g, 'x')
          const sizeDir = join(projectRoot, folderName)
          dirPromises.push(fs.ensureDir(join(sizeDir, '_Assets')))
        }

        for (const name of FIXED_FOLDERS) {
          dirPromises.push(fs.ensureDir(join(projectRoot, `${project.projectName}-${name}`)))
        }

        await Promise.all(dirPromises)
        return projectRoot
      })
    )
    return { success: true, destPath: rootPath, createdPaths }
  } catch (error) {
    return { success: false, destPath: '', error: String(error) }
  }
})

/** 各种特殊固定文件夹名称 */
const FIXED_FOLDERS = ['截屏素材', '录屏素材', '奇觅生成', '模糊处理', '即梦生成']
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
      if (SKIP_DIRS_READ_SIZE.has(name) || FIXED_FOLDERS.some(f => name.endsWith(`-${f}`))) return
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
      const isFixedOrAssets = SKIP_DIRS_VALIDATION.has(name) || FIXED_FOLDERS.some(f => name.endsWith(`-${f}`))
      if (isRoot) {
        if (isFixedOrAssets || !SIZE_FOLDER_REGEX.test(name)) continue
        await collectMediaFiles(fullPath, fileList, false)
      } else {
        if (isFixedOrAssets) continue
        await collectMediaFiles(fullPath, fileList, false)
      }
      continue
    }

    if (!stat.isFile()) continue

    const ext = extname(name).toLowerCase()
    if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue

    const folderName = getResolutionFolderContext(fullPath)?.resolutionFolderName || basename(dirPath)

    fileList.push({
      filePath: fullPath,
      fileName: basename(name, ext),
      folderName,
      ext,
      size: stat.size,
    })
  }
}

function normalizeValidationTargets(targetSizes: unknown): RequirementDetail[] {
  const targets = Array.isArray(targetSizes) ? targetSizes : []
  return targets.flatMap((target) => {
    if (typeof target === 'string') {
      const resolution = normalizeResolution(target)
      return resolution ? [{ resolution, requiredQuantity: 1 }] : []
    }

    if (!target || typeof target !== 'object' || Array.isArray(target)) return []
    const record = target as Record<string, unknown>
    const resolution = normalizeResolution(record.resolution ?? record.size ?? record.targetSize)
    if (!resolution) return []
    return [{
      resolution,
      ...(parseRequiredQuantity(record.requiredQuantity ?? record.quantity ?? record.count) != null
        ? { requiredQuantity: parseRequiredQuantity(record.requiredQuantity ?? record.quantity ?? record.count) }
        : {}),
      ...(typeof record.positionType === 'string' ? { positionType: record.positionType } : {}),
      ...(typeof record.sizeLimit === 'string' ? { sizeLimit: record.sizeLimit } : {}),
    }]
  })
}

function getRequiredQuantityTotal(requirements: RequirementDetail[]) {
  return requirements.reduce((sum, requirement) => {
    return sum + Math.max(1, requirement.requiredQuantity ?? 1)
  }, 0)
}

/**
 * fs:startValidation
 * 递归扫描文件夹内媒体文件，读取真实宽高，与目标尺寸对比并打标
 */
ipcMain.handle('fs:startValidation', async (_, { folderPath, targetSizes }) => {
  const results: ValidationResult[] = []

  const targetRequirements = normalizeValidationTargets(targetSizes)
  const targetSizeSet = new Set<string>(targetRequirements.map((item) => item.resolution))
  const validCountBySize = new Map<string, number>()

  const fileList: { filePath: string; fileName: string; folderName: string; ext: string; size: number }[] = []
  await collectMediaFiles(folderPath, fileList, true)

  if (fileList.length === 0) {
    const requiredTotal = getRequiredQuantityTotal(targetRequirements) || 1
    results.push({
      fileName: '[缺失] 文件',
      filePath: '',
      folderName: '-',
      ext: '',
      fileSize: 0,
      actualWidth: 0,
      actualHeight: 0,
      status: 'missing',
      targetSize: '缺失文件',
      requiredQuantity: requiredTotal,
      actualQuantity: 0,
      missingCount: requiredTotal,
      missingKind: 'empty_folder',
      error: '素材目录内没有可校验文件',
    })
    return results
  }

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
        validCountBySize.set(actualSizeKey, (validCountBySize.get(actualSizeKey) ?? 0) + 1)
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
          error: '实际尺寸不符合需求尺寸',
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

  // 补充 missing：目标尺寸数量不足，旧尺寸数组会按每个尺寸至少 1 个素材处理。
  for (const missing of getMissingRequirements(targetRequirements, validCountBySize)) {
    results.push({
      fileName: `[缺失] ${missing.resolution}`,
      filePath: '',
      folderName: '-',
      ext: '',
      fileSize: 0,
      actualWidth: 0,
      actualHeight: 0,
      status: 'missing',
      targetSize: missing.resolution,
      requiredQuantity: missing.requiredQuantity,
      actualQuantity: missing.actualQuantity,
      missingCount: missing.missingCount,
      error: `数量不足：需要 ${missing.requiredQuantity} 个，当前 ${missing.actualQuantity} 个，缺 ${missing.missingCount} 个`,
    })
  }

  return results
})

ipcMain.handle('fs:trashFile', async (_, filePath: string) => {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: '文件路径为空' }
  }

  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      return { success: false, error: '只能删除文件' }
    }
    await shell.trashItem(filePath)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
})

ipcMain.handle('fs:previewRename', async (_, request: RenameRequest) => {
  return previewRenameRequest(request)
})

ipcMain.handle('fs:executeRename', async (_, request: RenameRequest) => {
  return executeRenameRequest(request)
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

    // 视频素材优先归档到现有的“游戏名-奇觅生成”等包含“奇觅生成”的目录。
    if (isQimiEnabled && file.ext && file.ext.toLowerCase() === '.mp4') {
      const qimiFolderCandidates: string[] = []

      if (await fs.pathExists(gameFolder)) {
        try {
          const gameSubDirs = await fs.readdir(gameFolder)
          const directoryChecks = await Promise.all(
            gameSubDirs.map(async (subDir) => {
              try {
                const stat = await fs.stat(join(gameFolder, subDir))
                return stat.isDirectory() ? subDir : null
              } catch {
                return null
              }
            })
          )
          qimiFolderCandidates.push(...directoryChecks.filter((name): name is string => Boolean(name)))
        } catch (err) {
          // Ignore read errors, will just use the default qimi folder name.
        }
      }

      finalResolution = selectQimiFolderName(file.gameName, qimiFolderCandidates)
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
      missingFolders.add(`【${file.gameName}】缺少文件夹，已为您创建【${finalResolution}】文件夹。`)
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
