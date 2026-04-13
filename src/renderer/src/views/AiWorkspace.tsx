import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Group,
  Image,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Loader,
  Badge,
  Paper,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { Sparkles, UploadCloud, CheckCircle2, XCircle, ImageIcon } from 'lucide-react';
import { notify } from '../utils/notify';
import { WorkflowSettings, ApiKeys } from '../appState';
import { applyAiTemplate } from '../utils'; // We'll create this helper

interface AiImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  originalName: string;
  newName?: string;
  error?: string;
  width?: number;
  height?: number;
}

interface AiWorkspaceProps {
  workflowSettings: WorkflowSettings;
  apiKeys: ApiKeys;
  producerName: string;
}

export function AiWorkspace({ workflowSettings, apiKeys, producerName }: AiWorkspaceProps) {
  const [images, setImages] = useState<AiImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
      originalName: file.name,
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const getImageDimensions = (file: File): Promise<{ width: number, height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const callAiApi = async (base64Image: string): Promise<{ element: string, category: string }> => {
    const config = apiKeys.aiIntegration;
    if (!config?.apiBaseUrl || !config?.apiKey || !config?.modelName) {
      throw new Error('未配置完整的 AI API 参数，请先前往设置中心配置');
    }

    const payload = {
      model: config.modelName,
      messages: [
        {
          role: 'system',
          content: config.systemPrompt || '请识别图片，提取“画面元素”和“游戏品类”，并严格按照“画面元素-游戏品类”的格式返回，不要包含其他任何文本。例如：橡皮人-射击'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '提取这图里的“画面元素”和“游戏品类”，格式：画面元素-游戏品类' },
            { type: 'image_url', image_url: { url: base64Image } }
          ]
        }
      ],
      max_tokens: 50,
      temperature: 0.1
    };

    const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API 响应错误: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    const parts = content.split('-');
    if (parts.length >= 2) {
      return { element: parts[0].trim(), category: parts[1].trim() };
    }

    // Fallback parsing if AI didn't follow dash strictly
    throw new Error(`AI 返回格式无法解析: ${content}`);
  };

  const processImages = async () => {
    const pendingImages = images.filter(img => img.status === 'pending' || img.status === 'error');
    if (pendingImages.length === 0) return;

    setIsProcessing(true);

    const templateTokens = workflowSettings.renameTemplates.aiImage || [];

    for (const img of pendingImages) {
      setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing' } : p));

      try {
        const { width, height } = await getImageDimensions(img.file);
        const aspectRatio = width >= height ? '横' : '竖';
        const base64Image = await fileToBase64(img.file);

        const { element, category } = await callAiApi(base64Image);

        // Calculate name preview logic using applyNewTemplate equivalent
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const today = `${y}${m}${d}`;

        // Dynamic importing pinyin here or handling it in pure util is preferred.
        // For simplicity we will rely on IPC to execute renaming where we can pass the vars safely.
        // To show newName, we'll construct it in pure frontend first.
        const vars = {
          AiElement: element,
          AiCategory: category,
          AspectRatio: aspectRatio,
          Date: today,
          OriginalName: img.originalName.substring(0, img.originalName.lastIndexOf('.')) || img.originalName,
        };

        // Call main process to actually do the renaming using our new template + AI vars.
        // We'll create a new IPC handler specific for this to avoid muddying `fs:executeRename`.
        if (window.electronAPI) {
          const res = await window.electronAPI.ipcRenderer.invoke('fs:renameAiBatch', {
             filePath: img.file.path,
             templates: templateTokens,
             producerName,
             vars
          });

          if (res.success) {
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'success', newName: res.newFileName } : p));
          } else {
            throw new Error(res.error || '重命名失败');
          }
        } else {
           // Fallback for non-electron env testing
           setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'success', newName: `mock-${element}-${category}.png` } : p));
        }

      } catch (err: any) {
        setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error', error: err.message || '处理失败' } : p));
      }
    }

    setIsProcessing(false);
    notify('green', '处理完成', '所有图片已处理完毕。');
  };

  const handleClear = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  return (
    <Flex h="100%" direction="column" bg="var(--mantine-color-body)" style={{ position: 'relative' }}>
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', backgroundColor: 'var(--mantine-color-body)' }}>
        <Group justify="space-between">
          <Group>
            <ThemeIcon size="lg" radius="md" variant="light" color="violet">
              <Sparkles size={20} />
            </ThemeIcon>
            <Title order={3}>AI 识图命名</Title>
          </Group>
        </Group>
      </Box>

      <Box flex={1} p="md" style={{ overflowY: 'auto' }}>
        {images.length === 0 ? (
          <Dropzone
            onDrop={handleDrop}
            accept={IMAGE_MIME_TYPE}
            maxSize={20 * 1024 ** 2} // 20MB
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--mantine-color-body)',
              border: '2px dashed var(--mantine-color-default-border)',
              borderRadius: '16px',
              transition: 'border-color 0.2s ease',
            }}
          >
            <Stack align="center" gap="sm">
              <UploadCloud size={64} color="var(--mantine-color-dimmed)" />
              <Text size="xl" fw={600}>拖拽图片到此处，或点击选择</Text>
              <Text c="dimmed">支持拖入多张图片（建议 20-30 张/批）</Text>
            </Stack>
          </Dropzone>
        ) : (
          <Stack gap="sm">
            <Dropzone
              onDrop={handleDrop}
              accept={IMAGE_MIME_TYPE}
              style={{
                padding: '24px',
                backgroundColor: 'var(--mantine-color-body)',
                border: '2px dashed var(--mantine-color-default-border)',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              <Group justify="center" gap="sm">
                <UploadCloud size={24} color="var(--mantine-color-dimmed)" />
                <Text fw={500} c="dimmed">继续拖入或点击添加更多图片</Text>
              </Group>
            </Dropzone>

            {images.map(img => (
              <Card key={img.id} withBorder radius="md" p="sm" bg="var(--mantine-color-body)">
                <Group wrap="nowrap" justify="space-between">
                  <Group wrap="nowrap">
                    <Image src={img.previewUrl} w={64} h={64} radius="md" fit="cover" />
                    <Box>
                      <Text fw={500} size="sm" lineClamp={1}>{img.originalName}</Text>
                      {img.status === 'success' && img.newName && (
                        <Text size="sm" c="green" fw={600} mt={4}>{`=> ${img.newName}`}</Text>
                      )}
                      {img.status === 'error' && (
                        <Text size="xs" c="red" mt={4}>{img.error}</Text>
                      )}
                    </Box>
                  </Group>
                  <Box>
                    {img.status === 'pending' && <Badge color="gray" variant="light">待处理</Badge>}
                    {img.status === 'processing' && <Loader size="sm" color="violet" />}
                    {img.status === 'success' && <ThemeIcon color="green" variant="light"><CheckCircle2 size={16} /></ThemeIcon>}
                    {img.status === 'error' && <ThemeIcon color="red" variant="light"><XCircle size={16} /></ThemeIcon>}
                  </Box>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      <Paper
        radius={26}
        p={10}
        shadow="md"
        style={{
          position: 'absolute',
          right: 28,
          bottom: 24,
          background: "var(--mantine-color-default)",
          border: '1px solid var(--mantine-color-default-border)',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
        }}
      >
        <Group gap={14}>
          <Button
            radius={18}
            variant="default"
            size="lg"
            onClick={handleClear}
            disabled={images.length === 0 || isProcessing}
            styles={{
              root: {
                height: 58,
                paddingInline: 32,
                fontSize: 18,
                fontWeight: 900,
                boxShadow: '0 12px 28px rgba(17, 26, 52, 0.05)',
              },
            }}
          >
            清空列表
          </Button>
          <Button
            radius={18}
            color="violet"
            size="lg"
            onClick={processImages}
            loading={isProcessing}
            disabled={images.length === 0 || images.every(img => img.status === 'success')}
            leftSection={<Sparkles size={20} />}
            styles={{
              root: {
                height: 58,
                paddingInline: 32,
                fontSize: 18,
                fontWeight: 900,
                boxShadow: '0 12px 28px rgba(132, 94, 247, 0.22)',
              },
            }}
          >
            开始识图重命名
          </Button>
        </Group>
      </Paper>
    </Flex>
  );
}
