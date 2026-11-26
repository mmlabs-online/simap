import type { MemberPhotoDto } from "@/lib/members/photo";
import type { ImageEntry } from "../deviceTypes/image-url-cache";
import type { MembersResult } from "./members-api";

/** Anything with a member id and a photo state: a `MemberDto` or a seat occupant. */
export type PhotoRef = { id: string } & MemberPhotoDto;

export const toImageEntry = (r: PhotoRef): ImageEntry => ({
  id: r.id,
  hasImage: r.hasPhoto,
  imageVersion: r.photoVersion,
});

/** The cache loader: a failed fetch is a null blob, so the caller shows initials. */
export const photoLoader =
  (api: { getPhoto: (id: string) => Promise<MembersResult<Blob>> }) =>
  (id: string): Promise<Blob | null> =>
    api.getPhoto(id).then((r) => (r.ok ? r.value : null));

export type RemovePhotoOutcome = { kind: "removed" } | { kind: "error"; code: string };

/** A 404 means the photo is already gone, which is what the Manager wanted. */
export function removePhotoOutcome(result: MembersResult<null>): RemovePhotoOutcome {
  if (result.ok || result.code === "not_found") return { kind: "removed" };
  return { kind: "error", code: result.code };
}
