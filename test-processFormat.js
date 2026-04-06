const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

async function getDirEntries(dir) {
  try {
    const names = await fs.readdir(dir);
    return new Set(names);
  } catch (err) {
    return new Set();
  }
}

async function run() {
    let outDir = path.join(__dirname, 'test-format-output3');
    await fs.ensureDir(outDir);

    // Provide a file that DOES NOT EXIST to see the error message
    let file = {
        filePath: path.join(__dirname, 'does_not_exist.png'),
        ext: '.png',
        fileName: 'does_not_exist.png'
    };

    // We want to simulate EXACTLY what the app does
    try {
      if (!file.filePath || !await fs.pathExists(file.filePath)) {
        throw new Error('文件路径不存在');
      }
    } catch (e) {
      console.error(e.message);
    }
}
run();
