import { describe, expect, it } from "vitest";
import { getDrive } from "./drive";

// Opt-in: DRIVE_LIVE=1 with the four Drive variables set in the shell (after M-46). Skipped otherwise, so CI and
// `pnpm test` never touch Drive. Never prints config.
const TEST_ORG = "00000000-0000-4000-8000-0000000d71e5";
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe.skipIf(process.env.DRIVE_LIVE !== "1")("drive live", () => {
  it("round trip upload / read / delete", async () => {
    const drive = getDrive();
    expect(drive).not.toBeNull();
    const up = await drive!.uploadOrgFile(TEST_ORG, {
      name: "live-check.png",
      mimeType: "image/png",
      bytes: PNG_1X1,
    });
    try {
      const got = await drive!.getFile(up.id);
      expect(Buffer.from(got.bytes).equals(Buffer.from(PNG_1X1))).toBe(true);
    } finally {
      await drive!.deleteFile(up.id);
    }
  });
});
