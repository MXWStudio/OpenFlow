import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Arrow, Line, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';
import { Box, ActionIcon, Group, Tooltip, Stack } from '@mantine/core';
import {
  Square,
  Circle as CircleIcon,
  Minus,
  MoveUpRight,
  PenTool,
  Type,
  Eraser,
  Undo,
  Download,
  Copy,
  Pin,
  X,
  Check
} from 'lucide-react';
import Konva from 'konva';

type Tool = 'select' | 'rect' | 'circle' | 'arrow' | 'line' | 'pen' | 'text' | 'mosaic';

interface Annotation {
  id: string;
  type: Tool;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  color: string;
  strokeWidth: number;
}

export default function ScreenshotApp() {
  const [imgUrl, setImgUrl] = useState<string>('');
  const [image] = useImage(imgUrl);
  const stageRef = useRef<Konva.Stage>(null);

  // States for crop box
  const [isSelecting, setIsSelecting] = useState(false);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);

  // States for annotations
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);

  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(4);

  useEffect(() => {
    // Listen for image data from main process
    if (window.electronAPI && window.electronAPI.screenshot) {
      window.electronAPI.screenshot.onScreenshotCaptured((dataUrl: string) => {
        setImgUrl(dataUrl);
      });
    }
  }, []);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!cropBox) {
      // Start crop selection
      setIsSelecting(true);
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) {
        setSelectionStart(pos);
        setCropBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
      }
      return;
    }

    if (activeTool === 'select') return;

    // Start drawing annotation
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const newId = Date.now().toString();
    const baseAnnotation = {
      id: newId,
      type: activeTool,
      x: pos.x,
      y: pos.y,
      color: strokeColor,
      strokeWidth,
    };

    if (activeTool === 'pen' || activeTool === 'line' || activeTool === 'arrow') {
      setCurrentAnnotation({
        ...baseAnnotation,
        points: [pos.x, pos.y],
      });
    } else {
      setCurrentAnnotation({
        ...baseAnnotation,
        width: 0,
        height: 0,
        radius: 0,
      });
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    if (isSelecting && selectionStart) {
      setCropBox({
        x: Math.min(pos.x, selectionStart.x),
        y: Math.min(pos.y, selectionStart.y),
        width: Math.abs(pos.x - selectionStart.x),
        height: Math.abs(pos.y - selectionStart.y),
      });
      return;
    }

    if (!currentAnnotation) return;

    setCurrentAnnotation((prev) => {
      if (!prev) return prev;
      if (prev.type === 'pen') {
        return { ...prev, points: [...(prev.points || []), pos.x, pos.y] };
      } else if (prev.type === 'line' || prev.type === 'arrow') {
        return { ...prev, points: [(prev.points || [])[0], (prev.points || [])[1], pos.x, pos.y] };
      } else if (prev.type === 'rect') {
        return {
          ...prev,
          x: Math.min(pos.x, prev.x),
          y: Math.min(pos.y, prev.y),
          width: Math.abs(pos.x - prev.x),
          height: Math.abs(pos.y - prev.y),
        };
      } else if (prev.type === 'circle') {
        const dx = pos.x - prev.x;
        const dy = pos.y - prev.y;
        return { ...prev, radius: Math.sqrt(dx * dx + dy * dy) };
      }
      return prev;
    });
  };

  const handleMouseUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionStart(null);
      // Automatically switch to rect tool or keep select to allow moving? Let's just keep select for now
      return;
    }

    if (currentAnnotation) {
      setAnnotations([...annotations, currentAnnotation]);
      setCurrentAnnotation(null);
    }
  };

  const handleUndo = () => {
    setAnnotations(annotations.slice(0, -1));
  };

  const handleClose = () => {
    if (window.electronAPI?.screenshot?.closeScreenshot) {
      window.electronAPI.screenshot.closeScreenshot();
    }
  };

  const cropImage = useCallback((): string | null => {
    if (!stageRef.current || !cropBox) return null;

    // We need to render the stage but only the crop area.
    // Easiest way in konva is to use toDataURL with pixelRatio and bounds.
    return stageRef.current.toDataURL({
      x: cropBox.x,
      y: cropBox.y,
      width: cropBox.width,
      height: cropBox.height,
      pixelRatio: window.devicePixelRatio || 1
    });
  }, [cropBox]);

  const handleCopy = () => {
    const dataUrl = cropImage();
    if (dataUrl && window.electronAPI?.screenshot?.copyToClipboard) {
      window.electronAPI.screenshot.copyToClipboard(dataUrl);
    }
  };

  const handleSave = () => {
    const dataUrl = cropImage();
    if (dataUrl && window.electronAPI?.screenshot?.saveScreenshot) {
      window.electronAPI.screenshot.saveScreenshot(dataUrl);
    }
  };

  const handlePin = () => {
    const dataUrl = cropImage();
    if (dataUrl && cropBox && window.electronAPI?.screenshot?.pinScreenshot) {
      window.electronAPI.screenshot.pinScreenshot({
        dataUrl,
        bounds: {
          x: cropBox.x,
          y: cropBox.y,
          width: cropBox.width,
          height: cropBox.height
        }
      });
    }
  };

  // Keyboard support for ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cropBox) {
          setCropBox(null);
          setAnnotations([]);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cropBox]);

  const renderAnnotation = (ann: Annotation) => {
    switch (ann.type) {
      case 'rect':
        return <Rect key={ann.id} x={ann.x} y={ann.y} width={ann.width} height={ann.height} stroke={ann.color} strokeWidth={ann.strokeWidth} />;
      case 'circle':
        return <Circle key={ann.id} x={ann.x} y={ann.y} radius={ann.radius} stroke={ann.color} strokeWidth={ann.strokeWidth} />;
      case 'line':
        return <Line key={ann.id} points={ann.points} stroke={ann.color} strokeWidth={ann.strokeWidth} />;
      case 'arrow':
        return <Arrow key={ann.id} points={ann.points} stroke={ann.color} strokeWidth={ann.strokeWidth} fill={ann.color} />;
      case 'pen':
        return <Line key={ann.id} points={ann.points} stroke={ann.color} strokeWidth={ann.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" />;
      default:
        return null;
    }
  };

  return (
    <Box style={{ width: '100vw', height: '100vh', cursor: isSelecting ? 'crosshair' : 'default', position: 'relative' }}>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={stageRef}
      >
        <Layer>
          {/* Background image */}
          {image && <KonvaImage image={image} width={window.innerWidth} height={window.innerHeight} />}

          {/* Dark overlay outside crop box */}
          {cropBox && (
            <>
              <Rect x={0} y={0} width={window.innerWidth} height={cropBox.y} fill="rgba(0,0,0,0.4)" />
              <Rect x={0} y={cropBox.y + cropBox.height} width={window.innerWidth} height={window.innerHeight - cropBox.y - cropBox.height} fill="rgba(0,0,0,0.4)" />
              <Rect x={0} y={cropBox.y} width={cropBox.x} height={cropBox.height} fill="rgba(0,0,0,0.4)" />
              <Rect x={cropBox.x + cropBox.width} y={cropBox.y} width={window.innerWidth - cropBox.x - cropBox.width} height={cropBox.height} fill="rgba(0,0,0,0.4)" />

              {/* Crop box border */}
              <Rect x={cropBox.x} y={cropBox.y} width={cropBox.width} height={cropBox.height} stroke="#1890ff" strokeWidth={1} />
            </>
          )}
          {!cropBox && <Rect x={0} y={0} width={window.innerWidth} height={window.innerHeight} fill="rgba(0,0,0,0.2)" />}

          {/* Annotations */}
          {annotations.map(renderAnnotation)}
          {currentAnnotation && renderAnnotation(currentAnnotation)}
        </Layer>
      </Stage>

      {/* Toolbar */}
      {cropBox && cropBox.width > 0 && cropBox.height > 0 && !isSelecting && (
        <Box
          style={{
            position: 'absolute',
            left: Math.max(0, cropBox.x + cropBox.width - 380),
            top: cropBox.y + cropBox.height + 10,
            background: 'white',
            borderRadius: 6,
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            padding: '4px 8px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            zIndex: 10
          }}
        >
          <Group gap={4}>
            <ActionIcon variant={activeTool === 'rect' ? 'filled' : 'subtle'} onClick={() => setActiveTool('rect')}><Square size={16} /></ActionIcon>
            <ActionIcon variant={activeTool === 'circle' ? 'filled' : 'subtle'} onClick={() => setActiveTool('circle')}><CircleIcon size={16} /></ActionIcon>
            <ActionIcon variant={activeTool === 'arrow' ? 'filled' : 'subtle'} onClick={() => setActiveTool('arrow')}><MoveUpRight size={16} /></ActionIcon>
            <ActionIcon variant={activeTool === 'pen' ? 'filled' : 'subtle'} onClick={() => setActiveTool('pen')}><PenTool size={16} /></ActionIcon>
            <ActionIcon variant="subtle" onClick={handleUndo}><Undo size={16} /></ActionIcon>
          </Group>

          <Box style={{ width: 1, height: 20, background: '#e0e0e0', margin: '0 4px' }} />

          <Group gap={4}>
            <ActionIcon variant="subtle" color="blue" onClick={handlePin}><Pin size={16} /></ActionIcon>
            <ActionIcon variant="subtle" color="teal" onClick={handleCopy}><Copy size={16} /></ActionIcon>
            <ActionIcon variant="subtle" color="indigo" onClick={handleSave}><Download size={16} /></ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={handleClose}><X size={16} /></ActionIcon>
            <ActionIcon variant="subtle" color="green" onClick={handleCopy}><Check size={16} /></ActionIcon>
          </Group>
        </Box>
      )}
    </Box>
  );
}
