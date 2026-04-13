const fs = require('fs');
const file = 'src/renderer/src/views/DailyWorkspace.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /'radial-gradient\(circle at 50% 50%, rgba\(239, 246, 255, 0.98\) 0%, rgba\(255,255,255,1\) 56%, rgba\(241,245,249,0.96\) 100%\)',/g,
  "'var(--mantine-color-default)',"
);
content = content.replace(
  /'inset 0 0 48px rgba\(191, 219, 254, 0.18\)'/g,
  "'none'"
);

fs.writeFileSync(file, content);
