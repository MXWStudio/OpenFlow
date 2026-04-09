const fs = require('fs');
let code = fs.readFileSync('src/main/index.ts', 'utf8');

const searchLogic = `    // 如果目标文件夹不存在，记录并创建
    if (!(await fs.pathExists(targetFolder))) {
      missingFolders.add(\`【\${file.gameName}】缺少文件夹，已为您创建【\${finalResolution}】文件夹。\`)
      await fs.ensureDir(targetFolder)
    }`;

const replaceLogic = `    // 如果目标文件夹不存在，记录并创建
    if (!(await fs.pathExists(targetFolder))) {
      if (finalResolution === '奇觅生成') {
        missingFolders.add(\`已为您创建【奇觅生成】文件夹。\`)
      } else {
        missingFolders.add(\`【\${file.gameName}】缺少文件夹，已为您创建【\${finalResolution}】文件夹。\`)
      }
      await fs.ensureDir(targetFolder)
    }`;

code = code.replace(searchLogic, replaceLogic);
fs.writeFileSync('src/main/index.ts', code);
