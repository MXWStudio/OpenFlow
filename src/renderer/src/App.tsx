import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
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
import { notifications } from '@mantine/notifications';
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
  type ApiKeys,
  type HistoryEntry,
  type TemplateKey,
  type TokenType,
  type UserInfo,
  type ValidationResult,
  type WorkflowSettings,
} from './appState';
import { DailyWorkspace } from './views/DailyWorkspace';

type ViewKey = 'daily' | 'ai' | 'bitable';

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>('daily');
  const [isAppReady, setIsAppReady] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isChangingJson, setIsChangingJson] = useState(false);
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['1920*1080', '1080*1920']);
  const [projectsList, setProjectsList] = useState<Array<{ projectName: string; sizes: string[] }>>([]);
  const [jsonFileName, setJsonFileName] = useState('');
  const [producerName, setProducerName] = useState('MXW');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [historyOpened, setHistoryOpened] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>('account');
  const [userInfo, setUserInfo] = useState<UserInfo>(DEFAULT_USER_INFO);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>(DEFAULT_WORKFLOW);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(DEFAULT_API_KEYS);
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
        setWorkflowSettings({
          defaultOutputDir: stored.defaultOutputDir ?? '',
          renameTemplates: stored.renameTemplates ?? DEFAULT_WORKFLOW.renameTemplates,
        });
      }
      if (config.renameTemplates) {
        setWorkflowSettings((prev) => ({ ...prev, renameTemplates: config.renameTemplates as WorkflowSettings['renameTemplates'] }));
      }
      if (typeof config.defaultOutputDir === 'string') {
        setWorkflowSettings((prev) => ({ ...prev, defaultOutputDir: config.defaultOutputDir as string }));
      }
      if (config.apiKeys && typeof config.apiKeys === 'object') {
        const stored = config.apiKeys as Record<string, string>;
        setApiKeys({ geminiKey: stored.geminiKey ?? '', sdPath: stored.sdPath ?? '' });
      }
      if (Array.isArray(config.history)) setHistoryData(config.history as HistoryEntry[]);
    }).finally(() => setIsAppReady(true));
  }, []);

  function notify(color: 'green' | 'red' | 'orange' | 'gray', title: string, message?: string) {
    notifications.show({ color, title, message, autoClose: 3000 });
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
      if (result.producerName) {
        setProducerName(result.producerName);
        setUserInfo((prev) => ({ ...prev, name: result.producerName as string }));
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
    setIsTableExpanded(true);
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
      if (issues === 0) notify('green', '校验通过', '全部素材符合要求。');
      else notify('red', '校验异常', `${issues} 项素材存在问题。`);
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
      const results = await window.electronAPI.fs.executeRename(validFiles, templates, primaryProjectName, producerName);
      const successCount = results.filter((item) => item.success).length;
      const failed = results.filter((item) => !item.success);
      if (failed.length === 0) notify('green', '重命名完成', `${successCount} 个文件`);
      else notify('red', '重命名部分失败', failed[0]?.error || '部分文件可能被占用。');
      if (successCount > 0) {
        const nextHistory: HistoryEntry[] = [{ id: Date.now(), project: primaryProjectName || 'Untitled Project', count: successCount, status: failed.length === 0 ? 'success' : 'warning', timestamp: Date.now() }, ...historyData].slice(0, 20);
        setHistoryData(nextHistory);
        await window.electronAPI.store.set('history', nextHistory);
        setFolderPaths([]);
        resetValidationState();
      }
    } catch {
      notify('red', '重命名部分失败', '部分文件可能被占用或命名冲突。');
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleSaveSettings() {
    await window.electronAPI.store.set('userInfo', userInfo);
    await window.electronAPI.store.set('workflow', workflowSettings);
    await window.electronAPI.store.set('renameTemplates', workflowSettings.renameTemplates);
    await window.electronAPI.store.set('defaultOutputDir', workflowSettings.defaultOutputDir);
    await window.electronAPI.store.set('apiKeys', apiKeys);
    notify('green', '设置已保存');
    setSettingsOpened(false);
  }

  const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode; color: string }> = [
    { key: 'daily', label: '日常', icon: <CalendarDays size={20} />, color: 'blue' },
    { key: 'ai', label: 'AI识图', icon: <Sparkles size={20} />, color: 'violet' },
    { key: 'bitable', label: '表格', icon: <TableProperties size={20} />, color: 'teal' },
  ];

  if (!isAppReady) {
    return <Flex h="100vh" align="center" justify="center"><Text>Loading...</Text></Flex>;
  }

  return (
    <Flex h="100vh" style={{ background: '#f7f9fc', overflow: 'hidden' }}>
      <Box
        w={92}
        style={{
          background: '#1d2230',
          color: '#d5deed',
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
                background: 'linear-gradient(90deg, #fb923c 0%, #f472b6 50%, #818cf8 100%)',
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
                  color: '#b4c0d4',
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
                  color: '#b4c0d4',
                },
              }}
            >
              <Plus size={28} />
            </ActionIcon>
          </Stack>

          <Box my={4} w={46} h={1} bg="rgba(255,255,255,0.1)" />

          <Stack gap={10} align="center" mt={18}>
            {navItems.map((item) => {
              const active = activeView === item.key;

              return (
                <Button
                  key={item.key}
                  variant="subtle"
                  color={item.color as never}
                  radius={20}
                  onClick={() => setActiveView(item.key)}
                  styles={{
                    root: {
                      position: 'relative',
                      width: 72,
                      height: 72,
                      padding: 0,
                      flexDirection: 'column',
                      gap: 6,
                      color: active ? '#e2eeff' : '#a8b5c9',
                      background: active ? 'rgba(46, 88, 168, 0.34)' : 'transparent',
                      fontWeight: 900,
                    },
                    label: {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      lineHeight: 1,
                    },
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
                        background: '#4f8dff',
                      }}
                    />
                  )}
                  {item.icon}
                  <Text size="xs" fw={900}>
                    {item.label}
                  </Text>
                </Button>
              );
            })}
          </Stack>

          <Box style={{ marginTop: 'auto' }} />

          <Stack gap={16} align="center" pb={10}>
            <Indicator color="red" size={8} offset={5}>
              <ActionIcon
                variant="subtle"
                styles={{
                  root: {
                    width: 46,
                    height: 46,
                    color: '#a8b5c9',
                  },
                }}
              >
                <Bell size={22} />
              </ActionIcon>
            </Indicator>
            <ActionIcon
              variant="subtle"
              onClick={() => setSettingsOpened(true)}
              styles={{
                root: {
                  width: 46,
                  height: 46,
                  color: '#a8b5c9',
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
            hasValidated={hasValidated}
            hasIssues={hasIssues}
            canRename={canRename}
            isTableExpanded={isTableExpanded}
            onToggleTable={() => setIsTableExpanded((prev) => !prev)}
            onToggleSize={(size) => setSelectedSizes((prev) => prev.includes(size) ? prev.filter((item) => item !== size) : [...prev, size])}
            onChangeJson={() => void handleChangeJson()}
            onInitFolders={() => void handleInitFolders()}
            onAddFolder={() => void handleAddFolder()}
            onClearFolders={() => { setFolderPaths([]); setSelectedSizes([]); resetValidationState(); }}
            onRemoveFolder={(path) => { setFolderPaths((prev) => prev.filter((item) => item !== path)); resetValidationState(); }}
            onValidate={() => void handleValidate()}
            onRename={() => void handleRename()}
            onOpenSettings={() => setSettingsOpened(true)}
            onOpenHistory={() => setHistoryOpened(true)}
            onDropPaths={(paths) => void addFolders(dedupeStrings(paths))}
          />
        ) : (
          <Flex h="100%" align="center" justify="center" p={40}>
            <Card radius={32} p="xl" withBorder shadow="sm" maw={720}>
              <Stack gap="sm">
                <Badge color={activeView === 'ai' ? 'violet' : 'teal'} variant="light" w="fit-content">
                  {activeView === 'ai' ? 'AI 识图' : '多维表格'}
                </Badge>
                <Title order={2}>{activeView === 'ai' ? 'AI识图版块' : '表格版块'}</Title>
                <Text c="dimmed">
                  原来的后端功能已经全部放到“日常”版块。这里先保留为新界面占位区，后续按你的设计继续细化。
                </Text>
              </Stack>
            </Card>
          </Flex>
        )}
      </Box>

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

      <Drawer opened={settingsOpened} onClose={() => setSettingsOpened(false)} position="right" size="70%" title="系统设置">
        <Flex h="100%" direction="column" gap="md">
          <ScrollArea className="app-scroll" style={{ flex: 1 }}>
            <Tabs value={settingsTab} onChange={(value) => setSettingsTab(value || 'account')}>
              <Tabs.List>
                <Tabs.Tab value="account" leftSection={<User size={16} />}>账户配置</Tabs.Tab>
                <Tabs.Tab value="workflow" leftSection={<Workflow size={16} />}>工作流设置</Tabs.Tab>
                <Tabs.Tab value="integrations" leftSection={<Cpu size={16} />}>AI 集成</Tabs.Tab>
                <Tabs.Tab value="advanced" leftSection={<Shield size={16} />}>高级系统</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="account" pt="lg">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                  <TextInput label="姓名" value={userInfo.name} onChange={(event) => { setUserInfo((prev) => ({ ...prev, name: event.currentTarget.value })); setProducerName(event.currentTarget.value); }} />
                  <TextInput label="部门" value={userInfo.department} onChange={(event) => setUserInfo((prev) => ({ ...prev, department: event.currentTarget.value }))} />
                  <TextInput label="邮箱" value={userInfo.email} onChange={(event) => setUserInfo((prev) => ({ ...prev, email: event.currentTarget.value }))} style={{ gridColumn: '1 / -1' }} />
                </SimpleGrid>
              </Tabs.Panel>
              <Tabs.Panel value="workflow" pt="lg">
                <Stack gap="lg">
                  <TextInput label="默认输出目录" value={workflowSettings.defaultOutputDir} onChange={(event) => setWorkflowSettings((prev) => ({ ...prev, defaultOutputDir: event.currentTarget.value }))} />
                  <Code block>{jsonFileName || '未加载 JSON'}</Code>
                  {(Object.keys(workflowSettings.renameTemplates) as TemplateKey[]).map((templateKey) => (
                    <Card key={templateKey} withBorder radius="xl">
                      <Stack gap="md">
                        <Text fw={700}>{TEMPLATE_LABELS[templateKey]}</Text>
                        {workflowSettings.renameTemplates[templateKey].map((token, index) => (
                          <Group key={`${templateKey}-${index}`} align="flex-end" wrap="nowrap">
                            <Select
                              data={TOKEN_OPTIONS}
                              value={token.type}
                              onChange={(value) => {
                                if (!value) return;
                                setWorkflowSettings((prev) => ({
                                  ...prev,
                                  renameTemplates: {
                                    ...prev.renameTemplates,
                                    [templateKey]: prev.renameTemplates[templateKey].map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, type: value as TokenType, value: value === 'CustomText' ? item.value : undefined } : item,
                                    ),
                                  },
                                }));
                              }}
                              style={{ flex: 1 }}
                            />
                            {token.type === 'CustomText' && (
                              <TextInput
                                value={token.value || ''}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  setWorkflowSettings((prev) => ({
                                    ...prev,
                                    renameTemplates: {
                                      ...prev.renameTemplates,
                                      [templateKey]: prev.renameTemplates[templateKey].map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, value } : item,
                                      ),
                                    },
                                  }));
                                }}
                                style={{ flex: 1 }}
                              />
                            )}
                          </Group>
                        ))}
                        <Code>{buildTemplatePreview(workflowSettings.renameTemplates[templateKey], producerName)}</Code>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="integrations" pt="lg">
                <Stack gap="lg">
                  <PasswordInput label="Gemini API Key" value={apiKeys.geminiKey} onChange={(event) => setApiKeys((prev) => ({ ...prev, geminiKey: event.currentTarget.value }))} />
                  <TextInput label="Stable Diffusion 地址" value={apiKeys.sdPath} onChange={(event) => setApiKeys((prev) => ({ ...prev, sdPath: event.currentTarget.value }))} />
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="advanced" pt="lg">
                <Stack gap="md">
                  <Button color="red" variant="light" leftSection={<Trash2 size={16} />} onClick={async () => { await window.electronAPI.store.delete('history'); setHistoryData([]); }}>
                    清理历史缓存
                  </Button>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </ScrollArea>
          <Group justify="flex-end">
            <Button leftSection={<Save size={16} />} onClick={() => void handleSaveSettings()}>保存设置</Button>
          </Group>
        </Flex>
      </Drawer>
    </Flex>
  );
}
