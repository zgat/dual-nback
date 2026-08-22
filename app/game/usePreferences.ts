"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, normalizeSettings } from "./core";
import type { GameSettings, TrainingType } from "./core";
import { DEFAULT_SHORTCUT_KEYS } from "./shortcuts";
import type { ShortcutKeys } from "./shortcuts";
import {
  readSettings,
  readShortcutKeys,
  readSoundEnabled,
  writeSettings,
  writeShortcutKeys,
  writeSoundEnabled,
} from "./storage";

export function usePreferences() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [shortcutKeys, setShortcutKeys] = useState<ShortcutKeys>(DEFAULT_SHORTCUT_KEYS);
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

  const updateShortcutKeys = useCallback((next: ShortcutKeys) => {
    setShortcutKeys(next);
    writeShortcutKeys(next);
  }, []);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      const savedSettings = readSettings();
      const savedSoundEnabled = readSoundEnabled();
      const savedShortcutKeys = readShortcutKeys();
      settingsRef.current = savedSettings;
      soundEnabledRef.current = savedSoundEnabled;
      setSettings(savedSettings);
      setSoundEnabled(savedSoundEnabled);
      setShortcutKeys(savedShortcutKeys);
    }, 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  return { settings, soundEnabled, shortcutKeys, updateSettings, selectTrainingType, toggleSound, updateShortcutKeys };
}
