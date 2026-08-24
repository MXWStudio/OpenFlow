import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function readCssRule(css: string, selector: string): string {
  const marker = `${selector} {`;
  const start = css.indexOf(marker);
  assert.notStrictEqual(start, -1, `Missing CSS rule for ${selector}`);

  const openBrace = css.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(start, index + 1);
  }

  throw new Error(`Unclosed CSS rule for ${selector}`);
}

describe('format processor responsive contract', () => {
  const formatProcessor = readRepoFile('src/renderer/src/views/FormatProcessor.tsx');
  const css = readRepoFile('src/renderer/src/index.css');
  const main = readRepoFile('src/main/index.ts');

  it('keeps the existing drag and drop event entry points', () => {
    assert.match(formatProcessor, /const handleDragEnter = \(e: React\.DragEvent\)/);
    assert.match(formatProcessor, /const handleDragOver = \(e: React\.DragEvent\)/);
    assert.match(formatProcessor, /const handleDragLeave = \(e: React\.DragEvent\)/);
    assert.match(formatProcessor, /const handleDrop = \(e: React\.DragEvent\)/);
    assert.match(formatProcessor, /onDragEnter=\{handleDragEnter\}/);
    assert.match(formatProcessor, /onDragOver=\{handleDragOver\}/);
    assert.match(formatProcessor, /onDragLeave=\{handleDragLeave\}/);
    assert.match(formatProcessor, /onDrop=\{handleDrop\}/);
  });

  it('keeps the established processing call and disabled condition', () => {
    assert.match(formatProcessor, /window\.electronAPI\.fs\.processFormat\(/);
    assert.match(formatProcessor, /onClick=\{handleProcess\}/);
    assert.match(formatProcessor, /disabled=\{files\.length === 0\}/);
    assert.match(formatProcessor, /loading=\{isProcessing\}/);
  });

  it('keeps every existing processing control and parameter range', () => {
    for (const label of ['调整分辨率', '输出质量压缩', '格式转换', '使用动作拼接文件夹名', '自定义导出目录']) {
      assert.ok(formatProcessor.includes(label), `Missing format control: ${label}`);
    }
    assert.match(formatProcessor, /min=\{1\} max=\{200\}/);
    assert.match(formatProcessor, /min=\{1\} max=\{100\}/);
    assert.match(formatProcessor, /customExportPath/);
  });

  it('uses a bounded two-column desktop workspace', () => {
    const layoutRule = readCssRule(css, '.format-layout');
    assert.match(layoutRule, /width:\s*min\(100%,\s*1320px\)/);
    assert.match(layoutRule, /min-width:\s*0/);
    assert.match(layoutRule, /min-height:\s*0/);
    assert.match(css, /\.format-settings-card\s*\{[^}]*flex:\s*0 0 320px/);
  });

  it('uses one compact vertical scroll path without horizontal overflow', () => {
    assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.format-layout\s*\{[\s\S]*?display:\s*block/);
    assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.format-layout\s*\{[\s\S]*?overflow-x:\s*hidden/);
    assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.format-layout\s*\{[\s\S]*?overflow-y:\s*auto/);
  });

  it('keeps the drop area, settings panel and primary action visible', () => {
    for (const selector of ['.format-empty-state', '.format-settings-card', '.format-start-button']) {
      assert.doesNotMatch(readCssRule(css, selector), /display:\s*none|visibility:\s*hidden/);
    }
    assert.match(readCssRule(css, '.format-start-button'), /position:\s*static/);
    assert.doesNotMatch(css, /\.format-start-button[^}]*position:\s*fixed/);
  });

  it('keeps compact queue and setting content in normal flow', () => {
    assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.format-queue-scroll,[\s\S]*?\.format-settings-scroll\s*\{[\s\S]*?height:\s*auto/);
    assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.format-file-card\s*\{[\s\S]*?min-height:\s*220px/);
    assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.format-settings-card\s*\{[\s\S]*?width:\s*100%/);
  });

  it('does not alter the established BrowserWindow sizing contract', () => {
    assert.match(main, /Math\.max\(1080,\s*Math\.floor\(workWidth \* 0\.92\)\)/);
    assert.match(main, /Math\.max\(640,\s*Math\.floor\(workHeight \* 0\.92\)\)/);
    assert.match(main, /minWidth:\s*760/);
    assert.match(main, /minHeight:\s*520/);
  });
});
