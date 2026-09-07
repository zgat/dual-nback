"use client";

import { useEffect, useState } from "react";

/** Keep both labels in one grid cell while reversing or completing a change. */
export function AnimatedLabel({ text, className = "" }: { text: string; className?: string }) {
  const [labels, setLabels] = useState({active: text, previous: null as string | null});
  if (labels.active !== text) setLabels({active: text, previous: labels.active});
  useEffect(() => {
    if (labels.previous === null) return;
    const timer = window.setTimeout(() => setLabels(current => ({...current, previous: null})), 180);
    return () => window.clearTimeout(timer);
  }, [labels.active, labels.previous]);
  return (
    <span className={`animated-label ${className}`}>
      {labels.previous !== null && <span key={labels.previous} className="label-leaving" aria-hidden="true">{labels.previous}</span>}
      <span key={labels.active} className="label-current">{labels.active}</span>
    </span>
  );
}
