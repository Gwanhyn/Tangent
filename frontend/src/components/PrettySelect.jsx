import { Check, ChevronDown } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PrettySelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
  className = '',
}) {
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event) => {
      if (buttonRef.current?.contains(event.target)) return;
      if (event.target.closest?.('.pretty-select-menu')) return;
      setOpen(false);
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const choose = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div className={`pretty-select ${className}`}>
      {label && <span className="pretty-select-label">{label}</span>}
      <button
        ref={buttonRef}
        className="pretty-select-trigger"
        disabled={disabled}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="pretty-select-value">{selected?.label || 'Select'}</span>
        <ChevronDown className={open ? 'select-chevron open' : 'select-chevron'} size={16} />
      </button>
      {hint && <span className="pretty-select-hint">{hint}</span>}
      {open && position && createPortal(
        <div
          className="pretty-select-menu"
          style={{ top: position.top, left: position.left, minWidth: position.width }}
        >
          {options.map((option) => (
            <button
              className={`pretty-select-option ${option.value === value ? 'selected' : ''}`}
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {option.value === value && <Check size={15} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
