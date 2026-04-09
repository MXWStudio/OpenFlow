import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Image,
  ScrollArea,
  Stack,
  Text,
  Title,
  TextInput,
  TagsInput,
  ActionIcon,
  Modal,
  FileInput,
  Badge
} from '@mantine/core';
import { Plus, Trash, Search, Image as ImageIcon, ClipboardPaste } from 'lucide-react';
import { notify } from '../utils/notify';
import { GameMapping } from '../appState';

export function GameDictionaryWorkspace() {
  const [mappings, setMappings] = useState<GameMapping[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Partial<GameMapping>>({
    game_name: '',
    image_path: '',
    aliases: []
  });

  const [isSaving, setIsSaving] = useState(false);

  const loadMappings = async () => {
    try {
      const data = await window.electronAPI.db.getGameMappings();
      setMappings(data);
    } catch (error) {
      console.error(error);
      notify('red', '错误', '加载游戏库失败');
    }
  };

  useEffect(() => {
    loadMappings();
  }, []);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isModalOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const buffer = await file.arrayBuffer();
            const base64String = Buffer.from(buffer).toString('base64');
            const dataUrl = `data:${item.type};base64,${base64String}`;

            try {
              const localPath = await window.electronAPI.fs.saveImageToLocal({ dataUrl });
              setEditingMapping(prev => ({ ...prev, image_path: localPath }));
              notify('green', '成功', '已粘贴图片');
            } catch (error) {
              console.error(error);
              notify('red', '错误', '保存粘贴的图片失败');
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isModalOpen]);

  const handleOpenModal = (mapping?: GameMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
    } else {
      setEditingMapping({ game_name: '', image_path: '', aliases: [] });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingMapping.game_name || !editingMapping.image_path) {
      notify('orange', '提示', '请填写游戏名称并上传主视觉图');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMapping.id) {
        await window.electronAPI.db.updateGameMapping(editingMapping.id, editingMapping);
        notify('green', '成功', '已更新记录');
      } else {
        await window.electronAPI.db.insertGameMapping(editingMapping);
        notify('green', '成功', '已添加新记录');
      }
      setIsModalOpen(false);
      loadMappings();
    } catch (error) {
      console.error(error);
      notify('red', '错误', '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await window.electronAPI.db.deleteGameMapping(id);
      notify('green', '成功', '已删除记录');
      loadMappings();
    } catch (error) {
      console.error(error);
      notify('red', '错误', '删除失败');
    }
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    try {
      // Use the exposed webUtils to get the actual file path safely in Electron
      const sourcePath = window.electronAPI.webUtils.getPathForFile(file);
      if (sourcePath) {
        const localPath = await window.electronAPI.fs.saveImageToLocal({ sourcePath });
        setEditingMapping(prev => ({ ...prev, image_path: localPath }));
      }
    } catch (error) {
      console.error(error);
      notify('red', '错误', '保存上传的图片失败');
    }
  };

  const filteredMappings = mappings.filter(m =>
    m.game_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.aliases.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Box p="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" mb="md">
        <Title order={2}>游戏库</Title>
        <Group>
          <TextInput
            placeholder="搜索游戏名称或别名..."
            leftSection={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <Button leftSection={<Plus size={16} />} onClick={() => handleOpenModal()}>
            添加记录
          </Button>
        </Group>
      </Group>

      <ScrollArea flex={1} offsetScrollbars>
        <Grid>
          {filteredMappings.map(mapping => (
            <Grid.Col key={mapping.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Card.Section>
                  <Image
                    src={`asset://${mapping.image_path}`}
                    height={160}
                    alt={mapping.game_name}
                    fallbackSrc="https://placehold.co/600x400?text=No+Image"
                  />
                </Card.Section>

                <Group justify="space-between" mt="md" mb="xs">
                  <Text fw={500} lineClamp={1}>{mapping.game_name}</Text>
                  <ActionIcon color="red" variant="subtle" onClick={() => mapping.id && handleDelete(mapping.id)}>
                    <Trash size={16} />
                  </ActionIcon>
                </Group>

                <Group gap={5}>
                  {mapping.aliases.length > 0 ? (
                    mapping.aliases.map((alias, i) => (
                      <Badge key={i} variant="light" size="sm">
                        {alias}
                      </Badge>
                    ))
                  ) : (
                    <Text size="sm" c="dimmed">暂无别名</Text>
                  )}
                </Group>

                <Button variant="light" fullWidth mt="md" onClick={() => handleOpenModal(mapping)}>
                  编辑
                </Button>
              </Card>
            </Grid.Col>
          ))}
          {filteredMappings.length === 0 && (
            <Grid.Col span={12}>
              <Text c="dimmed" ta="center" py="xl">暂无记录，点击右上角添加。</Text>
            </Grid.Col>
          )}
        </Grid>
      </ScrollArea>

      <Modal opened={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMapping.id ? "编辑记录" : "添加记录"} size="lg">
        <Stack>
          <TextInput
            label="核心游戏名称"
            placeholder="例如：原神"
            value={editingMapping.game_name || ''}
            onChange={(e) => setEditingMapping(prev => ({ ...prev, game_name: e.currentTarget.value }))}
            required
          />

          <Box>
            <Text size="sm" fw={500} mb={3}>主视觉画面 (必需)</Text>
            {editingMapping.image_path ? (
              <Box pos="relative">
                <Image src={`asset://${editingMapping.image_path}`} radius="md" height={200} fit="contain" />
                <ActionIcon
                  pos="absolute" top={5} right={5} color="red" variant="filled"
                  onClick={() => setEditingMapping(prev => ({ ...prev, image_path: '' }))}
                >
                  <Trash size={16} />
                </ActionIcon>
              </Box>
            ) : (
              <Card withBorder padding="xl" radius="md" style={{ borderStyle: 'dashed', textAlign: 'center' }}>
                <Stack align="center" gap="xs">
                  <ImageIcon size={32} opacity={0.5} />
                  <Text size="sm" c="dimmed">请选择图片或直接按 Ctrl+V 粘贴</Text>
                  <Group justify="center">
                    <FileInput
                      placeholder="选择图片文件"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id="file-upload"
                    />
                    <Button variant="light" onClick={() => document.getElementById('file-upload')?.click()}>
                      浏览文件
                    </Button>
                    <Button variant="subtle" leftSection={<ClipboardPaste size={16} />} disabled>
                      支持粘贴
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Box>

          <TagsInput
            label="关联名称（别名/曾用名）"
            placeholder="输入名称后按回车"
            value={editingMapping.aliases || []}
            onChange={(val) => setEditingMapping(prev => ({ ...prev, aliases: val }))}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setIsModalOpen(false)}>取消</Button>
            <Button onClick={handleSave} loading={isSaving}>保存</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
