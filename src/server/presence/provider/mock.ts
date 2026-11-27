import "server-only";
import { ProviderPullError, type CheckInProvider, type ProviderCheckInInput } from "./types";

/** Deterministic in-memory provider for dev and tests. `fail` injects a rejection or a call that never answers. */
export function createMockProvider(
  entries: readonly ProviderCheckInInput[],
  opts: { fail?: "error" | "hang" } = {},
): CheckInProvider {
  return {
    id: "mock",
    async pull({ signal }) {
      if (opts.fail === "error") throw new ProviderPullError("provider_error");
      if (opts.fail === "hang") {
        await new Promise<void>((resolve) => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", () => resolve(), { once: true });
        });
        throw new ProviderPullError("timeout");
      }
      return { checkIns: entries.map((e) => ({ ...e, member: { ...e.member } })) };
    },
  };
}
