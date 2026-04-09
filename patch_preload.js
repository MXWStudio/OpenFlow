const fs = require('fs');
let code = fs.readFileSync('src/preload/index.ts', 'utf8');
code = code.replace(
  /executeOrganize: \(files: unknown\[\], destDir: string\) =>\n\s*ipcRenderer\.invoke\('fs:executeOrganize', \{ files, destDir \}\),/g,
  `executeOrganize: (files: unknown[], destDir: string, isQimiEnabled?: boolean) =>\n      ipcRenderer.invoke('fs:executeOrganize', { files, destDir, isQimiEnabled }),`
);
fs.writeFileSync('src/preload/index.ts', code);
