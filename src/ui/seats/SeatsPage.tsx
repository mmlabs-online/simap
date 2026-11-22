"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApiFetch } from "../auth/api-fetch-context";
import { Card } from "../Card";
import { createRoomsApi } from "../rooms/rooms-api";
import { SeatDetailPanel } from "./SeatDetailPanel";
import { panelView, parseSeatParam, retryTarget, seatHref } from "./seat-view";
import { createSeatsApi } from "./seats-api";
import { SeatsView } from "./SeatsView";
import { useRoomSeats } from "./useRoomSeats";

function SeatsPageInner({ roomCode }: { roomCode: string }) {
  const apiFetch = useApiFetch();
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // `open` is derived only from the URL.
  const param = parseSeatParam(searchParams.getAll("seat"));
  const openCode = param.kind === "code" ? param.code : null;
  const { resolution, list, detail, reloadRooms, reloadSeats, retryDetail } = useRoomSeats(
    roomsApi,
    seatsApi,
    roomCode,
    openCode,
  );

  const onRetry = () => void (resolution.kind === "error" ? reloadRooms() : reloadSeats());
  const onPanelRetry = () => {
    const target = retryTarget(resolution, list);
    if (target === "rooms") void reloadRooms();
    else if (target === "seats") void reloadSeats();
    else retryDetail();
  };

  return (
    <>
      <SeatsView
        roomCode={roomCode}
        resolution={resolution}
        list={list}
        onRetry={onRetry}
        onOpen={(code) => router.push(seatHref(pathname, code), { scroll: false })}
      />
      <SeatDetailPanel
        view={panelView(param, resolution, list, detail)}
        seatCode={openCode}
        onClose={() => router.replace(seatHref(pathname, null), { scroll: false })}
        onRetry={onPanelRetry}
      />
    </>
  );
}

/** Room detail page. `useSearchParams` sits inside `<Suspense>`. Renders only below `AuthGate`. */
export function SeatsPage({ roomCode }: { roomCode: string }) {
  return (
    <Suspense
      fallback={
        <div className="p-4 lg:p-6">
          <Card className="h-48 animate-pulse">
            <div aria-busy="true" />
          </Card>
        </div>
      }
    >
      <SeatsPageInner roomCode={roomCode} />
    </Suspense>
  );
}
