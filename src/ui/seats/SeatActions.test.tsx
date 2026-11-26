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
const render = (
  tier: Tier | null,
  s: SeatDto | null,
  notice: string | null = null,
  info: string | null = null,
  busy = false,
) =>
  renderToStaticMarkup(
    <SeatActions
      tier={tier}
      seat={s}
      notice={notice}
      info={info}
      busy={busy}
      onRequest={() => {}}
      onAssign={() => {}}
      onDelete={() => {}}
      onRelease={() => {}}
      onRemove={() => {}}
      onSetCannotSeat={() => {}}
      onClearCannotSeat={() => {}}
      onTags={() => {}}
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
  it("Tags button: manager and admin only; disabled when busy", () => {
    for (const tier of ["user", "manager", "admin"] as const) {
      expect(render(tier, seat(false)).includes(seatsCopy.actions.tags)).toBe(tier !== "user");
    }
    expect(render("manager", seat(false), null, null, true)).toMatch(
      /<button[^>]*disabled[^>]*>Tags</,
    );
  });
  it("assign role matrix; Replace when occupied", () => {
    for (const tier of ["user", "manager", "admin"] as const) {
      const empty = render(tier, seat(false));
      const full = render(tier, {
        ...seat(false),
        occupant: { id: "o", displayName: "O", hasPhoto: false, photoVersion: 0 },
      });
      const can = tier !== "user";
      expect(empty.includes(">Assign<")).toBe(can);
      expect(full.includes(">Replace<")).toBe(can);
      expect(full.includes(">Assign<")).toBe(false);
    }
    expect(render(null, seat(false))).toBe("");
  });
  it("cannot-seat disables assign and replace", () => {
    const blocked = { ...seat(false), cannotSeat: true, cannotSeatReason: "Broken" };
    expect(render("manager", blocked)).toMatch(/<button[^>]*disabled[^>]*>Assign</);
    const withOccupant = {
      ...blocked,
      occupant: { id: "o", displayName: "O", hasPhoto: false, photoVersion: 0 },
    };
    expect(render("admin", withOccupant)).toMatch(/<button[^>]*disabled[^>]*>Replace</);
  });
  it("no buttons unless the seat is ready", () => {
    expect(render("admin", null)).toBe("");
  });
  it("the notice renders without a seat", () => {
    expect(render("admin", null, "Heads up")).toContain("Heads up");
  });
});

describe("SeatActions remove and cannot-seat buttons", () => {
  const occupied = (over: Partial<SeatDto> = {}): SeatDto => ({
    ...seat(false),
    status: "occupied",
    occupant: { id: "o", displayName: "O", hasPhoto: false, photoVersion: 0 },
    ...over,
  });
  const renderWith = (tier: Tier | null, s: SeatDto, busy = false) =>
    renderToStaticMarkup(
      <SeatActions
        tier={tier}
        seat={s}
        notice={null}
        info={null}
        busy={busy}
        onRequest={() => {}}
        onAssign={() => {}}
        onDelete={() => {}}
        onRelease={() => {}}
        onRemove={() => {}}
        onSetCannotSeat={() => {}}
        onClearCannotSeat={() => {}}
        onTags={() => {}}
      />,
    );
  const a = seatsCopy.actions;
  it("user sees none of them", () => {
    const html = renderWith("user", occupied());
    for (const t of [a.removeOccupant, a.blockSeat, a.unblockSeat]) {
      expect(html.includes(t)).toBe(false);
    }
  });
  it("manager sees Remove and Block; Unblock on a cannot-seat seat", () => {
    const html = renderWith("manager", occupied());
    expect(html).toContain(a.removeOccupant);
    expect(html).toContain(a.blockSeat);
    expect(html).not.toContain(a.unblockSeat);
    const blocked = renderWith("manager", occupied({ cannotSeat: true, cannotSeatReason: "x" }));
    expect(blocked).toContain(a.removeOccupant);
    expect(blocked).toContain(a.unblockSeat);
    expect(blocked).not.toContain(a.blockSeat);
  });
  it("own seat shows Release, not Remove", () => {
    const html = renderWith("manager", occupied({ mine: true }));
    expect(html).toContain(a.release);
    expect(html).not.toContain(a.removeOccupant);
  });
  it("busy disables the buttons", () => {
    const html = renderWith("admin", occupied(), true);
    expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*>${a.removeOccupant}<`));
    expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*>${a.blockSeat}<`));
  });
});

describe("SeatActions request button", () => {
  const a = seatsCopy.actions;
  it("user sees Request this seat on an empty seat; not on occupied or cannot-seat; manager and admin never", () => {
    expect(render("user", seat(false))).toContain(`>${a.request}<`);
    const occupied = {
      ...seat(false),
      occupant: { id: "o", displayName: "O", hasPhoto: false, photoVersion: 0 },
    };
    expect(render("user", occupied)).not.toContain(a.request);
    const blocked = { ...seat(false), cannotSeat: true, cannotSeatReason: "x" };
    expect(render("user", blocked)).not.toContain(a.request);
    for (const tier of ["manager", "admin"] as const) {
      expect(render(tier, seat(false))).not.toContain(a.request);
    }
    expect(render(null, seat(false))).toBe("");
  });
  it("a user with only the request button still gets the button row", () => {
    const html = render("user", seat(false));
    expect(html).toContain('class="flex flex-wrap gap-2"');
    expect(html).not.toContain(a.release);
  });
  it("info notice renders as role=status, not alert; error notice stays role=alert", () => {
    const info = render("user", seat(false), null, "Request sent.");
    expect(info).toMatch(/<p role="status"[^>]*>Request sent\.</);
    expect(info).not.toContain('role="alert"');
    const err = render("user", seat(false), "Nope");
    expect(err).toMatch(/<p role="alert"[^>]*>Nope</);
    expect(err).not.toContain('role="status"');
  });
  it("busy disables Request this seat", () => {
    expect(render("user", seat(false), null, null, true)).toMatch(
      new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${a.request}<`),
    );
  });
});
