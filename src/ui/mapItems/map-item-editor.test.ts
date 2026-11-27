import { describe, expect, it, vi } from "vitest";
import { frameTiles } from "@/lib/map-items/art";
import type { MapItemDto } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import {
  applySaveResult,
  closeDecision,
  editorReducer,
  effectiveArt,
  initEditor,
  isDirty,
  pendingItem,
  saveEditor,
  stagedUrls,
  type ArtEdit,
  type EditorAction,
  type EditorState,
} from "./map-item-editor";
import { spriteChoices } from "./map-item-art";
import { checkMapItemImage } from "./map-item-image";
import type { MapItemsResult } from "./map-items-api";
import { dto } from "./test-items";

const none: MapItemDto["art"]["n"] = { sprite: null, hasImage: false, imageVersion: 0 };
const withArt = (item: MapItemDto, dir: Direction, a: Partial<typeof none>): MapItemDto => ({
  ...item,
  art: { ...item.art, [dir]: { ...none, ...a } },
});
const image = (w = 96, h = 64, url = "blob:x"): Extract<ArtEdit, { kind: "image" }> => ({
  kind: "image",
  bytes: new Uint8Array(4),
  url,
  px: { width: w, height: h },
});
const reduce = (item: MapItemDto, state: EditorState, ...actions: EditorAction[]) =>
  actions.reduce((s, a) => editorReducer(item, s, a), state);
const table = dto("table.meeting"); // 3 x 2, directional, resizable
const clean = initEditor(table);
const stage = (...actions: EditorAction[]) => reduce(table, clean, ...actions);

type Call = [string, ...unknown[]];
/** A fake api that records calls; `fail` maps "<call>:<dir>" to a refusal. */
function fakeApi(
  fail: Record<string, { code: string; rooms?: number }> = {},
  patched: MapItemDto = table,
) {
  const calls: Call[] = [];
  const answer = <T>(name: string, dir: string, value: T): MapItemsResult<T> => {
    const f = fail[`${name}:${dir}`];
    return f ? { ok: false, ...f } : { ok: true, value };
  };
  return {
    calls,
    api: {
      patch: vi.fn(async (_k: string, v: unknown) => {
        calls.push(["patch", v]);
        return answer("patch", "", patched);
      }),
      putArt: vi.fn(async (_k: string, d: Direction, s: string | null) => {
        calls.push(["putArt", d, s]);
        return answer("putArt", d, patched);
      }),
      putImage: vi.fn(async (_k: string, d: Direction) => {
        calls.push(["putImage", d]);
        return answer("putImage", d, patched);
      }),
      deleteImage: vi.fn(async (_k: string, d: Direction) => {
        calls.push(["deleteImage", d]);
        return answer("deleteImage", d, null);
      }),
    },
  };
}

describe("initEditor", () => {
  it("Appearance tab, first artDirs direction, form from the item, no art, clean", () => {
    const s = initEditor(dto("clock.wall"));
    expect(s).toMatchObject({ tab: "appearance", dir: "n", art: {}, phase: "idle", error: null });
    expect(s.form).toMatchObject({ name: "Clock wall".length ? s.form.name : "", w: 1 });
    expect(initEditor(dto("plant.large")).dir).toBe("s");
    expect(isDirty(table, clean)).toBe(false);
  });
});

describe("isDirty", () => {
  it("false when fresh; true for a name edit, an invalid name, staged art; false after reverting the name", () => {
    const renamed = stage({ type: "form", patch: { name: "Other" } });
    expect(isDirty(table, renamed)).toBe(true);
    expect(
      isDirty(table, editorReducer(table, renamed, { type: "form", patch: { name: table.name } })),
    ).toBe(false);
    expect(isDirty(table, stage({ type: "form", patch: { name: "   " } }))).toBe(true);
    expect(isDirty(table, stage({ type: "stageSprite", dir: "n", key: "desk.single.n" }))).toBe(
      true,
    );
    expect(isDirty(table, stage({ type: "restore", dir: "n" }))).toBe(false); // saved library: nothing to restore
    expect(isDirty(withArt(table, "n", { hasImage: true }), initEditor(table))).toBe(false);
    expect(isDirty(table, stage({ type: "stageImage", dir: "n", edit: image() }))).toBe(true);
  });
});

