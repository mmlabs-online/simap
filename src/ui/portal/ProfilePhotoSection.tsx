import { Avatar } from "../Avatar";
import { portalCopy } from "../copy/portal";

const copy = portalCopy.profile.photo;
const BTN =
  "inline-flex items-center rounded-full bg-secondary-container text-on-secondary-container px-3 py-1.5 text-sm font-bold cursor-pointer focus-within:ring-2 focus-within:ring-primary";

export type ProfilePhotoSectionProps = {
  name: string;
  url: string | null;
  status: "loading" | "ready" | "failed";
  busy: "upload" | "remove" | null;
  error: string | null;
  notice: string | null;
  onPick(file: File): void;
  onRemove(): void;
};

/** The photo section of the Profile tab. Props only, so the markup can be tested without effects. */
export function ProfilePhotoSection({
  name,
  url,
  status,
  busy,
  error,
  notice,
  onPick,
  onRemove,
}: ProfilePhotoSectionProps) {
  const label = busy === "upload" ? copy.uploading : url ? copy.replace : copy.upload;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold text-on-surface">{copy.heading}</h3>
      <div className="flex items-center gap-3">
        <Avatar name={name} src={url} size={80} />
        <div className="flex flex-wrap items-center gap-2">
          <label className={BTN}>
            {label}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              disabled={busy !== null}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) onPick(file);
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={onRemove}
              className="text-sm font-bold text-error px-2 py-1.5"
            >
              {busy === "remove" ? copy.removing : copy.remove}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">{copy.hint}</p>
      {status === "failed" && <p className="text-xs text-on-surface-variant">{copy.loadFailed}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-xs font-medium text-on-surface">
          {notice}
        </p>
      )}
    </section>
  );
}
