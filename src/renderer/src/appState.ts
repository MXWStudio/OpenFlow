import { pinyin } from 'pinyin-pro';

export type TemplateKey = 'videoRegular' | 'videoSpecial' | 'imageRegular' | 'imageSpecial';
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
  defaultOutputDir: string;
  renameTemplates: Record<TemplateKey, TemplateToken[]>;
}

export interface UserInfo {
  name: string;
  department: string;
  email: string;
}

export interface ApiKeys {
  geminiKey: string;
  sdPath: string;
}

export interface HistoryEntry {
  id: number;
  project: string;
  count: number;
  status: 'success' | 'warning' | 'error';
  timestamp: number;
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
];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  videoRegular: '常规视频',
  videoSpecial: '创意视频',
  imageRegular: '常规图片',
  imageSpecial: '创意图片',
};

export const DEFAULT_USER_INFO: UserInfo = { name: '', department: '', email: '' };
export const DEFAULT_API_KEYS: ApiKeys = { geminiKey: '', sdPath: '' };
export const DEFAULT_WORKFLOW: WorkflowSettings = {
  defaultOutputDir: '',
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
      { type: 'CleanProjectName' },
      { type: 'CustomText', value: '激励时间' },
      { type: 'Date' },
      { type: 'AspectRatio' },
      { type: 'Producer' },
      { type: 'CustomText', value: 'RSQM' },
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

export function formatBytes(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getDirFromFilePath(filePath: string): string {
  const sep = filePath.includes('\\') ? '\\' : '/';
  const lastIdx = filePath.lastIndexOf(sep);
  return lastIdx > 0 ? filePath.slice(0, lastIdx) : filePath;
}

export function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

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

export function formatHistoryTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffMins < 24 * 60) return `${Math.floor(diffMins / 60)} 小时前`;
  return '昨天';
}
