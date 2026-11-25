"use client";

import { useState } from "react";
import { parseRoomSize, type Tool } from "@/lib/layout-editor/place-tool";
import type { Draft, EditorItem } from "@/lib/layout-editor/types";
import { Button } from "../Button";
import { roomlayoutCopy } from "../copy/roomlayout";
import { inputClass } from "./Palette";

const copy = roomlayoutCopy.editor;
const c = copy.inspector;

type Props = {
  draft: Draft;
  selection: readonly string[];
  disabled: boolean;
  tool: Tool | null;
  /** Catalog names by item key, for fixtures. */
  names?: ReadonlyMap<string, string>;
  resizeRefused: boolean;
  onArmTray: (seatId: string) => void;
  onResize: (w: number, h: number) => void;
  onSelect: (key: string, additive: boolean) => void;
  onMove: (dx: number, dy: number) => void;
  onRotate: () => void;
  onDelete: () => void;
};

const byReadingOrder = (a: EditorItem, b: EditorItem) =>
  a.y - b.y || a.x - b.x || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** Selection actions, the room size, the tray and the list of items (the keyboard path to select). */
export function EditorInspector({
  draft,
  selection,
  disabled,
  tool,
  names,
  resizeRefused,
  onArmTray,
  onResize,
  onSelect,
  onMove,
  onRotate,
  onDelete,
}: Props) {
  const label = (i: EditorItem) => copy.itemAt(copy.itemName(i, names?.get(i.sprite)), i.x, i.y);
  const selected = draft.items.filter((i) => selection.includes(i.key));
  const none = selected.length === 0;
  const hasSavedSeat = selected.some((i) => i.seatId !== null);
  const off = disabled || none;
  const items = [...draft.items].sort(byReadingOrder);
  const moves: [string, number, number][] = [
    [c.up, 0, -1],
    [c.down, 0, 1],
    [c.left, -1, 0],
    [c.right, 1, 0],
  ];

  return (
    <aside className="flex flex-col gap-4 text-sm text-on-surface">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-extrabold">{c.heading}</h2>
        {none && <p className="text-on-surface-variant">{c.none}</p>}
        {selected.length === 1 && (
          <p>
            <span className="font-semibold">
              {copy.itemName(selected[0], names?.get(selected[0].sprite))}
            </span>
            <br />
            {c.position(selected[0].x, selected[0].y, selected[0].rotation)}
          </p>
        )}
        {selected.length > 1 && <p className="font-semibold">{c.count(selected.length)}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="tonal" size="sm" disabled={off} aria-keyshortcuts="R" onClick={onRotate}>
            {c.rotate}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={off}
            aria-keyshortcuts="Delete Backspace"
            aria-describedby={hasSavedSeat ? "editor-delete-note" : undefined}
            onClick={onDelete}
          >
            {c.delete}
          </Button>
        </div>
        {hasSavedSeat && (
          <p id="editor-delete-note" className="text-on-surface-variant">
            {c.deleteSeatNote}
          </p>
        )}
        <div role="group" aria-label={c.moveLabel} className="flex flex-wrap gap-2">
          {moves.map(([name, dx, dy]) => (
            <Button
              key={name}
              variant="tonal"
              size="sm"
              disabled={off}
              onClick={() => onMove(dx, dy)}
            >
              {name}
            </Button>
          ))}
        </div>
      </section>

      <RoomSizeForm
        key={`${draft.w}x${draft.h}`}
        w={draft.w}
        h={draft.h}
        disabled={disabled}
        refused={resizeRefused}
        onResize={onResize}
      />

      {draft.tray.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="font-bold">{c.trayHeading(draft.tray.length)}</h3>
          <ul>
            {draft.tray.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={tool?.kind === "tray" && tool.seatId === t.id}
                  disabled={disabled}
                  onClick={() => onArmTray(t.id)}
                  className="w-full cursor-pointer px-3 py-1.5 text-left text-[13px] hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:font-extrabold aria-pressed:text-primary"
                >
                  {c.placeSeat(t.code)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-1">
        <h3 className="font-bold">{c.itemsHeading}</h3>
        {items.length === 0 ? (
          <p className="text-on-surface-variant">{c.itemsEmpty}</p>
        ) : (
          <ul className="max-h-64 overflow-auto rounded-md border border-outline-variant">
            {items.map((i) => (
              <li key={i.key}>
                <button
                  type="button"
                  aria-pressed={selection.includes(i.key)}
                  onClick={(e) => onSelect(i.key, e.shiftKey)}
                  className="w-full cursor-pointer px-3 py-1.5 text-left text-[13px] hover:bg-surface-high aria-pressed:font-extrabold aria-pressed:text-primary"
                >
                  {label(i)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

type SizeProps = {
  w: number;
  h: number;
  disabled: boolean;
  refused: boolean;
  onResize: (w: number, h: number) => void;
};

/** Room size inputs; the parent re-keys it on the draft size so undo and save reset the text. */
export function RoomSizeForm({ w, h, disabled, refused, onResize }: SizeProps) {
  const [tw, setTw] = useState(String(w));
  const [th, setTh] = useState(String(h));
  const [bad, setBad] = useState(false);
  const note = bad ? "size-bad" : refused ? "size-refused" : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseRoomSize(tw, th);
    setBad(!r.ok);
    if (r.ok) onResize(r.w, r.h);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          {c.sizeW}
          <input
            inputMode="numeric"
            className={inputClass}
            value={tw}
            disabled={disabled}
            aria-describedby={note}
            onChange={(e) => setTw(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1">
          {c.sizeH}
          <input
            inputMode="numeric"
            className={inputClass}
            value={th}
            disabled={disabled}
            aria-describedby={note}
            onChange={(e) => setTh(e.target.value)}
          />
        </label>
        <Button type="submit" variant="tonal" size="sm" disabled={disabled}>
          {c.sizeApply}
        </Button>
      </div>
      {bad && (
        <p id="size-bad" className="text-error">
          {c.sizeBad}
        </p>
      )}
      {refused && !bad && (
        <p id="size-refused" className="text-error">
          {copy.refused.resize_cut}
        </p>
      )}
    </form>
  );
}
