import React, { useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FileImage,
  FileVideo,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import {
  addRenamePreset,
  cloneRenamePreset,
  createCustomPreset,
  createRenameToken,
  deleteRenamePreset,
  filterRenamePresets,
  formatRenameProducer,
  migrateLegacyRenameTemplates,
  moveRenameToken,
  renameRenamePreset,
  renderRenameRule,
  RENAME_TOKEN_OPTIONS,
  validateRenamePreset,
  validateRenameSettings,
  type RenameMediaType,
  type RenamePreset,
  type RenameRule,
  type RenameSettingsV2,
  type RenameTokenType,
} from '../../../shared/renameTemplates.ts'

interface RenameTemplateSettingsProps {
  settings: RenameSettingsV2
  onChange: (settings: RenameSettingsV2) => void
  producerName: string
  saveState: 'idle' | 'saving' | 'saved' | 'error'
}

const kindPresentation = {
  regular: { label: '系统常规', color: 'blue', icon: <WandSparkles size={16} /> },
  special: { label: '系统特殊', color: 'orange', icon: <Sparkles size={16} /> },
  custom: { label: '自定义', color: 'violet', icon: <WandSparkles size={16} /> },
} as const

const dateOptions = [
  { label: '20260714', value: 'YYYYMMDD' },
  { label: '2026-07-14', value: 'YYYY-MM-DD' },
  { label: '0714', value: 'MMDD' },
]

function updatePresetInSettings(
  settings: RenameSettingsV2,
  presetId: string,
  updater: (preset: RenamePreset) => RenamePreset,
): RenameSettingsV2 {
  return {
    ...settings,
    presets: settings.presets.map((preset) => preset.id === presetId ? updater(preset) : preset),
  }
}

function PresetListItem({
  preset,
  selected,
  onSelect,
}: {
  preset: RenamePreset
  selected: boolean
  onSelect: () => void
}) {
  const presentation = kindPresentation[preset.kind]
  return (
    <Button
      variant={selected ? 'light' : 'subtle'}
      color={presentation.color}
      fullWidth
      justify="flex-start"
      leftSection={<ThemeIcon size={30} radius={8} color={presentation.color} variant={selected ? 'filled' : 'light'}>{presentation.icon}</ThemeIcon>}
      onClick={onSelect}
      styles={{
        root: {
          height: 58,
          paddingInline: 10,
          border: selected ? `1px solid var(--mantine-color-${presentation.color}-outlined)` : '1px solid transparent',
        },
        inner: { justifyContent: 'flex-start' },
        label: { width: '100%', overflow: 'hidden' },
      }}
    >
      <Box style={{ minWidth: 0, textAlign: 'left' }}>
        <Text fw={850} truncate c="var(--mantine-color-text)">{preset.name}</Text>
        <Text size="xs" c="dimmed">{presentation.label} · 图片 / 视频</Text>
      </Box>
    </Button>
  )
}

export function RenameTemplateSettings({
  settings,
  onChange,
  producerName,
  saveState,
}: RenameTemplateSettingsProps) {
  const [query, setQuery] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState(
    settings.lastCustomPresetId || settings.presets[0]?.id || '',
  )
  const [mediaType, setMediaType] = useState<RenameMediaType>('image')

  const filteredPresets = useMemo(
    () => filterRenamePresets(settings.presets, query),
    [settings.presets, query],
  )
  const selectedPreset = settings.presets.find((preset) => preset.id === selectedPresetId)
    || settings.presets[0]
  const selectedRule = selectedPreset?.rules[mediaType]
  const presetErrors = selectedPreset ? validateRenamePreset(selectedPreset) : ['没有可编辑的模板']
  const settingsErrors = validateRenameSettings(settings)

  const sample = selectedRule ? renderRenameRule(selectedRule, {
    ProjectName: '夏日活动',
    CleanProjectName: '夏日活动',
    Date: new Date(2026, 6, 14),
    Producer: formatRenameProducer(producerName) || 'MXW',
    Resolution: '1080x1920',
    AspectRatio: '竖',
    OriginalName: '素材原名',
  }, selectedRule.sequence.start) : null

  const updateSelectedPreset = (updater: (preset: RenamePreset) => RenamePreset) => {
    if (!selectedPreset) return
    onChange(updatePresetInSettings(settings, selectedPreset.id, updater))
  }

  const updateRule = (updater: (rule: RenameRule) => RenameRule) => {
    updateSelectedPreset((preset) => ({
      ...preset,
      rules: { ...preset.rules, [mediaType]: updater(preset.rules[mediaType]) },
    }))
  }

  const addPreset = () => {
    const preset = createCustomPreset(`自定义模板 ${settings.presets.filter((item) => item.kind === 'custom').length + 1}`)
    onChange(addRenamePreset(settings, preset))
    setSelectedPresetId(preset.id)
  }

  const duplicatePreset = () => {
    if (!selectedPreset) return
    const preset = cloneRenamePreset(selectedPreset)
    onChange(addRenamePreset(settings, preset))
    setSelectedPresetId(preset.id)
  }

  const deletePreset = () => {
    if (!selectedPreset || selectedPreset.kind !== 'custom') return
    const nextSettings = deleteRenamePreset(settings, selectedPreset.id)
    const nextSelected = nextSettings.presets.find((preset) => preset.kind === 'custom') || nextSettings.presets[0]
    onChange(nextSettings)
    setSelectedPresetId(nextSelected?.id || '')
  }

  const restoreSystemPreset = () => {
    if (!selectedPreset || selectedPreset.kind === 'custom') return
    const defaults = migrateLegacyRenameTemplates()
    const replacement = defaults.presets.find((preset) => preset.kind === selectedPreset.kind)
    if (!replacement) return
    updateSelectedPreset((preset) => ({ ...replacement, id: preset.id }))
  }

  if (!selectedPreset || !selectedRule) {
    return <Alert color="red" title="模板不可用">请新建一个命名模板后继续。</Alert>
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={4}>命名模板库</Title>
          <Text size="sm" c="dimmed" mt={4}>具名模板会直接出现在日常页面，预览与实际改名使用同一规则。</Text>
        </Box>
        <Badge
          color={saveState === 'error' ? 'red' : saveState === 'saving' ? 'yellow' : 'teal'}
          variant="light"
          size="lg"
        >
          {saveState === 'error' ? '保存失败' : saveState === 'saving' ? '正在保存' : saveState === 'saved' ? '已保存' : '等待编辑'}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder radius="md" p="md" style={{ alignSelf: 'start' }}>
          <Stack gap="sm">
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="按名称或类型查找"
              leftSection={<Search size={16} />}
              aria-label="查找命名模板"
            />

            <Stack gap={4}>
              {filteredPresets.filter((preset) => preset.kind !== 'custom').length > 0 && (
                <Text size="xs" fw={900} c="dimmed" tt="uppercase" mt={4}>系统模板</Text>
              )}
              {filteredPresets.filter((preset) => preset.kind !== 'custom').map((preset) => (
                <PresetListItem
                  key={preset.id}
                  preset={preset}
                  selected={preset.id === selectedPreset.id}
                  onSelect={() => setSelectedPresetId(preset.id)}
                />
              ))}
              {filteredPresets.filter((preset) => preset.kind === 'custom').length > 0 && (
                <Text size="xs" fw={900} c="dimmed" tt="uppercase" mt="sm">自定义模板</Text>
              )}
              {filteredPresets.filter((preset) => preset.kind === 'custom').map((preset) => (
                <PresetListItem
                  key={preset.id}
                  preset={preset}
                  selected={preset.id === selectedPreset.id}
                  onSelect={() => setSelectedPresetId(preset.id)}
                />
              ))}
              {filteredPresets.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="lg">没有匹配的模板</Text>
              )}
            </Stack>

            <Divider />
            <Group grow>
              <Button variant="light" leftSection={<Plus size={16} />} onClick={addPreset}>新建</Button>
              <Button variant="default" leftSection={<Copy size={16} />} onClick={duplicatePreset}>复制</Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="lg">
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                label="模板名称"
                description={selectedPreset.kind === 'custom' ? '用于团队查找和日常页面选择' : '系统模板名称固定'}
                value={selectedPreset.name}
                disabled={selectedPreset.kind !== 'custom'}
                onChange={(event) => onChange(renameRenamePreset(settings, selectedPreset.id, event.currentTarget.value))}
                error={settingsErrors.find((error) => error.includes('模板名称'))}
                style={{ flex: 1 }}
              />
              <Badge color={kindPresentation[selectedPreset.kind].color} variant="light" size="lg" mb={5}>
                {kindPresentation[selectedPreset.kind].label}
              </Badge>
            </Group>

            <SegmentedControl
              fullWidth
              value={mediaType}
              onChange={(value) => setMediaType(value as RenameMediaType)}
              data={[
                { label: <Group gap={7} justify="center"><FileImage size={16} />图片规则</Group>, value: 'image' },
                { label: <Group gap={7} justify="center"><FileVideo size={16} />视频规则</Group>, value: 'video' },
              ]}
            />

            <Box>
              <Group justify="space-between" mb="xs">
                <Box>
                  <Text fw={900}>命名字段</Text>
                  <Text size="xs" c="dimmed">字段从左到右组成文件名；箭头可调整顺序。</Text>
                </Box>
                <Badge variant="outline" color={mediaType === 'image' ? 'cyan' : 'indigo'}>
                  {mediaType === 'image' ? '图片' : '视频'}
                </Badge>
              </Group>
              <Stack gap="xs">
                {selectedRule.tokens.map((token, index) => (
                  <Paper key={token.id} withBorder radius="sm" p="xs">
                    <Group wrap="nowrap" align="center">
                      <Badge variant="light" color="gray">{index + 1}</Badge>
                      <Select
                        aria-label={`字段 ${index + 1} 类型`}
                        data={RENAME_TOKEN_OPTIONS}
                        value={token.type}
                        onChange={(value) => {
                          if (!value) return
                          updateRule((rule) => ({
                            ...rule,
                            tokens: rule.tokens.map((item) => item.id === token.id
                              ? { ...item, type: value as RenameTokenType, value: value === 'CustomText' ? (item.value || '') : undefined }
                              : item),
                          }))
                        }}
                        style={{ flex: 1, minWidth: 100 }}
                      />
                      <Group gap={2} wrap="nowrap">
                        <Tooltip label="向前移动">
                          <ActionIcon variant="subtle" disabled={index === 0} onClick={() => updateRule((rule) => moveRenameToken(rule, token.id, -1))}>
                            <ArrowLeft size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="向后移动">
                          <ActionIcon variant="subtle" disabled={index === selectedRule.tokens.length - 1} onClick={() => updateRule((rule) => moveRenameToken(rule, token.id, 1))}>
                            <ArrowRight size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="删除字段">
                          <ActionIcon color="red" variant="subtle" onClick={() => updateRule((rule) => ({ ...rule, tokens: rule.tokens.filter((item) => item.id !== token.id) }))}>
                            <Trash2 size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                    {token.type === 'CustomText' && (
                      <TextInput
                        mt="xs"
                        aria-label={`字段 ${index + 1} 自定义文本`}
                        placeholder="输入必须出现在文件名中的文字"
                        value={token.value || ''}
                        onChange={(event) => updateRule((rule) => ({
                          ...rule,
                          tokens: rule.tokens.map((item) => item.id === token.id ? { ...item, value: event.currentTarget.value } : item),
                        }))}
                        error={!token.value?.trim() ? '不能为空' : undefined}
                      />
                    )}
                  </Paper>
                ))}
                <Button
                  variant="light"
                  leftSection={<Plus size={16} />}
                  onClick={() => updateRule((rule) => ({ ...rule, tokens: [...rule.tokens, createRenameToken()] }))}
                >
                  添加字段
                </Button>
              </Stack>
            </Box>

            <Divider label="格式细节" labelPosition="left" />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="字段连接符"
                value={selectedRule.separator}
                placeholder="例如 - 或 _"
                onChange={(event) => updateRule((rule) => ({ ...rule, separator: event.currentTarget.value }))}
              />
              <Select
                label="日期格式"
                data={dateOptions}
                value={selectedRule.dateFormat}
                onChange={(value) => value && updateRule((rule) => ({ ...rule, dateFormat: value as RenameRule['dateFormat'] }))}
              />
              <NumberInput
                label="序号起点"
                min={0}
                step={1}
                value={selectedRule.sequence.start}
                onChange={(value) => updateRule((rule) => ({ ...rule, sequence: { ...rule.sequence, start: Number(value) || 0 } }))}
              />
              <NumberInput
                label="序号补零位数"
                min={0}
                max={6}
                value={selectedRule.sequence.padding}
                onChange={(value) => updateRule((rule) => ({ ...rule, sequence: { ...rule.sequence, padding: Number(value) || 0 } }))}
              />
              <TextInput
                label="序号前缀"
                value={selectedRule.sequence.prefix}
                placeholder="例如 ("
                onChange={(event) => updateRule((rule) => ({ ...rule, sequence: { ...rule.sequence, prefix: event.currentTarget.value } }))}
              />
              <TextInput
                label="序号后缀"
                value={selectedRule.sequence.suffix}
                placeholder="例如 )"
                onChange={(event) => updateRule((rule) => ({ ...rule, sequence: { ...rule.sequence, suffix: event.currentTarget.value } }))}
              />
            </SimpleGrid>

            <Paper withBorder radius="md" p="md" bg="var(--mantine-color-default)">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ minWidth: 0 }}>
                  <Text size="xs" fw={900} c="dimmed" tt="uppercase">实时样例</Text>
                  <Text fw={900} mt={6} style={{ overflowWrap: 'anywhere' }}>
                    {sample?.ok ? `${sample.value}.${mediaType === 'image' ? 'jpg' : 'mp4'}` : '暂时无法生成'}
                  </Text>
                  {!sample?.ok && <Text size="sm" c="red" mt={4}>{sample?.error}</Text>}
                </Box>
                <Badge color={sample?.ok ? 'teal' : 'red'} variant="light">{sample?.ok ? '规则有效' : '需要修正'}</Badge>
              </Group>
            </Paper>

            {presetErrors.length > 0 && (
              <Alert color="red" title="当前模板不能执行">
                {presetErrors.join('；')}
              </Alert>
            )}

            <Divider />
            <Group justify="flex-start">
              {selectedPreset.kind !== 'custom' ? (
                <Button variant="default" leftSection={<RotateCcw size={16} />} onClick={restoreSystemPreset}>恢复系统默认</Button>
              ) : (
                <Button color="red" variant="light" leftSection={<Trash2 size={16} />} onClick={deletePreset}>删除此模板</Button>
              )}
              <Text size="xs" c="dimmed">修改会自动保存，并立即用于本次页面预检。</Text>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
