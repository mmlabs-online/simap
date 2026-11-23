import type { Draft, EditorItem } from "@/lib/layout-editor/types";
import { Button } from "../Button";
import { roomlayoutCopy } from "../copy/roomlayout";

const copy = roomlayoutCopy.editor;
const c = copy.inspector;

type Props = {
  draft: Draft;
  selection: readonly string[];
  disabled: boolean;
  onSelect: (key: string, additive: boolean) => void;
  onMove: (dx: number, dy: number) => void;
  onRotate: () => void;
  onDelete: () => void;
};

const byReadingOrder = (a: EditorItem, b: EditorItem) =>
  a.y - b.y || a.x - b.x || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

const label = (i: EditorItem) => copy.itemAt(copy.itemName(i), i.x, i.y);

/** Selection actions, the room size, the tray and the list of items (the keyboard path to select). */
export function EditorInspector({
  draft,
  selection,
  disabled,
  onSelect,
  onMove,
  onRotate,
  onDelete,
}: Props) {
  const selected = draft.items.filter((i) => selection.includes(i.key));
  const none = selected.length === 0;
  const hasSeat = selected.some((i) => i.kind === "seat");
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
            <span className="font-semibold">{copy.itemName(selected[0])}</span>
            <br />
            {c.position(selected[0].x, selected[0].y, selected[0].rotation)}
          </p>
        )}
        {selected.length > 1 && <p className="font-semibold">{c.count(selected.length)}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="tonal" size="sm" disabled={off} onClick={onRotate}>
            {c.rotate}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={off || hasSeat}
            aria-describedby={hasSeat ? "editor-delete-reason" : undefined}
            onClick={onDelete}
          >
            {c.delete}
          </Button>
        </div>
        {hasSeat && (
          <p id="editor-delete-reason" className="text-on-surface-variant">
            {copy.refused.seat_delete}
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

      <p className="text-on-surface-variant">{c.roomSize(draft.w, draft.h)}</p>

      {draft.tray.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="font-bold">{c.trayHeading(draft.tray.length)}</h3>
          <ul className="list-disc pl-5 text-on-surface-variant">
            {draft.tray.map((t) => (
              <li key={t.id}>{t.code}</li>
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
