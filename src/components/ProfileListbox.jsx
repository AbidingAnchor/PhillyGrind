import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

function ProfileListbox({
  label,
  value,
  options,
  placeholder = 'Select an option',
  onChange,
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const activeIndexRef = useRef(-1);
  const onChangeRef = useRef(onChange);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedIndex = options.findIndex((option) => option === value);
  const displayLabel = value || placeholder;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  function openPanel() {
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setClosing(false);
    setOpen(true);
    setActiveIndex(nextIndex);
    activeIndexRef.current = nextIndex;
  }

  function selectOption(option) {
    onChangeRef.current(option);
    setClosing(true);
  }

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
        setActiveIndex((current) => {
          const next = current < 0 ? 0 : Math.min(current + 1, options.length - 1);
          activeIndexRef.current = next;
          return next;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => {
          const next = current < 0 ? options.length - 1 : Math.max(current - 1, 0);
          activeIndexRef.current = next;
          return next;
        });
      } else if (event.key === 'Home') {
        event.preventDefault();
        activeIndexRef.current = 0;
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        const last = Math.max(options.length - 1, 0);
        activeIndexRef.current = last;
        setActiveIndex(last);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const index = activeIndexRef.current;
        if (index >= 0 && options[index] != null) {
          onChangeRef.current(options[index]);
          setClosing(true);
        }
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, closing, options]);

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

  return (
    <div className="profile-listbox" ref={rootRef}>
      <span className="profile-listbox-label" id={`${listboxId}-label`}>{label}</span>
      <button
        type="button"
        className={`profile-listbox-trigger ${open && !closing ? 'is-open' : ''} ${!value ? 'is-placeholder' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open && !closing}
        aria-labelledby={`${listboxId}-label`}
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
        <span className="profile-listbox-value">{displayLabel}</span>
        <ChevronDown size={16} className="profile-listbox-caret" aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`profile-listbox-panel ${closing ? 'is-closing' : 'is-open'}`}
          onAnimationEnd={handlePanelAnimationEnd}
        >
          <ul
            id={`${listboxId}-listbox`}
            className="profile-listbox-options"
            role="listbox"
            aria-labelledby={`${listboxId}-label`}
            tabIndex={-1}
          >
            {options.map((option, index) => {
              const selected = option === value;
              const active = index === activeIndex;
              return (
                <li
                  key={option}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={`profile-listbox-option ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''}`}
                  onMouseEnter={() => {
                    activeIndexRef.current = index;
                    setActiveIndex(index);
                  }}
                  onClick={() => selectOption(option)}
                >
                  <span>{option}</span>
                  {selected && <Check size={16} className="profile-listbox-check" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ProfileListbox;
