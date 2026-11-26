/** Presence polling (D76): every 30-60 s, paused while the tab is hidden. Pure; timers, clock and visibility are injected. */
export const POLL_BASE_MS = 45_000;
export const POLL_FAILURE_MS = 60_000;
/** Consecutive failed loads before the view shows a stale notice. */
export const STALE_AFTER = 2;

/** Wait before the next load: none while hidden, 45 s normally, 60 s after a failure (always inside 30-60 s). */
export function nextPollDelay(visible: boolean, failures: number): number | null {
  if (!visible) return null;
  return failures > 0 ? POLL_FAILURE_MS : POLL_BASE_MS;
}

export type PollerDeps = {
  /** Resolves true when the load worked. */
  load: () => Promise<boolean>;
  isVisible: () => boolean;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  onStale: (stale: boolean) => void;
};

/** setTimeout chain with one load in flight. `start` only schedules: the first load is the caller's. */
export function createPoller(deps: PollerDeps) {
  let timer: unknown = null;
  let failures = 0;
  let lastRun = deps.now();
  let inFlight: Promise<void> | null = null;
  let disposed = false;
  let stale = false;

  const clear = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  };
  const schedule = (delay: number | null) => {
    clear();
    if (disposed || delay === null) return;
    timer = deps.setTimer(() => {
      timer = null;
      void run();
    }, delay);
  };
  const scheduleNormal = () => schedule(nextPollDelay(deps.isVisible(), failures));
  const run = (): Promise<void> => {
    if (inFlight) return inFlight;
    clear();
    lastRun = deps.now();
    inFlight = deps
      .load()
      .catch(() => false)
      .then((ok) => {
        inFlight = null;
        if (disposed) return;
        failures = ok ? 0 : failures + 1;
        const next = failures >= STALE_AFTER;
        if (next !== stale) {
          stale = next;
          deps.onStale(next);
        }
        scheduleNormal();
      });
    return inFlight;
  };

  return {
    start: scheduleNormal,
    /** Call on `visibilitychange`: hidden stops the timer; visible loads at once when due, else waits the remainder. */
    visibilityChanged: () => {
      if (disposed) return;
      if (!deps.isVisible()) {
        clear();
        return;
      }
      if (inFlight) return;
      const wait = nextPollDelay(true, failures)!;
      const left = wait - (deps.now() - lastRun);
      if (left <= 0) void run();
      else schedule(left);
    },
    /** Loads now (own check-in, check-out or move) and restarts the wait; joins a load already running. */
    refreshNow: () => run(),
    dispose: () => {
      disposed = true;
      clear();
    },
  };
}
