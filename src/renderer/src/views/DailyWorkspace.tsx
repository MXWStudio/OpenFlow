import React, { useMemo } from 'react';
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
  borderColor: '#e9eef6',
  background: '#ffffff',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.04)',
} as const;

const iconButtonStyle = {
  root: {
    width: 34,
    height: 34,
    color: '#94a3b8',
  },
} as const;

function SectionTitle({ children, dragHandleProps }: { children: React.ReactNode, dragHandleProps?: any }) {
  return (
    <Group gap={8} mb="md" {...dragHandleProps} style={{ cursor: dragHandleProps ? 'grab' : 'default' }}>
      <GripVertical size={14} color="#d7e0eb" />
      <Text fw={800} size="lg" c="#8ea2c1">
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
          background: active ? '#111c37' : '#ffffff',
          color: active ? '#ffffff' : '#31425f',
          border: active ? '1px solid #111c37' : '1px solid #d9e3ee',
          boxShadow: active ? '0 10px 22px rgba(17, 28, 55, 0.14)' : '0 6px 18px rgba(148, 163, 184, 0.08)',
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
  const previewRows =
    validationResults.length > 0
      ? validationResults
      : [
          {
            fileName: '暂无提示词内容，请添加',
            filePath: '',
            folderName: 'Prompt',
            ext: '.txt',
            fileSize: 0,
            actualWidth: 0,
            actualHeight: 0,
            status: 'missing' as const,
          },
          {
            fileName: '提示说明配置',
            filePath: '',
            folderName: 'Config',
            ext: '.json',
            fileSize: 0,
            actualWidth: 0,
            actualHeight: 0,
            status: 'missing' as const,
          },
        ];

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

  const defaultAccordionValues = useMemo(() => {
    return groupedPreviewRows.filter(g => g.hasError).map(g => g.folderName);
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
    <Flex h="100%" style={{ background: 'linear-gradient(180deg, #f6f8fc 0%, #f8fbff 100%)' }}>
      <Box
        w={362}
        style={{
          borderRight: '1px solid #e7edf5',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(250,252,255,0.96) 100%)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Flex direction="column" h="100%">
          <Group
            px={28}
            h={102}
            style={{
              borderBottom: '1px solid #eef3f8',
            }}
          >
            <Group gap={12}>
              <LayoutGrid size={18} color="#475569" />
              <Title order={2} size="h3" c="#22324c">
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
                        background: '#f6f8fc',
                        border: '1px solid #dbe4ef',
                        color: '#94a3b8',
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
                        background: '#ffffff',
                        border: '1px solid #dbe4ef',
                        color: '#22324c',
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
                      background: '#111a34',
                      color: '#ffffff',
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
                    <Text size="sm" fw={800} c="#8ea2c1" mb={12}>
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
                    <Text size="sm" fw={800} c="#8ea2c1" mb={12}>
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
              borderBottom: '1px solid #eef3f8',
              background: 'rgba(255,255,255,0.28)',
            }}
          >
            <Title order={2} size="h3" c="#22324c">
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
                <Globe size={18} color="#94a3b8" />
                <Text c="#64748b" fw={800}>
                  中文
                </Text>
              </Group>
            </Group>
          </Group>

          <ScrollArea className="app-scroll" style={{ flex: 1 }}>
            <Stack gap={22} px={30} py={18} pb={132}>
              <Droppable droppableId="rightCol">{(provided) => (<div ref={provided.innerRef} {...provided.droppableProps} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 22 }}>
{layoutRight.map((id, index) => {
  if (id === 'uploadMedia') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Card radius={30} p={22} withBorder shadow="sm" style={cardStyle}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>上传素材</SectionTitle>
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
                  onClick={onAddFolder}
                  radius={24}
                  styles={{
                    root: {
                      border: '2px dashed #cad7e8',
                      background: '#f9fbff',
                      minHeight: folderPaths.length > 0 ? 80 : 154,
                      transition: 'min-height 0.2s ease',
                      cursor: 'pointer',
                    },
                    inner: {
                      pointerEvents: 'none',
                    },
                  }}
                >
                  <Flex direction={folderPaths.length > 0 ? "row" : "column"} align="center" justify="center" mih={folderPaths.length > 0 ? 80 : 154} gap="sm" style={{ transition: 'min-height 0.2s ease' }}>
                    <ThemeIcon variant="transparent" color="gray" size={folderPaths.length > 0 ? 32 : 48}>
                      <UploadCloud size={folderPaths.length > 0 ? 24 : 28} color="#98a8bf" />
                    </ThemeIcon>
                    <Text size={folderPaths.length > 0 ? "md" : "lg"} c="#7185a3">
                      拖拽文件夹到这里，或{' '}
                      <Text span c="#2563eb" fw={800}>
                        点击选择文件夹
                      </Text>
                    </Text>
                  </Flex>
                </Dropzone>
              </Card>

              </div>)}</Draggable>
  );
  if (id === 'quickActions') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Card radius={30} p={22} withBorder shadow="sm" style={cardStyle}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>快捷操作</SectionTitle>
                <SimpleGrid cols={2} spacing="md" mb="md">
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
                </SimpleGrid>

                {folderPaths.length > 0 && (
                  <Stack gap="sm" mt="md">
                    {folderPaths.map((path) => (
                      <Paper
                        key={path}
                        withBorder
                        radius={18}
                        p="sm"
                        style={{
                          borderColor: '#e2e8f0',
                          background: '#fbfdff',
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                            <ThemeIcon size={34} radius="xl" variant="light" color="blue">
                              <FolderOpen size={16} />
                            </ThemeIcon>
                            <Text truncate c="#334155">
                              {path}
                            </Text>
                          </Group>
                          <Button variant="subtle" color="red" onClick={() => onRemoveFolder(path)}>
                            删除
                          </Button>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Card>

              </div>)}</Draggable>
  );
  if (id === 'systemStatus') return (
    <Draggable key={id} draggableId={id} index={index}>{(dragProvided) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
<Card radius={30} p={22} withBorder shadow="sm" style={cardStyle}>
                <SectionTitle dragHandleProps={dragProvided.dragHandleProps}>系统状态</SectionTitle>
                <Paper
                  radius={26}
                  p={30}
                  style={{
                    background:
                      'radial-gradient(circle at 50% 50%, rgba(239, 246, 255, 0.98) 0%, rgba(255,255,255,1) 56%, rgba(241,245,249,0.96) 100%)',
                    border: '1px solid #edf2f7',
                    boxShadow: 'inset 0 0 48px rgba(191, 219, 254, 0.18)',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="center">
                    <Box maw={560}>
                      <Group gap={10} mb="md">
                        <Box
                          w={8}
                          h={8}
                          style={{
                            borderRadius: 999,
                            background: hasIssues ? '#f59e0b' : '#34d399',
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

                      <Title order={1} c="#0f284d" mb={12} style={{ fontSize: 56, lineHeight: 1.02 }}>
                        {statusTitle}
                      </Title>

                      <Text c="#64748b" size="lg" fw={500}>
                        {statusDescription}
                      </Text>

                      {hasFinishedRenaming && (
                        <Button
                          mt="xl"
                          size="md"
                          radius="xl"
                          variant="light"
                          color="blue"
                          leftSection={<FolderOpen size={18} />}
                          onClick={() => {
                            if (lastRenamedPaths.length > 0) {
                              onOpenFolder(lastRenamedPaths[0]);
                            }
                          }}
                          styles={{
                            root: {
                              fontWeight: 800,
                            }
                          }}
                        >
                          打开对应文件夹
                        </Button>
                      )}
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
                      }}
                    >
                      <FileText size={36} color="#d6dee9" />
                    </Paper>
                  </Group>
                </Paper>
              </Card>

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
                    borderTop: '1px solid #eef3f8',
                    borderBottom: '1px solid #eef3f8',
                    background: '#fbfdff',
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
                        color: '#51637d',
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
                      defaultValue={defaultAccordionValues}
                      variant="separated"
                      styles={{
                        item: {
                          backgroundColor: '#ffffff',
                          border: '1px solid #eef3f8',
                          borderRadius: 8,
                          marginBottom: 8,
                          '&[data-active]': {
                            borderColor: '#dbe4ef',
                          }
                        },
                        control: {
                          padding: '12px 22px',
                          '&:hover': {
                            backgroundColor: '#f8fbff',
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
                                <FolderOpen size={18} color={group.hasError ? '#ef4444' : '#8ea2c1'} />
                                <Text fw={800} c={group.hasError ? '#ef4444' : '#334155'}>
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
                                  background: '#ffffff',
                                },
                                th: {
                                  color: '#8ea2c1',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  borderBottom: '1px solid #eef3f8',
                                },
                                td: {
                                  borderTop: '1px solid #f1f5f9',
                                  color: '#334155',
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
                                      <Text fw={800} c="#22324c">
                                        {row.fileName}
                                        {row.ext}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text c="#8ea2c1">{row.ext}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text c="#8ea2c1">
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
            background: 'rgba(255,255,255,0.96)',
            border: '1px solid #e8eef5',
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
                  background: '#111a34',
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
                  background: '#19c37d',
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
