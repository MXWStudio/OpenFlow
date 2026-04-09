import React from 'react';
import { notifications } from '@mantine/notifications';
import { Box } from '@mantine/core';

export function notify(color: 'green' | 'red' | 'orange' | 'gray' | 'blue' | 'teal' | 'grape' | 'pink' | 'yellow', title: string, message?: React.ReactNode, autoClose: number | boolean = 3000) {
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
  window.dispatchEvent(event);

  const getProgressColor = () => {
    switch (color) {
      case 'green':
      case 'teal':
        return '#34d399';
      case 'red':
      case 'pink':
        return '#f87171';
      case 'orange':
      case 'yellow':
        return '#fbbf24';
      case 'blue':
        return '#60a5fa';
      default:
        return '#94a3b8';
    }
  };

  const Content = () => {
    return (
      <Box style={{ position: 'relative', width: '100%', height: '100%', paddingBottom: 10 }}>
        <Box>
          {message}
        </Box>
        <Box
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'rgba(0,0,0,0.05)',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <Box
            style={{
              height: '100%',
              background: getProgressColor(),
              animation: `shrink ${autoClose}ms linear forwards`
            }}
          />
        </Box>
        <style>
          {`
            @keyframes shrink {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}
        </style>
      </Box>
    );
  };

  notifications.show({
    id,
    color,
    title,
    message: <Content />,
    autoClose,
    styles: {
      body: {
        width: '100%'
      }
    }
  });

  return id;
}
