import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'epic' | 'dark' | 'light' | 'steam' | 'psnprofiles';

export const THEMES: { id: ThemeMode; label: string; description: string }[] = [
  { id: 'epic', label: 'Launcher', description: 'Preto neutro e azul Epic' },
  { id: 'dark', label: 'Zenkuri escuro', description: 'Grafite e violeta suave' },
  { id: 'light', label: 'Zenkuri claro', description: 'Branco mineral e violeta' },
  { id: 'steam', label: 'Steam', description: 'Azul-petróleo e ciano' },
  { id: 'psnprofiles', label: 'PSNProfiles', description: 'Cinza claro e azul PlayStation' },
];

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* Versão 2 = redesign "Launcher" (out/2026). Quem já tinha preferência salva
   passa uma única vez para o tema novo; depois disso a escolha volta a ser
   respeitada normalmente pelo seletor de Aparência. */
const THEME_VERSION_KEY = 'zenkuri-theme-version';
const THEME_VERSION = '2';

function initialTheme(): ThemeMode {
  if (localStorage.getItem(THEME_VERSION_KEY) !== THEME_VERSION) {
    localStorage.setItem(THEME_VERSION_KEY, THEME_VERSION);
    return 'epic';
  }
  const saved = localStorage.getItem('zenkuri-theme');
  if (THEMES.some((theme) => theme.id === saved)) return saved as ThemeMode;
  return 'epic';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('zenkuri-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((current) => THEMES[(THEMES.findIndex((item) => item.id === current) + 1) % THEMES.length].id),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
