const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/renderer/src/views/DailyWorkspace.tsx',
  'src/renderer/src/App.tsx',
  'src/renderer/src/views/SettingsWorkspace.tsx',
  'src/renderer/src/views/OrganizerWorkspace.tsx',
  'src/renderer/src/views/BitableWorkspace.tsx',
  'src/renderer/src/views/AiWorkspace.tsx'
];

const replacements = [
  // Semi-transparent backgrounds explicitly set to white
  { regex: /rgba\(255,\s*255,\s*255,\s*0\.\d+\)/g, replacement: "'var(--mantine-color-default)'" },
  { regex: /rgba\(250,\s*252,\s*255,\s*0\.\d+\)/g, replacement: "'var(--mantine-color-default)'" },
  { regex: /linear-gradient\(180deg, 'var\(--mantine-color-default\)' 0%, 'var\(--mantine-color-default\)' 100%\)/g, replacement: "'var(--mantine-color-default)'" },
  // Let's just fix specific lines that showed up in grep
  { regex: /background: 'rgba\(255,255,255,0\.28\)'/g, replacement: "background: 'var(--mantine-color-default)'" },
  { regex: /background: 'rgba\(255, 255, 255, 0\.8\)'/g, replacement: "background: 'var(--mantine-color-default)'" },
  { regex: /background: 'rgba\(255,255,255,0\.96\)'/g, replacement: "background: 'var(--mantine-color-body)'" },
  { regex: /background: 'linear-gradient\(180deg, rgba\(255,255,255,0\.88\) 0%, rgba\(250,252,255,0\.96\) 100%\)'/g, replacement: "background: 'var(--mantine-color-default)'" }
];

filesToFix.forEach(file => {
  const fullPath = path.resolve(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    replacements.forEach(r => {
      content = content.replace(r.regex, r.replacement);
    });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
});
console.log('Hex2 replacements applied.');
