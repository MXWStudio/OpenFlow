import React, { useMemo, useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Flex,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileJson,
  FileText,
  FolderOpen,
  FolderPlus,
  Globe,
  GripVertical,
  History,
  LayoutGrid,
  Play,
  Settings,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { formatBytes, type ValidationResult } from '../appState';
import { StatusBadge } from '../StatusBadge';

interface DailyWorkspaceProps {
  jsonFileName: string;
  projectsCount: number;
  selectedSizes: string[];
  horizontalSizes: string[];
  verticalSizes: string[];
  folderPaths: string[];
  validationResults: ValidationResult[];
  isChangingJson: boolean;
  isValidating: boolean;
  isRenaming: boolean;
  hasValidated: boolean;
  hasIssues: boolean;
  canRename: boolean;
  isTableExpanded: boolean;
  isSpecialEnabled: boolean;
  isManualEnabled: boolean;
  lastRenamedPaths: string[];
  onToggleTable: () => void;
  onToggleSpecialEnabled: (enabled: boolean) => void;
  onToggleManualEnabled: (enabled: boolean) => void;
  onToggleSize: (size: string) => void;
  onChangeJson: () => void;
  onInitFolders: () => void;
  onAddFolder: () => void;
  onClearFolders: () => void;
  onRemoveFolder: (path: string) => void;
  onValidate: () => void;
  onRename: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onDropPaths: (paths: string[]) => void;
  onOpenFolder: (path: string) => void;
  layoutLeft: string[];
  layoutRight: string[];
  onLayoutChange: (left: string[], right: string[]) => void;
}

const cardStyle = {
  borderColor: 'var(--mantine-color-default-border)',
  background: 'var(--mantine-color-default)',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.04)',
} as const;

const iconButtonStyle = {
  root: {
    width: 34,
    height: 34,
    color: 'var(--mantine-color-dimmed)',
  },
} as const;

function SectionTitle({ children, dragHandleProps }: { children: React.ReactNode, dragHandleProps?: any }) {
  return (
    <Group gap={8} mb="md" {...dragHandleProps} style={{ cursor: dragHandleProps ? 'grab' : 'default' }}>
      <GripVertical size={14} color="var(--mantine-color-dimmed)" />
      <Text fw={800} size="lg" c="var(--mantine-color-dimmed)">
        {children}
      </Text>
    </Group>
  );
}

function SizeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      radius={15}
      variant={active ? 'filled' : 'default'}
      onClick={onClick}
      styles={{
        root: {
          height: 48,
          background: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-default)',
          color: active ? 'var(--mantine-color-white)' : 'var(--mantine-color-text)',
          border: active ? '1px solid var(--mantine-primary-color-filled)' : '1px solid var(--mantine-color-default-border)',
          boxShadow: active ? '0 10px 22px rgba(0, 0, 0, 0.14)' : '0 6px 18px rgba(0, 0, 0, 0.08)',
          fontSize: 15,
          fontWeight: 800,
          paddingInline: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        inner: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        },
        label: {
          overflow: 'hidden',
          textAlign: 'center',
        },
      }}
    >
      {label}
    </Button>
  );
}

