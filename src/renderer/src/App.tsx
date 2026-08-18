import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Flex,
  Group,
  Indicator,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { notify } from './utils/notify';
import { createAvatar } from '@dicebear/core';
import * as dylan from '@dicebear/dylan';
import {
  Bell,
  CalendarDays,
  Settings,
  Workflow,
  FolderSearch,
} from 'lucide-react';
import {
  dedupeStrings,
  DEFAULT_USER_INFO,
  DEFAULT_WORKFLOW,
  formatHistoryTime,
  PRESET_SIZES,
  DEFAULT_SYSTEM,
  DEFAULT_WORKSPACE,
  DEFAULT_SHORTCUTS,
  hydrateWorkflowSettings,
  type HistoryEntry,
  type DailyRequirementSession,
  type NotificationHistoryEntry,
  type RequirementDetail,
  type RequirementProject,
  type UserInfo,
  type ValidationResult,
  type WorkflowSettings,
  type SystemSettings,
  type WorkspaceSettings,
  type ShortcutSettings,
} from './appState';
import { DailyWorkspace } from './views/DailyWorkspace';
import { buildValidationPresentation } from './validationPresentation';
import { OrganizerWorkspace } from './views/OrganizerWorkspace';
import { FormatProcessor } from './views/FormatProcessor';
import { SettingsWorkspace } from './views/SettingsWorkspace';
import { isDarkColorScheme } from './theme';
import {
  buildDailyRequirementSession,
  isFreshDailyRequirementSession,
} from './dailyRequirementSession';
import {
  formatRenameProducer,
  getRenamePreset,
  renderRenameRule,
  validateRenamePreset,
  type RenameBatchResult,
  type RenamePreview,
  type RenameRequest,
  type RenameSelection,
} from '../../shared/renameTemplates.ts';
import type { RestorableAppView, RestorableSettingsTab, UpdateViewState } from '../../shared/updateContract.ts';
import { normalizeRestorableSettingsTab, normalizeRestorableView } from './updateSession';

type ViewKey = RestorableAppView;

