export type WaterSlothMotion = 'idle' | 'empty' | 'processing' | 'success' | 'still'

export interface DailyWaterSlothState {
  isChangingRequirement: boolean
  isValidating: boolean
  isRenaming: boolean
  hasValidated: boolean
  needsAttention: boolean
  hasRenameFailure: boolean
  hasRecentRenameSuccess: boolean
  hasFolders: boolean
}

export function getDailyWaterSlothMotion(state: DailyWaterSlothState): WaterSlothMotion {
  if (state.isChangingRequirement || state.isValidating || state.isRenaming) return 'processing'
  if (state.needsAttention || state.hasRenameFailure) return 'still'
  if (state.hasRecentRenameSuccess || (state.hasValidated && !state.needsAttention)) return 'success'
  if (!state.hasFolders) return 'empty'
  return 'idle'
}

export const WATER_SLOTH_MOTION_LABELS: Record<WaterSlothMotion, string> = {
  idle: '小水懒正在待命',
  empty: '小水懒等待开始工作',
  processing: '小水懒正在陪你处理任务',
  success: '小水懒庆祝任务成功',
  still: '小水懒提示需要人工处理',
}
