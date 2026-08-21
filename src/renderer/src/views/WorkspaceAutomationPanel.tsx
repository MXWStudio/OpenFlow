import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  Radio,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { formatBytes, type WorkspaceSettings } from '../appState'
import {
  DEFAULT_WORKSPACE_FOLDER_PRESETS,
  type WorkspaceCleanupTreeNode,
  type WorkspaceFolderPreset,
} from '../../../shared/workspaceContract'
import { notify } from '../utils/notify'

interface Props {
  value: WorkspaceSettings
  onChange: React.Dispatch<React.SetStateAction<WorkspaceSettings>>
  activePaths: string[]
}

interface CleanupHistoryEntry {
  id: number
  timestamp: number
  mode: 'trash' | 'permanent'
  paths: string[]
  totalBytes: number
  totalFiles: number
}

function makeCustomPreset(index: number): WorkspaceFolderPreset {
  return {
    id: `custom-${Date.now()}-${index}`,
    label: `自定义目录 ${index}`,
    suffix: `自定义目录${index}`,
    mediaKinds: ['image', 'video'],
    enabled: true,
  }
}

function isValidSuffix(value: string) {
  return Boolean(value.trim()) && !/[<>:"/\\|?*]/.test(value) && !value.includes('..')
}

function normalizePathKey(path: string) {
  return path.replace(/\//g, '\\').replace(/\\+$/, '').toLocaleLowerCase()
}

function isSameOrInsidePath(parentPath: string, candidatePath: string) {
  const parent = normalizePathKey(parentPath)
  const candidate = normalizePathKey(candidatePath)
  return candidate === parent || candidate.startsWith(`${parent}\\`)
}

export function WorkspaceAutomationPanel({ value, onChange, activePaths }: Props) {
  const [cleanupOpened, setCleanupOpened] = useState(false)
  const [confirmOpened, setConfirmOpened] = useState(false)
  const [cleanupHistoryOpened, setCleanupHistoryOpened] = useState(false)
  const [cleanupTargets, setCleanupTargets] = useState<string[]>([])
  const [cleanupScopePath, setCleanupScopePath] = useState('')
  const [cleanupPresetIds, setCleanupPresetIds] = useState<string[]>([])
  const [cleanupScan, setCleanupScan] = useState<Awaited<ReturnType<typeof window.electronAPI.fs.scanWorkspaceCleanup>> | null>(null)
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [cleanupMode, setCleanupMode] = useState<'trash' | 'permanent'>('trash')
  const [removeEmptyParents, setRemoveEmptyParents] = useState(false)
  const [permanentPhrase, setPermanentPhrase] = useState('')
  const [cleanupHistory, setCleanupHistory] = useState<CleanupHistoryEntry[]>([])
  const [treeChildren, setTreeChildren] = useState<Record<string, WorkspaceCleanupTreeNode[]>>({})
  const [expandedTreePaths, setExpandedTreePaths] = useState<string[]>([])
  const [treeLoadingPaths, setTreeLoadingPaths] = useState<string[]>([])
  const [treeError, setTreeError] = useState('')
  const cleanupScanIdRef = useRef('')

  useEffect(() => {
    if (!window.electronAPI?.store) return
    const cutoff = Date.now() - value.cleanupReportRetentionDays * 24 * 60 * 60 * 1000
    void window.electronAPI.store.get<CleanupHistoryEntry[]>('cleanupHistory').then((stored) => {
      const retained = Array.isArray(stored) ? stored.filter((entry) => entry.timestamp >= cutoff) : []
      setCleanupHistory(retained)
      if (Array.isArray(stored) && stored.length !== retained.length) void window.electronAPI.store.set('cleanupHistory', retained)
    })
  }, [value.cleanupReportRetentionDays])

  const invalidPresetCount = useMemo(
    () => value.folderPresets.filter((preset) => !isValidSuffix(preset.suffix)).length,
    [value.folderPresets],
  )
  const enabledCleanupPresets = useMemo(
    () => value.folderPresets.filter((preset) => preset.enabled && isValidSuffix(preset.suffix)),
    [value.folderPresets],
  )

  useEffect(() => {
    if (cleanupOpened && !cleanupPresetIds.length) {
      setCleanupPresetIds(enabledCleanupPresets.map((preset) => preset.id))
    }
  }, [cleanupOpened, cleanupPresetIds.length, enabledCleanupPresets])

  useEffect(() => {
    if (!cleanupOpened || !value.rootDir || !window.electronAPI?.fs?.listWorkspaceCleanupChildren) return
    let cancelled = false
    setTreeChildren({})
    setExpandedTreePaths([])
    setTreeError('')
    setTreeLoadingPaths([value.rootDir])
    void window.electronAPI.fs.listWorkspaceCleanupChildren({ rootDir: value.rootDir, activePaths }).then((result) => {
      if (cancelled) return
      if (result.success) setTreeChildren({ [value.rootDir]: result.nodes })
      else setTreeError(result.error || '工作区目录读取失败。')
    }).finally(() => {
      if (!cancelled) setTreeLoadingPaths([])
    })
    return () => { cancelled = true }
  }, [activePaths, cleanupOpened, value.rootDir])

  const selectRoot = async () => {
    const path = await window.electronAPI.dialog.selectFolder()
    if (path) onChange((current) => ({ ...current, rootDir: path }))
  }

  const updatePreset = (id: string, partial: Partial<WorkspaceFolderPreset>) => {
    onChange((current) => ({
      ...current,
      folderPresets: current.folderPresets.map((preset) => preset.id === id ? { ...preset, ...partial } : preset),
    }))
  }

  const movePreset = (index: number, offset: number) => {
    onChange((current) => {
      const next = [...current.folderPresets]
      const target = index + offset
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...current, folderPresets: next }
    })
  }

  const addCleanupTarget = async () => {
    const path = await window.electronAPI.dialog.selectFolder()
    if (!path) return
    addCleanupTargetPath(path)
  }

  const addCleanupTargetPath = (path: string) => {
    setCleanupTargets((current) => {
      if (current.some((item) => isSameOrInsidePath(item, path))) return current
      return [...current.filter((item) => !isSameOrInsidePath(path, item)), path]
    })
    setCleanupScan(null)
  }

  const removeCleanupTargetPath = (path: string) => {
    setCleanupTargets((current) => current.filter((item) => normalizePathKey(item) !== normalizePathKey(path)))
    setCleanupScan(null)
  }

  const toggleTreeExpanded = async (node: WorkspaceCleanupTreeNode) => {
    if (!node.hasChildren) return
    if (expandedTreePaths.includes(node.path)) {
      setExpandedTreePaths((current) => current.filter((path) => path !== node.path))
      return
    }
    if (!treeChildren[node.path]) {
      setTreeLoadingPaths((current) => [...current, node.path])
      setTreeError('')
      try {
        const result = await window.electronAPI.fs.listWorkspaceCleanupChildren({
          rootDir: value.rootDir,
          parentPath: node.path,
          activePaths,
        })
        if (!result.success) {
          setTreeError(result.error || '目录读取失败。')
          return
        }
        setTreeChildren((current) => ({ ...current, [node.path]: result.nodes }))
      } finally {
        setTreeLoadingPaths((current) => current.filter((path) => path !== node.path))
      }
    }
    setExpandedTreePaths((current) => current.includes(node.path) ? current : [...current, node.path])
  }

  const selectCleanupScope = async () => {
    const path = await window.electronAPI.dialog.selectFolder()
    if (path) {
      setCleanupScopePath(path)
      setCleanupScan(null)
    }
  }

  const discoverPresetTargets = async () => {
    if (!cleanupScopePath || !cleanupPresetIds.length) return
    const presetSuffixes = enabledCleanupPresets
      .filter((preset) => cleanupPresetIds.includes(preset.id))
      .map((preset) => preset.suffix)
    setCleanupBusy(true)
    try {
      const result = await window.electronAPI.fs.discoverWorkspaceCleanupTargets({
        rootDir: value.rootDir,
        scopePath: cleanupScopePath,
        presetSuffixes,
        activePaths,
      })
      if (!result.success) {
        notify('red', '查找失败', result.error)
        return
      }
      setCleanupTargets(result.targetPaths)
      setCleanupScan(null)
      if (result.targetPaths.length) {
        notify('green', '已找到可清理目录', `${result.targetPaths.length} 个目录${result.blockedPaths.length ? `，另有 ${result.blockedPaths.length} 个正在使用，已跳过` : ''}`)
      } else {
        notify('orange', '没有匹配目录', result.blockedPaths.length ? `${result.blockedPaths.length} 个匹配目录正在使用，未加入清理范围。` : '所选范围内没有对应的生成目录。')
      }
    } finally {
      setCleanupBusy(false)
    }
  }

  const scanCleanup = async () => {
    if (!value.rootDir || !cleanupTargets.length) return
    setCleanupBusy(true)
    const scanId = `cleanup-${Date.now()}-${Math.random().toString(36).slice(2)}`
    cleanupScanIdRef.current = scanId
    try {
      const result = await window.electronAPI.fs.scanWorkspaceCleanup({ scanId, rootDir: value.rootDir, targetPaths: cleanupTargets, activePaths })
      setCleanupScan(result)
      if (!result.success && result.error !== '扫描已取消。') notify('red', '扫描失败', result.error)
      else if (!result.entries.length) notify('orange', '没有可清理目录', '所选目录不在工作区内、正在使用或属于受保护层级。')
    } finally {
      if (cleanupScanIdRef.current === scanId) cleanupScanIdRef.current = ''
      setCleanupBusy(false)
    }
  }

  const cancelCleanupScan = async () => {
    const scanId = cleanupScanIdRef.current
    if (scanId) await window.electronAPI.fs.cancelWorkspaceCleanupScan(scanId)
  }

  const executeCleanup = async () => {
    if (!cleanupScan?.entries.length) return
    setCleanupBusy(true)
    try {
      const request = { rootDir: value.rootDir, targetPaths: cleanupScan.entries.map((entry) => entry.path), activePaths, removeEmptyParents }
      const result = cleanupMode === 'trash'
        ? await window.electronAPI.fs.trashWorkspacePaths(request)
        : await window.electronAPI.fs.deleteWorkspacePaths(request)
      if (result.success) {
        notify('green', cleanupMode === 'trash' ? '已移到回收站' : '已永久删除', `${result.removedPaths.length} 个目录`)
        setCleanupTargets([])
        setCleanupScan(null)
        setConfirmOpened(false)
        setPermanentPhrase('')
        const nextHistory: CleanupHistoryEntry[] = [{
          id: Date.now(),
          timestamp: Date.now(),
          mode: cleanupMode,
          paths: [...result.removedPaths],
          totalBytes: cleanupScan.totalBytes,
          totalFiles: cleanupScan.totalFiles,
        }, ...cleanupHistory].slice(0, 100)
        setCleanupHistory(nextHistory)
        await window.electronAPI.store.set('cleanupHistory', nextHistory)
        window.dispatchEvent(new CustomEvent('workspace-cleaned', { detail: { paths: result.removedPaths, timestamp: Date.now() } }))
      } else {
        notify('red', '清理未完成', result.error || '请重新扫描后再试。')
      }
    } finally {
      setCleanupBusy(false)
    }
  }

  const renderCleanupTreeNodes = (parentPath: string, depth = 0): React.ReactNode => (
    (treeChildren[parentPath] || []).map((node) => {
      const expanded = expandedTreePaths.includes(node.path)
      const loading = treeLoadingPaths.includes(node.path)
      const exactSelected = cleanupTargets.some((path) => normalizePathKey(path) === normalizePathKey(node.path))
      const selectedByParent = cleanupTargets.some((path) => normalizePathKey(path) !== normalizePathKey(node.path) && isSameOrInsidePath(path, node.path))
      const canSetScope = ['month', 'date', 'game'].includes(node.level)
      return (
        <React.Fragment key={node.path}>
          <Group className="cleanup-tree-row" gap={4} wrap="nowrap" pl={Math.min(depth, 6) * 16}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              loading={loading}
              disabled={!node.hasChildren}
              onClick={() => void toggleTreeExpanded(node)}
              aria-label={expanded ? `收起${node.name}` : `展开${node.name}`}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </ActionIcon>
            {node.selectable ? (
              <Checkbox
                size="xs"
                checked={exactSelected || selectedByParent}
                disabled={selectedByParent}
                onChange={(event) => event.currentTarget.checked ? addCleanupTargetPath(node.path) : removeCleanupTargetPath(node.path)}
                aria-label={`选择${node.name}`}
              />
            ) : <Box w={20} />}
            <Folder size={15} color={node.level === 'media' ? 'var(--mantine-color-violet-filled)' : 'var(--mantine-color-blue-filled)'} />
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text size="xs" fw={node.selectable ? 750 : 600} truncate title={node.path}>{node.name}</Text>
            </Box>
            {node.protectedReason && <Badge size="xs" variant="light" color={node.protectedReason.includes('正在使用') ? 'orange' : 'gray'} title={node.protectedReason}>{node.protectedReason.includes('正在使用') ? '使用中' : '仅展开'}</Badge>}
            {canSetScope && <Button size="compact-xs" variant={cleanupScopePath === node.path ? 'filled' : 'subtle'} onClick={() => { setCleanupScopePath(node.path); setCleanupScan(null) }}>筛选范围</Button>}
          </Group>
          {expanded && renderCleanupTreeNodes(node.path, depth + 1)}
        </React.Fragment>
      )
    })
  )

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text fw={800}>工作区</Text>
            <Text size="xs" c="dimmed" mb={8}>自动创建的年月日、图片/视频和游戏目录都会放在这里，重启和升级后保留。</Text>
            <TextInput value={value.rootDir} readOnly placeholder="尚未选择工作区" leftSection={<HardDrive size={15} />} />
          </Box>
          <Button leftSection={<FolderOpen size={16} />} onClick={() => void selectRoot()}>选择工作区</Button>
        </Group>
      </Card>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" mb="sm">
          <Box>
            <Text fw={800}>游戏内固定目录</Text>
            <Text size="xs" c="dimmed">实际名称为“游戏名-后缀”；后缀只能是一层文件夹名称。</Text>
          </Box>
          <Group gap={6}>
            <Button size="xs" variant="light" leftSection={<FolderPlus size={14} />} onClick={() => onChange((current) => ({ ...current, folderPresets: [...current.folderPresets, makeCustomPreset(current.folderPresets.length + 1)] }))}>添加</Button>
            <Button size="xs" variant="default" leftSection={<RotateCcw size={14} />} onClick={() => onChange((current) => ({ ...current, folderPresets: DEFAULT_WORKSPACE_FOLDER_PRESETS.map((preset) => ({ ...preset, mediaKinds: [...preset.mediaKinds] })) }))}>恢复默认</Button>
          </Group>
        </Group>
        {invalidPresetCount > 0 && <Alert color="red" mb="sm">有 {invalidPresetCount} 个目录名称无效，自动创建时会跳过。</Alert>}
        <Stack gap={8}>
          {value.folderPresets.map((preset, index) => (
            <Card key={preset.id} withBorder radius="sm" p="sm">
              <Group wrap="nowrap" align="flex-end">
                <Checkbox checked={preset.enabled} onChange={(event) => updatePreset(preset.id, { enabled: event.currentTarget.checked })} aria-label={`启用${preset.label}`} mb={9} />
                <TextInput label="显示名称" value={preset.label} onChange={(event) => updatePreset(preset.id, { label: event.currentTarget.value })} style={{ flex: .8 }} />
                <TextInput label="文件夹后缀" value={preset.suffix} error={!isValidSuffix(preset.suffix)} onChange={(event) => updatePreset(preset.id, { suffix: event.currentTarget.value })} style={{ flex: 1 }} />
                <Checkbox.Group value={preset.mediaKinds} onChange={(mediaKinds) => updatePreset(preset.id, { mediaKinds: mediaKinds as Array<'image' | 'video'> })}>
                  <Group gap={8} mb={9} wrap="nowrap"><Checkbox value="image" label="图片" /><Checkbox value="video" label="视频" /></Group>
                </Checkbox.Group>
                <Group gap={2} mb={5} wrap="nowrap">
                  <ActionIcon variant="subtle" disabled={index === 0} onClick={() => movePreset(index, -1)} aria-label="上移"><ArrowUp size={15} /></ActionIcon>
                  <ActionIcon variant="subtle" disabled={index === value.folderPresets.length - 1} onClick={() => movePreset(index, 1)} aria-label="下移"><ArrowDown size={15} /></ActionIcon>
                  {!preset.builtIn && <ActionIcon variant="subtle" color="red" onClick={() => onChange((current) => ({ ...current, folderPresets: current.folderPresets.filter((item) => item.id !== preset.id) }))} aria-label="删除"><Trash2 size={15} /></ActionIcon>}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Card>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" wrap="nowrap">
          <Box>
            <Text fw={800}>素材清理</Text>
            <Text size="xs" c="dimmed">可清理固定生成目录、整个游戏、日期或月份；年份和工作区不会被删除。</Text>
          </Box>
          <Button color="red" variant="light" leftSection={<Trash2 size={16} />} disabled={!value.rootDir} onClick={() => setCleanupOpened(true)}>打开清理工具</Button>
        </Group>
      </Card>

      <Modal opened={cleanupOpened} onClose={() => setCleanupOpened(false)} centered size="calc(100vw - 32px)" title="工作区素材清理" className="focus-modal">
        <ScrollArea h="min(74vh, 440px)" type="auto" offsetScrollbars>
        <Stack gap="md" pr={6}>
          <Alert color="blue" title="先扫描，后确认">只允许选择工作区内的月份、日期、游戏或更深层目录。扫描不会删除任何内容。</Alert>
          <Card withBorder p="sm">
            <Group justify="space-between" mb={6} wrap="nowrap">
              <Box>
                <Text size="sm" fw={800}>浏览并勾选工作区目录</Text>
                <Text size="xs" c="dimmed">逐层展开，不会一次加载整个月份；勾选上层时会自动合并下层重复目标。</Text>
              </Box>
              <Badge variant="light">已选 {cleanupTargets.length}</Badge>
            </Group>
            {treeError && <Alert color="red" py={5} mb={6}>{treeError}</Alert>}
            <ScrollArea h="min(32vh, 220px)" type="auto" offsetScrollbars>
              <Stack gap={2} className="cleanup-tree-list">
                {treeLoadingPaths.includes(value.rootDir) && <Text size="xs" c="dimmed" ta="center" py="md">正在读取工作区…</Text>}
                {renderCleanupTreeNodes(value.rootDir)}
                {!treeLoadingPaths.length && !treeError && !(treeChildren[value.rootDir] || []).length && <Text size="xs" c="dimmed" ta="center" py="md">工作区内还没有可展开的目录。</Text>}
              </Stack>
            </ScrollArea>
          </Card>
          <Card withBorder p="sm">
            <Text size="sm" fw={800}>按月份或日期清理指定生成目录</Text>
            <Text size="xs" c="dimmed" mb={8}>在上方给月份、日期或游戏设置“筛选范围”，再批量查找奇觅生成等固定目录。</Text>
            <Group gap={6} wrap="nowrap" mb={8}>
              <Button size="xs" variant="default" leftSection={<FolderOpen size={14} />} onClick={() => void selectCleanupScope()}>从系统选择</Button>
              <Text size="xs" c={cleanupScopePath ? undefined : 'dimmed'} truncate>{cleanupScopePath || '尚未选择范围'}</Text>
            </Group>
            <Checkbox.Group value={cleanupPresetIds} onChange={setCleanupPresetIds}>
              <Group gap={10} mb={8}>
                {enabledCleanupPresets.map((preset) => <Checkbox key={preset.id} value={preset.id} label={preset.label} />)}
              </Group>
            </Checkbox.Group>
            <Button size="xs" leftSection={<Search size={14} />} loading={cleanupBusy} disabled={!cleanupScopePath || !cleanupPresetIds.length} onClick={() => void discoverPresetTargets()}>查找匹配目录</Button>
          </Card>
          <Divider label="扫描已勾选目录" labelPosition="center" />
          <Group>
            <Button leftSection={<FolderPlus size={16} />} variant="default" onClick={() => void addCleanupTarget()}>从系统添加</Button>
            <Button leftSection={<Search size={16} />} disabled={!cleanupTargets.length || cleanupBusy} onClick={() => void scanCleanup()}>扫描所选目录</Button>
            {cleanupBusy && <Button variant="light" color="orange" onClick={() => void cancelCleanupScan()}>取消扫描</Button>}
          </Group>
          <ScrollArea h="min(30vh, 240px)" type="auto">
            <Stack gap={8} className="cleanup-target-list">
              {cleanupTargets.map((path) => {
                const entry = cleanupScan?.entries.find((item) => item.path === path)
                const blocked = cleanupScan?.blockedPaths?.includes(path)
                return (
                  <Card key={path} withBorder p="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Text size="sm" fw={750} truncate>{path}</Text>
                        <Text size="xs" c={blocked ? 'red' : 'dimmed'}>{blocked ? '受保护或不在工作区内' : entry ? `${entry.fileCount} 个文件 · ${formatBytes(entry.bytes)}` : '等待扫描'}</Text>
                      </Box>
                      <ActionIcon color="red" variant="subtle" aria-label={`移除${path}`} onClick={() => removeCleanupTargetPath(path)}><Trash2 size={16} /></ActionIcon>
                    </Group>
                  </Card>
                )
              })}
              {!cleanupTargets.length && <Text ta="center" c="dimmed" py="xl">添加需要清理的月份、日期、游戏或生成目录。</Text>}
            </Stack>
          </ScrollArea>
          {cleanupScan?.success && (
            <Group justify="space-between">
              <Group gap={8}><Badge>{cleanupScan.entries.length} 个目录</Badge><Badge color="gray">{cleanupScan.totalFiles} 个文件</Badge><Badge color="orange">{formatBytes(cleanupScan.totalBytes)}</Badge></Group>
              <Button color="red" disabled={!cleanupScan.entries.length} onClick={() => { setCleanupOpened(false); setConfirmOpened(true) }}>确认清理</Button>
            </Group>
          )}
          {cleanupHistory.length > 0 && <Box><Group justify="space-between" mb={5}><Text size="xs" fw={800} c="dimmed">最近清理报告（保留 {value.cleanupReportRetentionDays} 天）</Text><Button size="compact-xs" variant="subtle" onClick={() => { setCleanupOpened(false); setCleanupHistoryOpened(true) }}>查看全部</Button></Group><Stack gap={4}>{cleanupHistory.slice(0, 3).map((entry) => <Paper key={entry.id} withBorder p={6}><Group justify="space-between" wrap="nowrap"><Text size="xs" truncate>{new Date(entry.timestamp).toLocaleString()} · {entry.paths.length} 个目录</Text><Text size="xs" c="dimmed">{entry.totalFiles} 文件 · {formatBytes(entry.totalBytes)}</Text></Group></Paper>)}</Stack></Box>}
        </Stack>
        </ScrollArea>
      </Modal>

      <Modal opened={cleanupHistoryOpened} onClose={() => { setCleanupHistoryOpened(false); setCleanupOpened(true) }} centered size="calc(100vw - 32px)" title="清理历史" className="focus-modal">
        <Stack gap="sm">
          <Text size="xs" c="dimmed">记录保留 {value.cleanupReportRetentionDays} 天；这里只显示操作记录，不会再次删除文件。</Text>
          <ScrollArea h="min(62vh, 440px)" type="auto">
            <Stack gap={8} className="cleanup-history-list">
              {cleanupHistory.map((entry) => <Card key={entry.id} withBorder p="sm"><Group justify="space-between" align="flex-start" wrap="nowrap"><Box style={{ minWidth: 0 }}><Text size="sm" fw={750}>{new Date(entry.timestamp).toLocaleString()}</Text><Text size="xs" c="dimmed">{entry.mode === 'trash' ? '移到回收站' : '永久删除'} · {entry.paths.length} 个目录 · {entry.totalFiles} 个文件 · {formatBytes(entry.totalBytes)}</Text>{entry.paths.map((path) => <Text key={path} size="10px" c="dimmed" truncate>{path}</Text>)}</Box><Badge color={entry.mode === 'trash' ? 'blue' : 'red'}>{entry.mode === 'trash' ? '可从回收站恢复' : '不可恢复'}</Badge></Group></Card>)}
            </Stack>
          </ScrollArea>
          <Group justify="flex-end"><Button onClick={() => { setCleanupHistoryOpened(false); setCleanupOpened(true) }}>返回清理工具</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={confirmOpened} onClose={() => { setConfirmOpened(false); setCleanupOpened(true) }} centered title="确认清理范围">
        <Stack>
          <Text size="sm">将处理 {cleanupScan?.entries.length || 0} 个目录、{cleanupScan?.totalFiles || 0} 个文件，共 {formatBytes(cleanupScan?.totalBytes || 0)}。</Text>
          <Radio.Group value={cleanupMode} onChange={(mode) => setCleanupMode(mode as 'trash' | 'permanent')}>
            <Stack gap="xs"><Radio value="trash" label="移动到 Windows 回收站（推荐）" /><Radio value="permanent" color="red" label="永久删除（无法恢复）" /></Stack>
          </Radio.Group>
          <Checkbox checked={removeEmptyParents} onChange={(event) => setRemoveEmptyParents(event.currentTarget.checked)} label="同时移除清理后留下的空图片／视频、日期、月份和年份文件夹" />
          {cleanupMode === 'permanent' && <TextInput label="输入“永久删除”以继续" value={permanentPhrase} onChange={(event) => setPermanentPhrase(event.currentTarget.value)} />}
          <Divider />
          <Group justify="flex-end"><Button variant="default" onClick={() => { setConfirmOpened(false); setCleanupOpened(true) }}>取消</Button><Button color="red" loading={cleanupBusy} disabled={cleanupMode === 'permanent' && permanentPhrase !== '永久删除'} onClick={() => void executeCleanup()}>{cleanupMode === 'trash' ? '移到回收站' : '永久删除'}</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
