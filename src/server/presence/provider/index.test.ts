import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";

const applyProviderCheckIn = vi.fn(async () => "applied");
vi.mock("../presence", () => ({
  applyProviderCheckIn: (...a: unknown[]) =>
    (applyProviderCheckIn as (...x: unknown[]) => unknown)(...a),
}));

const { syncProviderCheckIns } = await import("./index");

const scope = { orgId: "o1" } as unknown as OrgScope;

beforeEach(() => {
  globalThis.__simapPresenceProvider = undefined;
  applyProviderCheckIn.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapPresenceProvider = undefined;
});

describe("syncProviderCheckIns", () => {
  it("provider off -> a no-op that never calls apply", async () => {
    vi.stubEnv("SIMAP_PRESENCE_PROVIDER", "");
    await syncProviderCheckIns({} as never, scope);
    expect(applyProviderCheckIn).not.toHaveBeenCalled();
  });

  it("mock -> applies the configured entries with the provider id", async () => {
    vi.stubEnv("SIMAP_PRESENCE_PROVIDER", "mock");
    vi.stubEnv("SIMAP_PRESENCE_PROVIDER_MOCK", "a@example.com=r1");
    await syncProviderCheckIns({} as never, scope);
    expect(applyProviderCheckIn).toHaveBeenCalledTimes(1);
    const a = applyProviderCheckIn.mock.calls[0] as unknown as unknown[];
    expect(a[2]).toEqual({ member: { kind: "email", value: "a@example.com" }, roomCode: "R1" });
    expect(a[5]).toBe("mock");
  });

  it("an invalid config turns the provider off with one fixed log", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("SIMAP_PRESENCE_PROVIDER", "other-secret");
    await syncProviderCheckIns({} as never, scope);
    await syncProviderCheckIns({} as never, scope);
    expect(applyProviderCheckIn).not.toHaveBeenCalled();
    expect(err.mock.calls).toEqual([
      [JSON.stringify({ event: "presence_provider_config_invalid" })],
    ]);
  });
});
