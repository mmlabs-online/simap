import { describe, expect, it, vi, type Mock } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import { createMockProvider } from "./mock";
import { createProviderPuller } from "./pull";
import { type CheckInProvider, type ProviderCheckInInput } from "./types";

const scope = (orgId: string) => ({ orgId }) as unknown as OrgScope;
const A = scope("org-a");
const B = scope("org-b");
const DB = {};

const NOW = new Date("2026-11-26T10:00:00.000Z");
const ENTRIES: ProviderCheckInInput[] = [
  { member: { kind: "email", value: "secret.person@example.com" }, roomCode: "SECRETROOM" },
  { member: { kind: "email", value: "b@example.com" }, roomCode: "R2", at: "2026-11-26T08:00:00Z" },
];

type ApplyMock = Mock<(...a: any[]) => Promise<unknown>>;
function setup(opts: { provider?: CheckInProvider; apply?: ApplyMock } = {}) {
  let now = NOW;
  const apply: ApplyMock = opts.apply ?? vi.fn(async (..._a: any[]) => "applied");
  const log = vi.fn();
  const puller = createProviderPuller({
    provider: opts.provider ?? createMockProvider(ENTRIES),
    apply,
    log,
    clock: () => now,
    timeoutMs: 20,
  });
  return { puller, apply, log, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

describe("provider puller", () => {
  it("pulls from the provider and applies each valid item with providerCheckInAt", async () => {
    const { puller, apply, log } = setup();
    await puller.sync(DB, A);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[0]!.slice(0, 2)).toEqual([DB, A]);
    expect(apply.mock.calls[0]![3]).toEqual(NOW);
    expect(apply.mock.calls[1]![3]).toEqual(new Date("2026-11-26T08:00:00Z"));
    expect(log).not.toHaveBeenCalled();
  });

  it("drops an item whose at is not today", async () => {
    const pull = vi.fn(async () => ({
      checkIns: [{ ...ENTRIES[0], at: "2026-11-24T08:00:00Z" }],
    }));
    const { puller, apply } = setup({ provider: { id: "mock", pull } });
    await puller.sync(DB, A);
    expect(apply).not.toHaveBeenCalled();
  });

  it("a second sync within 30 s does not pull again; after 30 s it does", async () => {
    const pull = vi.fn(async () => ({ checkIns: [] }));
    const { puller, advance } = setup({ provider: { id: "mock", pull } });
    await puller.sync(DB, A);
    advance(29_000);
    await puller.sync(DB, A);
    expect(pull).toHaveBeenCalledTimes(1);
    advance(1_000);
    await puller.sync(DB, A);
    expect(pull).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one in-flight pull and resolve after it is applied", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const apply = vi.fn(async () => {
      await gate;
      return "applied";
    });
    const pull = vi.fn(async () => ({ checkIns: [ENTRIES[0]] }));
    const { puller } = setup({ provider: { id: "mock", pull }, apply });
    let done = 0;
    const calls = [puller.sync(DB, A), puller.sync(DB, A)].map((p) => p.then(() => done++));
    await new Promise((r) => setTimeout(r, 5));
    expect(done).toBe(0);
    release();
    await Promise.all(calls);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(done).toBe(2);
  });

  it("throttle and in-flight state are per org", async () => {
    const pull = vi.fn(async () => ({ checkIns: [] }));
    const { puller } = setup({ provider: { id: "mock", pull } });
    await puller.sync(DB, A);
    await puller.sync(DB, B);
    expect(pull).toHaveBeenCalledTimes(2);
  });

  it("provider rejects, times out or answers badly -> sync resolves and logs only a fixed code", async () => {
    const cases: [CheckInProvider, string][] = [
      [createMockProvider(ENTRIES, { fail: "error" }), "provider_error"],
      [createMockProvider(ENTRIES, { fail: "hang" }), "timeout"],
      [{ id: "mock", pull: () => new Promise(() => {}) }, "timeout"],
      [{ id: "mock", pull: async () => ({ nope: 1 }) }, "bad_response"],
      [
        {
          id: "mock",
          pull: async () => {
            throw new Error("boom");
          },
        },
        "provider_error",
      ],
    ];
    for (const [provider, code] of cases) {
      const { puller, apply, log } = setup({ provider });
      await expect(puller.sync(DB, A)).resolves.toBeUndefined();
      expect(apply).not.toHaveBeenCalled();
      expect(log.mock.calls).toEqual([
        [{ event: "presence_provider_pull_failed", provider: "mock", code }],
      ]);
    }
  });

  it("failure logs only event, provider and a fixed code", async () => {
    const leak = new Error("token=sk-123 secret.person@example.com SECRETROOM");
    const { puller, log } = setup({
      provider: {
        id: "mock",
        pull: async () => {
          throw leak;
        },
      },
    });
    await puller.sync(DB, A);
    const text = JSON.stringify(log.mock.calls);
    for (const s of ["sk-123", "secret.person", "SECRETROOM", "token"]) {
      expect(text).not.toContain(s);
    }
    expect(Object.keys(log.mock.calls[0]![0] as object).sort()).toEqual([
      "code",
      "event",
      "provider",
    ]);
  });

  it("an apply that throws for one item is logged with apply_error and the other items still apply", async () => {
    const apply = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down for secret.person@example.com"))
      .mockResolvedValue("applied");
    const { puller, log } = setup({ apply });
    await puller.sync(DB, A);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(log.mock.calls).toEqual([
      [{ event: "presence_provider_pull_failed", provider: "mock", code: "apply_error" }],
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret.person");
  });
});
