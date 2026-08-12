import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { ValidationResult } from './appState.ts';
import {
  buildValidationPresentation,
  canTrashValidationRow,
  getValidationRowReason,
} from './validationPresentation.ts';

function row(overrides: Partial<ValidationResult>): ValidationResult {
  return {
    fileName: 'asset',
    filePath: '/project/asset.jpg',
    folderName: 'project',
    ext: '.jpg',
    fileSize: 1024,
    actualWidth: 1080,
    actualHeight: 607,
    status: 'valid',
    ...overrides,
  };
}

describe('buildValidationPresentation', () => {
  it('orders rows by action priority inside each group', () => {
    const presentation = buildValidationPresentation([
      row({ fileName: 'passed', status: 'valid', workspaceProjectName: 'Project A' }),
      row({
        fileName: '[缺失] 1080*170',
        status: 'missing',
        targetSize: '1080*170',
        requiredQuantity: 5,
        actualQuantity: 2,
        missingCount: 3,
        workspaceProjectName: 'Project A',
      }),
      row({ fileName: 'wrong-size', status: 'mismatch', workspaceProjectName: 'Project A' }),
      row({ fileName: 'broken', status: 'error', workspaceProjectName: 'Project A' }),
    ]);

    const [group] = presentation.groups;

    assert.deepStrictEqual(
      group.actionRows.map((item) => item.status),
      ['error', 'mismatch', 'missing'],
    );
    assert.deepStrictEqual(
      group.passedRows.map((item) => item.fileName),
      ['passed'],
    );
  });

  it('summarizes exact blocking, missing, and passed counts', () => {
    const presentation = buildValidationPresentation([
      row({ fileName: 'passed-a', status: 'valid', workspaceProjectName: 'Project A' }),
      row({ fileName: 'passed-b', status: 'valid', workspaceProjectName: 'Project A' }),
      row({ fileName: 'wrong-size', status: 'mismatch', workspaceProjectName: 'Project A' }),
      row({
        fileName: '[缺失] 1080*607',
        status: 'missing',
        targetSize: '1080*607',
        requiredQuantity: 5,
        actualQuantity: 4,
        missingCount: 1,
        workspaceProjectName: 'Project A',
      }),
      row({
        fileName: '[缺失] 1080*170',
        status: 'missing',
        targetSize: '1080*170',
        requiredQuantity: 5,
        actualQuantity: 2,
        missingCount: 3,
        workspaceProjectName: 'Project A',
      }),
    ]);

    assert.strictEqual(presentation.summary.blockingCount, 1);
    assert.strictEqual(presentation.summary.missingRowsCount, 2);
    assert.strictEqual(presentation.summary.missingTotal, 4);
    assert.strictEqual(presentation.summary.passedCount, 2);

    const [group] = presentation.groups;
    assert.strictEqual(group.blockingCount, 1);
    assert.strictEqual(group.missingRowsCount, 2);
    assert.strictEqual(group.missingTotal, 4);
    assert.strictEqual(group.passedCount, 2);
  });

  it('orders groups by severity before clean groups', () => {
    const presentation = buildValidationPresentation([
      row({ fileName: 'clean', status: 'valid', workspaceProjectName: 'Clean Project' }),
      row({
        fileName: '[缺失] 1080*170',
        status: 'missing',
        targetSize: '1080*170',
        missingCount: 1,
        workspaceProjectName: 'Short Project',
      }),
      row({ fileName: 'broken', status: 'error', workspaceProjectName: 'Blocked Project' }),
    ]);

    assert.deepStrictEqual(
      presentation.groups.map((group) => group.folderName),
      ['Blocked Project', 'Short Project', 'Clean Project'],
    );
  });

  it('marks missing-only results as non-blocking when valid files exist', () => {
    const presentation = buildValidationPresentation([
      row({ fileName: 'passed', status: 'valid', workspaceProjectName: 'Project A' }),
      row({
        fileName: '[缺失] 1080*607',
        status: 'missing',
        targetSize: '1080*607',
        requiredQuantity: 5,
        actualQuantity: 4,
        missingCount: 1,
        workspaceProjectName: 'Project A',
      }),
    ]);

    assert.strictEqual(presentation.summary.hasBlockingIssues, false);
    assert.strictEqual(presentation.summary.hasMissingOnlyIssues, true);
    assert.strictEqual(presentation.summary.canRenamePassedFiles, true);
  });

  it('treats empty folders as missing-file feedback before quantity shortages', () => {
    const presentation = buildValidationPresentation([
      row({
        fileName: '[缺失] 文件',
        filePath: '',
        folderName: '-',
        ext: '',
        fileSize: 0,
        actualWidth: 0,
        actualHeight: 0,
        status: 'missing',
        targetSize: '缺失文件',
        requiredQuantity: 5,
        actualQuantity: 0,
        missingCount: 5,
        missingKind: 'empty_folder',
        error: '素材目录内没有可校验文件',
        workspaceProjectName: 'Empty Project',
      }),
      row({
        fileName: '[缺失] 1080*607',
        filePath: '',
        folderName: '-',
        ext: '',
        fileSize: 0,
        actualWidth: 0,
        actualHeight: 0,
        status: 'missing',
        targetSize: '1080*607',
        requiredQuantity: 2,
        actualQuantity: 1,
        missingCount: 1,
        workspaceProjectName: 'Empty Project',
      }),
    ]);

    const [group] = presentation.groups;
    assert.strictEqual(presentation.summary.emptyFolderCount, 1);
    assert.strictEqual(presentation.summary.missingRowsCount, 2);
    assert.strictEqual(presentation.summary.missingTotal, 6);
    assert.deepStrictEqual(group.actionRows.map((item) => item.targetSize), ['缺失文件', '1080*607']);
    assert.strictEqual(getValidationRowReason(group.actionRows[0]), '素材目录为空，请添加素材后重验');
  });

  it('treats files in non-required matching size folders as extra instead of blocking', () => {
    const presentation = buildValidationPresentation([
      row({ fileName: 'passed', status: 'valid', workspaceProjectName: 'Project A' }),
      row({
        fileName: 'extra-size',
        folderName: '1080x607',
        actualWidth: 1080,
        actualHeight: 607,
        status: 'mismatch',
        workspaceProjectName: 'Project A',
      }),
      row({
        fileName: 'wrong-in-folder',
        folderName: '1080x607',
        actualWidth: 900,
        actualHeight: 900,
        status: 'mismatch',
        workspaceProjectName: 'Project A',
      }),
    ]);

    const [group] = presentation.groups;

    assert.strictEqual(presentation.summary.extraCount, 1);
    assert.strictEqual(presentation.summary.blockingCount, 1);
    assert.strictEqual(presentation.summary.canRenamePassedFiles, false);
    assert.deepStrictEqual(group.extraRows.map((item) => item.fileName), ['extra-size']);
    assert.deepStrictEqual(group.blockingRows.map((item) => item.fileName), ['wrong-in-folder']);
  });

  it('allows renaming passed files when the only issue is extra non-required assets', () => {
    const presentation = buildValidationPresentation([
      row({ fileName: 'passed', status: 'valid', workspaceProjectName: 'Project A' }),
      row({
        fileName: 'extra-size',
        folderName: '1080x607',
        actualWidth: 1080,
        actualHeight: 607,
        status: 'mismatch',
        workspaceProjectName: 'Project A',
      }),
    ]);

    assert.strictEqual(presentation.summary.hasBlockingIssues, false);
    assert.strictEqual(presentation.summary.hasExtraIssues, true);
    assert.strictEqual(presentation.summary.canRenamePassedFiles, true);
  });

  it('explains true size errors without pointing users to the left size selector', () => {
    assert.strictEqual(
      getValidationRowReason(row({
        folderName: '1080x607',
        actualWidth: 900,
        actualHeight: 614,
        status: 'mismatch',
      })),
      '目标 1080*607，实际 900*614',
    );

    assert.strictEqual(
      getValidationRowReason(row({
        folderName: '素材',
        actualWidth: 900,
        actualHeight: 614,
        status: 'mismatch',
      })),
      '实际 900*614，不符合需求尺寸',
    );
  });

  it('explains extra assets as skipped non-required material', () => {
    assert.strictEqual(
      getValidationRowReason(row({
        folderName: '1080x607',
        actualWidth: 1080,
        actualHeight: 607,
        status: 'mismatch',
      })),
      '此尺寸不在需求表中，将跳过',
    );
  });

  it('only allows trashing real actionable files', () => {
    assert.strictEqual(canTrashValidationRow(row({ status: 'valid' })), false);
    assert.strictEqual(canTrashValidationRow(row({ status: 'missing', filePath: '' })), false);
    assert.strictEqual(canTrashValidationRow(row({ status: 'mismatch' })), true);
    assert.strictEqual(canTrashValidationRow(row({ status: 'error' })), true);
  });
});
