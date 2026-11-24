import "server-only";
import { DRIVE_MAX_BYTES, DriveError, createDriveClient, type DriveClient } from "./client";
import { loadDriveConfig } from "./config";
import { createOrgFolderResolver, type OrgFolderResolver } from "./folders";

export { DRIVE_MAX_BYTES };

/**
 * Org-scoped view of Drive. `getFile` and `deleteFile` are NOT org-checked here: the org binding of a file id
 * lives in simap's DB row, so the caller must look the id up with `org_id = scope.orgId` before calling.
 */
export type OrgDrive = {
  uploadOrgFile(
    orgId: string,
    f: { name: string; mimeType: string; bytes: Uint8Array },
  ): Promise<{ id: string; size: number; mimeType: string }>;
  getFile(id: string): Promise<{ bytes: Uint8Array; contentType: string | null }>;
  /** An already-gone file counts as success. */
  deleteFile(id: string): Promise<void>;
};

export function createOrgDrive({
  client,
  folders,
}: {
  client: Pick<DriveClient, "createFile" | "getFile" | "deleteFile">;
  folders: Pick<OrgFolderResolver, "resolve" | "forget">;
}): OrgDrive {
  const put = async (orgId: string, f: { name: string; mimeType: string; bytes: Uint8Array }) =>
    client.createFile({
      ...f,
      parentId: await folders.resolve(orgId),
      appProperties: { app: "simap", orgId },
    });
  return {
    async uploadOrgFile(orgId, f) {
      try {
        return await put(orgId, f);
      } catch (err) {
        // The cached folder may have been removed in Drive: forget it, re-resolve, retry once.
        if (!(err instanceof DriveError) || err.code !== "drive_not_found") throw err;
        folders.forget(orgId);
        return put(orgId, f);
      }
    },
    getFile: (id) => client.getFile(id),
    deleteFile: (id) => client.deleteFile(id),
  };
}

declare global {
  var __simapDrive: { key: string; drive: OrgDrive } | undefined;
}

const logEntry = (entry: Record<string, unknown>) => console.error(JSON.stringify(entry));

/**
 * Lazy: reads env on the first call, never at import (so `next build` needs no env). Null when all four variables
 * are unset (images off); throws DriveConfigError (names only) when the config is partial or malformed.
 */
export function getDrive(): OrgDrive | null {
  const cfg = loadDriveConfig(process.env);
  if (cfg.mode === "off") return null;
  const key = [cfg.clientId, cfg.clientSecret, cfg.refreshToken, cfg.folderId].join("\n");
  if (globalThis.__simapDrive?.key !== key) {
    const client = createDriveClient({ config: cfg, log: logEntry });
    globalThis.__simapDrive = {
      key,
      drive: createOrgDrive({ client, folders: createOrgFolderResolver({ drive: client }) }),
    };
  }
  return globalThis.__simapDrive.drive;
}
