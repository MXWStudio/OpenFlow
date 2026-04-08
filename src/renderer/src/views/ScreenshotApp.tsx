import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Arrow, Line, Text as KonvaText, Group as KonvaGroup } from 'react-konva';
import useImage from 'use-image';
import { Box, ActionIcon, Group, Tooltip, Stack, ColorInput, Slider, Text, TextInput, Divider } from '@mantine/core';
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
  Check,
  Hash
} from 'lucide-react';
import Konva from 'konva';

type Tool = 'select' | 'rect' | 'circle' | 'arrow' | 'line' | 'pen' | 'text' | 'mosaic' | 'eraser';

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

  // Text input state
  const [isEditingText, setIsEditingText] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Listen for image data from main process
    if (window.electronAPI && window.electronAPI.screenshot) {
      window.electronAPI.screenshot.onScreenshotCaptured((dataUrl: string) => {
        setImgUrl(dataUrl);
      });
    }
  }, []);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    if (!cropBox) {
      // Start crop selection
      setIsSelecting(true);
      setSelectionStart(pos);
      setCropBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    if (activeTool === 'select') return;

    if (activeTool === 'text') {
      setIsEditingText(true);
      setTextPos(pos);
      setTextValue('');
      return;
    }

    // Start drawing annotation
    const newId = Date.now().toString();
    const baseAnnotation = {
      id: newId,
      type: activeTool,
      x: pos.x,
      y: pos.y,
      color: activeTool === 'mosaic' ? 'rgba(0,0,0,0.5)' : strokeColor,
      strokeWidth: activeTool === 'mosaic' ? 20 : strokeWidth,
    };

    if (activeTool === 'pen' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'eraser' || activeTool === 'mosaic') {
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
      if (prev.type === 'pen' || prev.type === 'eraser' || prev.type === 'mosaic') {
        return { ...prev, points: [...(prev.points || []), pos.x, pos.y] };
      } else if (prev.type === 'line' || prev.type === 'arrow') {
        return { ...prev, points: [(prev.points || [])[0], (prev.points || [])[1], pos.x, pos.y] };
      } else if (prev.type === 'rect') {
        return {
          ...prev,
          x: Math.min(pos.x, selectionStart?.x || prev.x),
          y: Math.min(pos.y, selectionStart?.y || prev.y),
          width: Math.abs(pos.x - (selectionStart?.x || prev.x)),
          height: Math.abs(pos.y - (selectionStart?.y || prev.y)),
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
      return;
    }

    if (currentAnnotation) {
      setAnnotations([...annotations, currentAnnotation]);
      setCurrentAnnotation(null);
    }
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'text',
        x: textPos.x,
        y: textPos.y,
        text: textValue,
        color: strokeColor,
        strokeWidth: strokeWidth,
      };
      setAnnotations([...annotations, newAnnotation]);
    }
    setIsEditingText(false);
    setTextValue('');
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

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingText) {
          setIsEditingText(false);
          return;
        }
        if (cropBox) {
          setCropBox(null);
          setAnnotations([]);
        } else {
          handleClose();
        }
      } else if (e.key === 'Enter' && isEditingText) {
        handleTextSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cropBox, isEditingText, textValue]);

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
      case 'eraser':
        return <Line key={ann.id} points={ann.points} stroke="white" strokeWidth={ann.strokeWidth} globalCompositeOperation="destination-out" tension={0.5} lineCap="round" lineJoin="round" />;
      case 'mosaic':
        // Simplified mosaic: thick translucent lines
        return <Line key={ann.id} points={ann.points} stroke={ann.color} strokeWidth={ann.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" opacity={0.6} />;
      case 'text':
        return <KonvaText key={ann.id} x={ann.x} y={ann.y} text={ann.text} fontSize={ann.strokeWidth * 5} fill={ann.color} />;
      default:
        return null;
    }
  };

  return (
    <Box style={{ width: '100vw', height: '100vh', cursor: isSelecting ? 'crosshair' : 'default', position: 'relative', overflow: 'hidden' }}>
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
              <Rect x={0} y={0} width={window.innerWidth} height={cropBox.y} fill="rgba(0,0,0,0.5)" />
              <Rect x={0} y={cropBox.y + cropBox.height} width={window.innerWidth} height={window.innerHeight - cropBox.y - cropBox.height} fill="rgba(0,0,0,0.5)" />
              <Rect x={0} y={cropBox.y} width={cropBox.x} height={cropBox.height} fill="rgba(0,0,0,0.5)" />
              <Rect x={cropBox.x + cropBox.width} y={cropBox.y} width={window.innerWidth - cropBox.x - cropBox.width} height={cropBox.height} fill="rgba(0,0,0,0.5)" />

              {/* Crop box border */}
              <Rect x={cropBox.x} y={cropBox.y} width={cropBox.width} height={cropBox.height} stroke="#007AFF" strokeWidth={2} />
              
              {/* Size indicator */}
              <KonvaGroup x={cropBox.x} y={cropBox.y - 25}>
                <Rect width={100} height={20} fill="rgba(0,122,255,0.8)" cornerRadius={4} />
                <KonvaText text={`${Math.round(cropBox.width)} x ${Math.round(cropBox.height)}`} fill="white" fontSize={12} padding={5} />
              </KonvaGroup>
            </>
          )}
          {!cropBox && <Rect x={0} y={0} width={window.innerWidth} height={window.innerHeight} fill="rgba(0,0,0,0.3)" />}

          {/* Annotations */}
          {annotations.map(renderAnnotation)}
          {currentAnnotation && renderAnnotation(currentAnnotation)}
        </Layer>
      </Stage>

      {/* Text input overlay */}
      {isEditingText && (
        <Box
          style={{
            position: 'absolute',
            left: textPos.x,
            top: textPos.y,
            zIndex: 100
          }}
        >
          <TextInput
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.currentTarget.value)}
            onBlur={handleTextSubmit}
            variant="filled"
            placeholder="输入文字..."
            styles={{ input: { color: strokeColor, fontWeight: 'bold' } }}
          />
        </Box>
      )}

      {/* Toolbar */}
      {cropBox && cropBox.width > 0 && cropBox.height > 0 && !isSelecting && (
        <Box
          style={{
            position: 'absolute',
            left: Math.max(10, Math.min(window.innerWidth - 500, cropBox.x + cropBox.width - 480)),
            top: Math.min(window.innerHeight - 100, cropBox.y + cropBox.height + 10),
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 10
          }}
        >
          <Group gap={4}>
            <Tooltip label="矩形"><ActionIcon variant={activeTool === 'rect' ? 'filled' : 'subtle'} onClick={() => setActiveTool('rect')}><Square size={18} /></ActionIcon></Tooltip>
            <Tooltip label="圆形"><ActionIcon variant={activeTool === 'circle' ? 'filled' : 'subtle'} onClick={() => setActiveTool('circle')}><CircleIcon size={18} /></ActionIcon></Tooltip>
            <Tooltip label="箭头"><ActionIcon variant={activeTool === 'arrow' ? 'filled' : 'subtle'} onClick={() => setActiveTool('arrow')}><MoveUpRight size={18} /></ActionIcon></Tooltip>
            <Tooltip label="折线"><ActionIcon variant={activeTool === 'line' ? 'filled' : 'subtle'} onClick={() => setActiveTool('line')}><Minus size={18} /></ActionIcon></Tooltip>
            <Tooltip label="画笔"><ActionIcon variant={activeTool === 'pen' ? 'filled' : 'subtle'} onClick={() => setActiveTool('pen')}><PenTool size={18} /></ActionIcon></Tooltip>
            <Tooltip label="文字"><ActionIcon variant={activeTool === 'text' ? 'filled' : 'subtle'} onClick={() => setActiveTool('text')}><Type size={18} /></ActionIcon></Tooltip>
            <Tooltip label="马赛克"><ActionIcon variant={activeTool === 'mosaic' ? 'filled' : 'subtle'} onClick={() => setActiveTool('mosaic')}><Hash size={18} /></ActionIcon></Tooltip>
            <Tooltip label="橡皮擦"><ActionIcon variant={activeTool === 'eraser' ? 'filled' : 'subtle'} onClick={() => setActiveTool('eraser')}><Eraser size={18} /></ActionIcon></Tooltip>
            
            <Box style={{ width: 1, height: 24, background: '#eee', margin: '0 8px' }} />
            
            <Tooltip label="撤销"><ActionIcon variant="subtle" onClick={handleUndo} disabled={annotations.length === 0}><Undo size={18} /></ActionIcon></Tooltip>
            
            <Box style={{ width: 1, height: 24, background: '#eee', margin: '0 8px' }} />

            <Tooltip label="贴图"><ActionIcon variant="subtle" color="blue" onClick={handlePin}><Pin size={18} /></ActionIcon></Tooltip>
            <Tooltip label="保存"><ActionIcon variant="subtle" color="indigo" onClick={handleSave}><Download size={18} /></ActionIcon></Tooltip>
            <Tooltip label="关闭"><ActionIcon variant="subtle" color="red" onClick={handleClose}><X size={18} /></ActionIcon></Tooltip>
            <Tooltip label="完成 (复制)"><ActionIcon variant="filled" color="green" onClick={handleCopy}><Check size={18} /></ActionIcon></Tooltip>
          </Group>

          <Divider />

          <Group gap="lg">
            <Group gap={8}>
              <Text size="xs" fw={700} c="dimmed">颜色</Text>
              <Group gap={4}>
                {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000'].map(c => (
                  <Box
                    key={c}
                    onClick={() => setStrokeColor(c)}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      border: strokeColor === c ? '2px solid #007AFF' : '1px solid #ddd',
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
              </Group>
            </Group>
            
            <Group gap={8} flex={1}>
              <Text size="xs" fw={700} c="dimmed">粗细</Text>
              <Slider
                flex={1}
                value={strokeWidth}
                onChange={setStrokeWidth}
                min={1}
                max={20}
                label={null}
                styles={{ thumb: { width: 12, height: 12 } }}
              />
            </Group>
          </Group>
        </Box>
      )}
    </Box>
  );
}
