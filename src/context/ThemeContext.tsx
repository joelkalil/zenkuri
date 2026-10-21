import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'zenkuri' | 'zenkuri-claro';

export const THEMES: { id: ThemeMode; label: string; description: string }[] = [
  { id: 'zenkuri', label: 'Zenkuri', description: 'Sumi quente e vermilhão' },
  { id: 'zenkuri-claro', label: 'Papel', description: 'Papel claro e vermilhão' },
];

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* Versão 3 = identidade Zenkuri (hanko + guia de estratégia, out/2026). Na
   primeira carga: preferência "light" vira zenkuri-claro; qualquer outro valor
   salvo que não exista mais vira zenkuri. Depois disso a escolha do seletor de
   Aparência é respeitada normalmente. */
const THEME_VERSION_KEY = 'zenkuri-theme-version';
const THEME_VERSION = '3';
const DEFAULT_THEME: ThemeMode = 'zenkuri';

function isTheme(value: string | null): value is ThemeMode {
  return THEMES.some((theme) => theme.id === value);
}

function initialTheme(): ThemeMode {
  const saved = localStorage.getItem('zenkuri-theme');
  if (localStorage.getItem(THEME_VERSION_KEY) !== THEME_VERSION) {
    localStorage.setItem(THEME_VERSION_KEY, THEME_VERSION);
    if (saved === 'light') return 'zenkuri-claro';
    return isTheme(saved) ? saved : DEFAULT_THEME;
  }
  return isTheme(saved) ? saved : DEFAULT_THEME;
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
