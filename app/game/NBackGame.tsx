"use client";

import { ResultPanel } from "./ResultPanel";

import type { CSSProperties } from "react";
import {
  CARD_FLIP_DURATION_MS,
  CARD_SUITS,
  COLORS,
  OPTIONS,
  formatDuration,
  relationDetail,
  relationLabel,
  scorePercent,
} from "./core";
import type { GameSettings, MatchType, Phase, Stats, TrainingType, Trial } from "./core";
import { GameHome } from "./GameHome";

type NBackGameProps = {
  settings: GameSettings;
  phase: Phase;
  round: number;
  current: Trial | null;
  stimulusVisible: boolean;
  countdown: number;
  countdownExiting: boolean;
  onCountdownExitComplete: () => void;
  selected: MatchType | null;
  stats: Stats;
  elapsedMs: number;
  beginCountdown: () => void;
  togglePause: () => void;
  respond: (answer: MatchType) => void;
  advanceWarmup: () => void;
  optionClass: (id: MatchType) => string;
  editSettings: () => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  selectTrainingType: (trainingType: TrainingType) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenLeaderboard: () => void;
  homeSettingsOpen: boolean;
  homeSettingsHeight: number;
  onHomeSettingsOpenChange: (open: boolean) => void;
  onHomeSettingsHeightChange: (height: number) => void;
};

