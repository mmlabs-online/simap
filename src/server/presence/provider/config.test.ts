import { describe, expect, it } from "vitest";
import { loadProviderConfig, ProviderConfigError } from "./config";

const SUB = "5b0c9a4e-1f3d-4c6a-9d2e-7a8b1c2d3e4f";

describe("loadProviderConfig", () => {
  it("unset or empty -> off", () => {
    expect(loadProviderConfig({})).toEqual({ kind: "off" });
    expect(loadProviderConfig({ SIMAP_PRESENCE_PROVIDER: "" })).toEqual({ kind: "off" });
  });

  it("mock outside production -> mock with parsed entries", () => {
    const c = loadProviderConfig({
      SIMAP_PRESENCE_PROVIDER: "mock",
      NODE_ENV: "development",
      SIMAP_PRESENCE_PROVIDER_MOCK: ` dev@example.com=c302 , ${SUB}=R1 `,
    });
    expect(c).toEqual({
      kind: "mock",
      entries: [
        { member: { kind: "email", value: "dev@example.com" }, roomCode: "C302" },
        { member: { kind: "sub", value: SUB }, roomCode: "R1" },
      ],
    });
  });

  it("mock without entries -> mock with none", () => {
    expect(loadProviderConfig({ SIMAP_PRESENCE_PROVIDER: "mock" })).toEqual({
      kind: "mock",
      entries: [],
    });
  });

  it("refuses mock in production", () => {
    expect(() =>
      loadProviderConfig({ SIMAP_PRESENCE_PROVIDER: "mock", NODE_ENV: "production" }),
    ).toThrow(ProviderConfigError);
  });

  it("refuses mock when SIMAP_DB_TARGET is production, without echoing values", () => {
    let message = "";
    try {
      loadProviderConfig({
        SIMAP_PRESENCE_PROVIDER: "mock",
        NODE_ENV: "development",
        SIMAP_DB_TARGET: "production",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderConfigError);
      message = (e as Error).message;
    }
    expect(message).toContain("not allowed in production");
  });

  it("unknown kind, malformed entry and too many entries throw without echoing the value", () => {
    const secret = "secret-kind-value";
    const bad: Record<string, string>[] = [
      { SIMAP_PRESENCE_PROVIDER: secret },
      { SIMAP_PRESENCE_PROVIDER: "mock", SIMAP_PRESENCE_PROVIDER_MOCK: "who@secret.example" },
      { SIMAP_PRESENCE_PROVIDER: "mock", SIMAP_PRESENCE_PROVIDER_MOCK: "nobody=R1" },
      { SIMAP_PRESENCE_PROVIDER: "mock", SIMAP_PRESENCE_PROVIDER_MOCK: "who@secret.example=" },
      {
        SIMAP_PRESENCE_PROVIDER: "mock",
        SIMAP_PRESENCE_PROVIDER_MOCK: Array.from(
          { length: 201 },
          () => "who@secret.example=R1",
        ).join(","),
      },
    ];
    for (const env of bad) {
      let message = "";
      try {
        loadProviderConfig(env);
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderConfigError);
        message = (e as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(secret);
      expect(message).not.toContain("secret.example");
      expect(message).not.toContain("nobody");
    }
  });
});
