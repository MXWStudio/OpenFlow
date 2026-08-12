import { basename, dirname } from 'path'

export const SIZE_FOLDER_REGEX = /^\d+[*xX×-]\d+$/

export interface ResolutionFolderContext {
  projectRoot: string
  resolutionDir: string
  resolutionFolderName: string
  namingProjectName: string
}

export function getResolutionFolderContext(filePath: string): ResolutionFolderContext | null {
  let currentDir = dirname(filePath)
  let childUnderResolution = ''
  let previousDir = ''

  while (currentDir && currentDir !== previousDir) {
    if (SIZE_FOLDER_REGEX.test(basename(currentDir))) {
      const projectRoot = dirname(currentDir)
      const rootProjectName = basename(projectRoot)
      const nestedProjectName = childUnderResolution ? basename(childUnderResolution) : ''

      return {
        projectRoot,
        resolutionDir: currentDir,
        resolutionFolderName: basename(currentDir),
        namingProjectName: nestedProjectName || rootProjectName,
      }
    }

    childUnderResolution = currentDir
    previousDir = currentDir
    currentDir = dirname(currentDir)
  }

  return null
}
