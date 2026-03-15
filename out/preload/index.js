"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // ────────────────────────────────────────────────
  // 对话框 API
  // ────────────────────────────────────────────────
  dialog: {
    /** 打开系统文件选择框，返回解析后的 JSON 数据 */
    openJson: () => electron.ipcRenderer.invoke("dialog:openJson"),
    /** 打开文件夹选择框，返回选中的目录路径 */
    selectFolder: () => electron.ipcRenderer.invoke("dialog:selectFolder"),
    /** 导出错误日志到用户指定的文件路径 */
    exportLogs: () => electron.ipcRenderer.invoke("dialog:exportLogs")
  },
  // ────────────────────────────────────────────────
  // 文件系统 API
  // ────────────────────────────────────────────────
  fs: {
    /** 批量初始化项目目录结构（主进程内弹窗选择目标总目录） */
    initFolders: (projectsData) => electron.ipcRenderer.invoke("fs:initFolders", projectsData),
    /** 读取若干文件夹下的一级子目录名，识别尺寸格式（如 720x1280）并返回规范化尺寸数组 */
    readProjectSizes: (folderPaths) => electron.ipcRenderer.invoke("fs:readProjectSizes", folderPaths),
    /** 开始素材校验 */
    startValidation: (folderPath, targetSizes) => electron.ipcRenderer.invoke("fs:startValidation", { folderPath, targetSizes }),
    /** 执行批量重命名 */
    executeRename: (files, templates, projectName, producer) => electron.ipcRenderer.invoke("fs:executeRename", { files, templates, projectName, producer })
  },
  // ────────────────────────────────────────────────
  // 持久化配置 API
  // ────────────────────────────────────────────────
  store: {
    /** 读取配置项 */
    get: (key) => electron.ipcRenderer.invoke("store:get", key),
    /** 写入配置项 */
    set: (key, value) => electron.ipcRenderer.invoke("store:set", { key, value }),
    /** 读取全部配置 */
    getAll: () => electron.ipcRenderer.invoke("store:getAll"),
    /** 删除指定配置项 */
    delete: (key) => electron.ipcRenderer.invoke("store:delete", key)
  },
  // ────────────────────────────────────────────────
  // 窗口控制 API（配合自定义标题栏使用）
  // ────────────────────────────────────────────────
  window: {
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    maximize: () => electron.ipcRenderer.send("window:maximize"),
    close: () => electron.ipcRenderer.send("window:close")
  }
});