export function DailyWorkspace({
  jsonFileName,
  projectsCount,
  selectedSizes,
  horizontalSizes,
  verticalSizes,
  folderPaths,
  validationResults,
  isChangingJson,
  isValidating,
  isRenaming,
  hasValidated,
  hasIssues,
  canRename,
  isTableExpanded,
  isSpecialEnabled,
  isManualEnabled,
  lastRenamedPaths,
  onToggleTable,
  onToggleSpecialEnabled,
  onToggleManualEnabled,
  onToggleSize,
  onChangeJson,
  onInitFolders,
  onAddFolder,
  onClearFolders,
  onRemoveFolder,
  onValidate,
  onRename,
  onOpenSettings,
  onOpenHistory,
  onDropPaths,
  onOpenFolder,
  layoutLeft,
  layoutRight,
  onLayoutChange,
}: DailyWorkspaceProps) {
  const previewRows = validationResults;

  const groupedPreviewRows = useMemo(() => {
    const groups: Record<string, { folderName: string; rows: typeof previewRows; hasError: boolean }> = {};
    for (const row of previewRows) {
      if (!groups[row.folderName]) {
        groups[row.folderName] = { folderName: row.folderName, rows: [], hasError: false };
      }
      groups[row.folderName].rows.push(row);
      if (row.status !== 'valid') {
        groups[row.folderName].hasError = true;
      }
    }
    return Object.values(groups).sort((a, b) => {
      if (a.hasError === b.hasError) return 0;
      return a.hasError ? -1 : 1;
    });
  }, [previewRows]);

  const [accordionValue, setAccordionValue] = useState<string[]>([]);

  useEffect(() => {
    const errorFolders = groupedPreviewRows.filter(g => g.hasError).map(g => g.folderName);
    if (errorFolders.length > 0) {
      setAccordionValue(errorFolders);
    } else {
      setAccordionValue([]);
    }
  }, [groupedPreviewRows]);

  const hasFinishedRenaming = lastRenamedPaths.length > 0 && folderPaths.length === 0 && !isValidating && !hasValidated;

  const statusLabel = isValidating
    ? '校验进行中'
    : hasIssues
      ? '校验异常'
      : hasValidated
        ? '校验通过'
        : hasFinishedRenaming
          ? '处理完成'
          : '系统就绪';

  const statusTitle = isValidating
    ? '正在校验。'
    : hasIssues
      ? '存在异常。'
      : hasValidated
        ? '校验完成。'
        : hasFinishedRenaming
          ? '重命名完成。'
          : '准备就绪。';

  const statusDescription = isValidating
    ? '系统正在分析素材尺寸和文件状态，请稍候。'
    : hasIssues
      ? '请先处理异常素材，再执行重命名流程。'
      : hasFinishedRenaming
        ? '所有的素材已成功重命名。'
        : '工作区已初始化。将素材拖入上方区域以开始自动化流程。';

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceId = result.source.droppableId;
    const destId = result.destination.droppableId;
    if (sourceId === destId) {
      if (sourceId === 'leftCol') {
        const newLeft = Array.from(layoutLeft);
        const [reorderedItem] = newLeft.splice(result.source.index, 1);
        newLeft.splice(result.destination.index, 0, reorderedItem);
        onLayoutChange(newLeft, layoutRight);
      } else if (sourceId === 'rightCol') {
        const newRight = Array.from(layoutRight);
        const [reorderedItem] = newRight.splice(result.source.index, 1);
        newRight.splice(result.destination.index, 0, reorderedItem);
        onLayoutChange(layoutLeft, newRight);
      }
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
    <Flex h="100%" style={{ background: 'var(--mantine-color-body)' }}>
      <Box
        w={362}
        style={{
          borderRight: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-default)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Flex direction="column" h="100%">
          <Group
            px={28}
            h={102}
            style={{
              borderBottom: '1px solid var(--mantine-color-default-border)',
            }}
          >
            <Group gap={12}>
              <LayoutGrid size={18} color="var(--mantine-color-dimmed)" />
              <Title order={2} size="h3" c="var(--mantine-color-text)">
                工作区面板库
              </Title>
            </Group>
          </Group>

          <ScrollArea className="app-scroll" style={{ flex: 1 }}>
            <Stack gap={22} p={22} pr={18}>
              <Droppable droppableId="leftCol">{(provided) => (<div ref={provided.innerRef} {...provided.droppableProps} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 22 }}>
{layoutLeft.map((id, index) => {
  if (id === 'todayData') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Card radius={28} p={22} shadow="sm" withBorder style={cardStyle}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>今日数据</SectionTitle>
                <Stack gap="md">
                  <TextInput
                    value={projectsCount > 0 ? jsonFileName : '暂未导入数据表'}
                    readOnly
                    radius={15}
                    size="md"
                    styles={{
                      input: {
                        height: 50,
                        background: 'var(--mantine-color-default)',
                        border: '1px solid var(--mantine-color-default-border)',
                        color: 'var(--mantine-color-dimmed)',
                        fontSize: 15,
                      },
                    }}
                  />
                  <Button
                    radius={15}
                    size="md"
                    variant="default"
                    leftSection={<FileJson size={16} />}
                    onClick={onChangeJson}
                    loading={isChangingJson}
                    styles={{
                      root: {
                        height: 50,
                        background: 'var(--mantine-color-default)',
                        border: '1px solid var(--mantine-color-default-border)',
                        color: 'var(--mantine-color-text)',
                        fontWeight: 900,
                        boxShadow: '0 10px 26px rgba(15, 23, 42, 0.05)',
                      },
                    }}
                  >
                    导入需求表
                  </Button>
                </Stack>
              </Card>

              </div>)}</Draggable>
  );
  if (id === 'createDir') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Card radius={28} p={22} shadow="sm" withBorder style={cardStyle}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>创建目录</SectionTitle>
                <Button
                  radius={16}
                  size="lg"
                  leftSection={<FolderPlus size={18} />}
                  onClick={onInitFolders}
                  styles={{
                    root: {
                      height: 62,
                      background: 'var(--mantine-primary-color-filled)',
                      color: 'var(--mantine-color-white)',
                      fontSize: 18,
                      fontWeight: 900,
                      boxShadow: '0 18px 32px rgba(17, 26, 52, 0.24)',
                    },
                  }}
                >
                  创建今日目录
                </Button>
              </Card>

              </div>)}</Draggable>
  );
  if (id === 'sizePreview') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Card radius={28} p={22} shadow="sm" withBorder style={cardStyle}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>尺寸预览</SectionTitle>
                <Stack gap="lg">
                  <Box>
                    <Text size="sm" fw={800} c="var(--mantine-color-dimmed)" mb={12}>
                      横版 & 方形
                    </Text>
                    <SimpleGrid cols={2} spacing="sm">
                      {horizontalSizes.map((size) => (
                        <SizeButton
                          key={size}
                          active={selectedSizes.includes(size)}
                          label={size}
                          onClick={() => onToggleSize(size)}
                        />
                      ))}
                    </SimpleGrid>
                  </Box>

                  <Box>
                    <Text size="sm" fw={800} c="var(--mantine-color-dimmed)" mb={12}>
                      竖版
                    </Text>
                    <SimpleGrid cols={2} spacing="sm">
                      {verticalSizes.map((size) => (
                        <SizeButton
                          key={size}
                          active={selectedSizes.includes(size)}
                          label={size}
                          onClick={() => onToggleSize(size)}
                        />
                      ))}
                    </SimpleGrid>
                  </Box>
                </Stack>
              </Card>
