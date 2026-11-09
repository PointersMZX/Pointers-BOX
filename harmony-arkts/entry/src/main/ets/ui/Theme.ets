// 主题引擎：四套主题（紫金黑/自定义/纯黑/纯白）+ 液态玻璃开关（对齐桌面 ThemeManager.cs / Android Theme.kt）
export class ThemePalette {
  appBg: string = '#0d0817';
  cardBg: string = '#8F2a2135';
  cardBgAlt: string = '#85241c2e';
  navBg: string = '#CC1a1425';
  navBorder: string = '#29FFFFFF';
  textPrimary: string = '#f0eaf8';
  textSecondary: string = '#a99cc4';
  accent: string = '#7c5cff';
  glassOn: boolean = true;
}

export const ACCENT_PRESETS: string[] = [
  '#7c5cff', '#e659a8', '#c084fc', '#3182ce',
  '#00b3a4', '#f59e0b', '#64748b', '#94a3b8'
];

export function normalizeAccent(accent: string | undefined | null): string {
  const v = (accent ?? '').trim();
  if (v.length >= 4 && v[0] === '#' && /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(v)) {
    return v;
  }
  return '#7c5cff';
}

/** 玻璃关：面板退化实色（对齐桌面 flatMaterial 语义；紫金黑玻璃锁死开） */
export function buildPalette(theme: string, accent: string, liquidGlass: boolean): ThemePalette {
  const glassOn = theme === 'zijin' ? true : liquidGlass;
  const p = new ThemePalette();
  p.glassOn = glassOn;
  p.accent = theme === 'custom' ? normalizeAccent(accent) : '#7c5cff';
  if (theme === 'custom') {
    p.appBg = '#0a1428';
    p.textSecondary = '#8fa3c0';
    p.cardBg = glassOn ? '#5C20292F' : '#FF14202f';
    p.cardBgAlt = glassOn ? '#521C2430' : '#FF101a28';
    p.navBg = glassOn ? '#CC14202f' : '#F214202f';
  } else if (theme === 'black') {
    p.appBg = '#000000';
    p.textPrimary = '#ededed';
    p.textSecondary = '#8f8f8f';
    p.cardBg = '#85101010';
    p.cardBgAlt = '#850a0a0a';
    p.navBg = '#CC0a0a0a';
    p.navBorder = '#FF232323';
  } else if (theme === 'white') {
    p.appBg = '#ffffff';
    p.textPrimary = '#171717';
    p.textSecondary = '#6b6b6b';
    p.cardBg = '#F2FFFFFF';
    p.cardBgAlt = '#F2fafafa';
    p.navBg = '#E6F0F0F5';
    p.navBorder = '#FFe2e2e2';
  } else {
    // zijin 紫金黑（默认）
    p.appBg = '#0d0817';
    p.cardBg = glassOn ? '#5C2A2135' : '#FF1a1026';
    p.cardBgAlt = glassOn ? '#52241C2E' : '#FF150e20';
  }
  return p;
}
