import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SeatDto } from "@/lib/seats/types";
import { seatsCopy } from "../copy/seats";
import { SeatTagsDialog } from "./SeatTagsDialog";

const seat: SeatDto = {
  id: "s1",
  code: "C302-01",
  seq: 1,
  roomId: "r1",
  roomCode: "C302",
  status: "empty",
  cannotSeat: false,
  cannotSeatReason: null,
  occupant: null,
  mine: false,
  group: null,
  project: null,
  deviceCount: 0,
  devices: [],
};
const render = (s: SeatDto | null) =>
  renderToStaticMarkup(
    <SeatTagsDialog
      seat={s}
      submitting={false}
      loadGroups={async () => ({ ok: true, value: [] })}
      loadProjects={async () => ({ ok: true, value: [] })}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

describe("SeatTagsDialog", () => {
  it("closed renders nothing", () => {
    expect(render(null)).toBe("");
  });
  it("open shows the title, both labels and the empty options", () => {
    const html = render(seat);
    const c = seatsCopy.actions;
    for (const text of [
      c.tagsTitle("C302-01"),
      c.tagsGroup,
      c.tagsProject,
      c.tagsNoGroup,
      c.tagsNoProject,
      c.tagsSubmit,
    ]) {
      expect(html).toContain(text);
    }
  });
});
