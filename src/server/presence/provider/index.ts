import "server-only";
import type { OrgScope } from "@/server/http/org-scope";
import { applyProviderCheckIn, type Db } from "../presence";
import { loadProviderConfig } from "./config";
import { createMockProvider } from "./mock";
import { createProviderPuller } from "./pull";

type Puller = ReturnType<typeof createProviderPuller<Db>>;

declare global {
  var __simapPresenceProvider: { puller: Puller | null } | undefined;
}

const log = (entry: Record<string, unknown>) => console.error(JSON.stringify(entry));

/** Lazy, once per process (so `next build` needs no env). Off when unset, and off with one log when invalid. */
function load(): Puller | null {
  const config = (() => {
    try {
      return loadProviderConfig(process.env);
    } catch {
      log({ event: "presence_provider_config_invalid" });
      return { kind: "off" } as const;
    }
  })();
  if (config.kind !== "mock") return null;
  const provider = createMockProvider(config.entries);
  return createProviderPuller<Db>({
    provider,
    apply: (db, scope, item, at, now) =>
      applyProviderCheckIn(db, scope, item, at, now, provider.id),
    log,
  });
}

/** PRE-04: pulls the provider's check-ins for the caller's org before a presence read. Never throws. */
export async function syncProviderCheckIns(db: Db, scope: OrgScope): Promise<void> {
  globalThis.__simapPresenceProvider ??= { puller: load() };
  await globalThis.__simapPresenceProvider.puller?.sync(db, scope);
}
