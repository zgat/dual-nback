"use client";

import { useEffect, useRef } from "react";
import { SoundToggle } from "./SoundToggle";

type SettingsModalProps = {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onClose: () => void;
};

export function SettingsModal({ soundEnabled, onToggleSound, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
      ) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
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
    <div className="modal-backdrop">
      <button className="modal-dismiss" onClick={onClose} aria-label="关闭偏好设置" tabIndex={-1} />
      <section
        className="settings-panel preferences-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="settings-header">
          <div><span className="eyebrow">VERSION 2.0.2</span><h2 id="settings-title">偏好设置</h2></div>
          <button className="close-button" onClick={onClose} aria-label="关闭设置" ref={closeButtonRef}>×</button>
        </div>

        <div className="preference-card">
          <div className="preference-copy">
            <b>作答音效</b>
            <p>正确时播放轻快提示，错误时播放低沉提示。</p>
          </div>
          <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} variant="panel" />
        </div>

        <button className="start-button" onClick={onClose}>完成</button>
      </section>
    </div>
  );
}
