import { describe, expect, it, vi } from "vitest";
import { DriveError } from "./client";
import { createOrgFolderResolver } from "./folders";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

type Found = { id: string; createdTime: number | null }[];

function fakeDrive(found: Found = []) {
  const findOrgFolders = vi.fn(async (_orgId: string) => {
    await Promise.resolve();
    return found;
  });
  const createFolder = vi.fn(
    async (_f: { name: string; appProperties?: Record<string, string> }) => ({
      id: "CREATEDFOLDER1",
    }),
  );
  return { findOrgFolders, createFolder };
}

describe("createOrgFolderResolver", () => {
  it("existing folder found → no create; cached on the second call", async () => {
    const drive = fakeDrive([{ id: "EXISTINGFOLDER", createdTime: 1 }]);
    const r = createOrgFolderResolver({ drive });
    expect(await r.resolve(ORG_A)).toBe("EXISTINGFOLDER");
    expect(await r.resolve(ORG_A)).toBe("EXISTINGFOLDER");
    expect(drive.findOrgFolders).toHaveBeenCalledTimes(1);
    expect(drive.createFolder).not.toHaveBeenCalled();
  });

  it("none found → creates one named after the org with appProperties", async () => {
    const drive = fakeDrive();
    const r = createOrgFolderResolver({ drive });
    expect(await r.resolve(ORG_A)).toBe("CREATEDFOLDER1");
    expect(drive.createFolder).toHaveBeenCalledWith({
      name: ORG_A,
      appProperties: { app: "simap-folder", orgId: ORG_A },
    });
  });

  it("5 concurrent resolves for one org → 1 list + 1 create; two orgs → separate", async () => {
    const drive = fakeDrive();
    const r = createOrgFolderResolver({ drive });
    await Promise.all([1, 2, 3, 4, 5].map(() => r.resolve(ORG_A)));
    expect(drive.findOrgFolders).toHaveBeenCalledTimes(1);
    expect(drive.createFolder).toHaveBeenCalledTimes(1);
    await r.resolve(ORG_B);
    expect(drive.findOrgFolders).toHaveBeenCalledTimes(2);
    expect(drive.createFolder).toHaveBeenCalledTimes(2);
  });

  it("several folders → oldest createdTime wins, tie → smallest id", async () => {
    const old = createOrgFolderResolver({
      drive: fakeDrive([
        { id: "FOLDER-NEWER-1", createdTime: 200 },
        { id: "FOLDER-OLDEST1", createdTime: 100 },
        { id: "FOLDER-UNKNOWN", createdTime: null },
      ]),
    });
    expect(await old.resolve(ORG_A)).toBe("FOLDER-OLDEST1");
    const tie = createOrgFolderResolver({
      drive: fakeDrive([
        { id: "FOLDER-BBBBBBB", createdTime: 100 },
        { id: "FOLDER-AAAAAAA", createdTime: 100 },
      ]),
    });
    expect(await tie.resolve(ORG_A)).toBe("FOLDER-AAAAAAA");
  });

  it("a failed lookup is not cached and inflight is cleared; forget drops the cache", async () => {
    const drive = fakeDrive([{ id: "EXISTINGFOLDER", createdTime: 1 }]);
    drive.findOrgFolders.mockRejectedValueOnce(new DriveError("drive_unavailable"));
    const r = createOrgFolderResolver({ drive });
    await expect(r.resolve(ORG_A)).rejects.toMatchObject({ code: "drive_unavailable" });
    expect(await r.resolve(ORG_A)).toBe("EXISTINGFOLDER");
    expect(drive.findOrgFolders).toHaveBeenCalledTimes(2);
    r.forget(ORG_A);
    await r.resolve(ORG_A);
    expect(drive.findOrgFolders).toHaveBeenCalledTimes(3);
  });

  it("non-canonical org ids → drive_invalid_id without any Drive call", async () => {
    const drive = fakeDrive();
    const r = createOrgFolderResolver({ drive });
    for (const o of [
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      "00000000-0000-0000-0000-000000000000",
      "x",
    ]) {
      await expect(r.resolve(o)).rejects.toMatchObject({ code: "drive_invalid_id" });
    }
    expect(drive.findOrgFolders).not.toHaveBeenCalled();
  });
});
