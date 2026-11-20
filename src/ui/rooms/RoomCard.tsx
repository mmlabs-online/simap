import type { ReactNode } from "react";
import type { RoomDto } from "@/lib/rooms/types";
import { roomsCopy } from "../copy/rooms";
import { Card } from "../Card";
import { OccupancyRing } from "./OccupancyRing";

/** One room: code, name, floor, seat summary and the occupancy ring. Links nowhere (D47). */
export function RoomCard({ room, actions }: { room: RoomDto; actions?: ReactNode }) {
  return (
    <Card as="article" className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-extrabold text-on-surface">{room.code}</h2>
          <p className="text-sm font-medium text-on-surface truncate">{room.name}</p>
          {room.floor && (
            <p className="text-[13px] font-medium text-on-surface-variant">{room.floor}</p>
          )}
          <p className="text-[13px] font-medium text-on-surface-variant mt-1">
            {roomsCopy.seatsSummary(room.occupiedCount, room.seatCount)}
          </p>
        </div>
        <OccupancyRing occupied={room.occupiedCount} total={room.seatCount} />
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}
