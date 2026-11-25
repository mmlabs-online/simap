import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { settleDelete } from "./delete-device-flow";

const fail = (code: string) => ({ ok: false as const, code });

describe("settleDelete", () => {
  it("ok and not_found → done", () => {
    expect(settleDelete({ ok: true, value: undefined })).toEqual({ kind: "done" });
    expect(settleDelete(fail("not_found"))).toEqual({ kind: "done" });
  });

  it("device_owned and handoff_pending → error and stale", () => {
    for (const code of ["device_owned", "handoff_pending"]) {
      expect(settleDelete(fail(code))).toEqual({
        kind: "error",
        message: apiErrorMessage(code),
        stale: true,
      });
    }
  });

  it("other codes → error, not stale", () => {
    for (const code of ["not_allowed", "unavailable"]) {
      expect(settleDelete(fail(code))).toEqual({
        kind: "error",
        message: apiErrorMessage(code),
        stale: false,
      });
    }
  });
});
