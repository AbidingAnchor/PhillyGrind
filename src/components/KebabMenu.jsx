import { useRef, useState, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export default function KebabMenu({ items }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="kebab-menu" ref={menuRef}>
      <button
        type="button"
        className="kebab-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Actions"
        aria-expanded={isOpen}
      >
        <MoreVertical size={18} />
      </button>
      {isOpen && (
        <div className="kebab-menu-dropdown">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              className={`kebab-menu-item ${item.danger ? 'danger' : ''} ${item.warn ? 'warn' : ''}`}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              disabled={item.disabled}
            >
              {item.icon && <span className="kebab-menu-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
