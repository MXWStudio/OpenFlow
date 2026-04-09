const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/App.tsx', 'utf8');
code = code.replace(
  /<OrganizerWorkspace\n            workflowSettings=\{workflowSettings\}\n            workspaceSettings=\{workspaceSettings\}\n            onOpenSettings=\{.*?\}\n            onChangeWorkspaceSettings=\{.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n          \/>/gs,
  `<OrganizerWorkspace
            workflowSettings={workflowSettings}
            workspaceSettings={workspaceSettings}
            onOpenSettings={() => setActiveView('settings')}
            onChangeWorkspaceSettings={async (partialSettings) => {
              const newSettings = { ...workspaceSettings, ...partialSettings };
              setWorkspaceSettings(newSettings);
              if (window.electronAPI) {
                await window.electronAPI.store.set('workspaceSettings', newSettings);
              }
            }}
            isQimiEnabled={isQimiEnabled}
            onToggleQimiEnabled={setIsQimiEnabled}
          />`
);
fs.writeFileSync('src/renderer/src/App.tsx', code);
