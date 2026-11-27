"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { signinDrawList } from "@/lib/sprites/signin-scene";
import type { Atlas } from "../roomlayout/loadAtlas";
import { paintRoom } from "../roomlayout/paint";
import { useAtlas } from "../roomlayout/useAtlas";
import { MEDIA } from "@/lib/breakpoints";

const WIDE = MEDIA.md;

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Paints the composed `scene.signin` at 1x. False when it could not be painted (the placeholder stays). */
export function paintSignInScene(canvas: HTMLCanvasElement, atlas: Atlas): boolean {
  return paintRoom(canvas, atlas, signinDrawList(atlas.manifest), 1);
}

function SceneCanvas() {
  const { atlas } = useAtlas();
  const ref = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (atlas && ref.current) setPainted(paintSignInScene(ref.current, atlas));
  }, [atlas]);

  return (
    <canvas
      ref={ref}
      className={`px-scene-canvas absolute inset-0${painted ? "" : " invisible"}`}
    />
  );
}

/**
 * The sign-in vignette (D52): the CSS placeholder is always there, and from `md` up the composed office scene is
 * painted over it once the atlas has loaded. Decorative: hidden from assistive tech, no text. If the atlas fails the
 * placeholder stays.
 */
export function SignInScene() {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  return (
    <div aria-hidden="true" className="px-scene relative hidden md:block">
      {wide && <SceneCanvas />}
    </div>
  );
}
