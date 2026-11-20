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
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8 text-on-background">
      <div className="flex w-full max-w-[816px] flex-col items-center justify-center gap-10 md:flex-row">
        {scene && <SignInScene />}
        <div className="px-frame w-full max-w-[400px] flex-none">
          <div className="px-strip" aria-hidden="true" />
          <Card className="flex flex-col gap-4 rounded-none! border-0! p-5">
            <p className="text-xs font-semibold text-on-surface-variant">{authCopy.brand}</p>
            <h1 className="font-heading text-xl font-bold">{title}</h1>
            {children}
          </Card>
        </div>
      </div>
    </main>
  );
}
