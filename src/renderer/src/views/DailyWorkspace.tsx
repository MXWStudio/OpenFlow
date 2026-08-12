import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Flex,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
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
  History,
  Play,
  Settings,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { formatBytes, type ValidationResult } from '../appState';
import { StatusBadge } from '../StatusBadge';
import {
  buildValidationPresentation,
  canTrashValidationRow,
  getValidationRowKind,
  getValidationRowReason,
  type ValidationPresentationGroup,
} from '../validationPresentation';
import type {
  RenameBatchResult,
  RenameMode,
  RenamePreset,
  RenamePreview,
  RenameSelection,
} from '../../../shared/renameTemplates.ts';

export interface DailyRenameExample {
  presetName: string;
  items: Array<{
    label: string;
    value: string;
    valid: boolean;
  }>;
}

interface DailyWorkspaceProps {
  jsonFileName: string;
  projectsCount: number;
  requirementSizes: string[];
  detectedFolderSizes: string[];
  manualTargetSizes: string[];
  horizontalManualSizes: string[];
  verticalManualSizes: string[];
  folderPaths: string[];
  validationResults: ValidationResult[];
  isChangingJson: boolean;
  isValidating: boolean;
  isRenaming: boolean;
  hasValidated: boolean;
  hasIssues: boolean;
  canRename: boolean;
  isTableExpanded: boolean;
  renameSelection: RenameSelection;
  customRenamePresets: RenamePreset[];
  renameExample: DailyRenameExample | null;
  renamePreview: RenamePreview | null;
  renameBatchResult: RenameBatchResult | null;
  workflowSaveState: 'idle' | 'saving' | 'saved' | 'error';
  canFallbackToRegular: boolean;
  lastRenamedPaths: string[];
  onToggleTable: () => void;
  onChangeRenameMode: (mode: RenameMode) => void;
  onChangeCustomPreset: (presetId: string) => void;
  onFallbackToRegular: () => void;
  onRetryFailed: () => void;
  onToggleManualSize: (size: string) => void;
  onChangeJson: () => void;
  onInitFolders: () => void;
  onAddFolder: () => void;
  onClearFolders: () => void;
  onRemoveFolder: (path: string) => void;
  onValidate: () => void;
  onRename: () => void;
  onTrashValidationFile: (row: ValidationResult) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onDropPaths: (paths: string[]) => void;
  onOpenFolder: (path: string) => void;
}

const cardStyle = {
  borderColor: 'var(--mantine-color-default-border)',
  background: 'var(--mantine-color-default)',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
} as const;

const compactCardStyle = {
  ...cardStyle,
  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)',
} as const;

function SectionTitle({
  icon,
  title,
  aside,
}: {
  icon: React.ReactNode;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="center" mb="md" wrap="nowrap">
      <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
        <ThemeIcon size={30} radius={8} variant="light" color="blue">
          {icon}
        </ThemeIcon>
        <Text fw={900} size="lg" c="var(--mantine-color-text)" truncate>
          {title}
        </Text>
      </Group>
      {aside}
    </Group>
  );
}

function StepMarker({ value, active }: { value: number; active: boolean }) {
  return (
    <Box
      w={26}
      h={26}
      style={{
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        fontSize: 13,
        fontWeight: 900,
        color: active ? 'var(--mantine-color-white)' : 'var(--mantine-color-dimmed)',
        background: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-default)',
        border: active ? '1px solid var(--mantine-primary-color-filled)' : '1px solid var(--mantine-color-default-border)',
      }}
    >
      {value}
    </Box>
  );
}

