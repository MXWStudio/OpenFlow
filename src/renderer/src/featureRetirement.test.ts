import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('004 cut secondary features', () => {
  it('keeps retained core workflow IPC surfaces available', () => {
    const preload = readRepoFile('src/preload/index.ts');
    const main = readRepoFile('src/main/index.ts');

    for (const retained of [
      'openJson',
      'selectFolder',
      'initFolders',
      'readProjectSizes',
      'startValidation',
      'trashFile',
      'executeRename',
      'scanOrganizerFolder',
      'executeOrganize',
      'undoOrganize',
      'processFormat',
      'openPath',
    ]) {
      assert.match(preload, new RegExp(retained), `preload should retain ${retained}`);
    }

    for (const retainedChannel of [
      'dialog:openJson',
      'dialog:selectFolder',
      'fs:initFolders',
      'fs:readProjectSizes',
      'fs:startValidation',
      'fs:trashFile',
      'fs:executeRename',
      'fs:scanOrganizerFolder',
      'fs:executeOrganize',
      'fs:undoOrganize',
      'fs:processFormat',
      'shell:openPath',
    ]) {
      assert.match(main, new RegExp(retainedChannel), `main should retain ${retainedChannel}`);
    }
  });

  it('removes retired navigation and settings surfaces', () => {
    const app = readRepoFile('src/renderer/src/App.tsx');
    const settings = readRepoFile('src/renderer/src/views/SettingsWorkspace.tsx');
    const organizer = readRepoFile('src/renderer/src/views/OrganizerWorkspace.tsx');

    for (const retired of [
      'AI识图',
      'BitableWorkspace',
      'GameDictionaryWorkspace',
      "'ai'",
      "'bitable'",
      "'dictionary'",
    ]) {
      assert.doesNotMatch(app, new RegExp(retired), `App should not expose ${retired}`);
    }

    for (const retired of [
      'screenshot-control',
      'screenshot-output',
      'screenshot-pin',
      'AI 集成',
      '数据看板',
      'AI识别命名',
      'AiHelpModal',
    ]) {
      assert.doesNotMatch(settings, new RegExp(retired), `Settings should not expose ${retired}`);
    }

    assert.doesNotMatch(organizer, /insertGameMapping|saveImageToLocal|添加到游戏库|BookPlus/);
  });

  it('removes retired runtime channels and entry files', () => {
    const preload = readRepoFile('src/preload/index.ts');
    const main = readRepoFile('src/main/index.ts');
    const viteConfig = readRepoFile('electron.vite.config.ts');

    for (const retired of [
      'screenshot:',
      'pin:',
      'dialog:importExcel',
      'fs:cleanupOldExcels',
      'fs:saveImageToLocal',
      'fs:renameAiBatch',
      'db:getGameMappings',
      'db:getExcelFiles',
    ]) {
      assert.doesNotMatch(preload, new RegExp(retired), `preload should not expose ${retired}`);
      assert.doesNotMatch(main, new RegExp(retired), `main should not handle ${retired}`);
    }

    assert.doesNotMatch(viteConfig, /screenshot\.html|pin\.html/);

    for (const retiredFile of [
      'src/renderer/screenshot.html',
      'src/renderer/pin.html',
      'src/renderer/src/screenshot.tsx',
      'src/renderer/src/pin.tsx',
      'src/renderer/src/views/ScreenshotApp.tsx',
      'src/renderer/src/views/PinApp.tsx',
      'src/renderer/src/views/AiWorkspace.tsx',
      'src/renderer/src/views/BitableWorkspace.tsx',
      'src/renderer/src/views/GameDictionaryWorkspace.tsx',
      'src/renderer/src/views/AiHelpModal.tsx',
      'src/main/utils/db.ts',
    ]) {
      assert.strictEqual(existsSync(join(repoRoot, retiredFile)), false, `${retiredFile} should be removed`);
    }
  });
});
