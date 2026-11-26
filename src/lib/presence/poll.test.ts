import { describe, expect, it } from "vitest";
import { createPoller, nextPollDelay, POLL_BASE_MS, POLL_FAILURE_MS, STALE_AFTER } from "./poll";

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function setup(results: boolean[] = []) {
  let time = 1_000_000;
  let visible = true;
  let nextId = 1;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  const stale: boolean[] = [];
  let loads = 0;
  let pending: ((ok: boolean) => void) | null = null;
  const load = () => {
    loads++;
    const ready = results.shift();
    if (ready !== undefined) return Promise.resolve(ready);
    return new Promise<boolean>((resolve) => {
      pending = resolve;
    });
  };
  const poller = createPoller({
    load,
    isVisible: () => visible,
    now: () => time,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
    onStale: (s) => stale.push(s),
  });
  const only = () => [...timers.values()];
  return {
    poller,
    stale,
    only,
    loads: () => loads,
    fire: async () => {
      const [t] = only();
      timers.clear();
      t.fn();
      await flush();
    },
    resolve: async (ok: boolean) => {
      pending?.(ok);
      pending = null;
      await flush();
    },
    advance: (ms: number) => void (time += ms),
    setVisible: (v: boolean) => void (visible = v),
  };
}

describe("nextPollDelay", () => {
  it("hidden none; visible 45 s; after a failure 60 s; always within 30-60 s", () => {
    expect(nextPollDelay(false, 0)).toBeNull();
    expect(nextPollDelay(true, 0)).toBe(45_000);
    expect(nextPollDelay(true, 1)).toBe(60_000);
    for (const f of [0, 1, 5]) {
      const d = nextPollDelay(true, f)!;
      expect(d).toBeGreaterThanOrEqual(30_000);
      expect(d).toBeLessThanOrEqual(60_000);
    }
  });
});

describe("createPoller", () => {
  it("start while visible schedules one 45 s timer; a tick loads once and reschedules", async () => {
    const t = setup([true]);
    t.poller.start();
    expect(t.only().map((x) => x.ms)).toEqual([POLL_BASE_MS]);
    await t.fire();
    expect(t.loads()).toBe(1);
    expect(t.only().map((x) => x.ms)).toEqual([POLL_BASE_MS]);
  });

  it("hidden clears the timer and no load runs while hidden", () => {
    const t = setup([true]);
    t.poller.start();
    t.setVisible(false);
    t.poller.visibilityChanged();
    expect(t.only()).toEqual([]);
    t.advance(10 * 60_000);
    expect(t.loads()).toBe(0);
  });

  it("visible again loads at once when the last run is 45 s old or more, else waits the remainder", async () => {
    const t = setup([true, true]);
    t.poller.start();
    t.setVisible(false);
    t.poller.visibilityChanged();
    t.advance(50_000);
    t.setVisible(true);
    t.poller.visibilityChanged();
    await flush();
    expect(t.loads()).toBe(1);
    t.advance(10_000);
    t.setVisible(false);
    t.poller.visibilityChanged();
    t.setVisible(true);
    t.poller.visibilityChanged();
    expect(t.loads()).toBe(1);
    expect(t.only().map((x) => x.ms)).toEqual([POLL_BASE_MS - 10_000]);
  });

  it("a refreshNow during a load joins it and does not start a second load", async () => {
    const t = setup();
    t.poller.start();
    await t.fire();
    expect(t.loads()).toBe(1);
    const joined = t.poller.refreshNow();
    expect(t.loads()).toBe(1);
    await t.resolve(true);
    await joined;
    expect(t.loads()).toBe(1);
  });

  it("a failed load waits 60 s; stale after 2 failures; cleared by a success", async () => {
    const t = setup([false, false, true]);
    t.poller.start();
    await t.fire();
    expect(t.only().map((x) => x.ms)).toEqual([POLL_FAILURE_MS]);
    expect(t.stale).toEqual([]);
    await t.fire();
    expect(STALE_AFTER).toBe(2);
    expect(t.stale).toEqual([true]);
    await t.fire();
    expect(t.stale).toEqual([true, false]);
    expect(t.only().map((x) => x.ms)).toEqual([POLL_BASE_MS]);
  });

  it("a load that throws counts as a failure", async () => {
    let n = 0;
    const timers: (() => void)[] = [];
    const poller = createPoller({
      load: () => (n++, Promise.reject(new Error("x"))),
      isVisible: () => true,
      now: () => 0,
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => {},
      onStale: () => {},
    });
    await poller.refreshNow();
    expect(n).toBe(1);
    expect(timers).toHaveLength(1);
  });

  it("dispose clears the timer and a load that resolves later schedules nothing", async () => {
    const t = setup();
    t.poller.start();
    await t.fire();
    t.poller.dispose();
    await t.resolve(true);
    expect(t.only()).toEqual([]);
    t.poller.start();
    expect(t.only()).toEqual([]);
  });

  it("refreshNow clears the pending timer, loads, and restarts the 45 s wait", async () => {
    const t = setup([true]);
    t.poller.start();
    t.advance(20_000);
    await t.poller.refreshNow();
    expect(t.loads()).toBe(1);
    expect(t.only().map((x) => x.ms)).toEqual([POLL_BASE_MS]);
  });
});
