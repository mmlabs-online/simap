import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriveError } from "@/server/drive/client";
import { DriveConfigError } from "@/server/drive/config";
import type { OrgDrive } from "@/server/drive/drive";

vi.mock("server-only", () => ({}));

import { etagMatches, mapDriveFailure, useDrive } from "./image-flow";

let errLog: { mock: { calls: unknown[][] }; mockRestore(): void };
const logged = () => errLog.mock.calls.map((c: unknown[]) => JSON.parse(String(c[0])));
beforeEach(() => {
  errLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errLog.mockRestore());

describe("mapDriveFailure", () => {
  it("DriveConfigError and rate-limited/unavailable give 503; other DriveError gives 502; the event is the given one", () => {
    expect(mapDriveFailure(new DriveConfigError("off"), "upload", "my_event")).toEqual({
      ok: false,
      status: 503,
      code: "images_unavailable",
    });
    expect(mapDriveFailure(new DriveError("drive_rate_limited"), "get", "my_event").status).toBe(
      503,
    );
    expect(mapDriveFailure(new DriveError("drive_unavailable"), "get", "my_event").status).toBe(
      503,
    );
    expect(mapDriveFailure(new DriveError("drive_auth"), "get", "my_event")).toEqual({
      ok: false,
      status: 502,
      code: "drive_error",
    });
    expect(logged()).toEqual([
      { event: "my_event", op: "upload", code: "drive_config" },
      { event: "my_event", op: "get", code: "drive_rate_limited" },
      { event: "my_event", op: "get", code: "drive_unavailable" },
      { event: "my_event", op: "get", code: "drive_auth" },
    ]);
  });

  it("rethrows anything else", () => {
    const err = new Error("boom");
    expect(() => mapDriveFailure(err, "get", "my_event")).toThrow(err);
  });
});

describe("etagMatches", () => {
  it("exact, list, W/ prefix, *, null", () => {
    expect(etagMatches('"a"', '"a"')).toBe(true);
    expect(etagMatches('"b", "a"', '"a"')).toBe(true);
    expect(etagMatches('W/"a"', '"a"')).toBe(true);
    expect(etagMatches("*", '"a"')).toBe(true);
    expect(etagMatches('"b"', '"a"')).toBe(false);
    expect(etagMatches(null, '"a"')).toBe(false);
  });
});

describe("useDrive", () => {
  it("throws DriveConfigError when the getter returns null, else returns the drive", () => {
    expect(() => useDrive(() => null)).toThrow(DriveConfigError);
    const d = {} as OrgDrive;
    expect(useDrive(() => d)).toBe(d);
  });
});
