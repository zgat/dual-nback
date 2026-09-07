"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

type ModalFrameProps = {
  eyebrow: string;
  title: string;
  className?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  exiting?: boolean;
};

export function ModalFrame({ eyebrow, title, className = "", closeLabel, onClose, children, footer, exiting = false }: ModalFrameProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Open a new modal section at its beginning without moving the footer.
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [title]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(element => !element.closest('[inert], [aria-hidden="true"]'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (!focusable.includes(document.activeElement as HTMLElement)) {
        // A pane switch can leave focus on its now-inert outgoing button.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    closeButtonRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" data-exiting={exiting}>
      <button className="modal-dismiss" onClick={onClose} aria-label={closeLabel} tabIndex={-1} />
      <section
        className={`settings-panel ${className} ${footer ? "has-footer" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDownCapture={exiting ? (event) => { event.preventDefault(); event.stopPropagation(); } : undefined}
      >
        <div className="settings-header">
          <div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div>
          <button className="close-button" onClick={onClose} aria-label={closeLabel} ref={closeButtonRef}>×</button>
        </div>
        {footer ? (
          <>
            <div className="settings-body" ref={bodyRef}>{children}</div>
            <div className="settings-footer">{footer}</div>
          </>
        ) : children}
      </section>
    </div>
  );
}
