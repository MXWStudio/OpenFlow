/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { createAvatar } from '@dicebear/core';
import * as dylan from '@dicebear/dylan';
import { 
  Rocket, 
  UploadCloud, 
  FolderPlus, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  CheckCircle2, 
  Check,
  Sparkles, 
  FolderTree,
  FileText,
  Play,
  Settings,
  Loader2,
  XCircle,
  AlertTriangle,
  Hourglass,
  Inbox,
  Globe,
  History,
  X,
  User,
  Monitor,
  Moon,
  Sun,
  Shield,
  Cpu,
  Workflow
} from 'lucide-react';

const PRESET_SIZES = [
  "1280*720", "720*1280", "1920*1080", "1080*1920", 
  "640*360", "1080*607", "1080*170", "900*900", 
  "1080*1620", "160*160", "512*512"
];

type LangKey = 'zh' | 'en' | 'ja';

const t = {
  zh: {
    projectInit: "项目需求配置",
    enterProjectName: "输入项目名称...",
    importJson: "导入需求 JSON",
    initFolder: "一键初始化目录",
    dimReq: "需求尺寸勾选",
    horizontalSquare: "横版 & 方形",
    vertical: "竖版",
    workspace: "你的工作区",
    dragDrop: "拖拽文件到这里，或 ",
    browse: "点击浏览",
    addFolder: "添加文件夹",
    clearAll: "清空列表",
    readyTitle: "准备就绪。",
    readySub: "工作区已初始化。将素材拖入上方区域以开始自动化流程。",
    startValidation: "开始校验",
    executeRename: "执行重命名",
    leadProducer: "首席制作人",
    dropFilesAnywhere: "拖拽文件到任意位置添加",
    releaseToAdd: "松开鼠标即可添加到工作区",
    showDetails: "显示详情",
    hideDetails: "隐藏详情",
    fileName: "文件名",
    folder: "文件夹",
    ext: "扩展名",
    size: "大小",
    status: "状态",
    noAssets: "暂无素材",
    dragDropFolders: "将文件夹拖拽到上方工作区开始校验。",
    validating: "校验中...",
    processing: "处理中...",
    jsonSuccess: "需求 JSON 解析成功！",
    jsonDesc: "已自动填入项目名和尺寸需求。",
    jsonError: "加载失败",
    jsonErrorDesc: "JSON 文件格式不正确，请检查后重试。",
    jsonImporting: "正在读取...",
    initFolderIncomplete: "信息不完整",
    initFolderIncompleteDesc: "请先导入需求 JSON 或确认已勾选尺寸。",
    initFolderSuccess: "目录初始化成功！",
    initFolderFail: "初始化失败",
    systemReady: "系统就绪",
    validatingWorkspace: "正在校验工作区...",
    allFilesValid: "所有文件校验通过！",
    analyzingFiles: "正在分析文件尺寸和格式...",
    assetsValidated: "您的素材已成功校验，准备重命名。",
    valid: "有效",
    pending: "等待中",
    error: "错误",
    warning: "警告",
    historyTitle: "最近项目",
    emptyHistory: "暂无历史记录",
    timeMinsAgo: "分钟前",
    timeHoursAgo: "小时前",
    timeYesterday: "昨天",
    actionRenamed: "重命名了",
    actionValidated: "校验了",
    files: "个文件",
    // Settings
    settings: "设置",
    tabAccount: "账户配置",
    tabWorkflow: "工作流预设",
    tabIntegrations: "AI 集成",
    tabAdvanced: "高级系统",
    name: "姓名",
    department: "部门",
    email: "邮箱地址",
    saveChanges: "保存更改",
    defaultOutputDir: "默认输出目录",
    nameTemplate: "重命名模板公式",
    apiKeys: "API 密钥配置",
    geminiKey: "Gemini API 密钥",
    sdPath: "Stable Diffusion 本地路径",
    clearCache: "清理系统缓存",
    exportLogs: "导出错误日志",
    versionInfo: "版本信息",
    profileInfo: "个人信息",
    interfaceTheme: "界面主题",
    light: "浅色",
    dark: "深色",
    system: "跟随系统",
    accountDesc: "管理您的个人信息和偏好设置。",
    workflowDesc: "配置您的自动化工作流预设。",
    integrationsDesc: "管理外部服务和 AI 模型集成。",
    advancedDesc: "系统级配置和危险操作区。",
    // 校验模块
    workspaceEmpty: "工作区为空",
    workspaceEmptyDesc: "请先拖入或添加需要校验的素材文件夹。",
    noSizeSelected: "未选择尺寸",
    noSizeSelectedDesc: "请先在左侧勾选或导入目标需求尺寸。",
    validationPassed: "校验通过",
    validationPassedDesc: "所有素材尺寸匹配，准备执行重命名。",
    validationFailed: "校验异常",
    validationFailedDesc: "请检查底部表格的标红项。",
    validationHasIssues: "项素材存在问题",
    validationError: "校验出错",
    validationErrorDesc: "校验过程发生意外错误，请重试。",
    statusMismatch: "尺寸不符",
    statusMissing: "缺失",
    folderAdded: "文件夹已添加",
    foldersAddedDesc: "个项目已加入工作区",
    workspaceCleared: "工作区已清空",
    dimensions: "尺寸",
    fileSize: "文件大小",
    // 重命名模块
    renameRejected: "操作被拒绝",
    renameRejectedDesc: "存在不符合规则的文件，无法执行重命名。",
    renameSuccess: "重命名完成！",
    renameSuccessPrefix: "成功处理了",
    renameSuccessSuffix: "个文件。",
    renamePartialFail: "重命名部分失败",
    renamePartialFailDesc: "请检查原文件是否被其他程序占用。",
    timeJustNow: "刚刚",
    // 设置面板
    settingsSaved: "设置已保存",
    settingsSavedDesc: "所有配置已成功保存到本地。",
    cacheCleared: "缓存已清理",
    logExported: "日志已导出",
  },
  en: {
    projectInit: "PROJECT INITIALIZATION",
    enterProjectName: "Enter Project Name...",
    importJson: "Import JSON",
    initFolder: "Init Folders",
    dimReq: "DIMENSION REQUIREMENTS",
    horizontalSquare: "Horizontal & Square",
    vertical: "Vertical",
    workspace: "Your Workspace",
    dragDrop: "Drag & drop your files here, or ",
    browse: "browse",
    addFolder: "Add Folder",
    clearAll: "Clear All",
    readyTitle: "Ready to work.",
    readySub: "Workspace is initialized. Drop your assets above to begin the automated workflow.",
    startValidation: "Start Validation",
    executeRename: "Execute Rename",
    leadProducer: "Lead Producer",
    dropFilesAnywhere: "Drop files anywhere to add",
    releaseToAdd: "Release to instantly add them to your workspace",
    showDetails: "Show Details",
    hideDetails: "Hide Details",
    fileName: "File Name",
    folder: "Folder",
    ext: "Ext",
    size: "Size",
    status: "Status",
    noAssets: "No assets yet",
    dragDropFolders: "Drag and drop your folders into the workspace above to start validating.",
    validating: "Validating Assets...",
    processing: "Processing...",
    jsonSuccess: "JSON parsed successfully!",
    jsonDesc: "Project name and dimensions auto-filled.",
    jsonError: "Load Failed",
    jsonErrorDesc: "Invalid JSON format. Please check the file and try again.",
    jsonImporting: "Reading...",
    initFolderIncomplete: "Incomplete info",
    initFolderIncompleteDesc: "Please import requirement JSON or confirm selected sizes.",
    initFolderSuccess: "Folders initialized successfully!",
    initFolderFail: "Initialization failed",
    systemReady: "System Ready",
    validatingWorkspace: "Validating your workspace...",
    allFilesValid: "All files are valid!",
    analyzingFiles: "Analyzing file dimensions and formats...",
    assetsValidated: "Your assets have been successfully validated and are ready for renaming.",
    valid: "Valid",
    pending: "Pending",
    error: "Error",
    warning: "Warning",
    historyTitle: "Recent Projects",
    emptyHistory: "No recent history",
    timeMinsAgo: "mins ago",
    timeHoursAgo: "hours ago",
    timeYesterday: "Yesterday",
    actionRenamed: "Renamed",
    actionValidated: "Validated",
    files: "files",
    // Settings
    settings: "Settings",
    tabAccount: "Account",
    tabWorkflow: "Workflows",
    tabIntegrations: "Integrations",
    tabAdvanced: "Advanced",
    name: "Name",
    department: "Department",
    email: "Email Address",
    saveChanges: "Save Changes",
    defaultOutputDir: "Default Output Directory",
    nameTemplate: "Naming Convention Template",
    apiKeys: "API Keys Configuration",
    geminiKey: "Gemini API Key",
    sdPath: "Stable Diffusion Local Path",
    clearCache: "Clear System Cache",
    exportLogs: "Export Error Logs",
    versionInfo: "Version Info",
    profileInfo: "Profile Information",
    interfaceTheme: "Interface Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    accountDesc: "Manage your personal information and preferences.",
    workflowDesc: "Configure your automated workflow presets.",
    integrationsDesc: "Manage external services and AI models.",
    advancedDesc: "System-level configurations and danger zone.",
    // Validation module
    workspaceEmpty: "Workspace Empty",
    workspaceEmptyDesc: "Please drag or add asset folders to validate first.",
    noSizeSelected: "No Size Selected",
    noSizeSelectedDesc: "Please check or import target sizes on the left panel.",
    validationPassed: "Validation Passed",
    validationPassedDesc: "All assets match the target sizes. Ready to rename.",
    validationFailed: "Validation Issues Found",
    validationFailedDesc: "Check the highlighted rows in the table below.",
    validationHasIssues: "assets have issues",
    validationError: "Validation Error",
    validationErrorDesc: "An unexpected error occurred during validation. Please retry.",
    statusMismatch: "Mismatch",
    statusMissing: "Missing",
    folderAdded: "Folder Added",
    foldersAddedDesc: "items added to workspace",
    workspaceCleared: "Workspace cleared",
    dimensions: "Dimensions",
    fileSize: "File Size",
    // Rename module
    renameRejected: "Operation Rejected",
    renameRejectedDesc: "Non-conforming files exist. Cannot execute rename.",
    renameSuccess: "Rename Complete!",
    renameSuccessPrefix: "Successfully processed",
    renameSuccessSuffix: "files.",
    renamePartialFail: "Rename Partially Failed",
    renamePartialFailDesc: "Some files may be locked by another process.",
    timeJustNow: "Just now",
    // Settings panel
    settingsSaved: "Settings Saved",
    settingsSavedDesc: "All configurations have been saved to local storage.",
    cacheCleared: "Cache cleared",
    logExported: "Logs exported",
  },
  ja: {
    projectInit: "プロジェクト初期化",
    enterProjectName: "プロジェクト名を入力...",
    importJson: "JSONをインポート",
    initFolder: "フォルダを初期化",
    dimReq: "サイズ要件",
    horizontalSquare: "横長 & 正方形",
    vertical: "縦長",
    workspace: "ワークスペース",
    dragDrop: "ファイルをここにドラッグ＆ドロップ、または ",
    browse: "参照",
    addFolder: "フォルダ追加",
    clearAll: "すべてクリア",
    readyTitle: "準備完了。",
    readySub: "ワークスペースが初期化されました。素材をドロップして開始してください。",
    startValidation: "検証を開始",
    executeRename: "リネームを実行",
    leadProducer: "リードプロデューサー",
    dropFilesAnywhere: "どこでもファイルをドロップして追加",
    releaseToAdd: "ドロップしてワークスペースに追加",
    showDetails: "詳細を表示",
    hideDetails: "詳細を隠す",
    fileName: "ファイル名",
    folder: "フォルダ",
    ext: "拡張子",
    size: "サイズ",
    status: "ステータス",
    noAssets: "アセットがありません",
    dragDropFolders: "上のワークスペースにフォルダをドラッグ＆ドロップして検証を開始します。",
    validating: "検証中...",
    processing: "処理中...",
    jsonSuccess: "JSONの解析に成功しました！",
    jsonDesc: "プロジェクト名とサイズ要件が自動入力されました。",
    jsonError: "読み込み失敗",
    jsonErrorDesc: "JSONファイルの形式が正しくありません。確認してから再試行してください。",
    jsonImporting: "読み込み中...",
    initFolderIncomplete: "情報が不足しています",
    initFolderIncompleteDesc: "要件 JSON をインポートするか、サイズを選択してください。",
    initFolderSuccess: "フォルダの初期化に成功しました！",
    initFolderFail: "初期化に失敗しました",
    systemReady: "システム準備完了",
    validatingWorkspace: "ワークスペースを検証中...",
    allFilesValid: "すべてのファイルが有効です！",
    analyzingFiles: "ファイルのサイズと形式を分析中...",
    assetsValidated: "アセットの検証が完了し、リネームの準備ができました。",
    valid: "有効",
    pending: "保留中",
    error: "エラー",
    warning: "警告",
    historyTitle: "最近のプロジェクト",
    emptyHistory: "履歴がありません",
    timeMinsAgo: "分前",
    timeHoursAgo: "時間前",
    timeYesterday: "昨日",
    actionRenamed: "名前を変更:",
    actionValidated: "検証完了:",
    files: "ファイル",
    // Settings
    settings: "設定",
    tabAccount: "アカウント",
    tabWorkflow: "ワークフロー",
    tabIntegrations: "AI 統合",
    tabAdvanced: "高度なシステム",
    name: "名前",
    department: "部署",
    email: "メールアドレス",
    saveChanges: "変更を保存",
    defaultOutputDir: "デフォルト出力ディレクトリ",
    nameTemplate: "命名規則テンプレート",
    apiKeys: "API キー設定",
    geminiKey: "Gemini API キー",
    sdPath: "Stable Diffusion ローカルパス",
    clearCache: "システムキャッシュをクリア",
    exportLogs: "エラーログをエクスポート",
    versionInfo: "バージョン情報",
    profileInfo: "プロフィール情報",
    interfaceTheme: "インターフェーステーマ",
    light: "ライト",
    dark: "ダーク",
    system: "システム",
    accountDesc: "個人情報と設定を管理します。",
    workflowDesc: "自動化ワークフローのプリセットを設定します。",
    integrationsDesc: "外部サービスとAIモデルを管理します。",
    advancedDesc: "システムレベルの設定と危険な操作。",
    // 検証モジュール
    workspaceEmpty: "ワークスペースが空",
    workspaceEmptyDesc: "検証する素材フォルダをドラッグまたは追加してください。",
    noSizeSelected: "サイズ未選択",
    noSizeSelectedDesc: "左パネルでターゲットサイズを選択またはインポートしてください。",
    validationPassed: "検証完了",
    validationPassedDesc: "すべての素材がターゲットサイズと一致しています。リネームの準備完了。",
    validationFailed: "検証に問題があります",
    validationFailedDesc: "下のテーブルでハイライトされた行を確認してください。",
    validationHasIssues: "件の素材に問題があります",
    validationError: "検証エラー",
    validationErrorDesc: "検証中に予期しないエラーが発生しました。再試行してください。",
    statusMismatch: "サイズ不一致",
    statusMissing: "欠損",
    folderAdded: "フォルダを追加しました",
    foldersAddedDesc: "個の項目が追加されました",
    workspaceCleared: "ワークスペースをクリアしました",
    dimensions: "サイズ",
    fileSize: "ファイルサイズ",
    // リネームモジュール
    renameRejected: "操作を拒否しました",
    renameRejectedDesc: "規則に適合しないファイルがあります。リネームを実行できません。",
    renameSuccess: "リネーム完了！",
    renameSuccessPrefix: "正常に処理しました",
    renameSuccessSuffix: "個のファイル。",
    renamePartialFail: "リネームが一部失敗しました",
    renamePartialFailDesc: "ファイルが他のプロセスに使用されている可能性があります。",
    timeJustNow: "今",
    // 設定パネル
    settingsSaved: "設定を保存しました",
    settingsSavedDesc: "すべての設定がローカルに正常に保存されました。",
    cacheCleared: "キャッシュをクリアしました",
    logExported: "ログをエクスポートしました",
  }
};

