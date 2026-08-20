/**
 * Preload 脚本 —— Renderer 与 Main 进程之间的安全桥接层
 * 使用 contextBridge 暴露受控 API，确保 renderer 无法直接访问 Node.js
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { RenameRequest } from '../shared/renameTemplates'
import type { DiagnosticEventInput } from '../shared/diagnosticsContract'
import type { DesktopExtractionCandidate } from '../shared/extractionContract'
import type { UpdateActivitySnapshot, UpdateViewState } from '../shared/updateContract'

const updateStateListeners = new WeakMap<
  (state: UpdateViewState) => void,
  (_event: Electron.IpcRendererEvent, state: UpdateViewState) => void
>()
const navigationListeners = new WeakMap<
  (target: { view: string, settingsTab?: string }) => void,
  (_event: Electron.IpcRendererEvent, target: { view: string, settingsTab?: string }) => void
>()
const prepareRestartListeners = new WeakMap<
  () => void,
  (_event: Electron.IpcRendererEvent) => void
>()
const extractionListeners = new WeakMap<
  (candidate: DesktopExtractionCandidate) => void,
  (_event: Electron.IpcRendererEvent, candidate: DesktopExtractionCandidate) => void
>()

// 将所有安全 API 暴露到 window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  app: {
    rendererReady: () => ipcRenderer.send('app:renderer-ready'),
    onNavigate: (listener: (target: { view: string, settingsTab?: string }) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, target: { view: string, settingsTab?: string }) => listener(target)
      navigationListeners.set(listener, wrapped)
      ipcRenderer.on('app:navigate', wrapped)
    },
    offNavigate: (listener: (target: { view: string, settingsTab?: string }) => void) => {
      const wrapped = navigationListeners.get(listener)
      if (wrapped) ipcRenderer.removeListener('app:navigate', wrapped)
      navigationListeners.delete(listener)
    },
  },
  webUtils: {
    getPathForFile: (file: File) => webUtils.getPathForFile(file)
  },
  // ────────────────────────────────────────────────
  // 对话框 API
  // ────────────────────────────────────────────────
  dialog: {
    /** 打开系统文件选择框，返回解析后的 JSON 数据 */
    openJson: () => ipcRenderer.invoke('dialog:openJson'),

    /** 打开文件夹选择框，返回选中的目录路径 */
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

    /** 导出错误日志到用户指定的文件路径 */
    exportLogs: () => ipcRenderer.invoke('dialog:exportLogs'),
  },

  // ────────────────────────────────────────────────
  // 文件系统 API
  // ────────────────────────────────────────────────
  fs: {
    /** 批量初始化项目目录结构（主进程内弹窗选择目标总目录） */
    initFolders: (projectsData: Array<{ projectName: string; sizes: string[]; requirements?: unknown[] }>) =>
      ipcRenderer.invoke('fs:initFolders', projectsData),

    /** 读取若干文件夹下的一级子目录名，识别尺寸格式（如 720x1280）并返回规范化尺寸数组 */
    readProjectSizes: (folderPaths: string[]) =>
      ipcRenderer.invoke('fs:readProjectSizes', folderPaths),

    /** 开始素材校验 */
    startValidation: (folderPath: string, targetSizes: Array<string | { resolution: string; requiredQuantity?: number }>) =>
      ipcRenderer.invoke('fs:startValidation', { folderPath, targetSizes }),

    /** 将单个素材文件移到系统废纸篓 */
    trashFile: (filePath: string) =>
      ipcRenderer.invoke('fs:trashFile', filePath),

    /** 生成批量重命名预检，不修改文件 */
    previewRename: (request: RenameRequest) =>
      ipcRenderer.invoke('fs:previewRename', request),

    /** 执行经过同一规则规划的批量重命名 */
    executeRename: (request: RenameRequest) =>
      ipcRenderer.invoke('fs:executeRename', request),

    /** 扫描素材整理目录 */
    scanOrganizerFolder: (sourceDir: string, allowedFormats: string[]) =>
      ipcRenderer.invoke('fs:scanOrganizerFolder', { sourceDir, allowedFormats }),

    /** 执行素材转移 */
    executeOrganize: (files: unknown[], destDir: string, isQimiEnabled?: boolean) =>
      ipcRenderer.invoke('fs:executeOrganize', { files, destDir, isQimiEnabled }),

    /** 撤销素材转移 */
    undoOrganize: () =>
      ipcRenderer.invoke('fs:undoOrganize'),

    /** 批量格式处理 */
    processFormat: (files: any[], config: any) =>
      ipcRenderer.invoke('fs:processFormat', { files, config }),
  },

  // ────────────────────────────────────────────────
  // 持久化配置 API
  // ────────────────────────────────────────────────
  store: {
    /** 读取配置项 */
    get: (key: string) => ipcRenderer.invoke('store:get', key),

    /** 写入配置项 */
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', { key, value }),

    /** 读取全部配置 */
    getAll: () => ipcRenderer.invoke('store:getAll'),

    /** 删除指定配置项 */
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },

  diagnostics: {
    report: (event: DiagnosticEventInput) => ipcRenderer.invoke('diagnostics:report', event),
  },

  extractions: {
    getLatestToday: () => ipcRenderer.invoke('extractions:get-latest-today'),
    onAvailable: (listener: (candidate: DesktopExtractionCandidate) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, candidate: DesktopExtractionCandidate) => listener(candidate)
      extractionListeners.set(listener, wrapped)
      ipcRenderer.on('extractions:available', wrapped)
    },
    offAvailable: (listener: (candidate: DesktopExtractionCandidate) => void) => {
      const wrapped = extractionListeners.get(listener)
      if (wrapped) ipcRenderer.removeListener('extractions:available', wrapped)
      extractionListeners.delete(listener)
    },
  },

  // ────────────────────────────────────────────────
  // 窗口控制 API（配合自定义标题栏使用）
  // ────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // ────────────────────────────────────────────────
  // Shell API
  // ────────────────────────────────────────────────
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },

  updates: {
    getState: () => ipcRenderer.invoke('updates:get-state'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    openExtensionFolder: () => ipcRenderer.invoke('updates:open-extension-folder'),
    openManualDownload: () => ipcRenderer.invoke('updates:open-manual-download'),
    reportActivity: (activity: UpdateActivitySnapshot) => ipcRenderer.invoke('updates:report-activity', activity),
    onState: (listener: (state: UpdateViewState) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, state: UpdateViewState) => listener(state)
      updateStateListeners.set(listener, wrapped)
      ipcRenderer.on('updates:state', wrapped)
    },
    offState: (listener: (state: UpdateViewState) => void) => {
      const wrapped = updateStateListeners.get(listener)
      if (wrapped) ipcRenderer.removeListener('updates:state', wrapped)
      updateStateListeners.delete(listener)
    },
    onPrepareRestart: (listener: () => void) => {
      const wrapped = () => listener()
      prepareRestartListeners.set(listener, wrapped)
      ipcRenderer.on('updates:prepare-restart', wrapped)
    },
    offPrepareRestart: (listener: () => void) => {
      const wrapped = prepareRestartListeners.get(listener)
      if (wrapped) ipcRenderer.removeListener('updates:prepare-restart', wrapped)
      prepareRestartListeners.delete(listener)
    },
  },

  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => ipcRenderer.on(channel, listener),
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => ipcRenderer.removeListener(channel, listener),
  },
})
