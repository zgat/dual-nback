"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "countdown" | "playing" | "paused" | "finished";
type Channel = "position" | "audio";

type Trial = {
  position: number;
  letter: string;
};

type GameSettings = {
  n: number;
  total: number;
  interval: number;
  sound: boolean;
};

type Stats = {
  correct: number;
  total: number;
  positionHits: number;
  audioHits: number;
  misses: number;
  falseAlarms: number;
  streak: number;
  bestStreak: number;
};

const LETTERS = ["C", "H", "K", "L", "Q", "R", "S", "T"];
const DEFAULT_SETTINGS: GameSettings = { n: 2, total: 20, interval: 2400, sound: true };
const EMPTY_STATS: Stats = {
  correct: 0,
  total: 0,
  positionHits: 0,
  audioHits: 0,
  misses: 0,
  falseAlarms: 0,
  streak: 0,
  bestStreak: 0,
};

function pickDifferent<T>(values: T[], excluded?: T) {
  const choices = excluded === undefined ? values : values.filter((value) => value !== excluded);
  return choices[Math.floor(Math.random() * choices.length)];
}

function makeSequence(total: number, n: number): Trial[] {
  const sequence: Trial[] = [];
  const positions = Array.from({ length: 9 }, (_, index) => index);

  for (let index = 0; index < total; index += 1) {
    const canMatch = index >= n;
    const positionMatch = canMatch && Math.random() < 0.3;
    const audioMatch = canMatch && Math.random() < 0.3;
    const previous = sequence[index - n];

    sequence.push({
      position: positionMatch ? previous.position : pickDifferent(positions, previous?.position),
      letter: audioMatch ? previous.letter : pickDifferent(LETTERS, previous?.letter),
    });
  }

  return sequence;
}

function speakLetter(letter: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(letter);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 0.9;
  window.speechSynthesis.speak(utterance);
}

function scorePercent(stats: Stats) {
  return stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
}

