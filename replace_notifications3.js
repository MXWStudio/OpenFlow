const fs = require('fs');
let content = fs.readFileSync('src/renderer/src/views/FormatProcessor.tsx', 'utf8');
content = content.replace(/notifications\.show\(\{\s*color: 'red',\s*title: '文件路径解析失败',\s*message: \`无法解析文件 \$\{file\.name\} 的本地路径。请尝试使用文件夹选择或其他方式。\`\s*\}\);/g, "notify('red', '文件路径解析失败', \`无法解析文件 \$\{file.name\} 的本地路径。请尝试使用文件夹选择或其他方式。\`);");
fs.writeFileSync('src/renderer/src/views/FormatProcessor.tsx', content);
