import type { ReactNode } from "react";
import { Card } from "../Card";
import { authCopy } from "../copy/auth";
import { Icon } from "../Icon";
import { SignInScene } from "./SignInScene";
import { CardAvatar, SmallWorld } from "./SmallWorld";

/**
 * The shared frame of every sign-in screen: header, a framed kit card (with the scene beside it from `md` up) and
 * footer. `landing` adds the hero and swaps the card title for the intro; the hero headline is then the page's `h1`.
 * On the landing the card sits inside the small world (four rooms from 1280 px up) and `scene` is ignored.
 */
export function AuthLayout({
  title,
  children,
  scene = true,
  landing = false,
}: {
  title: string;
  children: ReactNode;
  scene?: boolean;
  landing?: boolean;
}) {
  const w = authCopy.world;
  const frame = (
    <div className="aw-frame w-full min-w-0 max-w-[400px] flex-none">
      <div className="aw-strip">
        <span className="aw-strip-mark" aria-hidden="true" />
        <p className="aw-strip-title">{w.portalTitle}</p>
      </div>
      <Card className="aw-card flex flex-col gap-4 rounded-none! border-0! p-5">
        {landing ? (
          <div className="flex items-center gap-3">
            <CardAvatar />
            <div className="flex flex-col gap-1">
              <p className="aw-eyebrow">{w.introEyebrow}</p>
              <h2 className="font-heading aw-heading text-xl font-bold">{w.introHeading}</h2>
            </div>
          </div>
        ) : (
          <h1 className="font-heading aw-heading text-xl font-bold">{title}</h1>
        )}
        {children}
      </Card>
    </div>
  );
  return (
    <div className="aw-stage flex min-h-dvh flex-col overflow-x-clip">
      <header className="aw-header">
        <div className="aw-logo" aria-hidden="true">
          <Icon name="grid_view" filled size={24} />
        </div>
        <span className="aw-wordmark">{authCopy.brand}</span>
        <span className="aw-divider" aria-hidden="true" />
        <p className="aw-tagline">{w.tagline}</p>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-8">
        {landing && (
          <div className="aw-hero">
            <p className="aw-eyebrow">{w.eyebrow}</p>
            <h1 className="aw-headline">
              {w.headlineLead} <em className="aw-serif">{w.headlineEm}</em>
            </h1>
            <p className="aw-subline">{w.subline}</p>
          </div>
        )}
        {landing ? (
          <SmallWorld>{frame}</SmallWorld>
        ) : (
          <div className="flex w-full max-w-[816px] flex-col items-center justify-center gap-10 md:flex-row">
            {scene && <SignInScene />}
            {frame}
          </div>
        )}
      </main>
      <footer className="aw-footer">
        {w.footer.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </footer>
    </div>
  );
}
