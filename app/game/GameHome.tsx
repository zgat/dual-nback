"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, TransitionEvent } from "react";
import type { GameSettings, TrainingType } from "./core";
import { IdleSettings } from "./IdleSettings";
import { SoundToggle } from "./SoundToggle";
import { TrainingTypeSwitch } from "./TrainingTypeSwitch";

export function GameHome({
  eyebrow,
  title,
  description,
  introVisual,
  settings,
  startLabel,
  onStart,
  onUpdateSettings,
  onSelectTrainingType,
  soundEnabled,
  onToggleSound,
  settingsOpen,
  settingsHeight,
  onSettingsOpenChange,
  onSettingsHeightChange,
}: {
  eyebrow: string;
  title: string;
  description: string;
  introVisual?: ReactNode;
  settings: GameSettings;
  startLabel: string;
  onStart: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onSelectTrainingType: (trainingType: TrainingType) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  settingsOpen: boolean;
  settingsHeight: number;
  onSettingsOpenChange: (open: boolean) => void;
  onSettingsHeightChange: (height: number) => void;
}) {
  const settingsId = useId();
  const settingsContentRef = useRef<HTMLDivElement>(null);
  const [revealedHeight, setRevealedHeight] = useState<number | null>(null);
  const revealReady = settingsOpen && settingsHeight > 0 && revealedHeight === settingsHeight;

  useEffect(() => {
    const content = settingsContentRef.current;
    if (!content) return;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => onSettingsHeightChange(content.scrollHeight));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [onSettingsHeightChange, settings.trainingType]);

  useEffect(() => {
    if (!settingsOpen) return;
    const timer = window.setTimeout(() => setRevealedHeight(settingsHeight), 240);
    return () => window.clearTimeout(timer);
  }, [settingsHeight, settingsOpen, settings.trainingType]);

  const toggleSettings = () => {
    if (settingsOpen) {
      setRevealedHeight(null);
      onSettingsOpenChange(false);
    } else {
      onSettingsOpenChange(true);
    }
  };

  const finishReveal = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName === "height" && settingsOpen) setRevealedHeight(settingsHeight);
  };

  const startGame = () => {
    setRevealedHeight(null);
    onSettingsOpenChange(false);
    onStart();
  };

  return (
    <div className="game-home idle-home">
      <div className="stage-heading home-stage-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <div className="home-intro">
          <p>{description}</p>
          <div className={`home-legend-slot ${introVisual ? "" : "is-empty"}`} aria-hidden={!introVisual}>
            {introVisual}
          </div>
        </div>
        <TrainingTypeSwitch selected={settings.trainingType} onSelect={onSelectTrainingType} />
      </div>

      <div className={`settings-disclosure ${settingsOpen ? "is-open" : ""} ${revealReady ? "is-reveal-ready" : ""}`}>
        <div
          className="settings-reveal"
          id={settingsId}
          aria-hidden={!settingsOpen}
          inert={!settingsOpen}
          style={{ height: settingsOpen ? `${settingsHeight}px` : 0 }}
          onTransitionEnd={finishReveal}
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
          onClick={toggleSettings}
        >
          <span className="settings-disclosure-line"><i /><b>设置</b><i /></span>
          <span className="settings-disclosure-chevron" aria-hidden="true" />
        </button>
      </div>

      <div className="idle-launch">
        <button className="start-button" onClick={startGame}>{startLabel} <span>→</span></button>
        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
      </div>
    </div>
  );
}
