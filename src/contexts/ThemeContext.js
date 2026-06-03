import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Resolve the initial theme: a toggle made earlier this session wins. Otherwise default to
// light mode, unless followSystem is set (admin portal), in which case use the OS preference.
const getInitialIsDark = (followSystem) => {
  if (typeof window === 'undefined') return false;
  const stored = window.sessionStorage.getItem('theme');
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return followSystem ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
};

const applyTheme = (isDark) => {
  document.documentElement.classList.toggle('dark', isDark);
};

export const ThemeProvider = ({ children, followSystem = false }) => {
  const [isDark, setIsDark] = useState(() => getInitialIsDark(followSystem));

  // Keep the <html> class in sync with state.
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  // In followSystem mode, track live OS changes until the user makes an explicit toggle this session.
  useEffect(() => {
    if (!followSystem) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!window.sessionStorage.getItem('theme')) {
        setIsDark(e.matches);
      }
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [followSystem]);

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
