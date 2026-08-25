import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), 'index.ts');
const source = readFileSync(sourcePath, 'utf8');

describe('main window bounds contract', () => {
  it('supports the validated compact 760x520 minimum', () => {
    assert.match(source, /minWidth:\s*760/);
    assert.match(source, /minHeight:\s*520/);
    assert.doesNotMatch(source, /minWidth:\s*1080/);
    assert.doesNotMatch(source, /minHeight:\s*640/);
  });

  it('keeps the existing default launch size calculation', () => {
    assert.match(source, /const windowWidth = Math\.min\(1440, Math\.max\(1080, Math\.floor\(workWidth \* 0\.92\)\)\)/);
    assert.match(source, /const windowHeight = Math\.min\(900, Math\.max\(640, Math\.floor\(workHeight \* 0\.92\)\)\)/);
    assert.match(source, /width:\s*windowWidth/);
    assert.match(source, /height:\s*windowHeight/);
  });
});
