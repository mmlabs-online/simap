import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { PendingInvitationDto } from "@/lib/members/types";
import type { InvitationRecordValue } from "@/lib/validate/invitation";

export type RecordResult = { ok: true; value: PendingInvitationDto } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** The simap record call through the bearer `apiFetch`. Resolves to a result and never throws. */
export function createInvitationsApi(fetcher: ApiFetch) {
  return {
    async record(body: InvitationRecordValue): Promise<RecordResult> {
      let res: Response;
      try {
        res = await fetcher("/api/invitations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        if (e instanceof ApiAccessError) {
          return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
        }
        return fail("unavailable");
      }
      if (!res.ok) return fail(await errorCode(res));
      try {
        return { ok: true, value: (await res.json()) as PendingInvitationDto };
      } catch {
        return fail("internal");
      }
    },
  };
}

export type InvitationsApi = ReturnType<typeof createInvitationsApi>;
