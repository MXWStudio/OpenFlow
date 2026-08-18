import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getWindowBackgroundColor,
  isDarkColorScheme,
  normalizeColorSchemePreference,
  resolveColorSchemePreference,
  toNativeThemeSource,
} from './theme.ts';

describe('normalizeColorSchemePreference', () => {
  it('accepts supported preferences and falls back to auto', () => {
    assert.strictEqual(normalizeColorSchemePreference('light'), 'light');
    assert.strictEqual(normalizeColorSchemePreference('dark'), 'dark');
    assert.strictEqual(normalizeColorSchemePreference('auto'), 'auto');
    assert.strictEqual(normalizeColorSchemePreference('unexpected'), 'auto');
    assert.strictEqual(normalizeColorSchemePreference(undefined), 'auto');
  });
});

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

describe('native window theme mapping', () => {
  it('maps auto to the Electron system theme source', () => {
    assert.strictEqual(toNativeThemeSource('auto'), 'system');
    assert.strictEqual(toNativeThemeSource('light'), 'light');
    assert.strictEqual(toNativeThemeSource('dark'), 'dark');
  });

  it('provides matching startup backgrounds for both schemes', () => {
    assert.strictEqual(getWindowBackgroundColor('light'), '#f8f9fa');
    assert.strictEqual(getWindowBackgroundColor('dark'), '#1a1b1e');
  });
});
