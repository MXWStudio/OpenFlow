const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/views/OrganizerWorkspace.tsx', 'utf8');
code = code.replace(
  /const response = await window\.electronAPI\.fs\.executeOrganize\(selectedFiles, organizerDestDir\);/g,
  `const response = await window.electronAPI.fs.executeOrganize(selectedFiles, organizerDestDir, isQimiEnabled);`
);
fs.writeFileSync('src/renderer/src/views/OrganizerWorkspace.tsx', code);
