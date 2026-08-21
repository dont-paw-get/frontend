import { useEffect, useState } from 'react';
import { ThemeContext, THEME_KEY } from './themeStore';

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // 무시
  }
  return 'dark'; // 기본값: 다크(손전등 모드)
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // 무시
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
