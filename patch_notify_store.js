const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/utils/notify.tsx', 'utf8');

const replacement = `export function notify(color: 'green' | 'red' | 'orange' | 'gray' | 'blue' | 'teal' | 'grape' | 'pink' | 'yellow', title: string, message?: React.ReactNode, autoClose: number | boolean = 3000) {
  const id = Date.now().toString() + Math.random().toString();

  // Dispatch custom event to save notification history globally
  const messageStr = typeof message === 'string' ? message : (message ? '包含组件的内容' : undefined);
  const event = new CustomEvent('app-notification', {
    detail: {
      id,
      color,
      title,
      message: messageStr,
      timestamp: Date.now()
    }
  });
  window.dispatchEvent(event);`;

code = code.replace(/export function notify\([^)]+\) \{[\s\S]*?const id = Date\.now\(\)\.toString\(\) \+ Math\.random\(\)\.toString\(\);/g, replacement);

fs.writeFileSync('src/renderer/src/utils/notify.tsx', code);