describe("stageSprite / restore", () => {
  it("stageSprite equal to the saved sprite (no saved image) removes the entry instead of staging", () => {
    const item = withArt(table, "n", { sprite: "desk.single.n" });
    const s = reduce(item, initEditor(item), {
      type: "stageSprite",
      dir: "n",
      key: "desk.single.n",
    });
    expect(s.art).toEqual({});
    const other = reduce(item, initEditor(item), {
      type: "stageSprite",
      dir: "n",
      key: "desk.single.e",
    });
    expect(other.art.n).toEqual({ kind: "sprite", key: "desk.single.e" });
  });

  it("restore: saved library removes the entry; saved sprite or image stages {library}; staged over saved library is removed", () => {
    const staged = stage({ type: "stageSprite", dir: "n", key: "desk.single.n" });
    expect(reduce(table, staged, { type: "restore", dir: "n" }).art).toEqual({});
    for (const saved of [{ sprite: "desk.single.n" }, { hasImage: true }]) {
      const item = withArt(table, "n", saved);
      expect(reduce(item, initEditor(item), { type: "restore", dir: "n" }).art.n).toEqual({
        kind: "library",
      });
    }
  });
});

describe("effectiveArt", () => {
  const full = withArt(withArt(table, "n", { hasImage: true, sprite: "plant.large" }), "e", {
    sprite: "desk.single.e",
  });
  const eff = (state: EditorState, dir: Direction = "n") => effectiveArt(full, state, dir);

  it("staged image > staged sprite > staged library > saved image > saved sprite > library", () => {
    const base = initEditor(full);
    expect(eff(base)).toMatchObject({ source: "image", staged: false });
    expect(eff({ ...base, art: { n: { kind: "library" } } })).toMatchObject({
      source: "library",
      staged: true,
    });
    expect(eff({ ...base, art: { n: { kind: "sprite", key: "k" } } })).toMatchObject({
      source: "sprite",
      spriteKey: "k",
    });
    expect(eff({ ...base, art: { n: image() } })).toMatchObject({
      source: "image",
      stagedUrl: "blob:x",
      staged: true,
    });
    expect(eff(base, "e")).toMatchObject({ source: "sprite", spriteKey: "desk.single.e" });
    expect(eff(base, "s")).toMatchObject({ source: "library" });
  });

  it("a pending resize marks a saved image and a sprite that no longer fits removedOnSave and falls back", () => {
    const resized = reduce(full, initEditor(full), { type: "form", patch: { w: 1, h: 1 } });
    expect(eff(resized)).toMatchObject({
      source: "sprite",
      spriteKey: "plant.large",
      removedOnSave: true,
    });
    expect(eff(resized, "e")).toMatchObject({ source: "library", removedOnSave: true });
    expect(eff(initEditor(full))).toMatchObject({ removedOnSave: false });
  });
});

describe("form resize", () => {
  it("drops a staged image whose px no longer fits and a staged sprite that no longer fits, with a note; keeps those that fit", () => {
    const wide = spriteChoices(table, "n")
      .flatMap((g) => g.keys)
      .find((k) => frameTiles(k)[0] === 3)!;
    expect(wide).toBeDefined();
    const s = stage(
      { type: "stageImage", dir: "n", edit: image(96, 64) },
      { type: "stageSprite", dir: "e", key: wide },
      { type: "stageImage", dir: "s", edit: image(96, 64, "blob:s") },
    );
    const smaller = reduce(table, s, { type: "form", patch: { w: 2 } });
    expect(smaller.art.n).toBeUndefined();
    expect(smaller.art.s).toBeUndefined();
    expect(smaller.dirNotes.n).toBe(mapItemsCopy.editor.droppedByResize("North"));
    expect(smaller.art.e).toBeUndefined();
    const keeps = reduce(table, s, { type: "form", patch: { h: 1 } });
    expect(keeps.art.n).toEqual(image(96, 64));
    expect(keeps.art.s).toEqual(image(96, 64, "blob:s"));
    expect(keeps.art.e).toBeUndefined();
  });

  it("pendingItem uses the form w and h to check an upload (2 × 1 item enlarged to 2 × 2: 64 × 64 accepted, 64 × 32 refused)", async () => {
    const small = dto("table.meeting", { w: 2, h: 1 });
    const form = { ...initEditor(small).form, h: 2 };
    const file = (w: number, h: number) => {
      const bytes = pngBytes(w, h);
      return { size: bytes.length, arrayBuffer: async () => bytes.buffer as ArrayBuffer };
    };
    expect((await checkMapItemImage(file(64, 64), pendingItem(small, form), "n")).ok).toBe(true);
    expect((await checkMapItemImage(file(64, 32), pendingItem(small, form), "n")).ok).toBe(false);
    expect((await checkMapItemImage(file(64, 32), small, "n")).ok).toBe(true);
  });
});

describe("closeDecision", () => {
  it("clean → close; dirty → confirm; saving → ignore", () => {
    expect(closeDecision(table, clean)).toBe("close");
    const dirty = stage({ type: "form", patch: { name: "x" } });
    expect(closeDecision(table, dirty)).toBe("confirm");
    expect(closeDecision(table, { ...dirty, phase: "saving" })).toBe("ignore");
  });
});

