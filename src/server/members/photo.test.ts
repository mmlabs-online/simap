import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveError } from "@/server/drive/client";
import { DriveConfigError } from "@/server/drive/config";
import { jpegOf } from "@/test/photo-fixtures";
import {
  getMemberPhoto,
  getOwnPhoto,
  removeMemberPhoto,
  removeOwnPhoto,
  setOwnPhoto,
} from "./photo";

vi.mock("server-only", () => ({}));

const ORG = "11111111-1111-4111-8111-111111111111";
const scope = { orgId: ORG } as never;
const MEMBER = "22222222-2222-4222-8222-222222222222";
const JPEG = jpegOf(64, 64);

type Call = { text: string; values: unknown[] };
function fakeDb(rowsFor: (text: string) => unknown[]) {
  const calls: Call[] = [];
  const query = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    return { rows: rowsFor(text) };
  };
  return { calls, db: { query, connect: async () => ({ query, release() {} }) } as never };
}
const isSelect = (t: string) => /^\s*select/i.test(t);
const row = (over: Record<string, unknown> = {}) => ({
  id: MEMBER,
  sub: "s1",
  status: "active",
  photo_drive_file_id: "file_abcdefghij",
  photo_version: 3,
  ...over,
});
const driveOf = (over: Record<string, unknown> = {}) => ({
  uploadOrgFile: vi.fn(async () => ({ id: "file_newabcdef", size: 1, mimeType: "image/jpeg" })),
  getFile: vi.fn(async () => ({ bytes: JPEG, contentType: "image/jpeg" })),
  deleteFile: vi.fn(async () => {}),
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("member photo service (unit)", () => {
  it("every org query filters org_id = $1 with the scope org first (R6)", async () => {
    const { calls, db } = fakeDb((t) => (isSelect(t) ? [row()] : [{ photo_version: 4 }]));
    const g = () => driveOf() as never;
    await setOwnPhoto(db, g, scope, "s1", { bytes: JPEG, type: "jpeg" });
    await removeOwnPhoto(db, g, scope, "s1");
    await removeMemberPhoto(db, g, scope, "s9", MEMBER);
    await getOwnPhoto(db, g, scope, "s1", null);
    await getMemberPhoto(db, g, scope, MEMBER, null);
    const org = calls.filter((c) => /from members|update members/.test(c.text));
    expect(org.length).toBeGreaterThanOrEqual(8);
    for (const c of org) {
      expect(c.text).toMatch(/org_id = \$1\b/);
      expect(c.values[0]).toBe(ORG);
    }
  });

  it("Drive errors give 502 or 503, never 401 or 403", async () => {
    const { db } = fakeDb(() => [row()]);
    const cases: [unknown, number][] = [
      [new DriveError("drive_auth", 401), 502],
      [new DriveError("drive_forbidden", 403), 502],
      [new DriveError("drive_rate_limited", 429), 503],
      [new DriveError("drive_unavailable", 503), 503],
      [new DriveConfigError("off"), 503],
    ];
    for (const [err, status] of cases) {
      const up = driveOf({ uploadOrgFile: vi.fn(async () => Promise.reject(err)) });
      const r = await setOwnPhoto(db, () => up as never, scope, "s1", {
        bytes: JPEG,
        type: "jpeg",
      });
      expect(r).toMatchObject({ ok: false, status });
      const get = driveOf({ getFile: vi.fn(async () => Promise.reject(err)) });
      expect(await getOwnPhoto(db, () => get as never, scope, "s1", null)).toMatchObject({
        ok: false,
        status,
      });
    }
  });

  it("a non-Drive error is rethrown", async () => {
    const { db } = fakeDb(() => [row()]);
    const up = driveOf({ uploadOrgFile: vi.fn(async () => Promise.reject(new Error("boom"))) });
    await expect(
      setOwnPhoto(db, () => up as never, scope, "s1", { bytes: JPEG, type: "jpeg" }),
    ).rejects.toThrow("boom");
  });

  it("with Drive off, remove works and get answers 503", async () => {
    const { db } = fakeDb((t) => (isSelect(t) ? [row()] : [{ photo_version: 4 }]));
    expect(await removeOwnPhoto(db, () => null, scope, "s1")).toEqual({ ok: true, value: null });
    expect(await getOwnPhoto(db, () => null, scope, "s1", null)).toMatchObject({
      ok: false,
      status: 503,
    });
  });
});
