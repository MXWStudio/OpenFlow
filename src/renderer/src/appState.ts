import { pinyin as toPinyin } from 'pinyin-pro';
import { formatBytes, getDirFromFilePath, dedupeStrings, formatHistoryTime } from './utils.ts';
import {
  DEFAULT_RENAME_SETTINGS,
  normalizeRenameSettings,
  type LegacyRenameTemplates,
  type RenameSettingsV2,
} from '../../shared/renameTemplates.ts';

export { formatBytes, getDirFromFilePath, dedupeStrings, formatHistoryTime };

export type TemplateKey = 'videoRegular' | 'videoSpecial' | 'imageRegular' | 'imageSpecial' | 'videoManual' | 'imageManual';
export type TokenType =
  | 'ProjectName'
  | 'CleanProjectName'
  | 'Date'
  | 'Producer'
  | 'Resolution'
  | 'AspectRatio'
  | 'Sequence'
  | 'OriginalName'
  | 'CustomText';

export interface TemplateToken {
  type: TokenType;
  value?: string;
}

export interface WorkflowSettings {
  renameTemplates: Record<TemplateKey, TemplateToken[]>;
  renameSettings: RenameSettingsV2;
  organizerFormats: string[];
}

export interface UserInfo {
  name: string;
  department: string;
  email: string;
}

export interface NotificationHistoryEntry {
  id: string;
  color: string;
  title: string;
  message?: string;
  timestamp: number;
}

export interface SystemSettings {
  theme: 'light' | 'dark' | 'auto';
  autoStart: boolean;
  closeToTray: boolean;
}

export interface WorkspaceSettings {
  sourceDir: string;
  destDir: string;
}

export interface ShortcutSettings {
  togglePanel: string;
}

export interface HistoryEntry {
  id: number;
  project: string;
  count: number;
  status: 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface RequirementDetail {
  resolution: string;
  requiredQuantity?: number;
  positionType?: string;
  sizeLimit?: string;
}

export interface RequirementProject {
  taskId?: string;
  projectName: string;
  sizes: string[];
  requirements?: RequirementDetail[];
  fullName?: string;
  producerName?: string;
  materialType?: string;
}

export interface DailyRequirementSession {
  importedAt: number;
  importedDateKey: string;
  fileName: string;
  sizes: string[];
  projects: RequirementProject[];
  producerName?: string;
  department?: string;
  email?: string;
  warnings?: string[];
}

export interface ValidationResult {
  fileName: string;
  filePath: string;
  folderName: string;
  ext: string;
  fileSize: number;
  actualWidth: number;
  actualHeight: number;
  duration?: number;
  status: 'valid' | 'mismatch' | 'missing' | 'error' | 'format_error';
  targetSize?: string;
  requiredQuantity?: number;
  actualQuantity?: number;
  missingCount?: number;
  missingKind?: 'empty_folder';
  error?: string;
  workspaceProjectName?: string;
}

export const PRESET_SIZES = [
  '1280*720',
  '720*1280',
  '1920*1080',
  '1080*1920',
  '640*360',
  '1080*607',
  '1080*170',
  '900*900',
  '1080*1620',
  '160*160',
  '512*512',
  '780*800',
  '240*180',
  '1080*1880',
  '2160*1080',
];

export const TOKEN_OPTIONS: Array<{ value: TokenType; label: string }> = [
  { value: 'ProjectName', label: '项目名' },
  { value: 'CleanProjectName', label: '清理后项目名' },
  { value: 'Date', label: '日期' },
  { value: 'Producer', label: '制作人缩写' },
  { value: 'Resolution', label: '分辨率' },
  { value: 'AspectRatio', label: '横竖' },
  { value: 'Sequence', label: '序号' },
  { value: 'OriginalName', label: '原文件名' },
  { value: 'CustomText', label: '自定义文本' },
];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  videoRegular: '常规视频',
  videoSpecial: '特殊版块',
  videoManual: '手搓命名',
  imageRegular: '常规图片',
  imageManual: '手搓图片',
  imageSpecial: '特殊版块',
};