type StatusType = 'valid' | 'pending' | 'error' | 'warning' | 'mismatch' | 'missing';

const StatusTag = ({ type, language }: { type: StatusType; language: LangKey }) => {
  switch (type) {
    case 'valid':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 text-green-700 text-xs font-bold">
          <CheckCircle2 size={12} /> {t[language].valid}
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
          <Hourglass size={12} /> {t[language].pending}
        </span>
      );
    case 'mismatch':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 text-xs font-bold">
          <AlertTriangle size={12} /> {t[language].statusMismatch}
        </span>
      );
    case 'missing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold">
          <XCircle size={12} /> {t[language].statusMissing}
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold">
          <XCircle size={12} /> {t[language].error}
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-100 text-yellow-700 text-xs font-bold">
          <AlertTriangle size={12} /> {t[language].warning}
        </span>
      );
    default:
      return null;
  }
};

/** 历史记录条目 */
interface HistoryEntry {
  id: number;
  project: string;
  timeValue: number | null;
  timeUnit: string;
  action: string;
  count: number;
  status: 'success' | 'warning' | 'error';
  timestamp: number;
}

/** 本地复用类型：与主进程 ValidationResult 对齐 */
interface ValidationResult {
  fileName: string;    // 纯文件名（不含扩展名）
  filePath: string;    // 完整路径
  folderName: string;  // 直接父级文件夹名
  ext: string;         // 扩展名含点，如 .mp4
  fileSize: number;
  actualWidth: number;
  actualHeight: number;
  duration?: number;
  status: 'valid' | 'mismatch' | 'missing' | 'error';
  targetSize?: string;
  error?: string;
}

