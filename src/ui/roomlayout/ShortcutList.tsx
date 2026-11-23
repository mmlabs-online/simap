import { SHORTCUTS } from "@/lib/layout-editor/shortcuts";
import { roomlayoutCopy } from "../copy/roomlayout";

const c = roomlayoutCopy.editor.shortcuts;

const Keys = ({ keys }: { keys: readonly string[] }) =>
  keys.map((k, n) => (
    <span key={k}>
      {n > 0 && " "}
      <kbd className="rounded border border-outline-variant bg-surface-container px-1 font-mono text-xs">
        {k}
      </kbd>
    </span>
  ));

/** The keyboard and mouse shortcuts of the editor, closed by default. */
export function ShortcutList() {
  return (
    <details className="text-sm text-on-surface">
      <summary className="cursor-pointer font-semibold">{c.summary}</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {SHORTCUTS.map((id) => (
          <div key={id} className="contents" data-testid={`shortcut-${id}`}>
            <dt>
              <Keys keys={c.rows[id].keys} />
            </dt>
            <dd className="text-on-surface-variant">{c.rows[id].action}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-3 font-semibold">{c.mouseHeading}</h3>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {c.mouse.map((m) => (
          <div key={m.keys} className="contents">
            <dt>{m.keys}</dt>
            <dd className="text-on-surface-variant">{m.action}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
