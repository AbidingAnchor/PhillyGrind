import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { getThemeMeta, THEMES } from '../lib/theme.js';
import { useTheme } from '../lib/theme.jsx';

function ThemeSwatches({ colors }) {
  return (
    <span className="theme-picker-swatches" aria-hidden="true">
      {colors.map((color) => (
        <span key={color} style={{ background: color }} />
      ))}
    </span>
  );
}

function ThemePicker() {
  const { theme, setTheme, mounted } = useTheme();
  const listboxId = useId();
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const activeIndexRef = useRef(-1);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const current = getThemeMeta(theme);
  const selectedIndex = THEMES.findIndex((option) => option.id === theme);

  function openPanel() {
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setClosing(false);
    setOpen(true);
    setActiveIndex(nextIndex);
    activeIndexRef.current = nextIndex;
  }

  function selectOption(id) {
    setTheme(id);
    setClosing(true);
  }

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setClosing(true);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setClosing(true);
        return;
      }

      if (closing) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((currentIndex) => {
          const next = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, THEMES.length - 1);
          activeIndexRef.current = next;
          return next;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((currentIndex) => {
          const next = currentIndex < 0 ? THEMES.length - 1 : Math.max(currentIndex - 1, 0);
          activeIndexRef.current = next;
          return next;
        });
      } else if (event.key === 'Home') {
        event.preventDefault();
        activeIndexRef.current = 0;
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        const last = THEMES.length - 1;
        activeIndexRef.current = last;
        setActiveIndex(last);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const index = activeIndexRef.current;
        if (index >= 0 && THEMES[index]) {
          selectOption(THEMES[index].id);
        }
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, closing, setTheme]);

  useEffect(() => {
    if (!open || closing || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, closing]);

  function handlePanelAnimationEnd(event) {
    if (event.target !== event.currentTarget) return;
    if (!closing) return;
    setOpen(false);
    setClosing(false);
    setActiveIndex(-1);
    activeIndexRef.current = -1;
  }

  if (!mounted) {
    return <div className="theme-picker" aria-hidden="true" />;
  }

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className={`theme-picker-trigger${open && !closing ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open && !closing}
        aria-label="Color theme"
        aria-controls={`${listboxId}-listbox`}
        onClick={() => {
          if (open && !closing) setClosing(true);
          else openPanel();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open || closing) openPanel();
          }
        }}
      >
        <ThemeSwatches colors={current.swatches} />
        <span className="theme-picker-trigger-name">{current.label}</span>
        <ChevronDown size={16} className="theme-picker-caret" aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`theme-picker-panel${closing ? ' is-closing' : ' is-open'}`}
          onAnimationEnd={handlePanelAnimationEnd}
        >
          <ul
            id={`${listboxId}-listbox`}
            className="theme-picker-options"
            role="listbox"
            aria-label="Color theme"
            tabIndex={-1}
          >
            {THEMES.map((option, index) => {
              const selected = option.id === theme;
              const active = index === activeIndex;
              return (
                <li
                  key={option.id}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={`theme-picker-option${selected ? ' is-selected' : ''}${active ? ' is-active' : ''}`}
                  onMouseEnter={() => {
                    activeIndexRef.current = index;
                    setActiveIndex(index);
                  }}
                  onClick={() => selectOption(option.id)}
                >
                  <ThemeSwatches colors={option.swatches} />
                  <span className="theme-picker-copy">
                    <span className="theme-picker-name">{option.label}</span>
                    <span className="theme-picker-note">{option.note}</span>
                  </span>
                  {selected && <Check size={16} className="theme-picker-check" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ThemePicker;
