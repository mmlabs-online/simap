import { describe, expect, it } from "vitest";
import { auditRoute } from "./route";

describe("auditRoute", () => {
  it("replaces uuid and other non-word segments with :id and never includes the query", () => {
    expect(auditRoute("/api/rooms/6f1c2a52-1111-4111-8111-111111111111?x=1")).toBe(
      "/api/rooms/:id",
    );
    expect(auditRoute("/api/rooms/Phòng%20A/seats")).toBe("/api/rooms/:id/seats");
    expect(auditRoute("/api/rooms/42")).toBe("/api/rooms/:id");
  });
  it("maps uuids starting with a letter or a digit to :id and keeps word segments", () => {
    expect(auditRoute("/api/rooms/a1b2c3d4-1111-4111-8111-111111111111/seats")).toBe(
      "/api/rooms/:id/seats",
    );
    expect(auditRoute("/api/rooms/f0000000-0000-4000-8000-000000000000")).toBe("/api/rooms/:id");
    expect(auditRoute("/api/rooms/0f000000-0000-4000-8000-000000000000")).toBe("/api/rooms/:id");
    expect(auditRoute("/api/seat-requests/approve")).toBe("/api/seat-requests/approve");
    expect(auditRoute("/api/rooms/deadbeef1234")).toBe("/api/rooms/:id");
  });
  it("caps at 200 chars", () => {
    expect(auditRoute("/" + "a/".repeat(300)).length).toBe(200);
  });
});
