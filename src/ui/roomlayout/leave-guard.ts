/** Leave guard for unsaved editor changes (DOM types only, no React). */

type AnchorLike = {
  href: string;
  target?: string;
  hasAttribute?: (name: string) => boolean;
};

export type LeaveEvent = {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: unknown;
};

export type PageLocation = { origin: string; pathname: string; search: string };

/** The in-app path of a plain left click on a same-origin link that would leave the page, else null. */
export function leaveHref(event: LeaveEvent, location: PageLocation): string | null {
  if (event.button !== 0 || event.defaultPrevented) return null;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return null;
  const el = event.target as { closest?: (selector: string) => unknown } | null;
  const anchor = (el?.closest?.("a[href]") ?? null) as AnchorLike | null;
  if (!anchor) return null;
  if (anchor.target === "_blank" || anchor.hasAttribute?.("download")) return null;
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.search === location.search && url.hash !== "") {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Tab close and reload: the browser shows its own prompt. */
export function onBeforeUnload(e: { preventDefault: () => void; returnValue?: unknown }): void {
  e.preventDefault();
  e.returnValue = "";
}

type Listener = (e: Event) => void;
type Target = {
  addEventListener: (type: string, fn: Listener, capture?: boolean) => void;
  removeEventListener: (type: string, fn: Listener, capture?: boolean) => void;
};

/**
 * Registers `beforeunload` and a capture-phase click listener, which runs before React's root listener
 * and so before `next/link`. Returns the function that removes both.
 */
export function attachLeaveGuard(
  win: Target & { location: PageLocation },
  doc: Target,
  onLink: (href: string) => void,
): () => void {
  const unload = onBeforeUnload as unknown as Listener;
  const click = ((e: LeaveEvent & { preventDefault: () => void; stopPropagation: () => void }) => {
    const href = leaveHref(e, win.location);
    if (href === null) return;
    e.preventDefault();
    e.stopPropagation();
    onLink(href);
  }) as unknown as Listener;
  win.addEventListener("beforeunload", unload);
  doc.addEventListener("click", click, true);
  return () => {
    win.removeEventListener("beforeunload", unload);
    doc.removeEventListener("click", click, true);
  };
}

/** A clean draft leaves at once; a dirty one asks first. */
export const leaveDecision = (dirty: boolean): "go" | "ask" => (dirty ? "ask" : "go");
