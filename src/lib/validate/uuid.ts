const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** True only for a lowercase canonical UUID (versions 1-8); rejects the nil UUID, padding and non-strings. */
export function isCanonicalUuid(v: unknown): v is string {
  return typeof v === "string" && CANONICAL_UUID.test(v);
}
