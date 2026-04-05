import React, { useState, useRef, useMemo } from 'react';
import {
  Box,
  Flex,
  Text,
  Title,
  Card,
  Stack,
  Button,
  Group,
  Checkbox,
  NumberInput,
  Select,
  ScrollArea,
  ActionIcon,
  Badge,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Trash2, FolderSearch, UploadCloud, Settings, ChevronRight } from 'lucide-react';
import { dedupeStrings } from '../appState';

interface MediaFile {
  id: string;
  filePath: string;
  fileName: string;
  ext: string;
  size: number;
  type: 'image' | 'video' | 'unknown';
  status: 'pending' | 'processing' | 'success' | 'error';
  targetPath?: string;
  error?: string;
}

interface FormatConfig {
  resize: {
    enabled: boolean;
    mode: 'percentage' | 'resolution';
    percentage: number;
    width: number;
    height: number;
  };
  quality: number; // 1-100
  format: string; // '', 'jpg', 'png', 'webp', 'mp4', 'webm'
  useDynamicFolderName: boolean;
  customExportPath: string;
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v']);

export function FormatProcessor() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [config, setConfig] = useState<FormatConfig>({
    resize: { enabled: false, mode: 'percentage', percentage: 50, width: 1920, height: 1080 },
    quality: 80,
    format: '',
    useDynamicFolderName: false,
    customExportPath: '',
  });

  const dragCounter = useRef(0);

  const mediaType = useMemo(() => {
    if (files.length === 0) return null;
    return files[0].type;
  }, [files]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const newFiles: MediaFile[] = [];
    let conflictType = false;

    for (const file of Array.from(e.dataTransfer.files)) {
      // Very basic file checking here. Ideally we would read from directories too
      // but for simplicity we rely on HTML5 file drop
      const extMatch = file.name.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0].toLowerCase() : '';
      let type: 'image' | 'video' | 'unknown' = 'unknown';

      if (IMAGE_EXTS.has(ext)) type = 'image';
      else if (VIDEO_EXTS.has(ext)) type = 'video';

      if (type !== 'unknown') {
        if (mediaType && type !== mediaType && files.length > 0) {
          conflictType = true;
          continue; // Skip mismatched types
        }

        // Handle initial first file type check against subsequent files in this batch
        if (newFiles.length > 0 && newFiles[0].type !== type) {
           conflictType = true;
           continue;
        }

        newFiles.push({
          id: file.path + Date.now() + Math.random(),
          filePath: file.path,
          fileName: file.name,
          ext,
          size: file.size,
          type,
          status: 'pending'
        });
      }
    }

