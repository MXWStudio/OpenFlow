const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/utils/notify.tsx', 'utf8');

code = code.replace(/animation: \\\`shrink \\\$\\{autoClose\\}ms linear forwards\\\`/g, 'animation: `shrink ${autoClose}ms linear forwards`');
code = code.replace(/\\\{\\\`/g, '{\`');
code = code.replace(/\\\`\\\}/g, '\`}');

fs.writeFileSync('src/renderer/src/utils/notify.tsx', code);
