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
    selectFolder: () => electron.ipcRenderer.invoke("dialog:selectFolder")
  },
  // ────────────────────────────────────────────────
  // 文件系统 API
  // ────────────────────────────────────────────────
  fs: {
    /** 初始化项目目录结构 */
    initFolders: (projectName, sizes, outputPath) => electron.ipcRenderer.invoke("fs:initFolders", { projectName, sizes, outputPath }),
    /** 开始素材校验 */
    startValidation: (folderPath, targetSizes) => electron.ipcRenderer.invoke("fs:startValidation", { folderPath, targetSizes }),
    /** 执行批量重命名 */
    executeRename: (files, template, projectName, producer) => electron.ipcRenderer.invoke("fs:executeRename", { files, template, projectName, producer })
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
    getAll: () => electron.ipcRenderer.invoke("store:getAll")
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