export default function App() {
  const [isQimiEnabled, setIsQimiEnabled] = useState(true);
  const [activeView, setActiveView] = useState<ViewKey>('daily');
  const { setColorScheme } = useMantineColorScheme();
  const resolvedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDarkTheme = isDarkColorScheme(resolvedColorScheme);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameSelection, setRenameSelection] = useState<RenameSelection>({
    mode: 'regular',
    customPresetId: DEFAULT_WORKFLOW.renameSettings.lastCustomPresetId,
  });
  const [renamePreview, setRenamePreview] = useState<RenamePreview | null>(null);
  const [renameBatchResult, setRenameBatchResult] = useState<RenameBatchResult | null>(null);
  const [workflowSaveState, setWorkflowSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isChangingJson, setIsChangingJson] = useState(false);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [lastRenamedPaths, setLastRenamedPaths] = useState<string[]>([]);
  const [manualTargetSizes, setManualTargetSizes] = useState<string[]>(['1920*1080', '1080*1920']);
  const [detectedFolderSizes, setDetectedFolderSizes] = useState<string[]>([]);
  const [projectsList, setProjectsList] = useState<RequirementProject[]>([]);
  const [jsonFileName, setJsonFileName] = useState('');
  const [dailyRequirementSession, setDailyRequirementSession] = useState<DailyRequirementSession | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [historyOpened, setHistoryOpened] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryEntry[]>([]);
  const [isNotificationCenterOpened, setIsNotificationCenterOpened] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>(DEFAULT_USER_INFO);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>(DEFAULT_WORKFLOW);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE);
  const [shortcutSettings, setShortcutSettings] = useState<ShortcutSettings>(DEFAULT_SHORTCUTS);
  const [updateState, setUpdateState] = useState<UpdateViewState | null>(null);
  const [organizerBusy, setOrganizerBusy] = useState(false);
  const [formatBusy, setFormatBusy] = useState(false);
  const [requestedSettingsTab, setRequestedSettingsTab] = useState<RestorableSettingsTab>('system');
  const lastUserActivityAtRef = useRef(Date.now());

  const primaryProjectName = projectsList[0]?.projectName ?? '';
  const validationPresentation = useMemo(
    () => buildValidationPresentation(validationResults),
    [validationResults],
  );
  const hasIssues = hasValidated && (
    validationPresentation.summary.hasBlockingIssues ||
    validationPresentation.summary.hasMissingIssues ||
    validationPresentation.summary.hasExtraIssues
  );
  const hasBlockingIssues = hasValidated && validationPresentation.summary.hasBlockingIssues;
  const hasMissingIssues = hasValidated && validationPresentation.summary.hasMissingIssues;
  const hasExtraIssues = hasValidated && validationPresentation.summary.hasExtraIssues;
  const validationCanRename = hasValidated && validationPresentation.summary.canRenamePassedFiles;
  const canRename = validationCanRename && renamePreview?.canExecute === true;
  const hasActiveWork = isChangingJson
    || isValidating
    || isRenaming
    || organizerBusy
    || formatBusy
    || folderPaths.length > 0
    || validationResults.length > 0;
  const hasUnsavedChanges = workflowSaveState === 'saving' || workflowSaveState === 'error';
  const regularRenamePreset = workflowSettings.renameSettings.presets.find((preset) => preset.kind === 'regular');
  const canFallbackToRegular = Boolean(regularRenamePreset && validateRenamePreset(regularRenamePreset).length === 0);
  const selectedRenamePreset = useMemo(() => {
    if (renameSelection.mode === 'custom') {
      const preset = getRenamePreset(workflowSettings.renameSettings, renameSelection.customPresetId);
      return preset?.kind === 'custom' ? preset : undefined;
    }
    return workflowSettings.renameSettings.presets.find((preset) => preset.kind === renameSelection.mode);
  }, [workflowSettings.renameSettings, renameSelection]);
  const renameExample = useMemo(() => {
    if (!selectedRenamePreset) return null;
    const projectName = primaryProjectName || '示例项目';
    const cleanProjectName = projectName.replace(/\(创意比特\)|（创意比特）|创意比特/g, '').trim() || '示例项目';
    const variables = {
      ProjectName: projectName,
      CleanProjectName: cleanProjectName,
      Date: new Date(),
      Producer: formatRenameProducer(userInfo.name) || 'MXW',
      Resolution: '1280x720',
      AspectRatio: '横',
      OriginalName: '素材原名',
    };
    const renderExample = (mediaType: 'image' | 'video') => {
      const rule = selectedRenamePreset.rules[mediaType];
      const result = renderRenameRule(rule, variables, rule.sequence.start);
      return {
        label: mediaType === 'image' ? '图片' : '视频',
        value: result.ok ? `${result.value}.${mediaType === 'image' ? 'jpg' : 'mp4'}` : result.error,
        valid: result.ok,
      };
    };
    return {
      presetName: selectedRenamePreset.name,
      items: [renderExample('image'), renderExample('video')],
    };
  }, [selectedRenamePreset, primaryProjectName, userInfo.name]);

  const requirementTargets = useMemo(
    () => projectsList.flatMap((project) => {
      const requirements = project.requirements?.length
        ? project.requirements
        : (project.sizes || []).map((resolution) => ({ resolution, requiredQuantity: 1 }));
      return requirements;
    }),
    [projectsList],
  );
  const requirementSizes = useMemo(
    () => dedupeStrings(requirementTargets.map((item) => item.resolution)),
    [requirementTargets],
  );
  const manualDisplaySizes = useMemo(
    () => dedupeStrings([...PRESET_SIZES, ...manualTargetSizes, ...detectedFolderSizes]),
    [manualTargetSizes, detectedFolderSizes],
  );
  const horizontalManualSizes = useMemo(
    () => manualDisplaySizes.filter((size) => Number(size.split('*')[0]) >= Number(size.split('*')[1])),
    [manualDisplaySizes],
  );
  const verticalManualSizes = useMemo(
    () => manualDisplaySizes.filter((size) => Number(size.split('*')[0]) < Number(size.split('*')[1])),
    [manualDisplaySizes],
  );
  const avatarSrc = useMemo(
    () =>
      createAvatar(dylan, {
        seed: userInfo.name || '',
        backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf'],
      }).toDataUri(),
    [userInfo.name],
  );

  useEffect(() => {
    const handleNotification = async (e: Event) => {
      const customEvent = e as CustomEvent<NotificationHistoryEntry>;
      setNotificationHistory((prev) => {
        const next = [customEvent.detail, ...prev].slice(0, 100);
        if (window.electronAPI) {
          window.electronAPI.store.set('notificationHistory', next);
        }
        return next;
      });
    };
    window.addEventListener('app-notification', handleNotification);
    return () => window.removeEventListener('app-notification', handleNotification);
  }, []);

  useEffect(() => {
    if (!window.electronAPI) {
      setIsAppReady(true);
      return;
    }

    window.electronAPI.store.getAll().then((config) => {
      if (!config) return;
      if (config.userInfo && typeof config.userInfo === 'object') {
        const stored = config.userInfo as Partial<UserInfo>;
        const next = { name: stored.name ?? '', department: stored.department ?? '', email: stored.email ?? '' };
        setUserInfo(next);
      }
      if (config.workflow && typeof config.workflow === 'object') {
        setWorkflowSettings((prev) => hydrateWorkflowSettings(config, prev));
      } else {
        setWorkflowSettings((prev) => hydrateWorkflowSettings(config, prev));
      }
      if (config.systemSettings) {
        const sys = config.systemSettings as SystemSettings;
        setSystemSettings(sys);
        if (sys.theme) {
          setColorScheme(sys.theme);
        }
      }
      if (config.workspaceSettings) setWorkspaceSettings(config.workspaceSettings as WorkspaceSettings);
      if (config.shortcutSettings) setShortcutSettings(config.shortcutSettings as ShortcutSettings);
      if (config.updateSession && typeof config.updateSession === 'object') {
        const session = config.updateSession as { activeView?: unknown; settingsTab?: unknown };
        setActiveView(normalizeRestorableView(session.activeView));
        setRequestedSettingsTab(normalizeRestorableSettingsTab(session.settingsTab));
      }

      if (config.dailyRequirementSession && typeof config.dailyRequirementSession === 'object') {
        const session = config.dailyRequirementSession as DailyRequirementSession;
        if (isFreshDailyRequirementSession(session)) {
          setDailyRequirementSession(session);
          setProjectsList(Array.isArray(session.projects) ? session.projects : []);
          setJsonFileName(session.fileName ? session.fileName.replace(/\.json$/i, '') : '');
          if (session.producerName || session.department || session.email) {
            setUserInfo((prev) => ({
              ...prev,
              ...(session.producerName ? { name: session.producerName } : {}),
              ...(session.department ? { department: session.department } : {}),
              ...(session.email ? { email: session.email } : {}),
            }));
          }
        } else {
          window.electronAPI.store.delete('dailyRequirementSession');
        }
      }

      if (Array.isArray(config.history)) setHistoryData(config.history as HistoryEntry[]);
      if (Array.isArray(config.notificationHistory)) setNotificationHistory(config.notificationHistory as NotificationHistoryEntry[]);
    }).finally(() => setIsAppReady(true));
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.updates) return;
    const handleState = (state: UpdateViewState) => setUpdateState(state);
    window.electronAPI.updates.onState(handleState);
    void window.electronAPI.updates.getState().then(handleState).catch((error) => {
      console.error('Failed to read global update state', error);
    });
    return () => window.electronAPI.updates.offState(handleState);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.app) return;
    const handleNavigate = (target: { view: string; settingsTab?: string }) => {
      const nextView = normalizeRestorableView(target.view);
      if (nextView === 'settings' && target.settingsTab) {
        setRequestedSettingsTab(normalizeRestorableSettingsTab(target.settingsTab));
      }
      setActiveView(nextView);
    };
    window.electronAPI.app.onNavigate(handleNavigate);
    return () => window.electronAPI.app.offNavigate(handleNavigate);
  }, []);

  useEffect(() => {
    if (!isAppReady || !window.electronAPI?.updates) return;
    let lastReportAt = 0;
    const reportActivity = (markUserActive: boolean) => {
      const now = Date.now();
      if (markUserActive) lastUserActivityAtRef.current = now;
      if (markUserActive && now - lastReportAt < 15_000) return;
      lastReportAt = now;
      void window.electronAPI.updates.reportActivity({
        activeView,
        settingsTab: requestedSettingsTab,
        busy: hasActiveWork,
        hasUnsavedChanges,
        lastUserActivityAt: lastUserActivityAtRef.current,
        rendererReady: true,
      });
    };
    const handleUserActivity = () => reportActivity(true);
    const handlePrepareRestart = () => {
      void window.electronAPI.store.set('updateSession', { activeView, settingsTab: requestedSettingsTab, savedAt: Date.now() });
      reportActivity(false);
    };
    window.addEventListener('pointerdown', handleUserActivity, true);
    window.addEventListener('keydown', handleUserActivity, true);
    window.electronAPI.updates.onPrepareRestart(handlePrepareRestart);
    void window.electronAPI.store.set('updateSession', { activeView, settingsTab: requestedSettingsTab, savedAt: Date.now() });
    reportActivity(false);
    return () => {
      window.removeEventListener('pointerdown', handleUserActivity, true);
      window.removeEventListener('keydown', handleUserActivity, true);
      window.electronAPI.updates.offPrepareRestart(handlePrepareRestart);
    };
  }, [activeView, formatBusy, hasActiveWork, hasUnsavedChanges, isAppReady, organizerBusy, requestedSettingsTab]);

  useEffect(() => {
    if (!isAppReady) return;
    const frame = window.requestAnimationFrame(() => {
      window.electronAPI?.app?.rendererReady();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isAppReady]);

  useEffect(() => {
    if (!isAppReady || !window.electronAPI) return;
    setWorkflowSaveState('saving');
    const timeout = window.setTimeout(() => {
      window.electronAPI.store.set('workflow', workflowSettings)
        .then(() => setWorkflowSaveState('saved'))
        .catch(() => setWorkflowSaveState('error'));
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [isAppReady, workflowSettings]);

  useEffect(() => {
    const selected = getRenamePreset(workflowSettings.renameSettings, renameSelection.customPresetId);
    if (selected?.kind === 'custom') return;
    const fallback = getRenamePreset(workflowSettings.renameSettings, workflowSettings.renameSettings.lastCustomPresetId)
      || workflowSettings.renameSettings.presets.find((preset) => preset.kind === 'custom');
    if (fallback) setRenameSelection((prev) => ({ ...prev, customPresetId: fallback.id }));
  }, [workflowSettings.renameSettings, renameSelection.customPresetId]);

  useEffect(() => {
    if (!validationCanRename || !window.electronAPI?.fs?.previewRename) {
      setRenamePreview(null);
      return;
    }

    let cancelled = false;
    const request: RenameRequest = {
      files: validationResults.filter((item) => item.status === 'valid'),
      settings: workflowSettings.renameSettings,
      selection: renameSelection,
      projectName: primaryProjectName,
      producer: userInfo.name,
    };
    window.electronAPI.fs.previewRename(request)
      .then((preview) => {
        if (!cancelled) setRenamePreview(preview);
      })
      .catch((error) => {
        if (!cancelled) {
          setRenamePreview({
            canExecute: false,
            errorCount: 1,
            items: [{
              oldPath: '',
              newPath: '',
              oldFileName: '',
              newFileName: '',
              status: 'blocked',
              errorCode: 'PREVIEW_FAILED',
              error: error instanceof Error ? error.message : String(error),
            }],
          });
        }
      });
    return () => { cancelled = true; };
  }, [
    validationCanRename,
    validationResults,
    workflowSettings.renameSettings,
    renameSelection,
    primaryProjectName,
    userInfo.name,
  ]);


  function resetValidationState() {
    setValidationResults([]);
    setHasValidated(false);
    setRenamePreview(null);
    setRenameBatchResult(null);
  }

  function getPathBaseName(path: string): string {
    const sep = path.includes('\\') ? '\\' : '/';
    return path.substring(path.lastIndexOf(sep) + 1);
  }

  function looseProjectName(value: string): string {
    return value
      .replace(/[<>:"/\\|?*\s]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  function findProjectForFolder(folderPath: string): RequirementProject | undefined {
    const folderName = getPathBaseName(folderPath);
    const looseFolderName = looseProjectName(folderName);
    return projectsList.find((project) => {
      const looseName = looseProjectName(project.projectName);
      return looseFolderName === looseName || looseFolderName.includes(looseName) || looseName.includes(looseFolderName);
    });
  }

  function getRequirementTargetsForProject(project: RequirementProject): RequirementDetail[] {
    if (project.requirements?.length) return project.requirements;
    return (project.sizes || []).map((resolution) => ({ resolution, requiredQuantity: 1 }));
  }

  function getFallbackTargetSizes() {
    return dedupeStrings([...manualTargetSizes, ...detectedFolderSizes]);
  }

  function getValidationTargetsForFolder(folderPath: string): Array<string | RequirementDetail> {
    const project = projectsList.length === 1 ? projectsList[0] : findProjectForFolder(folderPath);
    if (project) return getRequirementTargetsForProject(project);
    if (requirementTargets.length) return requirementTargets;
    return getFallbackTargetSizes();
  }

  async function handleChangeJson() {
    setIsChangingJson(true);
    try {
      const result = await window.electronAPI.dialog.openJson();
      if (!result) return;
      const session = buildDailyRequirementSession(result);
      const projects = session.projects;
      setDailyRequirementSession(session);
      setProjectsList(projects);
      setJsonFileName(session.fileName ? session.fileName.replace(/\.json$/i, '') : '');
      resetValidationState();
      if (window.electronAPI?.store) {
        window.electronAPI.store.set('dailyRequirementSession', session);
      }
      if (session.producerName || session.department || session.email) {
        setUserInfo((prev) => {
          const newUserInfo = {
            ...prev,
            ...(session.producerName ? { name: session.producerName } : {}),
            ...(session.department ? { department: session.department } : {}),
            ...(session.email ? { email: session.email } : {}),
          };
          if (window.electronAPI && window.electronAPI.store) {
            window.electronAPI.store.set('userInfo', newUserInfo);
          }
          return newUserInfo;
        });
      }
      notify('green', '需求表已更新', session.fileName || undefined);
      if (session.warnings && session.warnings.length > 0) {
        notify('orange', '需求表有提示', session.warnings.slice(0, 2).join('；'));
      }
    } catch {
      notify('red', '读取失败', '请检查 JSON 文件格式后重试。');
    } finally {
      setIsChangingJson(false);
    }
  }

  async function addFolders(paths: string[]) {
    const uniquePaths = dedupeStrings(paths);
    if (!uniquePaths.length) return;
    setFolderPaths((prev) => dedupeStrings([...prev, ...uniquePaths]));
    setLastRenamedPaths([]);
    resetValidationState();
    try {
      const detectedSizes = await window.electronAPI.fs.readProjectSizes(uniquePaths);
      if (detectedSizes.length) setDetectedFolderSizes(detectedSizes);
    } catch {}
    notify('green', '目录已加入工作区', `${uniquePaths.length} 个目录`);
  }

  async function handleAddFolder() {
    const folderPath = await window.electronAPI.dialog.selectFolder();
    if (!folderPath) return;
    await addFolders([folderPath]);
  }

  async function handleInitFolders() {
    if (!projectsList.length) {
      notify('orange', '缺少需求数据', '请先导入需求表，再创建目录。');
      return;
    }
    try {
      const result = await window.electronAPI.fs.initFolders(projectsList);
      if (result.success) {
        notify('green', '目录创建完成', result.destPath);
      } else notify('red', '目录创建失败', result.error);
    } catch {
      notify('red', '目录创建失败');
    }
  }

  async function handleValidate() {
    if (!folderPaths.length) return notify('orange', '工作区为空', '请先添加素材目录。');
    if (!folderPaths.some((folderPath) => getValidationTargetsForFolder(folderPath).length > 0)) {
      return notify('orange', '缺少校验目标', '请先导入需求表，或添加可识别尺寸的素材目录。');
    }

    setIsValidating(true);
    setValidationResults([]);
    setHasValidated(false);
    try {
      const allResults: ValidationResult[] = [];
      for (const folderPath of folderPaths) {
        const results = await window.electronAPI.fs.startValidation(folderPath, getValidationTargetsForFolder(folderPath));
        const projectName = getPathBaseName(folderPath);
        allResults.push(...results.map((item) => ({ ...item, workspaceProjectName: projectName })));
      }
      setValidationResults(allResults);
      setHasValidated(true);
      const presentation = buildValidationPresentation(allResults);
      const { blockingCount, missingRowsCount, missingTotal, emptyFolderCount, extraCount } = presentation.summary;
      if (blockingCount === 0 && missingRowsCount === 0 && extraCount === 0) {
        notify('green', '校验通过', '全部素材符合要求。');
      } else if (blockingCount === 0 && emptyFolderCount > 0) {
        const extraText = extraCount > 0 ? `另有 ${extraCount} 项非需求素材不会参与重命名。` : '';
        notify('orange', '缺失文件', `${emptyFolderCount} 个素材目录为空，请添加素材后重验。${extraText}`);
        setIsTableExpanded(true);
      } else if (blockingCount === 0 && missingRowsCount > 0) {
        const extraText = extraCount > 0 ? `另有 ${extraCount} 项非需求素材不会参与重命名。` : '';
        notify('orange', '数量不足', `${missingRowsCount} 个尺寸缺素材，共缺 ${missingTotal} 张。可补齐后重验，也可先重命名已有素材。${extraText}`);
        setIsTableExpanded(true);
      } else if (blockingCount === 0) {
        notify('blue', '发现非需求素材', `${extraCount} 项素材不在需求表中，不会参与重命名。`);
        setIsTableExpanded(true);
      } else {
        notify('red', '校验异常', `${blockingCount} 项素材存在尺寸或读取问题。`);
        setIsTableExpanded(true);
      }
    } catch {
      notify('red', '校验失败', '校验过程中发生错误，请重试。');
    } finally {
      setIsValidating(false);
    }
  }

  async function handleRename() {
    if (!validationCanRename) return notify('red', '无法执行重命名', '请先处理尺寸错误或读取失败的素材。');
    if (!renamePreview?.canExecute) {
      const error = renamePreview?.items.find((item) => item.error)?.error;
      return notify('red', '命名预检未通过', error || '请检查当前命名模板。');
    }
    setIsRenaming(true);
    try {
      const validFiles = validationResults.filter((item) => item.status === 'valid');
      if (hasMissingIssues && !hasBlockingIssues) {
        notify('orange', '按现有素材重命名', '仍有数量缺口，本次只重命名已通过校验的素材。');
      }
      if (hasExtraIssues && !hasBlockingIssues) {
        notify('blue', '跳过非需求素材', '额外尺寸素材不会参与本次重命名。');
      }
      const result = await window.electronAPI.fs.executeRename({
        files: validFiles,
        settings: workflowSettings.renameSettings,
        selection: renameSelection,
        projectName: primaryProjectName,
        producer: userInfo.name,
      });
      setRenameBatchResult(result);
      const successCount = result.successCount;
      const failed = result.results.filter((item) => !item.success);
      if (failed.length === 0) notify('green', '重命名完成', `${successCount} 个文件`);
      else notify('red', '重命名部分失败', `${failed.length} 个文件待重试：${failed[0]?.error || '文件可能被占用。'}`);
      if (successCount > 0) {
        const folderNames = folderPaths.map((p) => {
          const sep = p.includes('\\') ? '\\' : '/';
          return p.substring(p.lastIndexOf(sep) + 1);
        }).join(', ');
        const historyStatus: HistoryEntry['status'] = failed.length === 0 ? 'success' : 'warning';
        const nextHistory: HistoryEntry[] = [{ id: Date.now(), project: folderNames || 'Untitled Folder', count: successCount, status: historyStatus, timestamp: Date.now() }, ...historyData].slice(0, 20);
        setHistoryData(nextHistory);
        await window.electronAPI.store.set('history', nextHistory);
        setLastRenamedPaths([...folderPaths]);
      }
      if (failed.length === 0) {
        setFolderPaths([]);
        resetValidationState();
      } else {
        const failedPaths = new Set(failed.map((item) => item.oldPath));
        setValidationResults((prev) => prev.filter((item) => item.status !== 'valid' || failedPaths.has(item.filePath)));
      }
    } catch {
      notify('red', '重命名部分失败', '部分文件可能被占用或命名冲突。');
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleTrashValidationFile(row: ValidationResult) {
    if (!row.filePath) return;
    if (!window.electronAPI?.fs?.trashFile) {
      notify('red', '删除失败', '请重启应用后再试。');
      return;
    }
    try {
      const result = await window.electronAPI.fs.trashFile(row.filePath);
      if (!result.success) {
        notify('red', '删除失败', result.error || '无法移动到废纸篓。');
        return;
      }
      setValidationResults((prev) => prev.filter((item) => item.filePath !== row.filePath));
      notify('green', '已移到废纸篓', `${row.fileName}${row.ext}`);
    } catch {
      notify('red', '删除失败', '无法移动到废纸篓。');
    }
  }

  const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode; color: string }> = [
    { key: 'daily', label: '日常', icon: <CalendarDays size={20} />, color: 'blue' },
    { key: 'organizer', label: '整理', icon: <FolderSearch size={20} />, color: 'indigo' },
    { key: 'format', label: '格式处理', icon: <Workflow size={20} />, color: 'orange' },
  ];

  if (!isAppReady) return null;

  const sidebarActiveBackground = isDarkTheme
    ? 'rgba(34, 139, 230, 0.18)'
    : 'rgba(34, 139, 230, 0.12)';
  const sidebarActiveColor = isDarkTheme
    ? 'var(--mantine-color-blue-1)'
    : 'var(--mantine-color-blue-8)';
  const updateNeedsAttention = Boolean(updateState && ['available', 'downloading', 'downloaded'].includes(updateState.desktop.status));
  const updateAttentionColor = updateState?.desktop.updateType === 'critical' ? 'red' : 'orange';

  return (
    <Flex data-openflow-app-ready="true" className="app-shell" h="100vh" style={{ background: 'var(--mantine-color-body)', overflow: 'hidden' }}>
      <Box
        className="app-sidebar"
        w={92}
        style={{
          background: isDarkTheme ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-1)',
          borderRight: `1px solid ${isDarkTheme ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-3)'}`,
          boxShadow: 'var(--openflow-shadow-sidebar)',
          zIndex: 20,
        }}
      >
        <Flex className="app-sidebar-inner" direction="column" h="100%" align="center" py={18}>
          <Box className="app-avatar" mb={30} mt={2} style={{ position: 'relative' }}>
            <Avatar src={avatarSrc} size={50} radius="xl" />
            <Box
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -10,
                width: 28,
                height: 6,
                transform: 'translateX(-50%)',
                borderRadius: 999,
                background: 'linear-gradient(90deg, var(--mantine-color-orange-filled) 0%, var(--mantine-color-red-filled) 50%, var(--mantine-color-indigo-filled) 100%)',
              }}
            />
          </Box>

          <Box my={4} w={46} h={1} style={{ background: 'var(--mantine-color-default-border)' }} />

          <Stack className="app-nav" gap={10} align="center" mt={18}>
            {navItems.map((item) => {
              const active = activeView === item.key;

              return (
                <button
                  className="app-nav-button"
                  key={item.key}
                  onClick={() => setActiveView(item.key)}
                  style={{
                    position: 'relative',
                    width: 72,
                    height: 72,
                    padding: 0,
                    border: 'none',
                    borderRadius: 20,
                    cursor: 'pointer',
                    background: active ? sidebarActiveBackground : 'transparent',
                    color: active ? sidebarActiveColor : 'var(--mantine-color-dimmed)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontFamily: 'inherit',
                    fontWeight: 900,
                    outline: 'none',
                  }}
                >
                  {active && (
                    <Box
                      style={{
                        position: 'absolute',
                        left: -12,
                        top: '50%',
                        width: 4,
                        height: 30,
                        transform: 'translateY(-50%)',
                        borderRadius: 999,
                        background: 'var(--mantine-color-blue-filled)',
                      }}
                    />
                  )}
                  {item.icon}
                  <span style={{ fontSize: 11, fontWeight: 900, lineHeight: 1 }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </Stack>

          <Box style={{ marginTop: 'auto' }} />

          <Stack className="app-utilities" gap={16} align="center" pb={10}>
            <Indicator color="red" size={8} offset={5} disabled={notificationHistory.length === 0}>
              <ActionIcon
                variant="subtle"
                onClick={() => setIsNotificationCenterOpened(true)}
                styles={{
                  root: {
                    width: 46,
                    height: 46,
                    color: isNotificationCenterOpened ? sidebarActiveColor : 'var(--mantine-color-dimmed)',
                    background: isNotificationCenterOpened ? sidebarActiveBackground : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                  },
                }}
              >
                <Bell size={22} />
              </ActionIcon>
            </Indicator>
            <Indicator color={updateAttentionColor} size={9} offset={5} disabled={!updateNeedsAttention} processing={updateState?.desktop.status === 'downloading'}>
              <ActionIcon
                variant="subtle"
                aria-label={updateNeedsAttention ? '设置中心，有新版本' : '设置中心'}
                onClick={() => {
                  setRequestedSettingsTab(updateNeedsAttention ? 'about' : 'system');
                  setActiveView('settings');
                }}
                styles={{
                  root: {
                    width: 46,
                    height: 46,
                    color: activeView === 'settings' ? sidebarActiveColor : 'var(--mantine-color-dimmed)',
                    background: activeView === 'settings' ? sidebarActiveBackground : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                  },
                }}
              >
                <Settings size={22} />
              </ActionIcon>
            </Indicator>
          </Stack>
        </Flex>
      </Box>

      <Box className="app-content" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {activeView === 'daily' ? (
          <DailyWorkspace
            jsonFileName={jsonFileName}
            projectsCount={projectsList.length}
            requirementSizes={requirementSizes}
            detectedFolderSizes={detectedFolderSizes}
            manualTargetSizes={manualTargetSizes}
            horizontalManualSizes={horizontalManualSizes}
            verticalManualSizes={verticalManualSizes}
            folderPaths={folderPaths}
            validationResults={validationResults}
            isChangingJson={isChangingJson}
            isValidating={isValidating}
            isRenaming={isRenaming}
            renameSelection={renameSelection}
            customRenamePresets={workflowSettings.renameSettings.presets.filter((preset) => preset.kind === 'custom')}
            renameExample={renameExample}
            renamePreview={renamePreview}
            renameBatchResult={renameBatchResult}
            workflowSaveState={workflowSaveState}
            canFallbackToRegular={canFallbackToRegular}
            lastRenamedPaths={lastRenamedPaths}
            onChangeRenameMode={(mode) => setRenameSelection((prev) => ({ ...prev, mode }))}
            onChangeCustomPreset={(customPresetId) => {
              setRenameSelection({ mode: 'custom', customPresetId });
              setWorkflowSettings((prev) => ({
                ...prev,
                renameSettings: { ...prev.renameSettings, lastCustomPresetId: customPresetId },
              }));
            }}
            onFallbackToRegular={() => setRenameSelection((prev) => ({ ...prev, mode: 'regular' }))}
            onRetryFailed={() => void handleRename()}
            hasValidated={hasValidated}
            hasIssues={hasIssues}
            canRename={canRename}
            isTableExpanded={isTableExpanded}
            onToggleTable={() => setIsTableExpanded((prev) => !prev)}
            onToggleManualSize={(size) => setManualTargetSizes((prev) => prev.includes(size) ? prev.filter((item) => item !== size) : [...prev, size])}
            onChangeJson={() => void handleChangeJson()}
            onInitFolders={() => void handleInitFolders()}
            onAddFolder={() => void handleAddFolder()}
            onClearFolders={() => { setFolderPaths([]); setLastRenamedPaths([]); setDetectedFolderSizes([]); setManualTargetSizes([]); resetValidationState(); }}
            onRemoveFolder={(path) => { setFolderPaths((prev) => prev.filter((item) => item !== path)); resetValidationState(); }}
            onValidate={() => void handleValidate()}
            onRename={() => void handleRename()}
            onTrashValidationFile={(row) => void handleTrashValidationFile(row)}
            onOpenSettings={() => setActiveView('settings')}
            onOpenHistory={() => setHistoryOpened(true)}
            onDropPaths={(paths) => void addFolders(dedupeStrings(paths))}
            onOpenFolder={(path) => {
              if (window.electronAPI?.shell?.openPath) {
                window.electronAPI.shell.openPath(path);
              }
            }}
          />
        ) : activeView === 'organizer' ? (
          <OrganizerWorkspace
            workflowSettings={workflowSettings}
            workspaceSettings={workspaceSettings}
            onOpenSettings={() => setActiveView('settings')}
            onChangeWorkspaceSettings={async (partialSettings) => {
              const newSettings = { ...workspaceSettings, ...partialSettings };
              setWorkspaceSettings(newSettings);
              if (window.electronAPI) {
                await window.electronAPI.store.set('workspaceSettings', newSettings);
              }
            }}
            isQimiEnabled={isQimiEnabled}
            onToggleQimiEnabled={setIsQimiEnabled}
            onBusyChange={setOrganizerBusy}
          />
        ) : activeView === 'settings' ? (
          <SettingsWorkspace
            userInfo={userInfo}
            setUserInfo={setUserInfo}
            workflowSettings={workflowSettings}
            setWorkflowSettings={setWorkflowSettings}
            systemSettings={systemSettings}
            setSystemSettings={setSystemSettings}
            workspaceSettings={workspaceSettings}
            setWorkspaceSettings={setWorkspaceSettings}
            shortcutSettings={shortcutSettings}
            setShortcutSettings={setShortcutSettings}
            producerName={userInfo.name}
            workflowSaveState={workflowSaveState}
            requestedTab={requestedSettingsTab}
            onActiveTabChange={setRequestedSettingsTab}
          />
        ) : activeView === 'format' ? (
          <FormatProcessor onBusyChange={setFormatBusy} />
        ) : (
          <FormatProcessor onBusyChange={setFormatBusy} />
        )}
      </Box>

            <Drawer opened={isNotificationCenterOpened} onClose={() => setIsNotificationCenterOpened(false)} position="left" size={420} title="消息中心">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">保留最近 100 条通知</Text>
            <Button variant="subtle" color="red" size="xs" onClick={() => {
              setNotificationHistory([]);
              if (window.electronAPI) window.electronAPI.store.set('notificationHistory', []);
            }}>
              清空历史
            </Button>
          </Group>
          {notificationHistory.length === 0 && <Text c="dimmed" mt="md" ta="center">暂无消息记录</Text>}
          {notificationHistory.map((item) => (
            <Card key={item.id} withBorder radius="md" p="sm" shadow="sm">
              <Group wrap="nowrap" align="flex-start">
                <Box
                  w={8}
                  h={8}
                  mt={6}
                  style={{
                    borderRadius: 999,
                    background: ['green', 'teal'].includes(item.color) ? 'var(--mantine-color-green-filled)' : item.color === 'red' ? 'var(--mantine-color-red-filled)' : ['orange', 'yellow'].includes(item.color) ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-blue-filled)',
                    flexShrink: 0
                  }}
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" mb={4}>
                    <Text fw={700} size="sm">{item.title}</Text>
                    <Text size="xs" c="dimmed">{new Date(item.timestamp).toLocaleString()}</Text>
                  </Group>
                  {item.message && <Text size="xs" c="dimmed">{item.message}</Text>}
                </Box>
              </Group>
            </Card>
          ))}
        </Stack>
      </Drawer>

      <Drawer opened={historyOpened} onClose={() => setHistoryOpened(false)} position="right" size={420} title="历史记录">
        <Stack gap="sm">
          {historyData.length === 0 && <Text c="dimmed">暂无历史记录</Text>}
          {historyData.map((item) => (
            <Card key={item.id} withBorder radius="xl">
              <Group justify="space-between">
                <Box>
                  <Text fw={700}>{item.project}</Text>
                  <Text size="sm" c="dimmed">重命名 · {item.count} 个文件</Text>
                </Box>
                <Badge color={item.status === 'success' ? 'teal' : item.status === 'warning' ? 'orange' : 'red'} variant="light">
                  {formatHistoryTime(item.timestamp)}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      </Drawer>
    </Flex>
  );
}
