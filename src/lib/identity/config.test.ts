import { describe, expect, it } from "vitest";
import {
  IDENTITY_BASE_PROD,
  TURNSTILE_SITE_KEY_PROD,
  identityBaseFrom,
  turnstileSiteKeyFrom,
} from "./config";

describe("identityBaseFrom", () => {
  it("production ignores the override", () => {
    expect(identityBaseFrom("http://localhost:8000/api/v1", true)).toBe(IDENTITY_BASE_PROD);
    expect(identityBaseFrom(undefined, true)).toBe(IDENTITY_BASE_PROD);
  });

  it("dev accepts http://localhost:<port>/api/v1 and https://<host>/api/v1", () => {
    expect(identityBaseFrom("http://localhost:8000/api/v1", false)).toBe(
      "http://localhost:8000/api/v1",
    );
    expect(identityBaseFrom("https://id.example.test/api/v1", false)).toBe(
      "https://id.example.test/api/v1",
    );
  });

  it.each([
    "http://127.0.0.1:8000/api/v1",
    "http://localhost/api/v1",
    "https://user:pw@id.example.test/api/v1",
    "https://id.example.test/api/v1/",
    "https://id.example.test/api/v1?x=1",
    "https://id.example.test/other",
    "http://id.example.test/api/v1",
    "",
  ])("rejects %j -> production default", (raw) => {
    expect(identityBaseFrom(raw, false)).toBe(IDENTITY_BASE_PROD);
  });

  it("no value -> production default", () => {
    expect(identityBaseFrom(undefined, false)).toBe(IDENTITY_BASE_PROD);
  });
});

describe("turnstileSiteKeyFrom", () => {
  it("production ignores the override; dev accepts a well-formed key only", () => {
    expect(turnstileSiteKeyFrom("0xABC_def-1", true)).toBe(TURNSTILE_SITE_KEY_PROD);
    expect(turnstileSiteKeyFrom("0xABC_def-1", false)).toBe("0xABC_def-1");
    expect(turnstileSiteKeyFrom("bad key", false)).toBe(TURNSTILE_SITE_KEY_PROD);
    expect(turnstileSiteKeyFrom("", false)).toBe(TURNSTILE_SITE_KEY_PROD);
    expect(turnstileSiteKeyFrom(undefined, false)).toBe(TURNSTILE_SITE_KEY_PROD);
  });
});
