import React, { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Alert, Badge, Box, Button, Card, Checkbox, Flex, Group, Modal,
  Paper, Progress, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack,
  Table, Tabs, Text, ThemeIcon, Title, Tooltip,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import {
  CheckCircle2, FileJson, FileText, FolderOpen, FolderPlus, History, Play,
  SlidersHorizontal, Sparkles, UploadCloud, X,
} from 'lucide-react'
import { formatBytes, type ValidationResult } from '../appState'
import { StatusBadge } from '../StatusBadge'
import { buildValidationPresentation, canTrashValidationRow, getValidationRowKind, getValidationRowReason } from '../validationPresentation'
import {
  RENAME_TOKEN_LABELS,
  type RenameBatchResult,
  type RenameMode,
  type RenamePreset,
  type RenamePreview,
  type RenameSelection,
} from '../../../shared/renameTemplates.ts'
import { OpenFlowWaterSloth } from '../components/OpenFlowWaterSloth'
import type { WaterSlothMotion } from '../waterSlothMotion.ts'

export interface DailyRenameExample {
  presetName: string
  items: Array<{ label: string; value: string; valid: boolean }>
}

interface DailyWorkspaceProps {
  jsonFileName: string; extractionTimeLabel: string; pendingExtractionCount: number; projectsCount: number
  requirementSizes: string[]; detectedFolderSizes: string[]; manualTargetSizes: string[]
  horizontalManualSizes: string[]; verticalManualSizes: string[]; folderPaths: string[]
  validationResults: ValidationResult[]; isChangingJson: boolean; isValidating: boolean; isRenaming: boolean
  hasValidated: boolean; hasIssues: boolean; canRename: boolean; isTableExpanded: boolean
  renameSelection: RenameSelection; activeRenamePreset?: RenamePreset; customRenamePresets: RenamePreset[]; renameExample: DailyRenameExample | null
  renamePreview: RenamePreview | null; renameBatchResult: RenameBatchResult | null
  workflowSaveState: 'idle' | 'saving' | 'saved' | 'error'; canFallbackToRegular: boolean
  lastRenamedPaths: string[]; completedAt: number | null; completedVisibilityMs: number
  waterSlothMotion: WaterSlothMotion
  onToggleTable: () => void; onChangeRenameMode: (mode: RenameMode) => void
  onChangeCustomPreset: (presetId: string) => void; onFallbackToRegular: () => void; onRetryFailed: () => void
  onToggleManualSize: (size: string) => void; onSelectRequirementSizes: () => void
  onRestoreDefaultSizes: () => void; onClearManualSizes: () => void
  onChangeJson: () => void; onShowPendingExtraction: () => void
  onInitFolders: () => void; onAddFolder: () => void; onClearFolders: () => void; onRemoveFolder: (path: string) => void
  failedValidationFolderCount: number; onValidate: () => void; onRevalidateFailed: () => void
  onRename: () => void; onTrashValidationFile: (row: ValidationResult) => void
  onOpenSettings: () => void; onOpenHistory: () => void; onDropPaths: (paths: string[]) => void; onOpenFolder: (path: string) => void
}

function getFolderName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path
}

function extractDroppedPaths(event: React.DragEvent) {
  const paths: string[] = []
  for (const item of Array.from(event.dataTransfer.items || [])) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry()
    const file = item.getAsFile() as (File & { path?: string }) | null
    if (!file?.path) continue
    paths.push(entry?.isDirectory ? file.path : file.path.replace(/[\\/][^\\/]+$/, ''))
  }
  return paths
}

function classifySizes(sizes: string[]) {
  const result = { landscape: [] as string[], portrait: [] as string[], square: [] as string[], other: [] as string[] }
  sizes.forEach((size) => {
    const [width, height] = size.split('*').map(Number)
    if (!width || !height) result.other.push(size)
    else if (width === height) result.square.push(size)
    else if (width > height) result.landscape.push(size)
    else result.portrait.push(size)
  })
  return result
}

