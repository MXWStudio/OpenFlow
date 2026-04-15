import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Code,
  Drawer,
  Flex,
  Group,
  Indicator,
  PasswordInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notify } from './utils/notify';
import { createAvatar } from '@dicebear/core';
import * as dylan from '@dicebear/dylan';
import {
  Bell,
  CalendarDays,
  Cpu,
  History,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  Sparkles,
  TableProperties,
  Trash2,
  User,
  Workflow,
  FolderSearch,
  Library,
} from 'lucide-react';
import {
  buildTemplatePreview,
  dedupeStrings,
  DEFAULT_API_KEYS,
  DEFAULT_USER_INFO,
  DEFAULT_WORKFLOW,
  formatHistoryTime,
  getDirFromFilePath,
  PRESET_SIZES,
  TEMPLATE_LABELS,
  TOKEN_OPTIONS,
  DEFAULT_SYSTEM,
  DEFAULT_WORKSPACE,
  DEFAULT_SHORTCUTS,
  DEFAULT_PROCESSING,
  DEFAULT_DATA_STATS,
  DEFAULT_SCREENSHOT,
  type ApiKeys,
  type HistoryEntry,
  type NotificationHistoryEntry,
  type TemplateKey,
  type TokenType,
  type UserInfo,
  type ValidationResult,
  type WorkflowSettings,
  type SystemSettings,
  type WorkspaceSettings,
  type ShortcutSettings,
  type ProcessingSettings,
  type DataStatsSettings,
  type ScreenshotSettings,
} from './appState';
import { DailyWorkspace } from './views/DailyWorkspace';
import { OrganizerWorkspace } from './views/OrganizerWorkspace';
import { BitableWorkspace } from './views/BitableWorkspace';
import { FormatProcessor } from './views/FormatProcessor';
import { SettingsWorkspace } from './views/SettingsWorkspace';
import { AiWorkspace } from './views/AiWorkspace';
import { GameDictionaryWorkspace } from './views/GameDictionaryWorkspace';

type ViewKey = 'daily' | 'organizer' | 'ai' | 'bitable' | 'format' | 'dictionary' | 'settings';

import { useMantineColorScheme } from '@mantine/core';

