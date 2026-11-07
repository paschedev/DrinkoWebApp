'use client';

import { useEffect, useState } from 'react';

export const THEME_KEY = 'drinko-theme';
type Theme = 'system' | 'light' | 'dark';

// Claro, oscuro o el del sistema. Se guarda en el navegador.
export function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {
      // Sin almacenamiento se usa el tema del sistema.
    }
  }, []);

  function change(value: Theme) {
    setTheme(value);
    if (value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    try {
      if (value === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {
      // El cambio vale igual para esta visita.
    }
  }

  return (
    <label className="site-footer-label">
      Tema{' '}
      <select value={theme} onChange={(e) => change(e.target.value as Theme)}>
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
