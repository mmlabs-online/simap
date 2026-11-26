import type { RoomLayout, SeatView } from "@/lib/sprites/layout";
import { seatOrder } from "@/lib/sprites/placement";
import type { MyPresenceDto } from "./types";

/** The viewer's member id: the occupant of their active presence seat, else of a seat marked "mine"; none = null. */
export function myMemberId(
  seatViews: Readonly<Record<string, SeatView>>,
  my: MyPresenceDto | null,
): string | null {
  const active = my ? seatViews[my.seatId]?.avatarSeed : null;
  if (active) return active;
  for (const view of Object.values(seatViews)) {
    if (view.state === "mine" && view.avatarSeed) return view.avatarSeed;
  }
  return null;
}

/** Ids of the viewer's other seats in the shown room, in reading order: the open tags (D77). Empty unless checked in here. */
export function openTagSeats({
  layout,
  seatViews,
  my,
  roomId,
}: {
  layout: RoomLayout;
  seatViews: Readonly<Record<string, SeatView>>;
  my: MyPresenceDto | null;
  roomId: string;
}): string[] {
  if (!my || my.roomId !== roomId) return [];
  const me = myMemberId(seatViews, my);
  if (me === null) return [];
  return seatOrder(layout.seats)
    .filter((s) => s.id !== my.seatId && seatViews[s.id]?.avatarSeed === me)
    .map((s) => s.id);
}
