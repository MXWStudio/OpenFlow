import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { ParsedRequirementJson } from './types/electron.ts';
import {
  buildDailyRequirementSession,
  buildDailyRequirementSessionFromExtraction,
  decideExtractionCandidate,
  formatExtractionTimeLabel,
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

  it('formats a compact local extraction time label', () => {
    assert.strictEqual(
      formatExtractionTimeLabel(new Date(2026, 7, 19, 9, 5).toISOString()),
      '抓取于 09:05',
    );
    assert.strictEqual(formatExtractionTimeLabel('invalid'), '');
    assert.strictEqual(formatExtractionTimeLabel(), '');
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

  it('builds a traceable daily session from a desktop extraction candidate', () => {
    const importedAt = new Date(2026, 7, 19, 10, 30).getTime();
    const session = buildDailyRequirementSessionFromExtraction({
      messageId: '778b833c-7e09-4bb4-9f4d-a8b9f3762ec4',
      extractedAt: new Date(2026, 7, 19, 10, 0).toISOString(),
      receivedAt: new Date(2026, 7, 19, 10, 1).toISOString(),
      extensionVersion: '2.5.3',
      payload: {
        schemaVersion: 'openflow.requirements.v1',
        source: { app: 'OpenFlow', url: 'https://example.test/tasks' },
        extractedAt: new Date(2026, 7, 19, 10, 0).toISOString(),
        warnings: [],
        extraction: { deadline: '2026-08-19', matchedCount: 1, successCount: 1, failedCount: 0, complete: true },
        projects: [{
          taskId: 'task-1',
          projectName: '项目甲',
          sizes: ['1080*1920'],
          requirements: [{ resolution: '1080*1920', requiredQuantity: 2 }],
        }],
      },
    }, importedAt);
    assert.equal(session.source, 'extension');
    assert.equal(session.sourceMessageId, '778b833c-7e09-4bb4-9f4d-a8b9f3762ec4');
    assert.equal(session.fileName, '20260819-扩展自动抓取.json');
    assert.equal(session.projects[0].requirements?.[0].requiredQuantity, 2);
  });

  it('auto-loads only into an empty workflow and otherwise requires confirmation', () => {
    const messageId = '778b833c-7e09-4bb4-9f4d-a8b9f3762ec4';
    assert.equal(decideExtractionCandidate(messageId, '', false), 'auto-load');
    assert.equal(decideExtractionCandidate(messageId, '', true), 'confirm');
    assert.equal(decideExtractionCandidate(messageId, messageId, false), 'ignore');
  });
});
