"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs-extra");
const sizeOf = require("image-size");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
function getConfigPath() {
  return path.join(electron.app.getPath("userData"), "openflow-config.json");
}
async function storeRead() {
  try {
    return await fs.readJson(getConfigPath());
  } catch {
    return {};
  }
}
async function storeGetValue(key) {
  const data = await storeRead();
  return key.split(".").reduce((obj, k) => obj?.[k], data);
}
async function storeSetValue(key, value) {
  const data = await storeRead();
  const keys = key.split(".");
  let current = data;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  await fs.outputJson(getConfigPath(), data, { spaces: 2 });
}
async function storeDeleteKey(key) {
  const data = await storeRead();
  const keys = key.split(".");
  if (keys.length === 1) {
    delete data[key];
  } else {
    let current = data;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
      if (!current) return;
    }
    delete current[keys[keys.length - 1]];
  }
  await fs.outputJson(getConfigPath(), data, { spaces: 2 });
}
const IMAGE_EXTS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif"]);
const VIDEO_EXTS = /* @__PURE__ */ new Set([".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".m4v"]);
function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      if (!videoStream) return reject(new Error("未找到视频流"));
      resolve({
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        duration: metadata.format.duration || 0
      });
    });
  });
}
function applyTemplate(template, vars) {
  return template.replace(/\[(\w+)\]/g, (_, key) => vars[key] ?? `[${key}]`);
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    // 先隐藏，等 ready-to-show 再显示，避免白屏
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    // slate-900，防止加载时白色闪烁
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      // 安全：隔离上下文
      nodeIntegration: false,
      // 安全：禁止 renderer 直接访问 Node
      sandbox: false
      // preload 需要访问 Node API
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  const isDev = !electron.app.isPackaged;
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
}
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.on("window:minimize", () => {
  electron.BrowserWindow.getFocusedWindow()?.minimize();
});
electron.ipcMain.on("window:maximize", () => {
  const win = electron.BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});
