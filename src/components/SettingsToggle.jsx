function SettingsToggle({ checked, onChange, disabled = false, ariaLabel, title }) {
  return (
    <button
      type="button"
      className={`settings-toggle${checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      disabled={disabled}
      onClick={onChange}
    >
      <span className="settings-toggle-thumb" aria-hidden="true" />
    </button>
  );
}

export default SettingsToggle;
