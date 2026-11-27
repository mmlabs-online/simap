import { describe, expect, it } from "vitest";
import { createMockProvider } from "./mock";
import { ProviderPullError } from "./types";

const ENTRY = { member: { kind: "email", value: "a@example.com" }, roomCode: "R1" } as const;
const req = (signal: AbortSignal = new AbortController().signal) => ({
  workDate: "2026-11-26",
  signal,
});

describe("mock provider", () => {
  it("returns its entries in the payload shape", async () => {
    const p = createMockProvider([ENTRY]);
    expect(p.id).toBe("mock");
    expect(await p.pull(req())).toEqual({ checkIns: [ENTRY] });
  });

  it("fail error rejects with ProviderPullError provider_error", async () => {
    const p = createMockProvider([ENTRY], { fail: "error" });
    const err = await p.pull(req()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderPullError);
    expect((err as ProviderPullError).code).toBe("provider_error");
  });

  it("fail hang honours the abort signal", async () => {
    const p = createMockProvider([ENTRY], { fail: "hang" });
    const ac = new AbortController();
    const pending = p.pull(req(ac.signal)).catch((e: unknown) => e);
    ac.abort();
    const err = await pending;
    expect((err as ProviderPullError).code).toBe("timeout");
  });
});
