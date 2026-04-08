import React, { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Code,
  Divider,
  Flex,
  Group,
  NumberInput,
  PasswordInput,
  Radio,
  ScrollArea,
  Select,
  Popover,
  Table,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  BarChart3,
  Bot,
  Command,
  Cpu,
  FolderSearch,
  HardDrive,
  Info,
  Keyboard,
  Languages,
  MonitorPlay,
  Moon,
  Palette,
  Plus,
  Power,
  RefreshCw,
  Save,
  Settings,
  Sun,
  User,
  Workflow,
  Wrench,
  X,
  Crop,
  Layers,
  Download,
  MousePointer,
  HelpCircle,
} from 'lucide-react';
import {
  buildTemplatePreview,
  DEFAULT_API_KEYS,
  DEFAULT_DATA_STATS,
  DEFAULT_PROCESSING,
  DEFAULT_SHORTCUTS,
  DEFAULT_SYSTEM,
  DEFAULT_USER_INFO,
  DEFAULT_WORKFLOW,
  DEFAULT_WORKSPACE,
  TEMPLATE_LABELS,
  TOKEN_OPTIONS,
  type ApiKeys,
  type DataStatsSettings,
  type ScreenshotSettings,
  type ProcessingSettings,
  type ShortcutSettings,
  type SystemSettings,
  type TemplateKey,
  type TokenType,
  type UserInfo,
  type WorkflowSettings,
  type WorkspaceSettings,
} from '../appState';
import { parseNamingRule } from '../screenshotUtils';

interface SettingsWorkspaceProps {
  userInfo: UserInfo;
  setUserInfo: React.Dispatch<React.SetStateAction<UserInfo>>;
  workflowSettings: WorkflowSettings;
  setWorkflowSettings: React.Dispatch<React.SetStateAction<WorkflowSettings>>;
  apiKeys: ApiKeys;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>;
  systemSettings: SystemSettings;
  setSystemSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  workspaceSettings: WorkspaceSettings;
  setWorkspaceSettings: React.Dispatch<React.SetStateAction<WorkspaceSettings>>;
  shortcutSettings: ShortcutSettings;
  setShortcutSettings: React.Dispatch<React.SetStateAction<ShortcutSettings>>;
  processingSettings: ProcessingSettings;
  setProcessingSettings: React.Dispatch<React.SetStateAction<ProcessingSettings>>;
  dataStatsSettings: DataStatsSettings;
  setDataStatsSettings: React.Dispatch<React.SetStateAction<DataStatsSettings>>;
  screenshotSettings: ScreenshotSettings;
  setScreenshotSettings: React.Dispatch<React.SetStateAction<ScreenshotSettings>>;
  producerName: string;
}

