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
  it("caps at 200 chars", () => {
    expect(auditRoute("/" + "a/".repeat(300)).length).toBe(200);
  });
});