export const DEFAULT_USER_INFO: UserInfo = { name: '', department: '', email: '' };
export const DEFAULT_SYSTEM: SystemSettings = {
  theme: 'auto',
  autoStart: false,
  closeToTray: true,
};
export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  sourceDir: '',
  destDir: '',
};
export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  togglePanel: 'CommandOrControl+Shift+Space',
};
export const DEFAULT_WORKFLOW: WorkflowSettings = {
  organizerFormats: ['jpg', 'mp4'],
  renameSettings: DEFAULT_RENAME_SETTINGS,
  renameTemplates: {
    videoRegular: [
      { type: 'CustomText', value: 'RSQM' },
      { type: 'Date' },
      { type: 'ProjectName' },
      { type: 'Producer' },
      { type: 'AspectRatio' },
      { type: 'Sequence' },
    ],
    videoSpecial: [
      { type: 'ProjectName' },
      { type: 'CustomText', value: '激励视频' },
      { type: 'Date' },
      { type: 'AspectRatio' },
      { type: 'Producer' },
      { type: 'CustomText', value: 'RSQM' },
      { type: 'Sequence' },
    ],
    videoManual: [
      { type: 'CustomText', value: 'RS' },
      { type: 'Date' },
      { type: 'ProjectName' },
      { type: 'Producer' },
      { type: 'AspectRatio' },
      { type: 'Sequence' },
    ],
    imageRegular: [
      { type: 'CustomText', value: 'RSQ' },
      { type: 'Date' },
      { type: 'ProjectName' },
      { type: 'Resolution' },
      { type: 'Producer' },
      { type: 'Sequence' },
    ],
    imageManual: [
      { type: 'CustomText', value: 'RS' },
      { type: 'Date' },
      { type: 'ProjectName' },
      { type: 'Producer' },
      { type: 'AspectRatio' },
      { type: 'Sequence' },
    ],
    imageSpecial: [
      { type: 'CustomText', value: 'RSQ' },
      { type: 'Date' },
      { type: 'ProjectName' },
      { type: 'Resolution' },
      { type: 'Producer' },
      { type: 'Sequence' },
    ],
  },
};

export function hydrateWorkflowSettings(
  config: Record<string, unknown>,
  previous: WorkflowSettings = DEFAULT_WORKFLOW,
): WorkflowSettings {
  const workflow = config.workflow && typeof config.workflow === 'object' && !Array.isArray(config.workflow)
    ? config.workflow as Partial<WorkflowSettings>
    : undefined;
  const legacyTemplates = (workflow?.renameTemplates || config.renameTemplates) as LegacyRenameTemplates | undefined;

  if (!workflow) {
    return {
      ...previous,
      ...(legacyTemplates ? { renameTemplates: legacyTemplates as WorkflowSettings['renameTemplates'] } : {}),
      renameSettings: normalizeRenameSettings(undefined, legacyTemplates),
    };
  }

  return {
    ...previous,
    ...workflow,
    renameTemplates: workflow.renameTemplates || previous.renameTemplates,
    renameSettings: normalizeRenameSettings(workflow.renameSettings, legacyTemplates),
    organizerFormats: Array.isArray(workflow.organizerFormats)
      ? workflow.organizerFormats
      : previous.organizerFormats,
  };
}


export function buildTemplatePreview(template: TemplateToken[], producerName: string): string {
  const producerAbbr = producerName
    ? toPinyin(producerName, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toUpperCase()
    : '';

  const sampleValues: Record<TokenType, string> = {
    ProjectName: '示例项目',
    CleanProjectName: '示例项目',
    Date: '20260323',
    Producer: producerAbbr,
    Resolution: '1920x1080',
    AspectRatio: '横',
    Sequence: '(1)',
    OriginalName: '原文件名',
    CustomText: '',
  };

  return template
    .reduce<string[]>((parts, token, index) => {
      const value = token.type === 'CustomText' ? token.value || '' : sampleValues[token.type];
      if (!value) return parts;
      if (!parts.length) return [value];

      const prev = template[index - 1];
      const omitHyphen =
        token.type === 'Date' &&
        prev?.type === 'CustomText' &&
        index - 1 === 0;

      const next = omitHyphen ? `${parts.pop() || ''}${value}` : value;
      return omitHyphen ? [...parts, next] : [...parts, value];
    }, [])
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
