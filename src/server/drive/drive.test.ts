import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriveError } from "./client";
import { DriveConfigError } from "./config";
import { createOrgDrive, getDrive } from "./drive";

const ORG = "11111111-1111-4111-8111-111111111111";
const FILE = { name: "a.png", mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) };
const NEW = { id: "NEWFILE123456", size: 3, mimeType: "image/png" };

describe("createOrgDrive", () => {
  it("uploadOrgFile resolves the org folder, then creates the file inside it with appProperties", async () => {
    const createFile = vi.fn(async () => NEW);
    const resolve = vi.fn(async () => "ORGFOLDER12345");
    const drive = createOrgDrive({
      client: { createFile, getFile: vi.fn(), deleteFile: vi.fn() },
      folders: { resolve, forget: vi.fn() },
    });
    expect(await drive.uploadOrgFile(ORG, FILE)).toEqual(NEW);
    expect(resolve).toHaveBeenCalledWith(ORG);
    expect(createFile).toHaveBeenCalledWith({
      ...FILE,
      parentId: "ORGFOLDER12345",
      appProperties: { app: "simap", orgId: ORG },
    });
  });

  it("drive_not_found on a cached folder → forget, re-resolve, retry once", async () => {
    const createFile = vi
      .fn()
      .mockRejectedValueOnce(new DriveError("drive_not_found", 404))
      .mockResolvedValueOnce(NEW);
    const resolve = vi
      .fn()
      .mockResolvedValueOnce("STALEFOLDER123")
      .mockResolvedValueOnce("FRESHFOLDER123");
    const forget = vi.fn();
    const drive = createOrgDrive({
      client: { createFile, getFile: vi.fn(), deleteFile: vi.fn() },
      folders: { resolve, forget },
    });
    expect(await drive.uploadOrgFile(ORG, FILE)).toEqual(NEW);
    expect(forget).toHaveBeenCalledWith(ORG);
    expect(createFile.mock.calls[1][0].parentId).toBe("FRESHFOLDER123");

    createFile.mockReset().mockRejectedValue(new DriveError("drive_not_found", 404));
    await expect(drive.uploadOrgFile(ORG, FILE)).rejects.toMatchObject({ code: "drive_not_found" });
    expect(createFile).toHaveBeenCalledTimes(2);
  });

  it("other errors are not retried", async () => {
    const createFile = vi.fn().mockRejectedValue(new DriveError("drive_unavailable"));
    const drive = createOrgDrive({
      client: { createFile, getFile: vi.fn(), deleteFile: vi.fn() },
      folders: { resolve: async () => "ORGFOLDER12345", forget: vi.fn() },
    });
    await expect(drive.uploadOrgFile(ORG, FILE)).rejects.toMatchObject({
      code: "drive_unavailable",
    });
    expect(createFile).toHaveBeenCalledTimes(1);
  });
});

describe("getDrive", () => {
  const set = (o: Record<string, string>) => {
    for (const [k, v] of Object.entries(o)) vi.stubEnv(k, v);
  };
  const valid = {
    GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "SECRET-SENTINEL-1",
    GOOGLE_REFRESH_TOKEN: "SECRET-SENTINEL-2",
    DRIVE_FOLDER_ID: "1AbCdEfGhIjKlMnOp",
  };

  beforeEach(() => {
    globalThis.__simapDrive = undefined;
    set({
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REFRESH_TOKEN: "",
      DRIVE_FOLDER_ID: "",
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.__simapDrive = undefined;
  });

  it("returns null when all four are unset", () => {
    expect(getDrive()).toBeNull();
  });

  it("throws DriveConfigError naming variables only on partial config", () => {
    set({ GOOGLE_CLIENT_SECRET: "SECRET-SENTINEL-1" });
    let err: unknown;
    try {
      getDrive();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DriveConfigError);
    expect((err as Error).message).toContain("GOOGLE_CLIENT_ID");
    expect((err as Error).message).not.toContain("SECRET-SENTINEL");
  });

  it("is memoized while env is unchanged and rebuilt when it changes", () => {
    set(valid);
    const a = getDrive();
    expect(a).not.toBeNull();
    expect(getDrive()).toBe(a);
    set({ DRIVE_FOLDER_ID: "ZzYyXxWwVvUuTtSs" });
    expect(getDrive()).not.toBe(a);
  });
});
