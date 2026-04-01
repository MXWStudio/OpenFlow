/**
 * Preload 脚本 —— Renderer 与 Main 进程之间的安全桥接层
 * 使用 contextBridge 暴露受控 API，确保 renderer 无法直接访问 Node.js
 */

import { contextBridge, ipcRenderer } from 'electron'

// 将所有安全 API 暴露到 window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // ────────────────────────────────────────────────
  // 对话框 API
  // ────────────────────────────────────────────────
  dialog: {
    /** 打开系统文件选择框，返回解析后的 JSON 数据 */
    openJson: () => ipcRenderer.invoke('dialog:openJson'),

    /** 打开系统文件选择框，返回解析后的 Excel 数据 */
    importExcel: () => ipcRenderer.invoke('dialog:importExcel'),

    /** 打开文件夹选择框，返回选中的目录路径 */
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

    /** 导出错误日志到用户指定的文件路径 */
    exportLogs: () => ipcRenderer.invoke('dialog:exportLogs'),
  },

  // ────────────────────────────────────────────────
  // 数据库 API (SQLite)
  // ────────────────────────────────────────────────
  db: {
    getImportedData: (batchId?: string) => ipcRenderer.invoke('db:getImportedData', batchId),
    insertImportedData: (batchId: string, rowData: any) => ipcRenderer.invoke('db:insertImportedData', batchId, rowData),
    updateImportedData: (id: number, rowData: any) => ipcRenderer.invoke('db:updateImportedData', id, rowData),
    deleteImportedData: (id: number) => ipcRenderer.invoke('db:deleteImportedData', id),
    deleteBatch: (batchId: string) => ipcRenderer.invoke('db:deleteBatch', batchId),
    clearAllImportedData: () => ipcRenderer.invoke('db:clearAllImportedData'),
  },

  // ────────────────────────────────────────────────
  // 文件系统 API
  // ────────────────────────────────────────────────
  fs: {
    /** 批量初始化项目目录结构（主进程内弹窗选择目标总目录） */
    initFolders: (projectsData: Array<{ projectName: string; sizes: string[] }>) =>
      ipcRenderer.invoke('fs:initFolders', projectsData),

    /** 读取若干文件夹下的一级子目录名，识别尺寸格式（如 720x1280）并返回规范化尺寸数组 */
    readProjectSizes: (folderPaths: string[]) =>
      ipcRenderer.invoke('fs:readProjectSizes', folderPaths),

    /** 开始素材校验 */
    startValidation: (folderPath: string, targetSizes: string[]) =>
      ipcRenderer.invoke('fs:startValidation', { folderPath, targetSizes }),

    /** 执行批量重命名 */
    executeRename: (
      files: unknown[],
      templates: {
        videoRegular: any[];
        videoSpecial: any[];
        imageRegular: any[];
        imageSpecial: any[];
      },
      projectName: string,
      producer?: string,
      isSpecialEnabled?: boolean
    ) => ipcRenderer.invoke('fs:executeRename', { files, templates, projectName, producer, isSpecialEnabled }),

    /** 扫描素材整理目录 */
    scanOrganizerFolder: (sourceDir: string, allowedFormats: string[]) =>
      ipcRenderer.invoke('fs:scanOrganizerFolder', { sourceDir, allowedFormats }),

    /** 执行素材转移 */
    executeOrganize: (files: unknown[], destDir: string) =>
      ipcRenderer.invoke('fs:executeOrganize', { files, destDir }),

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
})
