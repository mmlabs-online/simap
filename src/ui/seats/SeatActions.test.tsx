import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SeatDto } from "@/lib/seats/types";
import type { Tier } from "@/lib/tier";
import { seatsCopy } from "../copy/seats";
import { SeatActions } from "./SeatActions";

const seat = (mine: boolean): SeatDto => ({
  id: "s1",
  code: "C302-01",
  seq: 1,
  roomId: "r1",
  roomCode: "C302",
  status: mine ? "occupied" : "empty",
  cannotSeat: false,
  cannotSeatReason: null,
  occupant: null,
  mine,
  group: null,
  project: null,
  deviceCount: 0,
  devices: [],
});
const render = (tier: Tier | null, s: SeatDto | null, notice: string | null = null) =>
  renderToStaticMarkup(
    <SeatActions
      tier={tier}
      seat={s}
      notice={notice}
      busy={false}
      onDelete={() => {}}
      onRelease={() => {}}
    />,
  );

describe("SeatActions", () => {
  it("role matrix", () => {
    for (const tier of ["user", "manager", "admin"] as const) {
      for (const mine of [true, false]) {
        const html = render(tier, seat(mine));
        expect(html.includes(seatsCopy.actions.release)).toBe(mine);
        expect(html.includes(seatsCopy.actions.delete)).toBe(tier === "admin");
      }
    }
    expect(render(null, seat(false))).toBe("");
  });
  it("no buttons unless the seat is ready", () => {
    expect(render("admin", null)).toBe("");
  });
  it("the notice renders without a seat", () => {
    expect(render("admin", null, "Heads up")).toContain("Heads up");
  });
});
