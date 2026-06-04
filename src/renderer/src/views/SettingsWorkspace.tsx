import React, { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Checkbox,
  Code,
  Divider,
  Flex,
  Group,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import {
  FolderSearch,
  HardDrive,
  Info,
  Keyboard,
  MonitorPlay,
  Plus,
  Save,
  Settings,
  User,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import {
  buildTemplatePreview,
  DEFAULT_WORKFLOW,
  TEMPLATE_LABELS,
  TOKEN_OPTIONS,
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
  systemSettings: SystemSettings;
  setSystemSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  workspaceSettings: WorkspaceSettings;
  setWorkspaceSettings: React.Dispatch<React.SetStateAction<WorkspaceSettings>>;
  shortcutSettings: ShortcutSettings;
  setShortcutSettings: React.Dispatch<React.SetStateAction<ShortcutSettings>>;
  producerName: string;
}

const templateSections: Array<{ title: string; keys: TemplateKey[] }> = [
  { title: '视频版块', keys: ['videoRegular', 'videoSpecial', 'videoManual'] },
  { title: '图片版块', keys: ['imageRegular', 'imageSpecial', 'imageManual'] },
];

const organizerFormatOptions = [
  { label: 'JPG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'MP4', value: 'mp4' },
  { label: 'MOV', value: 'mov' },
];

export function SettingsWorkspace({
  userInfo,
  setUserInfo,
  workflowSettings,
  setWorkflowSettings,
  systemSettings,
  setSystemSettings,
  workspaceSettings,
  setWorkspaceSettings,
  shortcutSettings,
  setShortcutSettings,
  producerName,
}: SettingsWorkspaceProps) {
  const { setColorScheme } = useMantineColorScheme();
  const [activeTab, setActiveTab] = useState<string>('system');
  const [shortcutConflicts, setShortcutConflicts] = useState<Record<keyof ShortcutSettings, boolean>>({
    togglePanel: false,
  });
  const [saveIndicatorVisible, setSaveIndicatorVisible] = useState(false);
  const isInitialRender = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkShortcut = async (key: keyof ShortcutSettings, value: string) => {
    if (!window.electronAPI?.ipcRenderer) return;
    try {
      const isRegistered = await window.electronAPI.ipcRenderer.invoke('shortcut:check', value);
      setShortcutConflicts((prev) => ({ ...prev, [key]: isRegistered }));
    } catch (error) {
      console.error('Failed to check shortcut', error);
    }
  };

  const handleShortcutChange = (key: keyof ShortcutSettings, value: string) => {
    setShortcutSettings((prev) => ({ ...prev, [key]: value }));
    void checkShortcut(key, value);
  };

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!window.electronAPI) return;

      await window.electronAPI.store.set('userInfo', userInfo);
      await window.electronAPI.store.set('workflow', workflowSettings);
      await window.electronAPI.store.set('systemSettings', systemSettings);
      await window.electronAPI.store.set('workspaceSettings', workspaceSettings);
      await window.electronAPI.store.set('shortcutSettings', shortcutSettings);

      await window.electronAPI.store.set('renameTemplates', workflowSettings.renameTemplates);

      if (window.electronAPI.ipcRenderer) {
        window.electronAPI.ipcRenderer.invoke('settings:applySystem', systemSettings);
        window.electronAPI.ipcRenderer.invoke('shortcut:update', shortcutSettings);
      }

      setSaveIndicatorVisible(true);
      setTimeout(() => setSaveIndicatorVisible(false), 2000);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    userInfo,
    workflowSettings,
    systemSettings,
    workspaceSettings,
    shortcutSettings,
  ]);

  const selectFolder = async (setter: (value: string) => void) => {
    if (!window.electronAPI?.dialog) return;
    const folderPath = await window.electronAPI.dialog.selectFolder();
    if (folderPath) setter(folderPath);
  };

  const getTemplate = (templateKey: TemplateKey) =>
    workflowSettings.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey];

  const updateTemplateToken = (templateKey: TemplateKey, index: number, type: TokenType) => {
    setWorkflowSettings((prev) => {
      const template = prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey];
      return {
        ...prev,
        renameTemplates: {
          ...prev.renameTemplates,
          [templateKey]: template.map((item, itemIndex) =>
            itemIndex === index ? { ...item, type, value: type === 'CustomText' ? item.value : undefined } : item,
          ),
        },
      };
    });
  };

  const updateTemplateText = (templateKey: TemplateKey, index: number, value: string) => {
    setWorkflowSettings((prev) => {
      const template = prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey];
      return {
        ...prev,
        renameTemplates: {
          ...prev.renameTemplates,
          [templateKey]: template.map((item, itemIndex) =>
            itemIndex === index ? { ...item, value } : item,
          ),
        },
      };
    });
  };

  const removeTemplateToken = (templateKey: TemplateKey, index: number) => {
    setWorkflowSettings((prev) => {
      const template = prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey];
      return {
        ...prev,
        renameTemplates: {
          ...prev.renameTemplates,
          [templateKey]: template.filter((_, itemIndex) => itemIndex !== index),
        },
      };
    });
  };

  const addTemplateToken = (templateKey: TemplateKey) => {
    setWorkflowSettings((prev) => {
      const template = prev.renameTemplates[templateKey] || DEFAULT_WORKFLOW.renameTemplates[templateKey];
      return {
        ...prev,
        renameTemplates: {
          ...prev.renameTemplates,
          [templateKey]: [...template, { type: 'ProjectName' }],
        },
      };
    });
  };

  return (
    <Flex h="100%" direction="column">
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group>
          <Settings size={24} color="var(--mantine-color-blue-filled)" />
          <Title order={3}>设置中心</Title>
        </Group>
      </Box>

      <Flex flex={1} style={{ overflow: 'hidden', position: 'relative' }}>
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value || 'system')}
          orientation="vertical"
          variant="pills"
          p="md"
          styles={{
            root: { width: '100%' },
            list: { width: 220, borderRight: '1px solid var(--mantine-color-default-border)', paddingRight: 16, gap: 8 },
            tab: { padding: '12px 16px', fontWeight: 500, borderRadius: 8, color: 'var(--mantine-color-text)' },
            panel: { paddingLeft: 32, paddingRight: 32, paddingBottom: 32, overflowY: 'auto' },
          }}
        >
          <style>{`
            .mantine-Tabs-tab[data-active] {
              color: white !important;
            }
          `}</style>
          <Tabs.List>
            <Text size="xs" fw={700} tt="uppercase" mb="xs" mt="xs" px="xs" style={{ color: 'var(--mantine-color-text)', opacity: 0.6 }}>核心配置</Text>
            <Tabs.Tab value="system" leftSection={<MonitorPlay size={18} />}>常规</Tabs.Tab>
            <Tabs.Tab value="account" leftSection={<User size={18} />}>账户</Tabs.Tab>
            <Tabs.Tab value="workspace" leftSection={<HardDrive size={18} />}>工作区</Tabs.Tab>
            <Tabs.Tab value="templates" leftSection={<Workflow size={18} />}>命名模板</Tabs.Tab>

            <Text size="xs" fw={700} tt="uppercase" mb="xs" mt="md" px="xs" style={{ color: 'var(--mantine-color-text)', opacity: 0.6 }}>高级设定</Text>
            <Tabs.Tab value="shortcuts" leftSection={<Keyboard size={18} />}>快捷键</Tabs.Tab>

            <Text size="xs" fw={700} tt="uppercase" mb="xs" mt="md" px="xs" style={{ color: 'var(--mantine-color-text)', opacity: 0.6 }}>其他</Text>
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
                        onChange={(value) => {
                          const nextTheme = (value || 'auto') as SystemSettings['theme'];
                          setSystemSettings((prev) => ({ ...prev, theme: nextTheme }));
                          setColorScheme(nextTheme);
                        }}
                        data={[
                          { label: '浅色', value: 'light' },
                          { label: '深色', value: 'dark' },
                          { label: '跟随系统', value: 'auto' },
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
                        onChange={(event) => setSystemSettings((prev) => ({ ...prev, autoStart: event.currentTarget.checked }))}
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
                        onChange={(event) => setSystemSettings((prev) => ({ ...prev, closeToTray: event.currentTarget.checked }))}
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
                      onChange={(event) => setUserInfo((prev) => ({ ...prev, name: event.currentTarget.value }))}
                    />
                    <TextInput
                      label="部门"
                      value={userInfo.department}
                      onChange={(event) => setUserInfo((prev) => ({ ...prev, department: event.currentTarget.value }))}
                    />
                    <TextInput
                      label="邮箱"
                      value={userInfo.email}
                      onChange={(event) => setUserInfo((prev) => ({ ...prev, email: event.currentTarget.value }))}
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
                      value={workspaceSettings.sourceDir}
                      onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, sourceDir: event.currentTarget.value }))}
                      rightSection={
                        <ActionIcon onClick={() => void selectFolder((path) => setWorkspaceSettings((prev) => ({ ...prev, sourceDir: path })))}>
                          <FolderSearch size={16} />
                        </ActionIcon>
                      }
                    />
                    <TextInput
                      label="目标主文件夹路径"
                      description="重命名后文件/目录转移的根路径"
                      value={workspaceSettings.destDir}
                      onChange={(event) => setWorkspaceSettings((prev) => ({ ...prev, destDir: event.currentTarget.value }))}
                      rightSection={
                        <ActionIcon onClick={() => void selectFolder((path) => setWorkspaceSettings((prev) => ({ ...prev, destDir: path })))}>
                          <FolderSearch size={16} />
                        </ActionIcon>
                      }
                    />
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Title order={4} mb="lg">整理规则</Title>
                <Card withBorder radius="md" p="lg">
                  <Checkbox.Group
                    label="素材整理支持格式"
                    description="一键扫描时只识别勾选的文件格式"
                    value={workflowSettings.organizerFormats}
                    onChange={(value) => setWorkflowSettings((prev) => ({ ...prev, organizerFormats: value }))}
                  >
                    <Group mt="sm">
                      {organizerFormatOptions.map((option) => (
                        <Checkbox key={option.value} value={option.value} label={option.label} />
                      ))}
                    </Group>
                  </Checkbox.Group>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="templates" pt="md">
            <Stack gap="xl" maw={760}>
              <Box>
                <Title order={4} mb="lg">重命名模板配置</Title>
                <Stack gap="lg">
                  {templateSections.map((section) => (
                    <Card key={section.title} withBorder radius="md" p="lg">
                      <Title order={5} mb="md">{section.title}</Title>
                      <Stack gap="xl">
                        {section.keys.map((templateKey) => (
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
                              {getTemplate(templateKey).map((token, index) => (
                                <Group
                                  key={`${templateKey}-${index}`}
                                  gap="xs"
                                  wrap="nowrap"
                                  style={{
                                    border: '1px solid var(--mantine-color-default-border)',
                                    borderRadius: 4,
                                    padding: 4,
                                    backgroundColor: 'var(--mantine-color-body)',
                                  }}
                                >
                                  <Select
                                    w={120}
                                    variant="unstyled"
                                    styles={{ input: { paddingLeft: 8, paddingRight: 8, height: 32, minHeight: 32 } }}
                                    data={TOKEN_OPTIONS}
                                    value={token.type}
                                    onChange={(value) => {
                                      if (value) updateTemplateToken(templateKey, index, value as TokenType);
                                    }}
                                  />
                                  {token.type === 'CustomText' && (
                                    <TextInput
                                      w={100}
                                      variant="unstyled"
                                      styles={{ input: { borderLeft: '1px solid var(--mantine-color-default-border)', paddingLeft: 8, height: 32, minHeight: 32, borderRadius: 0 } }}
                                      placeholder="输入文本"
                                      value={token.value || ''}
                                      onChange={(event) => updateTemplateText(templateKey, index, event.currentTarget.value)}
                                    />
                                  )}
                                  <ActionIcon
                                    size="sm"
                                    color="red"
                                    variant="subtle"
                                    onClick={() => removeTemplateToken(templateKey, index)}
                                  >
                                    <X size={14} />
                                  </ActionIcon>
                                </Group>
                              ))}
                              <ActionIcon
                                variant="light"
                                color="blue"
                                size="lg"
                                onClick={() => addTemplateToken(templateKey)}
                              >
                                <Plus size={18} />
                              </ActionIcon>
                            </Group>
                            <Box mt="sm">
                              <Text size="xs" c="dimmed" mb={4}>预览:</Text>
                              <Code block>{buildTemplatePreview(getTemplate(templateKey), producerName)}</Code>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="shortcuts" pt="md">
            <Stack gap="xl" maw={700}>
              <Box>
                <Title order={4} mb="lg">全局快捷键</Title>
                <Card withBorder radius="md" p="lg">
                  <TextInput
                    label="唤醒/隐藏主面板"
                    value={shortcutSettings.togglePanel}
                    onChange={(event) => handleShortcutChange('togglePanel', event.currentTarget.value)}
                    error={shortcutConflicts.togglePanel ? '快捷键已被其他软件占用，请更换' : null}
                  />
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
                  </Stack>
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Flex>

      {saveIndicatorVisible && (
        <Box
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            backgroundColor: 'var(--mantine-color-green-filled)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 100,
            animation: 'fadeInOut 2s ease-in-out forwards',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <Save size={16} />
          <span>已自动保存</span>
          <style>{`
            @keyframes fadeInOut {
              0% { opacity: 0; transform: translateY(10px); }
              15% { opacity: 1; transform: translateY(0); }
              85% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-10px); }
            }
          `}</style>
        </Box>
      )}
    </Flex>
  );
}
