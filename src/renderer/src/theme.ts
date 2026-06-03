export type ColorSchemePreference = 'light' | 'dark' | 'auto';
export type ResolvedColorScheme = 'light' | 'dark';

export function resolveColorSchemePreference(
  preference: ColorSchemePreference,
  systemScheme: ResolvedColorScheme,
): ResolvedColorScheme {
  return preference === 'auto' ? systemScheme : preference;
}

export function isDarkColorScheme(colorScheme: ResolvedColorScheme): boolean {
  return colorScheme === 'dark';
}
