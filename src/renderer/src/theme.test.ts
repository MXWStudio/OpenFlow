import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getWindowBackgroundColor,
  isDarkColorScheme,
  normalizeColorSchemePreference,
  openFlowBlue,
  openFlowTheme,
  openFlowTokens,
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

describe('OpenFlow design foundation', () => {
  it('uses the documented 4px spacing grid', () => {
    assert.deepStrictEqual(openFlowTokens.spacing, {
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
      8: '32px',
    });
  });

  it('keeps the shell and control dimensions explicit', () => {
    assert.strictEqual(openFlowTokens.shell.sidebarWidth, '68px');
    assert.strictEqual(openFlowTokens.shell.pageHeaderHeight, '76px');
    assert.strictEqual(openFlowTokens.shell.pagePadding, '24px');
    assert.strictEqual(openFlowTokens.controlHeight.regular, '32px');
    assert.strictEqual(openFlowTokens.controlHeight.primary, '36px');
  });

  it('defines the restrained typography and radius scale', () => {
    assert.deepStrictEqual(openFlowTokens.typography.pageTitle, {
      fontSize: '20px',
      lineHeight: '28px',
      fontWeight: 600,
    });
    assert.strictEqual(openFlowTokens.typography.body.fontSize, '14px');
    assert.strictEqual(openFlowTokens.typography.helper.fontSize, '12px');
    assert.strictEqual(openFlowTokens.radius.controlSmall, '6px');
    assert.strictEqual(openFlowTokens.radius.card, '8px');
    assert.strictEqual(openFlowTokens.radius.dropzone, '12px');
  });

  it('registers the OpenFlow blue palette and component defaults', () => {
    assert.strictEqual(openFlowBlue.length, 10);
    assert.strictEqual(openFlowTheme.primaryColor, 'openFlowBlue');
    assert.strictEqual(openFlowTheme.defaultRadius, 'sm');
    assert.deepStrictEqual(openFlowTheme.components.Button.defaultProps, { radius: 'sm' });
    assert.deepStrictEqual(openFlowTheme.components.Card.defaultProps, {
      radius: 'md',
      shadow: 'none',
      withBorder: true,
    });
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
