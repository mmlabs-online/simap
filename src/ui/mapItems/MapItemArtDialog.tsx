"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import { Button } from "../Button";
import { SpriteBrowser } from "./SpriteBrowser";
import { artDirs, artPanelView, expectedImageSize } from "./map-item-art";
import { artErrorMessage, artOutcome, checkMapItemImage } from "./map-item-image";
import type { MapItemsApi, MapItemsResult } from "./map-items-api";

const copy = mapItemsCopy.art;

type ArtCall = { (): Promise<MapItemsResult<unknown>> };

export type ArtBodyProps = {
  item: MapItemDto;
  imageUrl: (dir: Direction) => string | null;
  busy: boolean;
  errors: Partial<Record<Direction, string>>;
  browser: { dir: Direction; staged: string | null } | null;
  status: string | null;
  onChoose: (dir: Direction) => void;
  onStage: (key: string) => void;
  onUseSprite: () => void;
  onCancelBrowser: () => void;
  onUpload: (dir: Direction, file: File) => void;
  onUseLibrary: (dir: Direction) => void;
  onRemove: (dir: Direction) => void;
  chooseRefs?: { current: Partial<Record<Direction, HTMLButtonElement | null>> };
};

/** The per-direction panels. Pure: state and actions come from props. */
export function MapItemArtBody(p: ArtBodyProps) {
  const { item, busy } = p;
  const single = !item.directional;
  const fileRefs = useRef<Partial<Record<Direction, HTMLInputElement | null>>>({});
  return (
    <div className="flex flex-col gap-4">
      {artDirs(item).map((dir) => {
        const view = artPanelView(item, dir);
        const size = expectedImageSize(item, dir);
        const url = p.imageUrl(dir);
        const label = copy.dirs[dir]!;
        const error = p.errors[dir];
        return (
          <fieldset
            key={dir}
            className="flex flex-col gap-2 rounded-md3 border border-outline-variant p-3"
          >
            <legend className="px-1 text-sm font-extrabold text-on-surface">
              {single ? copy.single : label}
            </legend>
            {single && (
              <p className="text-xs font-medium text-on-surface-variant">{copy.sameForAll}</p>
            )}
            <p className="text-sm font-bold text-on-surface">
              {view.source === "image"
                ? copy.source.image
                : view.source === "sprite"
                  ? copy.source.sprite(view.spriteKey!)
                  : copy.source.library}
            </p>
            {view.spriteHidden && (
              <p className="text-xs font-medium text-on-surface-variant">
                {copy.source.hidden(view.spriteKey!)}
              </p>
            )}
            <p className="text-xs font-medium text-on-surface-variant">
              {copy.size(size.w, size.hMin, size.hMax)}
            </p>
            {view.canRemove &&
              (url ? (
                <div className="flex items-end gap-4 overflow-x-auto">
                  {[1, 2].map((scale) => (
                    <figure key={scale} className="m-0 flex flex-col gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${label} ${scale === 1 ? copy.scale1 : copy.scale2}`}
                        style={{ imageRendering: "pixelated", width: size.w * scale }}
                      />
                      <figcaption className="text-xs text-on-surface-variant">
                        {scale === 1 ? copy.scale1 : copy.scale2}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-medium text-on-surface-variant">{copy.previewNA}</p>
              ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                ref={(el) => {
                  p.chooseRefs && (p.chooseRefs.current[dir] = el);
                }}
                disabled={busy}
                onClick={() => p.onChoose(dir)}
                className="state-layer rounded-full border border-outline-variant bg-surface px-4 py-2 text-[13px] font-bold text-on-surface disabled:opacity-40 disabled:pointer-events-none"
              >
                {copy.choose}
              </button>
              <Button
                variant="tonal"
                size="sm"
                disabled={busy}
                onClick={() => fileRefs.current[dir]?.click()}
              >
                {copy.upload}
              </Button>
              <input
                type="file"
                accept="image/png"
                hidden
                ref={(el) => {
                  fileRefs.current[dir] = el;
                }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) p.onUpload(dir, file);
                }}
              />
              <Button
                variant="tonal"
                size="sm"
                disabled={busy || !view.canUseLibrary}
                onClick={() => p.onUseLibrary(dir)}
              >
                {copy.useLibrary}
              </Button>
              {view.canRemove && (
                <Button variant="tonal" size="sm" disabled={busy} onClick={() => p.onRemove(dir)}>
                  {copy.remove}
                </Button>
              )}
            </div>
            {view.canRemove && view.canUseLibrary && (
              <p className="text-xs font-medium text-on-surface-variant">{copy.useLibraryHint}</p>
            )}
            {error && (
              <p role="alert" className="text-[13px] font-semibold text-error">
                {error}
              </p>
            )}
            {p.browser?.dir === dir && (
              <SpriteBrowser
                item={item}
                dir={dir}
                current={view.spriteKey}
                staged={p.browser.staged}
                busy={busy}
                onStage={p.onStage}
                onUse={p.onUseSprite}
                onCancel={p.onCancelBrowser}
              />
            )}
          </fieldset>
        );
      })}
      <p role="status" className="text-xs font-semibold text-on-surface-variant">
        {p.status}
      </p>
    </div>
  );
}

/** Art dialog for one item: native `<dialog>` with a Close button; every action reloads the list through `onReload`. */
export function MapItemArtDialog({
  item,
  api,
  imageUrl,
  onReload,
  onClose,
}: {
  item: MapItemDto;
  api: MapItemsApi;
  imageUrl: (item: MapItemDto, dir: Direction) => string | null;
  onReload(): Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnScrim = useRef(false);
  const chooseRefs = useRef<Partial<Record<Direction, HTMLButtonElement | null>>>({});
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Direction, string>>>({});
  const [browser, setBrowser] = useState<{ dir: Direction; staged: string | null } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      previous?.focus?.();
    };
  }, []);

  const name = (dir: Direction) => (item.directional ? copy.dirs[dir]! : copy.single);

  async function run(dir: Direction, call: ArtCall, done: string) {
    setErrors((e) => ({ ...e, [dir]: undefined }));
    setStatus(null);
    setBusy(true);
    const out = artOutcome(await call(), item, dir);
    if (out.kind === "gone") return onClose();
    if (out.kind !== "saved") setErrors((e) => ({ ...e, [dir]: out.message }));
    if (out.kind !== "error") await onReload();
    if (out.kind === "saved") {
      setStatus(done);
      if (browser?.dir === dir) {
        setBrowser(null);
        chooseRefs.current[dir]?.focus();
      }
    }
    setBusy(false);
  }

  async function upload(dir: Direction, file: File) {
    const check = await checkMapItemImage(file, item, dir);
    if (!check.ok) {
      setStatus(null);
      setErrors((e) => ({ ...e, [dir]: artErrorMessage(check.code, item, dir, check.px) }));
      return;
    }
    await run(dir, () => api.putImage(item.builtinKey, dir, check.bytes), copy.saved(name(dir)));
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        pressedOnScrim.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        if (pressedOnScrim.current && e.target === e.currentTarget) onClose();
        pressedOnScrim.current = false;
      }}
      className="m-auto w-[calc(100%-2.5rem)] max-w-[760px] p-0 bg-surface-high text-on-surface rounded-md3-xl overflow-hidden shadow-[0_12px_40px_var(--shadow)]"
      style={{ animation: "popin .2s ease" }}
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="px-6 pt-[22px] pb-3.5">
          <h2 id={titleId} className="text-[20px] font-extrabold text-on-surface">
            {copy.title(item.name)}
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-on-surface-variant">{copy.hint}</p>
        </div>
        <div className="overflow-y-auto px-6 pb-2">
          <MapItemArtBody
            item={item}
            imageUrl={(dir) => imageUrl(item, dir)}
            busy={busy}
            errors={errors}
            browser={browser}
            status={status}
            chooseRefs={chooseRefs}
            onChoose={(dir) => setBrowser({ dir, staged: null })}
            onStage={(key) => setBrowser((b) => b && { ...b, staged: key })}
            onUseSprite={() => {
              if (browser?.staged) {
                void run(
                  browser.dir,
                  () => api.putArt(item.builtinKey, browser.dir, browser.staged),
                  copy.saved(name(browser.dir)),
                );
              }
            }}
            onCancelBrowser={() => {
              const dir = browser?.dir;
              setBrowser(null);
              if (dir) chooseRefs.current[dir]?.focus();
            }}
            onUpload={(dir, file) => void upload(dir, file)}
            onUseLibrary={(dir) =>
              void run(dir, () => api.putArt(item.builtinKey, dir, null), copy.saved(name(dir)))
            }
            onRemove={(dir) =>
              void run(dir, () => api.deleteImage(item.builtinKey, dir), copy.removed(name(dir)))
            }
          />
        </div>
        <div className="flex justify-end px-6 pt-3 pb-4">
          <Button variant="tonal" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
