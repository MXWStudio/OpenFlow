import React, { useEffect, useState, useRef } from 'react';
import { Box } from '@mantine/core';

export default function PinApp() {
  const [imgUrl, setImgUrl] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Zoom with wheel
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.1, Math.min(5, prev + delta)));
    };

    window.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
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
        cursor: 'move',
      }}
    >
      <Box
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${zoom})`,
          transition: 'transform 0.1s ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none', // Allow drag through image
        }}
      >
        {imgUrl && (
          <img
            src={imgUrl}
            alt="pinned"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              borderRadius: 4,
            }}
          />
        )}
      </Box>
    </Box>
  );
}
