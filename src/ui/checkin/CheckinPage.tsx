"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { firstRoomInputs } from "@/lib/checkin-popup";
import { firstRoom, shownRoom, type FirstRoom } from "@/lib/checkin-room";
import { roomDetailHref } from "@/lib/nav";
import {
  checkinGoTarget,
  checkinRoomHref,
  keepGoodRooms,
  roomCodeFromQuery,
  visibleSelection,
} from "@/lib/room-switcher";
import type { RoomDto } from "@/lib/rooms/types";
import { placedArtEntries } from "@/lib/sprites/item-art";
import { useApiFetch } from "../auth/api-fetch-context";
import { Card } from "../Card";
import { checkinCopy } from "../copy/checkin";
import { createMembersApi } from "../members/members-api";
import { useMemberPhotos } from "../members/useMemberPhotos";
import { useMySeats } from "../portal/useMySeats";
import { createRoomsApi } from "../rooms/rooms-api";
import { useRooms } from "../rooms/useRooms";
import { RoomSwitcherView } from "../RoomSwitcher";
import { RoomMapSection } from "../roomlayout";
import { useCatalogImages } from "../roomlayout/useCatalogImages";
import { SeatDetailPanel } from "../seats/SeatDetailPanel";
import { panelView, parseSeatParam } from "../seats/seat-view";
import { createSeatsApi } from "../seats/seats-api";
import { useRoomLayout } from "../seats/useRoomLayout";
import { useRoomSeats } from "../seats/useRoomSeats";
import { CheckinButton } from "./CheckinButton";
import { CheckinPopup } from "./CheckinPopup";
import { CheckinView, type CheckinViewState } from "./CheckinView";
import { createPresenceApi } from "./presence-api";
import { useCheckinFlow } from "./useCheckinFlow";
import { useMyPresence } from "./useMyPresence";

function CheckinPageInner() {
  const apiFetch = useApiFetch();
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const membersApi = useMemo(() => createMembersApi(apiFetch), [apiFetch]);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const requested = roomCodeFromQuery(searchParams.getAll("room"));
  const param = parseSeatParam(searchParams.getAll("seat"));
  const openCode = param.kind === "code" ? param.code : null;

  const mySeats = useMySeats(apiFetch, seatsApi);
  const rooms = useRooms(roomsApi);
  const [goodRooms, setGoodRooms] = useState<RoomDto[]>([]);
  useEffect(() => {
    setGoodRooms((prev) => keepGoodRooms(prev, rooms.status, rooms.rooms));
  }, [rooms.status, rooms.rooms]);

  const presenceApi = useMemo(() => createPresenceApi(apiFetch), [apiFetch]);
  const myPresence = useMyPresence(presenceApi);
  // Wait for presence to settle so the first room is not picked and then changed; on an error the inputs are empty.
  const first: FirstRoom | null =
    mySeats.status === "ready" && myPresence.status !== "loading"
      ? firstRoom({
          ...firstRoomInputs(myPresence.data),
          seatRoomCodes: mySeats.seats.map((s) => s.roomCode),
        })
      : null;
  const shown = shownRoom({
    requested,
    roomCodes: rooms.status === "ready" ? rooms.rooms.map((r) => r.code) : null,
    first,
  });
  const shownCode = shown.kind === "room" ? shown.code : null;

  const { resolution, list, detail, reloadRooms, reloadSeats, retryDetail } = useRoomSeats(
    roomsApi,
    seatsApi,
    shownCode ?? "",
    openCode,
  );
  const roomId = resolution.kind === "found" ? resolution.room.id : null;
  const map = useRoomLayout(seatsApi, roomId);
  const mapView = map.state.view;
  const art = useMemo(
    () => (mapView ? placedArtEntries(mapView.layout, mapView.items) : undefined),
    [mapView],
  );
  const catalogImages = useCatalogImages(mapView?.seatDevices, art);

  const [selected, setSelected] = useState(shownCode ?? "");
  useEffect(() => {
    setSelected(shownCode ?? "");
  }, [shownCode]);

  const view = panelView(param, resolution, list, detail);
  const occupant = view.kind === "ready" ? view.seat.occupant : null;
  const occupantItems = useMemo(
    () => (occupant ? [occupant] : []),
    // Keyed by value so a reload keeps the cache entry.
    [occupant?.id, occupant?.hasPhoto, occupant?.photoVersion],
  );
  const photoUrl = useMemberPhotos(membersApi, occupantItems);

  const openSeat = (code: string) =>
    router.push(checkinRoomHref(pathname, requested, code), { scroll: false });
  const onPanelRetry = () => {
    if (resolution.kind === "error") void reloadRooms();
    else if (list.status === "error") void reloadSeats();
    else retryDetail();
  };
  const detailHref = shownCode !== null ? roomDetailHref(shownCode) : null;

  const flow = useCheckinFlow({
    mySeats,
    rooms: goodRooms,
    myPresence,
    presenceApi,
    seatsApi,
    shownCode,
    seatPanelOpen: openCode !== null,
    navigate: (code) => router.replace(checkinRoomHref(pathname, code, null), { scroll: false }),
  });

  let state: CheckinViewState;
  if (mySeats.status === "error") {
    state = {
      kind: "error",
      code: mySeats.errorCode ?? "internal",
      onRetry: () => void mySeats.reload(),
    };
  } else if (shown.kind === "loading") {
    state = { kind: "loading" };
  } else if (shown.kind === "noSeat") {
    state = { kind: "noSeat" };
  } else {
    const found = goodRooms.find((r) => r.code === shown.code);
    state = {
      kind: "room",
      roomHeading: found ? checkinCopy.roomHeading(found.code, found.name) : shown.code,
      map: (
        <RoomMapSection
          state={map.state}
          onRetry={() => void map.reload()}
          onSelect={openSeat}
          catalogImages={catalogImages}
        />
      ),
    };
  }

  return (
    <>
      <CheckinView
        state={state}
        button={<CheckinButton {...flow.button} />}
        switcher={
          <RoomSwitcherView
            rooms={goodRooms}
            selected={visibleSelection(goodRooms, selected)}
            onSelect={setSelected}
            onGo={() => {
              const href = checkinGoTarget(
                pathname,
                visibleSelection(goodRooms, selected),
                shownCode,
              );
              if (href) router.push(href);
            }}
          />
        }
      />
      <CheckinPopup {...flow.popup} />
      {shown.kind === "room" && (
        <SeatDetailPanel
          view={view}
          seatCode={openCode}
          onClose={() =>
            router.replace(checkinRoomHref(pathname, requested, null), { scroll: false })
          }
          onRetry={onPanelRetry}
          occupantPhoto={occupant ? photoUrl(occupant) : null}
          actions={
            detailHref && openCode ? (
              <Link
                href={`${detailHref}?seat=${encodeURIComponent(openCode)}`}
                className="text-sm font-bold text-primary underline"
              >
                {checkinCopy.openInRoom}
              </Link>
            ) : undefined
          }
        />
      )}
    </>
  );
}

/** The check-in room view. `useSearchParams` sits inside `<Suspense>`. Renders only below `AuthGate`. */
export function CheckinPage() {
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
      <CheckinPageInner />
    </Suspense>
  );
}
