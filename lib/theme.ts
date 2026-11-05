export type Palette = {
  background: string;
  text: string;
  accent: string;
  success: string;
  fail: string;
};

export type ThemePreset =
  | 'light'
  | 'dark'
  | 'sand'
  | 'blue'
  | 'gradientTeal'
  | 'gradientPink'
  | 'gradientOrange'
  | 'gradientSky';

export type ThemeChoice = {
  preset: ThemePreset | 'custom';
  custom: Palette;
  customGradient?: readonly [string, string] | null;
};

export type Theme = Palette & {
  muted: string;
  border: string;
  accentText: string;
  error: string;
  gradientColors?: readonly [string, string];
};

type PresetDef = {
  name: string;
  palette: Palette;
  gradientColors?: readonly [string, string];
};

export const lightPalette: Palette = {
  background: '#ffffff',
  text: '#111111',
  accent: '#111111',
  success: '#e5f6ea',
  fail: '#f8e6e6',
};

export const presets: Record<ThemePreset, PresetDef> = {
  light: { name: 'Светлая', palette: lightPalette },
  dark: {
    name: 'Тёмная',
    palette: {
      background: '#121212',
      text: '#f2f2f2',
      accent: '#f2f2f2',
      success: '#1e3a2a',
      fail: '#3a2222',
    },
  },
  sand: {
    name: 'Песочная',
    palette: {
      background: '#f6f1e7',
      text: '#3b2f22',
      accent: '#8a5a2b',
      success: '#e3f0df',
      fail: '#f6e4dc',
    },
  },
  blue: {
    name: 'Синяя',
    palette: {
      background: '#f4f7fb',
      text: '#142033',
      accent: '#1d4e89',
      success: '#e5f6ea',
      fail: '#f8e6e6',
    },
  },
  gradientTeal: {
    name: 'Бирюзовый',
    palette: {
      background: '#0f172a',
      text: '#f1f5f9',
      accent: '#2dd4bf',
      success: '#164e3b',
      fail: '#4a2228',
    },
    gradientColors: ['#0f172a', '#134e4a'],
  },
  gradientPink: {
    name: 'Розовый',
    palette: {
      background: '#fdf0f5',
      text: '#5c2a3a',
      accent: '#e8a0b8',
      success: '#e5f6ea',
      fail: '#f8e6e6',
    },
    gradientColors: ['#fdf0f5', '#f5d0e0'],
  },
  gradientOrange: {
    name: 'Оранжевый',
    palette: {
      background: '#fff4eb',
      text: '#5c3a1a',
      accent: '#e8a86a',
      success: '#e5f6ea',
      fail: '#f8e6e6',
    },
    gradientColors: ['#fff4eb', '#ffd9b8'],
  },
  gradientSky: {
    name: 'Голубой',
    palette: {
      background: '#eef7fc',
      text: '#1a3a4a',
      accent: '#7ab8d4',
      success: '#e5f6ea',
      fail: '#f8e6e6',
    },
    gradientColors: ['#eef7fc', '#c5e4f5'],
  },
};

export const paletteFields: { key: keyof Palette; label: string }[] = [
  { key: 'background', label: 'Фон' },
  { key: 'text', label: 'Текст' },
  { key: 'accent', label: 'Кнопки' },
  { key: 'success', label: 'Получилось' },
  { key: 'fail', label: 'Не получилось' },
];

export function defaultThemeChoice(): ThemeChoice {
  return { preset: 'light', custom: { ...lightPalette }, customGradient: null };
}

export function paletteOf(choice: ThemeChoice): Palette {
  if (choice.preset === 'custom') {
    return choice.custom;
  }
  return presets[choice.preset].palette;
}

export function resolveTheme(palette: Palette, gradientColors?: readonly [string, string]): Theme {
  return {
    ...palette,
    muted: mix(palette.text, palette.background, 0.45),
    border: mix(palette.text, palette.background, 0.82),
    accentText: luminance(palette.accent) > 0.45 ? '#111111' : '#ffffff',
    error: mix('#b00020', palette.text, 0.25),
    gradientColors,
  };
}

export function themeOf(choice: ThemeChoice): Theme {
  if (choice.preset === 'custom') {
    const gradient = choice.customGradient ?? undefined;
    return resolveTheme(choice.custom, gradient ?? undefined);
  }
  const preset = presets[choice.preset];
  return resolveTheme(preset.palette, preset.gradientColors);
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isDarkBackground(background: string): boolean {
  return luminance(background) < 0.45;
}

function luminance(hex: string): number {
  const [red, green, blue] = parseHex(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function mix(from: string, to: string, amount: number): string {
  const start = parseHex(from);
  const end = parseHex(to);
  const mixed = start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex: string): [number, number, number] {
  const normalized = isHexColor(hex) ? hex : '#000000';
  const value = Number.parseInt(normalized.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
