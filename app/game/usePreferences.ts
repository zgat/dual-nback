"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, normalizeSettings } from "./core";
import type { GameSettings, TrainingType } from "./core";
import { readSettings, readSoundEnabled, writeSettings, writeSoundEnabled } from "./storage";

export function usePreferences() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const settingsRef = useRef(settings);
  const soundEnabledRef = useRef(soundEnabled);

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    const next = normalizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    writeSettings(next);
  }, []);

  const selectTrainingType = useCallback((trainingType: TrainingType) => {
    updateSettings({ trainingType });
  }, [updateSettings]);

  const toggleSound = useCallback(() => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    writeSoundEnabled(next);
  }, []);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      const savedSettings = readSettings();
      const savedSoundEnabled = readSoundEnabled();
      settingsRef.current = savedSettings;
      soundEnabledRef.current = savedSoundEnabled;
      setSettings(savedSettings);
      setSoundEnabled(savedSoundEnabled);
    }, 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  return { settings, soundEnabled, updateSettings, selectTrainingType, toggleSound };
}
