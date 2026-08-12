import type { ValidationResult } from './appState';

export interface ValidationPresentationSummary {
  totalCount: number;
  blockingCount: number;
  extraCount: number;
  missingRowsCount: number;
  missingTotal: number;
  emptyFolderCount: number;
  passedCount: number;
  hasBlockingIssues: boolean;
  hasExtraIssues: boolean;
  hasMissingIssues: boolean;
  hasMissingOnlyIssues: boolean;
  canRenamePassedFiles: boolean;
}

export interface ValidationPresentationGroup extends ValidationPresentationSummary {
  folderName: string;
  rows: ValidationResult[];
  actionRows: ValidationResult[];
  blockingRows: ValidationResult[];
  extraRows: ValidationResult[];
  missingRows: ValidationResult[];
  passedRows: ValidationResult[];
}

export interface ValidationPresentation {
  groups: ValidationPresentationGroup[];
  summary: ValidationPresentationSummary;
}

function getFolderName(row: ValidationResult) {
  return row.workspaceProjectName || row.folderName || '未命名项目';
}

function normalizeResolutionLabel(value: string | undefined) {
  return (value || '').trim().replace(/[xX×-]/g, '*');
}

function getActualResolution(row: ValidationResult) {
  if (!row.actualWidth || !row.actualHeight) return '';
  return `${row.actualWidth}*${row.actualHeight}`;
}

function isSizeFolderName(value: string | undefined) {
  return /^\d+\*\d+$/.test(normalizeResolutionLabel(value));
}

export function isExtraValidationRow(row: ValidationResult) {
  if (row.status !== 'mismatch') return false;
  return normalizeResolutionLabel(row.folderName) === getActualResolution(row);
}

export function isBlockingValidationRow(row: ValidationResult) {
  return row.status !== 'valid' && row.status !== 'missing' && !isExtraValidationRow(row);
}

export type ValidationRowKind = 'blocking' | 'extra' | 'missing' | 'passed';

export function getValidationRowKind(row: ValidationResult): ValidationRowKind {
  if (row.status === 'valid') return 'passed';
  if (row.status === 'missing') return 'missing';
  if (isExtraValidationRow(row)) return 'extra';
  return 'blocking';
}

export function canTrashValidationRow(row: ValidationResult) {
  const kind = getValidationRowKind(row);
  return Boolean(row.filePath) && kind !== 'passed' && kind !== 'missing';
}

export function getValidationRowReason(row: ValidationResult) {
  const kind = getValidationRowKind(row);
  if (kind === 'extra') return '此尺寸不在需求表中，将跳过';

  if (row.status === 'mismatch') {
    const actualResolution = getActualResolution(row);
    const folderResolution = normalizeResolutionLabel(row.folderName);
    if (actualResolution && isSizeFolderName(row.folderName) && folderResolution !== actualResolution) {
      return `目标 ${folderResolution}，实际 ${actualResolution}`;
    }
    if (actualResolution) return `实际 ${actualResolution}，不符合需求尺寸`;
    return '实际尺寸不符合需求尺寸';
  }

  if (row.status === 'error' || row.status === 'format_error') {
    return row.error || '无法读取尺寸，可能文件损坏或格式不支持';
  }

  if (row.status === 'missing') {
    if (row.missingKind === 'empty_folder') {
      return '素材目录为空，请添加素材后重验';
    }
    const required = row.requiredQuantity || row.missingCount || 1;
    const actual = row.actualQuantity || 0;
    return `需要 ${required} / 已有 ${actual}`;
  }

  return row.ext;
}

function getMissingCount(row: ValidationResult) {
  return row.status === 'missing' ? row.missingCount || 1 : 0;
}

function getRowPriority(row: ValidationResult) {
  if (row.status === 'error' || row.status === 'format_error') return 0;
  if (getValidationRowKind(row) === 'blocking') return 1;
  if (row.status === 'missing' && row.missingKind === 'empty_folder') return 2;
  if (row.status === 'missing') return 3;
  if (isExtraValidationRow(row)) return 4;
  return 5;
}

function getSortLabel(row: ValidationResult) {
  return row.targetSize || row.fileName || '';
}

function compareRows(a: ValidationResult, b: ValidationResult) {
  const priorityDiff = getRowPriority(a) - getRowPriority(b);
  if (priorityDiff !== 0) return priorityDiff;
  return getSortLabel(a).localeCompare(getSortLabel(b), 'zh-CN');
}

function summarizeRows(rows: ValidationResult[]): ValidationPresentationSummary {
  const blockingCount = rows.filter(isBlockingValidationRow).length;
  const extraCount = rows.filter(isExtraValidationRow).length;
  const missingRows = rows.filter((row) => row.status === 'missing');
  const emptyFolderCount = missingRows.filter((row) => row.missingKind === 'empty_folder').length;
  const passedCount = rows.filter((row) => row.status === 'valid').length;
  const missingTotal = missingRows.reduce((sum, row) => sum + getMissingCount(row), 0);
  const hasBlockingIssues = blockingCount > 0;
  const hasExtraIssues = extraCount > 0;
  const hasMissingIssues = missingRows.length > 0;

  return {
    totalCount: rows.length,
    blockingCount,
    extraCount,
    missingRowsCount: missingRows.length,
    missingTotal,
    emptyFolderCount,
    passedCount,
    hasBlockingIssues,
    hasExtraIssues,
    hasMissingIssues,
    hasMissingOnlyIssues: hasMissingIssues && !hasBlockingIssues,
    canRenamePassedFiles: passedCount > 0 && !hasBlockingIssues,
  };
}

function getGroupPriority(group: ValidationPresentationGroup) {
  if (group.hasBlockingIssues) return 0;
  if (group.hasMissingIssues) return 1;
  if (group.hasExtraIssues) return 2;
  return 3;
}

export function buildValidationPresentation(rows: ValidationResult[]): ValidationPresentation {
  const groups = new Map<string, ValidationResult[]>();

  for (const row of rows) {
    const folderName = getFolderName(row);
    const groupRows = groups.get(folderName) || [];
    groupRows.push(row);
    groups.set(folderName, groupRows);
  }

  const presentationGroups = Array.from(groups.entries()).map(([folderName, groupRows]) => {
    const blockingRows = groupRows.filter(isBlockingValidationRow).sort(compareRows);
    const extraRows = groupRows.filter(isExtraValidationRow).sort(compareRows);
    const missingRows = groupRows.filter((row) => row.status === 'missing').sort(compareRows);
    const passedRows = groupRows.filter((row) => row.status === 'valid').sort(compareRows);
    const actionRows = [...blockingRows, ...missingRows, ...extraRows];
    const summary = summarizeRows(groupRows);

    return {
      folderName,
      rows: [...actionRows, ...passedRows],
      actionRows,
      blockingRows,
      extraRows,
      missingRows,
      passedRows,
      ...summary,
    };
  });

  presentationGroups.sort((a, b) => {
    const priorityDiff = getGroupPriority(a) - getGroupPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.folderName.localeCompare(b.folderName, 'zh-CN');
  });

  return {
    groups: presentationGroups,
    summary: summarizeRows(rows),
  };
}