export function NBackGame({
  settings,
  phase,
  round,
  current,
  stimulusVisible,
  countdown,
  countdownExiting,
  onCountdownExitComplete,
  selected,
  stats,
  elapsedMs,
  beginCountdown,
  togglePause,
  respond,
  advanceWarmup,
  optionClass,
  editSettings,
  updateSettings,
  selectTrainingType,
  soundEnabled,
  onToggleSound,
  onOpenLeaderboard,
  homeSettingsOpen,
  homeSettingsHeight,
  onHomeSettingsOpenChange,
  onHomeSettingsHeightChange,
}: NBackGameProps) {
  const accuracy = scorePercent(stats);
  const isChallengeSuccess = settings.mode === "challenge" && accuracy === 100;
  const warmup = (phase === "playing" || phase === "paused") && round >= 0 && round < settings.n;
  const showWarmupPrompt = settings.mode === "self-paced" && warmup;
  const responseDisabled = phase !== "playing" || warmup || selected !== null;
  const wrongAnswers = Math.max(0, stats.total - stats.correct - stats.misses);
  const gridColumns = settings.cellCount <= 4 ? 2 : settings.cellCount <= 9 ? 3 : 4;
  const modeLabel = settings.mode === "self-paced" ? "计时模式" : "挑战模式";
  const isCardMode = settings.trainingType === "cards";
  const trainingLabel = isCardMode ? "扑克牌" : "彩色方格";
  const memoryDimensions = isCardMode ? "点数与花色" : "位置与颜色";
  const currentCard = current?.type === "cards" ? current : null;
  const currentGrid = current?.type === "grid" ? current : null;
  const countdownOverlay = phase === "countdown" ? (
    <div className={`board-overlay countdown-number ${countdownExiting ? "is-exiting" : ""}`}>
      <span
        className="countdown-value"
        onAnimationEnd={countdownExiting ? onCountdownExitComplete : undefined}
      >
        {countdown}
      </span>
    </div>
  ) : null;

  return (
    <div className={`nback-game phase-${phase} ${isCardMode ? "is-card-mode" : "is-grid-mode"}`}>
      {phase === "idle" ? (
        <GameHome
          eyebrow={`${trainingLabel} · ${modeLabel} · ${settings.n}-BACK`}
          title={`记住${memoryDimensions}`}
          description={settings.mode === "self-paced"
            ? "不限时思考，作答后进入下一轮。"
            : isCardMode
              ? `牌面完整显示 ${(settings.interval / 1000).toFixed(1)} 秒，再翻回牌背。`
              : `比较当前色块与 ${settings.n} 轮前的位置和颜色。`}
          introVisual={isCardMode ? (
            <div className="suit-legend" aria-label="黑桃、红桃、梅花、方块四种花色">
              {CARD_SUITS.map((suit) => <i className={suit.color === "red" ? "is-red" : ""} key={suit.name} title={suit.name}>{suit.symbol}</i>)}
            </div>
          ) : (
            <div className="color-legend" aria-label={`${settings.colorCount}种训练颜色`}>
              {COLORS.slice(0, settings.colorCount).map((color) => <i key={color.name} title={color.name} style={{ backgroundColor: color.value }} />)}
            </div>
          )}
          settings={settings}
          startLabel={settings.mode === "self-paced" ? "开始计时" : "开始挑战"}
          onStart={beginCountdown}
          onUpdateSettings={updateSettings}
          onSelectTrainingType={selectTrainingType}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
          onOpenLeaderboard={onOpenLeaderboard}
          settingsOpen={homeSettingsOpen}
          settingsHeight={homeSettingsHeight}
          onSettingsOpenChange={onHomeSettingsOpenChange}
          onSettingsHeightChange={onHomeSettingsHeightChange}
        />
      ) : phase === "finished" && (
        <div className="stage-heading">
          <span className="eyebrow">{trainingLabel} · {modeLabel} · {settings.n}-BACK</span>
          <h1>{isChallengeSuccess ? "挑战成功" : "训练完成"}</h1>
        </div>
      )}

      {phase === "idle" ? (
        null
      ) : phase === "finished" ? (
        <ResultPanel
          label="训练结果" score={accuracy} scoreLabel="综合正确率"
          config={isCardMode ? <><span><b>13</b> 个点数</span><span><b>4</b> 种花色</span></> : <><span><b>{settings.cellCount}</b> 个格子</span><span><b>{settings.colorCount}</b> 种颜色</span></>}
          time={settings.mode === "self-paced" ? {label: "总用时", value: formatDuration(elapsedMs)} : undefined}
          metrics={OPTIONS.map(option => <span key={option.id}><b>{stats.categoryHits[option.id]}/{stats.categoryTotals[option.id]}</b> {relationLabel(option.id, settings.trainingType)}</span>)}
          note={<>答错 {wrongAnswers} 次 · 未作答 {stats.misses} 次 · 最长连续正确 {stats.bestStreak} 轮</>}
          retryLabel={isChallengeSuccess ? "再次挑战" : "再练一轮"}
          onRetry={beginCountdown} onEditSettings={editSettings} onOpenLeaderboard={onOpenLeaderboard}
        />
      ) : (
        <>
          {isCardMode ? (
            <div className="card-board" aria-label="扑克牌训练区">
              <div
                className={`playing-card ${currentCard?.suit.color === "red" ? "is-red" : ""} ${!stimulusVisible || !currentCard ? "is-back" : ""}`}
                style={{ "--card-flip-duration": `${CARD_FLIP_DURATION_MS}ms` } as CSSProperties}
                aria-hidden="true"
              >
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
              {countdownOverlay}
              {phase === "paused" && <div className="board-overlay"><span>已暂停</span><small>按 P 或下方按钮继续</small></div>}
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
              {countdownOverlay}
              {phase === "paused" && <div className="board-overlay"><span>已暂停</span><small>按 P 或下方按钮继续</small></div>}
            </div>
          )}

          <div className={`answer-transition ${showWarmupPrompt ? "is-warmup" : "is-options"}`}>
            <button
              className="warmup-next"
              onClick={advanceWarmup}
              disabled={!showWarmupPrompt}
              aria-hidden={!showWarmupPrompt}
            >
              记住了，下一轮
            </button>
            <div className="response-area four-options" aria-label="选择与 N 轮前的关系" aria-hidden={showWarmupPrompt}>
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
          </div>

          {phase === "countdown" ? (
            <button className="start-button is-muted" disabled>准备开始…</button>
          ) : (
            <button className="start-button pause-button" onClick={togglePause}>
              {phase === "paused" ? "继续训练" : "暂停训练"} <span>{phase === "paused" ? "→" : "Ⅱ"}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
