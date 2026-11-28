"use client";

import { useState } from "react";
import { parseWhole } from "@/lib/layout-editor/place-tool";
import type { PaletteEntry } from "@/lib/layout-editor/palette";
import { Button } from "../Button";
import { roomlayoutCopy } from "../copy/roomlayout";

const copy = roomlayoutCopy.editor;
const c = copy.palette;

export const inputClass =
  "w-16 min-h-control rounded-lg border border-border-strong bg-surface px-2 text-label font-normal text-text-primary";

type PaletteProps = {
  groups: { group: string; entries: PaletteEntry[] }[];
  /** Sprite of the armed fixture tool, or "desk.single" while the desk tool is armed. */
  armed: string | null;
  disabled: boolean;
  status: "loading" | "ready" | "error";
  onRetry: () => void;
  onArm: (entry: PaletteEntry) => void;
};

/** The catalog's seat and fixture items by group; a pressed entry is the armed tool and a second press disarms it. */
export function Palette({ groups, armed, disabled, status, onRetry, onArm }: PaletteProps) {
  return (
    <section className="flex flex-col gap-2 text-label font-normal text-text-primary">
      <h2 className="text-body font-semibold">{c.heading}</h2>
      {status === "loading" && <p role="status">{c.loading}</p>}
      {status === "error" && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-danger">
            {c.failed}
          </p>
          <div>
            <Button variant="tonal" size="sm" onClick={onRetry}>
              {c.retry}
            </Button>
          </div>
        </div>
      )}
      <div className="flex max-h-64 flex-col gap-2 overflow-auto rounded-md border border-divider p-2">
        {groups.map((g) => (
          <div key={g.group}>
            <h3 className="font-semibold">{g.group}</h3>
            <ul>
              {g.entries.map((e) => (
                <li key={e.sprite}>
                  <button
                    type="button"
                    aria-pressed={armed === e.sprite}
                    disabled={disabled}
                    onClick={() => onArm(e)}
                    className="flex min-h-control w-full cursor-pointer items-center rounded-lg px-2 text-left text-label font-normal text-text-primary enabled:hover:bg-tile disabled:cursor-not-allowed aria-pressed:bg-tile aria-pressed:font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out border-l-4 border-transparent aria-pressed:border-pixel-primary"
                  >
                    {e.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

type PanelProps = {
  toolName: string | null;
  disabled: boolean;
  onPlace: (x: number, y: number) => void;
  onDone: () => void;
};

/** The keyboard path to place: shown only while a tool is armed. */
export function PlacePanel({ toolName, disabled, onPlace, onDone }: PanelProps) {
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [bad, setBad] = useState(false);
  if (toolName === null) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const px = parseWhole(x);
    const py = parseWhole(y);
    setBad(px === null || py === null);
    if (px !== null && py !== null) onPlace(px, py);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 text-label font-normal text-text-primary"
    >
      <p role="status">{c.armed(toolName)}</p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          {c.x}
          <input
            inputMode="numeric"
            className={inputClass}
            value={x}
            aria-describedby={bad ? "place-bad" : undefined}
            onChange={(e) => setX(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1">
          {c.y}
          <input
            inputMode="numeric"
            className={inputClass}
            value={y}
            aria-describedby={bad ? "place-bad" : undefined}
            onChange={(e) => setY(e.target.value)}
          />
        </label>
      </div>
      {bad && (
        <p id="place-bad" className="text-danger">
          {c.badTile}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="tonal" size="sm" disabled={disabled}>
          {c.place}
        </Button>
        <Button variant="text" size="sm" onClick={onDone}>
          {c.done}
        </Button>
      </div>
    </form>
  );
}
