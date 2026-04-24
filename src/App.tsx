/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
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
  "1080*1620", "160*160", "512*512", "780*800",
  "240*180", "1080*1880", "2160*1080"
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
    advancedDesc: "系统级配置和危险操作区。"
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
    advancedDesc: "System-level configurations and danger zone."
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
    advancedDesc: "システムレベルの設定と危険な操作。"
  }
};

const StatusTag = ({ type, language }: { type: 'valid' | 'pending' | 'error' | 'warning', language: LangKey }) => {
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

export default function App() {
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const dragCounter = useRef(0);

  // Language State
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
    toast.success(`Language switched to ${languages.find(l => l.key === langKey)?.name}`);
  };

  // Form State
  const [projectName, setProjectName] = useState('');
  const [producerName, setProducerName] = useState('MXW');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['1920*1080', '1080*1920']);
  
  // History State
  const [showHistory, setShowHistory] = useState(false);
  const recentHistoryData = [
    { id: 1, project: "RS20260312-小火车", timeValue: 10, timeUnit: 'timeMinsAgo', action: 'actionRenamed', count: 24, status: "success" },
    { id: 2, project: "KV-圣诞节活动主视觉", timeValue: 2, timeUnit: 'timeHoursAgo', action: 'actionValidated', count: 5, status: "warning" },
    { id: 3, project: "Vlog-周末露营", timeValue: null, timeUnit: 'timeYesterday', action: 'actionRenamed', count: 12, status: "success" }
  ];

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [userInfo, setUserInfo] = useState({
    name: "孟祥伟 (MXW)",
    department: "品创部 / AI创意素材组",
    email: "mengxiangwei@listen-ad.com.cn"
  });

  const mockData: any[] = [];
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.projectName) setProjectName(json.projectName);
        if (json.producerName) setProducerName(json.producerName);
        if (json.sizes && Array.isArray(json.sizes)) {
          setSelectedSizes(json.sizes);
        }
      } catch (error) {
        console.error("Invalid JSON file", error);
        alert("Failed to parse JSON file. Please ensure it is a valid JSON format.");
      }
    };
    reader.readAsText(file);
    
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const handleValidate = () => {
    setIsValidating(true);
    setIsTableExpanded(true);
    setHasValidated(false);
    setTimeout(() => {
      setIsValidating(false);
      setHasValidated(true);
    }, 2500);
  };

  const handleRename = () => {
    setIsRenaming(true);
    setTimeout(() => setIsRenaming(false), 2000);
  };

  const horizontalSizes = useMemo(() => PRESET_SIZES.filter(size => {
    const [w, h] = size.split('*').map(Number);
    return w >= h;
  }), []);

  const verticalSizes = useMemo(() => PRESET_SIZES.filter(size => {
    const [w, h] = size.split('*').map(Number);
    return w < h;
  }), []);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      toast.success(`Successfully dropped ${e.dataTransfer.files.length} file(s)`);
    }
  };

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
                  onClick={() => {
                    toast.success(t[language].jsonSuccess, { description: t[language].jsonDesc });
                    setProjectName('Spring_Campaign_2026');
                    setSelectedSizes(['1920*1080', '1080*1920', '1080*1080']);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <Sparkles size={16} />
                  {t[language].importJson}
                </button>
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImportJson} 
                />
                <button className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
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
                    <motion.ul 
                      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                      initial="hidden"
                      animate="visible"
                      className="flex flex-col gap-1"
                    >
                      {recentHistoryData.map((item) => (
                        <motion.li
                          key={item.id}
                          variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                          whileHover={{ x: 4, backgroundColor: "rgba(241, 245, 249, 1)" }}
                          className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors"
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'success' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.project}</p>
                            <p className="text-xs text-slate-500 truncate">{t[language][item.action as keyof typeof t[LangKey]]} {item.count} {t[language].files}</p>
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">{item.timeValue ? `${item.timeValue} ` : ''}{t[language][item.timeUnit as keyof typeof t[LangKey]]}</span>
                        </motion.li>
                      ))}
                    </motion.ul>
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
              className={`w-full py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group shadow-sm ${isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 bg-white'}`}
              onDragEnter={() => setIsDragActive(true)}
              onDragLeave={() => setIsDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragActive(false);
                // Handle file drop here if needed
              }}
            >
              <div className="p-4 bg-slate-50 rounded-full mb-4 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all duration-300 group-hover:scale-110">
                <UploadCloud size={48} strokeWidth={2} />
              </div>
              <span className="text-sm font-medium text-slate-600 group-hover:text-blue-700">
                {t[language].dragDrop}<span className="text-blue-600 underline decoration-blue-300 underline-offset-2">{t[language].browse}</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-4">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
                <FolderPlus size={16} /> {t[language].addFolder}
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
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
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {t[language].systemReady}
                </div>
                <h2 className={`text-3xl lg:text-4xl font-black mb-3 tracking-tight ${hasValidated ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {isValidating ? t[language].validatingWorkspace : hasValidated ? t[language].allFilesValid : t[language].readyTitle}
                </h2>
                <p className="text-slate-500 font-medium text-lg max-w-md">
                  {isValidating ? t[language].analyzingFiles : hasValidated ? t[language].assetsValidated : t[language].readySub}
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
                              <div className="h-4 w-8 bg-slate-200 rounded"></div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
                            </td>
                          </tr>
                        ))
                      ) : mockData.length === 0 ? (
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
                        mockData.map((item, index) => (
                          <tr key={index} className="even:bg-slate-50/50 hover:bg-slate-100/60 hover:translate-x-1 transition-all duration-200">
                            <td className="px-6 py-4 flex items-center gap-3">
                              <FileText size={16} className="text-slate-400" />
                              {item.name}
                            </td>
                            <td className="px-6 py-4 text-slate-500">{item.folder}</td>
                            <td className="px-6 py-4 text-slate-400">{item.ext}</td>
                            <td className="px-6 py-4 text-slate-500">{item.size}</td>
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
                disabled={isRenaming || !hasValidated}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={`group relative overflow-hidden h-12 px-10 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 hover:shadow-md transition-colors flex items-center justify-center gap-2 min-w-[200px] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-none ${(!isRenaming && hasValidated) ? 'shadow-[0_0_15px_rgba(16,185,129,0.4)]' : ''}`}
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
              className="relative flex w-[800px] h-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Sidebar */}
              <div className="w-1/4 bg-slate-50 border-r border-slate-100 flex flex-col">
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
                              defaultValue="D:\Outputs"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
                              defaultValue="[Project]-[Name]-[Size].mp4"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
                              defaultValue="AIzaSyB-xxxxxxxxxxxxxxxxxxxxxxxxx"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t[language].sdPath}</label>
                            <input 
                              type="password" 
                              defaultValue="http://127.0.0.1:7860"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
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
                        <button className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors">
                          <Trash2 className="w-5 h-5" />
                          {t[language].clearCache}
                        </button>
                        <button className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors">
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
