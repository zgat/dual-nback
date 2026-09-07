"use client";

import { useState } from "react";
import { createSessionClock } from "./sessionClock";

export function useSessionClock() {
  const [clock] = useState(createSessionClock);
  return clock;
}
