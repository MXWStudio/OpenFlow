import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Group,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  ActionIcon,
  ScrollArea,
  Menu,
} from '@mantine/core';
import { notify } from '../utils/notify';
import { Upload, Trash2, Save, BarChart3, TableProperties, ExternalLink, MoreVertical, FileSpreadsheet, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface ImportRecord {
  id: number;
  batch_id: string;
  row_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Editable Cell Component
const EditableCell = ({ getValue, row, column, table }: any) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      table.options.meta?.updateData(row.index, column.id, value);
    }
  };

  if (isEditing) {
    return (
      <TextInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        autoFocus
        size="xs"
      />
    );
  }

  return (
    <div onDoubleClick={() => setIsEditing(true)} style={{ minHeight: '24px', cursor: 'pointer' }}>
      {value?.toString() || ''}
    </div>
  );
};

interface ExcelFileRecord {
  id: number;
  batch_id: string;
  file_name: string;
  saved_path: string;
  created_at: string;
}

export function BitableWorkspace() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('table');
  const [data, setData] = useState<ImportRecord[]>([]);
  const [fileList, setFileList] = useState<ExcelFileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dashboard configuration
  const [xAxisField, setXAxisField] = useState<string | null>(null);
  const [yAxisField, setYAxisField] = useState<string | null>(null);
  const [categoryField, setCategoryField] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.fs.cleanupOldExcels();
      loadFileRecords();
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedBatch]);

  async function loadFileRecords() {
    if (!window.electronAPI) return;
    try {
      const files = await window.electronAPI.db.getExcelFiles();
      setFileList(files);
      if (files.length > 0 && !selectedBatch) {
        setSelectedBatch(files[0].batch_id);
      } else if (files.length === 0) {
        setSelectedBatch(null);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function loadData() {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const records = await window.electronAPI.db.getImportedData(selectedBatch || undefined);
      setData(records);

      // Auto-select fields for dashboard if not set
      if (records.length > 0 && !xAxisField && !yAxisField) {
        const keys = Object.keys(records[0].row_data);
        if (keys.length > 0) setXAxisField(keys[0]);
        if (keys.length > 1) {
          const numericKey = keys.find(k => typeof records[0].row_data[k] === 'number' || !isNaN(Number(records[0].row_data[k])));
          if (numericKey) setYAxisField(numericKey);
          else setYAxisField(keys[1]);
        }
        if (keys.length > 2) {
           const strKey = keys.find(k => typeof records[0].row_data[k] === 'string' && k !== keys[0]);
           if(strKey) setCategoryField(strKey);
        }
      }
    } catch (error) {
      console.error(error);
      notify('red', '加载失败', '无法读取数据库记录。');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    try {
      const result = await window.electronAPI.dialog.importExcel();
      if (!result) return;

      const { fileName, data: excelData, savedPath } = result;
      const batchId = `${fileName}_${Date.now()}`;

      setLoading(true);

      // Save file record
      await window.electronAPI.db.insertExcelFile({
        batch_id: batchId,
        file_name: fileName,
        saved_path: savedPath || ''
      });

      // Save row data
      for (const row of excelData) {
        await window.electronAPI.db.insertImportedData(batchId, row);
      }
      notify('green', '导入成功', `已导入 ${excelData.length} 条记录。`);

      await loadFileRecords();
      setSelectedBatch(batchId);
    } catch (error) {
      notify('red', '导入失败', error instanceof Error ? error.message : String(error));
      setLoading(false);
    }
  }

  async function handleDeleteFile(file: ExcelFileRecord) {
    if (!confirm(`确定要删除报表 "${file.file_name}" 吗？这会删除相关的数据。`)) return;
    try {
      await window.electronAPI.db.deleteBatch(file.batch_id);
      if (file.id) await window.electronAPI.db.deleteExcelFile(file.id);

      notify('green', '删除成功' );
      if (selectedBatch === file.batch_id) {
        setSelectedBatch(null);
      }
      await loadFileRecords();
    } catch (error) {
      notify('red', '删除失败' );
    }
  }

  async function handleOpenFile(filePath: string) {
    if (!filePath) {
      notify('red', '无法打开', '该记录没有关联的本地文件');
      return;
    }
    const result = await window.electronAPI.shell.openPath(filePath);
    if (result !== 'success') {
      notify('red', '打开失败', result);
    }
  }

  async function handleClearAll() {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
    try {
      await window.electronAPI.db.clearAllImportedData();
      await window.electronAPI.db.clearAllExcelFiles();
      setData([]);
      setFileList([]);
      setSelectedBatch(null);
      notify('green', '已清空所有数据' );
    } catch (error) {
      notify('red', '清空失败' );
    }
  }

  // Filtered data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const lowerQuery = searchQuery.toLowerCase();
    return data.filter(item => {
      // Search across all values in row_data
      return Object.values(item.row_data).some(val =>
        String(val).toLowerCase().includes(lowerQuery)
      );
    });
  }, [data, searchQuery]);

  // --- Table Setup ---
  const dynamicColumns = useMemo(() => {
    if (data.length === 0) return [];

    // Collect all unique keys from row_data across all rows to support varying schemas
    const keys = new Set<string>();
    data.forEach(item => Object.keys(item.row_data).forEach(k => keys.add(k)));

    const colHelper = createColumnHelper<ImportRecord>();
    const cols = Array.from(keys).map(key =>
      colHelper.accessor((row) => row.row_data[key], {
        id: key,
        header: key,
        cell: EditableCell,
      })
    );

    return cols;
  }, [data]);

  const table = useReactTable({
    data: filteredData,
    columns: dynamicColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: async (rowIndex: number, columnId: string, value: any) => {
        const row = filteredData[rowIndex];
        const newRowData = { ...row.row_data, [columnId]: value };

        // Optimistic UI update
        setData(old =>
          old.map((r, index) => {
            if (index === rowIndex) {
              return { ...r, row_data: newRowData };
            }
            return r;
          })
        );

        // Persist to DB
        try {
          await window.electronAPI.db.updateImportedData(row.id, newRowData);
        } catch (error) {
          notify('red', '保存失败' );
          loadData(); // Revert on failure
        }
      },
    },
  });

  // --- Dashboard Data Processing ---
  const availableFields = useMemo(() => {
    const keys = new Set<string>();
    data.forEach(item => Object.keys(item.row_data).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [data]);

  const chartData = useMemo(() => {
    if (!xAxisField || !yAxisField || data.length === 0) return [];

    // Aggregate data by xAxisField
    const aggregated = data.reduce((acc, curr) => {
      const xVal = curr.row_data[xAxisField] || '未知';
      const yVal = Number(curr.row_data[yAxisField]) || 0;

      if (!acc[xVal]) {
        acc[xVal] = { name: xVal, value: 0 };
      }
      acc[xVal].value += yVal;
      return acc;
    }, {} as Record<string, {name: string, value: number}>);

    return Object.values(aggregated);
  }, [data, xAxisField, yAxisField]);

  const pieData = useMemo(() => {
      if (!categoryField || !yAxisField || data.length === 0) return [];

      const aggregated = data.reduce((acc, curr) => {
          const cat = curr.row_data[categoryField] || '未知';
          const yVal = Number(curr.row_data[yAxisField]) || 0;

          if(!acc[cat]){
              acc[cat] = { name: cat, value: 0 };
          }
          acc[cat].value += yVal;
          return acc;
      }, {} as Record<string, {name: string, value: number}>);

      return Object.values(aggregated);
  }, [data, categoryField, yAxisField]);


  return (
    <Flex h="100%" direction="row" bg="var(--mantine-color-body)" gap="md" p="xl" style={{ position: 'relative' }}>
      {!isSidebarOpen && (
        <ActionIcon
          variant="default"
          size="lg"
          radius="md"
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderLeft: 'none',
          }}
          onClick={() => setIsSidebarOpen(true)}
        >
          <ChevronRight size={20} />
        </ActionIcon>
      )}

      {/* Left Panel: File List */}
      {isSidebarOpen && (
        <Card radius="md" p="md" withBorder shadow="sm" style={{ width: '300px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Group justify="space-between" mb="md">
            <Title order={4}>导入历史</Title>
            <ActionIcon variant="subtle" color="gray" onClick={() => setIsSidebarOpen(false)}>
              <ChevronLeft size={20} />
            </ActionIcon>
          </Group>
          <Button fullWidth leftSection={<Upload size={16} />} onClick={handleImport} loading={loading} mb="md">
          导入 Excel 报表
        </Button>
        <ScrollArea style={{ flex: 1 }}>
          <Stack gap="xs">
            {fileList.length === 0 ? (
              <Text c="dimmed" ta="center" mt="xl" size="sm">暂无导入记录</Text>
            ) : (
              fileList.map((file) => (
                <Card
                  key={file.id}
                  p="sm"
                  radius="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedBatch === file.batch_id ? 'var(--mantine-primary-color-filled)' : undefined,
                    backgroundColor: selectedBatch === file.batch_id ? 'var(--mantine-primary-color-light)' : undefined
                  }}
                  onClick={() => setSelectedBatch(file.batch_id)}
                  onDoubleClick={() => handleOpenFile(file.saved_path)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" style={{ overflow: 'hidden', flex: 1 }}>
                      <FileSpreadsheet size={16} color="var(--mantine-color-teal-filled)" />
                      <Text size="sm" truncate fw={500} title={file.file_name}>{file.file_name}</Text>
                    </Group>
                    <Menu position="bottom-end" shadow="sm">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<ExternalLink size={14} />} onClick={(e) => { e.stopPropagation(); handleOpenFile(file.saved_path); }}>
                          打开原文件
                        </Menu.Item>
                        <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}>
                          删除记录
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    {new Date(file.created_at || '').toLocaleString()}
                  </Text>
                </Card>
              ))
            )}
          </Stack>
        </ScrollArea>
        {fileList.length > 0 && (
          <Button variant="light" color="red" fullWidth mt="md" onClick={handleClearAll}>
            清空所有记录
          </Button>
        )}
        </Card>
      )}

      {/* Right Panel: Content Area */}
      <Card radius="md" p={0} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} withBorder shadow="sm">
        <Box p="md" pb={0}>
          <Title order={2} c="var(--mantine-color-text)" mb="md">个人素材产能统计与可视化看板</Title>
        </Box>
        <Tabs value={activeTab} onChange={setActiveTab} style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }}>
          <Tabs.List px="md">
            <Tabs.Tab value="table" leftSection={<TableProperties size={16} />}>
              数据表格
            </Tabs.Tab>
            <Tabs.Tab value="dashboard" leftSection={<BarChart3 size={16} />}>
              可视化看板
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="table" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px' }}>
            {!selectedBatch ? (
              <Flex align="center" justify="center" h="100%">
                <Text c="dimmed">请在左侧选择或导入 Excel 报表</Text>
              </Flex>
            ) : (
              <>
                <Group mb="md">
                  <TextInput
                    placeholder="搜索表格内容..."
                    leftSection={<Search size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    style={{ width: '300px' }}
                  />
                </Group>
                <Box style={{ overflowX: 'auto', flex: 1 }}>
                  <style>
                    {`
                      .no-selection-bg ::selection {
                        background-color: var(--mantine-color-default-hover);
                      }
                      .no-selection-bg *::selection {
                        background-color: var(--mantine-color-default-hover);
                      }
                    `}
                  </style>
                  <Table className="no-selection-bg" striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <Table.Tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <Table.Th key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Thead>
                  <Table.Tbody>
                    {table.getRowModel().rows.length > 0 ? (
                      table.getRowModel().rows.map((row) => (
                        <Table.Tr key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <Table.Td key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </Table.Td>
                          ))}
                        </Table.Tr>
                      ))
                    ) : (
                      <Table.Tr>
                        <Table.Td colSpan={dynamicColumns.length} style={{ textAlign: 'center' }}>
                          暂无匹配数据
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Box>
              </>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="dashboard" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
             {data.length === 0 ? (
                <Flex align="center" justify="center" h="100%">
                    <Text c="dimmed">暂无数据可供分析</Text>
                </Flex>
             ) : (
                 <Stack gap="xl">
                     <Card withBorder radius="md" p="md">
                        <Title order={4} mb="md">看板设置</Title>
                        <Group align="flex-end">
                            <Select
                                label="X轴维度 (例如: 日期)"
                                data={availableFields}
                                value={xAxisField}
                                onChange={setXAxisField}
                                placeholder="选择字段"
                                searchable
                            />
                            <Select
                                label="统计指标 (Y轴, 例如: 数量)"
                                data={availableFields}
                                value={yAxisField}
                                onChange={setYAxisField}
                                placeholder="选择字段"
                                searchable
                            />
                            <Select
                                label="分类维度 (例如: 素材类型)"
                                data={availableFields}
                                value={categoryField}
                                onChange={setCategoryField}
                                placeholder="选择字段"
                                searchable
                            />
                        </Group>
                     </Card>

                     <Flex gap="md" align="stretch" style={{ minHeight: 400 }}>
                        <Card withBorder radius="md" p="md" style={{ flex: 2 }}>
                            <Title order={4} mb="xl">趋势统计</Title>
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Bar dataKey="value" fill="var(--mantine-color-blue-filled)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Text c="dimmed" ta="center" mt="xl">请选择有效的 X轴 和 Y轴 字段</Text>
                            )}
                        </Card>

                        <Card withBorder radius="md" p="md" style={{ flex: 1 }}>
                            <Title order={4} mb="xl">占比分布</Title>
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <Text c="dimmed" ta="center" mt="xl">请选择 分类维度 和 统计指标 字段</Text>
                            )}
                        </Card>
                     </Flex>
                 </Stack>
             )}
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Flex>
  );
}
