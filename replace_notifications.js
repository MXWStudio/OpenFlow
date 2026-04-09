const fs = require('fs');

const files = [
  'src/renderer/src/App.tsx',
  'src/renderer/src/views/OrganizerWorkspace.tsx',
  'src/renderer/src/views/SettingsWorkspace.tsx',
  'src/renderer/src/views/BitableWorkspace.tsx',
  'src/renderer/src/views/AiWorkspace.tsx',
  'src/renderer/src/views/GameDictionaryWorkspace.tsx',
  'src/renderer/src/views/FormatProcessor.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  if (content.includes("import { notifications } from '@mantine/notifications';")) {
    content = content.replace("import { notifications } from '@mantine/notifications';", "import { notify } from '../utils/notify';");
  } else if (content.includes("import { notifications, NotificationData } from '@mantine/notifications';")) {
     content = content.replace("import { notifications, NotificationData } from '@mantine/notifications';", "import { notify } from '../utils/notify';");
  } else if (!content.includes("import { notify }") && file !== 'src/renderer/src/App.tsx') {
    content = "import { notify } from '../utils/notify';\n" + content;
  }

  if (file === 'src/renderer/src/App.tsx') {
    content = content.replace(/  function notify\(color: 'green' \| 'red' \| 'orange' \| 'gray', title: string, message\?: string\) \{\n    notifications\.show\(\{ color, title, message, autoClose: 3000 \}\);\n  \}\n/g, '');
    content = content.replace(/import \{ notifications \} from '@mantine\/notifications';/g, "import { notify } from './utils/notify';");
  }

  // Regex logic
  content = content.replace(/notifications\.show\(\{\s*color:\s*('[^']+'|"[^"]+"),\s*title:\s*([^,}]+),\s*message:\s*([^,}]+?)(?:,\s*autoClose:\s*(\d+))?\s*\}\)/g, (match, color, title, message, autoClose) => {
    let args = `${color}, ${title}`;
    if (message && message.trim() !== 'undefined' && message.trim() !== '') {
        args += `, ${message}`;
        if (autoClose) {
            args += `, ${autoClose}`;
        }
    }
    return `notify(${args})`;
  });

  content = content.replace(/notifications\.show\(\{\s*color:\s*('[^']+'|"[^"]+"),\s*title:\s*([^,}]+)(?:,\s*message:\s*([^,}]+?))?\s*\}\)/g, (match, color, title, message) => {
    let args = `${color}, ${title}`;
    if (message && message.trim() !== 'undefined' && message.trim() !== '') {
        args += `, ${message}`;
    }
    return `notify(${args})`;
  });

  content = content.replace(/notifications\.show\(\{\s*color:\s*('[^']+'|"[^"]+"),\s*title:\s*([^,}]+)\s*\}\)/g, (match, color, title) => {
    return `notify(${color}, ${title})`;
  });

  // Handle multi-line ones
  content = content.replace(/notifications\.show\(\{\s*color:\s*'([^']+)',\s*title:\s*'([^']+)',\s*message:\s*([^,]+),\s*autoClose:\s*(\d+)\s*\}\)/g, (match, color, title, message, autoClose) => {
      return `notify('${color}', '${title}', ${message}, ${autoClose})`;
  });

  content = content.replace(/notifications\.show\(\{\s*color:\s*'([^']+)',\s*title:\s*'([^']+)',\s*message:\s*msg,\s*autoClose:\s*(\d+)\s*\}\);/g, (match, color, title, autoClose) => {
      return `notify('${color}', '${title}', msg, ${autoClose});`;
  });

  fs.writeFileSync(file, content);
});
