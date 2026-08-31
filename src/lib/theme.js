export const THEME_KEY = 'phillygrind-theme';

export const THEMES = [
  {
    id: 'light',
    label: 'Light',
    scheme: 'light',
    note: 'Crisp stone page, saturated green',
    swatches: ['#e4e8e4', '#ffffff', '#0a7d42'],
  },
  {
    id: 'dark',
    label: 'Dark',
    scheme: 'dark',
    note: 'The current night look',
    swatches: ['#121212', '#1e1e1e', '#4ade80'],
  },
  {
    id: 'eagles',
    label: 'Eagles',
    scheme: 'dark',
    note: 'Midnight green, black, silver',
    swatches: ['#004c54', '#070908', '#a5acaf'],
  },
  {
    id: 'sixers',
    label: 'Sixers',
    scheme: 'dark',
    note: 'Royal blue, red, white',
    swatches: ['#1d428a', '#ed174c', '#f4f6fb'],
  },
  {
    id: 'phillies',
    label: 'Phillies',
    scheme: 'light',
    note: 'Home white, red, navy',
    swatches: ['#c41e3a', '#fffdf9', '#002d62'],
  },
  {
    id: 'comfort',
    label: 'Comfort',
    scheme: 'light',
    note: 'Larger type, higher contrast',
    swatches: ['#f3f0e8', '#1c1917', '#2d6a4f'],
  },
  {
    id: 'classic',
    label: 'Classic Philly',
    scheme: 'light',
    note: 'Brick, cream, rowhome warmth',
    swatches: ['#8b3a2a', '#fff8ee', '#d4a574'],
  },
];

const THEME_BY_ID = Object.fromEntries(THEMES.map((theme) => [theme.id, theme]));

export function isThemeId(value) {
  return Boolean(THEME_BY_ID[value]);
}

export function getThemeMeta(id) {
  return THEME_BY_ID[id] || THEME_BY_ID.light;
}

export function getThemeScheme(id) {
  return getThemeMeta(id).scheme;
}

export function resolveTheme(value, fallback = 'light') {
  return isThemeId(value) ? value : fallback;
}

export function getStoredTheme() {
  if (typeof window === 'undefined') return 'light';
  return resolveTheme(localStorage.getItem(THEME_KEY));
}

export function applyTheme(theme) {
  const next = resolveTheme(theme);
  const scheme = getThemeScheme(next);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-scheme', scheme);
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_KEY, next);
  }
  return next;
}

export function toggleTheme(current) {
  return applyTheme(current === 'dark' ? 'light' : 'dark');
}
