const KEEP = /^[a-z][a-z0-9-]{0,40}$/;

/** Route shape for audit meta (SYS-03): plain word segments are kept, every other segment becomes `:id`. */
export function auditRoute(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  const out = path
    .split("/")
    .map((s) => (s === "" || KEEP.test(s) ? s : ":id"))
    .join("/");
  return out.slice(0, 200);
}
