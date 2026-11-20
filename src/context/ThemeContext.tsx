import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ColorThemeId = 'crimson' | 'ocean' | 'emerald' | 'amber' | 'slate';

export interface ColorThemePreset {
  id: ColorThemeId;
  nameId: string;
  nameEn: string;
  descId: string;
  descEn: string;
  primary: string;
  primaryHover: string;
  accent: string;
  canvasLight: string;
  canvasDark: string;
  loginFrom: string;
  loginVia: string;
  loginTo: string;
  chartPalette: string[];
}

export const COLOR_THEMES: ColorThemePreset[] = [
  {
    id: 'crimson',
    nameId: 'Ajinomoto Crimson',
    nameEn: 'Ajinomoto Crimson',
    descId: 'Merah korporat & emas klasik',
    descEn: 'Corporate crimson & champagne gold',
    primary: '#E60012',
    primaryHover: '#C4000F',
    accent: '#C9A24B',
    canvasLight: '#F9F6F0',
    canvasDark: '#0B0D11',
    loginFrom: '#B8000E',
    loginVia: '#7A0712',
    loginTo: '#1A1D22',
    chartPalette: ['#E60012', '#C9A24B', '#1F2328', '#0284C7', '#16A34A', '#64748B'],
  },
  {
    id: 'ocean',
    nameId: 'Executive Sapphire',
    nameEn: 'Executive Sapphire',
    descId: 'Biru laut eksekutif & baja bersih',
    descEn: 'Executive sapphire & clean steel',
    primary: '#0F4C81',
    primaryHover: '#0B3A63',
    accent: '#0EA5E9',
    canvasLight: '#F3F7FC',
    canvasDark: '#080E17',
    loginFrom: '#0F4C81',
    loginVia: '#0A2E52',
    loginTo: '#0B1524',
    chartPalette: ['#0F4C81', '#0EA5E9', '#1E293B', '#14B8A6', '#6366F1', '#64748B'],
  },
  {
    id: 'emerald',
    nameId: 'HSE Emerald',
    nameEn: 'HSE Emerald',
    descId: 'Hijau Safety First & aksen emas',
    descEn: 'Safety-First emerald & warm gold',
    primary: '#057A55',
    primaryHover: '#046144',
    accent: '#C9A24B',
    canvasLight: '#F3F8F5',
    canvasDark: '#07110D',
    loginFrom: '#057A55',
    loginVia: '#044E37',
    loginTo: '#0D1C17',
    chartPalette: ['#057A55', '#C9A24B', '#1E293B', '#0D9488', '#0284C7', '#64748B'],
  },
  {
    id: 'amber',
    nameId: 'Copper Bronze',
    nameEn: 'Copper Bronze',
    descId: 'Perunggu hangat & arang modern',
    descEn: 'Warm copper bronze & charcoal',
    primary: '#B45309',
    primaryHover: '#92400E',
    accent: '#D97706',
    canvasLight: '#FAF6F0',
    canvasDark: '#110E0B',
    loginFrom: '#9A3412',
    loginVia: '#5C220B',
    loginTo: '#1C1613',
    chartPalette: ['#B45309', '#D97706', '#292524', '#0F766E', '#DC2626', '#78716C'],
  },
  {
    id: 'slate',
    nameId: 'Obsidian Indigo',
    nameEn: 'Obsidian Indigo',
    descId: 'Grafit minimalis & indigo presisi',
    descEn: 'Minimalist graphite & precision indigo',
    primary: '#4338CA',
    primaryHover: '#3730A3',
    accent: '#6366F1',
    canvasLight: '#F5F6FA',
    canvasDark: '#0A0D14',
    loginFrom: '#312E81',
    loginVia: '#1E1B4B',
    loginTo: '#0B0F1A',
    chartPalette: ['#4338CA', '#6366F1', '#1E293B', '#0EA5E9', '#10B981', '#64748B'],
  },
];

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  colorTheme: ColorThemeId;
  setColorTheme: (id: ColorThemeId) => void;
  activePreset: ColorThemePreset;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_KEY = 'hr_supplyhub_theme';
const COLOR_THEME_KEY = 'hr_supplyhub_color_theme';

const VALID_IDS = new Set<ColorThemeId>(['crimson', 'ocean', 'emerald', 'amber', 'slate']);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(() => {
    const saved = localStorage.getItem(COLOR_THEME_KEY) as ColorThemeId | null;
    if (saved && VALID_IDS.has(saved)) return saved;
    return 'crimson';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-color-theme', colorTheme);
    localStorage.setItem(COLOR_THEME_KEY, colorTheme);
  }, [colorTheme]);

  const toggleTheme = () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const setColorTheme = (id: ColorThemeId) => setColorThemeState(id);

  const activePreset = useMemo(
    () => COLOR_THEMES.find((t) => t.id === colorTheme) || COLOR_THEMES[0],
    [colorTheme]
  );

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, setTheme, colorTheme, setColorTheme, activePreset }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus digunakan di dalam ThemeProvider');
  return ctx;
}