export default function Home() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(-1);
  const [current, setCurrent] = useState<Trial | null>(null);
  const [stimulusVisible, setStimulusVisible] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [responses, setResponses] = useState<Record<Channel, boolean>>({ position: false, audio: false });
  const [feedback, setFeedback] = useState<Record<Channel, "correct" | "wrong" | null>>({ position: null, audio: null });
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [bestScore, setBestScore] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const sequenceRef = useRef<Trial[]>([]);
  const settingsRef = useRef(settings);
  const phaseRef = useRef<Phase>(phase);
  const roundRef = useRef(-1);
  const responsesRef = useRef<Record<Channel, boolean>>({ position: false, audio: false });
  const statsRef = useRef<Stats>(EMPTY_STATS);
  const trialTimerRef = useRef<number | null>(null);
  const stimulusTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const finalizeRef = useRef<() => void>(() => undefined);

  const clearTimers = useCallback(() => {
    if (trialTimerRef.current !== null) window.clearTimeout(trialTimerRef.current);
    if (stimulusTimerRef.current !== null) window.clearTimeout(stimulusTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    trialTimerRef.current = null;
    stimulusTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const startTrial = useCallback((index: number) => {
    const trial = sequenceRef.current[index];
    if (!trial) return;

    roundRef.current = index;
    responsesRef.current = { position: false, audio: false };
    setRound(index);
    setCurrent(trial);
    setResponses({ position: false, audio: false });
    setFeedback({ position: null, audio: null });
    setStimulusVisible(true);
    speakLetter(trial.letter, settingsRef.current.sound);

    const showFor = Math.min(900, Math.round(settingsRef.current.interval * 0.42));
    stimulusTimerRef.current = window.setTimeout(() => setStimulusVisible(false), showFor);
    trialTimerRef.current = window.setTimeout(() => finalizeRef.current(), settingsRef.current.interval);
  }, []);

  const finishSession = useCallback((finalStats: Stats) => {
    clearTimers();
    phaseRef.current = "finished";
    setPhase("finished");
    setStimulusVisible(false);
    window.speechSynthesis?.cancel();

    const score = scorePercent(finalStats);
    setBestScore((previous) => {
      const next = Math.max(previous, score);
      window.localStorage.setItem("dual-nback-best", String(next));
      return next;
    });
  }, [clearTimers]);

  finalizeRef.current = () => {
    if (phaseRef.current !== "playing") return;
    const index = roundRef.current;
    const n = settingsRef.current.n;
    let nextStats = statsRef.current;

    if (index >= n) {
      const trial = sequenceRef.current[index];
      const target = sequenceRef.current[index - n];
      const positionExpected = trial.position === target.position;
      const audioExpected = trial.letter === target.letter;
      const positionCorrect = responsesRef.current.position === positionExpected;
      const audioCorrect = responsesRef.current.audio === audioExpected;
      const roundCorrect = positionCorrect && audioCorrect;
      const nextStreak = roundCorrect ? nextStats.streak + 1 : 0;

      nextStats = {
        correct: nextStats.correct + Number(positionCorrect) + Number(audioCorrect),
        total: nextStats.total + 2,
        positionHits: nextStats.positionHits + Number(positionExpected && responsesRef.current.position),
        audioHits: nextStats.audioHits + Number(audioExpected && responsesRef.current.audio),
        misses: nextStats.misses
          + Number(positionExpected && !responsesRef.current.position)
          + Number(audioExpected && !responsesRef.current.audio),
        falseAlarms: nextStats.falseAlarms
          + Number(!positionExpected && responsesRef.current.position)
          + Number(!audioExpected && responsesRef.current.audio),
        streak: nextStreak,
        bestStreak: Math.max(nextStats.bestStreak, nextStreak),
      };

      statsRef.current = nextStats;
      setStats(nextStats);
    }

    if (index >= settingsRef.current.total - 1) {
      finishSession(nextStats);
    } else {
      startTrial(index + 1);
    }
  };

  const beginCountdown = useCallback(() => {
    clearTimers();
    const nextSequence = makeSequence(settingsRef.current.total, settingsRef.current.n);
    sequenceRef.current = nextSequence;
    statsRef.current = EMPTY_STATS;
    responsesRef.current = { position: false, audio: false };
    roundRef.current = -1;
    phaseRef.current = "countdown";
    setPhase("countdown");
    setRound(-1);
    setCurrent(null);
    setStats(EMPTY_STATS);
    setFeedback({ position: null, audio: null });
    setResponses({ position: false, audio: false });
    setCountdown(3);

    let remaining = 3;
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        phaseRef.current = "playing";
        setPhase("playing");
        startTrial(0);
      } else {
        setCountdown(remaining);
      }
    }, 700);
  }, [clearTimers, startTrial]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    clearTimers();
    phaseRef.current = "paused";
    setPhase("paused");
    setStimulusVisible(false);
    window.speechSynthesis?.cancel();
  }, [clearTimers]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") {
      pauseGame();
    } else if (phaseRef.current === "paused") {
      phaseRef.current = "playing";
      setPhase("playing");
      startTrial(Math.max(0, roundRef.current));
    }
  }, [pauseGame, startTrial]);

  const respond = useCallback((channel: Channel) => {
    if (phaseRef.current !== "playing") return;
    const index = roundRef.current;
    const n = settingsRef.current.n;
    if (index < n || responsesRef.current[channel]) return;

    const trial = sequenceRef.current[index];
    const target = sequenceRef.current[index - n];
    const isMatch = channel === "position"
      ? trial.position === target.position
      : trial.letter === target.letter;

    responsesRef.current = { ...responsesRef.current, [channel]: true };
    setResponses(responsesRef.current);
    setFeedback((previous) => ({ ...previous, [channel]: isMatch ? "correct" : "wrong" }));
  }, []);

  const openSettings = () => {
    if (phaseRef.current === "playing") pauseGame();
    setDraftSettings(settingsRef.current);
    setShowSettings(true);
  };

  const saveSettings = () => {
    settingsRef.current = draftSettings;
    setSettings(draftSettings);
    window.localStorage.setItem("dual-nback-settings", JSON.stringify(draftSettings));
    setShowSettings(false);
  };

  const levelUp = () => {
    const next = { ...settingsRef.current, n: Math.min(5, settingsRef.current.n + 1) };
    settingsRef.current = next;
    setSettings(next);
    setDraftSettings(next);
    window.localStorage.setItem("dual-nback-settings", JSON.stringify(next));
    beginCountdown();
  };

  useEffect(() => {
    try {
      const savedSettings = window.localStorage.getItem("dual-nback-settings");
      const savedBest = Number(window.localStorage.getItem("dual-nback-best") || 0);
      if (savedSettings) {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } as GameSettings;
        settingsRef.current = parsed;
        setSettings(parsed);
        setDraftSettings(parsed);
      }
      setBestScore(savedBest);
    } catch {
      // The game remains fully playable when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || showSettings) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") respond("position");
      if (key === "l" || key === "arrowright") respond("audio");
      if (key === "p" || key === "escape") togglePause();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [respond, showSettings, togglePause]);

  useEffect(() => () => {
    clearTimers();
    window.speechSynthesis?.cancel();
  }, [clearTimers]);

  const accuracy = scorePercent(stats);
  const warmup = phase === "playing" && round < settings.n;
  const responseDisabled = phase !== "playing" || warmup;
  const progress = round < 0 ? 0 : ((round + 1) / settings.total) * 100;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => phase !== "playing" && setPhase("idle")} aria-label="回到游戏首页">
          <span className="brand-mark">N²</span>
          <span>双重记忆</span>
        </button>

        <div className="round-pill" aria-live="polite">
          {phase === "idle" ? `${settings.n}-BACK` : `第 ${Math.max(0, round + 1)} / ${settings.total} 轮`}
        </div>

        <button className="icon-button" onClick={openSettings} aria-label="打开训练设置">⚙</button>
        <div className="top-progress" style={{ width: `${progress}%` }} />
      </header>

      <section className="game-stage">
        <div className="stage-heading">
          <span className="eyebrow">专注训练 · {settings.n}-BACK</span>
          <h1>{phase === "finished" ? "训练完成" : "记住位置与声音"}</h1>
          <p>
            {warmup
              ? `先记住前 ${settings.n} 轮，之后开始判断。`
              : phase === "paused"
                ? "训练已暂停，准备好后继续。"
                : `当现在的刺激与 ${settings.n} 轮前相同时，按下对应按钮。`}
          </p>
        </div>

        {phase === "finished" ? (
          <section className="result-panel" aria-label="训练结果">
            <div className="score-ring" style={{ "--score": `${accuracy * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{accuracy}</strong><span>%</span><small>综合正确率</small></div>
            </div>
            <div className="result-copy">
              <span className="result-kicker">本轮表现</span>
              <h2>{accuracy >= 85 ? "状态很稳，继续挑战。" : accuracy >= 70 ? "节奏不错，再巩固一轮。" : "放慢一点，准确优先。"}</h2>
              <div className="result-metrics">
                <span><b>{stats.positionHits}</b> 位置命中</span>
                <span><b>{stats.audioHits}</b> 声音命中</span>
                <span><b>{stats.misses}</b> 漏报</span>
                <span><b>{stats.falseAlarms}</b> 误报</span>
              </div>
              <div className="result-actions">
                <button className="secondary-button" onClick={beginCountdown}>再练一轮</button>
                <button className="primary-button" onClick={levelUp} disabled={settings.n >= 5}>
                  {settings.n >= 5 ? "已到最高难度" : `挑战 ${settings.n + 1}-Back`} <span>→</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="game-grid" aria-label="3 乘 3 位置棋盘">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  className={`grid-cell ${stimulusVisible && current?.position === index ? "is-active" : ""}`}
                  key={index}
                  aria-hidden="true"
                />
              ))}

              <div className={`audio-cue ${stimulusVisible ? "is-speaking" : ""}`} aria-live="assertive">
                <span className="sound-rings" aria-hidden="true">)))</span>
                <strong>{settings.sound ? "♫" : stimulusVisible ? current?.letter : "·"}</strong>
                <span className="sr-only">{stimulusVisible ? `声音 ${current?.letter}` : ""}</span>
              </div>

              {phase === "countdown" && <div className="board-overlay countdown-number">{countdown}</div>}
              {phase === "paused" && <div className="board-overlay"><span>已暂停</span><small>按 P 或下方按钮继续</small></div>}
              {phase === "idle" && <div className="board-overlay intro-overlay"><span>双通道训练</span><small>位置 + 声音，同时保持在线</small></div>}
            </div>

            <div className="response-area">
              <button
                className={`match-button position-match ${responses.position ? "is-pressed" : ""} ${feedback.position ? `is-${feedback.position}` : ""}`}
                onClick={() => respond("position")}
                disabled={responseDisabled}
                aria-label="位置与 N 轮前相同，快捷键 A"
              >
                <span className="keycap">A</span>
                <span><b>位置相同</b><small>POSITION MATCH</small></span>
              </button>
              <button
                className={`match-button sound-match ${responses.audio ? "is-pressed" : ""} ${feedback.audio ? `is-${feedback.audio}` : ""}`}
                onClick={() => respond("audio")}
                disabled={responseDisabled}
                aria-label="声音与 N 轮前相同，快捷键 L"
              >
                <span><b>声音相同</b><small>SOUND MATCH</small></span>
                <span className="keycap">L</span>
              </button>
            </div>

            {phase === "idle" ? (
              <button className="start-button" onClick={beginCountdown}>开始训练 <span>→</span></button>
            ) : phase === "countdown" ? (
              <button className="start-button is-muted" disabled>准备开始…</button>
            ) : (
              <button className="start-button pause-button" onClick={togglePause}>
                {phase === "paused" ? "继续训练" : "暂停训练"} <span>{phase === "paused" ? "→" : "Ⅱ"}</span>
              </button>
            )}
          </>
        )}
      </section>

      <footer className="statusbar">
        <span><i className={`status-dot ${settings.sound ? "" : "is-off"}`} /> {settings.sound ? "语音已开启" : "字母静音显示"}</span>
        <span>正确率 <b>{stats.total ? `${accuracy}%` : "—"}</b></span>
        <span>连续正确 <b>{stats.streak}</b></span>
        <span>历史最佳 <b>{bestScore ? `${bestScore}%` : "—"}</b></span>
      </footer>

      {showSettings && (
        <div className="modal-backdrop" onMouseDown={() => setShowSettings(false)}>
          <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <div><span className="eyebrow">TRAINING SETUP</span><h2 id="settings-title">训练设置</h2></div>
              <button className="close-button" onClick={() => setShowSettings(false)} aria-label="关闭设置">×</button>
            </div>

            <div className="setting-row">
              <div><b>N-Back 难度</b><small>需要回忆多少轮之前的刺激</small></div>
              <div className="stepper">
                <button onClick={() => setDraftSettings((value) => ({ ...value, n: Math.max(1, value.n - 1) }))} aria-label="降低难度">−</button>
                <strong>{draftSettings.n}</strong>
                <button onClick={() => setDraftSettings((value) => ({ ...value, n: Math.min(5, value.n + 1) }))} aria-label="提高难度">＋</button>
              </div>
            </div>

            <fieldset className="setting-group">
              <legend>每轮节奏</legend>
              <div className="choice-row">
                {[{ label: "舒缓", value: 3000 }, { label: "标准", value: 2400 }, { label: "快速", value: 1800 }].map((option) => (
                  <button className={draftSettings.interval === option.value ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, interval: option.value }))} key={option.value}>
                    {option.label}<small>{option.value / 1000} 秒</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="setting-group">
              <legend>训练长度</legend>
              <div className="choice-row two-columns">
                {[20, 30].map((total) => (
                  <button className={draftSettings.total === total ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, total }))} key={total}>
                    {total} 轮<small>约 {Math.ceil((total * draftSettings.interval) / 60000)} 分钟</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="sound-toggle">
              <span><b>语音字母</b><small>关闭后会在圆形提示中显示字母</small></span>
              <input type="checkbox" checked={draftSettings.sound} onChange={(event) => setDraftSettings((value) => ({ ...value, sound: event.target.checked }))} />
              <i aria-hidden="true" />
            </label>

            <div className="how-to">
              <b>操作提示</b>
              <p>按 <kbd>A</kbd> 判断位置相同，按 <kbd>L</kbd> 判断声音相同；两者可能在同一轮同时出现。按 <kbd>P</kbd> 可暂停。</p>
            </div>

            <button className="start-button" onClick={saveSettings}>保存设置</button>
          </section>
        </div>
      )}
    </main>
  );
}
