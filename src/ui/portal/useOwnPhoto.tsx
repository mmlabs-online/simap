"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { useSession } from "../session";
import {
  createOwnPhotoStore,
  type OwnPhotoSnapshot,
  type OwnPhotoStore,
  type PhotoAction,
} from "./own-photo-store";
import { createPhotoApi } from "./photo-api";

export type OwnPhoto = OwnPhotoSnapshot & {
  upload(file: File, onUploading?: () => void): Promise<PhotoAction>;
  remove(): Promise<PhotoAction>;
};

const OwnPhotoContext = createContext<OwnPhoto | null>(null);

const LOADING: OwnPhotoSnapshot = { status: "loading", url: null };

/**
 * One own-photo store per mount, shared by the shell avatar and the Profile tab. A sign-out, sign-in or org
 * switch remounts everything under the auth gate, so unmounting (dispose) is the session reset.
 */
export function OwnPhotoProvider({ children }: { children: ReactNode }) {
  const apiFetch = useApiFetch();
  const signedIn = useSession() !== null;
  const [store, setStore] = useState<OwnPhotoStore | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    const next = createOwnPhotoStore({
      api: createPhotoApi(apiFetch),
      create: (b) => URL.createObjectURL(b),
      revoke: (url) => URL.revokeObjectURL(url),
      onChange: () => setVersion((v) => v + 1),
    });
    setStore(next);
    void next.load();
    return () => {
      next.dispose();
      setStore(null);
    };
  }, [apiFetch, signedIn]);

  const value = useMemo<OwnPhoto | null>(() => {
    if (!store) return null;
    // `version` re-reads the snapshot after every store change
    void version;
    return {
      ...(store.snapshot() ?? LOADING),
      upload: (file, onUploading) => store.upload(file, onUploading),
      remove: () => store.remove(),
    };
  }, [store, version]);

  return <OwnPhotoContext.Provider value={value}>{children}</OwnPhotoContext.Provider>;
}

/** The own photo (null outside the provider or while signed out). */
export function useOwnPhoto(): OwnPhoto | null {
  return useContext(OwnPhotoContext);
}
