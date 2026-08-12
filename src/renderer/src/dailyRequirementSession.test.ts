import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { ParsedRequirementJson } from './types/electron.ts';
import {
  buildDailyRequirementSession,
  getLocalDateKey,
  isFreshDailyRequirementSession,
} from './dailyRequirementSession.ts';

const parsedRequirement: ParsedRequirementJson = {
  projectName: '枪神崛起2',
  producerName: '孟祥伟',
  department: '买量',
  email: 'mxw@example.test',
  sizes: ['1080*1920', '1920*1080'],
  projects: [{
    projectName: '枪神崛起2',
    sizes: ['1080*1920', '1920*1080'],
    requirements: [
      { resolution: '1080*1920', requiredQuantity: 2 },
      { resolution: '1920*1080', requiredQuantity: 1 },
    ],
  }],
  rawData: [{ projectName: '枪神崛起2' }],
  fileName: '20260611-孟祥伟数据表.json',
  warnings: ['第 1 条提示'],
};

describe('daily requirement sessions', () => {
  it('formats local date keys without using UTC calendar days', () => {
    assert.strictEqual(getLocalDateKey(new Date(2026, 5, 11, 23, 59, 0)), '2026-06-11');
    assert.strictEqual(getLocalDateKey(new Date(2026, 0, 3, 1, 2, 3)), '2026-01-03');
  });

  it('builds a normalized same-day requirement session snapshot', () => {
    const importedAt = new Date(2026, 5, 11, 10, 30, 0).getTime();
    const session = buildDailyRequirementSession(parsedRequirement, importedAt);

    assert.strictEqual(session.importedAt, importedAt);
    assert.strictEqual(session.importedDateKey, '2026-06-11');
    assert.strictEqual(session.fileName, '20260611-孟祥伟数据表.json');
    assert.strictEqual(session.producerName, '孟祥伟');
    assert.deepStrictEqual(session.sizes, ['1080*1920', '1920*1080']);
    assert.strictEqual(session.projects[0].requirements?.[0].requiredQuantity, 2);
    assert.deepStrictEqual(session.warnings, ['第 1 条提示']);
  });

  it('keeps sessions fresh only on the same local date within 24 hours', () => {
    const session = buildDailyRequirementSession(parsedRequirement, new Date(2026, 5, 11, 9, 0, 0).getTime());

    assert.strictEqual(
      isFreshDailyRequirementSession(session, new Date(2026, 5, 11, 18, 0, 0).getTime()),
      true,
    );
    assert.strictEqual(
      isFreshDailyRequirementSession(session, new Date(2026, 5, 12, 8, 0, 0).getTime()),
      false,
    );
    assert.strictEqual(
      isFreshDailyRequirementSession(session, new Date(2026, 5, 11, 23, 59, 0).getTime() + 24 * 60 * 60 * 1000),
      false,
    );
  });
});