export default function App() {
  const [isQimiEnabled, setIsQimiEnabled] = useState(true);
  const [activeView, setActiveView] = useState<ViewKey>('daily');
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [isAppReady, setIsAppReady] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSpecialEnabled, setIsSpecialEnabled] = useState(false);
  const [isManualEnabled, setIsManualEnabled] = useState(false);
  const [isChangingJson, setIsChangingJson] = useState(false);
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [lastRenamedPaths, setLastRenamedPaths] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['1920*1080', '1080*1920']);
  const [projectsList, setProjectsList] = useState<Array<{ projectName: string; sizes: string[] }>>([]);
  const [jsonFileName, setJsonFileName] = useState('');
  const [producerName, setProducerName] = useState('MXW');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [historyOpened, setHistoryOpened] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryEntry[]>([]);
  const [isNotificationCenterOpened, setIsNotificationCenterOpened] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>(DEFAULT_USER_INFO);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>(DEFAULT_WORKFLOW);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(DEFAULT_API_KEYS);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE);
  const [shortcutSettings, setShortcutSettings] = useState<ShortcutSettings>(DEFAULT_SHORTCUTS);
  const [processingSettings, setProcessingSettings] = useState<ProcessingSettings>(DEFAULT_PROCESSING);
  const [dataStatsSettings, setDataStatsSettings] = useState<DataStatsSettings>(DEFAULT_DATA_STATS);
  const [screenshotSettings, setScreenshotSettings] = useState<ScreenshotSettings>(DEFAULT_SCREENSHOT);
  const [layoutLeft, setLayoutLeft] = useState<string[]>(['todayData', 'createDir', 'sizePreview']);
  const [layoutRight, setLayoutRight] = useState<string[]>(['systemStatus', 'quickActions', 'mediaDetails']);
  const dragCounter = useRef(0);

  const primaryProjectName = projectsList[0]?.projectName ?? '';
  const hasIssues = hasValidated && validationResults.some((item) => item.status !== 'valid');
  const canRename = hasValidated && validationResults.length > 0 && !hasIssues;

  const allDisplaySizes = useMemo(() => dedupeStrings([...PRESET_SIZES, ...selectedSizes]), [selectedSizes]);
  const horizontalSizes = useMemo(
    () => allDisplaySizes.filter((size) => Number(size.split('*')[0]) >= Number(size.split('*')[1])),
    [allDisplaySizes],
  );
  const verticalSizes = useMemo(
    () => allDisplaySizes.filter((size) => Number(size.split('*')[0]) < Number(size.split('*')[1])),
    [allDisplaySizes],
  );
  const avatarSrc = useMemo(
    () =>
      createAvatar(dylan, {
        seed: userInfo.name || 'MXW',
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
        const stored = config.userInfo as Record<string, string>;
        const next = { name: stored.name ?? '', department: stored.department ?? '', email: stored.email ?? '' };
        setUserInfo(next);
        if (next.name) setProducerName(next.name);
      }
      if (config.workflow && typeof config.workflow === 'object') {
        const stored = config.workflow as Partial<WorkflowSettings>;
        setWorkflowSettings((prev) => ({
          ...prev,
          ...stored,
          renameTemplates: stored.renameTemplates || prev.renameTemplates,
          organizerFormats: stored.organizerFormats || prev.organizerFormats,
        }));
      } else {
        // Fallback for older config format
        if (config.renameTemplates) {
          setWorkflowSettings((prev) => ({ ...prev, renameTemplates: config.renameTemplates as WorkflowSettings['renameTemplates'] }));
        }
        if (typeof config.defaultOutputDir === 'string') {
          setWorkflowSettings((prev) => ({ ...prev, defaultOutputDir: config.defaultOutputDir as string }));
        }
      }
      if (config.apiKeys && typeof config.apiKeys === 'object') {
        const stored = config.apiKeys as Record<string, string>;
        setApiKeys({ geminiKey: stored.geminiKey ?? '', sdPath: stored.sdPath ?? '' });
      }

      // Load newly added state types
      if (config.systemSettings) {
        const sys = config.systemSettings as SystemSettings;
        setSystemSettings(sys);
        if (sys.theme) {
          setColorScheme(sys.theme);
        }
      }
      if (config.workspaceSettings) setWorkspaceSettings(config.workspaceSettings as WorkspaceSettings);
      if (config.shortcutSettings) setShortcutSettings(config.shortcutSettings as ShortcutSettings);
      else if (config.screenshotShortcut) {
        // Migration from old single shortcut state
        setShortcutSettings(prev => ({ ...prev, screenshot: config.screenshotShortcut as string }));
      }
      if (config.processingSettings) setProcessingSettings(config.processingSettings as ProcessingSettings);
      if (config.dataStatsSettings) setDataStatsSettings(config.dataStatsSettings as DataStatsSettings);
      if (config.screenshotSettings) setScreenshotSettings(config.screenshotSettings as ScreenshotSettings);

      if (Array.isArray(config.history)) setHistoryData(config.history as HistoryEntry[]);
      if (Array.isArray(config.notificationHistory)) setNotificationHistory(config.notificationHistory as NotificationHistoryEntry[]);
      if (Array.isArray(config.dailyLayoutLeft)) setLayoutLeft(config.dailyLayoutLeft as string[]);
      if (Array.isArray(config.dailyLayoutRight)) setLayoutRight(config.dailyLayoutRight as string[]);
    }).finally(() => setIsAppReady(true));
  }, []);

  async function handleLayoutChange(left: string[], right: string[]) {
    setLayoutLeft(left);
    setLayoutRight(right);
    if (window.electronAPI) {
      await window.electronAPI.store.set('dailyLayoutLeft', left);
      await window.electronAPI.store.set('dailyLayoutRight', right);
    }
  }


  function resetValidationState() {
    setValidationResults([]);
    setHasValidated(false);
  }

  async function handleChangeJson() {
    setIsChangingJson(true);
    try {
      const result = await window.electronAPI.dialog.openJson();
      if (!result) return;
      const projects = Array.isArray((result as { projects?: unknown[] }).projects)
        ? ((result as { projects?: Array<{ projectName: string; sizes: string[] }> }).projects || [])
        : [];
      setProjectsList(projects);
      setJsonFileName(result.fileName ? result.fileName.replace(/\.json$/i, '') : '');
      if (result.producerName || result.department || result.email) {
        if (result.producerName) {
          setProducerName(result.producerName as string);
        }
        setUserInfo((prev) => {
          const newUserInfo = {
            ...prev,
            ...(result.producerName ? { name: result.producerName as string } : {}),
            ...(result.department ? { department: result.department as string } : {}),
            ...(result.email ? { email: result.email as string } : {}),
          };
          if (window.electronAPI && window.electronAPI.store) {
            window.electronAPI.store.set('userInfo', newUserInfo);
          }
          return newUserInfo;
        });
      }
      const sizeSet = new Set<string>();
      projects.forEach((project) => project.sizes.forEach((size) => sizeSet.add(size)));
      (result.sizes || []).forEach((size) => sizeSet.add(size));
      if (sizeSet.size) setSelectedSizes([...sizeSet]);
      notify('green', '需求表已更新', result.fileName ?? undefined);
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
      if (detectedSizes.length) setSelectedSizes(detectedSizes);
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
      if (result.success) notify('green', '目录创建完成', result.destPath);
      else notify('red', '目录创建失败', result.error);
    } catch {
      notify('red', '目录创建失败');
    }
  }

  async function handleValidate() {
    if (!folderPaths.length) return notify('orange', '工作区为空', '请先添加素材目录。');
    if (!selectedSizes.length) return notify('orange', '未选择尺寸', '请先勾选目标尺寸。');

    setIsValidating(true);
    setValidationResults([]);
    setHasValidated(false);
    try {
      const allResults: ValidationResult[] = [];
      for (const folderPath of folderPaths) {
        const results = await window.electronAPI.fs.startValidation(folderPath, selectedSizes);
        const sep = folderPath.includes('\\') ? '\\' : '/';
        const projectName = folderPath.substring(folderPath.lastIndexOf(sep) + 1);
        allResults.push(...results.map((item) => ({ ...item, workspaceProjectName: projectName })));
      }
      setValidationResults(allResults);
      setHasValidated(true);
      const issues = allResults.filter((item) => item.status !== 'valid').length;
      if (issues === 0) {
        notify('green', '校验通过', '全部素材符合要求。');
      } else {
        notify('red', '校验异常', `${issues} 项素材存在问题。`);
        setIsTableExpanded(true);
      }
    } catch {
      notify('red', '校验失败', '校验过程中发生错误，请重试。');
    } finally {
      setIsValidating(false);
    }
  }

  async function handleRename() {
    if (!canRename) return notify('red', '无法执行重命名', '只有全部通过校验后才能继续。');
    setIsRenaming(true);
    try {
      const storedTemplates = await window.electronAPI.store.get<WorkflowSettings['renameTemplates']>('renameTemplates');
      const templates = storedTemplates || workflowSettings.renameTemplates;
      const validFiles = validationResults.filter((item) => item.status === 'valid');
      const results = await window.electronAPI.fs.executeRename(validFiles, templates, primaryProjectName, producerName, isSpecialEnabled, isManualEnabled);
      const successCount = results.filter((item) => item.success).length;
      const failed = results.filter((item) => !item.success);
      if (failed.length === 0) notify('green', '重命名完成', `${successCount} 个文件`);
      else notify('red', '重命名部分失败', failed[0]?.error || '部分文件可能被占用。');
      if (successCount > 0) {
        const folderNames = folderPaths.map((p) => {
          const sep = p.includes('\\') ? '\\' : '/';
          return p.substring(p.lastIndexOf(sep) + 1);
        }).join(', ');
        const nextHistory: HistoryEntry[] = [{ id: Date.now(), project: folderNames || 'Untitled Folder', count: successCount, status: failed.length === 0 ? 'success' : 'warning', timestamp: Date.now() }, ...historyData].slice(0, 20);
        setHistoryData(nextHistory);
        await window.electronAPI.store.set('history', nextHistory);
        setLastRenamedPaths([...folderPaths]);
        setFolderPaths([]);
        resetValidationState();
      }
    } catch {
      notify('red', '重命名部分失败', '部分文件可能被占用或命名冲突。');
    } finally {
      setIsRenaming(false);
    }
  }

  const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode; color: string }> = [
    { key: 'daily', label: '日常', icon: <CalendarDays size={20} />, color: 'blue' },
    { key: 'organizer', label: '整理', icon: <FolderSearch size={20} />, color: 'indigo' },
    { key: 'format', label: '格式处理', icon: <Workflow size={20} />, color: 'orange' },
    { key: 'ai', label: 'AI识图', icon: <Sparkles size={20} />, color: 'violet' },
    { key: 'bitable', label: '表格', icon: <TableProperties size={20} />, color: 'teal' },
    { key: 'dictionary', label: '库', icon: <Library size={20} />, color: 'pink' },
  ];

  if (!isAppReady) {
    return <Flex h="100vh" align="center" justify="center"><Text>Loading...</Text></Flex>;
  }

  return (
    <Flex h="100vh" style={{ background: 'var(--mantine-color-body)', overflow: 'hidden' }}>
      <Box
        w={92}
        style={{
          background: colorScheme === 'dark' ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-1)',
          boxShadow: '4px 0 24px rgba(15, 23, 42, 0.16)',
          zIndex: 20,
        }}
      >
        <Flex direction="column" h="100%" align="center" py={18}>
          <Box mb={30} mt={2} style={{ position: 'relative' }}>
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
                background: 'linear-gradient(90deg, var(--mantine-color-orange-filled) 0%, var(--mantine-color-pink-filled) 50%, var(--mantine-color-indigo-filled) 100%)',
              }}
            />
          </Box>

          <Stack gap={12} align="center" mb={22}>
            <ActionIcon
              variant="subtle"
              styles={{
                root: {
                  width: 48,
                  height: 48,
                  color: 'var(--mantine-color-dimmed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }}
            >
              <Search size={26} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              styles={{
                root: {
                  width: 48,
                  height: 48,
                  color: 'var(--mantine-color-dimmed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }}
            >
              <Plus size={28} />
            </ActionIcon>
          </Stack>

          <Box my={4} w={46} h={1} bg="'var(--mantine-color-default)'" />

          <Stack gap={10} align="center" mt={18}>
            {navItems.map((item) => {
              const active = activeView === item.key;

              return (
                <button
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
                    background: active ? 'rgba(46, 88, 168, 0.34)' : 'transparent',
                    color: active ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)',
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

          <Stack gap={16} align="center" pb={10}>
            <Indicator color="red" size={8} offset={5} disabled={notificationHistory.length === 0}>
              <ActionIcon
                variant="subtle"
                onClick={() => setIsNotificationCenterOpened(true)}
                styles={{
                  root: {
                    width: 46,
                    height: 46,
                    color: isNotificationCenterOpened ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)',
                    background: isNotificationCenterOpened ? 'rgba(46, 88, 168, 0.34)' : 'transparent',
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
            <ActionIcon
              variant="subtle"
              onClick={() => setActiveView('settings')}
              styles={{
                root: {
                  width: 46,
                  height: 46,
                  color: activeView === 'settings' ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)',
                  background: activeView === 'settings' ? 'rgba(46, 88, 168, 0.34)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                },
              }}
            >
              <Settings size={22} />
            </ActionIcon>
          </Stack>
        </Flex>
      </Box>

      <Box style={{ flex: 1, minWidth: 0 }}>
        {activeView === 'daily' ? (
          <DailyWorkspace
            jsonFileName={jsonFileName}
            projectsCount={projectsList.length}
            selectedSizes={selectedSizes}
            horizontalSizes={horizontalSizes}
            verticalSizes={verticalSizes}
            folderPaths={folderPaths}
            validationResults={validationResults}
            isChangingJson={isChangingJson}
            isValidating={isValidating}
            isRenaming={isRenaming}
            isSpecialEnabled={isSpecialEnabled}
            isManualEnabled={isManualEnabled}
            lastRenamedPaths={lastRenamedPaths}
            onToggleSpecialEnabled={(v) => { setIsSpecialEnabled(v); if (v) setIsManualEnabled(false); }}
            onToggleManualEnabled={(v) => { setIsManualEnabled(v); if (v) setIsSpecialEnabled(false); }}
            hasValidated={hasValidated}
            hasIssues={hasIssues}
            canRename={canRename}
            isTableExpanded={isTableExpanded}
            onToggleTable={() => setIsTableExpanded((prev) => !prev)}
            onToggleSize={(size) => setSelectedSizes((prev) => prev.includes(size) ? prev.filter((item) => item !== size) : [...prev, size])}
            onChangeJson={() => void handleChangeJson()}
            onInitFolders={() => void handleInitFolders()}
            onAddFolder={() => void handleAddFolder()}
            onClearFolders={() => { setFolderPaths([]); setLastRenamedPaths([]); setSelectedSizes([]); resetValidationState(); }}
            onRemoveFolder={(path) => { setFolderPaths((prev) => prev.filter((item) => item !== path)); resetValidationState(); }}
            onValidate={() => void handleValidate()}
            onRename={() => void handleRename()}
            onOpenSettings={() => setActiveView('settings')}
            onOpenHistory={() => setHistoryOpened(true)}
            onDropPaths={(paths) => void addFolders(dedupeStrings(paths))}
            onOpenFolder={(path) => {
              if (window.electronAPI?.shell?.openPath) {
                window.electronAPI.shell.openPath(path);
              }
            }}
            layoutLeft={layoutLeft}
            layoutRight={layoutRight}
            onLayoutChange={handleLayoutChange}
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
          />
        ) : activeView === 'settings' ? (
          <SettingsWorkspace
            userInfo={userInfo}
            setUserInfo={setUserInfo}
            workflowSettings={workflowSettings}
            setWorkflowSettings={setWorkflowSettings}
            apiKeys={apiKeys}
            setApiKeys={setApiKeys}
            systemSettings={systemSettings}
            setSystemSettings={setSystemSettings}
            workspaceSettings={workspaceSettings}
            setWorkspaceSettings={setWorkspaceSettings}
            shortcutSettings={shortcutSettings}
            setShortcutSettings={setShortcutSettings}
            processingSettings={processingSettings}
            setProcessingSettings={setProcessingSettings}
            dataStatsSettings={dataStatsSettings}
            setDataStatsSettings={setDataStatsSettings}
            screenshotSettings={screenshotSettings}
            setScreenshotSettings={setScreenshotSettings}
            producerName={producerName}
          />
        ) : activeView === 'bitable' ? (
          <BitableWorkspace />
        ) : activeView === 'format' ? (
          <FormatProcessor />
        ) : activeView === 'ai' ? (
          <AiWorkspace workflowSettings={workflowSettings} apiKeys={apiKeys} producerName={producerName} />
        ) : activeView === 'dictionary' ? (
          <GameDictionaryWorkspace />
        ) : (
          <Flex h="100%" align="center" justify="center" p={40}>
            <Card radius={32} p="xl" withBorder shadow="sm" maw={720}>
              <Stack gap="sm">
                <Badge color="teal" variant="light" w="fit-content">
                  多维表格
                </Badge>
                <Title order={2}>表格版块</Title>
                <Text c="dimmed">
                  原来的后端功能已经全部放到“日常”版块。这里先保留为新界面占位区，后续按你的设计继续细化。
                </Text>
              </Stack>
            </Card>
          </Flex>
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
                    background: ['green', 'teal'].includes(item.color) ? 'var(--mantine-color-green-filled)' : ['red', 'pink'].includes(item.color) ? 'var(--mantine-color-red-filled)' : ['orange', 'yellow'].includes(item.color) ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-blue-filled)',
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
