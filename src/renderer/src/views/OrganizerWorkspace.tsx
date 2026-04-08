import React, { useState } from 'react';
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
  Paper,
  ThemeIcon,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { FolderSearch, FolderSync, PlayCircle, Image as ImageIcon, FolderOpen, FileText, CheckCircle2, BookPlus } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { WorkflowSettings, WorkspaceSettings, formatBytes } from '../appState';

interface OrganizerWorkspaceProps {
  workflowSettings: WorkflowSettings;
  workspaceSettings: WorkspaceSettings;
  onOpenSettings: () => void;
  onChangeWorkspaceSettings?: (settings: Partial<WorkspaceSettings>) => void;
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

export function OrganizerWorkspace({ workflowSettings, workspaceSettings, onOpenSettings, onChangeWorkspaceSettings }: OrganizerWorkspaceProps) {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [hasOrganized, setHasOrganized] = useState(false);

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
      notifications.show({ color: 'orange', title: '未配置扫描目录', message: '请先在系统设置中配置“默认扫描目录”。' });
      onOpenSettings();
      return;
    }
    if (!organizerFormats || organizerFormats.length === 0) {
      notifications.show({ color: 'orange', title: '未配置支持格式', message: '请先在系统设置中勾选至少一种支持格式（如 jpg, mp4）。' });
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
        notifications.show({ color: 'blue', title: '扫描完成', message: '未找到符合格式要求的素材文件。' });
      } else {
        notifications.show({ color: 'green', title: '扫描完成', message: `共发现 ${results.length} 个文件待整理。` });
      }
    } catch (err) {
      notifications.show({ color: 'red', title: '扫描失败', message: String(err) });
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
      notifications.show({ color: 'orange', title: '未配置转移目录', message: '请先在系统设置中配置“素材转移目录”。' });
      onOpenSettings();
      return;
    }

    const selectedFiles = files.filter(f => f.selected);
    if (selectedFiles.length === 0) {
      notifications.show({ color: 'orange', title: '未选择文件', message: '请至少勾选一个文件。' });
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
      const response = await window.electronAPI.fs.executeOrganize(selectedFiles, organizerDestDir);
      if (!response.success) {
        notifications.show({ color: 'red', title: '整理失败', message: response.error });
        return;
      }

      if (response.missingFolders && response.missingFolders.length > 0) {
        response.missingFolders.forEach(msg => {
          notifications.show({
            color: 'blue',
            title: '新建文件夹提示',
            message: msg,
            autoClose: 10000
          });
        });
      }

      const successCount = response.results?.filter(r => r.success).length || 0;
      const failCount = response.results?.filter(r => !r.success).length || 0;

      if (failCount === 0) {
        notifications.show({ color: 'green', title: '整理完成', message: `成功移动了 ${successCount} 个文件。` });
        setHasOrganized(true);
      } else {
        notifications.show({ color: 'orange', title: '整理完成 (部分失败)', message: `成功: ${successCount}, 失败: ${failCount}` });
      }

      // Remove successful files from the list
      const successfulIds = new Set(response.results?.filter(r => r.success).map(r => r.id));
      setFiles(prev => prev.filter(f => !successfulIds.has(f.id)));
      if (files.filter(f => !successfulIds.has(f.id)).length === 0) {
         setHasOrganized(true);
      }
    } catch (err) {
      notifications.show({ color: 'red', title: '整理过程发生错误', message: String(err) });
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
    <Box style={{ flex: 1, minWidth: 0, position: 'relative', height: '100%' }}>
      <Flex direction="column" h="100%">
        <Group
          justify="space-between"
          px={30}
          h={102}
          style={{
            borderBottom: '1px solid #eef3f8',
            background: 'rgba(255,255,255,0.28)',
          }}
        >
          <Stack gap="xs">
            <Title order={2} size="h3" c="#22324c" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FolderSearch size={24} color="#4f8dff" />
              素材自动整理
            </Title>
            <Text c="dimmed" size="sm">
              自动扫描下载目录中的素材，并按解析出的“游戏名”和“分辨率”归档到目标文件夹。
            </Text>
          </Stack>
        </Group>

        <ScrollArea className="app-scroll" style={{ flex: 1 }}>
          <Stack gap={22} px={30} py={18} pb={132}>
            <Card
              radius={30}
              p={30}
              withBorder
              shadow="sm"
              style={{
                borderColor: 'var(--mantine-color-default-border)',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Group wrap="nowrap" align="stretch" gap={30}>
                {/* 左侧 60% 系统状态 */}
                <Box style={{ flex: '0 0 calc(60% - 15px)', minWidth: 0 }}>
                  <Group gap={8} mb="lg">
                    <FolderSearch size={14} color="#d7e0eb" />
                    <Text fw={800} size="lg" c="#8ea2c1">
                      系统状态
                    </Text>
                  </Group>
                  <Paper
                    radius={26}
                    p={30}
                    h="100%"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 50%, rgba(239, 246, 255, 0.98) 0%, rgba(255,255,255,1) 56%, rgba(241,245,249,0.96) 100%)',
                      border: '1px solid #edf2f7',
                      boxShadow: 'inset 0 0 48px rgba(191, 219, 254, 0.18)',
                      overflow: 'hidden',
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap" align="center" h="100%">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={10} mb="md">
                          <Box
                            w={8}
                            h={8}
                            style={{
                              borderRadius: 999,
                              background: hasOrganized ? '#34d399' : isScanning || isOrganizing ? '#60a5fa' : '#94a3b8',
                            }}
                          />
                          <Badge
                            variant="light"
                            radius="sm"
                            color={hasOrganized ? 'teal' : isScanning || isOrganizing ? 'blue' : 'gray'}
                            styles={{ root: { fontWeight: 800 } }}
                          >
                            {statusLabel}
                          </Badge>
                        </Group>

                        <Title order={1} c="#0f284d" mb={12} style={{ fontSize: 32, lineHeight: 1.02 }}>
                          {statusTitle}
                        </Title>

                        <Text c="#64748b" size="md" fw={500}>
                          {statusDescription}
                        </Text>

                        <Group mt="xl">
                          <Button
                            size="md"
                            radius="xl"
                            variant="default"
                            leftSection={<FolderOpen size={18} />}
                            onClick={handleOpenSourceFolder}
                            styles={{ root: { fontWeight: 800 } }}
                          >
                            打开源目录
                          </Button>
                          {hasOrganized && (
                            <Button
                              size="md"
                              radius="xl"
                              variant="light"
                              color="blue"
                              leftSection={<FolderOpen size={18} />}
                              onClick={handleOpenDestFolder}
                              styles={{ root: { fontWeight: 800 } }}
                            >
                              打开整理目录
                            </Button>
                          )}
                        </Group>
                      </Box>
                      <Paper
                        radius={22}
                        p="lg"
                        shadow="sm"
                        style={{
                          width: 88,
                          height: 110,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#ffffff',
                          flexShrink: 0
                        }}
                      >
                        <FileText size={36} color="#d6dee9" />
                      </Paper>
                    </Group>
                  </Paper>
                </Box>

                {/* 右侧 40% 快捷操作 */}
                <Box style={{ flex: '0 0 calc(40% - 15px)', minWidth: 0 }}>
                   <Group gap={8} mb="lg">
                    <FolderSearch size={14} color="#d7e0eb" opacity={0} />
                    <Text fw={800} size="lg" c="#8ea2c1">
                      快捷操作
                    </Text>
                  </Group>
                  <Paper
                    radius={26}
                    p={24}
                    h="100%"
                    style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid #edf2f7',
                      overflow: 'hidden',
                    }}
                  >
                    <Stack gap="lg" h="100%" justify="center">
                      <Group justify="space-between" wrap="nowrap">
                        <Tooltip label={organizerSourceDir || '未配置源目录'}>
                          <Text fw={600} size="md" c="#334155" truncate style={{ flex: 1, cursor: 'help' }}>
                            源: {getDirName(organizerSourceDir)}
                          </Text>
                        </Tooltip>
                        <Button
                          variant="light"
                          color="blue"
                          size="sm"
                          radius="md"
                          onClick={async () => {
                            const newPath = await window.electronAPI.dialog.selectFolder();
                            if (newPath) {
                              if (onChangeWorkspaceSettings) {
                                onChangeWorkspaceSettings({ sourceDir: newPath });
                              }
                              notifications.show({ color: 'green', title: '成功', message: '已更改源目录配置。' });
                            }
                          }}
                        >
                          更改目录
                        </Button>
                      </Group>

                      <Group justify="space-between" wrap="nowrap">
                        <Tooltip label={organizerDestDir || '未配置转移目录'}>
                          <Text fw={600} size="md" c="#334155" truncate style={{ flex: 1, cursor: 'help' }}>
                            目标: {getDirName(organizerDestDir)}
                          </Text>
                        </Tooltip>
                        <Button
                          variant="light"
                          color="blue"
                          size="sm"
                          radius="md"
                          onClick={async () => {
                            const newPath = await window.electronAPI.dialog.selectFolder();
                            if (newPath) {
                              if (onChangeWorkspaceSettings) {
                                onChangeWorkspaceSettings({ destDir: newPath });
                              }
                              notifications.show({ color: 'green', title: '成功', message: '已更改转移目录配置。' });
                            }
                          }}
                        >
                          更改目录
                        </Button>
                      </Group>

                      <Box mt="auto">
                        <Button
                          fullWidth
                          variant="light"
                          color="red"
                          size="md"
                          radius="md"
                          onClick={async () => {
                            try {
                              const result = await window.electronAPI.fs.undoOrganize();
                              if (result.success) {
                                notifications.show({ color: 'green', title: '撤销成功', message: result.message });
                                // Automatically scan to refresh the list after undoing
                                handleScan();
                              } else {
                                notifications.show({ color: 'orange', title: '撤销失败', message: result.error });
                              }
                            } catch (err) {
                              notifications.show({ color: 'red', title: '执行撤销时出错', message: String(err) });
                            }
                          }}
                        >
                          撤销转移
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
              </Group>
            </Card>

            <Card
              radius={30}
              p={22}
              withBorder
              shadow="sm"
              style={{
                borderColor: 'var(--mantine-color-default-border)',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Group justify="space-between" mb="md">
                <Group gap={8}>
                  <FolderSync size={14} color="#d7e0eb" />
                  <Text fw={800} size="lg" c="#8ea2c1">
                    待整理素材
                  </Text>
                </Group>
              </Group>

              {files.length === 0 ? (
                <Flex h={200} align="center" justify="center" direction="column" gap="md" c="dimmed" style={{ backgroundColor: '#f9fbff', borderRadius: 24, border: '2px dashed #cad7e8' }}>
                  <FolderSearch size={48} opacity={0.3} />
                  <Text>未发现匹配的素材，请确认源目录配置或重新扫描</Text>
                  {(!organizerSourceDir || !organizerDestDir) && (
                    <Button variant="light" size="xs" onClick={onOpenSettings}>去设置目录</Button>
                  )}
                </Flex>
              ) : (
                <Stack gap="md">
                  <Card withBorder radius="md" p="sm" style={{ borderColor: 'var(--mantine-color-default-border)' }}>
                    <Checkbox
                      label="全选"
                      checked={allSelected}
                      indeterminate={indeterminate}
                      onChange={(e) => toggleSelectAll(e.currentTarget.checked)}
                    />
                  </Card>

                  {files.map(file => {
                    const isVideo = file.ext === '.mp4';
                    return (
                      <Card key={file.id} withBorder radius="md" p="md" shadow="sm" style={{ borderColor: 'var(--mantine-color-default-border)' }}>
                        <Group wrap="nowrap" align="center">
                          <Checkbox
                            checked={file.selected}
                            onChange={(e) => toggleSelect(file.id, e.currentTarget.checked)}
                            size="md"
                          />

                          <Box w={64} h={64} style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isVideo ? (
                              <PlayCircle size={32} color="#94a3b8" />
                            ) : (
                               <Image src={`asset://${file.filePath}`} width="100%" height="100%" fit="cover" fallbackSrc={<ImageIcon size={32} color="#94a3b8" />} />
                            )}
                          </Box>

                          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={600} truncate title={file.fileName}>{file.fileName}</Text>
                            <Group gap="xs">
                              <Badge variant="light" color="blue">{file.gameName}</Badge>
                              <Badge variant="light" color="grape">{file.resolution}</Badge>
                              <Badge variant="outline" color="gray">{formatBytes(file.size)}</Badge>
                            </Group>
                          </Stack>

                          {!isVideo && (
                            <Tooltip label="提取为主图并添加到游戏库">
                              <ActionIcon
                                variant="light"
                                color="pink"
                                size="lg"
                                style={{ flexShrink: 0, marginRight: 8 }}
                                onClick={async () => {
                                  try {
                                    const localPath = await window.electronAPI.fs.saveImageToLocal({ sourcePath: file.filePath });
                                    await window.electronAPI.db.insertGameMapping({
                                      game_name: file.gameName,
                                      image_path: localPath,
                                      aliases: []
                                    });
                                    notifications.show({ color: 'green', title: '成功', message: `已将 ${file.gameName} 添加到游戏库` });
                                  } catch (error) {
                                    console.error(error);
                                    notifications.show({ color: 'red', title: '失败', message: '添加到游戏库失败' });
                                  }
                                }}
                              >
                                <BookPlus size={18} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          <Box style={{ textAlign: 'right', flexShrink: 0 }}>
                            <Text size="xs" c="dimmed">将移至</Text>
                            <Text size="sm" fw={500} c="teal">{`${file.gameName}/${file.resolution}/`}</Text>
                          </Box>
                        </Group>
                      </Card>
                    )
                  })}
                </Stack>
              )}
            </Card>
          </Stack>
        </ScrollArea>
      </Flex>

      <Paper
        radius={26}
        p={10}
        shadow="md"
        style={{
          position: 'absolute',
          right: 28,
          bottom: 24,
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #e8eef5',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
          zIndex: 100,
        }}
      >
        <Group gap={14}>
          <Button
            radius={18}
            color="dark"
            size="lg"
            leftSection={<FolderSearch size={18} fill="currentColor" />}
            onClick={handleScan}
            loading={isScanning}
            styles={{
              root: {
                height: 58,
                paddingInline: 32,
                background: '#111a34',
                fontSize: 18,
                fontWeight: 900,
                boxShadow: '0 12px 28px rgba(17, 26, 52, 0.2)',
              },
            }}
          >
            一键扫描
          </Button>
          <Button
            radius={18}
            color="teal"
            size="lg"
            leftSection={<CheckCircle2 size={20} />}
            onClick={handleOrganize}
            loading={isOrganizing}
            disabled={files.length === 0 || files.filter(f => f.selected).length === 0}
            styles={{
              root: {
                height: 58,
                paddingInline: 32,
                background: '#19c37d',
                fontSize: 18,
                fontWeight: 900,
                boxShadow: '0 12px 28px rgba(25, 195, 125, 0.22)',
              },
            }}
          >
            确认转移 ({files.filter(f => f.selected).length})
          </Button>
        </Group>
      </Paper>
    </Box>
  );
}
