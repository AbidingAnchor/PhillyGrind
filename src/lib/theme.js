export const THEME_KEY = 'phillygrind-theme';

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  return next;
}

export function toggleTheme(current) {
  return applyTheme(current === 'dark' ? 'light' : 'dark');
}
