import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDirFromFilePath, formatBytes, dedupeStrings, formatHistoryTime } from './utils.ts';

describe('utils', () => {
  describe('getDirFromFilePath', () => {
    it('should handle Unix-style paths', () => {
      assert.strictEqual(getDirFromFilePath('/path/to/file.txt'), '/path/to');
      assert.strictEqual(getDirFromFilePath('path/to/file.txt'), 'path/to');
    });

    it('should handle Windows-style paths', () => {
      assert.strictEqual(getDirFromFilePath('C:\\path\\to\\file.txt'), 'C:\\path\\to');
    });

    it('should handle Windows root-level files', () => {
      assert.strictEqual(getDirFromFilePath('C:\\file.txt'), 'C:\\');
    });

    it('should handle root-level files', () => {
      assert.strictEqual(getDirFromFilePath('/file.txt'), '/');
    });

    it('should handle paths with no directory', () => {
      assert.strictEqual(getDirFromFilePath('file.txt'), 'file.txt');
    });

    it('should handle trailing slashes', () => {
      assert.strictEqual(getDirFromFilePath('/path/to/dir/'), '/path/to/dir');
    });

    it('should handle empty string', () => {
      assert.strictEqual(getDirFromFilePath(''), '');
    });

    it('should handle root paths', () => {
      assert.strictEqual(getDirFromFilePath('/'), '/');
      assert.strictEqual(getDirFromFilePath('C:\\'), 'C:\\');
    });
  });

  describe('formatBytes', () => {
    it('should handle falsy values', () => {
      assert.strictEqual(formatBytes(0), '-');
      assert.strictEqual(formatBytes(NaN), '-');
    });

    it('should format bytes correctly for B', () => {
      assert.strictEqual(formatBytes(500), '500 B');
      assert.strictEqual(formatBytes(1023), '1023 B');
    });

    it('should format bytes correctly for KB', () => {
      assert.strictEqual(formatBytes(1024), '1.0 KB');
      assert.strictEqual(formatBytes(1024 * 1.5), '1.5 KB');
      assert.strictEqual(formatBytes(1024 * 1024 - 1), '1024.0 KB');
    });

    it('should format bytes correctly for MB', () => {
      assert.strictEqual(formatBytes(1024 * 1024), '1.00 MB');
      assert.strictEqual(formatBytes(1024 * 1024 * 1.5), '1.50 MB');
      assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1024.00 MB');
    });

    it('should handle negative numbers', () => {
      assert.strictEqual(formatBytes(-100), '-100 B');
      assert.strictEqual(formatBytes(-2000), '-2000 B');
    });
  });

  describe('dedupeStrings', () => {
    it('should remove duplicates and falsy values', () => {
      assert.deepStrictEqual(dedupeStrings(['a', 'b', 'a', '', 'c']), ['a', 'b', 'c']);
    });
  });

  describe('formatHistoryTime', () => {
    it('should format "just now"', () => {
      assert.strictEqual(formatHistoryTime(Date.now() - 30000), '刚刚');
    });

    it('should format minutes ago', () => {
      assert.strictEqual(formatHistoryTime(Date.now() - 120000), '2 分钟前');
    });
  });
});
