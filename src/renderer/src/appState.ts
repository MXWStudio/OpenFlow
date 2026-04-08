import { pinyin } from 'pinyin-pro';
import { formatBytes, getDirFromFilePath, dedupeStrings, formatHistoryTime } from './utils';

export { formatBytes, getDirFromFilePath, dedupeStrings, formatHistoryTime };

export type TemplateKey = 'videoRegular' | 'videoSpecial' | 'imageRegular' | 'imageSpecial' | 'aiImage' | 'videoManual' | 'imageManual';
export type TokenType =
  | 'ProjectName'
  | 'CleanProjectName'
  | 'Date'
  | 'Producer'
  | 'Resolution'
  | 'AspectRatio'
  | 'Sequence'
  | 'OriginalName'
  | 'CustomText'
  | 'AiElement'
  | 'AiCategory';

export interface TemplateToken {
  type: TokenType;
  value?: string;
}

export interface WorkflowSettings {
  defaultOutputDir: string;
  renameTemplates: Record<TemplateKey, TemplateToken[]>;
  organizerSourceDir: string;
  organizerDestDir: string;
  organizerFormats: string[];
  screenshotShortcut: string;
}

export interface UserInfo {
  name: string;
  department: string;
  email: string;
}

export interface AiIntegrationSettings {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  systemPrompt: string;
}

export interface ApiKeys {
  geminiKey: string;
  sdPath: string;
  aiIntegration?: AiIntegrationSettings;
}

export interface SystemSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh' | 'en' | 'ja';
  autoStart: boolean;
  closeToTray: boolean;
  autoUpdate: boolean;
}

export interface WorkspaceSettings {
  sourceDir: string;
  destDir: string;
  duplicateAction: 'rename' | 'overwrite' | 'skip';
}

export interface ShortcutSettings {
  togglePanel: string;
  screenshot: string;
  pinImage: string;
}

export interface ProcessingSettings {
  imageFormat: 'original' | 'webp';
  imageQuality: number;
  videoCompressRate: 'high' | 'medium' | 'low';
  videoRemoveAudio: boolean;
  screenshotDir: string;
  screenshotShadow: boolean;
  screenshotRounded: boolean;
}

export interface DataStatsSettings {
  dataDir: string;
  includeWeekend: boolean;
  reportFormat: 'excel' | 'csv' | 'pdf';
}

export interface HistoryEntry {
  id: number;
  project: string;
  count: number;
  status: 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface GameMapping {
  id?: number;
  game_name: string;
  image_path: string;
  aliases: string[];
  created_at?: string;
  updated_at?: string;
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
  { value: 'AiElement', label: '画面元素(AI)' },
  { value: 'AiCategory', label: '游戏品类(AI)' },
];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  videoRegular: '常规视频',
  videoSpecial: '特殊版块',
  videoManual: '手搓命名',
  imageRegular: '常规图片',
  imageManual: '手搓图片',
  imageSpecial: '特殊版块',
  aiImage: 'AI识别命名',
};

export const DEFAULT_USER_INFO: UserInfo = { name: '', department: '', email: '' };
export const DEFAULT_API_KEYS: ApiKeys = {
  geminiKey: '',
  sdPath: '',
  aiIntegration: {
    apiBaseUrl: '',
    apiKey: '',
    modelName: '',
    systemPrompt: '请识别图片，提取“画面元素”和“游戏品类”，并严格按照“画面元素-游戏品类”的格式返回，不要包含其他任何文本。例如：橡皮人-射击',
  }
};
export const DEFAULT_SYSTEM: SystemSettings = {
  theme: 'auto',
  language: 'zh',
  autoStart: false,
  closeToTray: true,
  autoUpdate: true,
};
export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  sourceDir: '',
  destDir: '',
  duplicateAction: 'rename',
};
export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  togglePanel: 'CommandOrControl+Shift+Space',
  screenshot: 'F1',
  pinImage: 'F3',
};
export const DEFAULT_PROCESSING: ProcessingSettings = {
  imageFormat: 'original',
  imageQuality: 80,
  videoCompressRate: 'medium',
  videoRemoveAudio: false,
  screenshotDir: '',
  screenshotShadow: true,
  screenshotRounded: true,
};
export const DEFAULT_DATA_STATS: DataStatsSettings = {
  dataDir: '',
  includeWeekend: false,
  reportFormat: 'excel',
};
export const DEFAULT_WORKFLOW: WorkflowSettings = {
  defaultOutputDir: '',
  organizerSourceDir: '',
  organizerDestDir: '',
  organizerFormats: ['jpg', 'mp4'],
  screenshotShortcut: 'CommandOrControl+Shift+A',
  renameTemplates: {
    videoRegular: [
      { type: 'CustomText', value: 'RS' },
      { type: 'Date' },
      { type: 'ProjectName' },
      { type: 'Producer' },
      { type: 'CustomText', value: '奇作' },
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
    aiImage: [
      { type: 'AiElement' },
      { type: 'AiCategory' },
      { type: 'AspectRatio' },
      { type: 'Producer' },
    ],
  },
};


export function buildTemplatePreview(template: TemplateToken[], producerName: string): string {
  const producerAbbr = producerName
    ? pinyin(producerName, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toUpperCase()
    : 'MXW';

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
    AiElement: '橡皮人',
    AiCategory: '射击',
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
        (prev.value === 'RS' || prev.value === 'RSQ');

      const next = omitHyphen ? `${parts.pop() || ''}${value}` : value;
      return omitHyphen ? [...parts, next] : [...parts, value];
    }, [])
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

