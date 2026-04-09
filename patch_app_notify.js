const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/App.tsx', 'utf8');

code = code.replace(/import \{.*?type HistoryEntry,.*?\} from '\.\/appState';/s, (match) => {
    return match.replace(/type HistoryEntry,/, 'type HistoryEntry,\n  type NotificationHistoryEntry,');
});

code = code.replace(/const \[historyData, setHistoryData\] = useState<HistoryEntry\[\]>\(\[\]\);/g,
  "const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);\n  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryEntry[]>([]);\n  const [isNotificationCenterOpened, setIsNotificationCenterOpened] = useState(false);");

code = code.replace(/if \(Array\.isArray\(config\.history\)\) setHistoryData\(config\.history as HistoryEntry\[\]\);/g,
  "if (Array.isArray(config.history)) setHistoryData(config.history as HistoryEntry[]);\n      if (Array.isArray(config.notificationHistory)) setNotificationHistory(config.notificationHistory as NotificationHistoryEntry[]);");

const useEffectLogic = `useEffect(() => {
    const handleNotification = async (e: Event) => {
      const customEvent = e as CustomEvent<NotificationHistoryEntry>;
      setNotificationHistory((prev) => {
        const next = [customEvent.detail, ...prev].slice(0, 100);
        if (window.electronAPI) {
          window.electronAPI.store.set('notificationHistory', next);
        }
        return next;
      });
    };
    window.addEventListener('app-notification', handleNotification);
    return () => window.removeEventListener('app-notification', handleNotification);
  }, []);`;

code = code.replace(/useEffect\(\(\) => \{\n    if \(\!window\.electronAPI\) \{/g, `${useEffectLogic}\n\n  useEffect(() => {\n    if (!window.electronAPI) {`);

const drawerUI = `      <Drawer opened={isNotificationCenterOpened} onClose={() => setIsNotificationCenterOpened(false)} position="left" size={420} title="消息中心">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">保留最近 100 条通知</Text>
            <Button variant="subtle" color="red" size="xs" onClick={() => {
              setNotificationHistory([]);
              if (window.electronAPI) window.electronAPI.store.set('notificationHistory', []);
            }}>
              清空历史
            </Button>
          </Group>
          {notificationHistory.length === 0 && <Text c="dimmed" mt="md" ta="center">暂无消息记录</Text>}
          {notificationHistory.map((item) => (
            <Card key={item.id} withBorder radius="md" p="sm" shadow="sm">
              <Group wrap="nowrap" align="flex-start">
                <Box
                  w={8}
                  h={8}
                  mt={6}
                  style={{
                    borderRadius: 999,
                    background: ['green', 'teal'].includes(item.color) ? '#34d399' : ['red', 'pink'].includes(item.color) ? '#f87171' : ['orange', 'yellow'].includes(item.color) ? '#fbbf24' : '#60a5fa',
                    flexShrink: 0
                  }}
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" mb={4}>
                    <Text fw={700} size="sm">{item.title}</Text>
                    <Text size="xs" c="dimmed">{new Date(item.timestamp).toLocaleString()}</Text>
                  </Group>
                  {item.message && <Text size="xs" c="dimmed">{item.message}</Text>}
                </Box>
              </Group>
            </Card>
          ))}
        </Stack>
      </Drawer>

      <Drawer opened={historyOpened}`;

code = code.replace(/<Drawer opened=\{historyOpened\}/g, drawerUI);

code = code.replace(/<Indicator color="red" size=\{8\} offset=\{5\}>\n\s*<ActionIcon\n\s*variant="subtle"\n\s*styles=\{\{\n\s*root: \{\n\s*width: 46,\n\s*height: 46,\n\s*color: '#a8b5c9',\n\s*display: 'flex',\n\s*alignItems: 'center',\n\s*justifyContent: 'center',\n\s*\},\n\s*\}\}\n\s*>\n\s*<Bell size=\{22\} \/>/g,
`<Indicator color="red" size={8} offset={5} disabled={notificationHistory.length === 0}>
              <ActionIcon
                variant="subtle"
                onClick={() => setIsNotificationCenterOpened(true)}
                styles={{
                  root: {
                    width: 46,
                    height: 46,
                    color: isNotificationCenterOpened ? '#e2eeff' : '#a8b5c9',
                    background: isNotificationCenterOpened ? 'rgba(46, 88, 168, 0.34)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                  },
                }}
              >
                <Bell size={22} />`);

fs.writeFileSync('src/renderer/src/App.tsx', code);
