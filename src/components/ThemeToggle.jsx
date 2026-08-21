import { useTheme } from '../lib/theme.jsx';
import SettingsToggle from './SettingsToggle.jsx';

function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return <div className="settings-toggle-placeholder" aria-hidden="true" />;
  }

  const isDark = theme === 'dark';

  return (
    <SettingsToggle
      checked={isDark}
      onChange={toggleTheme}
      ariaLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    />
  );
}

export default ThemeToggle;
