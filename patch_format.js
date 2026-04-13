const fs = require('fs');
const file = 'src/renderer/src/views/FormatProcessor.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/bg="#f7f9fc"/g, 'bg="var(--mantine-color-body)"');
content = content.replace(/bg="gray\.0"/g, 'bg="var(--mantine-color-default)"');

fs.writeFileSync(file, content);
