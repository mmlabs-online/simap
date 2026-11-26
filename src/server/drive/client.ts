import "server-only";
import { randomBytes } from "node:crypto";
import { isCanonicalUuid } from "@/lib/validate/uuid";
import { DRIVE_ID_RE, type DriveConfig } from "./config";

// Google Drive v3 client for org images (D61), a TypeScript port of tudocuatui's drive.js. Plain fetch, no
// dependency. Secrets come from runtime env only (see config.ts). The scope is `drive.file`: it is a property of
// the refresh token Ming mints (M-46); this client never asks for scopes. Errors carry a fixed code and nothing
// else: no message text from Google, no URL, no headers, no cause. Log entries hold {event, op, code, status,
// reason} only, where `reason` is one of a fixed allowlist.

export type DriveCode =
  | "drive_not_configured"
  | "drive_auth"
  | "drive_not_found"
  | "drive_forbidden"
  | "drive_rate_limited"
  | "drive_unavailable"
  | "drive_too_large"
  | "drive_bad_response"
  | "drive_invalid_id";

export class DriveError extends Error {
  readonly code: DriveCode;
  readonly status?: number;
  constructor(code: DriveCode, status?: number) {
    super(code);
    this.name = "DriveError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

/**
 * Coarse safety cap on any file the client uploads or downloads. It sits above the largest org image (profile photos
 * 256 KB under OQ-56, device types 100 KB under D68, map items 64 KB under D66); the product limits live in the
 * validators.
 */
export const DRIVE_MAX_BYTES = 256 * 1024;

const MIME_RE = /^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_PAGES = 10;
const REASONS = new Set([
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "storageQuotaExceeded",
  "insufficientFilePermissions",
  "notFound",
  "cannotAddParent",
  "authError",
  "backendError",
]);
const AUTH_REASONS = new Set(["invalid_grant", "invalid_client", "unauthorized_client"]);
const RATE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

function reasonOf(text: string): string | undefined {
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    return undefined;
  }
  const r = j?.error?.errors?.[0]?.reason ?? (typeof j?.error === "string" ? j.error : undefined);
  if (typeof r !== "string") return undefined;
  return REASONS.has(r) ? r : "other";
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type DriveClientOptions = {
  config: DriveConfig;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  log?: (entry: Record<string, unknown>) => void;
  tokenUrl?: string;
  apiBase?: string;
  uploadBase?: string;
  timeouts?: { token?: number; meta?: number; upload?: number; media?: number };
};

type Answer = { res: Response; text: string; bytes?: Uint8Array };

export function createDriveClient({
  config,
  fetch: doFetch = globalThis.fetch,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  random = Math.random,
  log = () => {},
  tokenUrl = "https://oauth2.googleapis.com/token",
  apiBase = "https://www.googleapis.com/drive/v3",
  uploadBase = "https://www.googleapis.com/upload/drive/v3",
  timeouts = {},
}: DriveClientOptions) {
  const t = { token: 10_000, meta: 10_000, upload: 30_000, media: 15_000, ...timeouts };
  const MAX_ATTEMPTS = 3;
  let cached: { token: string; expires: number } | null = null;
  let inflight: Promise<string> | null = null;
  let cooldownUntil = 0;

  const note = (op: string, status: number | undefined, code: string, reason?: string) => {
    const entry: Record<string, unknown> = { event: "drive", op, code };
    if (status !== undefined) entry.status = status;
    if (reason !== undefined) entry.reason = reason;
    log(entry);
  };

  const backoff = (res: Response, attempt: number) => {
    const header = res.headers.get("retry-after");
    const ra = Number(header);
    if (header && Number.isFinite(ra) && ra >= 0) return Math.min(ra, 10) * 1000;
    return 500 * 2 ** attempt + Math.floor(random() * 250);
  };

  /** Reads at most DRIVE_MAX_BYTES of the body; cancels the stream and throws drive_too_large above it. */
  async function readCapped(res: Response): Promise<Uint8Array> {
    const len = res.headers.get("content-length");
    if (len !== null && /^\d+$/.test(len) && Number(len) > DRIVE_MAX_BYTES) {
      await res.body?.cancel();
      throw new DriveError("drive_too_large");
    }
    if (!res.body) throw new DriveError("drive_bad_response");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > DRIVE_MAX_BYTES) {
        await reader.cancel();
        throw new DriveError("drive_too_large");
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out;
  }

  /** One fetch with a timeout covering headers and body. `media`: an ok answer is read as capped bytes. */
  async function once(
    url: string,
    init: RequestInit,
    ms: number,
    redirect: "manual" | "follow",
    media: boolean,
  ): Promise<Answer> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await doFetch(url, { ...init, cache: "no-store", redirect, signal: ctl.signal });
      if (media && res.ok) return { res, text: "", bytes: await readCapped(res) };
      return { res, text: await res.text() };
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh(): Promise<string> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }).toString();
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= MAX_ATTEMPTS - 1;
      let r: Answer;
      try {
        r = await once(
          tokenUrl,
          {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
          },
          t.token,
          "manual",
          false,
        );
      } catch {
        note("token", undefined, "drive_unavailable");
        if (last) throw new DriveError("drive_unavailable");
        await sleep(500 * 2 ** attempt + Math.floor(random() * 250));
        continue;
      }
      const { res, text } = r;
      if (res.ok) {
        const j = parseJson(text);
        if (!j || typeof j.access_token !== "string" || !j.access_token) {
          note("token", res.status, "drive_bad_response");
          throw new DriveError("drive_bad_response");
        }
        const secs = typeof j.expires_in === "number" ? j.expires_in : 3600;
        cached = { token: j.access_token, expires: now() + Math.max(0, secs - 60) * 1000 };
        return j.access_token;
      }
      if (res.status >= 300 && res.status < 400) {
        note("token", res.status, "drive_bad_response");
        throw new DriveError("drive_bad_response", res.status);
      }
      const reason = reasonOf(text);
      if (res.status === 429 || res.status >= 500) {
        note("token", res.status, "drive_unavailable", reason);
        if (last) {
          throw new DriveError(
            res.status === 429 ? "drive_rate_limited" : "drive_unavailable",
            res.status,
          );
        }
        await sleep(backoff(res, attempt));
        continue;
      }
      if (reason && AUTH_REASONS.has(reason)) cooldownUntil = now() + 60_000;
      note("token", res.status, "drive_auth", reason);
      throw new DriveError("drive_auth", res.status);
    }
  }

  function getToken(): Promise<string> {
    if (now() < cooldownUntil) return Promise.reject(new DriveError("drive_auth"));
    if (cached && now() < cached.expires) return Promise.resolve(cached.token);
    if (!inflight) {
      inflight = refresh().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  async function request(
    op: string,
    o: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: Uint8Array;
      timeoutMs: number;
      retry: boolean;
      media?: boolean;
    },
  ): Promise<Answer> {
    let authRetried = false;
    for (let attempt = 0; ; attempt++) {
      const token = await getToken();
      const last = !o.retry || attempt >= MAX_ATTEMPTS - 1;
      let r: Answer;
      try {
        r = await once(
          o.url,
          {
            method: o.method,
            headers: { ...o.headers, authorization: `Bearer ${token}` },
            body: o.body as BodyInit | undefined,
          },
          o.timeoutMs,
          o.media === true ? "follow" : "manual",
          o.media === true,
        );
      } catch (err) {
        if (err instanceof DriveError) {
          note(op, undefined, err.code);
          throw err;
        }
        note(op, undefined, "drive_unavailable");
        if (last) throw new DriveError("drive_unavailable");
        await sleep(500 * 2 ** attempt + Math.floor(random() * 250));
        continue;
      }
      const { res, text } = r;
      if (res.ok) return r;
      const reason = reasonOf(text);
      const status = res.status;
      if (status === 401) {
        note(op, status, "drive_auth", reason);
        if (authRetried) throw new DriveError("drive_auth", status);
        authRetried = true;
        cached = null;
        attempt--;
        continue;
      }
      const rate =
        status === 429 || (status === 403 && reason !== undefined && RATE_REASONS.has(reason));
      const server = status >= 500;
      if (rate || (server && o.retry)) {
        const code = rate ? "drive_rate_limited" : "drive_unavailable";
        note(op, status, code, reason);
        if (last) throw new DriveError(code, status);
        await sleep(backoff(res, attempt));
        continue;
      }
      const code: DriveCode =
        status === 404
          ? "drive_not_found"
          : status === 403
            ? "drive_forbidden"
            : server
              ? "drive_unavailable"
              : "drive_bad_response";
      note(op, status, code, reason);
      throw new DriveError(code, status);
    }
  }

  const fileUrl = (id: string) => {
    if (typeof id !== "string" || !DRIVE_ID_RE.test(id)) throw new DriveError("drive_invalid_id");
    return `${apiBase}/files/${encodeURIComponent(id)}`;
  };

  const idOf = (op: string, text: string): string => {
    const j = parseJson(text);
    if (!j || typeof j.id !== "string" || !DRIVE_ID_RE.test(j.id)) {
      note(op, 200, "drive_bad_response");
      throw new DriveError("drive_bad_response");
    }
    return j.id;
  };

  return {
    /**
     * Never retried on 5xx, network errors or timeouts (not idempotent); a 401 is refreshed and retried once.
     * `parentId` (a folder id) defaults to the configured root.
     */
    async createFile(f: {
      name: string;
      mimeType: string;
      bytes: Uint8Array;
      appProperties?: Record<string, string>;
      parentId?: string;
    }): Promise<{ id: string; size: number; mimeType: string }> {
      const { name, mimeType, bytes, appProperties, parentId } = f;
      if (parentId !== undefined && (typeof parentId !== "string" || !DRIVE_ID_RE.test(parentId))) {
        throw new DriveError("drive_invalid_id");
      }
      if (bytes.byteLength > DRIVE_MAX_BYTES) throw new DriveError("drive_too_large");
      if (!MIME_RE.test(mimeType)) throw new DriveError("drive_bad_response");
      const boundary = `simap${randomBytes(12).toString("hex")}`;
      const meta = JSON.stringify({
        name,
        mimeType,
        parents: [parentId ?? config.folderId],
        appProperties,
      });
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
            `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const { text } = await request("create", {
        method: "POST",
        url: `${uploadBase}/files?uploadType=multipart&fields=id,size,mimeType`,
        headers: { "content-type": `multipart/related; boundary=${boundary}` },
        body,
        timeoutMs: t.upload,
        retry: false,
      });
      const id = idOf("create", text);
      const j = parseJson(text);
      return { id, size: Number(j.size), mimeType: String(j.mimeType ?? mimeType) };
    },

    /** A folder inside the root. Not retried (not idempotent); a 401 is refreshed and retried once. */
    async createFolder(f: {
      name: string;
      appProperties?: Record<string, string>;
    }): Promise<{ id: string }> {
      const { text } = await request("folder-create", {
        method: "POST",
        url: `${apiBase}/files?fields=id`,
        headers: { "content-type": "application/json" },
        body: Buffer.from(
          JSON.stringify({
            name: f.name,
            mimeType: FOLDER_MIME,
            parents: [config.folderId],
            appProperties: f.appProperties,
          }),
        ),
        timeoutMs: t.meta,
        retry: false,
      });
      return { id: idOf("folder-create", text) };
    },

    /** The org's subfolder(s) under the root, found by appProperties. The org id is validated before use. */
    async findOrgFolders(orgId: string): Promise<{ id: string; createdTime: number | null }[]> {
      if (!isCanonicalUuid(orgId)) throw new DriveError("drive_invalid_id");
      const q =
        `'${config.folderId}' in parents and trashed = false and mimeType = '${FOLDER_MIME}'` +
        ` and appProperties has { key='app' and value='simap-folder' }` +
        ` and appProperties has { key='orgId' and value='${orgId}' }`;
      const out: { id: string; createdTime: number | null }[] = [];
      let pageToken: string | undefined;
      for (let pages = 0; ;) {
        if (++pages > MAX_PAGES) {
          note("list", 200, "drive_bad_response");
          throw new DriveError("drive_bad_response");
        }
        const params = new URLSearchParams({
          q,
          fields: "nextPageToken,files(id,createdTime)",
          pageSize: "100",
          spaces: "drive",
        });
        if (pageToken !== undefined) params.set("pageToken", pageToken);
        const { text } = await request("list", {
          method: "GET",
          url: `${apiBase}/files?${params}`,
          timeoutMs: t.meta,
          retry: true,
        });
        const j = parseJson(text);
        const next = j?.nextPageToken;
        if (
          !j ||
          !Array.isArray(j.files) ||
          (next !== undefined && (typeof next !== "string" || !next || next.length > 4096)) ||
          j.files.some((f: any) => typeof f?.id !== "string" || !DRIVE_ID_RE.test(f.id))
        ) {
          note("list", 200, "drive_bad_response");
          throw new DriveError("drive_bad_response");
        }
        for (const f of j.files) {
          const ms = typeof f.createdTime === "string" ? Date.parse(f.createdTime) : NaN;
          out.push({ id: f.id, createdTime: Number.isFinite(ms) ? ms : null });
        }
        pageToken = next;
        if (pageToken === undefined) return out;
      }
    },

    /** Buffered download, at most DRIVE_MAX_BYTES (drive_too_large above it). */
    async getFile(id: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
      const { res, bytes } = await request("get", {
        method: "GET",
        url: `${fileUrl(id)}?alt=media`,
        headers: { "accept-encoding": "identity" },
        timeoutMs: t.media,
        retry: true,
        media: true,
      });
      return { bytes: bytes ?? new Uint8Array(0), contentType: res.headers.get("content-type") };
    },

    /** Permanent delete; an already-gone file counts as success. */
    async deleteFile(id: string): Promise<void> {
      try {
        await request("delete", {
          method: "DELETE",
          url: fileUrl(id),
          timeoutMs: t.meta,
          retry: true,
        });
      } catch (err) {
        if (err instanceof DriveError && err.code === "drive_not_found") return;
        throw err;
      }
    },
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;
