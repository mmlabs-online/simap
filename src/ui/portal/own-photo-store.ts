import { PHOTO_MIME } from "@/lib/validate/photo";
import type { PhotoApi } from "./photo-api";
import { checkPhotoFile } from "./profile-photo";

export type OwnPhotoSnapshot = { status: "loading" | "ready" | "failed"; url: string | null };
export type PhotoAction = { ok: true } | { ok: false; code: string };
export type PhotoActor = () => Promise<PhotoAction>;

/**
 * The member's own photo as one blob URL. A sequence number drops a stale GET; the store never refetches after a
 * change (it uses the bytes it just sent). `dispose` revokes the URL and silences later results.
 */
export function createOwnPhotoStore({
  api,
  create,
  revoke,
  onChange,
}: {
  api: Pick<PhotoApi, "get" | "put" | "remove">;
  create: (b: Blob) => string;
  revoke: (url: string) => void;
  onChange: () => void;
}) {
  let state: OwnPhotoSnapshot = { status: "loading", url: null };
  let seq = 0;
  let disposed = false;

  function swap(status: OwnPhotoSnapshot["status"], url: string | null) {
    const old = state.url;
    state = { status, url };
    onChange();
    if (old) revoke(old);
  }

  return {
    snapshot: () => state,
    async load() {
      const mine = ++seq;
      state = { ...state, status: "loading" };
      const r = await api.get();
      if (disposed || seq !== mine) return;
      if (!r.ok) swap("failed", null);
      else swap("ready", r.value ? create(r.value) : null);
    },
    async upload(file: {
      size: number;
      arrayBuffer(): Promise<ArrayBuffer>;
    }): Promise<PhotoAction> {
      const check = await checkPhotoFile(file);
      if (!check.ok) return { ok: false, code: check.code };
      const r = await api.put(check.bytes, check.type);
      if (!r.ok) return { ok: false, code: r.code };
      if (!disposed) {
        seq += 1;
        swap("ready", create(new Blob([check.bytes], { type: PHOTO_MIME[check.type] })));
      }
      return { ok: true };
    },
    async remove(): Promise<PhotoAction> {
      const r = await api.remove();
      if (!r.ok) return { ok: false, code: r.code };
      if (!disposed) {
        seq += 1;
        swap("ready", null);
      }
      return { ok: true };
    },
    dispose() {
      disposed = true;
      if (state.url) revoke(state.url);
      state = { status: state.status, url: null };
    },
  };
}

export type OwnPhotoStore = ReturnType<typeof createOwnPhotoStore>;
