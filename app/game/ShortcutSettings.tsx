"use client";

import { useState } from "react";
import { OPTIONS, relationDetail } from "./core";
import type { TrainingType } from "./core";
import {
  DEFAULT_SHORTCUT_KEYS,
  assignShortcutKey,
  formatShortcutKey,
  normalizeShortcutKey,
} from "./shortcuts";
import type { ShortcutAction, ShortcutKeys } from "./shortcuts";

type ShortcutSettingsProps = {
  keys: ShortcutKeys;
  trainingType: TrainingType;
  onChange: (keys: ShortcutKeys) => void;
};

export function ShortcutSettings({ keys, trainingType, onChange }: ShortcutSettingsProps) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const nBackTrainingType = trainingType === "cards" ? "cards" : "grid";
  const bindings = [
    ...OPTIONS.map(({ id }) => ({ action: id, label: relationDetail(id, nBackTrainingType) })),
    { action: "advance" as const, label: "记住了 / 下一轮" },
  ];

  const captureKey = (event: React.KeyboardEvent<HTMLButtonElement>, action: ShortcutAction) => {
    if (recording !== action || event.repeat) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setRecording(null);
      return;
    }
    if (event.key === "Tab") {
      setRecording(null);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = normalizeShortcutKey(event.key);
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(assignShortcutKey(keys, action, key));
    setRecording(null);
  };

  return (
    <section className="shortcut-card" aria-label="网页版键盘快捷键设置">
      <div className="shortcut-heading">
        <div>
          <b>键盘快捷键</b>
          <p>点击键位后按下新按键，重复键位会自动交换。</p>
        </div>
        <button type="button" onClick={() => onChange(DEFAULT_SHORTCUT_KEYS)}>恢复默认</button>
      </div>
      <div className="shortcut-grid">
        {bindings.map(({ action, label }) => (
          <div className={`shortcut-binding ${action === "advance" ? "is-advance" : ""}`} key={action}>
            <span>{label}</span>
            <button
              type="button"
              className={recording === action ? "is-recording" : ""}
              aria-label={`设置${label}快捷键，当前为${formatShortcutKey(keys[action])}`}
              onClick={() => setRecording(action)}
              onKeyDown={(event) => captureKey(event, action)}
            >
              {recording === action ? "请按键" : formatShortcutKey(keys[action])}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
