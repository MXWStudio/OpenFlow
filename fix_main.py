import re

with open('src/main/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix ipcMain.handle('dialog:selectFolder')
dialog_select_replacement = '''ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择文件夹（可选择游戏名文件夹）',
    buttonLabel: '选择此文件夹',
    properties: ['openDirectory', 'multiSelections'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths
})'''
content = re.sub(r"ipcMain\.handle\('dialog:selectFolder', async \(\) => \{.*?(?=\n\}\))(?s:.*?\n\}\))", dialog_select_replacement, content)

# Fix fs:readProjectSizes
read_sizes_replacement = '''/** 递归查找尺寸目录，最多深入 4 层 */
async function findSizesDeep(dir: string, depth: number, sizeSet: Set<string>) {
  if (depth > 4) return
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (SKIP_DIRS_READ_SIZE.has(name)) continue
    const full = join(dir, name)
    try {
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        if (SIZE_FOLDER_REGEX.test(name)) {
          sizeSet.add(name.replace(/[xX-]/g, '*'))
        } else {
          await findSizesDeep(full, depth + 1, sizeSet)
        }
      }
    } catch {
      continue
    }
  }
}

ipcMain.handle('fs:readProjectSizes', async (_, folderPaths: string[]) => {
  const paths = Array.isArray(folderPaths) ? folderPaths : []
  const sizeSet = new Set<string>()

  for (const p of paths) {
    const base = basename(p)
    if (SIZE_FOLDER_REGEX.test(base)) {
      sizeSet.add(base.replace(/[xX-]/g, '*'))
    } else {
      await findSizesDeep(p, 0, sizeSet)
    }
  }
  return [...sizeSet]
})'''
content = re.sub(
    r"ipcMain\.handle\('fs:readProjectSizes', async \(_, folderPaths: string\[\]\) => \{.*?(?=\n\}\))(?s:.*?\n\}\))",
    read_sizes_replacement,
    content
)

# Fix collectMediaFiles
collect_replacement = '''async function collectMediaFiles(
  dirPath: string,
  fileList: { filePath: string; fileName: string; folderName: string; ext: string; size: number }[],
  isRoot: boolean,
  depth: number = 0
): Promise<void> {
  if (depth > 5) return // 防止无限递归
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
      if (SKIP_DIRS_VALIDATION.has(name)) continue

      if (isRoot) {
        if (SIZE_FOLDER_REGEX.test(name)) {
          // 找到了尺寸文件夹，进入读取其内容，接下来就是只收集文件
          await collectMediaFiles(fullPath, fileList, false, depth + 1)
        } else {
          // 不是尺寸文件夹，继续向内层寻找
          await collectMediaFiles(fullPath, fileList, true, depth + 1)
        }
      } else {
        // 已经在尺寸文件夹内，继续递归读取内部更深层的文件
        await collectMediaFiles(fullPath, fileList, false, depth + 1)
      }
      continue
    }

    if (!isRoot && stat.isFile()) {
      const ext = extname(name).toLowerCase()
      if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue

      const folderName = basename(dirPath)

      fileList.push({
        filePath: fullPath,
        fileName: basename(name, ext),
        folderName,
        ext,
        size: stat.size,
      })
    }
  }
}'''
content = re.sub(
    r"async function collectMediaFiles\([\s\S]*?(?=\n/\*\*\n \* fs:startValidation)",
    collect_replacement,
    content
)

with open('src/main/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
