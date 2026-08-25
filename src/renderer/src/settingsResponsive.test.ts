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

describe('settings center responsive contract', () => {
  const settings = readRepoFile('src/renderer/src/views/SettingsWorkspace.tsx');
  const css = readRepoFile('src/renderer/src/index.css');

  it('keeps all six setting destinations in their established order', () => {
    const destinations = [...settings.matchAll(/<Tabs\.Tab value="([^"]+)"[\s\S]*?\}>([^<]+)<\/Tabs\.Tab>/g)]
      .map((match) => ({ value: match[1], label: match[2] }));

    assert.deepStrictEqual(destinations, [
      { value: 'system', label: '常规' },
      { value: 'account', label: '账户' },
      { value: 'workspace', label: '工作区' },
      { value: 'templates', label: '命名模板' },
      { value: 'shortcuts', label: '快捷键' },
      { value: 'about', label: '关于' },
    ]);
  });

  it('uses one vertical navigation column without inline style overrides', () => {
    assert.match(settings, /orientation="vertical"/);
    assert.match(settings, /list: 'settings-navigation'/);
    assert.match(settings, /tab: 'settings-navigation-item'/);
    assert.match(settings, /panel: 'settings-content'/);
    assert.doesNotMatch(settings, /\.mantine-Tabs-tab\[data-active\]/);

    const navigationRule = readCssRule(css, '.settings-navigation');
    assert.match(navigationRule, /flex-direction:\s*column/);
    assert.match(navigationRule, /flex-wrap:\s*nowrap/);
    assert.match(navigationRule, /min-height:\s*0/);
    assert.match(navigationRule, /overflow-y:\s*auto/);
  });

  it('allows the content column to shrink and scroll without page overflow', () => {
    const bodyRule = readCssRule(css, '.settings-body');
    const contentRule = readCssRule(css, '.settings-content');

    assert.match(bodyRule, /overflow:\s*hidden/);
    assert.match(contentRule, /min-width:\s*0/);
    assert.match(contentRule, /min-height:\s*0/);
    assert.match(contentRule, /overflow-x:\s*hidden/);
    assert.match(contentRule, /overflow-y:\s*auto/);
    assert.match(css, /\.settings-content > :first-child[\s\S]*?max-width:\s*840px/);
  });

  it('keeps compact and zoomed layouts reachable instead of hiding entries', () => {
    assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.settings-navigation/);
    assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.settings-field-row[\s\S]*?flex-direction:\s*column/);
    assert.match(css, /@media \(max-height: 720px\)[\s\S]*?\.settings-navigation-item[\s\S]*?min-height:\s*30px/);
    assert.doesNotMatch(css, /\.settings-navigation[^}]*display:\s*none/);
  });
});
