export type ColorSchemePreference = 'light' | 'dark' | 'auto';
export type ResolvedColorScheme = 'light' | 'dark';
export type NativeThemeSource = 'light' | 'dark' | 'system';

export function normalizeColorSchemePreference(value: unknown): ColorSchemePreference {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto';
}

export function resolveColorSchemePreference(
  preference: ColorSchemePreference,
  systemScheme: ResolvedColorScheme,
): ResolvedColorScheme {
  return preference === 'auto' ? systemScheme : preference;
}

export function isDarkColorScheme(colorScheme: ResolvedColorScheme): boolean {
  return colorScheme === 'dark';
}

export function toNativeThemeSource(preference: ColorSchemePreference): NativeThemeSource {
  return preference === 'auto' ? 'system' : preference;
}

export function getWindowBackgroundColor(colorScheme: ResolvedColorScheme): string {
  return colorScheme === 'dark' ? '#1a1b1e' : '#f8f9fa';
}
