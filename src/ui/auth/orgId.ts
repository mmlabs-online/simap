const PREFIX = "mm_org_id:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const key = (accountId: string) => PREFIX + accountId.toLowerCase();

/** The org this account last entered on this device: an id, not a secret. Never a token. */
export function readOrgId(accountId: string): string | null {
  try {
    const v = localStorage.getItem(key(accountId));
    if (v === null) return null;
    if (UUID_RE.test(v)) return v.toLowerCase();
    localStorage.removeItem(key(accountId));
  } catch {
    // storage unavailable
  }
  return null;
}

export function writeOrgId(accountId: string, orgId: string): void {
  try {
    localStorage.setItem(key(accountId), orgId.toLowerCase());
  } catch {
    // storage unavailable: the org is just not remembered
  }
}

/** With `onlyIf`, clears only while the stored value still equals it (another tab may have chosen another org). */
export function clearOrgId(accountId: string, onlyIf?: string): void {
  try {
    if (onlyIf !== undefined) {
      const v = localStorage.getItem(key(accountId));
      if (v === null || v.toLowerCase() !== onlyIf.toLowerCase()) return;
    }
    localStorage.removeItem(key(accountId));
  } catch {
    // storage unavailable
  }
}
