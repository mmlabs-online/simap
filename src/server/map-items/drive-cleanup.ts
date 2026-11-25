import "server-only";
import type { OrgDrive } from "@/server/drive/drive";

/** Best-effort delete of Drive files after the DB decided (OQ-52). Never throws; a failure leaves an orphan (logged, key only). */
export async function discardMapItemFiles(
  drive: () => OrgDrive | null,
  fileIds: readonly string[],
  key: string,
): Promise<void> {
  for (const id of fileIds) {
    try {
      const d = drive();
      if (!d) throw new Error("drive is off");
      await d.deleteFile(id);
    } catch {
      console.error(JSON.stringify({ event: "map_item_drive_orphan", key }));
    }
  }
}
