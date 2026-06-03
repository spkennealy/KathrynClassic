import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Resolve the initial theme: a stored override wins, otherwise fall back to the OS preference.
const getInitialIsDark = () => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem('theme');
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyTheme = (isDark) => {
  document.documentElement.classList.toggle('dark', isDark);
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  // Keep the <html> class in sync with state.
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  // When the user hasn't picked an explicit override, follow live OS changes.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!window.localStorage.getItem('theme')) {
        setIsDark(e.matches);
      }
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      window.localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const value = {
    isDark,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
