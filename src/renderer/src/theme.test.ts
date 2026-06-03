import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isDarkColorScheme,
  resolveColorSchemePreference,
} from './theme.ts';

describe('resolveColorSchemePreference', () => {
  it('keeps explicit light and dark preferences', () => {
    assert.strictEqual(resolveColorSchemePreference('light', 'dark'), 'light');
    assert.strictEqual(resolveColorSchemePreference('dark', 'light'), 'dark');
  });

  it('resolves auto from the current system scheme', () => {
    assert.strictEqual(resolveColorSchemePreference('auto', 'dark'), 'dark');
    assert.strictEqual(resolveColorSchemePreference('auto', 'light'), 'light');
  });
});

describe('isDarkColorScheme', () => {
  it('identifies only resolved dark as dark', () => {
    assert.strictEqual(isDarkColorScheme('dark'), true);
    assert.strictEqual(isDarkColorScheme('light'), false);
  });
});
