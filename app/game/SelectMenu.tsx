"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type SelectValue = string | number;

export type SelectOption<T extends SelectValue> = {
  value: T;
  label: string;
};

export function SelectMenu<T extends SelectValue>({
  value,
  options,
  placeholder,
  ariaLabel,
  className = "",
  onChange,
}: {
  value: T | null;
  options: Array<SelectOption<T>>;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  onChange: (value: T) => void;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  const openMenu = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choose = (option: SelectOption<T>) => {
    onChange(option.value);
    closeMenu(true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const fallback = event.key === "ArrowDown" ? 0 : options.length - 1;
      openMenu(selectedIndex >= 0 ? selectedIndex : fallback);
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + direction + options.length) % options.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
    }
  };

  return (
    <div className={`custom-select ${className}`} ref={rootRef}>
      <button
        type="button"
        className="quick-select custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={onTriggerKeyDown}
        ref={triggerRef}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <i className="custom-select-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="custom-select-menu" role="listbox" id={listboxId} aria-label={ariaLabel} tabIndex={-1} onKeyDown={onListKeyDown}>
          {options.map((option, index) => (
            <button
              type="button"
              className={option.value === value ? "is-selected" : ""}
              role="option"
              aria-selected={option.value === value}
              onClick={() => choose(option)}
              ref={(element) => { optionRefs.current[index] = element; }}
              key={option.value}
            >
              <span>{option.label}</span>
              {option.value === value && <b aria-hidden="true">✓</b>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