export function SettingsWorkspace({
  userInfo,
  setUserInfo,
  workflowSettings,
  setWorkflowSettings,
  apiKeys,
  setApiKeys,
  systemSettings,
  setSystemSettings,
  workspaceSettings,
  setWorkspaceSettings,
  shortcutSettings,
  setShortcutSettings,
  processingSettings,
  setProcessingSettings,
  dataStatsSettings,
  setDataStatsSettings,
  screenshotSettings,
  setScreenshotSettings,
  producerName,
}: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<string>('system');
  const [shortcutConflicts, setShortcutConflicts] = useState<Record<keyof ShortcutSettings, boolean>>({
    togglePanel: false,
    screenshot: false,
    screenshotAndCopy: false,
    customScreenshot: false,
    pinImage: false,
    hideShowAllPins: false,
    switchPinGroup: false,
  });

  // Check shortcut conflicts
  const checkShortcut = async (key: keyof ShortcutSettings, value: string) => {
    if (!window.electronAPI?.ipcRenderer) return;
    try {
      const isRegistered = await window.electronAPI.ipcRenderer.invoke('shortcut:check', value);
      setShortcutConflicts(prev => ({ ...prev, [key]: isRegistered }));
    } catch (e) {
      console.error('Failed to check shortcut', e);
    }
  };

  const handleShortcutChange = (key: keyof ShortcutSettings, value: string) => {
    setShortcutSettings((prev) => ({ ...prev, [key]: value }));
    checkShortcut(key, value);
  };

  const handleSaveSettings = async () => {
    if (!window.electronAPI) return;

    await window.electronAPI.store.set('userInfo', userInfo);
    await window.electronAPI.store.set('workflow', workflowSettings);
    await window.electronAPI.store.set('apiKeys', apiKeys);
    await window.electronAPI.store.set('systemSettings', systemSettings);
    await window.electronAPI.store.set('workspaceSettings', workspaceSettings);
    await window.electronAPI.store.set('shortcutSettings', shortcutSettings);
    await window.electronAPI.store.set('processingSettings', processingSettings);
    await window.electronAPI.store.set('dataStatsSettings', dataStatsSettings);
    await window.electronAPI.store.set('screenshotSettings', screenshotSettings);

    // Legacy settings (need to keep for backwards compatibility if parts of app depend on it)
    await window.electronAPI.store.set('screenshotShortcut', shortcutSettings.screenshot);
    await window.electronAPI.store.set('renameTemplates', workflowSettings.renameTemplates);
    await window.electronAPI.store.set('defaultOutputDir', workflowSettings.defaultOutputDir);

    // Apply system level settings
    if (window.electronAPI.ipcRenderer) {
      window.electronAPI.ipcRenderer.invoke('settings:applySystem', systemSettings);
      window.electronAPI.ipcRenderer.invoke('shortcut:update', shortcutSettings);
    }

    notifications.show({ color: 'green', title: '设置已保存', message: '所有配置已成功更新' });
  };

  const selectFolder = async (setter: (val: string) => void) => {
    if (!window.electronAPI?.dialog) return;
    const folderPath = await window.electronAPI.dialog.selectFolder();
    if (folderPath) setter(folderPath);
  };

  return (
    <Flex h="100%" direction="column">
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group justify="space-between">
          <Group>
            <Settings size={24} color="#4f8dff" />
            <Title order={3}>设置中心</Title>
          </Group>
        </Group>
      </Box>

      <Flex flex={1} style={{ overflow: 'hidden', position: 'relative' }}>
        <Tabs
          value={activeTab}
          onChange={(val) => setActiveTab(val || 'system')}
          orientation="vertical"
          variant="pills"
          p="md"
          styles={{
            root: { width: '100%' },
            list: { width: 220, borderRight: '1px solid var(--mantine-color-default-border)', paddingRight: 16, gap: 8 },
            tab: { padding: '12px 16px', fontWeight: 500, borderRadius: 8 },
            panel: { paddingLeft: 32, paddingRight: 32, paddingBottom: 32, overflowY: 'auto' }
          }}
        >
          <Tabs.List>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" mt="xs" px="xs">核心配置</Text>
            <Tabs.Tab value="system" leftSection={<MonitorPlay size={18} />}>常规</Tabs.Tab>
            <Tabs.Tab value="account" leftSection={<User size={18} />}>账户</Tabs.Tab>
            <Tabs.Tab value="workspace" leftSection={<HardDrive size={18} />}>工作区</Tabs.Tab>
            <Tabs.Tab value="templates" leftSection={<Workflow size={18} />}>命名模板</Tabs.Tab>

                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" mt="md" px="xs">工具与增强</Text>
            <Tabs.Tab value="screenshot-control" leftSection={<MousePointer size={18} />}>截图控制</Tabs.Tab>
            <Tabs.Tab value="screenshot-output" leftSection={<Download size={18} />}>截图输出</Tabs.Tab>
            <Tabs.Tab value="screenshot-pin" leftSection={<Layers size={18} />}>截图贴图</Tabs.Tab>

            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" mt="md" px="xs">高级设定</Text>

            <Tabs.Tab value="shortcuts" leftSection={<Keyboard size={18} />}>快捷键</Tabs.Tab>
            <Tabs.Tab value="processing" leftSection={<Cpu size={18} />}>处理引擎</Tabs.Tab>
            <Tabs.Tab value="ai" leftSection={<Bot size={18} />}>AI 集成</Tabs.Tab>
            <Tabs.Tab value="data" leftSection={<BarChart3 size={18} />}>数据看板</Tabs.Tab>

            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" mt="md" px="xs">其他</Text>
            <Tabs.Tab value="about" leftSection={<Info size={18} />}>关于</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="system" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">常规设置</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="lg">
                    <Group justify="space-between">
                      <Box>
                        <Text fw={500}>外观主题</Text>
                        <Text size="sm" c="dimmed">选择界面的颜色风格</Text>
                      </Box>
                      <Select
                        value={systemSettings.theme}
                        onChange={(val: any) => setSystemSettings(prev => ({ ...prev, theme: val || 'auto' }))}
                        data={[
                          { label: '浅色', value: 'light' },
                          { label: '深色', value: 'dark' },
                          { label: '跟随系统', value: 'auto' },
                        ]}
                      />
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Box>
                        <Text fw={500}>界面语言</Text>
                        <Text size="sm" c="dimmed">切换软件的显示语言</Text>
                      </Box>
                      <Select
                        w={150}
                        value={systemSettings.language}
                        onChange={(val: any) => setSystemSettings(prev => ({ ...prev, language: val || 'zh' }))}
                        data={[
                          { label: '简体中文', value: 'zh' },
                          { label: 'English', value: 'en' },
                          { label: '日本語', value: 'ja' },
                        ]}
                      />
                    </Group>
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Title order={4} mb="lg">系统行为</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="lg">
                    <Group justify="space-between">
                      <Box>
                        <Text fw={500}>开机自启动</Text>
                        <Text size="sm" c="dimmed">随系统启动并在后台运行</Text>
                      </Box>
                      <Switch
                        checked={systemSettings.autoStart}
                        onChange={(e) => setSystemSettings(prev => ({ ...prev, autoStart: e.currentTarget.checked }))}
                      />
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Box>
                        <Text fw={500}>关闭主窗口时</Text>
                        <Text size="sm" c="dimmed">点击 X 时最小化到系统托盘，而不是退出程序</Text>
                      </Box>
                      <Switch
                        checked={systemSettings.closeToTray}
                        onChange={(e) => setSystemSettings(prev => ({ ...prev, closeToTray: e.currentTarget.checked }))}
                      />
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Box>
                        <Text fw={500}>自动检查更新</Text>
                        <Text size="sm" c="dimmed">在后台自动静默下载新版本</Text>
                      </Box>
                      <Switch
                        checked={systemSettings.autoUpdate}
                        onChange={(e) => setSystemSettings(prev => ({ ...prev, autoUpdate: e.currentTarget.checked }))}
                      />
                    </Group>
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="account" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">账户信息</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <TextInput
                      label="姓名"
                      description="将用于重命名模板中的制作人拼音缩写"
                      value={userInfo.name}
                      onChange={(e) => setUserInfo((prev) => ({ ...prev, name: e.currentTarget.value }))}
                    />
                    <TextInput
                      label="部门"
                      value={userInfo.department}
                      onChange={(e) => setUserInfo((prev) => ({ ...prev, department: e.currentTarget.value }))}
                    />
                    <TextInput
                      label="邮箱"
                      value={userInfo.email}
                      onChange={(e) => setUserInfo((prev) => ({ ...prev, email: e.currentTarget.value }))}
                    />
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="workspace" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">核心路径配置</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <TextInput
                      label="默认的素材源文件夹路径"
                      placeholder="例如: C:\Users\xxx\Downloads"
                      value={workspaceSettings.sourceDir}
                      onChange={(e) => setWorkspaceSettings((prev) => ({ ...prev, sourceDir: e.currentTarget.value }))}
                      rightSection={
                        <ActionIcon onClick={() => selectFolder((p) => setWorkspaceSettings(prev => ({ ...prev, sourceDir: p })))}>
                          <FolderSearch size={16} />
                        </ActionIcon>
                      }
                    />
                    <TextInput
                      label="目标主文件夹路径"
                      description="重命名后文件/目录转移的根路径"
                      placeholder="例如: D:\Assets\Games"
                      value={workspaceSettings.destDir}
                      onChange={(e) => setWorkspaceSettings((prev) => ({ ...prev, destDir: e.currentTarget.value }))}
                      rightSection={
                        <ActionIcon onClick={() => selectFolder((p) => setWorkspaceSettings(prev => ({ ...prev, destDir: p })))}>
                          <FolderSearch size={16} />
                        </ActionIcon>
                      }
                    />
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Title order={4} mb="lg">文件规则</Title>
                <Card withBorder radius="md" p="lg">
                  <Radio.Group
                    name="duplicateAction"
                    label="遇到同名文件的处理方式"
                    value={workspaceSettings.duplicateAction}
                    onChange={(val: any) => setWorkspaceSettings(prev => ({ ...prev, duplicateAction: val }))}
                  >
                    <Stack mt="xs">
                      <Radio value="rename" label="自动重命名 (例如加 _1 后缀)" />
                      <Radio value="overwrite" label="直接覆盖" />
                      <Radio value="skip" label="跳过" />
                    </Stack>
                  </Radio.Group>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="templates" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">重命名模板配置</Title>
                <Stack gap="lg">
                  {['视频版块', '图片版块', 'AI识别命名'].map((sectionTitle) => {
                    const keys: TemplateKey[] = sectionTitle === '视频版块'
                      ? ['videoRegular', 'videoSpecial']
                      : sectionTitle === '图片版块'
                      ? ['imageRegular', 'imageSpecial']
                      : ['aiImage'];

                    return (
                      <Card key={sectionTitle} withBorder radius="md" p="lg">
                        <Title order={5} mb="md">{sectionTitle}</Title>
                        <Stack gap="xl">
                          {keys.map((templateKey) => (
                            <Box key={templateKey}>
                              <Group align="baseline" gap="xs" mb="sm">
                                <Text fw={600}>{TEMPLATE_LABELS[templateKey]}</Text>
                                {(templateKey === 'videoSpecial' || templateKey === 'imageSpecial') && (
                                  <Badge size="sm" variant="light" color="orange">创意比特</Badge>
                                )}
                                {(templateKey === 'videoManual' || templateKey === 'imageManual') && (
                                  <Badge size="sm" variant="light" color="violet">手搓命名</Badge>
                                )}
                              </Group>
                              <Group gap="xs" wrap="wrap">
                                {(workflowSettings.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey])?.map((token, index) => (
                                  <Group key={`${templateKey}-${index}`} gap="xs" wrap="nowrap" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: '4px', padding: '4px', backgroundColor: 'var(--mantine-color-body)' }}>
                                    <Select
                                      w={120}
                                      variant="unstyled"
                                      styles={{ input: { paddingLeft: 8, paddingRight: 8, height: 32, minHeight: 32 } }}
                                      data={TOKEN_OPTIONS}
                                      value={token.type}
                                      onChange={(value) => {
                                        if (!value) return;
                                        setWorkflowSettings((prev) => ({
                                          ...prev,
                                          renameTemplates: {
                                            ...prev.renameTemplates,
                                            [templateKey]: (prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey]).map((item, itemIndex) =>
                                              itemIndex === index ? { ...item, type: value as TokenType, value: value === 'CustomText' ? item.value : undefined } : item,
                                            ),
                                          },
                                        }));
                                      }}
                                    />
                                    {token.type === 'CustomText' && (
                                      <TextInput
                                        w={100}
                                        variant="unstyled"
                                        styles={{ input: { borderLeft: '1px solid var(--mantine-color-default-border)', paddingLeft: 8, height: 32, minHeight: 32, borderRadius: 0 } }}
                                        placeholder="输入文本"
                                        value={token.value || ''}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value;
                                          setWorkflowSettings((prev) => ({
                                            ...prev,
                                            renameTemplates: {
                                              ...prev.renameTemplates,
                                              [templateKey]: (prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey]).map((item, itemIndex) =>
                                                itemIndex === index ? { ...item, value } : item,
                                              ),
                                            },
                                          }));
                                        }}
                                      />
                                    )}
                                    <ActionIcon
                                      size="sm"
                                      color="red"
                                      variant="subtle"
                                      onClick={() => {
                                        setWorkflowSettings((prev) => ({
                                          ...prev,
                                          renameTemplates: {
                                            ...prev.renameTemplates,
                                            [templateKey]: (prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey]).filter((_, itemIndex) => itemIndex !== index),
                                          },
                                        }));
                                      }}
                                    >
                                      <X size={14} />
                                    </ActionIcon>
                                  </Group>
                                ))}
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  size="lg"
                                  onClick={() => {
                                    setWorkflowSettings((prev) => ({
                                      ...prev,
                                      renameTemplates: {
                                        ...prev.renameTemplates,
                                        [templateKey]: [
                                          ...(prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey]),
                                          { type: 'ProjectName' },
                                        ],
                                      },
                                    }));
                                  }}
                                >
                                  <Plus size={18} />
                                </ActionIcon>
                              </Group>
                              <Box mt="sm">
                                <Text size="xs" c="dimmed" mb={4}>预览:</Text>
                                <Code block>{buildTemplatePreview(workflowSettings.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey] || [], producerName)}</Code>
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          </Tabs.Panel>


          <Tabs.Panel value="screenshot-control" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">Snipaste 快捷键</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="lg">
                    <Group justify="space-between" align="center">
                      <Text fw={500} w={150}>截屏:</Text>
                      <TextInput flex={1} value={shortcutSettings.screenshot} onChange={(e) => handleShortcutChange('screenshot', e.currentTarget.value)} />
                    </Group>
                    <Group justify="space-between" align="center">
                      <Text fw={500} w={150}>截屏并自动复制:</Text>
                      <TextInput flex={1} value={shortcutSettings.screenshotAndCopy} onChange={(e) => handleShortcutChange('screenshotAndCopy', e.currentTarget.value)} />
                    </Group>
                    <Group justify="space-between" align="center">
                      <Text fw={500} w={150}>自定义截屏:</Text>
                      <TextInput flex={1} value={shortcutSettings.customScreenshot} onChange={(e) => handleShortcutChange('customScreenshot', e.currentTarget.value)} />
                    </Group>
                    <Group justify="space-between" align="center">
                      <Text fw={500} w={150}>贴图:</Text>
                      <TextInput flex={1} value={shortcutSettings.pinImage} onChange={(e) => handleShortcutChange('pinImage', e.currentTarget.value)} />
                    </Group>
                    <Group justify="space-between" align="center">
                      <Text fw={500} w={150}>隐藏/显示所有贴图:</Text>
                      <TextInput flex={1} value={shortcutSettings.hideShowAllPins} onChange={(e) => handleShortcutChange('hideShowAllPins', e.currentTarget.value)} />
                    </Group>
                    <Group justify="space-between" align="center">
                      <Text fw={500} w={150}>切换到另一贴图组:</Text>
                      <TextInput flex={1} value={shortcutSettings.switchPinGroup} onChange={(e) => handleShortcutChange('switchPinGroup', e.currentTarget.value)} />
                    </Group>
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="screenshot-output" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">输出</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="xl">
                    <Group align="center">
                      <Text fw={500}>图像质量:</Text>
                      <NumberInput
                        w={100}
                        value={screenshotSettings.imageQuality}
                        onChange={(val) => setScreenshotSettings(prev => ({ ...prev, imageQuality: typeof val === 'number' ? val : -1 }))}
                        min={-1}
                        max={100}
                      />
                      <Tooltip label="范围: 0 到 100 或 -1。设为 0 可最大压缩图像，100 为完全不压缩。设为 -1 会自动决定。">
                        <ActionIcon variant="subtle"><HelpCircle size={16} /></ActionIcon>
                      </Tooltip>
                    </Group>

                    <Box>
                      <Text fw={600} mb="sm">手动保存</Text>
                      <Stack gap="sm" pl="md" style={{ borderLeft: '2px solid var(--mantine-color-default-border)' }}>
                        <TextInput
                          label="文件名"
                          value={screenshotSettings.manualSaveName}
                          onChange={(e) => setScreenshotSettings(prev => ({ ...prev, manualSaveName: e.currentTarget.value }))}
                        />
                        <TextInput
                          label="预览"
                          readOnly
                          value={parseNamingRule(screenshotSettings.manualSaveName)}
                          styles={{ input: { backgroundColor: 'var(--mantine-color-gray-1)' } }}
                        />
                        <Checkbox
                          label="记住上一次使用的图片扩展名"
                          checked={screenshotSettings.manualSaveRememberExtension}
                          onChange={(e) => setScreenshotSettings(prev => ({ ...prev, manualSaveRememberExtension: e.currentTarget.checked }))}
                        />
                      </Stack>
                    </Box>

                    <Box>
                      <Text fw={600} mb="sm">快捷保存</Text>
                      <Stack gap="sm" pl="md" style={{ borderLeft: '2px solid var(--mantine-color-default-border)' }}>
                        <Checkbox
                          label="显示通知"
                          checked={screenshotSettings.quickSaveNotify}
                          onChange={(e) => setScreenshotSettings(prev => ({ ...prev, quickSaveNotify: e.currentTarget.checked }))}
                        />
                        <TextInput
                          label="路径"
                          value={screenshotSettings.quickSavePath}
                          onChange={(e) => setScreenshotSettings(prev => ({ ...prev, quickSavePath: e.currentTarget.value }))}
                          rightSection={
                            <ActionIcon onClick={() => selectFolder((p) => setScreenshotSettings(prev => ({ ...prev, quickSavePath: p + '/$yyyy-MM-dd$.png' })))}>
                              <FolderSearch size={16} />
                            </ActionIcon>
                          }
                        />
                        <TextInput
                          label="预览"
                          readOnly
                          value={parseNamingRule(screenshotSettings.quickSavePath)}
                          styles={{ input: { backgroundColor: 'var(--mantine-color-gray-1)' } }}
                        />
                      </Stack>
                    </Box>

                    <Box>
                      <Group gap="xs" mb="sm">
                        <Checkbox
                          checked={screenshotSettings.autoSaveEnabled}
                          onChange={(e) => setScreenshotSettings(prev => ({ ...prev, autoSaveEnabled: e.currentTarget.checked }))}
                        />
                        <Text fw={600}>自动保存</Text>
                      </Group>
                      <Stack gap="sm" pl="md" style={{ borderLeft: '2px solid var(--mantine-color-default-border)' }}>
                        <TextInput
                          label="路径"
                          disabled={!screenshotSettings.autoSaveEnabled}
                          value={screenshotSettings.autoSavePath}
                          onChange={(e) => setScreenshotSettings(prev => ({ ...prev, autoSavePath: e.currentTarget.value }))}
                          rightSection={
                            <ActionIcon disabled={!screenshotSettings.autoSaveEnabled} onClick={() => selectFolder((p) => setScreenshotSettings(prev => ({ ...prev, autoSavePath: p + '/$yyyy-MM-dd$.png' })))}>
                              <FolderSearch size={16} />
                            </ActionIcon>
                          }
                        />
                        <TextInput
                          label="预览"
                          disabled={!screenshotSettings.autoSaveEnabled}
                          readOnly
                          value={parseNamingRule(screenshotSettings.autoSavePath)}
                          styles={{ input: { backgroundColor: 'var(--mantine-color-gray-1)' } }}
                        />
                      </Stack>
                    </Box>

                    <Box mt="xl">
                      <Popover width={400} position="bottom-start" withArrow shadow="md">
                        <Popover.Target>
                          <Button variant="default" size="xs">命名规则帮助</Button>
                        </Popover.Target>
                        <Popover.Dropdown>
                          <ScrollArea h={300}>
                            <Text size="sm" fw={700} mb="xs">支持的命名规则</Text>
                            <Table size="xs" striped highlightOnHover>
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>变量名</Table.Th>
                                  <Table.Th>说明</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                <Table.Tr><Table.Td><Code>%os%</Code></Table.Td><Table.Td>操作系统</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td><Code>%computername%</Code></Table.Td><Table.Td>计算机名</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td><Code>%username%</Code></Table.Td><Table.Td>用户名</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td><Code>%title%</Code></Table.Td><Table.Td>当前窗口标题</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td><Code>$yyyy-MM-dd$</Code></Table.Td><Table.Td>年-月-日 (如 2026-04-08)</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td><Code>$HH-mm-ss$</Code></Table.Td><Table.Td>时-分-秒</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td><Code>$yy-M-d$</Code></Table.Td><Table.Td>短格式时间</Table.Td></Table.Tr>
                              </Table.Tbody>
                            </Table>
                          </ScrollArea>
                        </Popover.Dropdown>
                      </Popover>
                    </Box>

                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="screenshot-pin" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">贴图行为</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <Checkbox
                      label="窗口阴影"
                      checked={screenshotSettings.pinShadow}
                      onChange={(e) => setScreenshotSettings(prev => ({ ...prev, pinShadow: e.currentTarget.checked }))}
                    />
                    <Group align="center">
                      <Text w={120}>默认不透明度:</Text>
                      <NumberInput
                        w={100}
                        value={screenshotSettings.pinOpacity}
                        onChange={(val) => setScreenshotSettings(prev => ({ ...prev, pinOpacity: typeof val === 'number' ? val : 100 }))}
                        min={10} max={100}
                      />
                      <Text>%</Text>
                    </Group>
                    <Group align="center">
                      <Text w={120}>最大窗口尺寸:</Text>
                      <NumberInput
                        w={120}
                        value={screenshotSettings.pinMaxWidth}
                        onChange={(val) => setScreenshotSettings(prev => ({ ...prev, pinMaxWidth: typeof val === 'number' ? val : 12000 }))}
                        min={100} max={50000}
                      />
                    </Group>
                    <Group align="center">
                      <Text w={120}>快速缩略图大小:</Text>
                      <NumberInput
                        w={80}
                        value={screenshotSettings.pinThumbWidth}
                        onChange={(val) => setScreenshotSettings(prev => ({ ...prev, pinThumbWidth: typeof val === 'number' ? val : 50 }))}
                        min={10} max={500}
                      />
                      <Text>×</Text>
                      <NumberInput
                        w={80}
                        value={screenshotSettings.pinThumbHeight}
                        onChange={(val) => setScreenshotSettings(prev => ({ ...prev, pinThumbHeight: typeof val === 'number' ? val : 50 }))}
                        min={10} max={500}
                      />
                    </Group>
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="shortcuts" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">全局快捷键</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="lg">
                    <TextInput
                      label="唤醒/隐藏主面板"
                      value={shortcutSettings.togglePanel}
                      onChange={(e) => handleShortcutChange('togglePanel', e.currentTarget.value)}
                      error={shortcutConflicts.togglePanel ? "快捷键已被其他软件占用，请更换" : null}
                    />
                    <TextInput
                      label="呼出全局截屏"
                      value={shortcutSettings.screenshot}
                      onChange={(e) => handleShortcutChange('screenshot', e.currentTarget.value)}
                      error={shortcutConflicts.screenshot ? "快捷键已被其他软件占用，请更换" : null}
                    />
                    <TextInput
                      label="一键贴图悬浮"
                      value={shortcutSettings.pinImage}
                      onChange={(e) => handleShortcutChange('pinImage', e.currentTarget.value)}
                      error={shortcutConflicts.pinImage ? "快捷键已被其他软件占用，请更换" : null}
                    />
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="processing" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">图片引擎</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <Select
                      label="默认输出格式"
                      value={processingSettings.imageFormat}
                      onChange={(val: any) => setProcessingSettings(prev => ({ ...prev, imageFormat: val }))}
                      data={[
                        { label: '保留原格式', value: 'original' },
                        { label: '统一转 WebP', value: 'webp' },
                      ]}
                    />
                    <Box>
                      <Text size="sm" fw={500} mb={4}>默认压缩质量 ({processingSettings.imageQuality}%)</Text>
                      <Slider
                        value={processingSettings.imageQuality}
                        onChange={(val) => setProcessingSettings(prev => ({ ...prev, imageQuality: val }))}
                        min={10} max={100} step={1}
                        marks={[
                          { value: 50, label: '50%' },
                          { value: 80, label: '80%' },
                          { value: 100, label: '100%' }
                        ]}
                        mb="xl"
                      />
                    </Box>
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Title order={4} mb="lg">视频引擎</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <Select
                      label="默认导出压缩比"
                      value={processingSettings.videoCompressRate}
                      onChange={(val: any) => setProcessingSettings(prev => ({ ...prev, videoCompressRate: val }))}
                      data={[
                        { label: '高画质 (体积大)', value: 'high' },
                        { label: '中等画质 (推荐)', value: 'medium' },
                        { label: '低画质 (体积小)', value: 'low' },
                      ]}
                    />
                    <Switch
                      label="是否剔除音轨"
                      description="导出视频时静音处理"
                      checked={processingSettings.videoRemoveAudio}
                      onChange={(e) => setProcessingSettings(prev => ({ ...prev, videoRemoveAudio: e.currentTarget.checked }))}
                    />
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Title order={4} mb="lg">截图工具</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <TextInput
                      label="截图默认保存路径"
                      value={processingSettings.screenshotDir}
                      onChange={(e) => setProcessingSettings((prev) => ({ ...prev, screenshotDir: e.currentTarget.value }))}
                      rightSection={
                        <ActionIcon onClick={() => selectFolder((p) => setProcessingSettings(prev => ({ ...prev, screenshotDir: p })))}>
                          <FolderSearch size={16} />
                        </ActionIcon>
                      }
                    />
                    <Group>
                      <Switch
                        label="截图边缘带阴影"
                        checked={processingSettings.screenshotShadow}
                        onChange={(e) => setProcessingSettings(prev => ({ ...prev, screenshotShadow: e.currentTarget.checked }))}
                      />
                      <Switch
                        label="截图边缘带圆角"
                        checked={processingSettings.screenshotRounded}
                        onChange={(e) => setProcessingSettings(prev => ({ ...prev, screenshotRounded: e.currentTarget.checked }))}
                      />
                    </Group>
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="ai" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">通用大模型 (AI 识图) API 配置</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <TextInput
                      label="API 服务地址 (Base URL)"
                      placeholder="例如：https://api.openai.com/v1"
                      value={apiKeys.aiIntegration?.apiBaseUrl || ''}
                      onChange={(e) => setApiKeys((prev) => ({
                        ...prev,
                        aiIntegration: { ...prev.aiIntegration, apiBaseUrl: e.currentTarget.value } as any
                      }))}
                    />
                    <PasswordInput
                      label="API 密钥 (API Key)"
                      placeholder="输入 API Key"
                      value={apiKeys.aiIntegration?.apiKey || ''}
                      onChange={(e) => setApiKeys((prev) => ({
                        ...prev,
                        aiIntegration: { ...prev.aiIntegration, apiKey: e.currentTarget.value } as any
                      }))}
                    />
                    <TextInput
                      label="模型名称 (Model)"
                      placeholder="例如：gpt-4o"
                      value={apiKeys.aiIntegration?.modelName || ''}
                      onChange={(e) => setApiKeys((prev) => ({
                        ...prev,
                        aiIntegration: { ...prev.aiIntegration, modelName: e.currentTarget.value } as any
                      }))}
                    />
                    <TextInput
                      label="系统提示词 (System Prompt)"
                      description="指导 AI 如何识别图片并返回所需格式"
                      placeholder="请识别图片，提取“画面元素”和“游戏品类”..."
                      value={apiKeys.aiIntegration?.systemPrompt || ''}
                      onChange={(e) => setApiKeys((prev) => ({
                        ...prev,
                        aiIntegration: { ...prev.aiIntegration, systemPrompt: e.currentTarget.value } as any
                      }))}
                    />
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Title order={4} mb="lg">其他 AI 引擎 (保留)</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <PasswordInput
                      label="Gemini API Key"
                      value={apiKeys.geminiKey}
                      onChange={(e) => setApiKeys((prev) => ({ ...prev, geminiKey: e.currentTarget.value }))}
                    />
                    <TextInput
                      label="Stable Diffusion 地址"
                      placeholder="http://127.0.0.1:7860"
                      value={apiKeys.sdPath}
                      onChange={(e) => setApiKeys((prev) => ({ ...prev, sdPath: e.currentTarget.value }))}
                    />
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="data" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">存储管理</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <TextInput
                      label="本地数据文件存放路径"
                      description="如 SQLite 记录文件的存放位置"
                      value={dataStatsSettings.dataDir}
                      onChange={(e) => setDataStatsSettings((prev) => ({ ...prev, dataDir: e.currentTarget.value }))}
                      rightSection={
                        <ActionIcon onClick={() => selectFolder((p) => setDataStatsSettings(prev => ({ ...prev, dataDir: p })))}>
                          <FolderSearch size={16} />
                        </ActionIcon>
                      }
                    />
                    <Group>
                      <Button variant="light" color="red">清理历史数据</Button>
                      <Button variant="light" color="blue">数据备份</Button>
                    </Group>
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Title order={4} mb="lg">统计偏好</Title>
                <Card withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <Switch
                      label="周末计入产能统计基数"
                      checked={dataStatsSettings.includeWeekend}
                      onChange={(e) => setDataStatsSettings(prev => ({ ...prev, includeWeekend: e.currentTarget.checked }))}
                    />
                    <Select
                      label="月报报表默认导出格式"
                      value={dataStatsSettings.reportFormat}
                      onChange={(val: any) => setDataStatsSettings(prev => ({ ...prev, reportFormat: val }))}
                      data={[
                        { label: 'Excel (.xlsx)', value: 'excel' },
                        { label: 'CSV (.csv)', value: 'csv' },
                        { label: 'PDF (.pdf)', value: 'pdf' },
                      ]}
                    />
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="about" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">关于 OpenFlow Studio</Title>
                <Card withBorder radius="md" p="xl" ta="center">
                  <Stack align="center" gap="md">
                    <Box w={80} h={80} style={{ borderRadius: 20, backgroundColor: 'var(--mantine-color-blue-light)' }}>
                      <Flex h="100%" align="center" justify="center">
                        <Wrench size={40} color="var(--mantine-color-blue-6)" />
                      </Flex>
                    </Box>
                    <Title order={3}>OpenFlow Studio</Title>
                    <Text c="dimmed">版本 1.0.0 (Beta)</Text>
                    <Group mt="md">
                      <Button variant="filled">检查新版本</Button>
                      <Button variant="light">更新日志</Button>
                    </Group>
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

        </Tabs>
      </Flex>

      <Box
        p="md"
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-body)',
        }}
      >
        <Group justify="flex-end">
          <Button leftSection={<Save size={16} />} onClick={handleSaveSettings}>
            保存设置
          </Button>
        </Group>
      </Box>
    </Flex>
  );
}
