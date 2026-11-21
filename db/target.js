// @ts-check
// Classifies a database target as production or not (SIM-029, D56). Zero imports: pure code, no URL text in results.
// Production = the Cloudflare pg-tunnel (127.0.0.1:15432 by default) or an explicit SIMAP_DB_TARGET. Fails closed.

export const DEFAULT_TUNNEL_PORT = 15432;
const NON_PRODUCTION_TARGETS = new Set(["", "local", "dev"]);

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ports: number[], primary: number, valid: boolean }}
 */
export function tunnelPorts(env) {
  const raw = (env.SIMAP_PROD_TUNNEL_PORT ?? "").trim();
  if (raw === "")
    return { ports: [DEFAULT_TUNNEL_PORT], primary: DEFAULT_TUNNEL_PORT, valid: true };
  const n = Number(raw);
  if (!/^[1-9]\d{0,4}$/.test(raw) || n > 65535) {
    return { ports: [DEFAULT_TUNNEL_PORT], primary: DEFAULT_TUNNEL_PORT, valid: false };
  }
  return { ports: [...new Set([DEFAULT_TUNNEL_PORT, n])], primary: n, valid: true };
}

/**
 * @param {{ databaseUrl: string | undefined, env: Record<string, string | undefined> }} input
 * @returns {{ production: boolean }}
 */
export function classifyTarget({ databaseUrl, env }) {
  const target = (env.SIMAP_DB_TARGET ?? "").trim().toLowerCase();
  if (!NON_PRODUCTION_TARGETS.has(target)) return { production: true };
  const { ports, valid } = tunnelPorts(env);
  if (!valid) return { production: true };

  const pgPort = env.PGPORT;
  if (pgPort !== undefined && pgPort !== "") {
    if (!/^\d+$/.test(pgPort) || ports.includes(Number(pgPort))) return { production: true };
  }

  if (!databaseUrl) return { production: true };
  let u;
  try {
    u = new URL(databaseUrl);
  } catch {
    return { production: true };
  }
  if (u.searchParams.has("port")) return { production: true };
  if (u.port !== "" && ports.includes(Number(u.port))) return { production: true };
  // Multi-host URLs (a:1,b:2) do not parse as a URL with new URL in Node; fail closed above.
  return { production: false };
}
