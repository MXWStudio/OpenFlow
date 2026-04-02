import React, { useEffect, useState } from 'react';
import { Box } from '@mantine/core';

export default function PinApp() {
  const [imgUrl, setImgUrl] = useState<string>('');

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.pin) {
      window.electronAPI.pin.onPinData((dataUrl: string) => {
        setImgUrl(dataUrl);
      });
    }

    // Double click to close
    const handleDoubleClick = () => {
      if (window.electronAPI?.pin?.closePin) {
        window.electronAPI.pin.closePin();
      }
    };

    window.addEventListener('dblclick', handleDoubleClick);
    return () => window.removeEventListener('dblclick', handleDoubleClick);
  }, []);

  return (
    <Box
      style={{
        width: '100vw',
        height: '100vh',
        // Make the window draggable
        WebkitAppRegion: 'drag',
        overflow: 'hidden',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {imgUrl && (
        <img
          src={imgUrl}
          alt="pinned"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none', // prevent image from blocking drag
          }}
        />
      )}
    </Box>
  );
}
