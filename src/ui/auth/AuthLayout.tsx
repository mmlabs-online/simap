import type { ReactNode } from "react";
import { Card } from "../Card";
import { authCopy } from "../copy/auth";
import { SignInScene } from "./SignInScene";

/** The shared frame of every sign-in screen: a pixel-framed kit card, with the scene beside it from `md` up. */
export function AuthLayout({
  title,
  children,
  scene = true,
}: {
  title: string;
  children: ReactNode;
  scene?: boolean;
}) {
  return (
    <main className="px-stage flex min-h-dvh items-center justify-center overflow-x-clip px-5 py-8 text-on-background">
      <div className="flex w-full max-w-[816px] flex-col items-center justify-center gap-10 md:flex-row">
        {scene && <SignInScene />}
        <div className="px-frame w-full min-w-0 max-w-[400px] flex-none">
          <div className="px-strip">
            <p className="px-title">{authCopy.brand}</p>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <Card className="px-card flex flex-col gap-4 rounded-none! border-0! p-5">
            <h1 className="font-heading px-heading text-xl font-bold">{title}</h1>
            {children}
          </Card>
        </div>
      </div>
    </main>
  );
}
