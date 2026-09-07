"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KeyboardEvent } from "react";
import { placeSelectMenu } from "./menuPlacement";

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
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const viewport = window.visualViewport;
      const bounds = {width:viewport?.width ?? window.innerWidth,height:viewport?.height ?? window.innerHeight,left:viewport?.offsetLeft ?? 0,top:viewport?.offsetTop ?? 0};
      menu.style.width = `${placeSelectMenu(anchor, bounds, 0).width}px`;
      const placement = placeSelectMenu(anchor, bounds, menu.scrollHeight + 2);
      Object.assign(menu.style, Object.fromEntries(Object.entries(placement).map(([key,value]) => [key, `${value}px`])));
      menu.style.visibility = "visible";
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
    };
  }, [open, options]);

  useEffect(() => {
    if (open) {
      const option = optionRefs.current[activeIndex];
      const menu = menuRef.current;
      option?.focus({preventScroll:true});
      if (option && menu) {
        if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
        else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
      }
    }
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

      {open && createPortal(
        <div className="custom-select-menu" role="listbox" id={listboxId} aria-label={ariaLabel} tabIndex={-1} onKeyDown={onListKeyDown} ref={menuRef} style={{visibility:"hidden"}}>
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
        </div>, document.body,
      )}
    </div>
  );
}
