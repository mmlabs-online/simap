import type { RoomDto } from "@/lib/rooms/types";
import { apiErrorMessage } from "../copy/api";
import { roomsCopy } from "../copy/rooms";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { RoomCard } from "./RoomCard";

export type RoomsViewProps = {
  status: "loading" | "error" | "ready";
  rooms: RoomDto[];
  errorCode: string | null;
  canManage: boolean;
  onRetry: () => void;
  onNew: () => void;
  onEdit: (room: RoomDto) => void;
  onDelete: (room: RoomDto) => void;
};

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

/** The Rooms page body. Pure: data and handlers come from props. Write actions render only for Admins. */
export function RoomsView({
  status,
  rooms,
  errorCode,
  canManage,
  onRetry,
  onNew,
  onEdit,
  onDelete,
}: RoomsViewProps) {
  return (
    <div className="page-content flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-display text-text-primary">{shellCopy.pages.rooms.title}</h1>
        {canManage && (
          <Button icon="add" onClick={onNew}>
            {roomsCopy.newRoom}
          </Button>
        )}
      </div>

      {status === "loading" && (
        <div aria-busy="true" className={GRID}>
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-32 animate-pulse">
              {null}
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {roomsCopy.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && rooms.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-label text-text-secondary">{shellCopy.pages.rooms.empty}</p>
        </Card>
      )}

      {status === "ready" && rooms.length > 0 && (
        <div className={GRID}>
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              actions={
                canManage && (
                  <>
                    <Button
                      variant="tonal"
                      size="sm"
                      icon="edit"
                      aria-label={roomsCopy.editLabel(room.code)}
                      onClick={() => onEdit(room)}
                    >
                      {roomsCopy.edit}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      aria-label={roomsCopy.deleteLabel(room.code)}
                      onClick={() => onDelete(room)}
                    >
                      {roomsCopy.delete}
                    </Button>
                  </>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
