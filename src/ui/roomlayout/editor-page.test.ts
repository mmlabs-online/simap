import { describe, expect, it } from "vitest";
import type { RoomDto } from "@/lib/rooms/types";
import type { MapLoadState, MapView } from "@/lib/sprites/map-view";
import type { RoomResolution } from "../seats/seat-view";
import { editorGate } from "./editor-page";

const found: RoomResolution = { kind: "found", room: { id: "r1", code: "C1" } as RoomDto };
const view = (truncated = false) => ({ truncated }) as MapView;
const ready = (truncated = false): MapLoadState => ({
  status: "ready",
  view: view(truncated),
  errorCode: null,
});

describe("editorGate", () => {
  it("user and manager → not_allowed before any load", () => {
    for (const tier of ["user", "manager"] as const) {
      expect(editorGate({ tier, isDesktop: true, resolution: null, load: null })).toBe(
        "not_allowed",
      );
      expect(editorGate({ tier, isDesktop: false, resolution: null, load: null })).toBe(
        "not_allowed",
      );
    }
  });

  it("an unknown tier or unknown desktop → checking; narrow → desktop", () => {
    expect(editorGate({ tier: null, isDesktop: true, resolution: null, load: null })).toBe(
      "checking",
    );
    expect(editorGate({ tier: "admin", isDesktop: null, resolution: null, load: null })).toBe(
      "checking",
    );
    expect(editorGate({ tier: "admin", isDesktop: false, resolution: null, load: null })).toBe(
      "desktop",
    );
  });

  it("admin + loading/missing/error → those; truncated → read_only; else ready", () => {
    const g = (resolution: RoomResolution | null, load: MapLoadState | null) =>
      editorGate({ tier: "admin", isDesktop: true, resolution, load });
    expect(g(null, null)).toBe("loading");
    expect(g({ kind: "loading" }, null)).toBe("loading");
    expect(g({ kind: "missing" }, null)).toBe("missing");
    expect(g({ kind: "error", code: "unavailable" }, null)).toBe("error");
    expect(g(found, null)).toBe("loading");
    expect(g(found, { status: "loading", view: null, errorCode: null })).toBe("loading");
    expect(g(found, { status: "error", view: null, errorCode: "unavailable" })).toBe("error");
    expect(g(found, ready(true))).toBe("read_only");
    expect(g(found, ready())).toBe("ready");
  });
});
