import type { SeatView } from "@/lib/sprites/layout";
import { derivedChoice, parsePixelLook, type PixelLook } from "@/lib/sprites/pixel-look";
import type { PresenceSource, RoomPresenceMember } from "./types";

export type WhosHereRow = {
  memberId: string;
  name: string;
  /** True when the member has no display name (the view shows the "unnamed" text). */
  unnamed: boolean;
  seatCode: string;
  checkedInAt: string;
  time: string;
  source: PresenceSource;
  look: PixelLook;
  /** The seat is drawn on the map, so selecting the row can focus it. */
  focusable: boolean;
};

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The check-in time as HH:mm in UTC+7 (D35); an unparseable value is returned as is. */
export function checkinTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : TIME.format(new Date(t));
}

/** One row per checked-in member, in API order (every member the API returns, PRE-06). */
export function whosHereRows({
  members,
  seatViews,
  placedCodes,
}: {
  members: readonly RoomPresenceMember[];
  seatViews: Readonly<Record<string, SeatView>>;
  placedCodes: ReadonlySet<string>;
}): WhosHereRow[] {
  return members.map((m) => {
    const view = seatViews[m.seatId];
    const own = view && view.avatarSeed === m.memberId ? parsePixelLook(view.look) : null;
    return {
      memberId: m.memberId,
      name: m.displayName,
      unnamed: m.displayName.trim() === "",
      seatCode: m.seatCode,
      checkedInAt: m.checkedInAt,
      time: checkinTime(m.checkedInAt),
      source: m.source,
      look: own ?? derivedChoice(m.memberId),
      focusable: placedCodes.has(m.seatCode),
    };
  });
}
