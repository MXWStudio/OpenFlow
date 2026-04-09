const fs = require('fs');
const file = 'd:/openflow/src/renderer/src/views/SettingsWorkspace.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace standard single-line setX(prev => ({ ...prev, prop: e.currentTarget.value }))
// Match: onChange={(e) => setSomething((prev) => ({ ...prev, key: e.currentTarget.value }))}
content = content.replace(/onChange=\{\(e\) => ([a-zA-Z0-9_]+)\(\(?prev\)? => \(\{ \.\.\.prev, ([a-zA-Z0-9_]+): e\.currentTarget\.value \}\)\)\}/g, (match, setter, prop) => {
  return `onChange={(e) => { const val = e.currentTarget.value; ${setter}(prev => ({ ...prev, ${prop}: val })); }}`;
});

// Replace checkbox single-line setX(prev => ({ ...prev, prop: e.currentTarget.checked }))
content = content.replace(/onChange=\{\(e\) => ([a-zA-Z0-9_]+)\(\(?prev\)? => \(\{ \.\.\.prev, ([a-zA-Z0-9_]+): e\.currentTarget\.checked \}\)\)\}/g, (match, setter, prop) => {
  return `onChange={(e) => { const checked = e.currentTarget.checked; ${setter}(prev => ({ ...prev, ${prop}: checked })); }}`;
});

// Replace the multi-line aiIntegration ones (with value)
content = content.replace(/onChange=\{\(e\) => ([a-zA-Z0-9_]+)\(\(?prev\)? => \(\{\s*\.\.\.prev,\s*aiIntegration: \{ \.\.\.prev\.aiIntegration, ([a-zA-Z0-9_]+): e\.currentTarget\.value \} as any\s*\}\)\)\}/g, (match, setter, prop) => {
  return `onChange={(e) => { const val = e.currentTarget.value; ${setter}((prev) => ({ ...prev, aiIntegration: { ...prev.aiIntegration, ${prop}: val } as any })); }}`;
});

fs.writeFileSync(file, content);
console.log('Replaced correctly');
