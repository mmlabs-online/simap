"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { goTarget, keepGoodRooms, roomCodeFromPath } from "@/lib/room-switcher";
import type { RoomDto } from "@/lib/rooms/types";
import { useApiFetch } from "./auth/api-fetch-context";
import { Button } from "./Button";
import { shellCopy } from "./copy/shell";
import { createRoomsApi } from "./rooms/rooms-api";
import { useRooms } from "./rooms/useRooms";

const SELECT_ID = "room-switcher-select";

/** Presentational: label, native select and Go. Changing the select never navigates. */
export function RoomSwitcherView({
  rooms,
  selected,
  onSelect,
  onGo,
}: {
  rooms: RoomDto[];
  selected: string;
  onSelect: (code: string) => void;
  onGo: () => void;
}) {
  const copy = shellCopy.roomSwitcher;
  return (
    <>
      <label htmlFor={SELECT_ID} className="sr-only">
        {copy.label}
      </label>
      <select
        id={SELECT_ID}
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="min-w-0 flex-1 lg:max-w-xs h-10 rounded-md3 border border-outline-variant bg-surface px-3 text-sm font-semibold text-on-surface"
      >
        <option value="">{copy.placeholder}</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.code}>
            {r.code} - {r.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" onClick={onGo}>
        {copy.go}
      </Button>
    </>
  );
}

/** Loads the org's rooms, refetches on path change and keeps the last good list. */
export function RoomSwitcher({ pathname }: { pathname: string }) {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const { status, rooms, reload } = useRooms(api);
  const router = useRouter();
  const [good, setGood] = useState<RoomDto[]>([]);
  const lastPath = useRef(pathname);
  const current = roomCodeFromPath(pathname);
  const [selected, setSelected] = useState(current ?? "");

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      void reload();
    }
  }, [pathname, reload]);

  useEffect(() => {
    setGood((prev) => keepGoodRooms(prev, status, rooms));
  }, [status, rooms]);

  useEffect(() => {
    setSelected(current ?? "");
  }, [current]);

  const onGo = () => {
    const href = goTarget(selected, current);
    if (href) router.push(href);
  };

  return <RoomSwitcherView rooms={good} selected={selected} onSelect={setSelected} onGo={onGo} />;
}
