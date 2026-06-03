import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Resolve the initial theme: a toggle made earlier this session wins, otherwise default to light mode.
const getInitialIsDark = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem('theme') === 'dark';
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

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      window.sessionStorage.setItem('theme', next ? 'dark' : 'light');
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
