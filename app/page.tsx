"use client";

import { FlipMemoryGame } from "./game/FlipMemoryGame";
import { NBackGame } from "./game/NBackGame";
import { SettingsModal } from "./game/SettingsModal";
import { useGameController } from "./game/useGameController";

export default function Home() {
  const game = useGameController();
  const {
    settings,
    soundEnabled,
    phase,
    round,
    current,
    stimulusVisible,
    countdown,
    countdownExiting,
    selected,
    stats,
    elapsedMs,
    showSettings,
    setShowSettings,
    flipSessionActive,
    setFlipSessionActive,
    flipSessionKey,
    beginCountdown,
    completeCountdown,
    togglePause,
    respond,
    advanceWarmup,
    optionClass,
    openSettings,
    toggleSound,
    updateSettings,
    selectTrainingType,
    goHome,
  } = game;

  const progress = round < 0 ? 0 : ((round + 1) / settings.total) * 100;
  const isCardMode = settings.trainingType === "cards";
  const isFlipMode = settings.trainingType === "flip";
  const showHomeButton = isFlipMode ? flipSessionActive : phase !== "idle";

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
          <button className="icon-button" onClick={openSettings} aria-label="打开偏好设置">⚙</button>
        </div>
        <div className="top-progress" style={{ width: `${isFlipMode ? 0 : progress}%` }} />
      </header>

      <section className="game-stage">
        {isFlipMode ? (
          <FlipMemoryGame
            key={`${settings.flipDifficulty}-${settings.flipCardCount}-${settings.flipRounds}-${flipSessionKey}`}
            settings={settings}
            onSelectTrainingType={selectTrainingType}
            onEditSettings={goHome}
            onUpdateSettings={updateSettings}
            onSessionActiveChange={setFlipSessionActive}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
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
            onCountdownExitComplete={completeCountdown}
            selected={selected}
            stats={stats}
            elapsedMs={elapsedMs}
            beginCountdown={beginCountdown}
            togglePause={togglePause}
            respond={respond}
            advanceWarmup={advanceWarmup}
            optionClass={optionClass}
            editSettings={goHome}
            updateSettings={updateSettings}
            selectTrainingType={selectTrainingType}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
          />
        )}
      </section>

      {showSettings && (
        <SettingsModal
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}
