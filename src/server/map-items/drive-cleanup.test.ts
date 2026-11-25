import { afterEach, describe, expect, it, vi } from "vitest";
import { discardMapItemFiles } from "./drive-cleanup";

afterEach(() => vi.restoreAllMocks());

describe("discardMapItemFiles", () => {
  it("deletes each id; a failing delete logs map_item_drive_orphan with the key only and never throws; Drive off logs orphans; empty list does nothing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const del = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("secret"));
    await discardMapItemFiles(
      () => ({ deleteFile: del }) as never,
      ["file_aaaaaaaaaa", "file_bbbbbbbbbb"],
      "door",
    );
    expect(del.mock.calls.map((c) => c[0])).toEqual(["file_aaaaaaaaaa", "file_bbbbbbbbbb"]);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0]![0]).toBe(
      JSON.stringify({ event: "map_item_drive_orphan", key: "door" }),
    );

    err.mockClear();
    await discardMapItemFiles(() => null, ["file_aaaaaaaaaa"], "door");
    expect(err).toHaveBeenCalledTimes(1);

    err.mockClear();
    const get = vi.fn();
    await discardMapItemFiles(get, [], "door");
    expect(get).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });
});
