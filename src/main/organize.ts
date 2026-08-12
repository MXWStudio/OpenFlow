export const QIMI_FOLDER_NAME = '奇觅生成'

export function getPreferredQimiFolderName(gameName: string): string {
  const normalizedGameName = gameName.trim()
  return normalizedGameName ? `${normalizedGameName}-${QIMI_FOLDER_NAME}` : QIMI_FOLDER_NAME
}

export function selectQimiFolderName(gameName: string, existingDirectoryNames: string[]): string {
  const preferredName = getPreferredQimiFolderName(gameName)
  const qimiDirectoryNames = existingDirectoryNames
    .filter((name) => name.includes(QIMI_FOLDER_NAME))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  return qimiDirectoryNames.find((name) => name === preferredName) ||
    qimiDirectoryNames.find((name) => name.endsWith(`-${QIMI_FOLDER_NAME}`)) ||
    qimiDirectoryNames.find((name) => name !== QIMI_FOLDER_NAME) ||
    qimiDirectoryNames[0] ||
    preferredName
}
