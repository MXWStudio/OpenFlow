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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Upload, Trash2, Save, BarChart3, TableProperties } from 'lucide-react';
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

export function BitableWorkspace() {
  const [activeTab, setActiveTab] = useState<string | null>('table');
  const [data, setData] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  // Dashboard configuration
  const [xAxisField, setXAxisField] = useState<string | null>(null);
  const [yAxisField, setYAxisField] = useState<string | null>(null);
  const [categoryField, setCategoryField] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedBatch]);

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
      notifications.show({ color: 'red', title: '加载失败', message: '无法读取数据库记录。' });
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    try {
      const result = await window.electronAPI.dialog.importExcel();
      if (!result) return;

      const { fileName, data: excelData } = result;
      const batchId = `${fileName}_${Date.now()}`;

      setLoading(true);
      for (const row of excelData) {
        await window.electronAPI.db.insertImportedData(batchId, row);
      }
      notifications.show({ color: 'green', title: '导入成功', message: `已导入 ${excelData.length} 条记录。` });
      setSelectedBatch(null); // Load all
      loadData();
    } catch (error: any) {
      notifications.show({ color: 'red', title: '导入失败', message: error.message });
      setLoading(false);
    }
  }

  async function handleDeleteRow(id: number) {
    if (!confirm('确定要删除这条记录吗？')) return;
    try {
      await window.electronAPI.db.deleteImportedData(id);
      setData(prev => prev.filter(r => r.id !== id));
      notifications.show({ color: 'green', title: '删除成功' });
    } catch (error) {
      notifications.show({ color: 'red', title: '删除失败' });
    }
  }

  async function handleClearAll() {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
    try {
      await window.electronAPI.db.clearAllImportedData();
      setData([]);
      notifications.show({ color: 'green', title: '已清空所有数据' });
    } catch (error) {
      notifications.show({ color: 'red', title: '清空失败' });
    }
  }

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

    cols.push(
      colHelper.display({
        id: 'actions',
        header: '操作',
        cell: (info) => (
          <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteRow(info.row.original.id)}>
            <Trash2 size={16} />
          </ActionIcon>
        ),
      }) as any
    );

    return cols;
  }, [data]);

  const table = useReactTable({
    data,
    columns: dynamicColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: async (rowIndex: number, columnId: string, value: any) => {
        const row = data[rowIndex];
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
          notifications.show({ color: 'red', title: '保存失败' });
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
    <Flex h="100%" direction="column" bg="#f7f9fc" p="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2} c="#1d2230">个人素材产能统计与可视化看板</Title>
        <Group>
          <Button leftSection={<Upload size={16} />} onClick={handleImport} loading={loading}>
            导入 Excel
          </Button>
          <Button variant="light" color="red" leftSection={<Trash2 size={16} />} onClick={handleClearAll} disabled={data.length === 0}>
            清空数据
          </Button>
        </Group>
      </Group>

      <Card radius="md" p={0} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} withBorder shadow="sm">
        <Tabs value={activeTab} onChange={setActiveTab} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Tabs.List px="md" pt="sm">
            <Tabs.Tab value="table" leftSection={<TableProperties size={16} />}>
              数据表格
            </Tabs.Tab>
            <Tabs.Tab value="dashboard" leftSection={<BarChart3 size={16} />}>
              可视化看板
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="table" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {data.length === 0 ? (
              <Flex align="center" justify="center" h="100%">
                <Text c="dimmed">暂无数据，请先导入 Excel 表格</Text>
              </Flex>
            ) : (
              <Box style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
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
                    {table.getRowModel().rows.map((row) => (
                      <Table.Tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <Table.Td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
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
                                        <Bar dataKey="value" fill="#4f8dff" radius={[4, 4, 0, 0]} />
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
