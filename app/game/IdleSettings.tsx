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
          <span className="quick-setting-label">训练长度</span>
          <div className="quick-options two-options">
            {[5, 8].map((flipRounds) => (
              <button className={settings.flipRounds === flipRounds ? "is-selected" : ""} onClick={() => onChange({ flipRounds })} key={flipRounds}>{flipRounds} 轮</button>
            ))}
          </div>
        </div>
        <div className="quick-setting is-full">
          <span className="quick-setting-label">牌阵数量</span>
          <div className="quick-options five-options">
            {FLIP_CARD_COUNTS.map((flipCardCount) => (
              <button className={settings.flipCardCount === flipCardCount ? "is-selected" : ""} onClick={() => onChange({ flipCardCount })} key={flipCardCount}>{flipCardCount}</button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="inline-settings" aria-label={`${isCardMode ? "扑克牌" : "彩色方格"}训练设置`}>
      <div className="quick-setting">
        <span className="quick-setting-label">模式</span>
        <div className="quick-options two-options">
          <button className={settings.mode === "self-paced" ? "is-selected" : ""} onClick={() => onChange({ mode: "self-paced" })}>计时</button>
          <button className={settings.mode === "challenge" ? "is-selected" : ""} onClick={() => onChange({ mode: "challenge" })}>挑战</button>
        </div>
      </div>

      {isCardMode ? (
        <div className="quick-setting">
          <span className="quick-setting-label">N-Back</span>
          <strong className="quick-fixed-value">2-Back</strong>
        </div>
      ) : (
        <QuickStepper label="N-Back" value={settings.n} min={1} max={5} onChange={(n) => onChange({ n })} />
      )}

      <div className="quick-setting">
        <span className="quick-setting-label">训练长度</span>
        <div className="quick-options two-options">
          {[20, 30].map((total) => (
            <button className={settings.total === total ? "is-selected" : ""} onClick={() => onChange({ total })} key={total}>{total} 轮</button>
          ))}
        </div>
      </div>

      {isCardMode ? (
        <div className="quick-setting is-wide">
          <span className="quick-setting-label">训练牌组</span>
          <strong className="quick-fixed-value">13 个点数 · 4 种花色</strong>
        </div>
      ) : (
        <>
          <QuickStepper label="位置方块" value={settings.cellCount} min={4} max={16} onChange={(cellCount) => onChange({ cellCount })} />
          <QuickStepper label="颜色数量" value={settings.colorCount} min={2} max={7} onChange={(colorCount) => onChange({ colorCount })} />
        </>
      )}

      {settings.mode === "challenge" && (
        <div className="quick-setting is-wide">
          <span className="quick-setting-label">{isCardMode ? "牌面时间" : "每轮节奏"}</span>
          <div className="quick-options four-options">
            {PRESET_INTERVALS.map((interval) => (
              <button className={settings.interval === interval ? "is-selected" : ""} onClick={() => onChange({ interval })} key={interval}>{(interval / 1000).toFixed(1)}s</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
