"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type TimerEntry = {
  callback: () => void;
  id: number | null;
  remainingMs: number;
  startedAt: number;
};

export function usePausableTimers() {
  const timersRef = useRef(new Map<string, TimerEntry>());
  const pausedRef = useRef(false);

  const startEntry = useCallback((key: string, entry: TimerEntry) => {
    entry.startedAt = performance.now();
    entry.id = window.setTimeout(() => {
      timersRef.current.delete(key);
      entry.id = null;
      entry.callback();
    }, Math.max(0, entry.remainingMs));
  }, []);

  const clear = useCallback((key: string) => {
    const entry = timersRef.current.get(key);
    if (entry?.id !== null && entry?.id !== undefined) window.clearTimeout(entry.id);
    timersRef.current.delete(key);
  }, []);

  const schedule = useCallback((key: string, callback: () => void, delayMs: number) => {
    clear(key);
    const entry: TimerEntry = {
      callback,
      id: null,
      remainingMs: Math.max(0, delayMs),
      startedAt: performance.now(),
    };
    timersRef.current.set(key, entry);
    if (!pausedRef.current) startEntry(key, entry);
  }, [clear, startEntry]);

  const pauseAll = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    const now = performance.now();
    timersRef.current.forEach((entry) => {
      if (entry.id === null) return;
      window.clearTimeout(entry.id);
      entry.id = null;
      entry.remainingMs = Math.max(0, entry.remainingMs - (now - entry.startedAt));
    });
  }, []);

  const resumeAll = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    timersRef.current.forEach((entry, key) => {
      if (entry.id === null) startEntry(key, entry);
    });
  }, [startEntry]);

  const extend = useCallback((key: string, extraMs: number) => {
    const entry = timersRef.current.get(key);
    if (!entry) return;
    if (entry.id !== null) {
      window.clearTimeout(entry.id);
      entry.remainingMs = Math.max(0, entry.remainingMs - (performance.now() - entry.startedAt));
      entry.id = null;
    }
    entry.remainingMs += Math.max(0, extraMs);
    if (!pausedRef.current) startEntry(key, entry);
  }, [startEntry]);

  const clearAll = useCallback(() => {
    timersRef.current.forEach((entry) => {
      if (entry.id !== null) window.clearTimeout(entry.id);
    });
    timersRef.current.clear();
    pausedRef.current = false;
  }, []);

  useEffect(() => clearAll, [clearAll]);

  return useMemo(
    () => ({ schedule, clear, pauseAll, resumeAll, clearAll, extend }),
    [schedule, clear, pauseAll, resumeAll, clearAll, extend],
  );
}