describe("stagedUrls", () => {
  it("lists the object URLs of staged images only", () => {
    const s = stage(
      { type: "stageImage", dir: "n", edit: image(96, 64, "blob:a") },
      { type: "stageSprite", dir: "e", key: "k" },
      { type: "stageImage", dir: "s", edit: image(96, 64, "blob:b") },
    );
    expect(stagedUrls(s.art)).toEqual(["blob:a", "blob:b"]);
  });
});

describe("saveEditor", () => {
  it("order: name + size patch and art on n and s → patch, then n, then s (artDirs order)", async () => {
    const { api, calls } = fakeApi();
    const s = stage(
      { type: "stageImage", dir: "s", edit: image() },
      { type: "form", patch: { name: "Renamed" } },
      { type: "stageSprite", dir: "n", key: "desk.single.n" },
    );
    const r = await saveEditor(api, table, s);
    expect(r.kind).toBe("done");
    expect(calls.map((c) => c[0] + (c[1] && typeof c[1] === "string" ? `:${c[1]}` : ""))).toEqual([
      "patch",
      "putArt:n",
      "putImage:s",
    ]);
    const art = fakeApi();
    await saveEditor(art.api, table, stage({ type: "stageSprite", dir: "e", key: "k" }));
    expect(art.calls.map((c) => c[0])).toEqual(["putArt"]);
  });

  it("an invalid name is blocked with the field error and nothing is sent; an unconfirmed resize is blocked with confirmFirst", async () => {
    const { api, calls } = fakeApi();
    const r = await saveEditor(api, table, stage({ type: "form", patch: { name: "  " } }));
    expect(r).toEqual({ kind: "blocked", message: mapItemsCopy.fieldErrors.name });
    const item = withArt(table, "n", { hasImage: true });
    const s = reduce(item, initEditor(item), { type: "form", patch: { w: 2 } });
    expect(await saveEditor(api, item, s)).toEqual({
      kind: "blocked",
      message: mapItemsCopy.form.confirmFirst,
    });
    expect(calls).toEqual([]);
    const blocked = applySaveResult(s, { kind: "blocked", message: "m" });
    expect(blocked.error).toEqual({ message: "m", tab: "details" });
  });

  it("{library} expands against the post-PATCH item: deleteImage only with an image, then putArt(null) only with a sprite; neither → no call", async () => {
    const both = withArt(table, "n", { hasImage: true, sprite: "desk.single.n" });
    const edits = (item: MapItemDto) =>
      reduce(item, initEditor(item), { type: "restore", dir: "n" });
    const a = fakeApi({}, both);
    await saveEditor(a.api, both, edits(both));
    expect(a.calls).toEqual([
      ["deleteImage", "n"],
      ["putArt", "n", null],
    ]);
    const imgOnly = withArt(table, "n", { hasImage: true });
    const b = fakeApi({}, imgOnly);
    await saveEditor(b.api, imgOnly, edits(imgOnly));
    expect(b.calls).toEqual([["deleteImage", "n"]]);
    const spriteOnly = withArt(table, "n", { sprite: "desk.single.n" });
    const c = fakeApi({}, spriteOnly);
    await saveEditor(c.api, spriteOnly, edits(spriteOnly));
    expect(c.calls).toEqual([["putArt", "n", null]]);
    const d = fakeApi();
    await saveEditor(d.api, table, { ...clean, art: { n: { kind: "library" } } });
    expect(d.calls).toEqual([]);
    // a size change removes the saved image server-side: the expansion uses the PATCHed item
    const e = fakeApi({}, { ...imgOnly, w: 2, art: table.art });
    const resized = {
      ...edits(imgOnly),
      form: { ...initEditor(imgOnly).form, w: 2, confirmResize: true },
    };
    await saveEditor(e.api, imgOnly, resized);
    expect(e.calls.map((x) => x[0])).toEqual(["patch"]);
  });

  it("PATCH 409 item_in_use rooms 3 → failed, error on Details with the room count, no art calls, art all remaining", async () => {
    const { api, calls } = fakeApi({ "patch:": { code: "item_in_use", rooms: 3 } });
    const s = stage(
      { type: "form", patch: { w: 2, confirmResize: true } },
      { type: "stageSprite", dir: "n", key: "k" },
    );
    const r = await saveEditor(api, table, s);
    expect(r).toMatchObject({ kind: "failed", patched: null, remaining: s.art, reload: false });
    if (r.kind !== "failed") throw new Error();
    expect(r.error).toEqual({ message: mapItemsCopy.errors.inUse(3), tab: "details" });
    expect(r.error.message).toContain("placed in 3 rooms");
    expect(calls.map((c) => c[0])).toEqual(["patch"]);
  });

  it("PATCH 409 item_name_taken → failed with the name-taken message, no art calls", async () => {
    const { api, calls } = fakeApi({ "patch:": { code: "item_name_taken" } });
    const s = stage(
      { type: "form", patch: { name: "Dup" } },
      { type: "stageSprite", dir: "n", key: "k" },
    );
    const r = await saveEditor(api, table, s);
    expect(r).toMatchObject({
      kind: "failed",
      error: { message: "Another map item already has this name.", tab: "details" },
    });
    expect(calls).toHaveLength(1);
  });

  it("PATCH ok, art e 422 image_bad_size → failed: patched is the returned item, remaining is e and later dirs, error names East on Appearance", async () => {
    const returned = { ...table, name: "Renamed" };
    const { api } = fakeApi({ "putImage:e": { code: "image_bad_size" } }, returned);
    const s = stage(
      { type: "form", patch: { name: "Renamed" } },
      { type: "stageSprite", dir: "n", key: "desk.single.n" },
      { type: "stageImage", dir: "e", edit: image() },
      { type: "stageSprite", dir: "w", key: "desk.single.w" },
    );
    const r = await saveEditor(api, table, s);
    if (r.kind !== "failed") throw new Error(r.kind);
    expect(r.patched).toBe(returned);
    expect(Object.keys(r.remaining)).toEqual(["e", "w"]);
    expect(r.error).toMatchObject({ tab: "appearance", dir: "e" });
    expect(r.error.message).toContain("East");
    expect(r.reload).toBe(true);
  });

  it("409 image_changed on an art step → failed with the image_changed message and reload", async () => {
    const { api } = fakeApi({ "putImage:n": { code: "image_changed" } });
    const r = await saveEditor(api, table, stage({ type: "stageImage", dir: "n", edit: image() }));
    expect(r).toMatchObject({
      kind: "failed",
      reload: true,
      error: { message: mapItemsCopy.art.errors.image_changed },
    });
  });

  it("not_found on any step → gone", async () => {
    expect(
      await saveEditor(
        fakeApi({ "patch:": { code: "not_found" } }).api,
        table,
        stage({ type: "form", patch: { name: "x" } }),
      ),
    ).toEqual({ kind: "gone" });
    expect(
      await saveEditor(
        fakeApi({ "putArt:n": { code: "not_found" } }).api,
        table,
        stage({ type: "stageSprite", dir: "n", key: "k" }),
      ),
    ).toEqual({ kind: "gone" });
  });
});

