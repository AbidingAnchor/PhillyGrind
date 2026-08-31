import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { applyTheme, getStoredTheme, isThemeId, resolveTheme, THEME_KEY } from './theme.js';

const ThemeContext = createContext(null);

function readBootTheme() {
  if (typeof document !== 'undefined') {
    const fromDom = document.documentElement.getAttribute('data-theme');
    if (isThemeId(fromDom)) return fromDom;
  }
  return getStoredTheme();
}

async function persistThemeRemote(theme) {
  if (!hasSupabaseConfig) return;

  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase.auth.updateUser({ data: { theme } });
    const { error } = await supabase
      .from('profiles')
      .update({ theme })
      .eq('id', user.id);
    if (error && error.code !== 'PGRST204' && error.code !== '42703') {
      console.warn('[Theme] Could not save profile theme', error);
    }
  } catch (error) {
    console.warn('[Theme] Could not persist theme', error);
  }
}

function themeFromSession(session) {
  const fromMeta = session?.user?.user_metadata?.theme;
  return isThemeId(fromMeta) ? fromMeta : null;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readBootTheme);
  const [mounted, setMounted] = useState(false);
  const persistTimer = useRef(null);

  useEffect(() => {
    applyTheme(theme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;

    let active = true;

    async function hydrateFromAccount() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const fromMeta = themeFromSession(data.session);
      if (fromMeta) {
        setThemeState(fromMeta);
      }

      const userId = data.session?.user?.id;
      if (!userId) return;

      const { data: row } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', userId)
        .maybeSingle();
      if (!active) return;
      if (isThemeId(row?.theme)) setThemeState(row.theme);
    }

    hydrateFromAccount();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const fromMeta = themeFromSession(session);
      if (fromMeta) setThemeState(fromMeta);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const setTheme = (nextTheme) => {
    const next = resolveTheme(nextTheme, theme);
    setThemeState(next);
    applyTheme(next);
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistThemeRemote(next);
    }, 200);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    mounted,
    storageKey: THEME_KEY,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
