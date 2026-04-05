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
  Power,
  RefreshCw,
  Save,
  Settings,
  Sun,
  User,
  Workflow,
  Wrench,
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
  type ProcessingSettings,
  type ShortcutSettings,
  type SystemSettings,
  type TemplateKey,
  type TokenType,
  type UserInfo,
  type WorkflowSettings,
  type WorkspaceSettings,
} from '../appState';

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
  producerName,
}: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<string>('system');
  const [shortcutConflicts, setShortcutConflicts] = useState<Record<keyof ShortcutSettings, boolean>>({
    togglePanel: false,
    screenshot: false,
    pinImage: false,
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
    <Flex h="100%" direction="column" bg="#f7f9fc">
      <Box p="md" bg="white" style={{ borderBottom: '1px solid #e2e8f0' }}>
        <Group justify="space-between">
          <Group>
            <Settings size={24} color="#4f8dff" />
            <Title order={3} c="#1e293b">设置中心</Title>
          </Group>
          <Button leftSection={<Save size={16} />} onClick={handleSaveSettings}>
            保存设置
          </Button>
        </Group>
      </Box>

      <Flex flex={1} style={{ overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(val) => setActiveTab(val || 'system')}
          orientation="vertical"
          variant="pills"
          p="md"
          styles={{
            root: { width: '100%' },
            list: { width: 220, borderRight: '1px solid #e2e8f0', paddingRight: 16, gap: 8 },
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
                <Title order={4} mb="lg" c="#1e293b">常规设置</Title>
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
                <Title order={4} mb="lg" c="#1e293b">系统行为</Title>
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
                <Title order={4} mb="lg" c="#1e293b">账户信息</Title>
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
                <Title order={4} mb="lg" c="#1e293b">核心路径配置</Title>
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
                <Title order={4} mb="lg" c="#1e293b">文件规则</Title>
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
                <Title order={4} mb="lg" c="#1e293b">重命名模板配置</Title>
                <Stack gap="lg">
                  {['视频版块', '图片版块'].map((sectionTitle) => {
                    const keys: TemplateKey[] = sectionTitle === '视频版块'
                      ? ['videoRegular', 'videoSpecial']
                      : ['imageRegular', 'imageSpecial'];

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
                              </Group>
                              <Stack gap="xs">
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
                                    />
                                    {token.type === 'CustomText' && (
                                      <TextInput
                                        placeholder="输入文本"
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
                                      />
                                    )}
                                  </Group>
                                ))}
                                <Box mt="sm">
                                  <Text size="xs" c="dimmed" mb={4}>预览:</Text>
                                  <Code block>{buildTemplatePreview(workflowSettings.renameTemplates[templateKey], producerName)}</Code>
                                </Box>
                              </Stack>
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

          <Tabs.Panel value="shortcuts" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg" c="#1e293b">全局快捷键</Title>
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
                <Title order={4} mb="lg" c="#1e293b">图片引擎</Title>
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
                <Title order={4} mb="lg" c="#1e293b">视频引擎</Title>
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
                <Title order={4} mb="lg" c="#1e293b">截图工具</Title>
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
                <Title order={4} mb="lg" c="#1e293b">AI API 配置</Title>
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
                <Title order={4} mb="lg" c="#1e293b">存储管理</Title>
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
                <Title order={4} mb="lg" c="#1e293b">统计偏好</Title>
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
                <Title order={4} mb="lg" c="#1e293b">关于 OpenFlow Studio</Title>
                <Card withBorder radius="md" p="xl" ta="center">
                  <Stack align="center" gap="md">
                    <Box w={80} h={80} bg="blue.1" style={{ borderRadius: 20 }}>
                      <Flex h="100%" align="center" justify="center">
                        <Wrench size={40} color="#4f8dff" />
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
    </Flex>
  );
}
