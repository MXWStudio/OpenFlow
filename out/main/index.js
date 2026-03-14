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
  const projectName = rawData.projectName || rawData.project_name || rawData.name || "";
  let sizes = [];
  if (Array.isArray(rawData.sizes)) {
    sizes = rawData.sizes;
  } else if (Array.isArray(rawData.dimensions)) {
    sizes = rawData.dimensions;
  } else if (Array.isArray(rawData.requirements)) {
    sizes = rawData.requirements.map(
      (r) => r.size || `${r.width}*${r.height}`
    );
  }
  return { projectName, sizes, rawData };
});
electron.ipcMain.handle("dialog:selectFolder", async () => {
  const result = await electron.dialog.showOpenDialog({
    title: "选择文件夹",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});
electron.ipcMain.handle("fs:initFolders", async (_, { projectName, sizes, outputPath }) => {
  try {
    const projectRoot = path.join(outputPath, projectName);
    await fs.ensureDir(projectRoot);
    for (const size of sizes) {
      const normalized = size.replace("x", "*");
      const [w, h] = normalized.split("*").map(Number);
      const orientation = w > h ? "横版" : w < h ? "竖版" : "方形";
      const folderName = `${w}x${h}_${orientation}`;
      const sizeDir = path.join(projectRoot, folderName);
      await fs.ensureDir(sizeDir);
      await fs.ensureDir(path.join(sizeDir, "_Assets"));
    }
    return { success: true, rootPath: projectRoot };
  } catch (error) {
    return { success: false, rootPath: "", error: String(error) };
  }
});
electron.ipcMain.handle("fs:startValidation", async (_, { folderPath, targetSizes }) => {
  const results = [];
  const targetSizeSet = new Set(
    targetSizes.map((s) => s.replace("x", "*"))
  );
  let files;
  try {
    files = await fs.readdir(folderPath);
  } catch {
    return [];
  }
  for (const fileName of files) {
    const filePath = path.join(folderPath, fileName);
    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const ext = path.extname(fileName).toLowerCase();
    const isImage = IMAGE_EXTS.has(ext);
    const isVideo = VIDEO_EXTS.has(ext);
    if (!isImage && !isVideo) continue;
    let actualWidth = 0;
    let actualHeight = 0;
    let duration;
    try {
      if (isImage) {
        const dim = sizeOf(filePath);
        actualWidth = dim.width || 0;
        actualHeight = dim.height || 0;
      } else {
        const info = await getVideoInfo(filePath);
        actualWidth = info.width;
        actualHeight = info.height;
        duration = info.duration;
      }
      const actualSizeKey = `${actualWidth}*${actualHeight}`;
      results.push({
        fileName,
        filePath,
        ext,
        fileSize: stat.size,
        actualWidth,
        actualHeight,
        duration,
        status: targetSizeSet.has(actualSizeKey) ? "valid" : "mismatch"
      });
    } catch (err) {
      results.push({
        fileName,
        filePath,
        ext,
        fileSize: stat.size,
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
    const ext = path.extname(file.fileName);
    const originalBaseName = path.basename(file.fileName, ext);
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
