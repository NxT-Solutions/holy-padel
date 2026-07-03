import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs` — drives the live clocks. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return (): void => {
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
