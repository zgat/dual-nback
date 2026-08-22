"use client";

import { FLIP_CARD_COUNTS, PRESET_INTERVALS } from "./core";
import type { GameSettings } from "./core";

type IdleSettingsProps = {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
};

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function QuickStepper({ label, value, min, max, onChange }: StepperProps) {
  return (
    <div className="quick-setting">
      <span className="quick-setting-label">{label}</span>
      <div className="quick-stepper">
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`减少${label}`}>−</button>
        <strong>{value}</strong>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`增加${label}`}>＋</button>
      </div>
    </div>
  );
}

function QuickModeSetting({ settings, onChange }: {
  settings: GameSettings;
  onChange: IdleSettingsProps["onChange"];
}) {
  return (
    <div className="quick-setting quick-mode-setting">
      <span className="quick-setting-label">模式</span>
      <div className="quick-options two-options">
        <button className={settings.mode === "self-paced" ? "is-selected" : ""} onClick={() => onChange({ mode: "self-paced" })}>计时</button>
        <select
          className={`quick-select quick-challenge-select ${settings.mode === "challenge" ? "is-selected" : ""}`}
          value={settings.mode === "challenge" ? settings.interval : ""}
          onChange={(event) => onChange({ mode: "challenge", interval: Number(event.target.value) })}
          aria-label="选择挑战模式间隔"
        >
          <option value="" disabled>挑战</option>
          {PRESET_INTERVALS.map((interval) => (
            <option value={interval} key={interval}>{(interval / 1000).toFixed(1)} 秒</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function IdleSettings({ settings, onChange }: IdleSettingsProps) {
  const isFlipMode = settings.trainingType === "flip";
  const isCardMode = settings.trainingType === "cards";

  if (isFlipMode) {
    return (
      <section className="inline-settings flip-inline-settings" aria-label="翻牌记忆设置">
        <div className="quick-setting">
          <span className="quick-setting-label">翻牌难度</span>
          <div className="quick-options two-options">
            <button className={settings.flipDifficulty === "classic" ? "is-selected" : ""} onClick={() => onChange({ flipDifficulty: "classic" })}>经典</button>
            <button className={settings.flipDifficulty === "moving" ? "is-selected" : ""} onClick={() => onChange({ flipDifficulty: "moving" })}>移动</button>
          </div>
        </div>
        <div className="quick-setting">
          <label className="quick-setting-label" htmlFor="quick-flip-count">牌阵数量</label>
          <select
            id="quick-flip-count"
            className="quick-select"
            value={settings.flipCardCount}
            onChange={(event) => onChange({ flipCardCount: Number(event.target.value) as GameSettings["flipCardCount"] })}
          >
            {FLIP_CARD_COUNTS.map((flipCardCount) => (
              <option value={flipCardCount} key={flipCardCount}>{flipCardCount} 张</option>
            ))}
          </select>
        </div>
        <div className="quick-setting is-full">
          <span className="quick-setting-label">训练长度</span>
          <div className="quick-options two-options">
            {[5, 8].map((flipRounds) => (
              <button className={settings.flipRounds === flipRounds ? "is-selected" : ""} onClick={() => onChange({ flipRounds })} key={flipRounds}>{flipRounds} 轮</button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`inline-settings ${isCardMode ? "card-inline-settings" : "grid-inline-settings"}`} aria-label={`${isCardMode ? "扑克牌" : "彩色方格"}训练设置`}>
      <QuickModeSetting settings={settings} onChange={onChange} />
      <QuickStepper label="N-Back" value={settings.n} min={1} max={5} onChange={(n) => onChange({ n })} />

      {!isCardMode && (
        <>
          <QuickStepper label="位置方块" value={settings.cellCount} min={4} max={16} onChange={(cellCount) => onChange({ cellCount })} />
          <QuickStepper label="颜色数量" value={settings.colorCount} min={2} max={7} onChange={(colorCount) => onChange({ colorCount })} />
        </>
      )}

      <div className="quick-setting is-full">
        <span className="quick-setting-label">训练长度</span>
        <div className="quick-options two-options">
          {[20, 30].map((total) => (
            <button className={settings.total === total ? "is-selected" : ""} onClick={() => onChange({ total })} key={total}>{total} 轮</button>
          ))}
        </div>
      </div>
    </section>
  );
}
