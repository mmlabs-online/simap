import { useId } from "react";
import { DEVICE_LIMITS } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { noteLength } from "./assign-device";

const CAPTION = "text-label text-text-primary";
const HINT = "text-caption text-text-secondary";
const BOX =
  "field-box rounded-lg border border-border-strong bg-surface transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out";

/** The note textarea with its label, hint and code point counter. Shared by assign and transfer. */
export function NoteField({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint: string;
}) {
  const noteId = useId();
  const hintId = useId();
  const countId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={noteId} className={CAPTION}>
        {label}
      </label>
      <div className={BOX}>
        <textarea
          id={noteId}
          rows={3}
          value={value}
          maxLength={DEVICE_LIMITS.note}
          aria-describedby={`${hintId} ${countId}`}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full resize-y bg-transparent px-4 py-2 text-label font-normal text-text-primary outline-none"
        />
      </div>
      <span id={hintId} className={HINT}>
        {hint}
      </span>
      <span id={countId} className={HINT}>
        {devicesCopy.assign.noteCount(noteLength(value), DEVICE_LIMITS.note)}
      </span>
    </div>
  );
}