electron.ipcMain.on("window:close", () => {
  electron.BrowserWindow.getFocusedWindow()?.close();
});
electron.ipcMain.handle("dialog:openJson", async () => {
  const result = await electron.dialog.showOpenDialog({
    title: "选择需求 JSON 文件",
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const rawData = JSON.parse(await fs.readFile(filePath, "utf-8"));
  const projects = [];
  let projectName = "";
  let sizes = [];
  const norm = (s) => (s || "").replace(/[xX×]/g, "*");
  if (Array.isArray(rawData)) {
    for (const item of rawData) {
      const name = item["其他信息"] && item["其他信息"]["项目名称"] || item["项目名称"] || item["projectName"] || item["project_name"] || item["name"] || "";
      const sizeSet = /* @__PURE__ */ new Set();
      const details = item["尺寸要求明细"] || item["sizes"] || [];
      if (Array.isArray(details)) {
        for (const d of details) {
          const res = d["分辨率"] || d["resolution"] || d["size"] || "";
          if (res) sizeSet.add(norm(res));
        }
      }
      if (name) projects.push({ projectName: name, sizes: [...sizeSet] });
    }
    if (projects.length > 0) {
      projectName = projects[0].projectName;
      const firstSizes = /* @__PURE__ */ new Set();
      for (const p of projects) p.sizes.forEach((s) => firstSizes.add(s));
      sizes = [...firstSizes];
    }
  } else {
    projectName = rawData.projectName || rawData.project_name || rawData.name || "";
    if (Array.isArray(rawData.sizes)) {
      sizes = rawData.sizes.map((s) => norm(s));
    } else if (Array.isArray(rawData.dimensions)) {
      sizes = rawData.dimensions.map((s) => norm(s));
    } else if (Array.isArray(rawData.requirements)) {
      sizes = rawData.requirements.map(
        (r) => r.size ? norm(r.size) : `${r.width}*${r.height}`
      );
    }
    if (projectName || sizes.length) {
      projects.push({ projectName: projectName || "未命名项目", sizes });
    }
  }
  return { projectName, sizes, projects, rawData };
});
electron.ipcMain.handle("dialog:selectFolder", async () => {
  const result = await electron.dialog.showOpenDialog({
    title: "选择文件夹",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});
electron.ipcMain.handle("fs:initFolders", async (_, projectsData) => {
  const list = Array.isArray(projectsData) ? projectsData : [];
  if (list.length === 0) {
    return { success: false, destPath: "", error: "项目列表为空" };
  }
  const result = await electron.dialog.showOpenDialog({
    title: "选择目标总目录",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) {
    return { success: false, destPath: "", error: "用户取消选择" };
  }
  const rootPath = result.filePaths[0];
  try {
    for (const project of list) {
      const projectRoot = path.join(rootPath, project.projectName);
      await fs.ensureDir(projectRoot);
      const sizes = project.sizes || [];
      for (const size of sizes) {
        const folderName = size.replace(/\*/g, "x");
        const sizeDir = path.join(projectRoot, folderName);
        await fs.ensureDir(sizeDir);
        await fs.ensureDir(path.join(sizeDir, "_Assets"));
      }
    }
    return { success: true, destPath: rootPath };
  } catch (error) {
    return { success: false, destPath: "", error: String(error) };
  }
});
const SIZE_FOLDER_REGEX = /^\d+[xX]\d+$/;
electron.ipcMain.handle("fs:readProjectSizes", async (_, folderPaths) => {
  const paths = Array.isArray(folderPaths) ? folderPaths : [];
  const sizeSet = /* @__PURE__ */ new Set();
  for (const dir of paths) {
    let names;
    try {
      names = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (SIZE_FOLDER_REGEX.test(name)) {
        sizeSet.add(name.replace(/[xX]/g, "*"));
      }
    }
  }
  return [...sizeSet];
});
async function collectMediaFiles(dirPath, fileList) {
  let names;
  try {
    names = await fs.readdir(dirPath);
  } catch {
    return;
  }
  for (const name of names) {
    const fullPath = path.join(dirPath, name);
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      await collectMediaFiles(fullPath, fileList);
      continue;
    }
    if (!stat.isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue;
    const folderName = path.basename(dirPath);
    fileList.push({
      filePath: fullPath,
      fileName: path.basename(name, ext),
      // 纯文件名，不含扩展名
      folderName,
      ext,
      size: stat.size
    });
  }
}
electron.ipcMain.handle("fs:startValidation", async (_, { folderPath, targetSizes }) => {
  const results = [];
  const targetSizeSet = new Set(
    targetSizes.map((s) => s.replace("x", "*"))
  );
  const fileList = [];
  await collectMediaFiles(folderPath, fileList);
  for (const { filePath, fileName, folderName, ext, size: fileSize } of fileList) {
    const isImage = IMAGE_EXTS.has(ext);
    const isVideo = VIDEO_EXTS.has(ext);
    let actualWidth = 0;
    let actualHeight = 0;
    let duration;
    try {
      if (isImage) {
        const dim = sizeOf(filePath);
        actualWidth = dim.width || 0;
        actualHeight = dim.height || 0;
      } else if (isVideo) {
        const info = await getVideoInfo(filePath);
        actualWidth = info.width;
        actualHeight = info.height;
        duration = info.duration;
      }
      const actualSizeKey = `${actualWidth}*${actualHeight}`;
      results.push({
        fileName,
        filePath,
        folderName,
        ext,
        fileSize,
        actualWidth,
        actualHeight,
        duration,
        status: targetSizeSet.has(actualSizeKey) ? "valid" : "mismatch"
      });
    } catch (err) {
      results.push({
        fileName,
        filePath,
        folderName,
        ext,
        fileSize,
        actualWidth: 0,
        actualHeight: 0,
        status: "error",
        error: String(err)
      });
    }
  }
  for (const targetSize of targetSizes) {
    const normalized = targetSize.replace("x", "*");
    const hasMatch = results.some(
      (r) => r.status === "valid" && `${r.actualWidth}*${r.actualHeight}` === normalized
    );
    if (!hasMatch) {
      results.push({
        fileName: `[缺失] ${targetSize}`,
        filePath: "",
        folderName: "-",
        ext: "",
        fileSize: 0,
        actualWidth: 0,
        actualHeight: 0,
        status: "missing",
        targetSize
      });
    }
  }
  return results;
});
electron.ipcMain.handle("fs:executeRename", async (_, { files, template, projectName, producer }) => {
  const results = [];
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, "");
  for (const file of files) {
    if (!file.filePath || file.status === "missing") continue;
    const ext = file.ext || path.extname(file.filePath);
    const originalBaseName = file.fileName;
    const sizeStr = `${file.actualWidth}x${file.actualHeight}`;
    const dir = path.dirname(file.filePath);
    const newBaseName = applyTemplate(template || "[Project]-[Name]-[Size]", {
      Project: projectName || "Project",
      Name: originalBaseName,
      Size: sizeStr,
      Producer: producer || "",
      Date: today
    });
    let newFileName = `${newBaseName}${ext}`;
    let newFilePath = path.join(dir, newFileName);
    let counter = 1;
    while (await fs.pathExists(newFilePath) && newFilePath !== file.filePath) {
      newFileName = `${newBaseName}_${counter}${ext}`;
      newFilePath = path.join(dir, newFileName);
      counter++;
    }
    try {
      await fs.rename(file.filePath, newFilePath);
      results.push({ oldFileName: file.fileName, newFileName, success: true });
    } catch (err) {
      results.push({
        oldFileName: file.fileName,
        newFileName,
        success: false,
        error: String(err)
      });
    }
  }
  return results;
});
electron.ipcMain.handle("store:get", async (_, key) => {
  return storeGetValue(key);
});
electron.ipcMain.handle("store:set", async (_, { key, value }) => {
  await storeSetValue(key, value);
});
electron.ipcMain.handle("store:getAll", async () => {
  return storeRead();
});
electron.ipcMain.handle("store:delete", async (_, key) => {
  await storeDeleteKey(key);
});
electron.ipcMain.handle("dialog:exportLogs", async () => {
  const result = await electron.dialog.showSaveDialog({
    title: "导出错误日志",
    defaultPath: `openflow-logs-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.txt`,
    filters: [{ name: "Text Files", extensions: ["txt"] }]
  });
  if (result.canceled || !result.filePath) return { success: false };
  const mockLog = `OpenFlow Studio - 系统日志
导出时间: ${(/* @__PURE__ */ new Date()).toISOString()}
----------------------------------------
[INFO] 应用启动完成
[INFO] 配置加载成功
[INFO] 无错误记录
----------------------------------------
（此文件为模拟导出，用于测试“导出错误日志”功能）
`;
  await fs.writeFile(result.filePath, mockLog, "utf-8");
  return { success: true, path: result.filePath };
});
