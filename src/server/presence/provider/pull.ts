import "server-only";
import { providerCheckInAt } from "@/lib/presence/provider-time";
import { workDateUtc7 } from "@/lib/presence/work-date";
import { parseProviderPull, type ProviderCheckInInput } from "@/lib/validate/provider-checkin";
import type { OrgScope } from "@/server/http/org-scope";
import { ProviderPullError, type CheckInProvider } from "./types";

type FailCode = "timeout" | "provider_error" | "bad_response" | "apply_error";
type Log = (entry: {
  event: "presence_provider_pull_failed";
  provider: string;
  code: FailCode;
}) => void;

export type PullDeps<Db> = {
  provider: CheckInProvider;
  apply: (
    db: Db,
    scope: OrgScope,
    item: ProviderCheckInInput,
    at: Date,
    now: Date,
  ) => Promise<unknown>;
  log: Log;
  clock?: () => Date;
  minIntervalMs?: number;
  timeoutMs?: number;
};

/**
 * G3: pull on read. `sync` runs an org-wide pull at most once per `minIntervalMs` per org per process, concurrent
 * callers share the in-flight pull, and it never throws (a failure logs only the provider id and a fixed code).
 * The provider call never runs inside a transaction; each item is applied in its own short one.
 */
export function createProviderPuller<Db>(deps: PullDeps<Db>) {
  const { provider, apply, log } = deps;
  const clock = deps.clock ?? (() => new Date());
  const minIntervalMs = deps.minIntervalMs ?? 30_000;
  const timeoutMs = deps.timeoutMs ?? 2_000;
  const orgs = new Map<string, { startedAt: number; inflight: Promise<void> | null }>();

  const fail = (code: FailCode) =>
    log({ event: "presence_provider_pull_failed", provider: provider.id, code });

  async function pullOnce(db: Db, scope: OrgScope): Promise<void> {
    const now = clock();
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raw: unknown;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ac.abort();
          reject(new ProviderPullError("timeout"));
        }, timeoutMs);
      });
      raw = await Promise.race([
        provider.pull({ workDate: workDateUtc7(now), signal: ac.signal }),
        timeout,
      ]);
    } catch (err) {
      fail(err instanceof ProviderPullError ? err.code : "provider_error");
      return;
    } finally {
      clearTimeout(timer);
    }
    const parsed = parseProviderPull(raw);
    if (!parsed) return fail("bad_response");
    let applyFailed = false;
    for (const item of parsed.items) {
      const at = providerCheckInAt(item.at, now);
      if (!at) continue;
      try {
        await apply(db, scope, item, at, now);
      } catch {
        applyFailed = true;
      }
    }
    if (applyFailed) fail("apply_error");
  }

  return {
    async sync(db: Db, scope: OrgScope): Promise<void> {
      let state = orgs.get(scope.orgId);
      if (state?.inflight) return state.inflight;
      const t = clock().getTime();
      if (state && t - state.startedAt < minIntervalMs) return;
      state = { startedAt: t, inflight: null };
      orgs.set(scope.orgId, state);
      const s = state;
      s.inflight = pullOnce(db, scope)
        .catch(() => fail("provider_error"))
        .finally(() => {
          s.inflight = null;
        });
      return s.inflight;
    },
  };
}
