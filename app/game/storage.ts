import { DEFAULT_SETTINGS, normalizeSettings } from "./core";
import type { GameSettings } from "./core";

const SETTINGS_KEY = "dual-nback-settings";
const SOUND_KEY = "dual-nback-sound-enabled";
const STORAGE_VERSION = 2;

type StoredSettings = {
  version: number;
  settings: Partial<GameSettings>;
};

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readSettings(): GameSettings {
  try {
    const saved = getStorage()?.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved) as StoredSettings | Partial<GameSettings>;
    const value = "settings" in parsed ? parsed.settings : parsed;
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...value });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: GameSettings) {
  try {
    getStorage()?.setItem(SETTINGS_KEY, JSON.stringify({ version: STORAGE_VERSION, settings }));
  } catch {
    // Device-local preferences remain optional when storage is unavailable.
  }
}

export function readSoundEnabled() {
  try {
    return getStorage()?.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSoundEnabled(enabled: boolean) {
  try {
    getStorage()?.setItem(SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // Keep the in-memory preference for the current session.
  }
}

export function readBestScore(key: string) {
  try {
    const value = Number(getStorage()?.getItem(key) ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function writeBestScore(key: string, score: number) {
  try {
    getStorage()?.setItem(key, String(score));
  } catch {
    // Best scores are non-critical and should never block a session.
  }
}
