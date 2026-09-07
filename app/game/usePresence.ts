"use client";

import { useEffect, useState } from "react";

// Retain overlays through exit; reopening cancels removal and lets CSS reverse.
export function usePresence(open: boolean, exitMs = 160) {
  const [retained, setRetained] = useState(open);
  useEffect(() => {
    if (open || !retained) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setRetained(false), reducedMotion ? 0 : exitMs);
    return () => window.clearTimeout(timer);
  }, [open, retained, exitMs]);
  // Synchronize before paint, including rapid open/close sequences.
  if (open && !retained) setRetained(true);
  return { mounted: open || retained, exiting: !open };
}
