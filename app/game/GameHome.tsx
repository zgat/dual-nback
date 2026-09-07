"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { CARD_SUITS, COLORS } from "./core";
import type { GameSettings, TrainingType } from "./core";
import { IdleSettings } from "./IdleSettings";
import { SoundToggle } from "./SoundToggle";
import { TrainingTypeSwitch } from "./TrainingTypeSwitch";

export function GameHome({
  settings,
  onStart,
  onUpdateSettings,
  onSelectTrainingType,
  soundEnabled,
  onToggleSound,
  onOpenLeaderboard,
  settingsOpen,
  settingsHeight,
  onSettingsOpenChange,
  onSettingsHeightChange,
}: {
  settings: GameSettings;
  onStart: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onSelectTrainingType: (trainingType: TrainingType) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenLeaderboard?: () => void;
  settingsOpen: boolean;
  settingsHeight: number;
  onSettingsOpenChange: (open: boolean) => void;
  onSettingsHeightChange: (height: number) => void;
}) {
  const settingsId = useId();
  const settingsContentRef = useRef<HTMLDivElement>(null);
  const isFlip = settings.trainingType === "flip";
  const isReaction = settings.trainingType === "reaction";
  const isCards = settings.trainingType === "cards";
  const timed = (isFlip ? settings.flipMode : settings.mode) === "self-paced";
  const modeLabel = timed ? "计时模式" : "挑战模式";
  const eyebrow = isReaction ? `反应力测试 · ${settings.reactionRounds} 轮`
    : isFlip ? `翻牌记忆 · ${modeLabel} · ${settings.flipDifficulty === "moving" ? "移动" : "经典"}模式`
    : `${isCards ? "扑克牌" : "彩色方格"} · ${modeLabel} · ${settings.n}-BACK`;
  const title = isReaction ? "看到橙色立即点击" : isFlip ? "看清每一张牌" : `记住${isCards ? "点数与花色" : "位置与颜色"}`;
  const description = isReaction ? "等待目标变色后尽快点击，提前点击会记为误触。"
    : isFlip ? timed ? "自己决定何时盖牌，全部找出后进入下一轮。" : "限时记牌，盖牌后不限时找完全部目标牌。"
    : timed ? "不限时思考，作答后进入下一轮。"
    : isCards ? `牌面完整显示 ${(settings.interval / 1000).toFixed(1)} 秒，再翻回牌背。`
    : `比较当前色块与 ${settings.n} 轮前的位置和颜色。`;
  const introVisual = isFlip ? null : isReaction ? <span className="reaction-legend"><i /> 按下即计时</span>
    : isCards ? <div className="suit-legend">{CARD_SUITS.map(suit => <i key={suit.symbol} className={suit.color === "red" ? "is-red" : ""}>{suit.symbol}</i>)}</div>
    : <div className="color-legend">{COLORS.slice(0, settings.colorCount).map(color => <i key={color.name} style={{background: color.value}} />)}</div>;
  const startLabel = isReaction ? "开始测试" : timed ? "开始计时" : "开始挑战";

  useLayoutEffect(() => {
    const content = settingsContentRef.current;
    if (!content) return;

    // Measure before paint. The persistent reveal retargets its current height
    // when a different game is selected, without collapsing or a delayed frame.
    const measure = () => onSettingsHeightChange(content.scrollHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();

    return () => {
      observer.disconnect();
    };
  }, [onSettingsHeightChange, settings]);

  const startGame = () => {
    onSettingsOpenChange(false);
    onStart();
  };

  return (
    <div className="game-home idle-home">
      <div className="stage-heading home-stage-heading">
        <div className="home-copy" key={settings.trainingType}>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <div className="home-intro">
            <p>{description}</p>
            <div className={`home-legend-slot ${introVisual ? "" : "is-empty"}`} aria-hidden={!introVisual}>
              {introVisual}
            </div>
          </div>
        </div>
        <TrainingTypeSwitch selected={settings.trainingType} onSelect={onSelectTrainingType} />
      </div>

      <div className={`settings-disclosure ${settingsOpen ? "is-open" : ""}`}>
        <div
          className="settings-reveal"
          id={settingsId}
          aria-hidden={!settingsOpen}
          inert={!settingsOpen}
          style={{ height: settingsOpen ? `${settingsHeight}px` : 0 }}
        >
          <div className="settings-reveal-inner" ref={settingsContentRef}>
            <IdleSettings settings={settings} onChange={onUpdateSettings} />
          </div>
        </div>
        <button
          type="button"
          className="settings-disclosure-toggle"
          aria-expanded={settingsOpen}
          aria-controls={settingsId}
          onClick={() => onSettingsOpenChange(!settingsOpen)}
        >
          <span className="settings-disclosure-line"><i /><b>设置</b><i /></span>
          <span className="settings-disclosure-chevron" aria-hidden="true" />
        </button>
      </div>

      <div className="idle-launch">
        <button className="start-button" onClick={startGame}>{startLabel} <span>→</span></button>
        <div className="home-utility-row">
          <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
          {onOpenLeaderboard && <button type="button" className="leaderboard-entry" onClick={onOpenLeaderboard}>历史最佳 <span>→</span></button>}
        </div>
      </div>
    </div>
  );
}
