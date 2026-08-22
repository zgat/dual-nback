import type { MatchType } from "./core";

export type ShortcutAction = MatchType | "advance";
export type ShortcutKeys = Record<ShortcutAction, string>;

export const SHORTCUT_ACTIONS: ShortcutAction[] = ["exact", "position", "color", "different", "advance"];

export const DEFAULT_SHORTCUT_KEYS: ShortcutKeys = {
  exact: "1",
  position: "2",
  color: "3",
  different: "4",
  advance: "Enter",
};

export function normalizeShortcutKey(key: string) {
  if (key === " " || key === "Spacebar") return " ";
  if (key === "Enter") return "Enter";
  if (key.length === 1) return key.toLocaleLowerCase();
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return key;
  return null;
}

export function formatShortcutKey(key: string) {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toLocaleUpperCase() : key;
}

export function assignShortcutKey(keys: ShortcutKeys, action: ShortcutAction, key: string): ShortcutKeys {
  const previousKey = keys[action];
  const displacedAction = SHORTCUT_ACTIONS.find((candidate) => candidate !== action && keys[candidate] === key);
  const next = { ...keys, [action]: key };
  if (displacedAction) next[displacedAction] = previousKey;
  return next;
}

export function normalizeShortcutKeys(value: unknown): ShortcutKeys {
  if (!value || typeof value !== "object") return DEFAULT_SHORTCUT_KEYS;
  const candidate = value as Partial<Record<ShortcutAction, unknown>>;
  const entries = SHORTCUT_ACTIONS.map((action) => {
    const key = typeof candidate[action] === "string" ? normalizeShortcutKey(candidate[action]) : null;
    return [action, key] as const;
  });
  if (entries.some(([, key]) => !key)) return DEFAULT_SHORTCUT_KEYS;
  const values = entries.map(([, key]) => key as string);
  if (new Set(values).size !== SHORTCUT_ACTIONS.length) return DEFAULT_SHORTCUT_KEYS;
  return Object.fromEntries(entries) as ShortcutKeys;
}
