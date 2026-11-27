import { isCanonicalUuid } from "@/lib/validate/uuid";

// A kept word must start with a letter and be a plain word: no digits, so hex-like ids are never kept.
const KEEP = /^[a-z][a-z-]{0,40}$/;

/** Route shape for audit meta (SYS-03): plain word segments are kept, every other segment (UUIDs included) becomes `:id`. */
export function auditRoute(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  const out = path
    .split("/")
    .map((s) => (s === "" ? s : isCanonicalUuid(s) ? ":id" : KEEP.test(s) ? s : ":id"))
    .join("/");
  return out.slice(0, 200);
}
