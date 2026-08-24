import { createTheme, type MantineColorsTuple } from '@mantine/core';

export const openFlowTokens = {
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
  },
  typography: {
    pageTitle: { fontSize: '20px', lineHeight: '28px', fontWeight: 600 },
    sectionTitle: { fontSize: '16px', lineHeight: '24px', fontWeight: 600 },
    body: { fontSize: '14px', lineHeight: '20px', fontWeight: 400 },
    control: { fontSize: '14px', lineHeight: '20px', fontWeight: 600 },
    helper: { fontSize: '12px', lineHeight: '18px', fontWeight: 400 },
  },
  radius: {
    controlSmall: '6px',
    control: '8px',
    card: '8px',
    dropzone: '12px',
    pill: '999px',
  },
  controlHeight: {
    regular: '32px',
    primary: '36px',
  },
  shell: {
    sidebarWidth: '68px',
    pageHeaderHeight: '76px',
    pagePadding: '24px',
  },
  shadow: {
    floating: '0 8px 24px rgba(15, 23, 42, 0.14)',
    floatingDark: '0 8px 24px rgba(0, 0, 0, 0.36)',
  },
} as const;

export const openFlowBlue: MantineColorsTuple = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#172554',
];

export const openFlowTheme = createTheme({
  primaryColor: 'openFlowBlue',
  primaryShade: { light: 6, dark: 5 },
  colors: {
    openFlowBlue,
  },
  defaultRadius: 'sm',
  fontFamily: '"Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
  fontFamilyMonospace: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '14px',
    lg: '16px',
    xl: '20px',
  },
  lineHeights: {
    xs: '18px',
    sm: '20px',
    md: '20px',
    lg: '24px',
    xl: '28px',
  },
  spacing: {
    xs: openFlowTokens.spacing[1],
    sm: openFlowTokens.spacing[2],
    md: openFlowTokens.spacing[3],
    lg: openFlowTokens.spacing[4],
    xl: openFlowTokens.spacing[6],
    xxl: openFlowTokens.spacing[8],
  },
  radius: {
    xs: openFlowTokens.radius.controlSmall,
    sm: openFlowTokens.radius.controlSmall,
    md: openFlowTokens.radius.control,
    lg: openFlowTokens.radius.dropzone,
    xl: openFlowTokens.radius.dropzone,
  },
  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
    sm: '0 2px 8px rgba(15, 23, 42, 0.08)',
    md: openFlowTokens.shadow.floating,
    lg: openFlowTokens.shadow.floating,
    xl: openFlowTokens.shadow.floating,
  },
  headings: {
    fontFamily: '"Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    fontWeight: '600',
    sizes: {
      h1: openFlowTokens.typography.pageTitle,
      h2: openFlowTokens.typography.pageTitle,
      h3: openFlowTokens.typography.pageTitle,
      h4: openFlowTokens.typography.sectionTitle,
      h5: openFlowTokens.typography.sectionTitle,
      h6: openFlowTokens.typography.body,
    },
  },
  components: {
    ActionIcon: {
      defaultProps: { radius: 'sm' },
    },
    Badge: {
      defaultProps: { radius: 'sm', variant: 'light' },
      styles: { root: { fontWeight: 600 } },
    },
    Button: {
      defaultProps: { radius: 'sm' },
      styles: { root: { fontWeight: 600 } },
    },
    Card: {
      defaultProps: { radius: 'md', shadow: 'none', withBorder: true },
    },
    Modal: {
      defaultProps: { radius: 'md', centered: true },
    },
    Paper: {
      defaultProps: { radius: 'md', shadow: 'none' },
    },
    TextInput: {
      defaultProps: { radius: 'sm' },
    },
    Select: {
      defaultProps: { radius: 'sm' },
    },
    NumberInput: {
      defaultProps: { radius: 'sm' },
    },
    Textarea: {
      defaultProps: { radius: 'sm' },
    },
  },
});

export {
  getWindowBackgroundColor,
  isDarkColorScheme,
  normalizeColorSchemePreference,
  resolveColorSchemePreference,
  toNativeThemeSource,
  type ColorSchemePreference,
  type NativeThemeSource,
  type ResolvedColorScheme,
} from '../../shared/theme.ts';
