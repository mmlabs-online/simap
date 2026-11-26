"use client";

import { useEffect, useRef, useState } from "react";
import { portalCopy } from "../copy/portal";
import type { PhotoActor } from "./own-photo-store";
import { photoErrorMessage } from "./profile-photo";
import { ProfilePhotoSection } from "./ProfilePhotoSection";
import { useOwnPhoto } from "./useOwnPhoto";

/** Connects the photo section to the shared own-photo store. */
export function ProfilePhoto({ name }: { name: string }) {
  const photo = useOwnPhoto();
  const [busy, setBusy] = useState<"processing" | "upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!photo) return null;

  const run = async (
    kind: "processing" | "remove",
    act: PhotoActor,
    done: string,
    start: string | null = null,
  ) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    setNotice(start);
    const r = await act();
    if (!mounted.current) return;
    if (r.ok) setNotice(done);
    else setError(photoErrorMessage(r.code));
    setBusy(null);
  };

  return (
    <ProfilePhotoSection
      name={name}
      url={photo.url}
      status={photo.status}
      busy={busy}
      error={error}
      notice={notice}
      onPick={(file) =>
        void run(
          "processing",
          () =>
            photo.upload(file, () => {
              if (!mounted.current) return;
              setBusy("upload");
              setNotice(null);
            }),
          portalCopy.profile.photo.saved,
          portalCopy.profile.photo.processingNotice,
        )
      }
      onRemove={() => void run("remove", () => photo.remove(), portalCopy.profile.photo.removed)}
    />
  );
}
