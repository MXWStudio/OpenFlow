const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/renderer/src/App.tsx',
];

const replacements = [
  // App.tsx specific panel background to remove the big white section on the left in DailyWorkspace
  { regex: /background: 'rgba\(250,\s*252,\s*255,\s*0\.\d+\)'/g, replacement: "'var(--mantine-color-default)'" }
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
console.log('Hex3 replacements applied.');
