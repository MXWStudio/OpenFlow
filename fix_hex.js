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
  // Borders
  { regex: /['"]1px solid #(e[a-z0-9]{5}|d[a-z0-9]{5})['"]/gi, replacement: "'1px solid var(--mantine-color-default-border)'" },
  { regex: /borderColor: ['"]#(e[a-z0-9]{5}|d[a-z0-9]{5})['"]/gi, replacement: "borderColor: 'var(--mantine-color-default-border)'" },
  { regex: /2px dashed #cad7e8/gi, replacement: "2px dashed var(--mantine-color-default-border)" },

  // Text Colors
  { regex: /c=['"]#(22324c|0f284d|334155|1d2230)['"]/gi, replacement: 'c="var(--mantine-color-text)"' },
  { regex: /color: ['"]#(22324c|0f284d|334155|1d2230)['"]/gi, replacement: "color: 'var(--mantine-color-text)'" },

  { regex: /c=['"]#(8ea2c1|94a3b8|64748b|7185a3)['"]/gi, replacement: 'c="var(--mantine-color-dimmed)"' },
  { regex: /color: ['"]#(8ea2c1|94a3b8|64748b|7185a3|d7e0eb|d6dee9|98a8bf)['"]/gi, replacement: "color: 'var(--mantine-color-dimmed)'" },
  { regex: /color=['"]#(8ea2c1|94a3b8|64748b|7185a3|d7e0eb|d6dee9|98a8bf|475569)['"]/gi, replacement: 'color="var(--mantine-color-dimmed)"' },

  // Background Colors
  { regex: /bg=['"]#fff(fff)?['"]/gi, replacement: 'bg="var(--mantine-color-body)"' },
  { regex: /backgroundColor: ['"]#fff(fff)?['"]/gi, replacement: "backgroundColor: 'var(--mantine-color-body)'" },
  { regex: /bg=['"]#f7f9fc['"]/gi, replacement: 'bg="var(--mantine-color-body)"' },
  { regex: /backgroundColor: ['"]#f1f5f9['"]/gi, replacement: "backgroundColor: 'var(--mantine-color-default)'" },
  { regex: /backgroundColor: ['"]#f9fbff['"]/gi, replacement: "backgroundColor: 'var(--mantine-color-default)'" },
  { regex: /backgroundColor: selectedBatch === file.batch_id \? '#e7f5ff' : undefined/gi, replacement: "backgroundColor: selectedBatch === file.batch_id ? 'var(--mantine-primary-color-light)' : undefined" },

  // Specific App.tsx & daily overrides
  { regex: /background: ['"]#111a34['"]/gi, replacement: "background: 'var(--mantine-color-dark-8)'" },
  { regex: /background: ['"]#19c37d['"]/gi, replacement: "background: 'var(--mantine-color-green-filled)'" },
  { regex: /background: ['"]#4f8dff['"]/gi, replacement: "background: 'var(--mantine-color-blue-filled)'" },
  { regex: /color=['"]#4f8dff['"]/gi, replacement: 'color="var(--mantine-color-blue-filled)"' },
  { regex: /color=['"]#20c997['"]/gi, replacement: 'color="var(--mantine-color-teal-filled)"' },
  { regex: /c=['"]#2563eb['"]/gi, replacement: 'c="var(--mantine-color-blue-filled)"' },
  { regex: /fill=['"]#4f8dff['"]/gi, replacement: 'fill="var(--mantine-color-blue-filled)"' },

  // Logic overrides
  { regex: /background: hasIssues \? '#f59e0b' : '#34d399'/g, replacement: "background: hasIssues ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-green-filled)'" },
  { regex: /c=\{group\.hasError \? '#ef4444' : '#334155'\}/g, replacement: "c={group.hasError ? 'var(--mantine-color-red-filled)' : 'var(--mantine-color-text)'}" },
  { regex: /color=\{group\.hasError \? '#ef4444' : '#8ea2c1'\}/g, replacement: "color={group.hasError ? 'var(--mantine-color-red-filled)' : 'var(--mantine-color-dimmed)'}" },
  { regex: /background: hasOrganized \? '#34d399' : isScanning \|\| isOrganizing \? '#60a5fa' : '#94a3b8'/g, replacement: "background: hasOrganized ? 'var(--mantine-color-green-filled)' : isScanning || isOrganizing ? 'var(--mantine-color-blue-filled)' : 'var(--mantine-color-dimmed)'" },
  { regex: /borderColor: selectedBatch === file\.batch_id \? '#339af0' : undefined/g, replacement: "borderColor: selectedBatch === file.batch_id ? 'var(--mantine-primary-color-filled)' : undefined" },
  { regex: /background: \['green', 'teal'\]\.includes\(item\.color\) \? '#34d399' : \['red', 'pink'\]\.includes\(item\.color\) \? '#f87171' : \['orange', 'yellow'\]\.includes\(item\.color\) \? '#fbbf24' : '#60a5fa'/g, replacement: "background: ['green', 'teal'].includes(item.color) ? 'var(--mantine-color-green-filled)' : ['red', 'pink'].includes(item.color) ? 'var(--mantine-color-red-filled)' : ['orange', 'yellow'].includes(item.color) ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-blue-filled)'" },
  { regex: /linear-gradient\(90deg, #fb923c 0%, #f472b6 50%, #818cf8 100%\)/g, replacement: "linear-gradient(90deg, var(--mantine-color-orange-filled) 0%, var(--mantine-color-pink-filled) 50%, var(--mantine-color-indigo-filled) 100%)" }
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
console.log('Hex replacements applied.');
