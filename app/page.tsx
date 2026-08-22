"use client";

import { useCallback, useState } from "react";
import { FlipMemoryGame } from "./game/FlipMemoryGame";
import { NBackGame } from "./game/NBackGame";
import { SettingsModal } from "./game/SettingsModal";
import { useGameController } from "./game/useGameController";
import { usePreferences } from "./game/usePreferences";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [homeSettingsOpen, setHomeSettingsOpen] = useState(false);
  const [homeSettingsHeight, setHomeSettingsHeight] = useState(0);
  const [flipSessionActive, setFlipSessionActive] = useState(false);
  const [flipSessionKey, setFlipSessionKey] = useState(0);
  const preferences = usePreferences();
  const { settings, soundEnabled, shortcutKeys, updateSettings, selectTrainingType, toggleSound, updateShortcutKeys } = preferences;
  const game = useGameController(settings, soundEnabled, shortcutKeys, showSettings);
  const {
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
    completeCountdown,
    pauseGame,
    togglePause,
    respond,
    advanceWarmup,
    optionClass,
    goHome: resetNBack,
  } = game;

  const progress = round < 0 ? 0 : ((round + 1) / settings.total) * 100;
  const isCardMode = settings.trainingType === "cards";
  const isFlipMode = settings.trainingType === "flip";
  const showHomeButton = isFlipMode ? flipSessionActive : phase !== "idle";

  const openSettings = () => {
    pauseGame();
    setShowSettings(true);
  };

  const closeSettings = useCallback(() => setShowSettings(false), []);
  const updateHomeSettingsHeight = useCallback((height: number) => {
    setHomeSettingsHeight((current) => current === height ? current : height);
  }, []);

  const goHome = () => {
    resetNBack();
    if (flipSessionActive) {
      setFlipSessionKey((value) => value + 1);
      setFlipSessionActive(false);
    }
  };

  const editHomeSettings = () => {
    goHome();
    setHomeSettingsOpen(true);
  };

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
            onEditSettings={editHomeSettings}
            onUpdateSettings={updateSettings}
            onSessionActiveChange={setFlipSessionActive}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            paused={showSettings}
            homeSettingsOpen={homeSettingsOpen}
            homeSettingsHeight={homeSettingsHeight}
            onHomeSettingsOpenChange={setHomeSettingsOpen}
            onHomeSettingsHeightChange={updateHomeSettingsHeight}
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
            editSettings={editHomeSettings}
            updateSettings={updateSettings}
            selectTrainingType={selectTrainingType}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            homeSettingsOpen={homeSettingsOpen}
            homeSettingsHeight={homeSettingsHeight}
            onHomeSettingsOpenChange={setHomeSettingsOpen}
            onHomeSettingsHeightChange={updateHomeSettingsHeight}
          />
        )}
      </section>

      {showSettings && (
        <SettingsModal
          soundEnabled={soundEnabled}
          shortcutKeys={shortcutKeys}
          trainingType={settings.trainingType}
          onToggleSound={toggleSound}
          onUpdateShortcutKeys={updateShortcutKeys}
          onClose={closeSettings}
        />
      )}
    </main>
  );
}
