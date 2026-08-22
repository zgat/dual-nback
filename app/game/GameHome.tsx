"use client";

import { useId, useState } from "react";
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
}) {
  const settingsId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revealReady, setRevealReady] = useState(false);

  const toggleSettings = () => {
    if (settingsOpen) {
      setRevealReady(false);
      setSettingsOpen(false);
    } else {
      setSettingsOpen(true);
    }
  };

  const finishReveal = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName === "grid-template-rows" && settingsOpen) setRevealReady(true);
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
          onTransitionEnd={finishReveal}
        >
          <div className="settings-reveal-inner">
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
        <button className="start-button" onClick={onStart}>{startLabel} <span>→</span></button>
        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
      </div>
    </div>
  );
}