/** 格式化字节为可读字符串 */
function formatBytes(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 从文件路径提取其所在文件夹路径（Renderer 无 Node path，纯 JS 实现） */
function getDirFromFilePath(filePath: string): string {
  const sep = filePath.includes('\\') ? '\\' : '/';
  const lastIdx = filePath.lastIndexOf(sep);
  return lastIdx > 0 ? filePath.slice(0, lastIdx) : filePath;
}

const DEFAULT_USER_INFO = { name: '', department: '', email: '' };
const DEFAULT_WORKFLOW = { defaultOutputDir: '', renameTemplate: '[Project]-[Name]-[Size]' };
const DEFAULT_API_KEYS = { geminiKey: '', sdPath: '' };

export default function App() {
  // 应用初始化完成前显示极短 Loading，避免数据闪烁
  const [isAppReady, setIsAppReady] = useState(false);

  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const dragCounter = useRef(0);

  // 工作区：用户添加的素材文件夹路径列表
  const [folderPaths, setFolderPaths] = useState<string[]>([]);

  // 校验引擎：真实结果列表
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

  // 语言（从 Store 初始化）
  const [language, setLanguage] = useState<LangKey>('zh');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const languages: { key: LangKey; name: string; icon: string }[] = [
    { key: 'zh', name: '中文', icon: '🔴' },
    { key: 'en', name: 'English', icon: '🇬🇧' },
    { key: 'ja', name: '日本語', icon: '🇯🇵' }
  ];

  const handleLanguageChange = (langKey: LangKey) => {
    setLanguage(langKey);
    setIsLangMenuOpen(false);
    window.electronAPI.store.set('language', langKey); // 静默持久化语言偏好
    toast.success(`Language switched to ${languages.find(l => l.key === langKey)?.name}`);
  };

  // Form State
  const [projectName, setProjectName] = useState('');
  const [producerName, setProducerName] = useState('MXW');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['1920*1080', '1080*1920']);
  /** 从 JSON 解析出的多项目列表，用于批量初始化目录 */
  const [projectsList, setProjectsList] = useState<Array<{ projectName: string; sizes: string[] }>>([]);

  // 历史记录（从 Store 加载）
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);

  // 设置面板状态（从 Store 加载，无则用兜底默认值）
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [userInfo, setUserInfo] = useState(DEFAULT_USER_INFO);
  const [workflowSettings, setWorkflowSettings] = useState(DEFAULT_WORKFLOW);
  const [apiKeys, setApiKeys] = useState(DEFAULT_API_KEYS);

  // 应用启动时从本地 Store 加载全部配置，避免渲染时数据闪烁
  useEffect(() => {
    window.electronAPI.store.getAll().then((config) => {
      if (!config) return;
      if (config.userInfo && typeof config.userInfo === 'object') {
        const u = config.userInfo as Record<string, string>;
        setUserInfo({
          name: u.name ?? DEFAULT_USER_INFO.name,
          department: u.department ?? DEFAULT_USER_INFO.department,
          email: u.email ?? DEFAULT_USER_INFO.email,
        });
      }
      if (config.workflow && typeof config.workflow === 'object') {
        const w = config.workflow as Record<string, string>;
        setWorkflowSettings({
          defaultOutputDir: w.defaultOutputDir ?? w.defaultOutputPath ?? DEFAULT_WORKFLOW.defaultOutputDir,
          renameTemplate: w.renameTemplate ?? DEFAULT_WORKFLOW.renameTemplate,
        });
      }
      // 兼容扁平 key：renameTemplate、defaultOutputDir 可能单独存储
      const rt = config.renameTemplate as string | undefined;
      const dod = config.defaultOutputDir as string | undefined;
      if (rt) setWorkflowSettings((p) => ({ ...p, renameTemplate: rt }));
      if (dod) setWorkflowSettings((p) => ({ ...p, defaultOutputDir: dod }));

      if (config.apiKeys && typeof config.apiKeys === 'object') {
        const a = config.apiKeys as Record<string, string>;
        setApiKeys({
          geminiKey: a.geminiKey ?? a.gemini ?? DEFAULT_API_KEYS.geminiKey,
          sdPath: a.sdPath ?? a.stableDiffusion ?? DEFAULT_API_KEYS.sdPath,
        });
      }
      if (config.language && ['zh', 'en', 'ja'].includes(config.language as string)) {
        setLanguage(config.language as LangKey);
      }
      if (config.history && Array.isArray(config.history) && config.history.length > 0) {
        setHistoryData(config.history as HistoryEntry[]);
      }
    }).catch(() => {/* 首次启动，静默忽略 */}).finally(() => {
      setIsAppReady(true);
    });
  }, []);

  // JSON 导入加载状态
  const [isImportingJson, setIsImportingJson] = useState(false);

  /**
   * 调用 Electron 原生文件选择框读取需求 JSON
   * 替代原来的 FileReader Web API 方案
   */
  const handleImportJson = async () => {
    setIsImportingJson(true);
    try {
      const result = await window.electronAPI.dialog.openJson();

      // 用户在系统弹窗中点了"取消"，静默返回
      if (!result) return;

      // 保存完整项目列表，供【一键初始化目录】使用；不修改左侧尺寸勾选（尺寸勾选仅用于校验/重命名）
      const projects = (result as { projects?: Array<{ projectName: string; sizes: string[] }> }).projects;
      if (Array.isArray(projects) && projects.length > 0) {
        setProjectsList(projects);
      } else {
        setProjectsList([]);
      }

      // 仅更新项目名输入框展示（可选）；绝不自动修改 selectedSizes
      if (result.projectName) {
        setProjectName(result.projectName);
      }

      toast.success(t[language].jsonSuccess, { description: t[language].jsonDesc });
    } catch {
      toast.error(t[language].jsonError, { description: t[language].jsonErrorDesc });
    } finally {
      setIsImportingJson(false);
    }
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  /**
   * 开始校验：前置拦截 → 骨架屏 → 真实 IPC 调用 → 结果渲染
   */
  const handleValidate = async () => {
    // 前置拦截：工作区为空
    if (folderPaths.length === 0) {
      toast.warning(t[language].workspaceEmpty, { description: t[language].workspaceEmptyDesc });
      return;
    }
    // 前置拦截：未勾选任何目标尺寸
    if (selectedSizes.length === 0) {
      toast.warning(t[language].noSizeSelected, { description: t[language].noSizeSelectedDesc });
      return;
    }

    setIsValidating(true);
    setIsTableExpanded(true);
    setHasValidated(false);
    setValidationResults([]);

    try {
      // 逐文件夹调用校验引擎，合并结果
      const allResults: ValidationResult[] = [];
      for (const folderPath of folderPaths) {
        const results = await window.electronAPI.fs.startValidation(folderPath, selectedSizes);
        allResults.push(...(results as ValidationResult[]));
      }

      setValidationResults(allResults);
      setHasValidated(true);

      const issueCount = allResults.filter((r) => r.status !== 'valid').length;
      if (issueCount === 0) {
        toast.success(t[language].validationPassed, { description: t[language].validationPassedDesc });
      } else {
        toast.error(t[language].validationFailed, {
          description: `${issueCount} ${t[language].validationHasIssues}，${t[language].validationFailedDesc}`,
        });
      }
    } catch {
      toast.error(t[language].validationError, { description: t[language].validationErrorDesc });
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * 通过系统对话框选择并添加文件夹到工作区
   */
  const handleAddFolder = async () => {
    const folderPath = await window.electronAPI.dialog.selectFolder();
    if (!folderPath) return;
    setFolderPaths((prev) => (prev.includes(folderPath) ? prev : [...prev, folderPath]));
    try {
      const detectedSizes = await window.electronAPI.fs.readProjectSizes([folderPath]) as string[] | undefined;
      if (Array.isArray(detectedSizes) && detectedSizes.length > 0) {
        setSelectedSizes(detectedSizes);
      }
    } catch {
      // 读取失败不影响添加文件夹，仅不自动勾选尺寸
    }
    toast.success(t[language].folderAdded, { description: folderPath });
  };

  /**
   * 清空工作区：文件夹列表、校验结果、尺寸勾选、项目名一并重置，
   * 让软件彻底回到"刚打开"的初始状态
   */
  const handleClearAll = () => {
    setFolderPaths([]);
    setValidationResults([]);
    setHasValidated(false);
    setSelectedSizes([]);
    setProjectName('');
    setProjectsList([]);
    toast.info(t[language].workspaceCleared);
  };

  /**
   * 一键初始化目录：使用 JSON 解析出的 projectsList 批量生成多项目文件夹结构。
   * 项目列表为空时拦截并提示。
   */
  const handleInitFolders = async () => {
    if (!projectsList.length) {
      toast.warning(t[language].initFolderIncomplete, {
        description: t[language].initFolderIncompleteDesc,
      });
      return;
    }

    try {
      const res = await window.electronAPI.fs.initFolders(projectsList) as { success: boolean; destPath?: string; error?: string };
      if (res?.success && res.destPath) {
        toast.success(t[language].initFolderSuccess, { description: res.destPath });
      } else {
        toast.error(t[language].initFolderFail, { description: res?.error });
      }
    } catch {
      toast.error(t[language].initFolderFail);
    }
  };

  /**
   * 执行重命名：安全锁 → 读取模板 → 真实 IPC → 结果处理 → 历史联动 → 工作区重置
   */
  const handleRename = async () => {
    // 最后一道安全锁：防止非法调用
    if (!canRename) {
      toast.error(t[language].renameRejected, { description: t[language].renameRejectedDesc });
      return;
    }

    setIsRenaming(true);

    try {
      // 从 Store 读取用户配置的重命名模板，兜底默认值
      const storedTemplate = await window.electronAPI.store.get<string>('renameTemplate');
      const currentTemplate = (typeof storedTemplate === 'string' && storedTemplate)
        ? storedTemplate
        : '[Project]-[Name]-[Size]';

      // 仅传 valid 状态的文件给主进程
      const validFiles = validationResults.filter((r) => r.status === 'valid');

      const results = await window.electronAPI.fs.executeRename(
        validFiles,
        currentTemplate,
        projectName,
        producerName
      ) as Array<{ oldFileName: string; newFileName: string; success: boolean; error?: string }>;

      const successCount = results.filter((r) => r.success).length;
      const failedResults = results.filter((r) => !r.success);

      if (failedResults.length === 0) {
        // 全部成功
        toast.success(t[language].renameSuccess, {
          description: `${t[language].renameSuccessPrefix} ${successCount} ${t[language].renameSuccessSuffix}`,
        });
      } else {
        // 部分失败：展示首条错误原因
        const firstError = failedResults[0]?.error || '';
        toast.error(t[language].renamePartialFail, {
          description: `${t[language].renamePartialFailDesc}${firstError ? `（${firstError}）` : ''}`,
        });
      }

      if (successCount > 0) {
        // 构造本次操作的历史记录条目
        const newEntry: HistoryEntry = {
          id: Date.now(),
          project: projectName || 'Untitled Project',
          timeValue: null,
          timeUnit: 'timeJustNow',
          action: 'actionRenamed',
          count: successCount,
          status: failedResults.length === 0 ? 'success' : 'warning',
          timestamp: Date.now(),
        };

        // 最多保留 20 条，旧记录自动淘汰
        const updatedHistory = [newEntry, ...historyData].slice(0, 20);
        setHistoryData(updatedHistory);

        // 持久化到本地 Store（下次启动仍可见）
        await window.electronAPI.store.set('history', updatedHistory);

        // 清空工作区，恢复初始状态，迎接下一批任务
        setFolderPaths([]);
        setValidationResults([]);
        setHasValidated(false);
      }
    } catch {
      toast.error(t[language].renamePartialFail, {
        description: t[language].renamePartialFailDesc,
      });
    } finally {
      setIsRenaming(false);
    }
  };

  /**
   * 保存设置：持久化到 Store + 更新 React State + 关闭弹窗
   */
  const handleSaveSettings = async () => {
    try {
      await window.electronAPI.store.set('userInfo', userInfo);
      await window.electronAPI.store.set('renameTemplate', workflowSettings.renameTemplate);
      await window.electronAPI.store.set('defaultOutputDir', workflowSettings.defaultOutputDir);
      await window.electronAPI.store.set('apiKeys', apiKeys);
      await window.electronAPI.store.set('language', language);

      toast.success(t[language].settingsSaved, { description: t[language].settingsSavedDesc });
      setShowSettings(false);
    } catch {
      toast.error(t[language].jsonError, { description: t[language].jsonErrorDesc });
    }
  };

  /**
   * 清理系统缓存：清空历史记录
   */
  const handleClearCache = async () => {
    await window.electronAPI.store.delete('history');
    setHistoryData([]);
    toast.success(t[language].cacheCleared);
  };

  /**
   * 导出错误日志：主进程弹窗另存为
   */
  const handleExportLogs = async () => {
    const result = await window.electronAPI.dialog.exportLogs();
    if (result?.success && result.path) {
      toast.success(t[language].logExported, { description: result.path });
    }
  };

  // 将 PRESET_SIZES 与当前 selectedSizes 合并（去重），确保 JSON 导入的非预设尺寸也能显示胶囊
  const allDisplaySizes = useMemo(() => {
    const merged = [...new Set([...PRESET_SIZES, ...selectedSizes])];
    return merged;
  }, [selectedSizes]);

  const horizontalSizes = useMemo(() => allDisplaySizes.filter(size => {
    const [w, h] = size.split('*').map(Number);
    return w >= h;
  }), [allDisplaySizes]);

  const verticalSizes = useMemo(() => allDisplaySizes.filter(size => {
    const [w, h] = size.split('*').map(Number);
    return w < h;
  }), [allDisplaySizes]);

  const avatarSrc = useMemo(() => {
    return createAvatar(dylan, {
      seed: userInfo.name || 'MXW',
      backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf']
    }).toDataUri();
  }, [userInfo.name]);

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingGlobally(true);
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDraggingGlobally(false);
    }
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingGlobally(false);
    // Electron 为 File 对象注入 .path 属性；拖入文件夹时会得到其内所有文件的路径，需提取父目录
    const filePaths = Array.from(e.dataTransfer.files)
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p));
    const folderPathsToAdd = [...new Set(filePaths.map(getDirFromFilePath))];
    if (folderPathsToAdd.length > 0) {
      setFolderPaths((prev) => [...new Set([...prev, ...folderPathsToAdd])]);
      (async () => {
        try {
          const detectedSizes = await window.electronAPI.fs.readProjectSizes(folderPathsToAdd) as string[] | undefined;
          if (Array.isArray(detectedSizes) && detectedSizes.length > 0) {
            setSelectedSizes(detectedSizes);
          }
        } catch {
          // 读取失败仅不自动勾选尺寸
        }
      })();
      toast.success(`${folderPathsToAdd.length} ${t[language].foldersAddedDesc}`);
    }
  };

  // ── 计算属性 ──────────────────────────────────────────
  // 是否有校验问题（用于中心卡片和重命名按钮）
  const validIssueCount = validationResults.filter((r) => r.status !== 'valid').length;
  const hasIssues = hasValidated && validIssueCount > 0;
  // 只有全部 valid 才允许执行重命名
  const canRename = hasValidated && validationResults.length > 0 && !hasIssues;

  // 初始化完成前显示极短 Loading，避免数据闪烁
  if (!isAppReady) {
    return (
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden relative"
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      <Toaster richColors position="top-center" />
      
      <AnimatePresence>
        {isDraggingGlobally && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-blue-400 m-4 rounded-3xl z-50 pointer-events-none"
          >
            <div className="p-6 bg-blue-50 rounded-full mb-6 animate-bounce shadow-sm">
              <UploadCloud size={64} className="text-blue-500" strokeWidth={1.5} />
            </div>
            <h2 className="text-4xl font-extrabold text-slate-800 tracking-tight">
              Drop files anywhere to add
            </h2>
            <p className="text-slate-500 mt-4 font-medium text-lg">
              Release to instantly add them to your workspace
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= 左侧边栏 (Left Sidebar) ================= */}
      <aside className="w-[320px] flex-shrink-0 bg-white border-r border-slate-100 flex flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={language}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Logo Area */}
            <div className="px-6 py-8 flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-sm">
            <Rocket size={20} className="fill-current" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            OpenFlow Studio
          </span>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8 custom-scrollbar">
          
          {/* Project Initialization */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {t[language].projectInit}
            </h3>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={t[language].enterProjectName} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all text-sm font-medium placeholder:text-slate-400" 
              />
              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={handleImportJson}
                  disabled={isImportingJson}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isImportingJson ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {isImportingJson ? t[language].jsonImporting : t[language].importJson}
                </button>
                <button
                  type="button"
                  onClick={handleInitFolders}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <FolderTree size={16} />
                  {t[language].initFolder}
                </button>
              </div>
            </div>
          </section>

          {/* Dimension Requirements */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {t[language].dimReq}
            </h3>
            
            {/* Horizontal & Square Group */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {t[language].horizontalSquare}
              </h4>
              <motion.div 
                className="grid grid-cols-2 gap-3"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              >
                {horizontalSizes.map((dim) => (
                  <motion.div key={dim} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
                    <label className="relative block w-full">
                      <input 
                        type="checkbox" 
                        checked={selectedSizes.includes(dim)}
                        onChange={() => toggleSize(dim)}
                        className="peer hidden" 
                      />
                      <div className="w-full py-2.5 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 cursor-pointer hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm select-none peer-checked:bg-slate-900 peer-checked:border-slate-900 peer-checked:text-white peer-checked:shadow-inner active:scale-95">
                        {dim}
                      </div>
                    </label>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Vertical Group */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {t[language].vertical}
              </h4>
              <motion.div 
                className="grid grid-cols-2 gap-3"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              >
                {verticalSizes.map((dim) => (
                  <motion.div key={dim} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
                    <label className="relative block w-full">
                      <input 
                        type="checkbox" 
                        checked={selectedSizes.includes(dim)}
                        onChange={() => toggleSize(dim)}
                        className="peer hidden" 
                      />
                      <div className="w-full py-2.5 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 cursor-pointer hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm select-none peer-checked:bg-slate-900 peer-checked:border-slate-900 peer-checked:text-white peer-checked:shadow-inner active:scale-95">
                        {dim}
                      </div>
                    </label>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        </div>

        {/* Footer: User Profile Card */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <div className="relative overflow-hidden rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group bg-gradient-to-br from-rose-200 via-orange-100 to-indigo-200">
            {/* Settings Icon (Hover) */}
            <Settings className="absolute top-4 right-4 w-4 h-4 text-slate-700/50 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:text-slate-900 hover:rotate-90" />

            {/* Avatar */}
            <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white">
              <img 
                src={avatarSrc} 
                alt="MXW Avatar" 
                referrerPolicy="no-referrer" 
                className="w-full h-full object-cover" 
              />
            </div>
            
            {/* Floating Info Card */}
            <div className="mt-3 bg-white/95 backdrop-blur-sm rounded-xl p-3 pr-6 shadow-sm">
              <div className="text-sm font-extrabold text-slate-800 truncate">{userInfo.name}</div>
              <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">{userInfo.department}</div>
            </div>
          </div>
        </div>
          </motion.div>
        </AnimatePresence>
      </aside>

      {/* ================= 右侧主工作区 (Right Main Area) ================= */}
      <main className="flex-1 h-full flex flex-col overflow-hidden relative">
        
        {/* Fixed Header Title */}
        <header className="px-8 pt-8 pb-2 flex-shrink-0 w-full max-w-5xl flex justify-between items-center relative z-20">
          <AnimatePresence mode="wait">
            <motion.h1 
              key={language}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="text-2xl font-extrabold text-slate-900 tracking-tight"
            >
              {t[language].workspace}
            </motion.h1>
          </AnimatePresence>
          
          <div className="flex items-center gap-2">
            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-100 transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-slate-500" />
            </button>

            {/* History Switcher */}
            <div className="relative">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-100 transition-colors"
                title={t[language].historyTitle}
              >
                <History className="w-5 h-5 text-slate-500" />
              </button>
              
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    key={language}
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute top-12 right-0 w-80 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-4 z-50"
                  >
                    <h3 className="text-sm font-bold text-slate-800 mb-3 px-2">{t[language].historyTitle}</h3>
                    {historyData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <History className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-xs font-medium">{t[language].emptyHistory}</p>
                      </div>
                    ) : (
                      <motion.ul 
                        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                        initial="hidden"
                        animate="visible"
                        className="flex flex-col gap-1"
                      >
                        {historyData.map((item) => (
                          <motion.li
                            key={item.id}
                            variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                            whileHover={{ x: 4, backgroundColor: "rgba(241, 245, 249, 1)" }}
                            className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors"
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              item.status === 'success' ? 'bg-green-500' : item.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{item.project}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {t[language][item.action as keyof typeof t[LangKey]]} {item.count} {t[language].files}
                              </p>
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              {item.timeValue ? `${item.timeValue} ` : ''}
                              {t[language][item.timeUnit as keyof typeof t[LangKey]]}
                            </span>
                          </motion.li>
                        ))}
                      </motion.ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language Switcher */}
            <div className="relative">
              <button 
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Globe className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-medium text-slate-500">{languages.find(l => l.key === language)?.name}</span>
              </button>
              
              <AnimatePresence>
                {isLangMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }}
                    exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.15 } }}
                    className="absolute top-12 right-0 bg-white p-2 rounded-2xl shadow-lg border border-slate-100 z-50 flex flex-col gap-1 min-w-[120px]"
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.key}
                        onClick={() => handleLanguageChange(lang.key)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-slate-100 hover:translate-x-1 ${language === lang.key ? 'text-slate-900 bg-slate-50' : 'text-slate-600'}`}
                      >
                        <span>{lang.icon}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <div className="flex-1 flex flex-col overflow-y-auto px-8 pb-8 gap-6 custom-scrollbar relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={language}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex flex-col gap-6"
            >
              {/* Top Drag Area */}
              <section className="w-full max-w-5xl flex-shrink-0">
            <div 
              role="button"
              tabIndex={0}
              className={`w-full py-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group shadow-sm ${isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 bg-white'}`}
              onDragEnter={() => setIsDragActive(true)}
              onDragLeave={() => setIsDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => handleAddFolder()}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragActive(false);
                const filePaths = Array.from(e.dataTransfer.files)
                  .map((f) => (f as File & { path?: string }).path)
                  .filter((p): p is string => Boolean(p));
                const folderPathsToAdd = [...new Set(filePaths.map(getDirFromFilePath))];
                if (folderPathsToAdd.length > 0) {
                  setFolderPaths((prev) => [...new Set([...prev, ...folderPathsToAdd])]);
                  (async () => {
                    try {
                      const detectedSizes = await window.electronAPI.fs.readProjectSizes(folderPathsToAdd) as string[] | undefined;
                      if (Array.isArray(detectedSizes) && detectedSizes.length > 0) {
                        setSelectedSizes(detectedSizes);
                      }
                    } catch {
                      // 读取失败仅不自动勾选尺寸
                    }
                  })();
                  toast.success(`${folderPathsToAdd.length} ${t[language].foldersAddedDesc}`);
                }
              }}
            >
              <div className="p-4 bg-slate-50 rounded-full mb-4 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all duration-300 group-hover:scale-110">
                <UploadCloud size={48} strokeWidth={2} />
              </div>
              <span className="text-sm font-medium text-slate-600 group-hover:text-blue-700">
                {t[language].dragDrop}<span className="text-blue-600 underline decoration-blue-300 underline-offset-2">{t[language].browse}</span>
              </span>
              {folderPaths.length > 0 && (
                <span className="mt-2 text-xs font-semibold text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
                  {folderPaths.length} {t[language].foldersAddedDesc}
                </span>
              )}
            </div>

            {/* 已添加的文件夹路径列表 */}
            <AnimatePresence>
              {folderPaths.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  {folderPaths.map((p, idx) => (
                    <motion.div
                      key={p}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ delay: idx * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
                      className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl group/item"
                    >
                      <FolderPlus size={14} className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-blue-800 truncate flex-1 font-mono" title={p}>{p}</span>
                      <button
                        onClick={() => setFolderPaths((prev) => prev.filter((_, i) => i !== idx))}
                        className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-blue-100"
                      >
                        <X size={13} className="text-blue-400 hover:text-red-500" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleAddFolder}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
                <FolderPlus size={16} /> {t[language].addFolder}
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
                <Trash2 size={16} /> {t[language].clearAll}
              </button>
            </div>
          </section>

          {/* Center Feedback Card (Gradient) */}
          <section className="w-full max-w-5xl flex-shrink-0">
            <div className="w-full p-8 lg:p-10 rounded-2xl bg-gradient-to-br from-orange-100 via-blue-50 to-indigo-100 bg-[length:200%_200%] animate-gradient border border-white/60 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex items-center justify-between backdrop-blur-sm">
              {/* Decorative background blur */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-orange-100/40 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 shadow-sm">
                  <span className={`w-2 h-2 rounded-full animate-pulse ${hasIssues ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
                  {t[language].systemReady}
                </div>
                <h2 className={`text-3xl lg:text-4xl font-black mb-3 tracking-tight transition-colors duration-500 ${
                  hasIssues ? 'text-orange-600' : hasValidated ? 'text-emerald-700' : 'text-slate-900'
                }`}>
                  {isValidating
                    ? t[language].validatingWorkspace
                    : hasIssues
                    ? `${validIssueCount} ${t[language].validationHasIssues}`
                    : hasValidated
                    ? t[language].allFilesValid
                    : t[language].readyTitle}
                </h2>
                <p className="text-slate-500 font-medium text-lg max-w-md">
                  {isValidating
                    ? t[language].analyzingFiles
                    : hasIssues
                    ? t[language].validationFailedDesc
                    : hasValidated
                    ? t[language].assetsValidated
                    : t[language].readySub}
                </p>
              </div>
              
              <div className="relative z-10 hidden md:block">
                <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-300">
                  <FileText size={40} className="text-slate-300" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          </section>

          {/* Hidden Log Table Area */}
          <section className="w-full max-w-5xl flex-shrink-0">
            <button 
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors mb-4 select-none"
            >
              {isTableExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />} 
              {isTableExpanded ? t[language].hideDetails : t[language].showDetails}
            </button>
            
            <AnimatePresence>
              {isTableExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                >
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] relative z-10">
                      <tr>
                        <th className="px-6 py-3.5">{t[language].fileName}</th>
                        <th className="px-6 py-3.5">{t[language].folder}</th>
                        <th className="px-6 py-3.5">{t[language].ext}</th>
                        <th className="px-6 py-3.5">{t[language].size}</th>
                        <th className="px-6 py-3.5">{t[language].status}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                      {isValidating ? (
                        // 骨架屏：保留原有 4 行 animate-pulse 动效
                        Array.from({ length: 4 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse even:bg-slate-50/50">
                            <td className="px-6 py-4">
                              <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-1/2 bg-slate-200 rounded"></div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-8 bg-slate-200 rounded"></div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-16 bg-slate-200 rounded"></div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
                            </td>
                          </tr>
                        ))
                      ) : validationResults.length === 0 ? (
                        // 空状态
                        <tr>
                          <td colSpan={5} className="p-4">
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-12">
                              <Inbox className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
                              <h3 className="text-slate-500 font-medium text-sm mt-4">{t[language].noAssets}</h3>
                              <p className="text-slate-400 text-xs mt-1">{t[language].dragDropFolders}</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        // 真实校验结果渲染
                        validationResults.map((item, index) => (
                          <tr
                            key={index}
                            className={`even:bg-slate-50/50 hover:bg-slate-100/60 hover:translate-x-1 transition-all duration-200 ${
                              item.status !== 'valid' ? 'bg-red-50/30' : ''
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <FileText size={16} className="text-slate-400 shrink-0" />
                                {/* 显示"纯文件名 + 扩展名"，与磁盘文件名一一对应 */}
                                <span className="truncate max-w-[200px] font-mono text-xs" title={`${item.fileName}${item.ext}`}>
                                  {item.status === 'missing'
                                    ? item.fileName
                                    : `${item.fileName}${item.ext}`}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-xs">
                              {/* 直接使用主进程返回的 folderName，无需在前端解析路径 */}
                              <span
                                className="truncate block max-w-[140px]"
                                title={item.folderName}
                              >
                                {item.folderName || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-400 uppercase text-xs font-bold tracking-wider">
                              {/* 去掉扩展名前缀的点，大写展示，如 MP4 */}
                              {item.ext ? item.ext.replace('.', '').toUpperCase() : '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                              {item.status === 'missing' && item.targetSize
                                ? item.targetSize.replace('*', '×')
                                : item.actualWidth && item.actualHeight
                                ? `${item.actualWidth}×${item.actualHeight}`
                                : item.fileSize
                                ? formatBytes(item.fileSize)
                                : '-'}
                            </td>
                            <td className="px-6 py-4">
                              <StatusTag type={item.status} language={language} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
            </motion.div>
          </AnimatePresence>
        </div>
            
        {/* Bottom Action Bar (Fixed Dock) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={language}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="p-6 bg-white/80 backdrop-blur-md border-t border-slate-200 flex justify-end gap-4 flex-shrink-0 relative z-20"
          >
            <motion.button 
              onClick={handleValidate}
                disabled={isValidating}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="h-12 px-10 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 hover:shadow-md transition-colors flex items-center justify-center gap-2 min-w-[200px] disabled:opacity-80 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t[language].validating}
                  </>
                ) : (
                  <>
                    <Play size={16} className="fill-current" />
                    {t[language].startValidation}
                  </>
                )}
              </motion.button>
              <motion.button 
                onClick={handleRename}
                disabled={isRenaming || !canRename}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={`group relative overflow-hidden h-12 px-10 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 hover:shadow-md transition-colors flex items-center justify-center gap-2 min-w-[200px] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-none ${canRename && !isRenaming ? 'shadow-[0_0_15px_rgba(16,185,129,0.4)]' : ''}`}
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite] transform skew-x-12 pointer-events-none" />
                {isRenaming ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t[language].processing}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                    {t[language].executeRename}
                  </>
                )}
              </motion.button>
            </motion.div>
          </AnimatePresence>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative flex flex-col w-[800px] h-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-1/4 bg-slate-50 border-r border-slate-100 flex flex-col flex-shrink-0">
                {/* User Info */}
                <div className="p-6 border-b border-slate-100 flex flex-col items-center">
                  <img src={avatarSrc} alt="Avatar" className="w-16 h-16 rounded-full bg-slate-200 mb-3 shadow-sm" />
                  <h2 className="text-sm font-bold text-slate-800">{userInfo.name}</h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">{userInfo.department}</p>
                </div>

                {/* Navigation Tabs */}
                <nav className="flex-1 p-4 flex flex-col gap-1">
                  {[
                    { id: 'account', label: t[language].tabAccount, icon: User },
                    { id: 'workflows', label: t[language].tabWorkflow, icon: Workflow },
                    { id: 'integrations', label: t[language].tabIntegrations, icon: Cpu },
                    { id: 'advanced', label: t[language].tabAdvanced, icon: Shield },
                  ].map((tab) => {
                    const isActive = settingsTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSettingsTab(tab.id)}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive ? 'bg-slate-200/50 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeTabIndicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"
                          />
                        )}
                        <Icon className="w-4 h-4" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Content Area */}
              <div className="w-3/4 bg-white overflow-y-auto custom-scrollbar">
                <div className="p-8">
                  {settingsTab === 'account' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-8"
                    >
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t[language].tabAccount}</h2>
                        <p className="text-sm text-slate-500 mt-1">{t[language].accountDesc}</p>
                      </div>

                      {/* User Details Card */}
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">{t[language].profileInfo}</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t[language].name}</label>
                            <input 
                              type="text" 
                              value={userInfo.name}
                              onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t[language].email}</label>
                            <div className="flex items-center gap-3">
                              <input 
                                type="email" 
                                value={userInfo.email}
                                onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              />
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t[language].department}</label>
                            <input 
                              type="text" 
                              value={userInfo.department}
                              onChange={(e) => setUserInfo({...userInfo, department: e.target.value})}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Theme Selection */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-3">{t[language].interfaceTheme}</h3>
                        <div className="flex gap-3">
                          <button className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-blue-500 bg-blue-50/50 text-blue-700 transition-all">
                            <Sun className="w-6 h-6" />
                            <span className="text-sm font-semibold">{t[language].light}</span>
                          </button>
                          <button className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 transition-all">
                            <Moon className="w-6 h-6" />
                            <span className="text-sm font-semibold">{t[language].dark}</span>
                          </button>
                          <button className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 transition-all">
                            <Monitor className="w-6 h-6" />
                            <span className="text-sm font-semibold">{t[language].system}</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {settingsTab === 'workflows' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8">
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t[language].tabWorkflow}</h2>
                        <p className="text-sm text-slate-500 mt-1">{t[language].workflowDesc}</p>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-800 mb-2">{t[language].defaultOutputDir}</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <FolderPlus className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                              type="text"
                              value={workflowSettings.defaultOutputDir}
                              onChange={(e) => setWorkflowSettings((p) => ({ ...p, defaultOutputDir: e.target.value }))}
                              placeholder="D:\Outputs"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-800 mb-2">{t[language].nameTemplate}</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <FileText className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                              type="text"
                              value={workflowSettings.renameTemplate}
                              onChange={(e) => setWorkflowSettings((p) => ({ ...p, renameTemplate: e.target.value }))}
                              placeholder="[Project]-[Name]-[Size]"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {settingsTab === 'integrations' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8">
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t[language].tabIntegrations}</h2>
                        <p className="text-sm text-slate-500 mt-1">{t[language].integrationsDesc}</p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">{t[language].apiKeys}</h3>
                        <div className="space-y-5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t[language].geminiKey}</label>
                            <input
                              type="password"
                              value={apiKeys.geminiKey}
                              onChange={(e) => setApiKeys((p) => ({ ...p, geminiKey: e.target.value }))}
                              placeholder="AIzaSy..."
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono placeholder:text-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t[language].sdPath}</label>
                            <input
                              type="text"
                              value={apiKeys.sdPath}
                              onChange={(e) => setApiKeys((p) => ({ ...p, sdPath: e.target.value }))}
                              placeholder="http://127.0.0.1:7860"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {settingsTab === 'advanced' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8 h-full">
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t[language].tabAdvanced}</h2>
                        <p className="text-sm text-slate-500 mt-1">{t[language].advancedDesc}</p>
                      </div>
                      
                      <div className="flex flex-col gap-4 flex-1">
                        <button
                          onClick={handleClearCache}
                          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                          {t[language].clearCache}
                        </button>
                        <button
                          onClick={handleExportLogs}
                          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors"
                        >
                          <FileText className="w-5 h-5" />
                          {t[language].exportLogs}
                        </button>
                      </div>

                      <div className="mt-auto pt-8 border-t border-slate-100 text-center">
                        <p className="text-xs font-medium text-slate-400">{t[language].versionInfo}: v1.0.0-beta</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
              </div>

              {/* 底部保存按钮 */}
              <div className="flex-shrink-0 px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <motion.button
                  onClick={handleSaveSettings}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md"
                >
                  <CheckCircle2 size={18} />
                  {t[language].saveChanges}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
