import { Avatar } from "../Avatar";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { portalCopy } from "../copy/portal";

const copy = portalCopy.profile.photo;
const BTN =
  "field-box inline-flex min-h-control cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 text-label text-text-primary transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out";

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
              <Button variant="text" size="sm" disabled={busy !== null} onClick={onRemove}>
                {busy === "remove" ? copy.removing : copy.remove}
              </Button>
            )}
          </div>
          <p className="text-caption text-text-secondary">{copy.hint}</p>
        </div>
      </div>
      {status === "failed" && <p className="text-caption text-text-secondary">{copy.loadFailed}</p>}
      {error && (
        <p role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-caption font-medium text-text-primary">
          {notice}
        </p>
      )}
    </section>
  );
}
