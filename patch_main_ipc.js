const fs = require('fs');
let code = fs.readFileSync('src/main/index.ts', 'utf8');
code = code.replace(
  /ipcMain\.handle\('fs:executeOrganize', async \(_, \{ files, destDir \}\) => \{/g,
  `ipcMain.handle('fs:executeOrganize', async (_, { files, destDir, isQimiEnabled }) => {`
);

const searchLogic = `    // Check if the game folder exists and look for an existing resolution folder
    if (await fs.pathExists(gameFolder)) {
      try {
        const gameSubDirs = await fs.readdir(gameFolder)
        // Normalize the target resolution to just numbers, e.g. "1080-607" -> "1080_607"
        const normalizedTarget = file.resolution.replace(/[xX*\\-]/g, '_')

        for (const subDir of gameSubDirs) {
          const fullSubDirPath = join(gameFolder, subDir)
          const stat = await fs.stat(fullSubDirPath)
          if (stat.isDirectory()) {
            const normalizedSubDir = subDir.replace(/[xX*\\-]/g, '_')
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

    const targetFolder = join(gameFolder, finalResolution)`;

const replaceLogic = `    // If it is an mp4 file and qimi generation is enabled, force the target folder to be '奇觅生成'
    let qimiCreated = false;
    if (isQimiEnabled && file.ext && file.ext.toLowerCase() === '.mp4') {
      finalResolution = '奇觅生成';
    } else {
      // Check if the game folder exists and look for an existing resolution folder
      if (await fs.pathExists(gameFolder)) {
        try {
          const gameSubDirs = await fs.readdir(gameFolder)
          // Normalize the target resolution to just numbers, e.g. "1080-607" -> "1080_607"
          const normalizedTarget = file.resolution.replace(/[xX*\\-]/g, '_')

          for (const subDir of gameSubDirs) {
            const fullSubDirPath = join(gameFolder, subDir)
            const stat = await fs.stat(fullSubDirPath)
            if (stat.isDirectory()) {
              const normalizedSubDir = subDir.replace(/[xX*\\-]/g, '_')
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

    const targetFolder = join(gameFolder, finalResolution)`;

code = code.replace(searchLogic, replaceLogic);
fs.writeFileSync('src/main/index.ts', code);