function SizePill({
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
      radius={8}
      variant={active ? 'filled' : 'default'}
      onClick={onClick}
      styles={{
        root: {
          height: 38,
          paddingInline: 10,
          background: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-default)',
          color: active ? 'var(--mantine-color-white)' : 'var(--mantine-color-text)',
          border: active ? '1px solid var(--mantine-primary-color-filled)' : '1px solid var(--mantine-color-default-border)',
          fontSize: 13,
          fontWeight: 850,
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

function getFolderName(path: string) {
  const sep = path.includes('\\') ? '\\' : '/';
  return path.substring(path.lastIndexOf(sep) + 1);
}

function extractDroppedPaths(event: React.DragEvent) {
  const paths: string[] = [];
  const items = event.dataTransfer.items;
  if (!items) return paths;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.kind !== 'file') continue;

    const entry = item.webkitGetAsEntry();
    const file = item.getAsFile() as File & { path?: string };
    if (entry?.isDirectory && file?.path) {
      paths.push(file.path);
    } else if (file?.path) {
      const sep = file.path.includes('\\') ? '\\' : '/';
      const lastIndex = file.path.lastIndexOf(sep);
      paths.push(lastIndex > 0 ? file.path.slice(0, lastIndex) : file.path);
    }
  }

  return paths;
}

export function DailyWorkspace({
  jsonFileName,
  projectsCount,
  requirementSizes,
  detectedFolderSizes,
  manualTargetSizes,
  horizontalManualSizes,
  verticalManualSizes,
  folderPaths,
  validationResults,
  isChangingJson,
  isValidating,
  isRenaming,
  hasValidated,
  hasIssues,
  canRename,
  isTableExpanded,
  renameSelection,
  customRenamePresets,
  renameExample,
  renamePreview,
  renameBatchResult,
  workflowSaveState,
  canFallbackToRegular,
  lastRenamedPaths,
  onToggleTable,
  onChangeRenameMode,
  onChangeCustomPreset,
  onFallbackToRegular,
  onRetryFailed,
  onToggleManualSize,
  onChangeJson,
  onInitFolders,
  onAddFolder,
  onClearFolders,
  onRemoveFolder,
  onValidate,
  onRename,
  onTrashValidationFile,
  onOpenSettings,
  onOpenHistory,
  onDropPaths,
  onOpenFolder,
}: DailyWorkspaceProps) {
  const validationPresentation = useMemo(
    () => buildValidationPresentation(validationResults),
    [validationResults],
  );
  const groupedPreviewRows = validationPresentation.groups;
  const validationSummary = validationPresentation.summary;
  const missingTotal = validationSummary.missingTotal;
  const emptyFolderCount = validationSummary.emptyFolderCount;
  const blockingIssueCount = validationSummary.blockingCount;
  const previewPresetName = renamePreview?.items.find((item) => item.presetName)?.presetName;
  const previewErrors = renamePreview?.items.filter((item) => item.status === 'blocked') || [];
  const previewRows = renamePreview?.items.filter((item) => item.status !== 'blocked').slice(0, 3) || [];
  const hasFailedRenameItems = Boolean(renameBatchResult?.results.some((item) => !item.success));

  const [accordionValue, setAccordionValue] = useState<string[]>([]);
  const [expandedPassedGroups, setExpandedPassedGroups] = useState<string[]>([]);

  useEffect(() => {
    const actionFolders = groupedPreviewRows
      .filter((group) => group.actionRows.length > 0)
      .map((group) => group.folderName);
    setAccordionValue(actionFolders);
  }, [groupedPreviewRows]);

  const hasFinishedRenaming = lastRenamedPaths.length > 0 && folderPaths.length === 0 && !isValidating && !hasValidated;

  const statusState = (() => {
    if (isValidating) {
      return {
        label: '校验进行中',
        title: '正在校验。',
        description: '正在读取素材尺寸和文件状态。',
        color: 'blue',
        icon: <FileText size={26} />,
      };
    }
    if (hasIssues && blockingIssueCount > 0) {
      return {
        label: '校验异常',
        title: '存在异常。',
        description: '请先处理尺寸错误或读取失败的素材。',
        color: 'red',
        icon: <FileText size={26} />,
      };
    }
    if (hasIssues && emptyFolderCount > 0) {
      return {
        label: '缺失文件',
        title: '素材目录为空。',
        description: `${emptyFolderCount} 个目录内没有可校验文件，请添加素材后重验。`,
        color: 'orange',
        icon: <FolderOpen size={26} />,
      };
    }
    if (hasIssues && missingTotal > 0) {
      return {
        label: '数量不足',
        title: '数量不足。',
        description: `共缺 ${missingTotal} 张。可补齐后重验，也可先重命名已有素材。`,
        color: 'orange',
        icon: <FileText size={26} />,
      };
    }
    if (hasIssues && validationSummary.extraCount > 0) {
      return {
        label: '有额外素材',
        title: '发现额外素材。',
        description: `${validationSummary.extraCount} 项素材不在需求表中，不会参与重命名。`,
        color: 'blue',
        icon: <FileText size={26} />,
      };
    }
    if (hasValidated) {
      return {
        label: '校验通过',
        title: '校验完成。',
        description: '全部素材符合当前目标。',
        color: 'teal',
        icon: <CheckCircle2 size={26} />,
      };
    }
    if (hasFinishedRenaming) {
      return {
        label: '处理完成',
        title: '重命名完成。',
        description: '所有通过校验的素材已完成命名。',
        color: 'teal',
        icon: <CheckCircle2 size={26} />,
      };
    }
    return {
      label: '系统就绪',
      title: '准备就绪。',
      description: '按今日流程处理素材。',
      color: 'gray',
      icon: <FileText size={26} />,
    };
  })();

  const flowSteps = [
    { label: '今日需求', active: projectsCount > 0 },
    { label: '项目目录', active: projectsCount > 0 },
    { label: '上传素材', active: folderPaths.length > 0 },
    { label: '校验处理', active: hasValidated || canRename },
  ];

  function getRowTitle(row: ValidationResult) {
    if (row.status !== 'missing') return `${row.fileName}${row.ext}`;
    if (row.missingKind === 'empty_folder') return '缺失文件';
    const targetSize = row.targetSize || row.fileName.replace(/^\[缺失]\s*/, '');
    const missingCount = row.missingCount || 1;
    return `${targetSize} 缺 ${missingCount} 张`;
  }

  function getRowMeta(row: ValidationResult) {
    return getValidationRowReason(row);
  }

  function getGroupIconColor(group: ValidationPresentationGroup) {
    if (group.hasBlockingIssues) return 'var(--mantine-color-red-filled)';
    if (group.emptyFolderCount > 0) return 'var(--mantine-color-orange-filled)';
    if (group.hasMissingIssues) return 'var(--mantine-color-orange-filled)';
    if (group.hasExtraIssues) return 'var(--mantine-color-blue-filled)';
    return 'var(--mantine-color-teal-filled)';
  }

  function isPassedGroupExpanded(folderName: string) {
    return expandedPassedGroups.includes(folderName);
  }

  function togglePassedGroup(folderName: string) {
    setExpandedPassedGroups((current) =>
      current.includes(folderName)
        ? current.filter((name) => name !== folderName)
        : [...current, folderName],
    );
  }

  function renderValidationRows(rows: ValidationResult[], options: { mutedPassed?: boolean; showActions?: boolean } = {}) {
    return rows.map((row, index) => (
      <Table.Tr key={`${row.fileName}-${row.targetSize || ''}-${index}`}>
        <Table.Td style={{ minWidth: 180 }}>
          <Text fw={row.status === 'valid' && options.mutedPassed ? 650 : 850} c="var(--mantine-color-text)">
            {getRowTitle(row)}
          </Text>
        </Table.Td>
        <Table.Td style={{ minWidth: 220 }}>
          <Text c="var(--mantine-color-dimmed)">{getRowMeta(row)}</Text>
        </Table.Td>
        <Table.Td style={{ minWidth: 120 }}>
          <Text c="var(--mantine-color-dimmed)">
            {row.actualWidth && row.actualHeight
              ? `${row.actualWidth}×${row.actualHeight}`
              : formatBytes(row.fileSize)}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'right', minWidth: 112 }}>
          <StatusBadge
            result={row}
            kind={getValidationRowKind(row)}
            muted={options.mutedPassed && row.status === 'valid'}
          />
        </Table.Td>
        {options.showActions && (
          <Table.Td style={{ textAlign: 'right', minWidth: 126 }}>
            {canTrashValidationRow(row) && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<Trash2 size={14} />}
                onClick={() => onTrashValidationFile(row)}
                styles={{ root: { fontWeight: 850 } }}
              >
                移到废纸篓
              </Button>
            )}
          </Table.Td>
        )}
      </Table.Tr>
    ));
  }

  function renderSizeButtons(title: string, sizes: string[]) {
    if (!sizes.length) return null;
    return (
      <Box>
        <Text size="sm" fw={850} c="var(--mantine-color-dimmed)" mb={10}>
          {title}
        </Text>
        <SimpleGrid cols={2} spacing={8}>
          {sizes.map((size) => (
            <SizePill
              key={size}
              active={manualTargetSizes.includes(size)}
              label={size}
              onClick={() => onToggleManualSize(size)}
            />
          ))}
        </SimpleGrid>
      </Box>
    );
  }

  return (
    <Flex className="daily-workspace" h="100%" direction="column" style={{ background: 'var(--mantine-color-body)', position: 'relative', minHeight: 0 }}>
      <Group
        className="daily-header"
        h={86}
        px={30}
        gap="md"
        wrap="nowrap"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-default)',
        }}
      >
        <Title order={2} size="h3" c="var(--mantine-color-text)" style={{ whiteSpace: 'nowrap' }}>
          日常处理
        </Title>
        <Badge color={statusState.color} variant="light" radius="sm" styles={{ root: { fontWeight: 850 } }}>
          {statusState.label}
        </Badge>
        <Tooltip label="历史记录">
          <ActionIcon variant="subtle" color="gray" radius={8} aria-label="历史记录" onClick={onOpenHistory}>
            <History size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="设置">
          <ActionIcon variant="subtle" color="gray" radius={8} aria-label="设置" onClick={onOpenSettings}>
            <Settings size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea className="app-scroll" style={{ flex: 1 }}>
        <Box className="daily-content" px={30} py={22} pb={118}>
          <Flex className="daily-layout" gap={22} align="flex-start">
            <Stack className="daily-sidebar" gap={18} w={342} style={{ flexShrink: 0 }}>
              <Card className="daily-flow-card" withBorder radius={8} p={20} style={cardStyle}>
                <Stack gap={14}>
                  {flowSteps.map((step, index) => (
                    <Group key={step.label} gap={12} wrap="nowrap">
                      <StepMarker value={index + 1} active={step.active} />
                      <Text fw={850} c={step.active ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)'}>
                        {step.label}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>

              <Card className="daily-requirement-card" withBorder radius={8} p={20} style={cardStyle}>
                <SectionTitle icon={<FileJson size={16} />} title="今日需求" />
                <Stack className="daily-requirement-actions" gap="md">
                  <TextInput
                    value={projectsCount > 0 ? jsonFileName : '暂未导入需求表'}
                    readOnly
                    radius={8}
                    size="md"
                    styles={{
                      input: {
                        height: 44,
                        background: 'var(--mantine-color-default)',
                        border: '1px solid var(--mantine-color-default-border)',
                        color: projectsCount > 0 ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)',
                        fontWeight: 750,
                      },
                    }}
                  />
                  <Button
                    radius={8}
                    size="md"
                    variant="default"
                    leftSection={<FileJson size={16} />}
                    onClick={onChangeJson}
                    loading={isChangingJson}
                    styles={{
                      root: {
                        height: 44,
                        fontWeight: 900,
                      },
                    }}
                  >
                    导入需求表
                  </Button>
                  <Button
                    radius={8}
                    size="md"
                    leftSection={<FolderPlus size={16} />}
                    onClick={onInitFolders}
                    styles={{
                      root: {
                        height: 46,
                        fontWeight: 900,
                      },
                    }}
                  >
                    创建今日目录
                  </Button>
                </Stack>
              </Card>

              <Card className="daily-naming-card" withBorder radius={8} p={20} style={cardStyle}>
                <SectionTitle icon={<Sparkles size={16} />} title="命名方式" />
                <Stack gap="md">
                  <SegmentedControl
                    fullWidth
                    value={renameSelection.mode}
                    onChange={(value) => onChangeRenameMode(value as RenameMode)}
                    data={[
                      { label: '常规', value: 'regular' },
                      { label: '特殊', value: 'special' },
                      { label: '自定义', value: 'custom', disabled: customRenamePresets.length === 0 },
                    ]}
                    styles={{ label: { fontWeight: 850 } }}
                  />

                  {renameSelection.mode === 'custom' && (
                    <Select
                      label="本次使用的自定义模板"
                      description="模板名称来自设置 > 命名模板"
                      value={renameSelection.customPresetId || null}
                      data={customRenamePresets.map((preset) => ({ label: preset.name, value: preset.id }))}
                      onChange={(value) => value && onChangeCustomPreset(value)}
                      placeholder="选择一个具名模板"
                      searchable
                    />
                  )}

                  <Paper withBorder radius={8} p="sm" style={{ ...compactCardStyle, borderLeft: '4px solid var(--mantine-color-violet-filled)' }}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" c="dimmed" fw={850}>当前模板</Text>
                        <Text fw={900} truncate>{previewPresetName || renameExample?.presetName || '模板不可用'}</Text>
                      </Box>
                      <Badge color={renamePreview?.canExecute ? 'teal' : renamePreview ? 'red' : 'gray'} variant="light">
                        {renamePreview?.canExecute ? '预检通过' : renamePreview ? '预检阻断' : '未预检'}
                      </Badge>
                    </Group>
                  </Paper>

                  {renameExample && (
                    <Box>
                      <Text size="xs" c="dimmed" fw={850} mb={5}>命名示例</Text>
                      <Stack gap={5}>
                        {renameExample.items.map((item) => (
                          <Paper key={item.label} withBorder radius={6} px="sm" py={7}>
                            <Text size="xs" c="dimmed">{item.label}</Text>
                            <Text size="sm" fw={850} c={item.valid ? 'teal' : 'red'} style={{ overflowWrap: 'anywhere' }}>
                              {item.value}
                            </Text>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {previewRows.length > 0 && (
                    <Box>
                      <Text size="xs" c="dimmed" fw={850} mb={5}>真实文件名预览</Text>
                      <Stack gap={5}>
                        {previewRows.map((item) => (
                          <Paper key={item.oldPath} withBorder radius={6} px="sm" py={7}>
                            <Text size="xs" c="dimmed" truncate>{item.oldFileName}</Text>
                            <Text size="sm" fw={850} c="teal" truncate>→ {item.newFileName}</Text>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {renameSelection.mode === 'custom' && previewErrors.length > 0 && (
                    <Alert color="red" title="自定义模板暂时不能执行">
                      <Stack gap="xs">
                        <Text size="sm">{previewErrors[0]?.error || '请检查当前模板字段。'}</Text>
                        {canFallbackToRegular ? (
                          <Button variant="light" color="blue" size="xs" onClick={onFallbackToRegular} style={{ alignSelf: 'flex-start' }}>
                            明确改用常规模板
                          </Button>
                        ) : (
                          <Text size="xs">常规模板也需要修正，请到设置中恢复系统默认。</Text>
                        )}
                      </Stack>
                    </Alert>
                  )}

                  {workflowSaveState === 'error' && (
                    <Alert color="red" title="模板未能保存到本机">
                      当前内存中的模板仍可用于本次预检，但团队下次启动前请先到设置页确认保存状态。
                    </Alert>
                  )}

                  {hasFailedRenameItems && (
                    <Alert color="orange" title={`${renameBatchResult?.failedCount || 0} 个文件仍待处理`}>
                      <Stack gap="xs">
                        <Text size="sm">成功项已保留，当前列表只留下失败文件，可直接重试。</Text>
                        <Button variant="light" color="orange" size="xs" loading={isRenaming} onClick={onRetryFailed} style={{ alignSelf: 'flex-start' }}>
                          仅重试失败项
                        </Button>
                      </Stack>
                    </Alert>
                  )}
                </Stack>
              </Card>
            </Stack>

            <Stack className="daily-main" gap={18} style={{ flex: 1, minWidth: 0 }}>
              <Card className="daily-status-card" withBorder radius={8} p={22} style={cardStyle}>
                <Group justify="space-between" wrap="nowrap" align="center">
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={10} mb={8}>
                      <Box
                        w={8}
                        h={8}
                        style={{
                          borderRadius: 999,
                          background: `var(--mantine-color-${statusState.color}-filled)`,
                        }}
                      />
                      <Badge color={statusState.color} variant="light" radius="sm" styles={{ root: { fontWeight: 850 } }}>
                        {statusState.label}
                      </Badge>
                    </Group>
                    <Title order={2} c="var(--mantine-color-text)" mb={8} style={{ fontSize: 30, lineHeight: 1.1 }}>
                      {statusState.title}
                    </Title>
                    <Text c="var(--mantine-color-dimmed)" size="md" fw={550}>
                      {statusState.description}
                    </Text>
                  </Box>
                  <ThemeIcon size={70} radius={8} variant="light" color={statusState.color}>
                    {statusState.icon}
                  </ThemeIcon>
                </Group>
              </Card>

              <Flex className="daily-upload-grid" gap={18} align="stretch">
                <Card className="daily-upload-card" withBorder radius={8} p={22} style={{ ...cardStyle, flex: 1.15, minWidth: 0 }}>
                  <SectionTitle
                    icon={<UploadCloud size={16} />}
                    title="上传素材"
                    aside={folderPaths.length > 0 && (
                      <Group gap={8}>
                        <Button
                          variant="light"
                          color="blue"
                          size="xs"
                          radius={8}
                          leftSection={<FolderPlus size={14} />}
                          onClick={onAddFolder}
                          styles={{ root: { fontWeight: 850 } }}
                        >
                          添加
                        </Button>
                        <Button
                          variant="light"
                          color="red"
                          size="xs"
                          radius={8}
                          leftSection={<Trash2 size={14} />}
                          onClick={onClearFolders}
                          styles={{ root: { fontWeight: 850 } }}
                        >
                          清空
                        </Button>
                      </Group>
                    )}
                  />
                  <Dropzone
                    className="daily-dropzone"
                    onDrop={() => {}}
                    onDropCapture={(event: React.DragEvent) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const paths = extractDroppedPaths(event);
                      if (paths.length > 0) onDropPaths(paths);
                    }}
                    activateOnClick={false}
                    onClick={folderPaths.length === 0 ? onAddFolder : undefined}
                    radius={8}
                    styles={{
                      root: {
                        minHeight: 228,
                        border: folderPaths.length > 0 ? '1px solid var(--mantine-color-default-border)' : '2px dashed var(--mantine-color-default-border)',
                        background: 'var(--mantine-color-default)',
                        display: 'flex',
                        alignItems: folderPaths.length > 0 ? 'stretch' : 'center',
                        justifyContent: folderPaths.length > 0 ? 'flex-start' : 'center',
                        cursor: folderPaths.length > 0 ? 'default' : 'pointer',
                        padding: folderPaths.length > 0 ? 12 : 18,
                      },
                      inner: {
                        pointerEvents: folderPaths.length > 0 ? 'auto' : 'none',
                        width: '100%',
                      },
                    }}
                  >
                    {folderPaths.length > 0 ? (
                      <ScrollArea style={{ height: 206, width: '100%' }} offsetScrollbars>
                        <Stack gap="sm">
                          {folderPaths.map((path) => (
                            <Paper
                              key={path}
                              withBorder
                              radius={8}
                              p="sm"
                              style={{
                                borderColor: 'var(--mantine-color-default-border)',
                                background: 'var(--mantine-color-body)',
                              }}
                            >
                              <Group justify="space-between" wrap="nowrap">
                                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                                  <ThemeIcon size={34} radius={8} variant="light" color="blue">
                                    <FolderOpen size={16} />
                                  </ThemeIcon>
                                  <Stack gap={2} style={{ minWidth: 0, overflow: 'hidden' }}>
                                    <Text truncate c="var(--mantine-color-text)" fw={850} size="sm">
                                      {getFolderName(path)}
                                    </Text>
                                    <Text truncate c="dimmed" size="xs">
                                      {path}
                                    </Text>
                                  </Stack>
                                </Group>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  radius={8}
                                  aria-label="删除目录"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onRemoveFolder(path);
                                  }}
                                >
                                  <X size={17} />
                                </ActionIcon>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </ScrollArea>
                    ) : (
                      <Flex direction="column" align="center" justify="center" gap="sm">
                        <ThemeIcon variant="light" color="blue" size={44} radius={8}>
                          <UploadCloud size={25} />
                        </ThemeIcon>
                        <Text size="sm" c="var(--mantine-color-dimmed)" ta="center" fw={750}>
                          拖入素材目录或点击选择
                        </Text>
                      </Flex>
                    )}
                  </Dropzone>
                  {hasFinishedRenaming && (
                    <Button
                      mt="md"
                      variant="light"
                      color="teal"
                      radius={8}
                      leftSection={<FolderOpen size={16} />}
                      onClick={() => {
                        if (lastRenamedPaths.length > 0) onOpenFolder(lastRenamedPaths[0]);
                      }}
                      styles={{ root: { fontWeight: 850 } }}
                    >
                      打开对应文件夹
                    </Button>
                  )}
                </Card>

                <Card className="daily-sizes-card" withBorder radius={8} p={22} style={{ ...cardStyle, flex: 0.85, minWidth: 280 }}>
                  <SectionTitle icon={<FileText size={16} />} title="尺寸目标" />
                  <Stack gap="lg">
                    <Box>
                      <Text size="sm" fw={850} c="var(--mantine-color-dimmed)" mb={10}>
                        需求表尺寸
                      </Text>
                      {requirementSizes.length > 0 ? (
                        <Group gap={8}>
                          {requirementSizes.map((size) => (
                            <Badge key={size} color="blue" variant="light" radius="sm" styles={{ root: { fontWeight: 850 } }}>
                              {size}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Text size="sm" c="var(--mantine-color-dimmed)">
                          未导入需求表
                        </Text>
                      )}
                    </Box>

                    {detectedFolderSizes.length > 0 && (
                      <Box>
                        <Text size="sm" fw={850} c="var(--mantine-color-dimmed)" mb={10}>
                          素材内识别
                        </Text>
                        <Group gap={8}>
                          {detectedFolderSizes.map((size) => (
                            <Badge key={size} color="gray" variant="outline" radius="sm" styles={{ root: { fontWeight: 800 } }}>
                              {size}
                            </Badge>
                          ))}
                        </Group>
                      </Box>
                    )}

                    <Box>
                      <Text size="sm" fw={850} c="var(--mantine-color-dimmed)" mb={10}>
                        手动校验尺寸
                      </Text>
                      <Stack gap="md">
                        {renderSizeButtons('横版与方形', horizontalManualSizes)}
                        {renderSizeButtons('竖版', verticalManualSizes)}
                      </Stack>
                    </Box>
                  </Stack>
                </Card>
              </Flex>

              <Card
                className="daily-validation-card"
                radius={8}
                p={0}
                withBorder
                style={{
                  ...cardStyle,
                  overflow: 'hidden',
                }}
              >
                <Box p={22} pb={12}>
                  <SectionTitle icon={<FileText size={16} />} title="校验反馈" />
                  {validationSummary.totalCount > 0 && (
                    <Group gap="xs" mt={-4} mb="xs" wrap="wrap">
                      {blockingIssueCount > 0 && (
                        <Badge color="red" variant="light" radius="sm">
                          需处理 {blockingIssueCount} 项
                        </Badge>
                      )}
                      {emptyFolderCount > 0 && (
                        <Badge color="orange" variant="light" radius="sm">
                          缺失文件 {emptyFolderCount} 个目录
                        </Badge>
                      )}
                      {missingTotal > 0 && emptyFolderCount === 0 && (
                        <Badge color="orange" variant="light" radius="sm">
                          缺 {missingTotal} 张
                        </Badge>
                      )}
                      {validationSummary.extraCount > 0 && (
                        <Badge color="blue" variant="light" radius="sm">
                          非需求 {validationSummary.extraCount} 项
                        </Badge>
                      )}
                      {validationSummary.passedCount > 0 && (
                        <Badge color="teal" variant="light" radius="sm">
                          已通过 {validationSummary.passedCount} 项
                        </Badge>
                      )}
                      {validationSummary.hasMissingOnlyIssues && validationSummary.canRenamePassedFiles && (
                        <Badge color="blue" variant="light" radius="sm">
                          可先重命名已有素材
                        </Badge>
                      )}
                    </Group>
                  )}
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
                        fontWeight: 850,
                      },
                    }}
                  >
                    {isTableExpanded ? '收起详情' : '查看详情'}
                  </Button>
                </Box>

                <Collapse in={isTableExpanded}>
                  <Box p={22}>
                    {groupedPreviewRows.length > 0 ? (
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
                          },
                          control: {
                            padding: '12px 16px',
                          },
                          panel: {
                            padding: '0 16px 14px 16px',
                          },
                          content: {
                            padding: 0,
                          },
                        }}
                      >
                        {groupedPreviewRows.map((group) => (
                          <Accordion.Item key={group.folderName} value={group.folderName}>
                            <Accordion.Control>
                              <Group justify="space-between">
                                <Group gap="sm">
                                  <FolderOpen size={18} color={getGroupIconColor(group)} />
                                  <Text
                                    fw={850}
                                    c={group.hasBlockingIssues ? 'var(--mantine-color-red-filled)' : 'var(--mantine-color-text)'}
                                  >
                                    {group.folderName}
                                  </Text>
                                  {group.blockingCount > 0 && (
                                    <Badge color="red" variant="light" size="sm">
                                      需处理 {group.blockingCount}
                                    </Badge>
                                  )}
                                  {group.emptyFolderCount > 0 && (
                                    <Badge color="orange" variant="light" size="sm">
                                      缺失文件
                                    </Badge>
                                  )}
                                  {group.missingTotal > 0 && group.emptyFolderCount === 0 && (
                                    <Badge color="orange" variant="light" size="sm">
                                      缺 {group.missingTotal} 张
                                    </Badge>
                                  )}
                                  {group.extraCount > 0 && (
                                    <Badge color="blue" variant="light" size="sm">
                                      非需求 {group.extraCount}
                                    </Badge>
                                  )}
                                  {group.passedCount > 0 && (
                                    <Badge color="teal" variant="light" size="sm">
                                      已通过 {group.passedCount}
                                    </Badge>
                                  )}
                                </Group>
                              </Group>
                            </Accordion.Control>
                            <Accordion.Panel>
                              {group.actionRows.length > 0 ? (
                                <ScrollArea type="auto" offsetScrollbars>
                                  <Table
                                    highlightOnHover
                                    horizontalSpacing="lg"
                                    verticalSpacing="sm"
                                    styles={{
                                      thead: {
                                        background: 'var(--mantine-color-default)',
                                      },
                                      th: {
                                        color: 'var(--mantine-color-dimmed)',
                                        fontSize: 13,
                                        fontWeight: 850,
                                        borderBottom: '1px solid var(--mantine-color-default-border)',
                                      },
                                      td: {
                                        borderTop: '1px solid var(--mantine-color-default-border)',
                                        color: 'var(--mantine-color-text)',
                                        fontSize: 14,
                                      },
                                    }}
                                  >
                                    <Table.Thead>
                                      <Table.Tr>
                                        <Table.Th>需要处理</Table.Th>
                                        <Table.Th>原因 / 建议</Table.Th>
                                        <Table.Th>大小</Table.Th>
                                        <Table.Th style={{ textAlign: 'right' }}>状态</Table.Th>
                                        <Table.Th style={{ textAlign: 'right' }}>操作</Table.Th>
                                      </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                      {renderValidationRows(group.actionRows, { showActions: true })}
                                    </Table.Tbody>
                                  </Table>
                                </ScrollArea>
                              ) : (
                                <Paper
                                  withBorder
                                  radius={8}
                                  p="md"
                                  style={{
                                    borderColor: 'var(--mantine-color-default-border)',
                                    background: 'var(--mantine-color-body)',
                                  }}
                                >
                                  <Group gap="sm">
                                    <CheckCircle2 size={18} color="var(--mantine-color-teal-filled)" />
                                    <Text fw={850} c="var(--mantine-color-text)">
                                      没有需要处理的问题
                                    </Text>
                                    <Text c="var(--mantine-color-dimmed)">
                                      已通过 {group.passedCount} 项素材。
                                    </Text>
                                  </Group>
                                </Paper>
                              )}

                              {group.passedRows.length > 0 && (
                                <Box mt="sm">
                                  <Button
                                    variant="subtle"
                                    color="gray"
                                    size="xs"
                                    leftSection={isPassedGroupExpanded(group.folderName) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    onClick={() => togglePassedGroup(group.folderName)}
                                    styles={{
                                      root: {
                                        paddingInline: 0,
                                        color: 'var(--mantine-color-dimmed)',
                                        fontWeight: 850,
                                      },
                                    }}
                                  >
                                    {isPassedGroupExpanded(group.folderName)
                                      ? '收起已通过素材'
                                      : `查看已通过 ${group.passedCount} 项`}
                                  </Button>
                                  <Collapse in={isPassedGroupExpanded(group.folderName)}>
                                    <ScrollArea type="auto" offsetScrollbars>
                                      <Table
                                        highlightOnHover
                                        horizontalSpacing="lg"
                                        verticalSpacing="sm"
                                        mt="xs"
                                        styles={{
                                          thead: {
                                            background: 'var(--mantine-color-default)',
                                          },
                                          th: {
                                            color: 'var(--mantine-color-dimmed)',
                                            fontSize: 13,
                                            fontWeight: 850,
                                            borderBottom: '1px solid var(--mantine-color-default-border)',
                                          },
                                          td: {
                                            borderTop: '1px solid var(--mantine-color-default-border)',
                                            color: 'var(--mantine-color-text)',
                                            fontSize: 14,
                                          },
                                        }}
                                      >
                                        <Table.Thead>
                                          <Table.Tr>
                                            <Table.Th>已通过素材</Table.Th>
                                            <Table.Th>原因 / 建议</Table.Th>
                                            <Table.Th>大小</Table.Th>
                                            <Table.Th style={{ textAlign: 'right' }}>状态</Table.Th>
                                          </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                          {renderValidationRows(group.passedRows, { mutedPassed: true })}
                                        </Table.Tbody>
                                      </Table>
                                    </ScrollArea>
                                  </Collapse>
                                </Box>
                              )}
                            </Accordion.Panel>
                          </Accordion.Item>
                        ))}
                      </Accordion>
                    ) : (
                      <Paper
                        withBorder
                        radius={8}
                        p="md"
                        style={{
                          borderColor: 'var(--mantine-color-default-border)',
                          background: 'var(--mantine-color-body)',
                        }}
                      >
                        <Text c="var(--mantine-color-dimmed)" fw={750}>
                          暂无校验结果
                        </Text>
                      </Paper>
                    )}
                  </Box>
                </Collapse>
              </Card>
            </Stack>
          </Flex>
        </Box>
      </ScrollArea>

      <Paper
        className="daily-actions"
        radius={8}
        p={10}
        shadow="md"
        style={{
          position: 'absolute',
          right: 28,
          bottom: 24,
          background: 'var(--mantine-color-default)',
          border: '1px solid var(--mantine-color-default-border)',
          boxShadow: '0 16px 38px rgba(15, 23, 42, 0.12)',
        }}
      >
        <Group gap={12}>
          <Button
            radius={8}
            color="dark"
            size="lg"
            leftSection={<Play size={18} fill="currentColor" />}
            onClick={onValidate}
            loading={isValidating}
            styles={{
              root: {
                height: 54,
                paddingInline: 30,
                background: 'var(--mantine-primary-color-filled)',
                fontSize: 17,
                fontWeight: 900,
              },
            }}
          >
            开始校验
          </Button>
          <Button
            radius={8}
            color="teal"
            size="lg"
            leftSection={<CheckCircle2 size={20} />}
            onClick={onRename}
            loading={isRenaming}
            disabled={!canRename}
            styles={{
              root: {
                height: 54,
                paddingInline: 30,
                background: 'var(--mantine-color-green-filled)',
                fontSize: 17,
                fontWeight: 900,
              },
            }}
          >
            执行重命名
          </Button>
        </Group>
      </Paper>
    </Flex>
  );
}
