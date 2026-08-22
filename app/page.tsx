"use client";

import { FlipMemoryGame } from "./game/FlipMemoryGame";
import { NBackGame } from "./game/NBackGame";
import { SettingsModal } from "./game/SettingsModal";
import { FLIP_CONFIG, scorePercent } from "./game/core";
import { useGameController } from "./game/useGameController";

export default function Home() {
  const game = useGameController();
  const {
    settings,
    draftSettings,
    setDraftSettings,
    phase,
    round,
    current,
    stimulusVisible,
    countdown,
    countdownExiting,
    selected,
    stats,
    bestScore,
    elapsedMs,
    showSettings,
    setShowSettings,
    flipSessionActive,
    setFlipSessionActive,
    flipSessionKey,
    beginCountdown,
    togglePause,
    respond,
    advanceWarmup,
    optionClass,
    openSettings,
    saveSettings,
    selectMode,
    selectTrainingType,
    levelUp,
    goHome,
  } = game;

  const accuracy = scorePercent(stats);
  const progress = round < 0 ? 0 : ((round + 1) / settings.total) * 100;
  const isCardMode = settings.trainingType === "cards";
  const isFlipMode = settings.trainingType === "flip";
  const showHomeButton = isFlipMode ? flipSessionActive : phase !== "idle";
  const modeLabel = settings.mode === "self-paced" ? "计时模式" : "挑战模式";
  const activeFlipConfig = FLIP_CONFIG[settings.flipCardCount];

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="回到游戏首页">
          <span className="brand-mark">N²</span>
          <span>双重记忆</span>
        </button>
        {showHomeButton ? (
          <button className="round-pill round-home" onClick={goHome} aria-label="结束当前游戏并回到首页">← 回到首页</button>
        ) : (
          <div className="round-pill" aria-live="polite">
            {isFlipMode ? "翻牌记忆" : `${isCardMode ? "扑克 · " : ""}${settings.n}-BACK`}
          </div>
        )}
        <div className="top-actions">
          {!isFlipMode && (phase === "countdown" || phase === "playing" || phase === "paused") && (
            <button className="restart-button" onClick={beginCountdown} aria-label="重新开始本轮训练">
              <span aria-hidden="true">↻</span>
              <b>重新开始</b>
            </button>
          )}
          <button className="icon-button" onClick={openSettings} aria-label={isFlipMode && flipSessionActive ? "结束当前训练并打开设置" : "打开训练设置"}>⚙</button>
        </div>
        <div className="top-progress" style={{ width: `${isFlipMode ? 0 : progress}%` }} />
      </header>

      <section className="game-stage">
        {isFlipMode ? (
          <FlipMemoryGame
            key={`${settings.flipDifficulty}-${settings.flipCardCount}-${settings.flipRounds}-${flipSessionKey}`}
            settings={settings}
            onSelectTrainingType={selectTrainingType}
            onOpenSettings={openSettings}
            onSessionActiveChange={setFlipSessionActive}
          />
        ) : (
          <NBackGame
            settings={settings}
            phase={phase}
            round={round}
            current={current}
            stimulusVisible={stimulusVisible}
            countdown={countdown}
            countdownExiting={countdownExiting}
            selected={selected}
            stats={stats}
            elapsedMs={elapsedMs}
            beginCountdown={beginCountdown}
            togglePause={togglePause}
            respond={respond}
            advanceWarmup={advanceWarmup}
            optionClass={optionClass}
            openSettings={openSettings}
            levelUp={levelUp}
            selectMode={selectMode}
            selectTrainingType={selectTrainingType}
          />
        )}
      </section>

      <footer className="statusbar">
        <span>
          <i className="status-dot" />
          {isFlipMode ? `${settings.flipCardCount} 张牌 · ${activeFlipConfig.targets} 张目标` : isCardMode ? "13 个点数 · 4 种花色" : `${settings.cellCount} 个位置 · ${settings.colorCount} 种颜色`}
        </span>
        <span>{isFlipMode ? "流程" : "正确率"} <b>{isFlipMode ? "先看后找" : stats.total ? `${accuracy}%` : "—"}</b></span>
        <span>{isFlipMode ? "难度" : "节奏"} <b>{isFlipMode ? settings.flipDifficulty === "moving" ? "移动进阶" : "经典模式" : modeLabel}</b></span>
        <span>{isFlipMode ? "轮数" : "历史最佳"} <b>{isFlipMode ? settings.flipRounds : bestScore ? `${bestScore}%` : "—"}</b></span>
      </footer>

      {showSettings && (
        <SettingsModal
          draftSettings={draftSettings}
          setDraftSettings={setDraftSettings}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
        />
      )}
    </main>
  );
}
