import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Flex,
  Group,
  Indicator,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { notify } from './utils/notify';
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
  normalizeWorkspaceSettings,
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
  buildDailyRequirementSessionFromExtraction,
  decideExtractionCandidate,
  formatExtractionTimeLabel,
  isFreshDailyRequirementSession,
} from './dailyRequirementSession';
import type { DesktopExtractionCandidate } from '../../shared/extractionContract.ts';
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
import type {
  WorkspaceInitConflict,
  WorkspaceInitOverrides,
  WorkspaceInitResult,
  WorkspaceMediaKind,
} from '../../shared/workspaceContract.ts';
import { normalizeRestorableSettingsTab, normalizeRestorableView } from './updateSession';
import { OpenFlowWaterSloth } from './components/OpenFlowWaterSloth';
import { getDailyWaterSlothMotion } from './waterSlothMotion.ts';

type ViewKey = RestorableAppView;
const DEFAULT_MANUAL_TARGET_SIZES = ['1920*1080', '1080*1920'];
interface FolderCreationPrompt {
  projects: RequirementProject[];
  automatic: boolean;
  overrides: WorkspaceInitOverrides;
  conflict: WorkspaceInitConflict;
}

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
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [manualTargetSizes, setManualTargetSizes] = useState<string[]>(DEFAULT_MANUAL_TARGET_SIZES);
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
  const [pendingExtractionCandidate, setPendingExtractionCandidate] = useState<DesktopExtractionCandidate | null>(null);
  const [isExtractionPromptOpen, setIsExtractionPromptOpen] = useState(false);
  const [folderCreationPrompt, setFolderCreationPrompt] = useState<FolderCreationPrompt | null>(null);
  const [folderCreationReport, setFolderCreationReport] = useState<WorkspaceInitResult | null>(null);
  const lastUserActivityAtRef = useRef(Date.now());
  const workflowContentRef = useRef({ hasContent: false, sourceMessageId: '' });
  const autoCreatedSessionRef = useRef('');

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
  const validationCanRename = hasValidated && validationResults.some((item) => item.status === 'valid');
  const canRename = validationCanRename && renamePreview?.canExecute === true;
  const failedValidationFolderPaths = useMemo(
    () => dedupeStrings(validationResults.filter((item) => item.status !== 'valid').map((item) => item.workspaceRootPath || '')),
    [validationResults],
  );
  const hasActiveWork = isChangingJson
    || isValidating
    || isRenaming
    || organizerBusy
    || formatBusy
    || folderPaths.length > 0
    || validationResults.length > 0;
  const hasUnsavedChanges = workflowSaveState === 'saving' || workflowSaveState === 'error';
  workflowContentRef.current = {
    hasContent: projectsList.length > 0 || folderPaths.length > 0 || validationResults.length > 0 || hasActiveWork,
    sourceMessageId: dailyRequirementSession?.sourceMessageId || '',
  };
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
  const dailyWaterSlothMotion = getDailyWaterSlothMotion({
    isChangingRequirement: isChangingJson,
    isValidating,
    isRenaming,
    hasValidated,
    needsAttention: hasIssues,
    hasRenameFailure: Boolean(renameBatchResult?.results.some((item) => !item.success)),
    hasRecentRenameSuccess: completedAt !== null && lastRenamedPaths.length > 0,
    hasFolders: folderPaths.length > 0,
  });

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
      const normalizedWorkspace = normalizeWorkspaceSettings(config.workspaceSettings as Partial<WorkspaceSettings> | undefined);
      setWorkspaceSettings(normalizedWorkspace);
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

      if (Array.isArray(config.history)) {
        const cutoff = Date.now() - normalizedWorkspace.historyRetentionDays * 24 * 60 * 60 * 1000;
        const retained = (config.history as HistoryEntry[]).filter((entry) => entry.timestamp >= cutoff);
        setHistoryData(retained);
        if (retained.length !== config.history.length) void window.electronAPI.store.set('history', retained);
      }
      if (Array.isArray(config.notificationHistory)) setNotificationHistory(config.notificationHistory as NotificationHistoryEntry[]);
    }).finally(() => setIsAppReady(true));
  }, []);

  useEffect(() => {
    if (!completedAt) return;
    const remaining = Math.max(0, workspaceSettings.completedVisibilityMs - (Date.now() - completedAt));
    const timer = window.setTimeout(() => {
      setCompletedAt(null);
      setLastRenamedPaths([]);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [completedAt, workspaceSettings.completedVisibilityMs]);

  useEffect(() => {
    if (!isAppReady || !dailyRequirementSession || !projectsList.length || !workspaceSettings.rootDir) return;
    const key = `${workspaceSettings.rootDir}|${dailyRequirementSession.importedAt}`;
    if (autoCreatedSessionRef.current === key) return;
    autoCreatedSessionRef.current = key;
    void createFoldersForProjects(projectsList, true);
  }, [isAppReady, dailyRequirementSession?.importedAt, projectsList, workspaceSettings.rootDir]);

  const applyDailyRequirementSession = useCallback((session: DailyRequirementSession, notificationTitle: string) => {
    setDailyRequirementSession(session);
    setProjectsList(session.projects);
    setJsonFileName(session.fileName ? session.fileName.replace(/\.json$/i, '') : '');
    resetValidationState();
    if (window.electronAPI?.store) {
      void window.electronAPI.store.set('dailyRequirementSession', session);
    }
    if (session.producerName || session.department || session.email) {
      setUserInfo((prev) => {
        const next = {
          ...prev,
          ...(session.producerName ? { name: session.producerName } : {}),
          ...(session.department ? { department: session.department } : {}),
          ...(session.email ? { email: session.email } : {}),
        };
        if (window.electronAPI?.store) void window.electronAPI.store.set('userInfo', next);
        return next;
      });
    }
    notify('green', notificationTitle, `${session.projects.length} 个项目 · ${session.fileName}`);
    if (session.warnings && session.warnings.length > 0) {
      notify('orange', '需求表有提示', session.warnings.slice(0, 2).join('；'));
    }
  }, []);

  useEffect(() => {
    const handleWorkspaceCleaned = (event: Event) => {
      const detail = (event as CustomEvent<{ paths?: string[]; timestamp?: number }>).detail;
      const removed = (detail?.paths || []).map((path) => path.replace(/[\\/]+$/, '').toLocaleLowerCase());
      if (!removed.length) return;
      setHistoryData((current) => {
        const next = current.map((entry) => {
          const affected = entry.paths?.some((path) => {
            const normalized = path.replace(/[\\/]+$/, '').toLocaleLowerCase();
            return removed.some((root) => normalized === root || normalized.startsWith(`${root}\\`) || normalized.startsWith(`${root}/`));
          });
          return affected ? { ...entry, cleanedAt: detail.timestamp || Date.now() } : entry;
        });
        void window.electronAPI?.store.set('history', next);
        return next;
      });
    };
    window.addEventListener('workspace-cleaned', handleWorkspaceCleaned);
    return () => window.removeEventListener('workspace-cleaned', handleWorkspaceCleaned);
  }, []);

  useEffect(() => {
    if (!isAppReady || !window.electronAPI?.extractions) return;
    let disposed = false;
    const handleCandidate = (candidate: DesktopExtractionCandidate) => {
      if (disposed || !candidate?.messageId) return;
      const decision = decideExtractionCandidate(
        candidate.messageId,
        workflowContentRef.current.sourceMessageId,
        workflowContentRef.current.hasContent,
      );
      if (decision === 'ignore') return;

      if (decision === 'auto-load') {
        const session = buildDailyRequirementSessionFromExtraction(candidate);
        applyDailyRequirementSession(session, '已自动载入今日最新抓取');
        setActiveView('daily');
        return;
      }
      setPendingExtractionCandidate(candidate);
      setIsExtractionPromptOpen(true);
    };

    window.electronAPI.extractions.onAvailable(handleCandidate);
    void window.electronAPI.extractions.getLatestToday().then(handleCandidate).catch((error) => {
      console.error('Failed to read latest desktop extraction', error);
    });
    return () => {
      disposed = true;
      window.electronAPI.extractions.offAvailable(handleCandidate);
    };
  }, [isAppReady, applyDailyRequirementSession]);

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
      applyDailyRequirementSession(session, '需求表已更新');
    } catch {
      notify('red', '读取失败', '请检查 JSON 文件格式后重试。');
    } finally {
      setIsChangingJson(false);
    }
  }

  async function addFolders(paths: string[]) {
    const seen = new Set<string>();
    const uniquePaths = paths
      .map((path) => path.trim().replace(/[\\/]+$/, ''))
      .filter((path) => {
        const key = path.toLocaleLowerCase();
        if (!path || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!uniquePaths.length) return;
    const nextPaths = [...folderPaths];
    const existingKeys = new Set(nextPaths.map((path) => path.toLocaleLowerCase()));
    uniquePaths.forEach((path) => {
      const key = path.toLocaleLowerCase();
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        nextPaths.push(path);
      }
    });
    setFolderPaths(nextPaths);
    setLastRenamedPaths([]);
    resetValidationState();
    try {
      const detectedSizes = await window.electronAPI.fs.readProjectSizes(nextPaths);
      setDetectedFolderSizes(detectedSizes);
    } catch {}
    notify('green', '目录已加入工作区', `${uniquePaths.length} 个目录`);
  }

  async function removeFolder(path: string) {
    const key = path.toLocaleLowerCase();
    const remainingPaths = folderPaths.filter((item) => item.toLocaleLowerCase() !== key);
    setFolderPaths(remainingPaths);
    resetValidationState();
    if (!remainingPaths.length) {
      setDetectedFolderSizes([]);
      setManualTargetSizes([]);
      return;
    }
    try {
      setDetectedFolderSizes(await window.electronAPI.fs.readProjectSizes(remainingPaths));
    } catch {
      setDetectedFolderSizes([]);
      notify('orange', '尺寸识别未更新', '剩余目录暂时无法读取，请重新添加目录或稍后重试。');
    }
  }

  async function handleAddFolder() {
    const folderPath = await window.electronAPI.dialog.selectFolder();
    if (!folderPath) return;
    await addFolders([folderPath]);
  }

  async function createFoldersForProjects(
    projects: RequirementProject[],
    automatic = false,
    overrides: WorkspaceInitOverrides = {},
  ) {
    if (!projects.length) {
      notify('orange', '缺少需求数据', '请先导入需求表，再创建目录。');
      return;
    }
    if (!workspaceSettings.rootDir) {
      if (!automatic) {
        notify('orange', '尚未设置工作区', '请先在设置 > 工作区中选择工作区。');
        setRequestedSettingsTab('workspace');
        setActiveView('settings');
      }
      return;
    }
    try {
      const result = await window.electronAPI.fs.initFolders({
        projects,
        settings: workspaceSettings,
        overrides,
      });
      if (result.conflict) {
        setFolderCreationPrompt({ projects, automatic, overrides, conflict: result.conflict });
        return;
      }
      if (result.success) {
        if (result.projectPaths?.length) await addFolders(result.projectPaths);
        const createdCount = result.createdPaths?.length || 0;
        const reusedCount = result.reusedPaths?.length || 0;
        notify('green', automatic ? '今日目录已自动准备' : '目录创建完成', `新建 ${createdCount} 个，复用 ${reusedCount} 个 · ${result.destPath}`);
        if (result.warnings?.length) notify('orange', '目录创建提示', result.warnings.join('；'));
        setFolderCreationReport(result);
      } else notify('red', '目录创建失败', result.error);
    } catch {
      notify('red', '目录创建失败');
    }
  }

  async function handleInitFolders() {
    await createFoldersForProjects(projectsList, false);
  }

  function resolveFolderCreationConflict(value: string) {
    if (!folderCreationPrompt) return;
    const { projects, automatic, conflict } = folderCreationPrompt;
    const overrides = { ...folderCreationPrompt.overrides };
    if (conflict.kind === 'month-style') overrides.monthStyle = value as WorkspaceInitOverrides['monthStyle'];
    else if (conflict.kind === 'date-style') overrides.dateStyle = value as WorkspaceInitOverrides['dateStyle'];
    else overrides.fallbackMediaKinds = value.split(',').filter(Boolean) as WorkspaceMediaKind[];
    setFolderCreationPrompt(null);
    void createFoldersForProjects(projects, automatic, overrides);
  }

  async function handleValidate(targetFolderPaths = folderPaths, retainOtherResults = false) {
    if (!targetFolderPaths.length) return notify('orange', '没有需要校验的目录', '请先添加素材目录。');
    if (!targetFolderPaths.some((folderPath) => getValidationTargetsForFolder(folderPath).length > 0)) {
      return notify('orange', '缺少校验目标', '请先导入需求表，或添加可识别尺寸的素材目录。');
    }

    setIsValidating(true);
    if (!retainOtherResults) {
      setValidationResults([]);
      setHasValidated(false);
    }
    try {
      const targetKeys = new Set(targetFolderPaths.map((path) => path.toLocaleLowerCase()));
      const allResults: ValidationResult[] = retainOtherResults
        ? validationResults.filter((item) => !item.workspaceRootPath || !targetKeys.has(item.workspaceRootPath.toLocaleLowerCase()))
        : [];
      for (const folderPath of targetFolderPaths) {
        const projectName = getPathBaseName(folderPath);
        try {
          const results = await window.electronAPI.fs.startValidation(folderPath, getValidationTargetsForFolder(folderPath));
          allResults.push(...results.map((item) => ({ ...item, workspaceProjectName: projectName, workspaceRootPath: folderPath })));
        } catch (error) {
          allResults.push({
            fileName: projectName,
            filePath: folderPath,
            folderName: projectName,
            ext: '',
            fileSize: 0,
            actualWidth: 0,
            actualHeight: 0,
            status: 'error',
            error: error instanceof Error ? error.message : '目录读取失败',
            workspaceProjectName: projectName,
            workspaceRootPath: folderPath,
          });
        }
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
    if (!validationCanRename) return notify('red', '没有可重命名素材', '请先完成校验，并确认至少一个目录通过。');
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
        const nextHistory: HistoryEntry[] = [{ id: Date.now(), project: folderNames || '未命名目录', count: successCount, status: historyStatus, timestamp: Date.now(), paths: [...folderPaths] }, ...historyData].slice(0, 20);
        setHistoryData(nextHistory);
        await window.electronAPI.store.set('history', nextHistory);
        setLastRenamedPaths([...folderPaths]);
        setCompletedAt(Date.now());
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
            <OpenFlowWaterSloth motion="idle" size={50} label="OpenFlow 小水懒品牌形象" />
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
            extractionTimeLabel={dailyRequirementSession?.source === 'extension'
              ? formatExtractionTimeLabel(dailyRequirementSession.extractedAt)
              : ''}
            pendingExtractionCount={pendingExtractionCandidate?.payload.projects.length || 0}
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
            activeRenamePreset={selectedRenamePreset}
            customRenamePresets={workflowSettings.renameSettings.presets.filter((preset) => preset.kind === 'custom')}
            renameExample={renameExample}
            renamePreview={renamePreview}
            renameBatchResult={renameBatchResult}
            workflowSaveState={workflowSaveState}
            canFallbackToRegular={canFallbackToRegular}
            lastRenamedPaths={lastRenamedPaths}
            completedAt={completedAt}
            completedVisibilityMs={workspaceSettings.completedVisibilityMs}
            waterSlothMotion={dailyWaterSlothMotion}
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
            failedValidationFolderCount={failedValidationFolderPaths.length}
            isTableExpanded={isTableExpanded}
            onToggleTable={() => setIsTableExpanded((prev) => !prev)}
            onToggleManualSize={(size) => setManualTargetSizes((prev) => prev.includes(size) ? prev.filter((item) => item !== size) : [...prev, size])}
            onSelectRequirementSizes={() => setManualTargetSizes((prev) => dedupeStrings([...prev, ...requirementSizes]))}
            onRestoreDefaultSizes={() => setManualTargetSizes([...DEFAULT_MANUAL_TARGET_SIZES])}
            onClearManualSizes={() => setManualTargetSizes([])}
            onChangeJson={() => void handleChangeJson()}
            onShowPendingExtraction={() => setIsExtractionPromptOpen(true)}
            onInitFolders={() => void handleInitFolders()}
            onAddFolder={() => void handleAddFolder()}
            onClearFolders={() => { setFolderPaths([]); setLastRenamedPaths([]); setDetectedFolderSizes([]); setManualTargetSizes([]); resetValidationState(); }}
            onRemoveFolder={(path) => void removeFolder(path)}
            onValidate={() => void handleValidate()}
            onRevalidateFailed={() => void handleValidate(failedValidationFolderPaths, true)}
            onRename={() => void handleRename()}
            onTrashValidationFile={(row) => void handleTrashValidationFile(row)}
            onOpenSettings={() => { setRequestedSettingsTab('templates'); setActiveView('settings'); }}
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
            onOpenSettings={() => { setRequestedSettingsTab('workspace'); setActiveView('settings'); }}
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
            activeWorkspacePaths={folderPaths}
          />
        ) : activeView === 'format' ? (
          <FormatProcessor onBusyChange={setFormatBusy} />
        ) : (
          <FormatProcessor onBusyChange={setFormatBusy} />
        )}
      </Box>

      <Modal
        opened={Boolean(folderCreationPrompt)}
        onClose={() => setFolderCreationPrompt(null)}
        centered
        title={folderCreationPrompt?.conflict.kind === 'media-kind' ? '选择素材类型' : '选择目录格式'}
        className="focus-modal"
      >
        <Stack gap="md">
          <Text size="sm">{folderCreationPrompt?.conflict.message}</Text>
          {Boolean(folderCreationPrompt?.conflict.projectNames?.length) && (
            <Card withBorder p="xs">
              <Text size="xs" c="dimmed" mb={4}>无法自动判断的项目</Text>
              <Text size="sm" fw={700}>{folderCreationPrompt?.conflict.projectNames?.join('、')}</Text>
            </Card>
          )}
          <Group gap="xs">
            {folderCreationPrompt?.conflict.options.map((option) => (
              <Button key={option.value} variant="light" onClick={() => resolveFolderCreationConflict(option.value)}>
                {option.label}
              </Button>
            ))}
          </Group>
          <Text size="xs" c="dimmed">选择只影响本次创建；已有文件夹不会改名，也不会覆盖内容。</Text>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(folderCreationReport)}
        onClose={() => setFolderCreationReport(null)}
        centered
        size="calc(100vw - 32px)"
        title="目录准备报告"
        className="focus-modal"
      >
        <Stack gap="sm">
          <Group gap={6}>
            <Badge color="teal">新建 {folderCreationReport?.createdPaths?.length || 0}</Badge>
            <Badge color="gray">复用 {folderCreationReport?.reusedPaths?.length || 0}</Badge>
            <Badge color="blue">项目目录 {folderCreationReport?.projectPaths?.length || 0}</Badge>
          </Group>
          <Text size="xs" c="dimmed" truncate>本次位置：{folderCreationReport?.destPath}</Text>
          <ScrollArea h="min(55vh, 380px)" type="auto">
            <Stack gap="sm">
              <Box>
                <Text size="xs" fw={800} mb={4}>新建目录</Text>
                {(folderCreationReport?.createdPaths || []).map((path) => <Text key={path} size="xs" c="teal" truncate>{path}</Text>)}
                {!folderCreationReport?.createdPaths?.length && <Text size="xs" c="dimmed">没有新建目录，全部沿用现有目录。</Text>}
              </Box>
              <Box>
                <Text size="xs" fw={800} mb={4}>已存在并复用</Text>
                {(folderCreationReport?.reusedPaths || []).map((path) => <Text key={path} size="xs" c="dimmed" truncate>{path}</Text>)}
              </Box>
              {Boolean(folderCreationReport?.warnings?.length) && <Box><Text size="xs" fw={800} c="orange" mb={4}>提示</Text>{folderCreationReport?.warnings?.map((warning) => <Text key={warning} size="xs" c="orange">{warning}</Text>)}</Box>}
            </Stack>
          </ScrollArea>
          <Group justify="flex-end"><Button onClick={() => setFolderCreationReport(null)}>知道了</Button></Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(pendingExtractionCandidate) && isExtractionPromptOpen}
        onClose={() => setIsExtractionPromptOpen(false)}
        centered
        title="发现新抓取"
      >
        <Stack gap="md">
          <Text size="sm">
            {pendingExtractionCandidate?.payload.projects.length || 0} 个项目，载入后替换当前需求。
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => {
              setIsExtractionPromptOpen(false);
            }}>
              稍后载入
            </Button>
            <Button onClick={() => {
              if (!pendingExtractionCandidate) return;
              const session = buildDailyRequirementSessionFromExtraction(pendingExtractionCandidate);
              applyDailyRequirementSession(session, '已载入扩展最新抓取');
              setPendingExtractionCandidate(null);
              setIsExtractionPromptOpen(false);
              setActiveView('daily');
            }}>
              立即载入
            </Button>
          </Group>
        </Stack>
      </Modal>

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

      <Modal opened={historyOpened} onClose={() => setHistoryOpened(false)} centered size="calc(100vw - 32px)" title="历史记录" className="focus-modal">
        <Stack gap="sm">
          <Text size="xs" c="dimmed">普通处理记录自动保留 {workspaceSettings.historyRetentionDays} 天</Text>
          <ScrollArea h="min(62vh, 440px)" type="auto"><Stack gap="sm">
          {historyData.length === 0 && <Text c="dimmed">暂无历史记录</Text>}
          {historyData.map((item) => (
            <Card key={item.id} withBorder radius="xl">
              <Group justify="space-between">
                <Box>
                  <Text fw={700}>{item.project}</Text>
                  <Text size="sm" c="dimmed">重命名 · {item.count} 个文件</Text>
                </Box>
                <Stack gap={4} align="flex-end">
                  <Badge color={item.cleanedAt ? 'gray' : item.status === 'success' ? 'teal' : item.status === 'warning' ? 'orange' : 'red'} variant="light">
                    {item.cleanedAt ? '素材已清理' : formatHistoryTime(item.timestamp)}
                  </Badge>
                  {item.paths?.[0] && <Button size="compact-xs" variant="subtle" disabled={Boolean(item.cleanedAt)} onClick={() => window.electronAPI.shell.openPath(item.paths![0])}>打开目录</Button>}
                </Stack>
              </Group>
            </Card>
          ))}
          </Stack></ScrollArea>
        </Stack>
      </Modal>
    </Flex>
  );
}
