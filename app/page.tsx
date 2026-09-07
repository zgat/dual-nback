"use client";

import { useCallback, useState } from "react";
import { FlipMemoryGame } from "./game/FlipMemoryGame";
import { GameHome } from "./game/GameHome";
import { LeaderboardModal } from "./game/LeaderboardModal";
import { NBackGame } from "./game/NBackGame";
import { ReactionGame } from "./game/ReactionGame";
import { SettingsModal } from "./game/SettingsModal";
import { useFlipMemoryGame } from "./game/useFlipMemoryGame";
import { useGameController } from "./game/useGameController";
import { useLeaderboard } from "./game/useLeaderboard";
import { usePreferences } from "./game/usePreferences";
import { usePresence } from "./game/usePresence";
import { useReactionGame } from "./game/useReactionGame";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const settingsPresence = usePresence(showSettings);
  const leaderboardPresence = usePresence(showLeaderboard);
  const modalVisible = settingsPresence.mounted || leaderboardPresence.mounted;
  const [homeSettingsOpen, setHomeSettingsOpen] = useState(false);
  const [homeSettingsHeight, setHomeSettingsHeight] = useState(0);
  const [restartTurns, setRestartTurns] = useState(0);
  const preferences = usePreferences();
  const leaderboard = useLeaderboard();
  const { settings, soundEnabled, shortcutKeys, updateSettings, selectTrainingType, toggleSound, updateShortcutKeys } = preferences;
  const game = useGameController(settings, soundEnabled, shortcutKeys, modalVisible, leaderboard.recordResult);
  const flipGame = useFlipMemoryGame({settings, soundEnabled, paused: modalVisible, onSessionFinished: leaderboard.recordFlipResult});
  const reactionGame = useReactionGame({settings, soundEnabled, paused: modalVisible, onSessionFinished: leaderboard.recordReactionResult});
  const { phase, round, beginCountdown, pauseGame } = game;
  const isCardMode = settings.trainingType === "cards";
  const isFlipMode = settings.trainingType === "flip";
  const isReactionMode = settings.trainingType === "reaction";
  const isHome = isFlipMode ? flipGame.flipPhase === "idle" : isReactionMode ? reactionGame.phase === "idle" : phase === "idle";
  const progress = isHome || isFlipMode || isReactionMode || round < 0 ? 0 : (round + 1) / settings.total;

  const openSettings = () => { pauseGame(); setShowSettings(true); };
  const openLeaderboard = () => { pauseGame(); setShowLeaderboard(true); };
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const closeLeaderboard = useCallback(() => setShowLeaderboard(false), []);
  const updateHomeSettingsHeight = useCallback((height: number) => {
    setHomeSettingsHeight(current => current === height ? current : height);
  }, []);
  const goHome = () => {
    game.goHome();
    flipGame.goHome();
    reactionGame.goHome();
  };
  const editHomeSettings = () => { goHome(); setHomeSettingsOpen(true); };
  const startGame = () => {
    if (isFlipMode) flipGame.beginGame();
    else if (isReactionMode) reactionGame.beginTest();
    else beginCountdown();
  };
  const restartNBack = () => {
    setRestartTurns(turns => turns + 1);
    beginCountdown();
  };

  return (
    <main className="app-shell">
      {!leaderboard.storageAvailable && (
        <div className="history-storage-notice" role="status">
          <span>历史记录暂时无法保存，关闭页面可能丢失。</span>
          <button type="button" onClick={leaderboard.retrySaving}>重试保存</button>
        </div>
      )}
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="回到游戏首页">
          <span className="brand-mark">N²</span><span>双重记忆</span>
        </button>
        {!isHome ? (
          <button className="round-pill round-home" onClick={goHome} aria-label="结束当前游戏并回到首页">← 回到首页</button>
        ) : (
          <div className="round-pill" aria-live="polite">
            {isFlipMode ? "翻牌记忆" : isReactionMode ? "反应力测试" : `${isCardMode ? "扑克 · " : ""}${settings.n}-BACK`}
          </div>
        )}
        <div className="top-actions">
          {!isFlipMode && !isReactionMode && (phase === "countdown" || phase === "playing" || phase === "paused") && (
            <button className="restart-button" onClick={restartNBack} aria-label="重新开始本轮训练">
              <span className="restart-icon" style={{ transform: `rotate(${restartTurns * 360}deg)` }} aria-hidden="true">↻</span>
              <b>重新开始</b>
            </button>
          )}
          <button className="icon-button" onClick={openSettings} aria-label="打开偏好设置">⚙</button>
        </div>
        <div className="top-progress" style={{ transform: `scaleX(${progress})` }} />
      </header>
      <section className="game-stage">
        {isHome ? (
          <GameHome
            settings={settings} onStart={startGame}
            onSelectTrainingType={selectTrainingType} onUpdateSettings={updateSettings}
            soundEnabled={soundEnabled} onToggleSound={toggleSound} onOpenLeaderboard={openLeaderboard}
            settingsOpen={homeSettingsOpen} settingsHeight={homeSettingsHeight}
            onSettingsOpenChange={setHomeSettingsOpen} onSettingsHeightChange={updateHomeSettingsHeight}
          />
        ) : isReactionMode ? (
          <ReactionGame settings={settings} game={reactionGame} onEditSettings={editHomeSettings} onOpenLeaderboard={openLeaderboard} paused={modalVisible} />
        ) : isFlipMode ? (
          <FlipMemoryGame settings={settings} game={flipGame} onEditSettings={editHomeSettings} onOpenLeaderboard={openLeaderboard} paused={modalVisible} />
        ) : (
          <NBackGame settings={settings} game={game} editSettings={editHomeSettings} onOpenLeaderboard={openLeaderboard} />
        )}
      </section>
      {settingsPresence.mounted && (
        <SettingsModal
          soundEnabled={soundEnabled} shortcutKeys={shortcutKeys} trainingType={settings.trainingType}
          onToggleSound={toggleSound} onUpdateShortcutKeys={updateShortcutKeys}
          onClose={closeSettings} exiting={settingsPresence.exiting}
        />
      )}
      {leaderboardPresence.mounted && (
        <LeaderboardModal
          data={leaderboard.data} initialTrainingType={settings.trainingType}
          initialNBackMode={settings.mode} initialFlipMode={settings.flipMode} initialFlipDifficulty={settings.flipDifficulty}
          onClose={closeLeaderboard} exiting={leaderboardPresence.exiting}
        />
      )}
    </main>
  );
}