describe("applySaveResult", () => {
  it("done → form from the patched item, art empty, clean against the patched item, notice Saved.", () => {
    const patched = { ...table, name: "Renamed" };
    const s = stage(
      { type: "form", patch: { name: "Renamed" } },
      { type: "stageSprite", dir: "n", key: "k" },
    );
    const next = applySaveResult({ ...s, phase: "saving" }, { kind: "done", patched });
    expect(next.art).toEqual({});
    expect(next.notice).toBe(mapItemsCopy.editor.status.saved);
    expect(isDirty(patched, next)).toBe(false);
    expect(next.phase).toBe("saving");
    expect(editorReducer(patched, next, { type: "saveEnd" }).phase).toBe("idle");
  });

  it("failed after PATCH → form from the patched item, remaining art kept, tab and dir switched to the error", () => {
    const patched = { ...table, name: "Renamed" };
    const s = { ...stage({ type: "form", patch: { name: "Renamed" } }), tab: "details" as const };
    const remaining = { e: image() };
    const next = applySaveResult(s, {
      kind: "failed",
      patched,
      remaining,
      error: { message: "boom", tab: "appearance", dir: "e" },
      reload: true,
    });
    expect(next).toMatchObject({ tab: "appearance", dir: "e", art: remaining });
    expect(next.form.name).toBe("Renamed");
    expect(isDirty(patched, { ...next, art: {} })).toBe(false);
  });
});

/** A minimal valid PNG of the given size (header, one data chunk, end). */
function pngBytes(w: number, h: number): Uint8Array {
  const crcTable = (c: number) => {
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  };
  const crc = (buf: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable((c ^ b) & 0xff) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: number[]) => {
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    out.set(data, 8);
    v.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return [...out];
  };
  const hdr = new Uint8Array(13);
  const v = new DataView(hdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  hdr.set([8, 6, 0, 0, 0], 8);
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk("IHDR", [...hdr]),
    ...chunk("IDAT", [1, 2, 3]),
    ...chunk("IEND", []),
  ]);
}
