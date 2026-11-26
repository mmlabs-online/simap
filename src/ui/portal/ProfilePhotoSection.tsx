import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { portalCopy } from "../copy/portal";

const copy = portalCopy.profile.photo;
const BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface text-on-surface px-4 py-2 text-sm font-bold cursor-pointer hover:border-outline focus-within:ring-2 focus-within:ring-primary";

export type ProfilePhotoSectionProps = {
  name: string;
  url: string | null;
  status: "loading" | "ready" | "failed";
  busy: "processing" | "upload" | "remove" | null;
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
  const label =
    busy === "processing"
      ? copy.processing
      : busy === "upload"
        ? copy.uploading
        : url
          ? copy.replace
          : copy.upload;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Avatar name={name} src={url} size={72} />
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className={BTN}>
              <Icon name="upload" size={18} />
              {label}
              <input
                type="file"
                accept="image/*"
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
          <p className="text-xs text-on-surface-variant">{copy.hint}</p>
        </div>
      </div>
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
