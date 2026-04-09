const fs = require('fs');

const files = [
  'src/renderer/src/views/OrganizerWorkspace.tsx',
  'src/renderer/src/views/BitableWorkspace.tsx',
  'src/renderer/src/views/FormatProcessor.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // fallback replacement for ones with template literals and line breaks
  content = content.replace(/notifications\.show\(\{ color: 'orange', title: '未配置支持格式', message: '请先在系统设置中勾选至少一种支持格式（如 jpg, mp4）。' \}\);/g, "notify('orange', '未配置支持格式', '请先在系统设置中勾选至少一种支持格式（如 jpg, mp4）。');");
  content = content.replace(/notifications\.show\(\{ color: 'green', title: '扫描完成', message: \`共发现 \$\{results.length\} 个文件待整理。\` \}\);/g, "notify('green', '扫描完成', \`共发现 \$\{results.length\} 个文件待整理。\`);");
  content = content.replace(/notifications\.show\(\{ color: 'green', title: '整理完成', message: \`成功移动了 \$\{successCount\} 个文件。\` \}\);/g, "notify('green', '整理完成', \`成功移动了 \$\{successCount\} 个文件。\`);");
  content = content.replace(/notifications\.show\(\{ color: 'orange', title: '整理完成 \(部分失败\)', message: \`成功: \$\{successCount\}, 失败: \$\{failCount\}\` \}\);/g, "notify('orange', '整理完成 (部分失败)', \`成功: \$\{successCount\}, 失败: \$\{failCount\}\`);");
  content = content.replace(/notifications\.show\(\{ color: 'green', title: '成功', message: \`已将 \$\{file.gameName\} 添加到游戏库\` \}\);/g, "notify('green', '成功', \`已将 \$\{file.gameName\} 添加到游戏库\`);");
  content = content.replace(/notifications\.show\(\{ color: 'green', title: '导入成功', message: \`已导入 \$\{excelData.length\} 条记录。\` \}\);/g, "notify('green', '导入成功', \`已导入 \$\{excelData.length\} 条记录。\`);");
  content = content.replace(/notifications\.show\(\{ color: 'green', title: '处理完成', message: \`成功处理 \$\{successCount\} 个文件\` \}\);/g, "notify('green', '处理完成', \`成功处理 \$\{successCount\} 个文件\`);");
  content = content.replace(/notifications\.show\(\{ color: 'orange', title: '处理完成', message: \`成功处理 \$\{successCount\} 个文件，失败 \$\{files.length - successCount\} 个\` \}\);/g, "notify('orange', '处理完成', \`成功处理 \$\{successCount\} 个文件，失败 \$\{files.length - successCount\} 个\`);");

  // formatting ones
  content = content.replace(/notifications\.show\(\{\s+color: 'orange',\s+title: '未配置支持格式',\s+message: '请先在系统设置中勾选至少一种支持格式（如 jpg, mp4）。'\s+\}\);/g, "notify('orange', '未配置支持格式', '请先在系统设置中勾选至少一种支持格式（如 jpg, mp4）。');");

  content = content.replace(/notifications\.show\(\{\n\s*color: 'green',\n\s*title: '导入成功',\n\s*message: \`已导入 \$\{excelData.length\} 条记录。\`,\n\s*autoClose: 5000\n\s*\}\);/g, "notify('green', '导入成功', \`已导入 \$\{excelData.length\} 条记录。\`, 5000);");

  // FormatProcessor special
  content = content.replace(/notifications\.show\(\{\n\s*color: 'red',\n\s*title: '处理出错',\n\s*message: String\(err\)\n\s*\}\);/g, "notify('red', '处理出错', String(err));");

  fs.writeFileSync(file, content);
});
