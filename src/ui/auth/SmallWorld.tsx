"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { DrawList } from "@/lib/sprites/placement";
import {
  avatarDrawList,
  CARD_LOOK,
  WALKER_LOOKS,
  WORLD_ROOMS,
  type WorldRoomId,
} from "@/lib/sprites/small-world-scenes";
import type { SpriteManifest } from "@/lib/sprites/types";
import { authCopy } from "../copy/auth";
import type { Atlas } from "../roomlayout/loadAtlas";
import { paintRoom } from "../roomlayout/paint";
import { useAtlas } from "../roomlayout/useAtlas";

/** Same query as the aw-world CSS block: the decoration and the atlas fetch exist only from here up. */
export const WORLD_MEDIA = "(min-width: 1280px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(WORLD_MEDIA);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Paints one vignette at 1x. False when it could not be painted (the placeholder stays). */
export function paintVignette(canvas: HTMLCanvasElement, atlas: Atlas, list: DrawList): boolean {
  return paintRoom(canvas, atlas, list, 1);
}

const WorldAtlas = createContext<Atlas | null>(null);

/** The only caller of `useAtlas`; it renders only on a wide screen, so phones never fetch the atlas. */
function AtlasFeed({ onAtlas }: { onAtlas: (atlas: Atlas) => void }) {
  const { atlas } = useAtlas();
  useEffect(() => {
    if (atlas) onAtlas(atlas);
  }, [atlas, onAtlas]);
  return null;
}

function Vignette({
  build,
  className,
}: {
  build: (manifest: SpriteManifest) => DrawList;
  className: string;
}) {
  const atlas = useContext(WorldAtlas);
  const ref = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (atlas && ref.current) setPainted(paintVignette(ref.current, atlas, build(atlas.manifest)));
  }, [atlas, build]);

  if (!atlas) return null;
  return <canvas ref={ref} className={`${className}${painted ? "" : " invisible"}`} />;
}

const roomBuilders = Object.fromEntries(WORLD_ROOMS.map((r) => [r.id, r.drawList])) as Record<
  WorldRoomId,
  (manifest: SpriteManifest) => DrawList
>;
const walkerBuilders = WALKER_LOOKS.map(
  (look) => (manifest: SpriteManifest) => avatarDrawList(look, manifest),
);
const cardBuilder = (manifest: SpriteManifest) => avatarDrawList(CARD_LOOK, manifest);

function Room({ id, note }: { id: WorldRoomId; note?: string }) {
  return (
    <div className="aw-room">
      <span className="aw-room-label">{authCopy.world.rooms[id]}</span>
      <Vignette build={roomBuilders[id]} className="aw-room-canvas" />
      {note && <p className="aw-note">{note}</p>}
    </div>
  );
}

function Gap({ walker }: { walker: 0 | 1 }) {
  return (
    <div className="aw-world-gap">
      <Vignette build={walkerBuilders[walker]} className="aw-walker" />
    </div>
  );
}

/** The avatar beside the card intro ("Player, ready?"). Decorative; only a box without the atlas. */
export function CardAvatar() {
  return (
    <span className="aw-card-avatar" aria-hidden="true">
      <Vignette build={cardBuilder} className="aw-avatar-canvas" />
    </span>
  );
}

/**
 * The sign-in "small world": four decorative pixel rooms joined by paths around the card (`children`), with idle
 * avatars and two notes. Hidden below 1280 px by CSS and never painted there; the atlas is fetched once, only
 * when the screen is wide. If it fails the CSS placeholders stay. The card stays at a fixed tree position.
 */
export function SmallWorld({ children }: { children: ReactNode }) {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WORLD_MEDIA).matches,
    () => false,
  );
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [first, second] = authCopy.world.notes;

  return (
    <WorldAtlas.Provider value={wide ? atlas : null}>
      {wide && !atlas && <AtlasFeed onAtlas={setAtlas} />}
      <div className="aw-world">
        <div className="aw-world-center">{children}</div>
        <div className="aw-world-side" data-side="left" aria-hidden="true">
          <Room id="focus" note={first} />
          <Gap walker={0} />
          <Room id="lounge" />
        </div>
        <div className="aw-world-side" data-side="right" aria-hidden="true">
          <Room id="meeting" note={second} />
          <Gap walker={1} />
          <Room id="cafe" />
        </div>
        <div className="aw-world-path" aria-hidden="true" />
      </div>
    </WorldAtlas.Provider>
  );
}
