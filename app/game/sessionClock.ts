/** Monotonic active time; once finished, later pauses cannot change a score. */
export function createSessionClock(now: () => number = () => performance.now()) {
  let startedAt: number | null = null;
  let pausedAt: number | null = null;
  let pausedMs = 0;
  let finishedMs: number | null = null;

  const elapsed = (at = now()) => finishedMs ?? (startedAt === null
    ? 0 : Math.max(0, (pausedAt ?? at) - startedAt - pausedMs));

  return {
    start() { startedAt = now(); pausedAt = null; pausedMs = 0; finishedMs = null; },
    pause() {
      if (startedAt !== null && pausedAt === null && finishedMs === null) pausedAt = now();
    },
    resume() {
      if (pausedAt !== null && finishedMs === null) pausedMs += now() - pausedAt;
      pausedAt = null;
    },
    finish(at = now()) { finishedMs ??= elapsed(at); return finishedMs; },
    elapsed,
  };
}