    if (conflictType) {
      notifications.show({
         color: 'orange',
         title: '类型不匹配',
         message: '批量处理只能同时处理图片或视频，已自动忽略不匹配的文件。'
      });
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const handleSelectExportPath = async () => {
    const folderPath = await window.electronAPI.dialog.selectFolder();
    if (folderPath) {
      setConfig(prev => ({ ...prev, customExportPath: folderPath }));
    }
  };

  const buildDynamicFolderName = () => {
    const parts = [];
    if (config.resize.enabled) {
      if (config.resize.mode === 'percentage') parts.push(`${config.resize.percentage}%`);
      else parts.push(`${config.resize.width}x${config.resize.height}`);
    }
    if (config.quality !== 100) parts.push(`q${config.quality}`);
    if (config.format) parts.push(config.format.replace('.', ''));
    return parts.join('_') || '默认处理';
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    // reset status
    setFiles(prev => prev.map(f => ({ ...f, status: 'processing', error: undefined, targetPath: undefined })));

    const dynamicFolderName = buildDynamicFolderName();

    try {
      const res = await window.electronAPI.fs.processFormat(
        files.map(f => ({ id: f.id, filePath: f.filePath, fileName: f.fileName, ext: f.ext })),
        { ...config, dynamicFolderName }
      );

      if (res.success && res.results) {
         setFiles(prev => prev.map(f => {
            const r = res.results.find((result: any) => result.id === f.id);
            if (r) {
               return { ...f, status: r.success ? 'success' : 'error', error: r.error, targetPath: r.targetPath };
            }
            return f;
         }));

         const successCount = res.results.filter((r: any) => r.success).length;
         if (successCount === files.length) {
            notifications.show({ color: 'green', title: '处理完成', message: `成功处理 ${successCount} 个文件` });
         } else {
            notifications.show({ color: 'orange', title: '处理完成', message: `成功处理 ${successCount} 个文件，失败 ${files.length - successCount} 个` });
         }
      } else {
         notifications.show({ color: 'red', title: '处理失败', message: res.error || '未知错误' });
         setFiles(prev => prev.map(f => ({ ...f, status: 'error', error: '系统错误' })));
      }
    } catch (err) {
       notifications.show({
         color: 'red',
         title: '处理异常',
         message: err instanceof Error ? err.message : String(err)
       });
       setFiles(prev => prev.map(f => ({ ...f, status: 'error', error: '系统异常' })));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatOptions = mediaType === 'video'
    ? [{ value: '', label: '保持原格式' }, { value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]
    : [{ value: '', label: '保持原格式' }, { value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }];

  return (
    <Flex h="100%" direction="column" bg="#f7f9fc" p={24} gap="lg">
      <Group justify="space-between">
         <Box>
            <Title order={3} c="#1d2230">格式处理</Title>
            <Text size="sm" c="dimmed">批量调整分辨率、压缩质量、转换格式</Text>
         </Box>
         <Group>
            {files.length > 0 && <Button variant="light" color="red" onClick={clearFiles} disabled={isProcessing}>清空列表</Button>}
         </Group>
      </Group>

      <Flex gap="lg" style={{ flex: 1, minHeight: 0 }}>
        {/* 左侧：文件列表与拖拽区 */}
        <Card
          radius="xl"
          withBorder
          shadow="sm"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderColor: isDragging ? '#4f8dff' : undefined,
            backgroundColor: isDragging ? 'rgba(79, 141, 255, 0.05)' : undefined,
            transition: 'all 0.2s'
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length === 0 ? (
            <Flex direction="column" align="center" justify="center" h="100%" c="dimmed">
              <UploadCloud size={48} strokeWidth={1.5} style={{ marginBottom: 16, opacity: 0.5 }} />
              <Text fw={500} size="lg">拖拽图片或视频到此处</Text>
              <Text size="sm" mt={8}>一次只能处理同一类型的文件（全图片或全视频）</Text>
            </Flex>
          ) : (
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap="xs" p="xs">
                {files.map(f => (
                  <Card key={f.id} withBorder p="sm" radius="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Group wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                        <Badge color={f.type === 'image' ? 'blue' : 'violet'} variant="light">{f.type === 'image' ? '图片' : '视频'}</Badge>
                        <Text truncate style={{ flex: 1 }} title={f.filePath}>{f.fileName}</Text>
                      </Group>
                      <Group gap="sm">
                        {f.status === 'processing' && <Loader size="xs" />}
                        {f.status === 'success' && <Badge color="green">完成</Badge>}
                        {f.status === 'error' && <Badge color="red" title={f.error}>失败</Badge>}
                        <ActionIcon color="red" variant="subtle" onClick={() => removeFile(f.id)} disabled={isProcessing}>
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    {f.targetPath && <Text size="xs" c="dimmed" mt={4} truncate title={f.targetPath}>输出: {f.targetPath}</Text>}
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Card>

        {/* 右侧：动作流配置区 */}
        <Card radius="xl" withBorder shadow="sm" w={340} style={{ display: 'flex', flexDirection: 'column' }}>
          <Title order={5} mb="md" c="#22324c" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={18} /> 处理动作流
          </Title>

          <ScrollArea style={{ flex: 1 }} type="scroll">
            <Stack gap="xl" pr="sm">
              {/* 尺寸调整 */}
              <Box>
                <Checkbox
                  label="调整分辨率"
                  checked={config.resize.enabled}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setConfig(prev => ({ ...prev, resize: { ...prev.resize, enabled: checked } }));
                  }}
                  mb="sm"
                  fw={500}
                />
                {config.resize.enabled && (
                  <Card withBorder radius="md" p="sm" bg="gray.0">
                    <Select
                      label="调整方式"
                      size="sm"
                      data={[{ value: 'percentage', label: '按比例缩放' }, { value: 'resolution', label: '指定最大宽高' }]}
                      value={config.resize.mode}
                      onChange={(val) => setConfig(prev => ({ ...prev, resize: { ...prev.resize, mode: val as any } }))}
                      mb="sm"
                    />
                    {config.resize.mode === 'percentage' ? (
                      <NumberInput
                        label="缩放比例 (%)"
                        size="sm"
                        min={1} max={200}
                        value={config.resize.percentage}
                        onChange={(val) => setConfig(prev => ({ ...prev, resize: { ...prev.resize, percentage: Number(val) } }))}
                      />
                    ) : (
                      <Group grow>
                        <NumberInput
                          label="最大宽度"
                          size="sm"
                          min={1}
                          value={config.resize.width}
                          onChange={(val) => setConfig(prev => ({ ...prev, resize: { ...prev.resize, width: Number(val) } }))}
                        />
                        <NumberInput
                          label="最大高度"
                          size="sm"
                          min={1}
                          value={config.resize.height}
                          onChange={(val) => setConfig(prev => ({ ...prev, resize: { ...prev.resize, height: Number(val) } }))}
                        />
                      </Group>
                    )}
                  </Card>
                )}
              </Box>

              {/* 质量压缩 */}
              <Box>
                <Text fw={500} size="sm" mb="xs">输出质量压缩</Text>
                <Card withBorder radius="md" p="sm" bg="gray.0">
                  <NumberInput
                    description="1-100，越小体积越小，质量越低"
                    size="sm"
                    min={1} max={100}
                    value={config.quality}
                    onChange={(val) => setConfig(prev => ({ ...prev, quality: Number(val) }))}
                  />
                </Card>
              </Box>

              {/* 格式转换 */}
              <Box>
                <Text fw={500} size="sm" mb="xs">格式转换</Text>
                <Select
                  size="sm"
                  data={formatOptions}
                  value={config.format}
                  onChange={(val) => setConfig(prev => ({ ...prev, format: val || '' }))}
                />
              </Box>

              {/* 导出设置 */}
              <Box>
                 <Title order={6} mb="sm" c="#22324c">导出设置</Title>
                 <Stack gap="sm">
                    <Checkbox
                       label="使用动作拼接文件夹名"
                       description={config.useDynamicFolderName ? `例如: openflow(${buildDynamicFolderName()})处理` : "关闭时默认使用 'openflow处理'"}
                       checked={config.useDynamicFolderName}
                       onChange={(e) => {
                         const checked = e.currentTarget.checked;
                         setConfig(prev => ({ ...prev, useDynamicFolderName: checked }));
                       }}
                    />
                    <Box>
                       <Text size="sm" fw={500} mb={4}>自定义导出目录</Text>
                       <Group wrap="nowrap">
                          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                             {config.customExportPath || '默认(原文件同级目录下创建)'}
                          </Text>
                          <Button size="xs" variant="light" onClick={handleSelectExportPath}>选择</Button>
                       </Group>
                    </Box>
                 </Stack>
              </Box>
            </Stack>
          </ScrollArea>

          <Button
            mt="md"
            size="lg"
            fullWidth
            onClick={handleProcess}
            loading={isProcessing}
            disabled={files.length === 0}
            rightSection={!isProcessing && <ChevronRight size={18} />}
          >
            开始处理
          </Button>
        </Card>
      </Flex>
    </Flex>
  );
}
