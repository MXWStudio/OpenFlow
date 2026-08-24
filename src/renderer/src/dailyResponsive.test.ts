import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');
const daily = readFileSync(resolve(repoRoot, 'src/renderer/src/views/DailyWorkspace.tsx'), 'utf8');
const css = readFileSync(resolve(repoRoot, 'src/renderer/src/index.css'), 'utf8');
const main = readFileSync(resolve(repoRoot, 'src/main/index.ts'), 'utf8');

describe('Daily workspace responsive contract', () => {
  it('keeps every established Daily entry visible', () => {
    for (const label of [
      '导入需求表',
      '创建今日目录',
      '上传素材',
      '命名方式',
      '尺寸目标',
      '开始校验',
      '执行重命名',
    ]) {
      assert.match(daily, new RegExp(label));
    }
  });

  it('preserves the established Daily action handlers', () => {
    assert.match(daily, /onClick=\{onChangeJson\}/);
    assert.match(daily, /onClick=\{onInitFolders\}/);
    assert.match(daily, /onClick=\{onAddFolder\}/);
    assert.match(daily, /onClick=\{onValidate\}/);
    assert.match(daily, /onClick=\{onRename\}/);
    assert.match(daily, /onRemoveFolder\(path\)/);
  });

  it('preserves loading and executable-state conditions', () => {
    assert.match(daily, /loading=\{isChangingJson\}/);
    assert.match(daily, /loading=\{isValidating\}/);
    assert.match(daily, /loading=\{isRenaming\}/);
    assert.match(daily, /disabled=\{!canRename\}/);
  });

  it('uses one Daily page scroll container', () => {
    assert.equal((daily.match(/className="daily-scroll"/g) ?? []).length, 1);
    assert.match(daily, /<ScrollArea className="daily-scroll"/);
    assert.match(css, /\.daily-scroll\s*\{[\s\S]*?min-height:\s*0/);
  });

  it('places actions in document flow without a Daily overlay', () => {
    assert.match(css, /\.daily-actions\s*\{[\s\S]*?position:\s*static/);
    assert.doesNotMatch(daily, /className="daily-actions"[\s\S]{0,400}position:\s*['"]absolute/);
    assert.doesNotMatch(css, /\.daily-actions\s*\{[^}]*position:\s*(?:fixed|absolute|sticky)/);
  });

  it('constrains wide content and protects shrinkable columns', () => {
    assert.match(css, /\.daily-content\s*\{[\s\S]*?width:\s*min\(100%, 1280px\)/);
    assert.match(css, /\.daily-layout\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(css, /\.daily-sidebar,[\s\S]*?\.daily-main\s*\{[\s\S]*?min-width:\s*0/);
  });

  it('switches the complete Daily flow to one column at compact width', () => {
    assert.match(
      css,
      /@media \(max-width: 820px\)[\s\S]*?\.daily-layout,[\s\S]*?\.daily-upload-grid\s*\{[\s\S]*?flex-direction:\s*column/,
    );
    assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.daily-content\s*\{[\s\S]*?padding:/);
  });

  it('renders the four-step overview from established state only', () => {
    assert.match(daily, /\{ label: '今日需求', active: projectsCount > 0 \}/);
    assert.match(daily, /\{ label: '项目目录', active: projectsCount > 0 \}/);
    assert.match(daily, /\{ label: '上传素材', active: folderPaths\.length > 0 \}/);
    assert.match(daily, /\{ label: '校验处理', active: hasValidated \|\| canRename \}/);
  });

  it('keeps all established naming choices and preview states', () => {
    assert.match(daily, /label: '常规', value: 'regular'/);
    assert.match(daily, /label: '特殊', value: 'special'/);
    assert.match(daily, /label: '自定义', value: 'custom'/);
    assert.match(daily, /真实文件名预览/);
    assert.match(daily, /renamePreview\?\.canExecute/);
  });

  it('keeps requirement, detected and manual size semantics', () => {
    assert.match(daily, /requirementSizes\.map/);
    assert.match(daily, /detectedFolderSizes\.map/);
    assert.match(daily, /manualTargetSizes\.includes\(size\)/);
    assert.match(daily, /onToggleManualSize\(size\)/);
  });

  it('presents only the currently executable action as primary', () => {
    assert.match(daily, /variant=\{canRename \? 'default' : 'filled'\}/);
    assert.match(daily, /disabled=\{!canRename\}/);
    assert.doesNotMatch(daily, /color="teal"[\s\S]{0,200}执行重命名/);
  });

  it('keeps long directory names and paths discoverable', () => {
    assert.match(daily, /title=\{getFolderName\(path\)\}/);
    assert.match(daily, /title=\{path\}/);
    assert.match(daily, /style=\{\{ overflowWrap: 'anywhere' \}\}/);
    assert.match(css, /\.daily-sidebar,[\s\S]*?\.daily-main\s*\{[\s\S]*?min-width:\s*0/);
  });

  it('gives destructive folder controls a specific accessible name', () => {
    assert.match(daily, /aria-label=\{`删除目录 \$\{getFolderName\(path\)\}`\}/);
    assert.match(css, /:where\(button,[\s\S]*?:focus-visible\s*\{[\s\S]*?outline:/);
  });

  it('uses semantic surfaces without page-specific color literals', () => {
    assert.match(css, /\.daily-workspace\s*\{[\s\S]*?background:\s*var\(--openflow-bg-canvas\)/);
    assert.match(css, /\.daily-flow-card,[\s\S]*?background:\s*var\(--openflow-bg-surface\)/);
    assert.doesNotMatch(css, /\.daily-[^{]+\{[^}]*#[0-9a-fA-F]{3,8}/);
    assert.doesNotMatch(daily, /linear-gradient/);
  });

  it('preserves compact keyboard order for validate then rename', () => {
    const actionStart = daily.indexOf('className="daily-action-buttons"');
    const actionView = daily.slice(actionStart);
    assert.ok(actionStart > 0);
    assert.ok(actionView.indexOf('onClick={onValidate}') < actionView.indexOf('onClick={onRename}'));
  });

  it('does not alter the established BrowserWindow sizing contract', () => {
    assert.match(main, /Math\.max\(1080,\s*Math\.floor\(workWidth \* 0\.92\)\)/);
    assert.match(main, /Math\.max\(640,\s*Math\.floor\(workHeight \* 0\.92\)\)/);
    assert.match(main, /minWidth:\s*760/);
    assert.match(main, /minHeight:\s*520/);
  });

  it('keeps requirement provenance and pending extraction affordances', () => {
    assert.match(daily, /projectsCount > 0 \? jsonFileName : '暂未导入需求表'/);
    assert.match(daily, /\{extractionTimeLabel &&/);
    assert.match(daily, /pendingExtractionCount > 0/);
    assert.match(daily, /onClick=\{onShowPendingExtraction\}/);
  });

  it('keeps directory drop extraction connected to the established callback', () => {
    assert.match(daily, /const paths = extractDroppedPaths\(event\)/);
    assert.match(daily, /if \(paths\.length > 0\) onDropPaths\(paths\)/);
    assert.match(daily, /event\.preventDefault\(\)/);
    assert.match(daily, /event\.stopPropagation\(\)/);
  });

  it('keeps add and clear controls available after directories are present', () => {
    assert.match(daily, /folderPaths\.length > 0 && \(/);
    assert.match(daily, /onClick=\{onAddFolder\}[\s\S]*?>\s*添加/);
    assert.match(daily, /onClick=\{onClearFolders\}[\s\S]*?>\s*清空/);
  });

  it('keeps grouped validation details and actionable file protection', () => {
    assert.match(daily, /buildValidationPresentation\(validationResults\)/);
    assert.match(daily, /groupedPreviewRows\.map/);
    assert.match(daily, /canTrashValidationRow\(row\)/);
    assert.match(daily, /onTrashValidationFile\(row\)/);
  });

  it('keeps failed rename retry scoped to the established failure state', () => {
    assert.match(daily, /hasFailedRenameItems && \(/);
    assert.match(daily, /loading=\{isRenaming\} onClick=\{onRetryFailed\}/);
    assert.match(daily, /仅重试失败项/);
  });

  it('keeps successful rename folder access tied to returned paths', () => {
    assert.match(daily, /hasFinishedRenaming && \(/);
    assert.match(daily, /if \(lastRenamedPaths\.length > 0\) onOpenFolder\(lastRenamedPaths\[0\]\)/);
    assert.match(daily, /打开对应文件夹/);
  });

  it('derives status messaging only from established validation states', () => {
    assert.match(daily, /if \(isValidating\)/);
    assert.match(daily, /if \(hasIssues && blockingIssueCount > 0\)/);
    assert.match(daily, /if \(hasIssues && emptyFolderCount > 0\)/);
    assert.match(daily, /if \(hasValidated\)/);
    assert.match(daily, /if \(hasFinishedRenaming\)/);
  });

  it('compresses the compact overview into four equal columns', () => {
    assert.match(
      css,
      /@media \(max-width: 820px\)[\s\S]*?\.daily-flow-card > \.mantine-Stack-root\s*\{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/,
    );
  });

  it('keeps the action panel inside the Daily scroll content', () => {
    const contentStart = daily.indexOf('<Box className="daily-content">');
    const actionStart = daily.indexOf('className="daily-actions"');
    const contentEnd = daily.indexOf('</ScrollArea>', actionStart);
    assert.ok(contentStart > 0);
    assert.ok(actionStart > contentStart);
    assert.ok(contentEnd > actionStart);
  });

  it('keeps horizontal, square and vertical manual size groups', () => {
    assert.match(daily, /renderSizeButtons\('横版与方形', horizontalManualSizes\)/);
    assert.match(daily, /renderSizeButtons\('竖版', verticalManualSizes\)/);
    assert.match(daily, /variant=\{active \? 'filled' : 'default'\}/);
  });

  it('does not introduce an IPC or configuration dependency into the view', () => {
    assert.doesNotMatch(daily, /window\.api|ipcRenderer|configStore|electron/);
  });

  it('keeps the compact action buttons equal-width and readable', () => {
    assert.match(
      css,
      /@media \(max-width: 820px\)[\s\S]*?\.daily-action-buttons\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/,
    );
    assert.match(css, /\.daily-action-buttons \.mantine-Button-root\s*\{[\s\S]*?min-height:/);
  });
});