export function DailyWorkspace(props: DailyWorkspaceProps) {
  const [detail, setDetail] = useState<'naming' | 'sizes' | 'validation' | null>(null)
  const [now, setNow] = useState(Date.now())
  const validation = useMemo(() => buildValidationPresentation(props.validationResults), [props.validationResults])
  const activeSizes = useMemo(() => [...new Set([...props.requirementSizes, ...props.detectedFolderSizes, ...props.manualTargetSizes])], [props.requirementSizes, props.detectedFolderSizes, props.manualTargetSizes])
  const availableSizes = useMemo(() => [...new Set([...props.requirementSizes, ...props.detectedFolderSizes, ...props.horizontalManualSizes, ...props.verticalManualSizes])], [props.requirementSizes, props.detectedFolderSizes, props.horizontalManualSizes, props.verticalManualSizes])
  const groupedSizes = useMemo(() => classifySizes(availableSizes), [availableSizes])
  const validCount = props.validationResults.filter((item) => item.status === 'valid').length
  const failedRenameCount = props.renameBatchResult?.results.filter((item) => !item.success).length || 0
  const completedProgress = props.completedAt ? Math.max(0, 100 - ((now - props.completedAt) / props.completedVisibilityMs) * 100) : 0

  const describeRenameRule = (mediaType: 'image' | 'video') => {
    const rule = props.activeRenamePreset?.rules[mediaType]
    if (!rule) return null
    return {
      tokens: rule.tokens.map((token) => token.type === 'CustomText' && token.value
        ? `固定文字“${token.value}”`
        : RENAME_TOKEN_LABELS[token.type]),
      separator: rule.separator || '无分隔符',
      dateFormat: rule.dateFormat,
      sequence: `${rule.sequence.prefix || ''}${String(rule.sequence.start).padStart(rule.sequence.padding, '0')}${rule.sequence.suffix || ''} 起`,
    }
  }

  useEffect(() => {
    if (!props.completedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [props.completedAt])

  const renderSizeGroup = (title: string, sizes: string[]) => sizes.length ? (
    <Box>
      <Text size="xs" fw={800} c="dimmed" mb={6}>{title}</Text>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing={6}>
        {sizes.map((size) => <Checkbox.Card key={size} checked={props.manualTargetSizes.includes(size)} onClick={() => props.onToggleManualSize(size)} p="xs" radius="sm"><Text size="sm" fw={750} ta="center">{size}</Text></Checkbox.Card>)}
      </SimpleGrid>
    </Box>
  ) : null

  return (
    <Flex className="daily-workspace daily-workspace-v2" h="100%" direction="column" style={{ minHeight: 0, overflow: 'hidden' }}>
      <Group className="compact-page-header" h={52} px="md" wrap="nowrap">
        <OpenFlowWaterSloth motion={props.waterSlothMotion} size={36} />
        <Title order={2} size="h4">日常处理</Title>
      </Group>

      <Box className="daily-v2-body" p="sm" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Card className="daily-demand-bar" withBorder p="xs" radius="md">
          <Group gap="sm" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <ThemeIcon size={30} variant="light"><FileJson size={16} /></ThemeIcon>
              <Box style={{ minWidth: 0 }}><Text size="xs" c="dimmed">今日需求 · {props.projectsCount} 个项目{props.extractionTimeLabel ? ` · ${props.extractionTimeLabel}` : ''}</Text><Text size="sm" fw={800} truncate>{props.projectsCount ? props.jsonFileName : '尚未导入需求表'}</Text></Box>
            </Group>
            <Group className="daily-demand-actions" gap={6} wrap="nowrap">
              {props.pendingExtractionCount > 0 && <Button size="xs" variant="light" onClick={props.onShowPendingExtraction}>新抓取 {props.pendingExtractionCount}</Button>}
              <Button size="xs" variant="default" loading={props.isChangingJson} onClick={props.onChangeJson}>导入</Button>
              <Button size="xs" leftSection={<FolderPlus size={14} />} onClick={props.onInitFolders}>手动建目录</Button>
            </Group>
          </Group>
        </Card>

        {props.completedAt && props.lastRenamedPaths.length > 0 && <Paper className="daily-completed-strip" withBorder p={6} radius="sm"><Group justify="space-between" wrap="nowrap"><Group gap={6}><CheckCircle2 size={15} color="var(--mantine-color-teal-filled)" /><Text size="xs" fw={750}>上一项目已完成，不影响新任务</Text></Group><Button size="compact-xs" variant="subtle" onClick={() => props.onOpenFolder(props.lastRenamedPaths[0])}>打开目录</Button></Group><Progress value={completedProgress} color="teal" size={2} mt={4} /></Paper>}

        <Box className="daily-v2-grid">
          <Card className="daily-v2-upload" withBorder p="sm" radius="md">
            <Group justify="space-between" mb={6} wrap="nowrap"><Group gap={7}><UploadCloud size={17} /><Text fw={850}>素材目录</Text><Badge variant="light">{props.folderPaths.length}</Badge></Group><Group gap={4}><Button size="compact-xs" variant="light" onClick={props.onAddFolder}>添加</Button>{props.folderPaths.length > 0 && <Button size="compact-xs" variant="subtle" color="red" onClick={props.onClearFolders}>清空</Button>}</Group></Group>
            <Dropzone className="daily-v2-dropzone" onDrop={() => {}} onDropCapture={(event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); const paths = extractDroppedPaths(event); if (paths.length) props.onDropPaths(paths) }} activateOnClick={false} onClick={!props.folderPaths.length ? props.onAddFolder : undefined} styles={{ root: { height: '100%', minHeight: 0, padding: 7, cursor: props.folderPaths.length ? 'default' : 'pointer' }, inner: { height: '100%', pointerEvents: props.folderPaths.length ? 'auto' : 'none' } }}>
              {props.folderPaths.length ? <ScrollArea h="100%" type="auto" offsetScrollbars><Stack gap={5}>{props.folderPaths.map((path) => <Paper key={path} withBorder px="xs" py={5} radius="sm"><Group justify="space-between" wrap="nowrap"><Group gap={7} wrap="nowrap" style={{ minWidth: 0 }}><FolderOpen size={16} color="var(--mantine-color-blue-filled)" /><Box style={{ minWidth: 0 }}><Text size="xs" fw={800} truncate>{getFolderName(path)}</Text><Text size="10px" c="dimmed" truncate>{path}</Text></Box></Group><Group gap={1} wrap="nowrap"><ActionIcon size="sm" variant="subtle" onClick={() => props.onOpenFolder(path)}><FolderOpen size={14} /></ActionIcon><ActionIcon size="sm" variant="subtle" color="red" onClick={() => props.onRemoveFolder(path)}><X size={14} /></ActionIcon></Group></Group></Paper>)}</Stack></ScrollArea> : <Flex h="100%" direction="column" justify="center" align="center" gap={5}><UploadCloud size={28} color="var(--mantine-color-blue-filled)" /><Text size="xs" fw={750}>拖入多个目录或点击选择</Text><Text size="10px" c="dimmed">自动去重并识别尺寸</Text></Flex>}
            </Dropzone>
          </Card>

          <Stack className="daily-v2-controls" gap={7}>
            <Card withBorder p="xs" radius="md" className="daily-parameter-card"><Group justify="space-between" wrap="nowrap"><Group gap={7} wrap="nowrap"><Sparkles size={16} /><Box><Text size="xs" c="dimmed">命名方式</Text><Text size="sm" fw={850}>{props.renamePreview?.items.find((item) => item.presetName)?.presetName || props.renameExample?.presetName || '常规命名'}</Text></Box></Group><Button size="compact-xs" variant="light" onClick={() => setDetail('naming')}>设置</Button></Group><Text size="10px" c={props.renamePreview?.canExecute ? 'teal' : 'dimmed'} mt={4} truncate>{props.renamePreview?.canExecute ? '预检通过' : '导入目录后自动预检'}{failedRenameCount ? ` · ${failedRenameCount} 个待重试` : ''}</Text></Card>
            <Card withBorder p="xs" radius="md" className="daily-parameter-card"><Group justify="space-between" wrap="nowrap"><Group gap={7} wrap="nowrap"><SlidersHorizontal size={16} /><Box><Text size="xs" c="dimmed">尺寸目标</Text><Text size="sm" fw={850}>{activeSizes.length} 项</Text></Box></Group><Button size="compact-xs" variant="light" onClick={() => setDetail('sizes')}>选择</Button></Group><Text size="10px" c="dimmed" mt={4} lineClamp={2}>{activeSizes.length ? `需求 ${props.requirementSizes.length} · 目录 ${props.detectedFolderSizes.length} · 手动 ${props.manualTargetSizes.length}` : '尚未识别尺寸'}</Text></Card>
            <Card withBorder p="xs" radius="md" className="daily-validation-summary"><Group justify="space-between" wrap="nowrap"><Group gap={7}><FileText size={16} /><Box><Text size="xs" c="dimmed">校验结果</Text><Text size="sm" fw={850}>{props.hasValidated ? `${validCount} 通过 · ${validation.summary.blockingCount + validation.summary.missingRowsCount} 待处理` : '等待校验'}</Text></Box></Group><Button size="compact-xs" variant="light" disabled={!props.hasValidated} onClick={() => setDetail('validation')}>详情</Button></Group></Card>
          </Stack>
        </Box>

        <Group className="daily-v2-actions" justify="space-between" wrap="nowrap"><Group gap={5} wrap="nowrap" style={{ minWidth: 0 }}><Tooltip label="历史记录"><ActionIcon aria-label="历史记录" size="sm" variant="subtle" color="gray" onClick={props.onOpenHistory}><History size={15} /></ActionIcon></Tooltip><Text size="xs" c="dimmed" truncate>{props.folderPaths.length ? `${props.folderPaths.length} 个目录已加入` : '添加素材目录后开始校验'}</Text></Group><Group gap={6} wrap="nowrap">{failedRenameCount > 0 && <Button size="sm" variant="light" color="orange" loading={props.isRenaming} onClick={props.onRetryFailed}>仅重试失败项</Button>}<Button size="sm" variant="default" leftSection={<Play size={15} />} loading={props.isValidating} disabled={!props.folderPaths.length} onClick={props.onValidate}>{props.hasValidated ? '重新校验' : '开始校验'}</Button><Button size="sm" leftSection={<CheckCircle2 size={15} />} loading={props.isRenaming} disabled={!props.canRename} onClick={props.onRename}>重命名通过项</Button></Group></Group>
      </Box>

      <Modal opened={detail === 'naming'} onClose={() => setDetail(null)} centered size="calc(100vw - 32px)" title="命名详情" className="focus-modal">
        <Tabs defaultValue="template" keepMounted={false}>
          <Tabs.List grow mb="sm">
            <Tabs.Tab value="template">模板</Tabs.Tab>
            <Tabs.Tab value="rules">规则</Tabs.Tab>
            <Tabs.Tab value="preview">预览</Tabs.Tab>
          </Tabs.List>
          <ScrollArea h="min(55vh, 420px)" type="auto" offsetScrollbars>
            <Tabs.Panel value="template" pr={6}>
              <Stack gap="md">
                <Box>
                  <Text size="sm" fw={800} mb={6}>本次使用的命名方式</Text>
                  <SegmentedControl fullWidth value={props.renameSelection.mode} onChange={(mode) => props.onChangeRenameMode(mode as RenameMode)} data={[{ label: '常规', value: 'regular' }, { label: '特殊', value: 'special' }, { label: '自定义', value: 'custom', disabled: !props.customRenamePresets.length }]} />
                </Box>
                {props.renameSelection.mode === 'custom' && <Select label="自定义模板" value={props.renameSelection.customPresetId || null} data={props.customRenamePresets.map((preset) => ({ label: preset.name, value: preset.id }))} onChange={(value) => value && props.onChangeCustomPreset(value)} />}
                <Alert color="blue" title={props.activeRenamePreset?.name || props.renameExample?.presetName || '当前模板'}>
                  这里仅选择本次任务使用的模板。字段顺序、分隔符和序号规则在“规则”中查看，需要编辑时进入命名模板设置。
                </Alert>
                <Button variant="default" onClick={() => { setDetail(null); props.onOpenSettings() }}>编辑完整命名模板</Button>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="rules" pr={6}>
              <Stack gap="sm">
                {(['image', 'video'] as const).map((mediaType) => {
                  const rule = describeRenameRule(mediaType)
                  return <Card key={mediaType} withBorder p="sm"><Group justify="space-between" mb={6}><Text size="sm" fw={850}>{mediaType === 'image' ? '图片规则' : '视频规则'}</Text><Badge variant="light">{props.activeRenamePreset?.name || '当前模板'}</Badge></Group>{rule ? <Stack gap={5}><Text size="xs"><Text span c="dimmed">字段顺序：</Text>{rule.tokens.join(' → ')}</Text><Text size="xs"><Text span c="dimmed">分隔符：</Text>{rule.separator}</Text><Text size="xs"><Text span c="dimmed">日期格式：</Text>{rule.dateFormat}</Text><Text size="xs"><Text span c="dimmed">序号：</Text>{rule.sequence}</Text></Stack> : <Text size="xs" c="dimmed">当前模板规则不可用，请重新选择模板。</Text>}</Card>
                })}
                <Text size="xs" c="dimmed">规则只决定文件名，不移动素材；正式重命名前仍会先生成预览并阻止重名或无效名称。</Text>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="preview" pr={6}>
              <Stack gap="xs">
                {(props.renamePreview?.items || []).slice(0, 30).map((item) => <Paper key={item.oldPath} withBorder p="xs"><Text size="xs" c="dimmed" truncate>{item.oldFileName}</Text><Text size="sm" fw={750} c={item.status === 'blocked' ? 'red' : 'teal'}>{item.status === 'blocked' ? item.error : `→ ${item.newFileName}`}</Text></Paper>)}
                {!props.renamePreview?.items.length && props.renameExample?.items.map((item) => <Paper key={item.label} withBorder p="xs"><Text size="xs" c="dimmed">{item.label}示例</Text><Text size="sm" fw={750} c={item.valid ? undefined : 'red'}>{item.value}</Text></Paper>)}
                {!props.renamePreview?.items.length && !props.renameExample?.items.length && <Text ta="center" c="dimmed" py="xl">选择有效模板后显示命名示例；添加素材目录后显示逐文件预览。</Text>}
              </Stack>
            </Tabs.Panel>
          </ScrollArea>
          <Stack gap="xs" mt="sm">
            {props.renameSelection.mode === 'custom' && props.renamePreview && !props.renamePreview.canExecute && <Alert color="red" title="模板不能应用">请修正模板字段后再执行。{props.canFallbackToRegular && <Button ml="sm" size="compact-xs" variant="light" onClick={props.onFallbackToRegular}>改用常规模板</Button>}</Alert>}
            {props.workflowSaveState === 'error' && <Alert color="red">模板尚未保存到本机，请到设置页确认。</Alert>}
            <Group justify="space-between"><Text size="xs" c="dimmed">关闭后自动保留当前选择。</Text><Button onClick={() => setDetail(null)} disabled={Boolean(props.renamePreview && !props.renamePreview.canExecute)}>应用并返回</Button></Group>
          </Stack>
        </Tabs>
      </Modal>

      <Modal opened={detail === 'sizes'} onClose={() => setDetail(null)} centered size="calc(100vw - 32px)" title="尺寸选择" className="focus-modal"><Stack gap="md"><Group justify="space-between" align="flex-start"><Group gap={6}><Badge color="blue">需求 {props.requirementSizes.length}</Badge><Badge color="teal">目录识别 {props.detectedFolderSizes.length}</Badge><Badge color="gray">手动 {props.manualTargetSizes.length}</Badge></Group><Group gap={6}><Button size="compact-xs" variant="light" disabled={!props.requirementSizes.length} onClick={props.onSelectRequirementSizes}>全选需求尺寸</Button><Button size="compact-xs" variant="default" onClick={props.onRestoreDefaultSizes}>恢复默认</Button><Button size="compact-xs" variant="subtle" color="red" disabled={!props.manualTargetSizes.length} onClick={props.onClearManualSizes}>清除手动尺寸</Button></Group></Group><ScrollArea h="min(55vh, 430px)" type="auto"><Stack gap="md">{renderSizeGroup('横版', groupedSizes.landscape)}{renderSizeGroup('竖版', groupedSizes.portrait)}{renderSizeGroup('方形', groupedSizes.square)}{renderSizeGroup('其他', groupedSizes.other)}</Stack></ScrollArea><Text size="xs" c="dimmed">需求和目录识别尺寸会自动参与校验；勾选项用于临时补充。清空全部素材目录会清除临时选择。</Text><Group justify="flex-end"><Button onClick={() => setDetail(null)}>完成</Button></Group></Stack></Modal>

      <Modal opened={detail === 'validation'} onClose={() => setDetail(null)} centered size="calc(100vw - 24px)" title="校验详情" className="focus-modal"><Stack gap="sm"><Group gap={6}><Badge color="teal">通过 {validCount}</Badge><Badge color="orange">缺失 {validation.summary.missingRowsCount}</Badge><Badge color="red">异常 {validation.summary.blockingCount}</Badge><Badge color="blue">额外 {validation.summary.extraCount}</Badge></Group><ScrollArea h="min(62vh, 500px)" type="auto"><Table striped highlightOnHover withTableBorder><Table.Thead><Table.Tr><Table.Th>目录 / 文件</Table.Th><Table.Th>说明</Table.Th><Table.Th>状态</Table.Th><Table.Th>操作</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{props.validationResults.map((row, index) => <Table.Tr key={`${row.filePath}-${row.targetSize}-${index}`}><Table.Td><Text size="sm" fw={750}>{row.workspaceProjectName || row.folderName}</Text><Text size="xs" c="dimmed">{row.status === 'missing' ? row.targetSize : `${row.fileName}${row.ext}`}</Text></Table.Td><Table.Td><Text size="xs">{getValidationRowReason(row)}</Text>{row.fileSize > 0 && <Text size="10px" c="dimmed">{formatBytes(row.fileSize)}</Text>}</Table.Td><Table.Td><StatusBadge result={row} kind={getValidationRowKind(row)} muted={row.status === 'valid'} /></Table.Td><Table.Td>{canTrashValidationRow(row) && <Button size="compact-xs" variant="subtle" color="red" onClick={() => props.onTrashValidationFile(row)}>移到回收站</Button>}</Table.Td></Table.Tr>)}</Table.Tbody></Table></ScrollArea><Group justify="space-between"><Text size="xs" c="dimmed">异常目录不会阻塞其他已通过目录。</Text><Group>{props.failedValidationFolderCount > 0 && <Button variant="light" color="orange" loading={props.isValidating} onClick={props.onRevalidateFailed}>只重验失败目录（{props.failedValidationFolderCount}）</Button>}<Button variant="default" loading={props.isValidating} onClick={props.onValidate}>重新校验全部</Button><Button disabled={!props.canRename} loading={props.isRenaming} onClick={props.onRename}>重命名通过项</Button></Group></Group></Stack></Modal>
    </Flex>
  )
}