</div>)}</Draggable>
  );
  return null;
})}
{provided.placeholder}
</div>)}</Droppable>
            </Stack>
          </ScrollArea>
        </Flex>
      </Box>

      <Box style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <Flex direction="column" h="100%">
          <Group
            justify="space-between"
            px={30}
            h={102}
            style={{
              borderBottom: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-default)',
            }}
          >
            <Title order={2} size="h3" c="var(--mantine-color-text)">
              主视图
            </Title>
            <Group gap={10}>
              <ActionIcon variant="subtle" styles={iconButtonStyle} onClick={onOpenSettings}>
                <Settings size={18} />
              </ActionIcon>
              <ActionIcon variant="subtle" styles={iconButtonStyle} onClick={onOpenHistory}>
                <History size={18} />
              </ActionIcon>
              <Group gap={6}>
                <Globe size={18} color="var(--mantine-color-dimmed)" />
                <Text c="var(--mantine-color-dimmed)" fw={800}>
                  中文
                </Text>
              </Group>
            </Group>
          </Group>

          <ScrollArea className="app-scroll" style={{ flex: 1 }}>
            <Stack gap={22} px={30} py={18} pb={132}>
              <Droppable droppableId="rightCol">{(provided) => (<div ref={provided.innerRef} {...provided.droppableProps} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 22 }}>
{layoutRight.map((id, index) => {
  if (id === 'quickActions') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Group grow align="flex-start" gap="md">
              <Card radius={30} p={22} withBorder shadow="sm" style={{ ...cardStyle, flex: 6 }}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>特殊命名</SectionTitle>
                <SimpleGrid cols={2} spacing="md">
                  <Button
                    variant={isSpecialEnabled ? "filled" : "light"}
                    color={isSpecialEnabled ? "orange" : "gray"}
                    leftSection={<Sparkles size={16} />}
                    onClick={() => onToggleSpecialEnabled(!isSpecialEnabled)}
                    radius="xl"
                    size="md"
                    styles={{
                      root: {
                        fontWeight: 800,
                        transition: 'all 0.2s ease',
                      },
                    }}
                  >
                    创意比特
                  </Button>
                  <Button
                    variant={isManualEnabled ? "filled" : "light"}
                    color={isManualEnabled ? "violet" : "gray"}
                    leftSection={<Sparkles size={16} />}
                    onClick={() => onToggleManualEnabled(!isManualEnabled)}
                    radius="xl"
                    size="md"
                    styles={{
                      root: {
                        fontWeight: 800,
                        transition: 'all 0.2s ease',
                      },
                    }}
                  >
                    手搓命名
                  </Button>
                </SimpleGrid>
              </Card>

              <Card radius={30} p={22} withBorder shadow="sm" style={{ ...cardStyle, flex: 4 }}>
                <SectionTitle>快捷操作</SectionTitle>
                <SimpleGrid cols={2} spacing="md">
                  <Button
                    variant="light"
                    color="blue"
                    leftSection={<FolderPlus size={16} />}
                    onClick={onAddFolder}
                    radius="xl"
                    size="md"
                    styles={{
                      root: {
                        fontWeight: 800,
                      },
                    }}
                  >
                    添加文件夹
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<Trash2 size={16} />}
                    onClick={onClearFolders}
                    radius="xl"
                    size="md"
                    styles={{
                      root: {
                        fontWeight: 800,
                      },
                    }}
                  >
                    清空列表
                  </Button>
                  {hasFinishedRenaming && (
                    <Button
                      variant="light"
                      color="teal"
                      leftSection={<FolderOpen size={16} />}
                      onClick={() => {
                        if (lastRenamedPaths.length > 0) {
                          onOpenFolder(lastRenamedPaths[0]);
                        }
                      }}
                      radius="xl"
                      size="md"
                      style={{ gridColumn: 'span 2' }}
                      styles={{
                        root: {
                          fontWeight: 800,
                        },
                      }}
                    >
                      打开对应文件夹
                    </Button>
                  )}
                </SimpleGrid>

              </Card>
            </Group>
              </div>)}</Draggable>
  );
  if (id === 'systemStatus') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Group grow align="stretch" gap="md">
              <Card radius={30} p={22} withBorder shadow="sm" style={{ ...cardStyle, flex: 6 }}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>系统状态</SectionTitle>
                <Paper
                  radius={26}
                  p={30}
                  style={{
                    height: '100%',
                    background:
                      'var(--mantine-color-default)',
                    border: '1px solid var(--mantine-color-default-border)',
                    boxShadow: 'none',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="center" h="100%">
                    <Box style={{ flex: 1 }}>
                      <Group gap={10} mb="sm">
                        <Box
                          w={8}
                          h={8}
                          style={{
                            borderRadius: 999,
                            background: hasIssues ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-green-filled)',
                          }}
                        />
                        <Badge
                          variant="light"
                          radius="sm"
                          color={hasIssues ? 'yellow' : 'teal'}
                          styles={{ root: { fontWeight: 800 } }}
                        >
                          {statusLabel}
                        </Badge>
                      </Group>

                      <Title order={2} c="var(--mantine-color-text)" mb={8} style={{ fontSize: 32, lineHeight: 1.1 }}>
                        {statusTitle}
                      </Title>

                      <Text c="var(--mantine-color-dimmed)" size="md" fw={500}>
                        {statusDescription}
                      </Text>
                    </Box>

                    <Paper
                      radius={22}
                      p="lg"
                      shadow="sm"
                      style={{
                        width: 72,
                        height: 90,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--mantine-color-default)',
                      }}
                    >
                      <FileText size={28} color="var(--mantine-color-dimmed)" />
                    </Paper>
                  </Group>
                </Paper>
              </Card>

              <Card radius={30} p={22} withBorder shadow="sm" style={{ ...cardStyle, flex: 4 }}>
                <SectionTitle>上传素材</SectionTitle>
                <Dropzone
                  onDrop={() => {}} // Handle in onDropCapture
                  onDropCapture={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const paths: string[] = [];
                    const items = e.dataTransfer.items;
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (item.kind === 'file') {
                          const entry = item.webkitGetAsEntry();
                          const file = item.getAsFile() as File & { path?: string };
                          if (entry?.isDirectory && file?.path) {
                            paths.push(file.path);
                          } else if (file?.path) {
                            // If it's a file, we want its parent directory
                            const sep = file.path.includes('\\') ? '\\' : '/';
                            const lastIdx = file.path.lastIndexOf(sep);
                            if (lastIdx > 0) {
                              paths.push(file.path.slice(0, lastIdx));
                            } else {
                              paths.push(file.path);
                            }
                          }
                        }
                      }
                    }
                    if (paths.length > 0) {
                      onDropPaths(paths);
                    }
                  }}
                  activateOnClick={false}
                  onClick={folderPaths.length === 0 ? onAddFolder : undefined}
                  radius={24}
                  styles={{
                    root: {
                      border: folderPaths.length > 0 ? 'none' : '2px dashed var(--mantine-color-default-border)',
                      background: folderPaths.length > 0 ? 'transparent' : 'var(--mantine-color-default)',
                      height: 'calc(100% - 38px)',
                      display: 'flex',
                      alignItems: folderPaths.length > 0 ? 'flex-start' : 'center',
                      justifyContent: folderPaths.length > 0 ? 'flex-start' : 'center',
                      transition: 'all 0.2s ease',
                      cursor: folderPaths.length > 0 ? 'default' : 'pointer',
                      padding: folderPaths.length > 0 ? 0 : '16px',
                    },
                    inner: {
                      pointerEvents: folderPaths.length > 0 ? 'auto' : 'none',
                      width: '100%',
                    },
                  }}
                >
                  {folderPaths.length > 0 ? (
                    <ScrollArea style={{ height: '100%', width: '100%' }} offsetScrollbars>
                      <Stack gap="sm">
                        {folderPaths.map((path) => (
                          <Paper
                            key={path}
                            withBorder
                            radius={18}
                            p="sm"
                            style={{
                              borderColor: 'var(--mantine-color-default-border)',
                              background: 'var(--mantine-color-default)',
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap">
                              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                                <ThemeIcon size={34} radius="xl" variant="light" color="blue">
                                  <FolderOpen size={16} />
                                </ThemeIcon>
                                <Stack gap={2} style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <Text truncate c="var(--mantine-color-text)" fw={800} size="sm">
                                    {path.includes('\\') ? path.split('\\').pop() : path.split('/').pop()}
                                  </Text>
                                  <Text truncate c="dimmed" size="xs">
                                    {path}
                                  </Text>
                                </Stack>
                              </Group>
                              <Button
                                variant="subtle"
                                color="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveFolder(path);
                                }}
                              >
                                删除
                              </Button>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    </ScrollArea>
                  ) : (
                    <Flex direction="column" align="center" justify="center" gap="sm">
                      <ThemeIcon variant="transparent" color="gray" size={42}>
                        <UploadCloud size={28} color="var(--mantine-color-dimmed)" />
                      </ThemeIcon>
                      <Text size="sm" c="var(--mantine-color-dimmed)" ta="center">
                        拖拽或 <Text span c="var(--mantine-color-blue-filled)" fw={800}>点击</Text>
                      </Text>
                    </Flex>
                  )}
                </Dropzone>
              </Card>
            </Group>
              </div>)}</Draggable>
  );
  if (id === 'mediaDetails') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Card
                radius={30}
                p={0}
                withBorder
                shadow="sm"
                style={{
                  ...cardStyle,
                  overflow: 'hidden',
                }}
              >
                <Box p={22} pb={10}>
                  <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>素材详情</SectionTitle>
                </Box>

                <Box
                  px={22}
                  py={10}
                  style={{
                    borderTop: '1px solid var(--mantine-color-default-border)',
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    background: 'var(--mantine-color-default)',
                  }}
                >
                  <Button
                    variant="subtle"
                    color="gray"
                    leftSection={isTableExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    onClick={onToggleTable}
                    styles={{
                      root: {
                        paddingInline: 0,
                        color: 'var(--mantine-color-text)',
                        fontWeight: 800,
                      },
                    }}
                  >
                    隐藏详情
                  </Button>
                </Box>

                <Collapse in={isTableExpanded}>
                  {groupedPreviewRows.length > 0 && (
                    <Accordion
                      multiple
                      value={accordionValue}
                      onChange={setAccordionValue}
                      variant="separated"
                      styles={{
                        item: {
                          backgroundColor: 'var(--mantine-color-default)',
                          border: '1px solid var(--mantine-color-default-border)',
                          borderRadius: 8,
                          marginBottom: 8,
                          '&[data-active]': {
                            borderColor: 'var(--mantine-primary-color-filled)',
                          }
                        },
                        control: {
                          padding: '12px 22px',
                          '&:hover': {
                            backgroundColor: 'var(--mantine-color-default-hover)',
                          }
                        },
                        panel: {
                          padding: '0 22px 12px 22px',
                        },
                        content: {
                          padding: 0,
                        }
                      }}
                    >
                      {groupedPreviewRows.map((group) => (
                        <Accordion.Item key={group.folderName} value={group.folderName}>
                          <Accordion.Control>
                            <Group justify="space-between">
                              <Group gap="sm">
                                <FolderOpen size={18} color={group.hasError ? 'var(--mantine-color-red-filled)' : 'var(--mantine-color-dimmed)'} />
                                <Text fw={800} c={group.hasError ? 'var(--mantine-color-red-filled)' : 'var(--mantine-color-text)'}>
                                  {group.folderName}
                                </Text>
                                <Badge color={group.hasError ? 'red' : 'teal'} variant="light" size="sm">
                                  {group.rows.length} 项
                                </Badge>
                              </Group>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Table
                              highlightOnHover
                              horizontalSpacing="xl"
                              verticalSpacing="sm"
                              styles={{
                                thead: {
                                  background: 'var(--mantine-color-default)',
                                },
                                th: {
                                  color: 'var(--mantine-color-dimmed)',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  borderBottom: '1px solid var(--mantine-color-default-border)',
                                },
                                td: {
                                  borderTop: '1px solid #f1f5f9',
                                  color: 'var(--mantine-color-text)',
                                  fontSize: 14,
                                },
                                tr: {
                                  transition: 'background-color 120ms ease',
                                },
                              }}
                            >
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>文件名</Table.Th>
                                  <Table.Th>扩展名</Table.Th>
                                  <Table.Th>大小</Table.Th>
                                  <Table.Th style={{ textAlign: 'right' }}>状态</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {group.rows.map((row, index) => (
                                  <Table.Tr key={`${row.fileName}-${index}`}>
                                    <Table.Td>
                                      <Text fw={800} c="var(--mantine-color-text)">
                                        {row.fileName}
                                        {row.ext}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text c="var(--mantine-color-dimmed)">{row.ext}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text c="var(--mantine-color-dimmed)">
                                        {row.actualWidth && row.actualHeight
                                          ? `${row.actualWidth}×${row.actualHeight}`
                                          : formatBytes(row.fileSize)}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: 'right' }}>
                                      <StatusBadge result={row} />
                                    </Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  )}
                </Collapse>
              </Card>
</div>)}</Draggable>
  );
  return null;
})}
{provided.placeholder}
</div>)}</Droppable>
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
            background: 'var(--mantine-color-default)',
            border: '1px solid var(--mantine-color-default-border)',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
          }}
        >
          <Group gap={14}>
            <Button
              radius={18}
              color="dark"
              size="lg"
              leftSection={<Play size={18} fill="currentColor" />}
              onClick={onValidate}
              loading={isValidating}
              styles={{
                root: {
                  height: 58,
                  paddingInline: 32,
                  background: 'var(--mantine-primary-color-filled)',
                  fontSize: 18,
                  fontWeight: 900,
                  boxShadow: '0 12px 28px rgba(17, 26, 52, 0.2)',
                },
              }}
            >
              开始校验
            </Button>
            <Button
              radius={18}
              color="teal"
              size="lg"
              leftSection={<CheckCircle2 size={20} />}
              onClick={onRename}
              loading={isRenaming}
              disabled={!canRename}
              styles={{
                root: {
                  height: 58,
                  paddingInline: 32,
                  background: 'var(--mantine-color-green-filled)',
                  fontSize: 18,
                  fontWeight: 900,
                  boxShadow: '0 12px 28px rgba(25, 195, 125, 0.22)',
                },
              }}
            >
              执行重命名
            </Button>
          </Group>
        </Paper>
      </Box>
    </Flex>
    </DragDropContext>
  );
}
