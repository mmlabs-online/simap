import { portalCopy } from "../copy/portal";
import type { FooterStatus } from "../FormFooterBar";

const copy = portalCopy.profile.footer;

/** Display-name length as the limit counts it: NFC code points (a Vietnamese NFD name is not double counted). */
export const nameLength = (raw: string): number => [...raw.normalize("NFC")].length;

/** Any difference, including whitespace, is an edit. */
export const nameDirty = (draft: string, saved: string): boolean => draft !== saved;

/** The footer status: busy wins over errors, errors over unsaved, unsaved over saved. */
export function footerStatus(s: { busy: boolean; dirty: boolean; errors: string[] }): FooterStatus {
  if (s.busy) return { tone: "busy", text: copy.saving };
  if (s.errors.length > 0) return { tone: "error", text: s.errors.join(" ") };
  if (s.dirty) return { tone: "dirty", text: copy.dirty };
  return { tone: "saved", text: copy.saved, detail: copy.savedDetail };
}
