"use client";

import type { RoomDto } from "@/lib/rooms/types";
import { Button } from "./Button";
import { shellCopy } from "./copy/shell";

const SELECT_ID = "room-switcher-select";

/** Presentational: label, native select and Go. Changing the select never navigates. Used on check-in only. */
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
        className="min-w-0 flex-1 md:max-w-xs min-h-control rounded-lg border border-border-strong bg-surface px-3 text-label text-text-primary cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out"
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
