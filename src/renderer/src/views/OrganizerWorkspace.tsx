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
} from '@mantine/core';
import { FolderSearch, FolderSync, PlayCircle, Image as ImageIcon, FolderOpen, CheckCircle2 } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { WorkflowSettings, formatBytes } from '../appState';

interface OrganizerWorkspaceProps {
  workflowSettings: WorkflowSettings;
  onOpenSettings: () => void;
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

export function OrganizerWorkspace({ workflowSettings, onOpenSettings }: OrganizerWorkspaceProps) {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [lastOrganizedDir, setLastOrganizedDir] = useState<string>('');
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  const { organizerSourceDir, organizerDestDir, organizerFormats } = workflowSettings;

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
      if (results.length === 0) {
        notifications.show({ color: 'blue', title: '扫描完成', message: '未找到符合格式要求的素材文件。' });
      } else {
        notifications.show({ color: 'green', title: '扫描完成', message: `共发现 ${results.length} 个文件待整理。` });

        // Asynchronously load image previews for safety in Electron
        results.forEach(async (file) => {
          if (file.ext !== '.mp4') {
            try {
              const base64 = await window.electronAPI.fs.readImageBase64(file.filePath);
              if (base64) {
                setImagePreviews((prev) => ({ ...prev, [file.id]: base64 }));
              }
            } catch (err) {
              console.error('Failed to read image for preview:', err);
            }
          }
        });
      }
    } catch (err) {
      notifications.show({ color: 'red', title: '扫描失败', message: String(err) });
    } finally {
      setIsScanning(false);
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

    setIsOrganizing(true);
    try {
      const response = await window.electronAPI.fs.executeOrganize(selectedFiles, organizerDestDir);
      if (!response.success) {
        notifications.show({ color: 'red', title: '整理失败', message: response.error });
        return;
      }

      if (response.missingFolders && response.missingFolders.length > 0) {
        notifications.show({
          color: 'blue',
          title: '自动创建了以下缺失文件夹',
          message: response.missingFolders.join(', '),
          autoClose: 10000
        });
      }

      const successCount = response.results?.filter(r => r.success).length || 0;
      const failCount = response.results?.filter(r => !r.success).length || 0;

      if (failCount === 0) {
        notifications.show({ color: 'green', title: '整理完成', message: `成功移动了 ${successCount} 个文件。` });
      } else {
        notifications.show({ color: 'orange', title: '整理完成 (部分失败)', message: `成功: ${successCount}, 失败: ${failCount}` });
      }

      // Remove successful files from the list
      const successfulIds = new Set(response.results?.filter(r => r.success).map(r => r.id));
      setFiles(prev => prev.filter(f => !successfulIds.has(f.id)));
      if (successCount > 0) {
        setLastOrganizedDir(organizerDestDir);
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

  return (
    <Flex direction="column" h="100%">
      <Box p="xl" bg="white" style={{ borderBottom: '1px solid #e2e8f0', zIndex: 10 }}>
        <Flex justify="space-between" align="center">
          <Stack gap="xs">
            <Title order={2} c="#1e293b" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FolderSearch size={28} color="#4f8dff" />
              素材自动整理
            </Title>
            <Text c="dimmed" size="sm">
              自动扫描下载目录中的素材，并按解析出的“游戏名”和“分辨率”归档到目标文件夹。
            </Text>
          </Stack>
          <Group>
            <Button
              variant="default"
              leftSection={<FolderSearch size={16} />}
              onClick={handleScan}
              loading={isScanning}
            >
              一键扫描 ({organizerFormats?.join(', ') || '未配置格式'})
            </Button>
            <Button
              color="teal"
              leftSection={<FolderSync size={16} />}
              onClick={handleOrganize}
              loading={isOrganizing}
              disabled={files.length === 0}
            >
              确认转移 ({files.filter(f => f.selected).length})
            </Button>
          </Group>
        </Flex>
      </Box>

      <ScrollArea className="app-scroll" style={{ flex: 1, backgroundColor: '#f7f9fc' }} p="xl" pb={160}>
        <Stack gap="xl">
          <Card radius="md" p="xl" withBorder shadow="sm" bg="white">
            <Group justify="space-between" align="center">
              <Box>
                <Group gap={8} mb="sm">
                  <Box w={8} h={8} style={{ borderRadius: 999, background: isOrganizing || isScanning ? '#3b82f6' : '#10b981' }} />
                  <Text fw={600} size="sm" c={isOrganizing || isScanning ? 'blue' : 'teal'}>
                    {isScanning ? '正在扫描...' : isOrganizing ? '正在转移...' : files.length > 0 ? '待确认转移' : lastOrganizedDir ? '转移完成' : '系统就绪'}
                  </Text>
                </Group>
                <Title order={3} c="#1e293b" mb="xs">
                  {isScanning ? '读取文件中' : isOrganizing ? '文件移动中' : files.length > 0 ? `已发现 ${files.length} 个文件` : lastOrganizedDir ? '所有文件已转移' : '等待扫描'}
                </Title>
                <Text c="dimmed" size="sm">
                  源目录: {organizerSourceDir || '未设置'}<br />
                  目标目录: {organizerDestDir || '未设置'}
                </Text>
              </Box>

              {lastOrganizedDir && files.length === 0 && !isScanning && !isOrganizing && (
                <Button
                  size="md"
                  radius="xl"
                  variant="light"
                  color="blue"
                  leftSection={<FolderOpen size={18} />}
                  onClick={() => window.electronAPI.shell.openPath(lastOrganizedDir)}
                >
                  打开目标文件夹
                </Button>
              )}
            </Group>
          </Card>

          {files.length === 0 && !lastOrganizedDir ? (
            <Flex h={300} align="center" justify="center" direction="column" gap="md" c="dimmed">
              <FolderSearch size={64} opacity={0.3} />
              <Text>点击右上方“一键扫描”开始读取下载目录</Text>
              {(!organizerSourceDir || !organizerDestDir) && (
                <Button variant="light" size="xs" onClick={onOpenSettings}>去设置目录</Button>
              )}
            </Flex>
          ) : files.length > 0 ? (
            <Stack gap="md">
              <Card withBorder radius="md" p="sm" bg="white">
                <Group justify="space-between">
                <Checkbox
                  label="全选"
                  checked={allSelected}
                  indeterminate={indeterminate}
                  onChange={(e) => toggleSelectAll(e.currentTarget.checked)}
                />
                <Text size="sm" c="dimmed">
                  源目录: {organizerSourceDir}
                </Text>
              </Group>
            </Card>

            {files.map(file => {
              const isVideo = file.ext === '.mp4';
              return (
                <Card key={file.id} withBorder radius="md" p="md" bg="white" shadow="sm">
                  <Group wrap="nowrap" align="center">
                    <Checkbox
                      checked={file.selected}
                      onChange={(e) => toggleSelect(file.id, e.currentTarget.checked)}
                      size="md"
                    />

                    <Box w={64} h={64} style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isVideo ? (
                        <PlayCircle size={32} color="#94a3b8" />
                      ) : imagePreviews[file.id] ? (
                        <Image src={imagePreviews[file.id]} width="100%" height="100%" fit="cover" fallbackSrc={<ImageIcon size={32} color="#94a3b8" />} />
                      ) : (
                         <ImageIcon size={32} color="#94a3b8" />
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

                    <Box style={{ textAlign: 'right', flexShrink: 0 }}>
                      <Text size="xs" c="dimmed">将移至</Text>
                      <Text size="sm" fw={500} c="teal">{`${file.gameName}/${file.resolution}/`}</Text>
                    </Box>
                  </Group>
                </Card>
              )
            })}
            </Stack>
          ) : null}
        </Stack>
      </ScrollArea>
    </Flex>
  );
}
