"use client";

import type { CSSProperties } from "react";
import {
  CARD_SUITS,
  COLORS,
  OPTIONS,
  formatDuration,
  relationDetail,
  relationLabel,
  scorePercent,
} from "./core";
import type { GameMode, GameSettings, MatchType, Phase, Stats, TrainingType, Trial } from "./core";

type NBackGameProps = {
  settings: GameSettings;
  phase: Phase;
  round: number;
  current: Trial | null;
  stimulusVisible: boolean;
  countdown: number;
  countdownExiting: boolean;
  selected: MatchType | null;
  stats: Stats;
  elapsedMs: number;
  beginCountdown: () => void;
  togglePause: () => void;
  respond: (answer: MatchType) => void;
  advanceWarmup: () => void;
  optionClass: (id: MatchType) => string;
  openSettings: () => void;
  levelUp: () => void;
  selectMode: (mode: GameMode) => void;
  selectTrainingType: (trainingType: TrainingType) => void;
};

export function NBackGame({
  settings,
  phase,
  round,
  current,
  stimulusVisible,
  countdown,
  countdownExiting,
  selected,
  stats,
  elapsedMs,
  beginCountdown,
  togglePause,
  respond,
  advanceWarmup,
  optionClass,
  openSettings,
  levelUp,
  selectMode,
  selectTrainingType,
}: NBackGameProps) {
  const accuracy = scorePercent(stats);
  const warmup = phase === "playing" && round < settings.n;
  const responseDisabled = phase !== "playing" || warmup || selected !== null;
  const wrongAnswers = Math.max(0, stats.total - stats.correct - stats.misses);
  const gridColumns = settings.cellCount <= 4 ? 2 : settings.cellCount <= 9 ? 3 : 4;
  const modeLabel = settings.mode === "self-paced" ? "计时模式" : "挑战模式";
  const isCardMode = settings.trainingType === "cards";
  const trainingLabel = isCardMode ? "扑克牌" : "彩色方格";
  const memoryDimensions = isCardMode ? "点数与花色" : "位置与颜色";
  const currentCard = current?.type === "cards" ? current : null;
  const currentGrid = current?.type === "grid" ? current : null;

  return (
    <>
      <div className="stage-heading">
        <span className="eyebrow">{trainingLabel} · {modeLabel} · {settings.n}-BACK</span>
        <h1>{phase === "finished" ? "训练完成" : `记住${memoryDimensions}`}</h1>
        <p>
          {warmup
            ? `先记住前 ${settings.n} 轮，之后开始四选一判断。`
            : phase === "paused"
              ? "训练已暂停，准备好后继续。"
              : settings.mode === "self-paced"
                ? "不限时思考，作答后才进入下一轮。"
                : `把当前${isCardMode ? "牌面" : "色块"}与 ${settings.n} 轮前比较，选择唯一符合的关系。`}
        </p>
        {isCardMode ? (
          <div className="suit-legend" aria-label="黑桃、红桃、梅花、方块四种花色">
            {CARD_SUITS.map((suit) => <i className={suit.color === "red" ? "is-red" : ""} key={suit.name} title={suit.name}>{suit.symbol}</i>)}
          </div>
        ) : (
          <div className="color-legend" aria-label={`${settings.colorCount}种训练颜色`}>
            {COLORS.slice(0, settings.colorCount).map((color) => <i key={color.name} title={color.name} style={{ backgroundColor: color.value }} />)}
          </div>
        )}
        {phase === "idle" && (
          <div className="idle-switches">
            <div className="training-switch three-options" aria-label="选择训练内容">
              <button className={!isCardMode ? "is-selected" : ""} onClick={() => selectTrainingType("grid")}>
                <span aria-hidden="true">▦</span> 彩色方格
              </button>
              <button className={isCardMode ? "is-selected" : ""} onClick={() => selectTrainingType("cards")}>
                <span aria-hidden="true">♠</span> 扑克 2-Back
              </button>
              <button onClick={() => selectTrainingType("flip")}><span aria-hidden="true">▤</span> 翻牌记忆</button>
            </div>
            <div className="mode-switch" aria-label="选择节奏模式">
              <button className={settings.mode === "self-paced" ? "is-selected" : ""} onClick={() => selectMode("self-paced")}>
                计时模式<small>不限时 · 作答后换轮</small>
              </button>
              <button className={settings.mode === "challenge" ? "is-selected" : ""} onClick={() => selectMode("challenge")}>
                挑战模式<small>固定节奏 · 自动换轮</small>
              </button>
            </div>
          </div>
        )}
      </div>

      {phase === "finished" ? (
        <section className="result-panel" aria-label="训练结果">
          <div className="score-ring" style={{ "--score": `${accuracy * 3.6}deg` } as CSSProperties}>
            <div><strong>{accuracy}</strong><span>%</span><small>综合正确率</small></div>
          </div>
          <div className="result-copy">
            <span className="result-kicker">本轮表现</span>
            <h2>{accuracy >= 85 ? "判断稳定，可以继续挑战。" : accuracy >= 70 ? "节奏不错，再巩固一轮。" : "先放慢节奏，辨清两个维度。"}</h2>
            <div className="result-config" aria-label="本轮训练设置">
              {isCardMode ? (
                <>
                  <span><b>13</b> 个点数</span>
                  <span><b>4</b> 种花色</span>
                </>
              ) : (
                <>
                  <span><b>{settings.cellCount}</b> 个格子</span>
                  <span><b>{settings.colorCount}</b> 种颜色</span>
                </>
              )}
            </div>
            {settings.mode === "self-paced" && (
              <div className="result-time">
                <small>总用时</small>
                <strong>{formatDuration(elapsedMs)}</strong>
              </div>
            )}
            <div className="result-metrics">
              {OPTIONS.map((option) => (
                <span key={option.id}><b>{stats.categoryHits[option.id]}</b> {relationLabel(option.id, settings.trainingType)}</span>
              ))}
            </div>
            <p className="result-note">答错 {wrongAnswers} 次 · 未作答 {stats.misses} 次 · 最长连续正确 {stats.bestStreak} 轮</p>
            <div className="result-actions">
              <button className="secondary-button" onClick={beginCountdown}>再练一轮</button>
              {isCardMode ? (
                <button className="primary-button" onClick={openSettings}>调整设置 <span>→</span></button>
              ) : (
                <button className="primary-button" onClick={levelUp} disabled={settings.n >= 5}>
                  {settings.n >= 5 ? "已到最高难度" : `升到 ${settings.n + 1}-Back`} <span>→</span>
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          {isCardMode ? (
            <div className="card-board" aria-label="扑克牌训练区">
              <div className={`playing-card ${currentCard?.suit.color === "red" ? "is-red" : ""} ${!stimulusVisible || !currentCard ? "is-back" : ""}`} aria-hidden="true">
                <div className="playing-card-inner">
                  <div className="playing-card-face">
                    <span className="card-corner is-top"><b>{currentCard?.rank.name}</b><i>{currentCard?.suit.symbol}</i></span>
                    <span className="card-suit-center">{currentCard?.suit.symbol}</span>
                    <span className="card-corner is-bottom"><b>{currentCard?.rank.name}</b><i>{currentCard?.suit.symbol}</i></span>
                  </div>
                  <div className="playing-card-back-face"><span className="card-back-mark">N²</span></div>
                </div>
              </div>
              <span className="sr-only" aria-live="assertive">
                {stimulusVisible && currentCard ? `${currentCard.suit.name}${currentCard.rank.name}` : ""}
              </span>
              {phase === "countdown" && <div className={`board-overlay countdown-number ${countdownExiting ? "is-exiting" : ""}`}>{countdown}</div>}
              {phase === "paused" && <div className="board-overlay"><span>已暂停</span><small>按 P 或下方按钮继续</small></div>}
              {phase === "idle" && (
                <div className="board-overlay intro-overlay">
                  <span>扑克牌 2-Back</span>
                  <small>{settings.mode === "self-paced" ? "记住点数与花色 · 作答后换轮" : "记住点数与花色 · 固定节奏"}</small>
                </div>
              )}
            </div>
          ) : (
            <div
              className="game-grid"
              aria-label={`${settings.cellCount}个位置棋盘`}
              style={{ "--grid-columns": gridColumns } as CSSProperties}
            >
              {Array.from({ length: settings.cellCount }).map((_, index) => (
                <div
                  className={`grid-cell ${stimulusVisible && currentGrid?.position === index ? "is-active" : ""}`}
                  style={stimulusVisible && currentGrid?.position === index ? { "--stimulus-color": currentGrid.color.value } as CSSProperties : undefined}
                  key={index}
                  aria-hidden="true"
                />
              ))}
              <span className="sr-only" aria-live="assertive">
                {stimulusVisible && currentGrid ? `${currentGrid.color.name}色，位置 ${currentGrid.position + 1}` : ""}
              </span>
              {phase === "countdown" && <div className={`board-overlay countdown-number ${countdownExiting ? "is-exiting" : ""}`}>{countdown}</div>}
              {phase === "paused" && <div className="board-overlay"><span>已暂停</span><small>按 P 或下方按钮继续</small></div>}
              {phase === "idle" && (
                <div className="board-overlay intro-overlay">
                  <span>{modeLabel}</span>
                  <small>{settings.mode === "self-paced" ? "不限时 · 作答后进入下一轮" : "固定节奏 · 自动进入下一轮"}</small>
                </div>
              )}
            </div>
          )}

          {warmup && settings.mode === "self-paced" ? (
            <button className="warmup-next" onClick={advanceWarmup}>
              记住了，下一轮 <span>Enter ↵</span>
            </button>
          ) : (
            <div className="response-area four-options" aria-label="选择与 N 轮前的关系">
              {OPTIONS.map((option) => (
                <button
                  className={`match-button relation-button ${optionClass(option.id)}`}
                  onClick={() => respond(option.id)}
                  disabled={responseDisabled}
                  aria-label={relationLabel(option.id, settings.trainingType)}
                  key={option.id}
                >
                  <b>{relationDetail(option.id, settings.trainingType)}</b>
                </button>
              ))}
            </div>
          )}

          {phase === "idle" ? (
            <button className="start-button" onClick={beginCountdown}>
              {settings.mode === "self-paced" ? "开始计时" : "开始挑战"} <span>→</span>
            </button>
          ) : phase === "countdown" ? (
            <button className="start-button is-muted" disabled>准备开始…</button>
          ) : (
            <button className="start-button pause-button" onClick={togglePause}>
              {phase === "paused" ? "继续训练" : "暂停训练"} <span>{phase === "paused" ? "→" : "Ⅱ"}</span>
            </button>
          )}
        </>
      )}
    </>
  );
}
