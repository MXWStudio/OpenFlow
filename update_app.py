import re

with open('src/renderer/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handleAddFolder
add_folder_replacement = '''  const handleAddFolder = async () => {
    const paths = await window.electronAPI.dialog.selectFolder() as string[] | string | null;
    if (!paths) return;
    const folderPathsToAdd = Array.isArray(paths) ? paths : [paths];
    if (folderPathsToAdd.length === 0) return;

    setFolderPaths((prev) => [...new Set([...prev, ...folderPathsToAdd])]);
    try {
      const detectedSizes = await window.electronAPI.fs.readProjectSizes(folderPathsToAdd) as string[] | undefined;
      if (Array.isArray(detectedSizes) && detectedSizes.length > 0) {
        setSelectedSizes(prev => [...new Set([...prev, ...detectedSizes])]);
      }
    } catch {
      // 读取失败不影响添加文件夹，仅不自动勾选尺寸
    }
    toast.success(folderPathsToAdd.length > 1 ? `${folderPathsToAdd.length} ${t[language].foldersAddedDesc}` : t[language].folderAdded, { description: folderPathsToAdd[0] });
  };'''

content = re.sub(
    r'  const handleAddFolder = async \(\) => \{.*?(?=\s+/\*\*\n\s+\* 清空当前工作区)',
    add_folder_replacement + '\n\n',
    content,
    flags=re.DOTALL
)

# Function to fix drop events
def drop_logic_replacement(spaces):
    return spaces + '''const newFolderPaths: string[] = [];
''' + spaces + '''for (let i = 0; i < e.dataTransfer.items.length; i++) {
''' + spaces + '''  const item = e.dataTransfer.items[i];
''' + spaces + '''  if (item.kind === 'file') {
''' + spaces + '''    const entry = item.webkitGetAsEntry();
''' + spaces + '''    const file = item.getAsFile() as File & { path?: string };
''' + spaces + '''    if (entry && file && file.path) {
''' + spaces + '''      if (entry.isDirectory) {
''' + spaces + '''        newFolderPaths.push(file.path);
''' + spaces + '''      } else {
''' + spaces + '''        newFolderPaths.push(getDirFromFilePath(file.path));
''' + spaces + '''      }
''' + spaces + '''    }
''' + spaces + '''  }
''' + spaces + '''}
''' + spaces + '''const folderPathsToAdd = [...new Set(newFolderPaths)];'''

# Replace global drop
global_drop_regex = r'(\s+)const filePaths = Array\.from\(e\.dataTransfer\.files\)\s*\.map\(\(f\) => \(f as File & \{ path\?: string \}\)\.path\)\s*\.filter\(\(p\): p is string => Boolean\(p\)\);\s*const folderPathsToAdd = \[\.\.\.new Set\(filePaths\.map\(getDirFromFilePath\)\)\];'
content = re.sub(global_drop_regex, lambda m: drop_logic_replacement(m.group(1)), content)

with open('src/renderer/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
