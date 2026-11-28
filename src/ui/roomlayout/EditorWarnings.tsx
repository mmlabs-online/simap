import { roomlayoutCopy } from "../copy/roomlayout";

const copy = roomlayoutCopy.editor.warnings;

export type EditorWarningsProps = {
  noDoor: boolean;
  /** One entry per seat; `code` is null for a desk that has no seat code yet. */
  unreachable: readonly { key: string; code: string | null }[];
};

/** Non-blocking layout warnings (PRE-07). Renders nothing when there is none. */
export function EditorWarnings({ noDoor, unreachable }: EditorWarningsProps) {
  if (!noDoor && unreachable.length === 0) return null;
  return (
    <div
      role="status"
      className="rounded-md border border-warning/40 bg-warning-tint p-2 text-label font-normal text-text-primary"
    >
      <p className="font-medium">{copy.heading}</p>
      <ul className="list-disc pl-5">
        {noDoor && <li>{copy.noDoor}</li>}
        {unreachable.length > 0 && <li>{copy.unreachable(unreachable.map((u) => u.code))}</li>}
      </ul>
    </div>
  );
}
