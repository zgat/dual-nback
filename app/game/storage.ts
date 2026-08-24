import { DEFAULT_SETTINGS, normalizeSettings } from "./core";
import type { GameSettings } from "./core";
import { DEFAULT_SHORTCUT_KEYS, normalizeShortcutKeys } from "./shortcuts";
import type { ShortcutKeys } from "./shortcuts";

const SETTINGS_KEY = "dual-nback-settings";
const SOUND_KEY = "dual-nback-sound-enabled";
const SHORTCUTS_KEY = "dual-nback-shortcut-keys";
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

export function readShortcutKeys() {
  try {
    const saved = getStorage()?.getItem(SHORTCUTS_KEY);
    return saved ? normalizeShortcutKeys(JSON.parse(saved)) : DEFAULT_SHORTCUT_KEYS;
  } catch {
    return DEFAULT_SHORTCUT_KEYS;
  }
}

export function writeShortcutKeys(keys: ShortcutKeys) {
  try {
    getStorage()?.setItem(SHORTCUTS_KEY, JSON.stringify(keys));
  } catch {
    // Keep the in-memory keyboard mapping for the current session.
  }
}
