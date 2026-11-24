import "server-only";
import { isCanonicalUuid } from "@/lib/validate/uuid";
import { DriveError, type DriveClient } from "./client";

// Per-org Drive subfolders: <root>/<org_id>/, found by appProperties, created on first use. In-memory cache with
// single-flight, so one process creates a folder once. A duplicate (another process, index lag) is harmless: files
// are addressed by id, and the oldest folder wins on every later lookup. No logging here.

export function createOrgFolderResolver({
  drive,
}: {
  drive: Pick<DriveClient, "findOrgFolders" | "createFolder">;
}) {
  const resolved = new Map<string, string>();
  const inflight = new Map<string, Promise<string>>();

  async function lookup(orgId: string): Promise<string> {
    let best: { id: string; createdTime: number | null } | null = null;
    for (const f of await drive.findOrgFolders(orgId)) {
      const a = f.createdTime ?? Infinity;
      const b = best ? (best.createdTime ?? Infinity) : Infinity;
      if (!best || a < b || (a === b && f.id < best.id)) best = f;
    }
    if (best) return best.id;
    return (
      await drive.createFolder({ name: orgId, appProperties: { app: "simap-folder", orgId } })
    ).id;
  }

  return {
    async resolve(orgId: string): Promise<string> {
      if (!isCanonicalUuid(orgId)) throw new DriveError("drive_invalid_id");
      const hit = resolved.get(orgId);
      if (hit) return hit;
      let p = inflight.get(orgId);
      if (!p) {
        p = lookup(orgId)
          .then((id) => {
            resolved.set(orgId, id);
            return id;
          })
          .finally(() => inflight.delete(orgId));
        inflight.set(orgId, p);
      }
      return p;
    },
    /** Drops a cached id that Drive no longer knows. */
    forget(orgId: string): void {
      resolved.delete(orgId);
    },
  };
}

export type OrgFolderResolver = ReturnType<typeof createOrgFolderResolver>;
