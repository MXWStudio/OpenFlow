import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');
const organizer = readFileSync(resolve(repoRoot, 'src/renderer/src/views/OrganizerWorkspace.tsx'), 'utf8');
const css = readFileSync(resolve(repoRoot, 'src/renderer/src/index.css'), 'utf8');
const main = readFileSync(resolve(repoRoot, 'src/main/index.ts'), 'utf8');

describe('Organizer workspace responsive contract', () => {
  it('keeps every established Organizer entry visible', () => {
    for (const label of [
      '系统状态',
      '源目录',
      '转移目录',
      '视频转移-奇觅生成',
      '一键扫描',
      '确认转移',
      '撤销转移',
    ]) {
      assert.match(organizer, new RegExp(label));
    }
  });

  it('preserves the established scan, transfer, undo and folder IPC calls', () => {
    assert.match(organizer, /scanOrganizerFolder\(organizerSourceDir, organizerFormats\)/);
    assert.match(organizer, /executeOrganize\(selectedFiles, organizerDestDir, isQimiEnabled\)/);
    assert.match(organizer, /undoOrganize\(\)/);
    assert.match(organizer, /dialog\.selectFolder\(\)/);
    assert.match(organizer, /shell\.openPath\(organizerSourceDir\)/);
    assert.match(organizer, /shell\.openPath\(organizerDestDir\)/);
  });

  it('preserves the original loading and executable-state conditions', () => {
    assert.match(organizer, /loading=\{isScanning\}/);
    assert.match(organizer, /loading=\{isOrganizing\}/);
    assert.match(
      organizer,
      /disabled=\{files\.length === 0 \|\| files\.filter\(file => file\.selected\)\.length === 0\}/,
    );
    assert.match(organizer, /onBusyChange\?\.\(isScanning \|\| isOrganizing \|\| \(files\.length > 0 && !hasOrganized\)\)/);
  });

  it('uses one Organizer page scroll container and a document-flow action bar', () => {
    assert.equal((organizer.match(/<ScrollArea/g) ?? []).length, 1);
    assert.match(organizer, /className="organizer-scroll app-scroll"/);
    assert.match(organizer, /className="organizer-action-bar"/);
    assert.doesNotMatch(organizer, /organizer-floating-actions/);
    assert.match(css, /\.organizer-action-bar\s*\{[\s\S]*?position:\s*static/);
    assert.doesNotMatch(css, /\.organizer-[^{]+\{[^}]*position:\s*fixed/);
  });

  it('constrains the desktop content width and protects shrinkable columns', () => {
    assert.match(css, /\.organizer-content\s*\{[\s\S]*?width:\s*min\(100%, 1280px\)/);
    assert.match(css, /\.organizer-content\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(css, /\.organizer-top-grid\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.organizer-section\s*\{[\s\S]*?min-width:\s*0/);
  });

  it('switches the complete Organizer flow to one column at compact width', () => {
    assert.match(
      css,
      /@media \(max-width: 820px\)[\s\S]*?\.organizer-top-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    assert.match(
      css,
      /@media \(max-width: 820px\)[\s\S]*?\.organizer-directory-control\s*\{[\s\S]*?flex-direction:\s*column/,
    );
    assert.match(
      css,
      /@media \(max-width: 820px\)[\s\S]*?\.organizer-action-buttons\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it('keeps long directories, file names and destination labels shrinkable and discoverable', () => {
    assert.match(css, /\.organizer-path\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
    assert.match(css, /\.organizer-file-copy\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(organizer, /title=\{organizerSourceDir \|\| '未配置源目录'\}/);
    assert.match(organizer, /title=\{organizerDestDir \|\| '未配置转移目录'\}/);
    assert.match(organizer, /truncate title=\{file\.fileName\}/);
    assert.match(organizer, /title=\{destinationLabel\}/);
  });

  it('encodes Windows paths for the established asset preview protocol', () => {
    assert.match(organizer, /src=\{`asset:\/\/\$\{encodeURIComponent\(file\.filePath\)\}`\}/);
    assert.doesNotMatch(organizer, /src=\{`asset:\/\/\$\{file\.filePath\}`\}/);
  });

  it('removes the image element after a preview error instead of exposing a broken image', () => {
    assert.match(organizer, /const \[imageFailed, setImageFailed\] = useState\(false\)/);
    assert.match(organizer, /onError=\{\(\) => setImageFailed\(true\)\}/);
    assert.match(organizer, /imageFailed \? \([\s\S]*?<ImageIcon[\s\S]*?\) : \([\s\S]*?<Image/);
    assert.doesNotMatch(organizer, /fallbackSrc=\{<ImageIcon/);
  });

  it('keeps successful image previews and image fallbacks as distinct states', () => {
    assert.match(organizer, /data-preview-state=\{imageFailed \? 'fallback' : 'image'\}/);
    assert.match(organizer, /aria-label=\{imageFailed \? '图片预览不可用' : '图片文件预览'\}/);
    assert.match(organizer, /alt=""/);
    assert.match(organizer, /<ImageIcon aria-hidden="true"/);
  });

  it('keeps video and image fallback visuals distinguishable', () => {
    assert.match(organizer, /data-preview-state="video"/);
    assert.match(organizer, /aria-label="视频文件预览"/);
    assert.match(organizer, /<PlayCircle aria-hidden="true"/);
    assert.match(organizer, /<ImageIcon aria-hidden="true"/);
  });

  it('holds previews to the established fixed box in every fallback state', () => {
    assert.match(css, /\.organizer-file-preview\s*\{[\s\S]*?width:\s*52px[\s\S]*?height:\s*52px/);
    assert.match(css, /\.organizer-file-preview \.mantine-Image-root\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%/);
  });

  it('uses semantic surfaces without a page-specific dark card implementation', () => {
    assert.match(css, /\.organizer-section\s*\{[\s\S]*?background:\s*var\(--openflow-bg-surface\)/);
    assert.match(css, /\.organizer-empty-state\s*\{[\s\S]*?background:\s*var\(--openflow-bg-subtle\)/);
    assert.doesNotMatch(organizer, /mantine-color-dark|linear-gradient|deepSurface|statusSurface/);
    assert.doesNotMatch(css, /\.organizer-[^{]+\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  it('presents the Qimi behavior as a secondary option, not an orange primary action', () => {
    assert.match(organizer, /<Checkbox[\s\S]*?label="视频转移-奇觅生成"[\s\S]*?checked=\{isQimiEnabled\}/);
    assert.match(organizer, /onToggleQimiEnabled\(event\.currentTarget\.checked\)/);
    assert.doesNotMatch(organizer, /color=\{isQimiEnabled \? ['"]orange/);
  });

  it('keeps keyboard order aligned with the visual Organizer flow', () => {
    const view = organizer.slice(organizer.indexOf('<Box className="organizer-workspace">'));
    const labels = [
      '打开源目录',
      '视频转移-奇觅生成',
      '更改源目录',
      '更改转移目录',
      '撤销转移',
      '一键扫描',
      '确认转移',
    ];
    const indexes = labels.map(label => view.indexOf(label));
    indexes.forEach(index => assert.notEqual(index, -1));
    assert.deepEqual([...indexes].sort((a, b) => a - b), indexes);
    assert.match(organizer, /aria-label=\{`选择 \$\{file\.fileName\}`\}/);
  });

  it('defines compact, default and maximized overflow-safe layout contracts', () => {
    assert.match(css, /\.organizer-workspace\s*\{[\s\S]*?overflow:\s*hidden/);
    assert.match(css, /\.organizer-content\s*\{[\s\S]*?width:\s*min\(100%, 1280px\)/);
    assert.match(css, /\.organizer-file-metadata\s*\{[\s\S]*?flex-wrap:\s*wrap/);
    assert.match(css, /\.organizer-action-buttons\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  });

  it('does not alter the established BrowserWindow sizing contract', () => {
    assert.match(main, /Math\.max\(1080,\s*Math\.floor\(workWidth \* 0\.92\)\)/);
    assert.match(main, /Math\.max\(640,\s*Math\.floor\(workHeight \* 0\.92\)\)/);
    assert.match(main, /minWidth:\s*760/);
    assert.match(main, /minHeight:\s*520/);
  });
});
