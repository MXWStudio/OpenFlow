const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/views/OrganizerWorkspace.tsx', 'utf8');

const search = `                {/* 右侧 40% 快捷操作 */}
                <Box style={{ flex: '0 0 calc(40% - 15px)', minWidth: 0 }}>
                   <Group gap={8} mb="lg">
                    <FolderSearch size={14} color="#d7e0eb" opacity={0} />
                    <Text fw={800} size="lg" c="#8ea2c1">
                      快捷操作
                    </Text>
                  </Group>
                  <Paper
                    radius={26}
                    p={24}
                    h="100%"
                    style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid #edf2f7',
                      overflow: 'hidden',
                    }}
                  >
                    <Stack gap="lg" h="100%" justify="center">
                      <Group justify="space-between" wrap="nowrap">
                        <Tooltip label={organizerSourceDir || '未配置源目录'}>
                          <Text fw={600} size="md" c="#334155" truncate style={{ flex: 1, cursor: 'help' }}>
                            源: {getDirName(organizerSourceDir)}
                          </Text>
                        </Tooltip>
                        <Button
                          variant="light"
                          color="blue"
                          size="sm"
                          radius="md"
                          onClick={async () => {
                            const newPath = await window.electronAPI.dialog.selectFolder();
                            if (newPath) {
                              if (onChangeWorkspaceSettings) {
                                onChangeWorkspaceSettings({ sourceDir: newPath });
                              }
                              notifications.show({ color: 'green', title: '成功', message: '已更改源目录配置。' });
                            }
                          }}
                        >
                          更改目录
                        </Button>
                      </Group>

                      <Group justify="space-between" wrap="nowrap">
                        <Tooltip label={organizerDestDir || '未配置转移目录'}>
                          <Text fw={600} size="md" c="#334155" truncate style={{ flex: 1, cursor: 'help' }}>
                            目标: {getDirName(organizerDestDir)}
                          </Text>
                        </Tooltip>
                        <Button
                          variant="light"
                          color="blue"
                          size="sm"
                          radius="md"
                          onClick={async () => {
                            const newPath = await window.electronAPI.dialog.selectFolder();
                            if (newPath) {
                              if (onChangeWorkspaceSettings) {
                                onChangeWorkspaceSettings({ destDir: newPath });
                              }
                              notifications.show({ color: 'green', title: '成功', message: '已更改转移目录配置。' });
                            }
                          }}
                        >
                          更改目录
                        </Button>
                      </Group>

                      <Box mt="auto">
                        <Button
                          fullWidth
                          variant="light"
                          color="red"
                          size="md"
                          radius="md"
                          onClick={async () => {
                            try {
                              const result = await window.electronAPI.fs.undoOrganize();
                              if (result.success) {
                                notifications.show({ color: 'green', title: '撤销成功', message: result.message });
                                // Automatically scan to refresh the list after undoing
                                handleScan();
                              } else {
                                notifications.show({ color: 'orange', title: '撤销失败', message: result.error });
                              }
                            } catch (err) {
                              notifications.show({ color: 'red', title: '执行撤销时出错', message: String(err) });
                            }
                          }}
                        >
                          撤销转移
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>`;

const replace = `                {/* 右侧 40% 快捷操作 */}
                <Box style={{ flex: '0 0 calc(40% - 15px)', minWidth: 0 }}>
                   <Group gap={8} mb="lg">
                    <FolderSearch size={14} color="#d7e0eb" opacity={0} />
                    <Text fw={800} size="lg" c="#8ea2c1">
                      快捷操作
                    </Text>
                  </Group>
                  <Paper
                    radius={26}
                    p={22}
                    h="100%"
                    style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid #edf2f7',
                      overflow: 'hidden',
                    }}
                  >
                    <Stack gap="md" h="100%">
                      <import-SimpleGrid cols={2} spacing="md" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
                        <Button
                          variant={isQimiEnabled ? "filled" : "light"}
                          color={isQimiEnabled ? "orange" : "gray"}
                          leftSection={<PlayCircle size={16} />}
                          onClick={() => onToggleQimiEnabled(!isQimiEnabled)}
                          radius="xl"
                          size="md"
                          styles={{
                            root: {
                              fontWeight: 800,
                              transition: 'all 0.2s ease',
                              gridColumn: 'span 2'
                            },
                          }}
                        >
                          视频转移-奇觅生成
                        </Button>
                        <Tooltip label={organizerSourceDir || '未配置源目录'}>
                          <Button
                            variant="light"
                            color="blue"
                            leftSection={<FolderOpen size={16} />}
                            onClick={async () => {
                              const newPath = await window.electronAPI.dialog.selectFolder();
                              if (newPath) {
                                if (onChangeWorkspaceSettings) {
                                  onChangeWorkspaceSettings({ sourceDir: newPath });
                                }
                                notifications.show({ color: 'green', title: '成功', message: '已更改源目录配置。' });
                              }
                            }}
                            radius="xl"
                            size="md"
                            styles={{
                              root: {
                                fontWeight: 800,
                              },
                              label: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }
                            }}
                          >
                            更改源目录
                          </Button>
                        </Tooltip>
                        <Tooltip label={organizerDestDir || '未配置转移目录'}>
                          <Button
                            variant="light"
                            color="blue"
                            leftSection={<FolderOpen size={16} />}
                            onClick={async () => {
                              const newPath = await window.electronAPI.dialog.selectFolder();
                              if (newPath) {
                                if (onChangeWorkspaceSettings) {
                                  onChangeWorkspaceSettings({ destDir: newPath });
                                }
                                notifications.show({ color: 'green', title: '成功', message: '已更改转移目录配置。' });
                              }
                            }}
                            radius="xl"
                            size="md"
                            styles={{
                              root: {
                                fontWeight: 800,
                              },
                              label: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }
                            }}
                          >
                            更改转移目录
                          </Button>
                        </Tooltip>
                        <Button
                          variant="light"
                          color="red"
                          leftSection={<FolderSync size={16} />}
                          onClick={async () => {
                            try {
                              const result = await window.electronAPI.fs.undoOrganize();
                              if (result.success) {
                                notifications.show({ color: 'green', title: '撤销成功', message: result.message });
                                handleScan();
                              } else {
                                notifications.show({ color: 'orange', title: '撤销失败', message: result.error });
                              }
                            } catch (err) {
                              notifications.show({ color: 'red', title: '执行撤销时出错', message: String(err) });
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
                          撤销转移
                        </Button>
                      </import-SimpleGrid>
                    </Stack>
                  </Paper>
                </Box>`;

code = code.replace(search, replace.replace(/import-SimpleGrid/g, 'SimpleGrid'));
code = code.replace("import {\n  Box,\n  Button,\n  Card,\n  Checkbox,\n  Flex,\n  Group,\n  Image,\n  ScrollArea,\n  Stack,\n  Text,\n  Title,\n  Badge,\n  Paper,\n  ThemeIcon,\n  ActionIcon,\n  Tooltip,\n} from '@mantine/core';",
"import {\n  Box,\n  Button,\n  Card,\n  Checkbox,\n  Flex,\n  Group,\n  Image,\n  ScrollArea,\n  SimpleGrid,\n  Stack,\n  Text,\n  Title,\n  Badge,\n  Paper,\n  ThemeIcon,\n  ActionIcon,\n  Tooltip,\n} from '@mantine/core';");

fs.writeFileSync('src/renderer/src/views/OrganizerWorkspace.tsx', code);
