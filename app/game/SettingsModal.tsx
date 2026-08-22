"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  CARD_FLIP_DURATION_MS,
  FLIP_CARD_COUNTS,
  FLIP_CONFIG,
  normalizeSettings,
} from "./core";
import type { FlipCardCount, GameSettings } from "./core";

type SettingsModalProps = {
  draftSettings: GameSettings;
  setDraftSettings: Dispatch<SetStateAction<GameSettings>>;
  onClose: () => void;
  onSave: () => void;
};

export function SettingsModal({ draftSettings, setDraftSettings, onClose, onSave }: SettingsModalProps) {
  const draftIsCardMode = draftSettings.trainingType === "cards";
  const draftIsFlipMode = draftSettings.trainingType === "flip";
  const challengeRoundMs = draftSettings.interval + (draftIsCardMode ? CARD_FLIP_DURATION_MS * 2 : 0);

  return (
    <div className="modal-backdrop">
      <button className="modal-dismiss" onClick={onClose} aria-label="关闭训练设置" tabIndex={-1} />
      <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-header">
          <div><span className="eyebrow">TRAINING SETUP</span><h2 id="settings-title">训练设置</h2></div>
          <button className="close-button" onClick={onClose} aria-label="关闭设置">×</button>
        </div>

        <fieldset className="setting-group training-setting">
          <legend>训练内容</legend>
          <div className="choice-row training-options three-columns">
            <button
              className={draftSettings.trainingType === "grid" ? "is-selected" : ""}
              onClick={() => setDraftSettings((value) => normalizeSettings({ ...value, trainingType: "grid" }))}
            >
              彩色方格<small>位置 × 颜色 · 可调 N-Back</small>
            </button>
            <button
              className={draftIsCardMode ? "is-selected" : ""}
              onClick={() => setDraftSettings((value) => normalizeSettings({ ...value, trainingType: "cards" }))}
            >
              扑克牌<small>点数 × 花色 · 可调 N-Back</small>
            </button>
            <button
              className={draftIsFlipMode ? "is-selected" : ""}
              onClick={() => setDraftSettings((value) => normalizeSettings({ ...value, trainingType: "flip" }))}
            >
              翻牌记忆<small>看牌 · 盖牌 · 找目标</small>
            </button>
          </div>
        </fieldset>

        {draftIsFlipMode ? (
          <>
            <fieldset className="setting-group mode-setting">
              <legend>牌阵数量</legend>
              <select
                className="setting-select"
                value={draftSettings.flipCardCount}
                onChange={(event) => {
                  const flipCardCount = Number(event.target.value) as FlipCardCount;
                  setDraftSettings((value) => ({ ...value, flipCardCount }));
                }}
              >
                {FLIP_CARD_COUNTS.map((flipCardCount) => (
                  <option value={flipCardCount} key={flipCardCount}>{flipCardCount} 张 · {FLIP_CONFIG[flipCardCount].layout}</option>
                ))}
              </select>
            </fieldset>
            <fieldset className="setting-group">
              <legend>翻牌难度</legend>
              <div className="choice-row two-columns mode-options">
                <button className={draftSettings.flipDifficulty === "classic" ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, flipDifficulty: "classic" }))}>
                  经典模式<small>盖牌后位置保持不变</small>
                </button>
                <button className={draftSettings.flipDifficulty === "moving" ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, flipDifficulty: "moving" }))}>
                  移动进阶<small>盖牌后逐步显示换位过程</small>
                </button>
              </div>
            </fieldset>
            <fieldset className="setting-group">
              <legend>训练长度</legend>
              <div className="choice-row two-columns">
                {[5, 8].map((flipRounds) => (
                  <button className={draftSettings.flipRounds === flipRounds ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, flipRounds }))} key={flipRounds}>
                    {flipRounds} 轮<small>{flipRounds === 5 ? "短时练习" : "完整训练"}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <fieldset className="setting-group mode-setting">
              <legend>节奏模式</legend>
              <div className="choice-row two-columns mode-options">
                <button className={draftSettings.mode === "self-paced" ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "self-paced" }))}>
                  计时模式<small>不限时，作答后换轮并记录总用时</small>
                </button>
                <button className={draftSettings.mode === "challenge" ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "challenge" }))}>
                  挑战模式<small>固定节奏，自动进入下一轮</small>
                </button>
              </div>
            </fieldset>

            <div className="setting-row">
              <div><b>N-Back 难度</b><small>{draftIsCardMode ? "需要回忆多少轮之前的点数与花色" : "需要回忆多少轮之前的位置与颜色"}</small></div>
              <div className="stepper">
                <button onClick={() => setDraftSettings((value) => ({ ...value, n: Math.max(1, value.n - 1) }))} aria-label="降低难度">−</button>
                <strong>{draftSettings.n}</strong>
                <button onClick={() => setDraftSettings((value) => ({ ...value, n: Math.min(5, value.n + 1) }))} aria-label="提高难度">＋</button>
              </div>
            </div>

            {!draftIsCardMode && (
              <>
                <div className="setting-row">
                  <div><b>位置方块数</b><small>可选 4–16 个位置；越少越容易</small></div>
                  <div className="stepper">
                    <button onClick={() => setDraftSettings((value) => ({ ...value, cellCount: Math.max(4, value.cellCount - 1) }))} aria-label="减少位置方块">−</button>
                    <strong>{draftSettings.cellCount}</strong>
                    <button onClick={() => setDraftSettings((value) => ({ ...value, cellCount: Math.min(16, value.cellCount + 1) }))} aria-label="增加位置方块">＋</button>
                  </div>
                </div>
                <div className="setting-row">
                  <div><b>颜色数量</b><small>从彩虹色中选择 2–7 种；越少越容易</small></div>
                  <div className="stepper">
                    <button onClick={() => setDraftSettings((value) => ({ ...value, colorCount: Math.max(2, value.colorCount - 1) }))} aria-label="减少颜色">−</button>
                    <strong>{draftSettings.colorCount}</strong>
                    <button onClick={() => setDraftSettings((value) => ({ ...value, colorCount: Math.min(7, value.colorCount + 1) }))} aria-label="增加颜色">＋</button>
                  </div>
                </div>
              </>
            )}

            {draftSettings.mode === "challenge" && (
              <fieldset className="setting-group">
                <legend>{draftIsCardMode ? "牌面可见时间" : "每轮节奏"}</legend>
                <div className="choice-row pace-options">
                  {[{ label: "舒缓", value: 3000 }, { label: "标准", value: 2400 }, { label: "快速", value: 1800 }, { label: "极快", value: 1200 }].map((option) => (
                    <button className={draftSettings.interval === option.value ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, interval: option.value }))} key={option.value}>{option.label}<small>{option.value / 1000} 秒</small></button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="setting-group">
              <legend>训练长度</legend>
              <div className="choice-row two-columns">
                {[20, 30].map((total) => (
                  <button className={draftSettings.total === total ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, total }))} key={total}>
                    {total} 轮<small>{draftSettings.mode === "self-paced" ? "按自己的速度完成" : `约 ${Math.ceil((total * challengeRoundMs) / 60000)} 分钟`}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="how-to">
          <b>{draftIsFlipMode ? "翻牌规则" : "四选一规则"}</b>
          <p>
            {draftIsFlipMode
              ? "先看完整牌阵并记住每张牌的位置。盖牌后才会公布目标牌，点出全部目标即可进入下一轮；移动进阶会逐步展示每次换位。"
              : draftIsCardMode
                ? `把当前牌的点数、花色分别与 ${draftSettings.n} 轮前比较，从点数同/不同、花色同/不同的四种组合中选择答案。`
                : "把当前位置、颜色分别与 N 轮前比较，从位置同/不同、颜色同/不同的四种组合中选择答案。"}
            {!draftIsFlipMode && "计时模式在作答后换轮，挑战模式会自动换轮。"}
          </p>
        </div>

        <button className="start-button" onClick={onSave}>保存设置</button>
      </section>
    </div>
  );
}
