import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Group,
  Image,
  ScrollArea,
  Stack,
  Text,
  Title,
  Badge,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { FolderSearch, FolderSync, PlayCircle, Image as ImageIcon, FolderOpen, CheckCircle2 } from 'lucide-react';
import { notify } from '../utils/notify';
import { WorkflowSettings, WorkspaceSettings, formatBytes } from '../appState';
import { PageHeader } from '../components/PageHeader';

interface OrganizerWorkspaceProps {
  isQimiEnabled: boolean;
  onToggleQimiEnabled: (enabled: boolean) => void;
  workflowSettings: WorkflowSettings;
  workspaceSettings: WorkspaceSettings;
  onOpenSettings: () => void;
  onChangeWorkspaceSettings?: (settings: Partial<WorkspaceSettings>) => void;
  onBusyChange?: (busy: boolean) => void;
}

interface ScannedFile {
  id: string;
  fileName: string;
  filePath: string;
  gameName: string;
  resolution: string;
  date: string;
  sequence: string;
  ext: string;
  size: number;
  selected: boolean;
}

export function OrganizerWorkspace({
  isQimiEnabled,
  onToggleQimiEnabled, workflowSettings, workspaceSettings, onOpenSettings, onChangeWorkspaceSettings, onBusyChange }: OrganizerWorkspaceProps) {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [hasOrganized, setHasOrganized] = useState(false);

  useEffect(() => {
    onBusyChange?.(isScanning || isOrganizing || (files.length > 0 && !hasOrganized));
    return () => onBusyChange?.(false);
  }, [files.length, hasOrganized, isOrganizing, isScanning, onBusyChange]);

  const { organizerFormats } = workflowSettings;
  const { sourceDir: organizerSourceDir, destDir: organizerDestDir } = workspaceSettings;

  const getDirName = (pathStr: string) => {
    if (!pathStr) return '未配置';
    const separator = pathStr.includes('\\') ? '\\' : '/';
    const parts = pathStr.split(separator).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : pathStr;
  };

  const handleScan = async () => {
    if (!organizerSourceDir) {
      notify('orange', '未配置扫描目录', '请先在系统设置中配置“默认扫描目录”。');
      onOpenSettings();
      return;
    }
    if (!organizerFormats || organizerFormats.length === 0) {
      notify('orange', '未配置支持格式', '请先在系统设置中勾选至少一种支持格式（如 jpg, mp4）。');
      onOpenSettings();
      return;
    }

    setIsScanning(true);
    try {
      const results = await window.electronAPI.fs.scanOrganizerFolder(organizerSourceDir, organizerFormats);
      setFiles(results);
      setHasScanned(true);
      setHasOrganized(false);
      if (results.length === 0) {
        notify('blue', '扫描完成', '未找到符合格式要求的素材文件。');
      } else {
        notify('green', '扫描完成', `共发现 ${results.length} 个文件待整理。`);
      }
    } catch (err) {
      notify('red', '扫描失败', String(err));
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenSourceFolder = async () => {
    if (organizerSourceDir) {
      await window.electronAPI.shell.openPath(organizerSourceDir);
    }
  };

  const handleOpenDestFolder = async () => {
    if (organizerDestDir) {
      await window.electronAPI.shell.openPath(organizerDestDir);
    }
  };

  const handleOrganize = async () => {
    if (!organizerDestDir) {
      notify('orange', '未配置转移目录', '请先在系统设置中配置“素材转移目录”。');
      onOpenSettings();
      return;
    }

    const selectedFiles = files.filter(f => f.selected);
    if (selectedFiles.length === 0) {
      notify('orange', '未选择文件', '请至少勾选一个文件。');
      return;
    }

    // 防错校验：检查目标目录是否包含今日日期
    const destDirName = getDirName(organizerDestDir);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayFormats = [
      `${year}${month}${day}`,
      `${year}-${month}-${day}`,
      `${month}${day}`,
      `${year.toString().slice(-2)}${month}${day}`
    ];

    const containsToday = todayFormats.some(format => destDirName.includes(format));

    if (!containsToday) {
      const isConfirmed = window.confirm(`警告：您当前的转移目录 (${destDirName}) 似乎不包含今天的日期。\n\n您是否忘记更改转移目录位置了？\n\n如果确认无误，请点击"确定"继续转移；否则点击"取消"去更改转移目录。`);
      if (!isConfirmed) {
        return;
      }
    }

    setIsOrganizing(true);
    try {
      const response = await window.electronAPI.fs.executeOrganize(selectedFiles, organizerDestDir, isQimiEnabled);
      if (!response.success) {
        notify('red', '整理失败', response.error);
        return;
      }

      if (response.missingFolders && response.missingFolders.length > 0) {
        response.missingFolders.forEach(msg => {
          notify('blue', '新建文件夹提示', msg, 10000);
        });
      }

      const successCount = response.results?.filter(r => r.success).length || 0;
      const failCount = response.results?.filter(r => !r.success).length || 0;

      if (failCount === 0) {
        notify('green', '整理完成', `成功移动了 ${successCount} 个文件。`);
        setHasOrganized(true);
      } else {
        notify('orange', '整理完成 (部分失败)', `成功: ${successCount}, 失败: ${failCount}`);
      }

      // Remove successful files from the list
      const successfulIds = new Set(response.results?.filter(r => r.success).map(r => r.id));
      setFiles(prev => prev.filter(f => !successfulIds.has(f.id)));
      if (files.filter(f => !successfulIds.has(f.id)).length === 0) {
         setHasOrganized(true);
      }
    } catch (err) {
      notify('red', '整理过程发生错误', String(err));
    } finally {
      setIsOrganizing(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    setFiles(prev => prev.map(f => ({ ...f, selected: checked })));
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, selected: checked } : f));
  };

  const allSelected = files.length > 0 && files.every(f => f.selected);
  const indeterminate = files.some(f => f.selected) && !allSelected;
  const selectedCount = files.filter(file => file.selected).length;

  const statusLabel = isScanning
    ? '正在扫描'
    : isOrganizing
      ? '正在转移'
      : hasOrganized
        ? '处理完成'
        : hasScanned && files.length > 0
          ? '扫描完成'
          : hasScanned && files.length === 0
            ? '扫描为空'
            : '系统就绪';

  const statusTitle = isScanning
    ? '正在扫描。'
    : isOrganizing
      ? '正在转移。'
      : hasOrganized
        ? '整理完成。'
        : hasScanned && files.length > 0
          ? `共发现 ${files.length} 个文件。`
          : hasScanned && files.length === 0
            ? '没有需要整理的文件。'
            : '准备就绪。';

  const statusDescription = isScanning
    ? '系统正在读取下载目录中的文件信息，请稍候。'
    : isOrganizing
      ? '系统正在自动将文件归档到对应游戏的文件夹中。'
      : hasOrganized
        ? '所有选中的素材已经成功移动到目标目录。'
        : hasScanned && files.length > 0
          ? '请在下方核对文件信息，然后点击“执行转移”进行归档。'
          : hasScanned && files.length === 0
            ? '下载目录中没有匹配的格式或命名规则的文件。'
            : '点击下方“一键扫描”开始读取下载目录中的素材。';

  return (
    <Box className="organizer-workspace">
      <Flex direction="column" h="100%" style={{ minHeight: 0 }}>
        <PageHeader
          className="organizer-header"
          title="素材自动整理"
          description="扫描下载目录，并按游戏名和分辨率归档素材"
          icon={<FolderSearch size={20} />}
        />

        <ScrollArea className="organizer-scroll app-scroll" style={{ flex: 1, minHeight: 0 }}>
          <Stack className="organizer-content" gap="md">
            <Box className="organizer-top-grid">
              <Card className="organizer-section organizer-status-card" withBorder radius="md" p="md">
                <Group className="organizer-section-heading" justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <ThemeIcon variant="light" color={hasOrganized ? 'green' : 'blue'} size="md" radius="sm">
                      {hasOrganized ? <CheckCircle2 size={16} /> : <FolderSearch size={16} />}
                    </ThemeIcon>
                    <Text className="organizer-section-title">系统状态</Text>
                  </Group>
                  <Badge
                    variant="light"
                    radius="sm"
                    color={hasOrganized ? 'green' : isScanning || isOrganizing ? 'orange' : 'gray'}
                  >
                    {statusLabel}
                  </Badge>
                </Group>

                <Stack className="organizer-status-body" gap="xs">
                  <Title order={2} className="organizer-status-title">{statusTitle}</Title>
                  <Text className="organizer-status-description" c="dimmed">{statusDescription}</Text>
                  <Box className="organizer-directory-summary">
                    <Text size="xs" c="dimmed">来源目录</Text>
                    <Text className="organizer-path" title={organizerSourceDir || '未配置源目录'}>
                      {organizerSourceDir || '未配置源目录'}
                    </Text>
                  </Box>
                  <Group className="organizer-status-actions" gap="sm">
                    <Button
                      variant="default"
                      leftSection={<FolderOpen size={16} />}
                      onClick={handleOpenSourceFolder}
                    >
                      打开源目录
                    </Button>
                    {hasOrganized && (
                      <Button
                        variant="light"
                        color="blue"
                        leftSection={<FolderOpen size={16} />}
                        onClick={handleOpenDestFolder}
                      >
                        打开整理目录
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Card>

              <Card className="organizer-section organizer-shortcuts-card" withBorder radius="md" p="md">
                <Group className="organizer-section-heading" gap="xs" wrap="nowrap">
                  <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                    <FolderSync size={16} />
                  </ThemeIcon>
                  <Text className="organizer-section-title">快捷操作</Text>
                </Group>

                <Stack className="organizer-shortcuts" gap="sm">
                  <Box className="organizer-qimi-option">
                    <Checkbox
                      label="视频转移-奇觅生成"
                      description="启用后，视频将沿用现有奇觅生成目录规则"
                      checked={isQimiEnabled}
                      onChange={(event) => onToggleQimiEnabled(event.currentTarget.checked)}
                      iconColor="blue"
                    />
                  </Box>

                  <Box className="organizer-directory-control">
                    <Box className="organizer-directory-copy">
                      <Text size="xs" c="dimmed">源目录</Text>
                      <Text className="organizer-path" title={organizerSourceDir || '未配置源目录'}>
                        {organizerSourceDir || '未配置源目录'}
                      </Text>
                    </Box>
                    <Tooltip label={organizerSourceDir || '未配置源目录'}>
                      <Button
                        variant="default"
                        leftSection={<FolderOpen size={16} />}
                        onClick={async () => {
                          const newPath = await window.electronAPI.dialog.selectFolder();
                          if (newPath) {
                            if (onChangeWorkspaceSettings) {
                              onChangeWorkspaceSettings({ sourceDir: newPath });
                            }
                            notify('green', '成功', '已更改源目录配置。');
                          }
                        }}
                      >
                        更改源目录
                      </Button>
                    </Tooltip>
                  </Box>

                  <Box className="organizer-directory-control">
                    <Box className="organizer-directory-copy">
                      <Text size="xs" c="dimmed">转移目录</Text>
                      <Text className="organizer-path" title={organizerDestDir || '未配置转移目录'}>
                        {organizerDestDir || '未配置转移目录'}
                      </Text>
                    </Box>
                    <Tooltip label={organizerDestDir || '未配置转移目录'}>
                      <Button
                        variant="default"
                        leftSection={<FolderOpen size={16} />}
                        onClick={async () => {
                          const newPath = await window.electronAPI.dialog.selectFolder();
                          if (newPath) {
                            if (onChangeWorkspaceSettings) {
                              onChangeWorkspaceSettings({ destDir: newPath });
                            }
                            notify('green', '成功', '已更改转移目录配置。');
                          }
                        }}
                      >
                        更改转移目录
                      </Button>
                    </Tooltip>
                  </Box>

                  <Button
                    className="organizer-undo-button"
                    variant="subtle"
                    color="red"
                    leftSection={<FolderSync size={16} />}
                    onClick={async () => {
                      try {
                        const result = await window.electronAPI.fs.undoOrganize();
                        if (result.success) {
                          notify('green', '撤销成功', result.message);
                          handleScan();
                        } else {
                          notify('orange', '撤销失败', result.error);
                        }
                      } catch (err) {
                        notify('red', '执行撤销时出错', String(err));
                      }
                    }}
                  >
                    撤销转移
                  </Button>
                </Stack>
              </Card>
            </Box>

            <Card className="organizer-section organizer-materials-card" withBorder radius="md" p="md">
              <Group className="organizer-materials-heading" justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                    <FolderSync size={16} />
                  </ThemeIcon>
                  <Text className="organizer-section-title">待整理素材</Text>
                </Group>
                <Badge variant="light" color={files.length > 0 ? 'blue' : 'gray'}>
                  {files.length} 个文件
                </Badge>
              </Group>

              {files.length === 0 ? (
                <Flex className="organizer-empty-state" align="center" justify="center" direction="column" gap="sm" c="dimmed">
                  <FolderSearch size={36} aria-hidden="true" />
                  <Text ta="center">
                    {hasScanned ? '没有需要整理的文件' : '未发现匹配的素材，请确认源目录配置或开始扫描'}
                  </Text>
                  {(!organizerSourceDir || !organizerDestDir) && (
                    <Button variant="light" size="xs" onClick={onOpenSettings}>去设置目录</Button>
                  )}
                </Flex>
              ) : (
                <Stack className="organizer-results" gap="sm">
                  <Box className="organizer-select-all">
                    <Checkbox
                      label="全选"
                      checked={allSelected}
                      indeterminate={indeterminate}
                      onChange={(event) => toggleSelectAll(event.currentTarget.checked)}
                    />
                  </Box>

                  {files.map(file => {
                    const isVideo = file.ext === '.mp4';
                    const destinationLabel = `${file.gameName}/${file.resolution}/`;
                    return (
                      <Card className="organizer-file-card" key={file.id} withBorder radius="md" p="sm">
                        <Group className="organizer-file-row" wrap="nowrap" align="center">
                          <Checkbox
                            aria-label={`选择 ${file.fileName}`}
                            checked={file.selected}
                            onChange={(event) => toggleSelect(file.id, event.currentTarget.checked)}
                            size="md"
                          />

                          <Box className="organizer-file-preview">
                            {isVideo ? (
                              <PlayCircle size={28} color="var(--mantine-color-dimmed)" />
                            ) : (
                              <Image
                                src={`asset://${file.filePath}`}
                                width="100%"
                                height="100%"
                                fit="cover"
                                fallbackSrc={<ImageIcon size={28} color="var(--mantine-color-dimmed)" />}
                              />
                            )}
                          </Box>

                          <Stack className="organizer-file-copy" gap={4}>
                            <Text fw={600} truncate title={file.fileName}>{file.fileName}</Text>
                            <Group className="organizer-file-metadata" gap="xs">
                              <Badge variant="light" color="blue">{file.gameName}</Badge>
                              <Badge variant="light" color="grape">{file.resolution}</Badge>
                              <Badge variant="outline" color="gray">{formatBytes(file.size)}</Badge>
                            </Group>
                          </Stack>

                          <Box className="organizer-file-destination">
                            <Text size="xs" c="dimmed">将移至</Text>
                            <Text className="organizer-path" size="sm" fw={500} title={destinationLabel}>
                              {destinationLabel}
                            </Text>
                          </Box>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              )}

              <Box className="organizer-action-bar">
                <Group className="organizer-action-buttons" justify="flex-end" gap="sm">
                  <Button
                    className="organizer-scan-button"
                    variant={files.length > 0 ? 'default' : 'filled'}
                    color="blue"
                    leftSection={<FolderSearch size={18} />}
                    onClick={handleScan}
                    loading={isScanning}
                  >
                    一键扫描
                  </Button>
                  <Button
                    className="organizer-transfer-button"
                    color="blue"
                    leftSection={<CheckCircle2 size={18} />}
                    onClick={handleOrganize}
                    loading={isOrganizing}
                    disabled={files.length === 0 || files.filter(file => file.selected).length === 0}
                  >
                    确认转移 ({selectedCount})
                  </Button>
                </Group>
              </Box>
            </Card>
          </Stack>
        </ScrollArea>
      </Flex>
    </Box>
  );
}
