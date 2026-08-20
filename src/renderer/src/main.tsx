import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { init as initSentryRenderer } from '@sentry/electron/renderer';
import App from './App.tsx';

initSentryRenderer();

function reportRendererDiagnostic(type: string, payload: unknown): void {
  void window.electronAPI?.diagnostics?.report({
    type,
    severity: 'error',
    occurredAt: new Date().toISOString(),
    payload,
  }).catch(() => undefined);
}

window.addEventListener('error', (event) => {
  reportRendererDiagnostic('renderer.unhandled_error', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error instanceof Error ? event.error.stack : undefined,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportRendererDiagnostic('renderer.unhandled_rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
});

const root = document.getElementById('root');

if (!root) {
  throw new Error('Renderer root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" limit={1} />
      <App />
    </MantineProvider>
  </StrictMode>,
);
